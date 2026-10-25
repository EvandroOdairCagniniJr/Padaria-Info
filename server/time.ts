// Mural da equipe (todos veem): quem trabalha na padaria, ranking de vendas e selos.
// Novidades (dono e gerência): o que cada um mudou no perfil.
import { Router } from 'express'
import type { RowDataPacket } from 'mysql2/promise'
import { exigirPapel } from './auth.ts'
import { pool } from './db.ts'
import { lerMetas, metaDaPessoa } from './metas.ts'
import { HttpError } from './http.ts'

export const timeRouter = Router()

const DIAS_SELO = 14

function lerData(valor: unknown) {
  const data = typeof valor === 'string' ? new Date(valor) : null
  if (!data || Number.isNaN(data.getTime())) throw new HttpError(400, 'Data inválida')
  return data
}

// Promoção = cargo trocado ou papel subindo para gerência, feito por outra pessoa (o dono),
// nos últimos DIAS_SELO dias. Mudar o próprio cargo no perfil não conta como promoção.
const ultimaPromocao = `
  from historico_perfil h
  where h.usuario_id = u.id and h.alterado_por <> u.id
    and (h.campo = 'cargo' or (h.campo = 'papel' and h.valor_novo = 'admin'))
    and h.created_at >= now() - interval ${DIAS_SELO} day
  order by h.created_at desc, h.campo = 'cargo' desc limit 1`

timeRouter.get('/', async (req, res) => {
  const desde = lerData(req.query.desde)
  const hoje = lerData(req.query.hoje)
  const [rows] = await pool.query<RowDataPacket[]>(
    `select u.id, u.nome, u.cargo, u.papel, u.foto, u.created_at,
       (select count(*) from vendas v where v.created_by = u.id and v.status <> 'devolvida' and v.created_at >= ?) as vendas,
       (select coalesce(sum(v.total), 0) from vendas v where v.created_by = u.id and v.status <> 'devolvida' and v.created_at >= ?) as total_vendas,
       (select coalesce(sum(v.total), 0) from vendas v where v.created_by = u.id and v.status <> 'devolvida' and v.created_at >= ?) as vendido_hoje,
       (select min(v.created_at) from vendas v where v.created_by = u.id and v.status <> 'devolvida' and v.created_at >= ?) as primeira_venda_hoje,
       (select h.created_at ${ultimaPromocao}) as promovido_em,
       (select concat(h.campo, ':', coalesce(h.valor_novo, '')) ${ultimaPromocao}) as promocao
     from usuarios u
     where u.padaria_id = ? and u.ativo = true
     order by total_vendas desc, vendas desc, u.nome`,
    [desde, desde, hoje, hoje, res.locals.padariaId],
  )

  // O que cada um vendeu no período, por produto: base dos adesivos por tipo
  // (doces, bebidas, pães...), que o navegador agrupa pela categoria/nome.
  const [itens] = await pool.query<RowDataPacket[]>(
    `select v.created_by as usuario_id, p.nome, p.categoria,
            sum(i.subtotal) as total, sum(i.quantidade) as quantidade
     from vendas_itens i
     join vendas v on v.id = i.venda_id
     join produtos p on p.id = i.produto_id
     where v.padaria_id = ? and v.created_at >= ? and v.created_by is not null
       and v.status <> 'devolvida'
     group by v.created_by, p.id, p.nome, p.categoria`,
    [res.locals.padariaId, desde],
  )
  const produtosPorMembro = new Map<
    string,
    { nome: string; categoria: string | null; total: number; quantidade: number }[]
  >()
  for (const i of itens) {
    const lista = produtosPorMembro.get(i.usuario_id) ?? []
    lista.push({
      nome: i.nome,
      categoria: i.categoria,
      total: Number(i.total),
      quantidade: Number(i.quantidade),
    })
    produtosPorMembro.set(i.usuario_id, lista)
  }

  const metas = await lerMetas(res.locals.padariaId)
  let posicao = 0
  const membros = rows.map((r) => {
    const total = Number(r.total_vendas)
    const [campo, valor] = r.promocao ? String(r.promocao).split(/:(.*)/s) : [null, null]
    return {
      id: r.id,
      nome: r.nome,
      cargo: r.cargo,
      papel: r.papel,
      foto: r.foto,
      created_at: r.created_at,
      vendas: Number(r.vendas),
      total_vendas: total,
      vendido_hoje: Number(r.vendido_hoje),
      // Meta do dia desta pessoa (individual ou o padrão da equipe); 0 = sem meta.
      meta_dia: metaDaPessoa(metas, r.id, 'dia') ?? 0,
      primeira_venda_hoje: r.primeira_venda_hoje,
      produtos: produtosPorMembro.get(r.id) ?? [],
      // Só entra no pódio quem vendeu no período.
      posicao: total > 0 ? ++posicao : null,
      promovido_em: r.promovido_em,
      // Cargo novo; promoção só de papel aparece como "Gerente".
      promovido_para: campo === 'cargo' ? valor : campo === 'papel' ? 'Gerente' : null,
    }
  })

  res.json({ meta: metas.get('pessoa')?.dia ?? 0, membros })
})

timeRouter.get('/novidades', exigirPapel('dono', 'admin'), async (_req, res) => {
  const [rows] = await pool.query(
    `select h.id, h.usuario_id, h.campo, h.valor_antigo, h.valor_novo, h.created_at,
            h.alterado_por, u.nome as usuario_nome, u.foto as usuario_foto, a.nome as alterado_por_nome
     from historico_perfil h
     join usuarios u on u.id = h.usuario_id
     left join usuarios a on a.id = h.alterado_por
     where u.padaria_id = ?
     order by h.created_at desc
     limit 30`,
    [res.locals.padariaId],
  )
  res.json(rows)
})
