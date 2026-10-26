import { randomUUID } from 'node:crypto'
import { Router, type Response } from 'express'
import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { z } from 'zod'
import { pool, transaction } from './db.ts'
import { lerMetas, metaDaPessoa } from './metas.ts'
import { caixaAberto } from './caixa.ts'
import { promocoesAtivas } from './promocoes.ts'
import { aplicarPromocoes, type ItemParaPromocao } from '../src/lib/promocoes.ts'
import { exigirPapel, fotoSchema } from './auth.ts'
import { HttpError, validar } from './http.ts'

export const apiRouter = Router()

// Cadastros, financeiro e remoções: só dono e admin. O funcionário opera PDV, estoque e produção.
const gestao = exigirPapel('dono', 'admin')

function usuarioId(res: Response): string {
  return res.locals.usuario.id
}

// Padaria de quem está logado: TODA consulta de negócio filtra por ela.
function padariaId(res: Response): string {
  return res.locals.padariaId
}

// Garante que os produtos informados são desta padaria (ids vindos do navegador).
async function garantirProdutos(conn: PoolConnection | typeof pool, padaria: string, ids: string[]) {
  const unicos = [...new Set(ids)]
  if (unicos.length === 0) return
  const [rows] = await conn.query<RowDataPacket[]>(
    'select count(*) as total from produtos where padaria_id = ? and id in (?)',
    [padaria, unicos],
  )
  if (Number(rows[0].total) !== unicos.length) {
    throw new HttpError(400, 'Um dos produtos não existe ou foi removido')
  }
}

const textoOpcional = z
  .string()
  .nullish()
  .transform((v) => (v?.trim() ? v.trim() : null))

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')

// UPDATE só com as colunas enviadas (o schema já garante quais são permitidas).
async function atualizar(
  tabela: string,
  padaria: string,
  id: string,
  campos: Record<string, unknown>,
) {
  const entradas = Object.entries(campos).filter(([, v]) => v !== undefined)
  if (entradas.length === 0) return
  const [result] = await pool.query<RowDataPacket[] & { affectedRows: number }>(
    `update ${tabela} set ${entradas.map(([k]) => `\`${k}\` = ?`).join(', ')}
     where id = ? and padaria_id = ?`,
    [...entradas.map(([, v]) => v), id, padaria],
  )
  if (result.affectedRows === 0) throw new HttpError(404, 'Registro não encontrado')
}

// ---------------------------------------------------------------- Produtos

const produtoSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do produto'),
  categoria: textoOpcional,
  // Variedade de: agrupa produtos parecidos (Café → Coado, Cappuccino, Chocolatado).
  grupo: textoOpcional,
  unidade: z.string().min(1, 'Selecione a unidade'),
  preco_venda: z.number().nonnegative('Preço de venda inválido'),
  preco_custo: z.number().nonnegative('Preço de custo inválido').nullish(),
  estoque_atual: z.number().optional(),
  estoque_minimo: z.number().nonnegative('Estoque mínimo inválido').optional(),
})

apiRouter.get('/produtos', async (_req, res) => {
  const [rows] = await pool.query(
    'select * from produtos where padaria_id = ? and ativo = true order by nome',
    [padariaId(res)],
  )
  res.json(rows)
})

apiRouter.post('/produtos', gestao, async (req, res) => {
  const p = validar(produtoSchema, req.body)
  const id = randomUUID()
  await pool.query(
    `insert into produtos (id, padaria_id, nome, categoria, grupo, unidade, preco_venda, preco_custo,
       estoque_atual, estoque_minimo)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      padariaId(res),
      p.nome,
      p.categoria,
      p.grupo,
      p.unidade,
      p.preco_venda,
      p.preco_custo ?? null,
      p.estoque_atual ?? 0,
      p.estoque_minimo ?? 0,
    ],
  )
  res.status(201).json({ id })
})

apiRouter.patch('/produtos/:id', gestao, async (req, res) => {
  // estoque_atual só muda por movimentação (histórico), nunca por edição direta.
  const { estoque_atual: _ignorado, ...campos } = validar(produtoSchema.partial(), req.body)
  await atualizar('produtos', padariaId(res), req.params.id, campos)
  res.status(204).end()
})

// Remoção lógica: o produto continua referenciado por vendas e receitas antigas.
apiRouter.delete('/produtos/:id', gestao, async (req, res) => {
  await atualizar('produtos', padariaId(res), req.params.id, { ativo: false })
  res.status(204).end()
})

