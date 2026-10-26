// Encomendas: agenda de bolos, salgados e pedidos grandes, com sinal e status.
// Ao entregar, o restante é recebido e a encomenda vira uma venda (metas, faturamento, estoque).
import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { PoolConnection, RowDataPacket } from './db.ts'
import { z } from 'zod'
import { pool, transaction } from './db.ts'
import { HttpError, validar } from './http.ts'
import { registrarMovimentacao } from './routes.ts'
import { caixaAberto } from './caixa.ts'

export const encomendasRouter = Router()

const formas = ['dinheiro', 'cartao_credito', 'cartao_debito', 'pix'] as const
const statusAbertos = ['reservada', 'confirmada', 'em_producao', 'pronta'] as const

const encomendaSchema = z.object({
  cliente_nome: z.string().trim().min(1, 'Informe o nome do cliente').max(120),
  cliente_telefone: z
    .string()
    .nullish()
    .transform((v) => (v ? v.replace(/\D/g, '') : null))
    .refine((v) => !v || v.length === 10 || v.length === 11, 'Telefone inválido'),
  retirada_em: z.coerce.date('Informe a data e a hora'),
  entrega: z.boolean().default(false),
  endereco: z.string().trim().max(255).nullish(),
  itens: z
    .array(
      z.object({
        produto_id: z.string().min(1, 'Escolha o produto'),
        quantidade: z.number().positive('Quantidade inválida'),
        preco_unitario: z.number().nonnegative('Preço inválido'),
      }),
    )
    .min(1, 'A encomenda precisa de pelo menos um item'),
  sinal: z.number().nonnegative('Sinal inválido').default(0),
  forma_sinal: z.enum(formas).nullish(),
  observacoes: z.string().trim().max(2000).nullish(),
})

const centavos = (v: number) => Math.round(v * 100) / 100

async function gravarItens(
  conn: PoolConnection,
  padariaId: string,
  encomendaId: string,
  itens: z.infer<typeof encomendaSchema>['itens'],
) {
  const ids = [...new Set(itens.map((i) => i.produto_id))]
  const [rows] = await conn.query<RowDataPacket[]>(
    'select count(*) as total from produtos where padaria_id = ? and id in (?)',
    [padariaId, ids],
  )
  if (Number(rows[0].total) !== ids.length) throw new HttpError(400, 'Um dos produtos não existe')
  await conn.query('delete from encomendas_itens where encomenda_id = ?', [encomendaId])
  let total = 0
  for (const i of itens) {
    const subtotal = centavos(i.quantidade * i.preco_unitario)
    total += subtotal
    await conn.query(
      `insert into encomendas_itens (id, encomenda_id, produto_id, quantidade, preco_unitario, subtotal)
       values (?, ?, ?, ?, ?, ?)`,
      [randomUUID(), encomendaId, i.produto_id, i.quantidade, i.preco_unitario, subtotal],
    )
  }
  return centavos(total)
}

function validarSinal(sinal: number, total: number, forma: string | null | undefined) {
  if (sinal > total) throw new HttpError(400, 'O sinal não pode ser maior que o total')
  if (sinal > 0 && !forma) throw new HttpError(400, 'Informe como o sinal foi pago')
}

// Lista do período (pela data de retirada), com os itens.
encomendasRouter.get('/', async (req, res) => {
  const q = validar(
    z.object({ desde: z.coerce.date('Data inválida'), ate: z.coerce.date('Data inválida') }),
    req.query,
  )
  const padariaId: string = res.locals.padariaId
  const [encomendas] = await pool.query<RowDataPacket[]>(
    `select e.*, u.nome as criado_por_nome from encomendas e
     left join usuarios u on u.id = e.created_by
     where e.padaria_id = ?
       and ((e.retirada_em >= ? and e.retirada_em < ?)
         or (e.status in (?) and e.retirada_em < ?))
     order by e.retirada_em`,
    // Abertas e já vencidas aparecem sempre (atrasadas), mesmo fora do período.
    [padariaId, q.desde, q.ate, statusAbertos, q.desde],
  )
  const ids = encomendas.map((e) => e.id)
  const [itens] = ids.length
    ? await pool.query<RowDataPacket[]>(
        `select i.*, p.nome, p.unidade, p.categoria from encomendas_itens i
         join produtos p on p.id = i.produto_id where i.encomenda_id in (?)`,
        [ids],
      )
    : [[] as RowDataPacket[]]
  res.json(
    encomendas.map((e) => ({
      ...e,
      entrega: Boolean(e.entrega),
      total: Number(e.total),
      sinal: Number(e.sinal),
      itens: itens
        .filter((i) => i.encomenda_id === e.id)
        .map((i) => ({
          ...i,
          quantidade: Number(i.quantidade),
          preco_unitario: Number(i.preco_unitario),
          subtotal: Number(i.subtotal),
        })),
    })),
  )
})

