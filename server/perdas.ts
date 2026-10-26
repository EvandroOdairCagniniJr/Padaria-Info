// Perdas (sobras, vencidos, queimados...) e sugestão de produção pelo histórico de vendas.
import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { RowDataPacket } from 'mysql2/promise'
import { z } from 'zod'
import { exigirPapel } from './auth.ts'
import { pool, transaction } from './db.ts'
import { HttpError, validar } from './http.ts'
import { registrarMovimentacao } from './routes.ts'

export const perdasRouter = Router()

const DIA_MS = 24 * 60 * 60 * 1000
export const motivosPerda = ['sobra', 'vencido', 'queimado', 'quebra', 'outro'] as const

function lerData(valor: unknown, nome = 'Data') {
  const data = typeof valor === 'string' ? new Date(valor) : null
  if (!data || Number.isNaN(data.getTime())) throw new HttpError(400, `${nome} inválida`)
  return data
}

// Registrar perdas (todos): vários produtos de uma vez, como no fechamento do dia.
perdasRouter.post('/perdas', async (req, res) => {
  const p = validar(
    z.object({
      itens: z
        .array(
          z.object({
            produto_id: z.string().min(1),
            quantidade: z.number().positive('Informe uma quantidade maior que zero'),
          }),
        )
        .min(1, 'Informe pelo menos um produto'),
      motivo: z.enum(motivosPerda, 'Motivo inválido'),
      observacao: z.string().trim().max(255).nullish(),
    }),
    req.body,
  )
  const padariaId: string = res.locals.padariaId
  const usuarioId: string = res.locals.usuario.id
  await transaction(async (conn) => {
    for (const item of p.itens) {
      const [rows] = await conn.query<RowDataPacket[]>(
        'select preco_custo from produtos where id = ? and padaria_id = ? and ativo = true',
        [item.produto_id, padariaId],
      )
      if (!rows[0]) throw new HttpError(400, 'Um dos produtos não existe ou foi removido')
      await conn.query(
        `insert into perdas (id, padaria_id, produto_id, quantidade, motivo, observacao,
           custo_unitario, created_by)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          padariaId,
          item.produto_id,
          item.quantidade,
          p.motivo,
          p.observacao || null,
          Number(rows[0].preco_custo ?? 0),
          usuarioId,
        ],
      )
      await registrarMovimentacao(
        conn,
        padariaId,
        item.produto_id,
        'saida',
        item.quantidade,
        'perda',
        usuarioId,
      )
    }
  })
  res.status(204).end()
})

// Perdas do período + resumo: custo total, por motivo e taxa de perda por produto
// (perdido ÷ (vendido + perdido)).
perdasRouter.get('/perdas', async (req, res) => {
  const desde = lerData(req.query.desde)
  const ate = lerData(req.query.ate)
  const padariaId: string = res.locals.padariaId
  const [lista] = await pool.query<RowDataPacket[]>(
    `select pe.id, pe.produto_id, p.nome, p.unidade, p.categoria, pe.quantidade, pe.motivo,
            pe.observacao, pe.custo_unitario, pe.created_at, u.nome as registrado_por
     from perdas pe
     join produtos p on p.id = pe.produto_id
     left join usuarios u on u.id = pe.created_by
     where pe.padaria_id = ? and pe.created_at >= ? and pe.created_at < ?
     order by pe.created_at desc
     limit 300`,
    [padariaId, desde, ate],
  )
  const [porProduto] = await pool.query<RowDataPacket[]>(
    `select p.id, p.nome, p.unidade, p.categoria,
            coalesce(sum(pe.quantidade), 0) as perdido,
            coalesce(sum(pe.quantidade * pe.custo_unitario), 0) as custo,
            (select coalesce(sum(i.quantidade), 0) from vendas_itens i
               join vendas v on v.id = i.venda_id
              where i.produto_id = p.id and v.padaria_id = ? and v.status <> 'devolvida'
                and v.created_at >= ? and v.created_at < ?) as vendido
     from perdas pe join produtos p on p.id = pe.produto_id
     where pe.padaria_id = ? and pe.created_at >= ? and pe.created_at < ?
     group by p.id, p.nome, p.unidade, p.categoria
     order by custo desc`,
    [padariaId, desde, ate, padariaId, desde, ate],
  )
  const [porMotivo] = await pool.query<RowDataPacket[]>(
    `select motivo, coalesce(sum(quantidade * custo_unitario), 0) as custo, count(*) as registros
     from perdas where padaria_id = ? and created_at >= ? and created_at < ?
     group by motivo order by custo desc`,
    [padariaId, desde, ate],
  )
  const produtos = porProduto.map((r) => {
    const perdido = Number(r.perdido)
    const vendido = Number(r.vendido)
    return {
      id: r.id,
      nome: r.nome,
      unidade: r.unidade,
      categoria: r.categoria,
      perdido,
      vendido,
      custo: Number(r.custo),
      taxa: perdido + vendido > 0 ? perdido / (perdido + vendido) : 0,
    }
  })
  res.json({
    perdas: lista.map((r) => ({
      ...r,
      quantidade: Number(r.quantidade),
      custo_unitario: Number(r.custo_unitario),
    })),
    resumo: {
      custo: produtos.reduce((s, p) => s + p.custo, 0),
      porMotivo: porMotivo.map((m) => ({
        motivo: m.motivo,
        custo: Number(m.custo),
        registros: Number(m.registros),
      })),
      produtos,
    },
  })
})

// Desfazer um lançamento de perda feito por engano (o estoque volta). Só dono e gerência.
perdasRouter.delete('/perdas/:id', exigirPapel('dono', 'admin'), async (req, res) => {
  const padariaId: string = res.locals.padariaId
  await transaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      'select produto_id, quantidade from perdas where id = ? and padaria_id = ? for update',
      [req.params.id, padariaId],
    )
    if (!rows[0]) throw new HttpError(404, 'Registro de perda não encontrado')
    await registrarMovimentacao(
      conn,
      padariaId,
      rows[0].produto_id,
      'entrada',
      Number(rows[0].quantidade),
      'perda desfeita',
      res.locals.usuario.id,
    )
    await conn.query('delete from perdas where id = ?', [req.params.id])
  })
  res.status(204).end()
})

// Pesos das 4 últimas semanas (mesmo dia da semana): a mais recente pesa mais.
const PESOS = [4, 3, 2, 1]

// Sugestão de produção para um dia: para cada produto vendido no mesmo dia da semana nas
// últimas 4 semanas, a média ponderada do que vendeu e do que sobrou. Se quase não sobra,
// provavelmente faltou → sugere 10% a mais; se sobra muito, sugere só o que vende.
// `inicio` = início do dia desejado no relógio da padaria.
perdasRouter.get('/producao/sugestao', async (req, res) => {
  res.json(await calcularSugestao(res.locals.padariaId, lerData(req.query.inicio, 'Dia')))
})

export async function calcularSugestao(padariaId: string, inicio: Date) {
  const janelas = PESOS.map((_, k) => {
    const de = new Date(inicio.getTime() - (k + 1) * 7 * DIA_MS)
    return { de, ate: new Date(de.getTime() + DIA_MS) }
  })

  const colunas = janelas
    .map(
      (_, k) =>
        `coalesce(sum(case when v.created_at >= ? and v.created_at < ? then i.quantidade end), 0) as v${k}`,
    )
    .join(', ')
  const [vendas] = await pool.query<RowDataPacket[]>(
    `select i.produto_id, ${colunas}
     from vendas_itens i join vendas v on v.id = i.venda_id
     where v.padaria_id = ? and v.status <> 'devolvida' and v.created_at >= ? and v.created_at < ?
     group by i.produto_id`,
    [...janelas.flatMap((j) => [j.de, j.ate]), padariaId, janelas.at(-1)!.de, janelas[0].ate],
  )
  const colunasPerda = janelas
    .map(
      (_, k) =>
        `coalesce(sum(case when created_at >= ? and created_at < ? then quantidade end), 0) as p${k}`,
    )
    .join(', ')
  const [perdas] = await pool.query<RowDataPacket[]>(
    `select produto_id, ${colunasPerda} from perdas
     where padaria_id = ? and created_at >= ? and created_at < ?
     group by produto_id`,
    [...janelas.flatMap((j) => [j.de, j.ate]), padariaId, janelas.at(-1)!.de, janelas[0].ate],
  )
  const [produtos] = await pool.query<RowDataPacket[]>(
    `select p.id, p.nome, p.unidade, p.categoria, p.estoque_atual, p.created_at,
            r.id as receita_id, r.nome as receita_nome, r.rendimento
     from produtos p
     left join receitas r on r.id = (
       select r2.id from receitas r2 where r2.produto_id = p.id and r2.padaria_id = p.padaria_id
       order by r2.created_at limit 1)
     where p.padaria_id = ? and p.ativo = true`,
    [padariaId],
  )
  const perdaPor = new Map(perdas.map((p) => [p.produto_id, p]))
  const vendaPor = new Map(vendas.map((v) => [v.produto_id, v]))

  const sugestoes = []
  for (const p of produtos) {
    const v = vendaPor.get(p.id)
    if (!v) continue
    // Só contam as semanas em que o produto já existia.
    const criado = new Date(p.created_at).getTime()
    let pesoTotal = 0
    let vendido = 0
    let perdido = 0
    janelas.forEach((j, k) => {
      if (j.ate.getTime() <= criado) return
      pesoTotal += PESOS[k]
      vendido += Number(v[`v${k}`]) * PESOS[k]
      perdido += Number(perdaPor.get(p.id)?.[`p${k}`] ?? 0) * PESOS[k]
    })
    if (pesoTotal === 0) continue
    const mediaVendida = vendido / pesoTotal
    const mediaPerdida = perdido / pesoTotal
    const taxaSobra = mediaVendida + mediaPerdida > 0 ? mediaPerdida / (mediaVendida + mediaPerdida) : 0
    const folga = taxaSobra < 0.05 ? 0.1 : taxaSobra > 0.15 ? 0 : 0.05
    const estoque = Math.max(0, Number(p.estoque_atual))
    const inteiro = p.unidade === 'un'
    const bruto = Math.max(0, mediaVendida * (1 + folga) - estoque)
    const quantidade = inteiro ? Math.ceil(bruto) : Math.round(bruto * 10) / 10
    const rendimento = p.rendimento ? Number(p.rendimento) : null
    sugestoes.push({
      produto_id: p.id,
      nome: p.nome,
      unidade: p.unidade,
      categoria: p.categoria,
      media_vendida: Math.round(mediaVendida * 10) / 10,
      media_perdida: Math.round(mediaPerdida * 10) / 10,
      taxa_sobra: taxaSobra,
      estoque,
      sugestao: quantidade,
      motivo:
        folga === 0.1
          ? 'Quase não sobrou: produza um pouco a mais'
          : folga === 0
            ? 'Sobrou bastante: produza só o que vende'
            : 'Venda equilibrada',
      semanas: janelas.filter((j) => j.ate.getTime() > criado).length,
      receita_id: p.receita_id,
      receita_nome: p.receita_nome,
      rendimento,
      fornadas: rendimento && quantidade > 0 ? Math.ceil(quantidade / rendimento) : null,
    })
  }
  sugestoes.sort((a, b) => b.media_vendida - a.media_vendida)
  return sugestoes
}