// Fotos das categorias (vitrine do PDV, listas). Só as que têm foto; as demais usam o ícone automático.
apiRouter.get('/categorias', async (_req, res) => {
  const [rows] = await pool.query(
    'select nome, foto from categorias_fotos where padaria_id = ? order by nome',
    [padariaId(res)],
  )
  res.json(rows)
})

apiRouter.put('/categorias/foto', gestao, async (req, res) => {
  const { nome, foto } = validar(
    z.object({ nome: z.string().trim().min(1, 'Informe a categoria').max(255), foto: fotoSchema }),
    req.body,
  )
  if (foto) {
    await pool.query(
      `insert into categorias_fotos (padaria_id, nome, foto) values (?, ?, ?)
       on duplicate key update foto = values(foto)`,
      [padariaId(res), nome, foto],
    )
  } else {
    await pool.query('delete from categorias_fotos where padaria_id = ? and nome = ?', [
      padariaId(res),
      nome,
    ])
  }
  res.status(204).end()
})

// ---------------------------------------------------------------- Estoque

type TipoMovimentacao = 'entrada' | 'saida' | 'ajuste'

export async function registrarMovimentacao(
  conn: PoolConnection,
  padaria: string,
  produtoId: string,
  tipo: TipoMovimentacao,
  quantidade: number,
  motivo: string | null,
  userId: string,
) {
  if (!(quantidade >= 0) || (tipo !== 'ajuste' && quantidade === 0)) {
    throw new HttpError(400, `Quantidade inválida: ${quantidade}`)
  }
  const [result] = await conn.query<RowDataPacket[] & { affectedRows: number }>(
    `update produtos set estoque_atual = case ?
       when 'entrada' then estoque_atual + ?
       when 'saida' then estoque_atual - ?
       else ? end
     where id = ? and padaria_id = ?`,
    [tipo, quantidade, quantidade, quantidade, produtoId, padaria],
  )
  if (result.affectedRows === 0) throw new HttpError(404, 'Produto não encontrado')
  await conn.query(
    `insert into movimentacoes_estoque (id, padaria_id, produto_id, tipo, quantidade, motivo, created_by)
     values (?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), padaria, produtoId, tipo, quantidade, motivo, userId],
  )
}

apiRouter.post('/estoque/movimentacoes', async (req, res) => {
  const m = validar(
    z.object({
      produto_id: z.string(),
      tipo: z.enum(['entrada', 'saida', 'ajuste'], 'Tipo de movimentação inválido'),
      quantidade: z.number(),
      motivo: textoOpcional,
    }),
    req.body,
  )
  await transaction((conn) =>
    registrarMovimentacao(
      conn,
      padariaId(res),
      m.produto_id,
      m.tipo,
      m.quantidade,
      m.motivo,
      usuarioId(res),
    ),
  )
  res.status(204).end()
})

// ---------------------------------------------------------------- Vendas

apiRouter.get('/vendas', gestao, async (req, res) => {
  const desde = typeof req.query.desde === 'string' ? new Date(req.query.desde) : new Date(0)
  if (Number.isNaN(desde.getTime())) throw new HttpError(400, 'Data inválida')
  const [rows] = await pool.query(
    `select v.*, u.nome as vendedor_nome from vendas v
     left join usuarios u on u.id = v.created_by
     where v.padaria_id = ? and v.created_at >= ? and v.status <> 'devolvida'
     order by v.created_at desc`,
    [padariaId(res), desde],
  )
  res.json(rows)
})

// Histórico (todos: o balcão precisa achar a venda para dar a 2ª via do comprovante).
// Período [desde, ate), busca por nº do comprovante, produto ou vendedor; 50 por página,
// continuando de onde parou (antes = data + id da última venda da página anterior).
apiRouter.get('/vendas/historico', async (req, res) => {
  const q = validar(
    z.object({
      desde: z.coerce.date('Data inválida'),
      ate: z.coerce.date('Data inválida'),
      busca: z.string().trim().max(100).optional(),
      forma: z.enum(['dinheiro', 'cartao_credito', 'cartao_debito', 'pix']).optional(),
      antes_data: z.coerce.date().optional(),
      antes_id: z.string().optional(),
    }),
    req.query,
  )

  const filtros = ['v.padaria_id = ?', 'v.created_at >= ?', 'v.created_at < ?']
  const params: unknown[] = [padariaId(res), q.desde, q.ate]
  if (q.forma) {
    filtros.push('v.forma_pagamento = ?')
    params.push(q.forma)
  }
  if (q.busca) {
    // "Nº 44E4C157", "#44e4" ou só "44e4": o número é o começo do id da venda.
    const numero = q.busca.replace(/^(n[º°o]?\.?|#)\s*/i, '').toLowerCase()
    const termo = `%${q.busca}%`
    filtros.push(`(v.id like ? or u.nome like ? or exists (
      select 1 from vendas_itens bi join produtos bp on bp.id = bi.produto_id
      where bi.venda_id = v.id and bp.nome like ?))`)
    params.push(`${numero}%`, termo, termo)
  }
  const where = filtros.join(' and ')

  const pagina: unknown[] = [...params]
  let cursor = ''
  if (q.antes_data && q.antes_id) {
    cursor = ' and (v.created_at, v.id) < (?, ?)'
    pagina.push(q.antes_data, q.antes_id)
  }

  const [vendas] = await pool.query<RowDataPacket[]>(
    `select v.id, v.total, v.forma_pagamento, v.valor_recebido, v.created_at, v.created_by,
            v.status, u.nome as vendedor_nome,
            (select count(*) from vendas_itens i where i.venda_id = v.id) as qtd_itens,
            (select group_concat(p.nome order by i.subtotal desc separator ', ')
               from vendas_itens i join produtos p on p.id = i.produto_id
               where i.venda_id = v.id) as resumo
     from vendas v left join usuarios u on u.id = v.created_by
     where ${where}${cursor}
     order by v.created_at desc, v.id desc
     limit 51`,
    pagina,
  )
  const temMais = vendas.length > 50

  // Totais do período (só na primeira página; as seguintes só trazem mais linhas).
  let totais = null
  if (!cursor) {
    const [[t]] = await pool.query<RowDataPacket[]>(
      `select sum(v.status <> 'devolvida') as quantidade,
              coalesce(sum(case when v.status <> 'devolvida' then v.total end), 0) as total,
              sum(v.status = 'devolvida') as devolvidas,
              coalesce(sum(case when v.status = 'devolvida' then v.total end), 0) as total_devolvido
       from vendas v left join usuarios u on u.id = v.created_by where ${where}`,
      params,
    )
    // Devolvidas aparecem na lista, mas não somam no total vendido.
    totais = {
      quantidade: Number(t.quantidade ?? 0),
      total: Number(t.total),
      devolvidas: Number(t.devolvidas ?? 0),
      total_devolvido: Number(t.total_devolvido),
    }
  }

  res.json({
    vendas: vendas.slice(0, 50).map((v) => ({ ...v, qtd_itens: Number(v.qtd_itens) })),
    temMais,
    totais,
  })
})

// Uma venda com os itens: tela de detalhes e 2ª via do comprovante.
apiRouter.get('/vendas/:id', async (req, res) => {
  const [[venda]] = await pool.query<RowDataPacket[]>(
    `select v.id, v.total, v.forma_pagamento, v.valor_recebido, v.created_at, v.created_by,
            v.status, v.devolvida_em, v.motivo_devolucao, v.desconto_promocoes, v.desconto_manual,
            u.nome as vendedor_nome, u.foto as vendedor_foto, d.nome as devolvida_por_nome
     from vendas v left join usuarios u on u.id = v.created_by
     left join usuarios d on d.id = v.devolvida_por
     where v.id = ? and v.padaria_id = ?`,
    [req.params.id, padariaId(res)],
  )
  if (!venda) throw new HttpError(404, 'Venda não encontrada')
  const [itens] = await pool.query(
    `select i.id, p.nome, p.categoria, p.unidade, i.quantidade, i.preco_unitario, i.subtotal,
            i.desconto, pr.nome as promocao
     from vendas_itens i join produtos p on p.id = i.produto_id
     left join promocoes pr on pr.id = i.promocao_id
     where i.venda_id = ? order by i.subtotal desc`,
    [req.params.id],
  )
  res.json({ ...venda, itens })
})

// Devolução (dono e gerência): o cliente devolveu tudo. Os produtos voltam ao estoque e a
// venda sai dos totais, mas continua no histórico como "Devolvida", com quem fez e o motivo.
apiRouter.post('/vendas/:id/devolver', gestao, async (req, res) => {
  const { motivo } = validar(
    z.object({
      motivo: z.string().trim().min(1, 'Informe o motivo da devolução').max(255, 'Motivo muito longo'),
    }),
    req.body,
  )
  const userId = usuarioId(res)
  await transaction(async (conn) => {
    const [[venda]] = await conn.query<RowDataPacket[]>(
      'select status from vendas where id = ? and padaria_id = ? for update',
      [req.params.id, padariaId(res)],
    )
    if (!venda) throw new HttpError(404, 'Venda não encontrada')
    if (venda.status === 'devolvida') throw new HttpError(409, 'Esta venda já foi devolvida')
    const [itens] = await conn.query<RowDataPacket[]>(
      'select produto_id, quantidade from vendas_itens where venda_id = ?',
      [req.params.id],
    )
    for (const item of itens) {
      await registrarMovimentacao(
        conn,
        padariaId(res),
        item.produto_id,
        'entrada',
        Number(item.quantidade),
        'devolucao',
        userId,
      )
    }
    await conn.query(
      `update vendas set status = 'devolvida', devolvida_em = now(), devolvida_por = ?,
         motivo_devolucao = ? where id = ?`,
      [userId, motivo, req.params.id],
    )
  })
  res.status(204).end()
})

// Funcionário pode dar até este desconto manual; dono e gerência, sem limite.
const LIMITE_DESCONTO_FUNCIONARIO = 0.1

// O preço vem sempre do cadastro, nunca do navegador; as promoções são recalculadas aqui
// (mesmas regras do PDV, em src/lib/promocoes.ts).
apiRouter.post('/vendas', async (req, res) => {
  const venda = validar(
    z.object({
      itens: z
        .array(z.object({ produto_id: z.string(), quantidade: z.number() }))
        .min(1, 'A venda precisa ter pelo menos um item'),
      forma_pagamento: z.enum(
        ['dinheiro', 'cartao_credito', 'cartao_debito', 'pix'],
        'Forma de pagamento inválida',
      ),
      valor_recebido: z.number().nonnegative().nullish(),
      // Desconto dado pelo caixa no pedido todo (R$ ou %).
      desconto_manual: z
        .object({ tipo: z.enum(['valor', 'percentual']), valor: z.number().nonnegative() })
        .nullish(),
      // Fuso do navegador (Date.getTimezoneOffset), para as promoções por dia/horário.
      tz: z.number().min(-840).max(840).default(180),
    }),
    req.body,
  )
  const userId = usuarioId(res)
  const papel = res.locals.usuario.papel as string

  const resultado = await transaction(async (conn) => {
    const itens: ItemParaPromocao[] = []
    for (const item of venda.itens) {
      if (!(item.quantidade > 0)) throw new HttpError(400, 'Quantidade inválida em um dos itens')
      const [rows] = await conn.query<RowDataPacket[]>(
        `select preco_venda, categoria, unidade from produtos
         where id = ? and padaria_id = ? and ativo = true`,
        [item.produto_id, padariaId(res)],
      )
      if (!rows[0]) throw new HttpError(400, 'Um dos produtos não existe ou foi removido')
      itens.push({
        produto_id: item.produto_id,
        categoria: rows[0].categoria,
        unidade: rows[0].unidade,
        quantidade: item.quantidade,
        preco: Number(rows[0].preco_venda),
      })
    }
    const calculados = aplicarPromocoes(
      itens,
      await promocoesAtivas(conn, padariaId(res)),
      new Date(),
      venda.tz,
    )
    const centavos = (v: number) => Math.round(v * 100) / 100
    const bruto = centavos(calculados.reduce((t, i) => t + i.bruto, 0))
    const descontoPromocoes = centavos(calculados.reduce((t, i) => t + i.desconto, 0))
    const aposPromocoes = centavos(bruto - descontoPromocoes)

    let descontoManual = 0
    if (venda.desconto_manual && venda.desconto_manual.valor > 0) {
      const d = venda.desconto_manual
      descontoManual = centavos(
        Math.min(aposPromocoes, d.tipo === 'percentual' ? (aposPromocoes * Math.min(100, d.valor)) / 100 : d.valor),
      )
      if (papel === 'funcionario' && descontoManual > aposPromocoes * LIMITE_DESCONTO_FUNCIONARIO + 0.001) {
        throw new HttpError(403, 'Desconto acima de 10% só com o gerente ou o dono.')
      }
    }
    const total = centavos(aposPromocoes - descontoManual)

    // O desconto manual é repartido entre os itens (proporcional), para que a soma dos itens
    // bata com o total — relatórios de produto e margem usam o subtotal de cada item.
    let restante = descontoManual
    const finais = calculados.map((i, idx) => {
      const parte =
        idx === calculados.length - 1
          ? restante
          : aposPromocoes > 0
            ? centavos((descontoManual * i.subtotal) / aposPromocoes)
            : 0
      restante = centavos(restante - parte)
      return { ...i, desconto: centavos(i.desconto + parte), subtotal: centavos(i.subtotal - parte) }
    })

    const vendaId = randomUUID()
    // A venda entra no caixa aberto de quem vendeu (se houver).
    const caixa = await caixaAberto(conn, padariaId(res), userId)
    await conn.query(
      `insert into vendas (id, padaria_id, total, forma_pagamento, valor_recebido, created_by, caixa_id,
         desconto_promocoes, desconto_manual)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vendaId,
        padariaId(res),
        total,
        venda.forma_pagamento,
        venda.forma_pagamento === 'dinheiro' ? (venda.valor_recebido ?? null) : null,
        userId,
        caixa?.id ?? null,
        descontoPromocoes,
        descontoManual,
      ],
    )
    for (const i of finais) {
      await conn.query(
        `insert into vendas_itens (id, venda_id, produto_id, quantidade, preco_unitario, subtotal,
           desconto, promocao_id)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), vendaId, i.produto_id, i.quantidade, i.preco, i.subtotal, i.desconto, i.promocao?.id ?? null],
      )
      await registrarMovimentacao(conn, padariaId(res), i.produto_id, 'saida', i.quantidade, 'venda', userId)
    }
    return {
      id: vendaId,
      total,
      bruto,
      desconto_promocoes: descontoPromocoes,
      desconto_manual: descontoManual,
      itens: calculados.map((i) => ({
        produto_id: i.produto_id,
        desconto: i.desconto,
        promocao: i.promocao?.nome ?? null,
      })),
    }
  })

  // O total cobrado volta para o comprovante (o preço pode ter mudado com o pedido aberto).
  res.status(201).json(resultado)
})

// ---------------------------------------------------------------- Financeiro

const contaSchema = z.object({
  tipo: z.enum(['pagar', 'receber']),
  descricao: z.string().trim().min(1, 'Informe a descrição'),
  categoria: textoOpcional,
  valor: z.number().positive('Informe um valor válido'),
  data_vencimento: dataISO,
  forma_pagamento: textoOpcional,
  observacoes: textoOpcional,
})

apiRouter.get('/contas', gestao, async (_req, res) => {
  const [rows] = await pool.query(
    `select * from contas_financeiras where padaria_id = ? and status <> 'cancelado'
     order by data_vencimento`,
    [padariaId(res)],
  )
  res.json(rows)
})

apiRouter.post('/contas', gestao, async (req, res) => {
  const c = validar(contaSchema, req.body)
  const id = randomUUID()
  await pool.query(
    `insert into contas_financeiras
       (id, padaria_id, tipo, descricao, categoria, valor, data_vencimento, forma_pagamento,
        observacoes, created_by)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      padariaId(res),
      c.tipo,
      c.descricao,
      c.categoria,
      c.valor,
      c.data_vencimento,
      c.forma_pagamento,
      c.observacoes,
      usuarioId(res),
    ],
  )
  res.status(201).json({ id })
})

