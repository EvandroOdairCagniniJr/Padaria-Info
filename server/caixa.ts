// Caixa de cada operador: abertura (fundo de troco), sangria, suprimento e fechamento com a
// contagem. O "esperado" soma o que entrou no caixa por forma de pagamento.
import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { PoolConnection, RowDataPacket } from './db.ts'
import { z } from 'zod'
import { exigirPapel } from './auth.ts'
import { pool, transaction } from './db.ts'
import { HttpError, validar } from './http.ts'

export const caixaRouter = Router()

const formas = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito'] as const
type Forma = (typeof formas)[number]
type PorForma = Record<Forma, number>

const zerado = (): PorForma => ({ dinheiro: 0, pix: 0, cartao_debito: 0, cartao_credito: 0 })
const centavos = (v: number) => Math.round(v * 100) / 100

type Executor = PoolConnection | typeof pool

// Caixa aberto do operador (ou null). Vendas e sinais entram nele.
export async function caixaAberto(conn: Executor, padariaId: string, operadorId: string) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `select * from caixas where padaria_id = ? and operador_id = ? and fechado_em is null
     order by aberto_em desc limit 1`,
    [padariaId, operadorId],
  )
  return rows[0] ?? null
}

// Resumo do caixa: recebido por forma (vendas + sinais), sangrias/suprimentos e o esperado.
async function resumo(conn: Executor, caixa: RowDataPacket) {
  // Venda de encomenda: o sinal já entrou antes (talvez em outro caixa) — aqui só o restante.
  const consultaVendas = () =>
    conn.query<RowDataPacket[]>(
      `select v.forma_pagamento as forma, count(*) as quantidade,
            coalesce(sum(v.total - coalesce(e.sinal, 0)), 0) as valor
     from vendas v left join encomendas e on e.venda_id = v.id
     where v.caixa_id = ? and v.status <> 'devolvida'
     group by v.forma_pagamento`,
      [caixa.id],
    )
  const consultaSinais = () =>
    conn.query<RowDataPacket[]>(
      `select forma_sinal as forma, count(*) as quantidade, coalesce(sum(sinal), 0) as valor
     from encomendas where caixa_sinal_id = ? and sinal > 0 group by forma_sinal`,
      [caixa.id],
    )
  const consultaDevolvidas = () =>
    conn.query<RowDataPacket[]>(
      `select count(*) as quantidade, coalesce(sum(total), 0) as valor
     from vendas where caixa_id = ? and status = 'devolvida'`,
      [caixa.id],
    )
  const consultaMovimentos = () =>
    conn.query<RowDataPacket[]>(
      `select m.id, m.tipo, m.valor, m.motivo, m.created_at, u.nome as feito_por
     from caixa_movimentos m left join usuarios u on u.id = m.created_by
     where m.caixa_id = ? order by m.created_at`,
      [caixa.id],
    )
  const consultas = [consultaVendas, consultaSinais, consultaDevolvidas, consultaMovimentos]
  // Fora de transação as quatro consultas vão juntas; dentro, uma conexão só: em sequência.
  const resultados =
    conn === pool
      ? await Promise.all(consultas.map((c) => c()))
      : await consultas.reduce<Promise<(readonly [RowDataPacket[]])[]>>(
          async (acc, c) => [...(await acc), await c()],
          Promise.resolve([]),
        )
  const [[vendas], [sinais], [devolvidas], [movimentos]] = resultados
  const recebido = zerado()
  let quantidadeVendas = 0
  for (const v of vendas) {
    recebido[v.forma as Forma] += Number(v.valor)
    quantidadeVendas += Number(v.quantidade)
  }
  for (const s of sinais) recebido[s.forma as Forma] += Number(s.valor)
  const sangrias = movimentos
    .filter((m) => m.tipo === 'sangria')
    .reduce((s, m) => s + Number(m.valor), 0)
  const suprimentos = movimentos
    .filter((m) => m.tipo === 'suprimento')
    .reduce((s, m) => s + Number(m.valor), 0)
  const fundo = Number(caixa.fundo_troco)
  const esperado: PorForma = {
    ...recebido,
    // Na gaveta: fundo + dinheiro recebido + reforços − retiradas.
    dinheiro: fundo + recebido.dinheiro + suprimentos - sangrias,
  }
  for (const f of formas) {
    recebido[f] = centavos(recebido[f])
    esperado[f] = centavos(esperado[f])
  }
  return {
    recebido,
    esperado,
    total_recebido: centavos(formas.reduce((s, f) => s + recebido[f], 0)),
    quantidade_vendas: quantidadeVendas,
    sinais: sinais.reduce((s, x) => s + Number(x.quantidade), 0),
    devolvidas: {
      quantidade: Number(devolvidas[0].quantidade),
      valor: Number(devolvidas[0].valor),
    },
    sangrias: centavos(sangrias),
    suprimentos: centavos(suprimentos),
    movimentos: movimentos.map((m) => ({ ...m, valor: Number(m.valor) })),
  }
}

function formatarCaixa(c: RowDataPacket) {
  const json = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : (v ?? null))
  return {
    id: c.id,
    operador_id: c.operador_id,
    operador_nome: c.operador_nome,
    aberto_em: c.aberto_em,
    fechado_em: c.fechado_em,
    fundo_troco: Number(c.fundo_troco),
    esperado: json(c.esperado),
    contado: json(c.contado),
    diferenca: c.diferenca == null ? null : Number(c.diferenca),
    observacoes: c.observacoes,
  }
}