encomendasRouter.post('/', async (req, res) => {
  const e = validar(encomendaSchema, req.body)
  const padariaId: string = res.locals.padariaId
  const resultado = await transaction(async (conn) => {
    // Número sequencial por padaria (#1, #2...): fácil de falar no balcão e no WhatsApp.
    // Trava a padaria: duas encomendas ao mesmo tempo não pegam o mesmo número.
    await conn.query('select id from padarias where id = ? for update', [padariaId])
    const [[ultimo]] = await conn.query<RowDataPacket[]>(
      'select coalesce(max(numero), 0) as n from encomendas where padaria_id = ?',
      [padariaId],
    )
    const id = randomUUID()
    const numero = Number(ultimo.n) + 1
    // O sinal entra no caixa aberto de quem recebeu.
    const caixa = e.sinal > 0 ? await caixaAberto(conn, padariaId, res.locals.usuario.id) : null
    await conn.query(
      `insert into encomendas (id, padaria_id, numero, cliente_nome, cliente_telefone, retirada_em,
         entrega, endereco, sinal, forma_sinal, observacoes, created_by, caixa_sinal_id)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        padariaId,
        numero,
        e.cliente_nome,
        e.cliente_telefone,
        e.retirada_em,
        e.entrega,
        e.entrega ? e.endereco || null : null,
        e.sinal,
        e.sinal > 0 ? e.forma_sinal : null,
        e.observacoes || null,
        res.locals.usuario.id,
        caixa?.id ?? null,
      ],
    )
    const total = await gravarItens(conn, padariaId, id, e.itens)
    validarSinal(e.sinal, total, e.forma_sinal)
    await conn.query('update encomendas set total = ? where id = ?', [total, id])
    return { id, numero, total }
  })
  res.status(201).json(resultado)
})

async function encomendaAberta(conn: PoolConnection, padariaId: string, id: string) {
  const [rows] = await conn.query<RowDataPacket[]>(
    'select * from encomendas where id = ? and padaria_id = ? for update',
    [id, padariaId],
  )
  const e = rows[0]
  if (!e) throw new HttpError(404, 'Encomenda não encontrada')
  if (e.status === 'entregue' || e.status === 'cancelada') {
    throw new HttpError(409, `Esta encomenda já foi ${e.status}`)
  }
  return e
}

encomendasRouter.put('/:id', async (req, res) => {
  const e = validar(encomendaSchema, req.body)
  const padariaId: string = res.locals.padariaId
  await transaction(async (conn) => {
    const atual = await encomendaAberta(conn, padariaId, req.params.id)
    // Sinal lançado só agora: entra no caixa aberto de quem está editando.
    const caixaSinal =
      atual.caixa_sinal_id ??
      (e.sinal > 0 ? ((await caixaAberto(conn, padariaId, res.locals.usuario.id))?.id ?? null) : null)
    const total = await gravarItens(conn, padariaId, req.params.id, e.itens)
    validarSinal(e.sinal, total, e.forma_sinal)
    await conn.query(
      `update encomendas set cliente_nome = ?, cliente_telefone = ?, retirada_em = ?, entrega = ?,
         endereco = ?, sinal = ?, forma_sinal = ?, observacoes = ?, total = ?, caixa_sinal_id = ?
       where id = ?`,
      [
        e.cliente_nome,
        e.cliente_telefone,
        e.retirada_em,
        e.entrega,
        e.entrega ? e.endereco || null : null,
        e.sinal,
        e.sinal > 0 ? e.forma_sinal : null,
        e.observacoes || null,
        total,
        caixaSinal,
        req.params.id,
      ],
    )
  })
  res.status(204).end()
})

// Avança o status (confirmada, em produção, pronta) ou cancela.
encomendasRouter.post('/:id/status', async (req, res) => {
  const { status } = validar(
    z.object({ status: z.enum(['reservada', 'confirmada', 'em_producao', 'pronta', 'cancelada']) }),
    req.body,
  )
  await transaction(async (conn) => {
    await encomendaAberta(conn, res.locals.padariaId, req.params.id)
    await conn.query('update encomendas set status = ? where id = ?', [status, req.params.id])
  })
  res.status(204).end()
})

// Entregar: recebe o restante, registra a venda (preços combinados na encomenda) e baixa o estoque.
encomendasRouter.post('/:id/entregar', async (req, res) => {
  const { forma_pagamento, valor_recebido } = validar(
    z.object({
      forma_pagamento: z.enum(formas, 'Forma de pagamento inválida'),
      valor_recebido: z.number().nonnegative().nullish(),
    }),
    req.body,
  )
  const padariaId: string = res.locals.padariaId
  const usuarioId: string = res.locals.usuario.id
  const vendaId = await transaction(async (conn) => {
    const e = await encomendaAberta(conn, padariaId, req.params.id)
    const [itens] = await conn.query<RowDataPacket[]>(
      'select * from encomendas_itens where encomenda_id = ?',
      [e.id],
    )
    const restante = centavos(Number(e.total) - Number(e.sinal))
    if (forma_pagamento === 'dinheiro' && restante > 0 && valor_recebido != null && valor_recebido < restante) {
      throw new HttpError(400, 'Valor recebido menor que o restante a pagar')
    }
    const vendaId = randomUUID()
    const caixa = await caixaAberto(conn, padariaId, usuarioId)
    // Sem restante (tudo pago no sinal), a venda fica com a forma do sinal.
    const forma = restante > 0 ? forma_pagamento : (e.forma_sinal ?? forma_pagamento)
    await conn.query(
      `insert into vendas (id, padaria_id, total, forma_pagamento, valor_recebido, created_by, caixa_id)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [
        vendaId,
        padariaId,
        Number(e.total),
        forma,
        // O sinal já entrou antes: o troco é calculado só sobre o restante, na tela de entrega.
        null,
        usuarioId,
        caixa?.id ?? null,
      ],
    )
    for (const i of itens) {
      await conn.query(
        `insert into vendas_itens (id, venda_id, produto_id, quantidade, preco_unitario, subtotal)
         values (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), vendaId, i.produto_id, i.quantidade, i.preco_unitario, i.subtotal],
      )
      await registrarMovimentacao(
        conn,
        padariaId,
        i.produto_id,
        'saida',
        Number(i.quantidade),
        'venda',
        usuarioId,
      )
    }
    await conn.query("update encomendas set status = 'entregue', venda_id = ? where id = ?", [
      vendaId,
      e.id,
    ])
    return vendaId
  })
  res.json({ venda_id: vendaId })
})
