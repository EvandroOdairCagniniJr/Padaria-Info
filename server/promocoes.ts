// Promoções da padaria: cadastro (dono e gerência) e lista para o PDV aplicar sozinho.
// As regras de cálculo ficam em src/lib/promocoes.ts (mesmo código no PDV e aqui).
import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { z } from 'zod'
import type { Promocao } from '../src/lib/promocoes.ts'
import { exigirPapel } from './auth.ts'
import { pool } from './db.ts'
import { HttpError, validar } from './http.ts'

export const promocoesRouter = Router()

const json = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : (v ?? null))

function paraPromocao(r: RowDataPacket): Promocao {
  return {
    id: r.id,
    nome: r.nome,
    tipo: r.tipo,
    valor: Number(r.valor),
    leve: r.leve == null ? null : Number(r.leve),
    pague: r.pague == null ? null : Number(r.pague),
    abrangencia: r.abrangencia,
    alvos: json(r.alvos),
    inicio: r.inicio ? new Date(r.inicio).toISOString() : null,
    fim: r.fim ? new Date(r.fim).toISOString() : null,
    dias_semana: json(r.dias_semana),
    hora_inicio: r.hora_inicio,
    hora_fim: r.hora_fim,
    ativa: Boolean(r.ativa),
  }
}

// Promoções ativas da padaria (o filtro de dia/horário é feito por quem calcula).
export async function promocoesAtivas(conn: PoolConnection | typeof pool, padariaId: string) {
  const [rows] = await conn.query<RowDataPacket[]>(
    'select * from promocoes where padaria_id = ? and ativa = true and (fim is null or fim > now())',
    [padariaId],
  )
  return rows.map(paraPromocao)
}

// Para o PDV: todos veem as promoções ativas.
promocoesRouter.get('/ativas', async (_req, res) => {
  res.json(await promocoesAtivas(pool, res.locals.padariaId))
})

const hora = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido')
  .nullish()
  .transform((v) => v || null)

const promocaoSchema = z
  .object({
    nome: z.string().trim().min(1, 'Dê um nome para a promoção').max(80),
    tipo: z.enum(['percentual', 'valor', 'preco_fixo', 'leve_pague'], 'Tipo inválido'),
    valor: z.number().nonnegative('Valor inválido').default(0),
    leve: z.number().int().min(2).nullish(),
    pague: z.number().int().min(0).nullish(),
    abrangencia: z.enum(['produtos', 'categorias', 'tudo'], 'Escolha onde a promoção vale'),
    alvos: z.array(z.string().min(1)).nullish(),
    inicio: z.coerce.date().nullish(),
    fim: z.coerce.date().nullish(),
    dias_semana: z.array(z.number().int().min(0).max(6)).nullish(),
    hora_inicio: hora,
    hora_fim: hora,
    ativa: z.boolean().default(true),
  })
  .superRefine((p, ctx) => {
    const erro = (message: string) => ctx.addIssue({ code: 'custom', message })
    if (p.tipo === 'percentual' && !(p.valor > 0 && p.valor <= 100)) erro('O desconto em % vai de 1 a 100')
    if ((p.tipo === 'valor' || p.tipo === 'preco_fixo') && !(p.valor > 0)) erro('Informe o valor')
    if (p.tipo === 'leve_pague' && !(p.leve && p.pague != null && p.leve > p.pague)) {
      erro('Em "leve e pague", leve precisa ser maior que pague (ex.: leve 3 pague 2)')
    }
    if (p.abrangencia !== 'tudo' && !p.alvos?.length) erro('Escolha os produtos ou as categorias')
    if (p.inicio && p.fim && p.fim <= p.inicio) erro('O fim precisa ser depois do início')
  })

async function salvar(padariaId: string, id: string | null, body: unknown) {
  const p = validar(promocaoSchema, body)
  if (p.abrangencia === 'produtos') {
    const [rows] = await pool.query<RowDataPacket[]>(
      'select count(*) as n from produtos where padaria_id = ? and id in (?)',
      [padariaId, p.alvos],
    )
    if (Number(rows[0].n) !== new Set(p.alvos).size) throw new HttpError(400, 'Um dos produtos não existe')
  }
  const valores = [
    p.nome,
    p.tipo,
    p.tipo === 'leve_pague' ? 0 : p.valor,
    p.tipo === 'leve_pague' ? p.leve : null,
    p.tipo === 'leve_pague' ? p.pague : null,
    p.abrangencia,
    p.abrangencia === 'tudo' ? null : JSON.stringify(p.alvos),
    p.inicio ?? null,
    p.fim ?? null,
    p.dias_semana?.length ? JSON.stringify(p.dias_semana) : null,
    p.hora_inicio,
    p.hora_fim,
    p.ativa,
  ]
  if (id) {
    const [r] = await pool.query<RowDataPacket[] & { affectedRows: number }>(
      `update promocoes set nome = ?, tipo = ?, valor = ?, leve = ?, pague = ?, abrangencia = ?,
         alvos = ?, inicio = ?, fim = ?, dias_semana = ?, hora_inicio = ?, hora_fim = ?, ativa = ?
       where id = ? and padaria_id = ?`,
      [...valores, id, padariaId],
    )
    if (r.affectedRows === 0) throw new HttpError(404, 'Promoção não encontrada')
    return id
  }
  const novo = randomUUID()
  await pool.query(
    `insert into promocoes (nome, tipo, valor, leve, pague, abrangencia, alvos, inicio, fim,
       dias_semana, hora_inicio, hora_fim, ativa, id, padaria_id)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...valores, novo, padariaId],
  )
  return novo
}

const gestao = exigirPapel('dono', 'admin')

// Todas (inclusive pausadas e encerradas), com quanto já deram de desconto e em quantas vendas.
promocoesRouter.get('/', gestao, async (_req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `select p.*,
       (select coalesce(sum(i.desconto), 0) from vendas_itens i join vendas v on v.id = i.venda_id
         where i.promocao_id = p.id and v.status <> 'devolvida') as desconto_total,
       (select count(distinct i.venda_id) from vendas_itens i join vendas v on v.id = i.venda_id
         where i.promocao_id = p.id and v.status <> 'devolvida') as vendas
     from promocoes p where p.padaria_id = ? order by p.ativa desc, p.created_at desc`,
    [res.locals.padariaId],
  )
  res.json(
    rows.map((r) => ({
      ...paraPromocao(r),
      desconto_total: Number(r.desconto_total),
      vendas: Number(r.vendas),
    })),
  )
})

promocoesRouter.post('/', gestao, async (req, res) => {
  res.status(201).json({ id: await salvar(res.locals.padariaId, null, req.body) })
})

promocoesRouter.put('/:id', gestao, async (req, res) => {
  res.json({ id: await salvar(res.locals.padariaId, req.params.id, req.body) })
})

promocoesRouter.delete('/:id', gestao, async (req, res) => {
  await pool.query('delete from promocoes where id = ? and padaria_id = ?', [
    req.params.id,
    res.locals.padariaId,
  ])
  res.status(204).end()
})