apiRouter.patch('/contas/:id', gestao, async (req, res) => {
  await atualizar(
    'contas_financeiras',
    padariaId(res),
    req.params.id,
    validar(contaSchema.partial(), req.body),
  )
  res.status(204).end()
})

apiRouter.post('/contas/:id/pagar', gestao, async (req, res) => {
  const { data_pagamento } = validar(z.object({ data_pagamento: dataISO }), req.body)
  await atualizar('contas_financeiras', padariaId(res), req.params.id, {
    status: 'pago',
    data_pagamento,
  })
  res.status(204).end()
})

apiRouter.delete('/contas/:id', gestao, async (req, res) => {
  await pool.query('delete from contas_financeiras where id = ? and padaria_id = ?', [
    req.params.id,
    padariaId(res),
  ])
  res.status(204).end()
})

// ---------------------------------------------------------------- Receitas

const receitaSchema = z.object({
  produto_id: z.string().min(1, 'Selecione o produto final'),
  nome: z.string().trim().min(1, 'Informe o nome da receita'),
  rendimento: z.number().positive('Informe um rendimento válido'),
  modo_preparo: textoOpcional,
  itens: z
    .array(
      z.object({
        ingrediente_id: z.string().min(1, 'Selecione o ingrediente'),
        quantidade: z.number().positive('Informe uma quantidade válida'),
      }),
    )
    .min(1, 'A receita precisa ter pelo menos um ingrediente'),
})