// Meu caixa aberto (com o resumo) e o fundo do último fechamento, para sugerir na abertura.
caixaRouter.get('/atual', async (_req, res) => {
  const padariaId: string = res.locals.padariaId
  const caixa = await caixaAberto(pool, padariaId, res.locals.usuario.id)
  if (!caixa) {
    const [ultimo] = await pool.query<RowDataPacket[]>(
      `select fundo_troco from caixas where padaria_id = ? and operador_id = ?
       order by aberto_em desc limit 1`,
      [padariaId, res.locals.usuario.id],
    )
    res.json({ caixa: null, fundo_sugerido: ultimo[0] ? Number(ultimo[0].fundo_troco) : null })
    return
  }
  res.json({ caixa: { ...formatarCaixa(caixa), resumo: await resumo(pool, caixa) } })
})

caixaRouter.post('/abrir', async (req, res) => {
  const { fundo_troco } = validar(
    z.object({ fundo_troco: z.number().nonnegative('Fundo de troco inválido').max(100_000) }),
    req.body,
  )
  const padariaId: string = res.locals.padariaId
  await transaction(async (conn) => {
    // Trava a linha do usuário: dois cliques não abrem dois caixas.
    await conn.query('select id from usuarios where id = ? for update', [res.locals.usuario.id])
    if (await caixaAberto(conn, padariaId, res.locals.usuario.id)) {
      throw new HttpError(409, 'Você já tem um caixa aberto')
    }
    await conn.query(
      'insert into caixas (id, padaria_id, operador_id, fundo_troco) values (?, ?, ?, ?)',
      [randomUUID(), padariaId, res.locals.usuario.id, fundo_troco],
    )
  })
  res.status(201).json({ ok: true })
})

// Sangria (retirada da gaveta, ex.: levar ao cofre) ou suprimento (reforço de troco).
caixaRouter.post('/movimento', async (req, res) => {
  const m = validar(
    z.object({
      tipo: z.enum(['sangria', 'suprimento']),
      valor: z.number().positive('Informe um valor maior que zero').max(1_000_000),
      motivo: z.string().trim().max(255).nullish(),
    }),
    req.body,
  )
  const padariaId: string = res.locals.padariaId
  await transaction(async (conn) => {
    const caixa = await caixaAberto(conn, padariaId, res.locals.usuario.id)
    if (!caixa) throw new HttpError(409, 'Abra o caixa primeiro')
    if (m.tipo === 'sangria') {
      const { esperado } = await resumo(conn, caixa)
      if (m.valor > esperado.dinheiro + 0.001) {
        throw new HttpError(400, 'A sangria é maior que o dinheiro esperado na gaveta')
      }
    }
    await conn.query(
      `insert into caixa_movimentos (id, padaria_id, caixa_id, tipo, valor, motivo, created_by)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), padariaId, caixa.id, m.tipo, m.valor, m.motivo || null, res.locals.usuario.id],
    )
  })
  res.status(204).end()
})

// Fechamento: grava o esperado e o contado; a diferença é a do dinheiro (quebra de caixa).
caixaRouter.post('/fechar', async (req, res) => {
  const f = validar(
    z.object({
      contado: z.object({
        dinheiro: z.number().nonnegative('Valor contado inválido'),
        pix: z.number().nonnegative().nullish(),
        cartao_debito: z.number().nonnegative().nullish(),
        cartao_credito: z.number().nonnegative().nullish(),
      }),
      observacoes: z.string().trim().max(500).nullish(),
    }),
    req.body,
  )
  const padariaId: string = res.locals.padariaId
  const fechado = await transaction(async (conn) => {
    const caixa = await caixaAberto(conn, padariaId, res.locals.usuario.id)
    if (!caixa) throw new HttpError(409, 'Nenhum caixa aberto')
    const r = await resumo(conn, caixa)
    const diferenca = centavos(f.contado.dinheiro - r.esperado.dinheiro)
    await conn.query(
      `update caixas set fechado_em = now(), esperado = ?, contado = ?, diferenca = ?, observacoes = ?
       where id = ?`,
      [
        JSON.stringify(r.esperado),
        JSON.stringify(f.contado),
        diferenca,
        f.observacoes || null,
        caixa.id,
      ],
    )
    return { id: caixa.id, esperado: r.esperado, contado: f.contado, diferenca, resumo: r }
  })
  res.json(fechado)
})

// Histórico (dono e gerência): caixas do período com diferenças.
caixaRouter.get('/historico', exigirPapel('dono', 'admin'), async (req, res) => {
  const q = validar(
    z.object({ desde: z.coerce.date('Data inválida'), ate: z.coerce.date('Data inválida') }),
    req.query,
  )
  const [rows] = await pool.query<RowDataPacket[]>(
    `select c.*, u.nome as operador_nome from caixas c
     left join usuarios u on u.id = c.operador_id
     where c.padaria_id = ? and c.aberto_em >= ? and c.aberto_em < ?
     order by c.aberto_em desc`,
    [res.locals.padariaId, q.desde, q.ate],
  )
  // Resumo de cada caixa ao mesmo tempo (caixa ainda aberto: o parcial até agora).
  const resumos = await Promise.all(rows.map((c) => resumo(pool, c)))
  const lista = rows.map((c, i) => ({ ...formatarCaixa(c), resumo: resumos[i] }))
  res.json(lista)
})
