// Metas de vendas: o dono define para a padaria toda (dia, semana, mês), um padrão para cada
// membro da equipe e, se quiser, metas individuais que valem no lugar do padrão.
import { Router, type Request } from 'express'
import type { RowDataPacket } from './db.ts'
import { z } from 'zod'
import { exigirPapel, type Usuario } from './auth.ts'
import { lerConfig, pool } from './db.ts'
import { HttpError, validar } from './http.ts'

export const metasRouter = Router()

export const periodos = ['dia', 'semana', 'mes'] as const
export type Periodo = (typeof periodos)[number]
type Valores = Record<Periodo, number | null>

const vazio = (): Valores => ({ dia: null, semana: null, mes: null })

// Tabela metas da padaria → { alvo: { dia, semana, mes } }.
export async function lerMetas(padariaId: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    'select alvo, periodo, valor from metas where padaria_id = ?',
    [padariaId],
  )
  const porAlvo = new Map<string, Valores>()
  for (const r of rows) {
    const v = porAlvo.get(r.alvo) ?? vazio()
    v[r.periodo as Periodo] = Number(r.valor)
    porAlvo.set(r.alvo, v)
  }
  // Padaria de antes das metas por período: a antiga "meta diária por pessoa" vira o padrão.
  if (!porAlvo.has('pessoa')) {
    const antiga = Number(await lerConfig(padariaId, 'meta_diaria_vendas', '0'))
    if (antiga > 0) porAlvo.set('pessoa', { ...vazio(), dia: antiga })
  }
  return porAlvo
}

// Meta que vale para a pessoa: a individual; sem ela, o padrão da equipe.
export function metaDaPessoa(metas: Map<string, Valores>, usuarioId: string, periodo: Periodo) {
  return metas.get(usuarioId)?.[periodo] ?? metas.get('pessoa')?.[periodo] ?? null
}

// Início do dia, da semana (segunda) e do mês no relógio do navegador (o servidor roda em UTC).
function lerInicios(req: Request) {
  const inicios = {} as Record<Periodo, Date>
  for (const p of periodos) {
    const v = req.query[p]
    const data = typeof v === 'string' ? new Date(v) : null
    if (!data || Number.isNaN(data.getTime())) throw new HttpError(400, 'Data inválida')
    inicios[p] = data
  }
  return inicios
}

metasRouter.get('/', async (req, res) => {
  const inicios = lerInicios(req)
  const padariaId: string = res.locals.padariaId
  const usuario = res.locals.usuario as Usuario
  const gestao = usuario.papel !== 'funcionario'
  // Metas lidas enquanto os totais são calculados.
  const pMetas = lerMetas(padariaId)

  const somas = periodos
    .map((p) => `coalesce(sum(case when v.created_at >= ? then v.total end), 0) as vendido_${p}`)
    .join(', ')
  const datas = periodos.map((p) => inicios[p])
  const menor = new Date(Math.min(...datas.map((d) => d.getTime())))

  // Totais da padaria e de cada pessoa ao mesmo tempo.
  const [[[geral]], [pessoas]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `select ${somas} from vendas v
       where v.padaria_id = ? and v.status <> 'devolvida' and v.created_at >= ?`,
      [...datas, padariaId, menor],
    ),
    pool.query<RowDataPacket[]>(
      `select u.id, u.nome, u.cargo, u.foto, u.papel, ${somas}
       from usuarios u
       left join vendas v on v.created_by = u.id and v.status <> 'devolvida' and v.created_at >= ?
       where u.padaria_id = ? and u.ativo = true ${gestao ? '' : 'and u.id = ?'}
       group by u.id, u.nome, u.cargo, u.foto, u.papel
       order by u.nome`,
      [...datas, menor, padariaId, ...(gestao ? [] : [usuario.id])],
    ),
  ])
  const metas = await pMetas
  // Funcionário vê só a própria meta; dono e gerência veem a equipe toda.

  const progresso = (meta: number | null, vendido: number) => ({ meta, vendido })
  res.json({
    geral: Object.fromEntries(
      periodos.map((p) => [
        p,
        progresso(metas.get('geral')?.[p] ?? null, Number(geral[`vendido_${p}`])),
      ]),
    ),
    padrao: metas.get('pessoa') ?? vazio(),
    membros: pessoas.map((u) => ({
      id: u.id,
      nome: u.nome,
      cargo: u.cargo,
      foto: u.foto,
      papel: u.papel,
      individual: metas.get(u.id) ?? vazio(),
      ...Object.fromEntries(
        periodos.map((p) => [
          p,
          progresso(metaDaPessoa(metas, u.id, p), Number(u[`vendido_${p}`])),
        ]),
      ),
    })),
  })
})

const valorSchema = z
  .number()
  .positive('A meta precisa ser maior que zero')
  .max(100_000_000)
  .nullable()

// Um período maior não pode ter meta menor que um período menor (ex.: R$ 10.000 no dia e
// R$ 1 na semana). Períodos em branco ficam de fora da comparação.
function incoerenciaMetas(v: { dia: number | null; semana: number | null; mes: number | null }) {
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (v.dia != null && v.semana != null && v.semana < v.dia) {
    return `A meta da semana (${brl(v.semana)}) não pode ser menor que a do dia (${brl(v.dia)}).`
  }
  if (v.semana != null && v.mes != null && v.mes < v.semana) {
    return `A meta do mês (${brl(v.mes)}) não pode ser menor que a da semana (${brl(v.semana)}).`
  }
  if (v.dia != null && v.mes != null && v.mes < v.dia) {
    return `A meta do mês (${brl(v.mes)}) não pode ser menor que a do dia (${brl(v.dia)}).`
  }
  return null
}

// Dono define as metas de um alvo de uma vez; null remove a meta daquele período.
metasRouter.put('/', exigirPapel('dono'), async (req, res) => {
  const m = validar(
    z
      .object({
        alvo: z.string().min(1),
        dia: valorSchema,
        semana: valorSchema,
        mes: valorSchema,
      })
      .superRefine((v, ctx) => {
        const erro = incoerenciaMetas(v)
        if (erro) ctx.addIssue({ code: 'custom', message: erro })
      }),
    req.body,
  )
  const padariaId: string = res.locals.padariaId
  if (m.alvo !== 'geral' && m.alvo !== 'pessoa') {
    const [rows] = await pool.query<RowDataPacket[]>(
      'select 1 from usuarios where id = ? and padaria_id = ?',
      [m.alvo, padariaId],
    )
    if (!rows[0]) throw new HttpError(404, 'Membro não encontrado')
  }
  for (const p of periodos) {
    const valor = m[p]
    if (valor == null) {
      await pool.query('delete from metas where padaria_id = ? and alvo = ? and periodo = ?', [
        padariaId,
        m.alvo,
        p,
      ])
    } else {
      await pool.query(
        `insert into metas (padaria_id, alvo, periodo, valor) values (?, ?, ?, ?)
         on conflict (padaria_id, alvo, periodo) do update set valor = excluded.valor`,
        [padariaId, m.alvo, p, valor],
      )
    }
  }
  // O padrão salvo aqui substitui a antiga meta diária única.
  if (m.alvo === 'pessoa') {
    await pool.query(
      "delete from padaria_config where padaria_id = ? and chave = 'meta_diaria_vendas'",
      [padariaId],
    )
  }
  res.status(204).end()
})