apiRouter.get('/receitas', async (_req, res) => {
  const [rows] = await pool.query('select * from receitas where padaria_id = ? order by nome', [
    padariaId(res),
  ])
  res.json(rows)
})

apiRouter.get('/receita-itens', async (req, res) => {
  const receitaId = typeof req.query.receita_id === 'string' ? req.query.receita_id : null
  const [rows] = await pool.query(
    `select i.* from receita_itens i join receitas r on r.id = i.receita_id
     where r.padaria_id = ? and (? is null or i.receita_id = ?)`,
    [padariaId(res), receitaId, receitaId],
  )
  res.json(rows)
})

// Receita + ingredientes sempre gravados juntos (ou nada é gravado).
async function salvarReceita(padaria: string, id: string | null, body: unknown) {
  const r = validar(receitaSchema, body)
  return transaction(async (conn) => {
    await garantirProdutos(conn, padaria, [r.produto_id, ...r.itens.map((i) => i.ingrediente_id)])
    const receitaId = id ?? randomUUID()
    if (id) {
      const [result] = await conn.query<RowDataPacket[] & { affectedRows: number }>(
        `update receitas set produto_id = ?, nome = ?, rendimento = ?, modo_preparo = ?
         where id = ? and padaria_id = ?`,
        [r.produto_id, r.nome, r.rendimento, r.modo_preparo, id, padaria],
      )
      if (result.affectedRows === 0) throw new HttpError(404, 'Receita não encontrada')
      await conn.query('delete from receita_itens where receita_id = ?', [id])
    } else {
      await conn.query(
        `insert into receitas (id, padaria_id, produto_id, nome, rendimento, modo_preparo)
         values (?, ?, ?, ?, ?, ?)`,
        [receitaId, padaria, r.produto_id, r.nome, r.rendimento, r.modo_preparo],
      )
    }
    for (const item of r.itens) {
      await conn.query(
        'insert into receita_itens (id, receita_id, ingrediente_id, quantidade) values (?, ?, ?, ?)',
        [randomUUID(), receitaId, item.ingrediente_id, item.quantidade],
      )
    }
    return receitaId
  })
}

apiRouter.post('/receitas', gestao, async (req, res) => {
  res.status(201).json({ id: await salvarReceita(padariaId(res), null, req.body) })
})

apiRouter.put('/receitas/:id', gestao, async (req, res) => {
  res.json({ id: await salvarReceita(padariaId(res), req.params.id, req.body) })
})

// Produções só planejadas saem junto; com produção concluída a receita fica (é histórico de estoque).
apiRouter.delete('/receitas/:id', gestao, async (req, res) => {
  await transaction(async (conn) => {
    const [receita] = await conn.query<RowDataPacket[]>(
      'select 1 from receitas where id = ? and padaria_id = ? for update',
      [req.params.id, padariaId(res)],
    )
    if (!receita[0]) throw new HttpError(404, 'Receita não encontrada')
    const [concluidas] = await conn.query<RowDataPacket[]>(
      "select 1 from producoes where receita_id = ? and status = 'concluido' limit 1",
      [req.params.id],
    )
    if (concluidas.length > 0) {
      throw new HttpError(409, 'Esta receita já tem produções concluídas e não pode ser removida.')
    }
    await conn.query('delete from producoes where receita_id = ?', [req.params.id])
    await conn.query('delete from receitas where id = ?', [req.params.id])
  })
  res.status(204).end()
})

// ---------------------------------------------------------------- Produção

apiRouter.get('/producoes', async (_req, res) => {
  const [rows] = await pool.query(
    'select * from producoes where padaria_id = ? order by data desc, created_at desc',
    [padariaId(res)],
  )
  res.json(rows)
})

apiRouter.post('/producoes', async (req, res) => {
  const p = validar(
    z.object({
      receita_id: z.string().min(1, 'Selecione a receita'),
      data: dataISO,
      observacoes: textoOpcional,
    }),
    req.body,
  )
  const [receita] = await pool.query<RowDataPacket[]>(
    'select 1 from receitas where id = ? and padaria_id = ?',
    [p.receita_id, padariaId(res)],
  )
  if (!receita[0]) throw new HttpError(400, 'Receita não encontrada')
  const id = randomUUID()
  await pool.query(
    `insert into producoes (id, padaria_id, receita_id, data, observacoes, created_by)
     values (?, ?, ?, ?, ?, ?)`,
    [id, padariaId(res), p.receita_id, p.data, p.observacoes, usuarioId(res)],
  )
  res.status(201).json({ id })
})

// Produção concluída já movimentou o estoque — não pode ser removida.
apiRouter.delete('/producoes/:id', gestao, async (req, res) => {
  const [result] = await pool.query<RowDataPacket[] & { affectedRows: number }>(
    "delete from producoes where id = ? and padaria_id = ? and status <> 'concluido'",
    [req.params.id, padariaId(res)],
  )
  if (result.affectedRows === 0) {
    throw new HttpError(409, 'Produção não encontrada ou já concluída')
  }
  res.status(204).end()
})

apiRouter.post('/producoes/:id/concluir', async (req, res) => {
  const userId = usuarioId(res)
  await transaction(async (conn) => {
    // FOR UPDATE: dois cliques simultâneos não dão baixa duas vezes.
    const [producoes] = await conn.query<RowDataPacket[]>(
      'select receita_id, status from producoes where id = ? and padaria_id = ? for update',
      [req.params.id, padariaId(res)],
    )
    const producao = producoes[0]
    if (!producao) throw new HttpError(404, 'Produção não encontrada')
    if (producao.status !== 'planejado') {
      throw new HttpError(409, 'Esta produção não está mais planejada')
    }

    const [receitas] = await conn.query<RowDataPacket[]>(
      'select produto_id, rendimento from receitas where id = ?',
      [producao.receita_id],
    )
    const [itens] = await conn.query<RowDataPacket[]>(
      'select ingrediente_id, quantidade from receita_itens where receita_id = ?',
      [producao.receita_id],
    )
    for (const item of itens) {
      await registrarMovimentacao(
        conn,
        padariaId(res),
        item.ingrediente_id,
        'saida',
        Number(item.quantidade),
        'producao',
        userId,
      )
    }
    await registrarMovimentacao(
      conn,
      padariaId(res),
      receitas[0].produto_id,
      'entrada',
      Number(receitas[0].rendimento),
      'producao',
      userId,
    )

    await conn.query(
      "update producoes set status = 'concluido', concluida_em = now(), concluida_por = ? where id = ?",
      [userId, req.params.id],
    )
  })
  res.status(204).end()
})

// ---------------------------------------------------------------- Metas e conquistas

// Para a comemoração na tela de quem está logado: quanto vendeu hoje, a meta da padaria e o
// recorde anterior (maior dia antes de hoje). `desde` é o início do dia no navegador.
apiRouter.get('/conquistas', async (req, res) => {
  const desde = typeof req.query.desde === 'string' ? new Date(req.query.desde) : null
  if (!desde || Number.isNaN(desde.getTime())) throw new HttpError(400, 'Data inválida')
  const userId = usuarioId(res)
  const [[hoje], [recorde]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `select coalesce(sum(total), 0) as total, count(*) as vendas from vendas
       where created_by = ? and created_at >= ? and status <> 'devolvida'`,
      [userId, desde],
    ),
    pool.query<RowDataPacket[]>(
      `select coalesce(max(t), 0) as recorde from (
         select sum(total) as t from vendas where created_by = ? and created_at < ? and status <> 'devolvida'
         group by date(created_at)
       ) dias`,
      [userId, desde],
    ),
  ])
  res.json({
    meta: metaDaPessoa(await lerMetas(padariaId(res)), userId, 'dia') ?? 0,
    vendidoHoje: Number(hoje[0].total),
    vendasHoje: Number(hoje[0].vendas),
    recordeAnterior: Number(recorde[0].recorde),
  })
})
