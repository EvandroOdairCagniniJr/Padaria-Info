// Painel do dono: cadastro da equipe e acompanhamento do que cada um fez.
import { randomUUID } from 'node:crypto'
import { Router, type Request } from 'express'
import type { RowDataPacket } from 'mysql2/promise'
import { z } from 'zod'
import { cargoSchema, exigirPapel, fotoSchema, hashSenha, senhaSchema } from './auth.ts'
import { pool, salvarConfig } from './db.ts'
import { dadosPessoaisSchema, dadosTrabalhoSchema, garantirCpfUnico } from './cadastro.ts'
import { HttpError, validar } from './http.ts'
import { alterarPerfil } from './perfil.ts'

export const equipeRouter = Router()
equipeRouter.use(exigirPapel('dono'))

// O dono só cadastra admins e funcionários; existe um único dono (criado no primeiro acesso).
const papelEquipe = z.enum(['admin', 'funcionario'], 'Papel inválido')

// Cargo sugerido quando o dono não escolhe um.
const cargoPadrao = { admin: 'Gerente', funcionario: 'Atendente' } as const

function lerData(valor: unknown, padrao: Date) {
  const data = typeof valor === 'string' ? new Date(valor) : padrao
  if (Number.isNaN(data.getTime())) throw new HttpError(400, 'Data inválida')
  return data
}

function lerDesde(req: Request) {
  return lerData(req.query.desde, new Date(0))
}

equipeRouter.get('/membros', async (_req, res) => {
  const [rows] = await pool.query(
    `select id, nome, email, papel, cargo, ativo, ultimo_acesso, created_at from usuarios
     where padaria_id = ?
     order by ativo desc, field(papel, 'dono', 'admin', 'funcionario'), nome`,
    [res.locals.padariaId],
  )
  res.json(rows)
})

equipeRouter.post('/membros', async (req, res) => {
  const m = validar(
    z
      .object({
        nome: z.string().trim().min(1, 'Informe o nome'),
        email: z.email('Informe um e-mail válido'),
        senha: senhaSchema,
        papel: papelEquipe,
        cargo: cargoSchema.optional(),
        foto: fotoSchema.optional(),
      })
      .extend(dadosPessoaisSchema.shape)
      .extend(dadosTrabalhoSchema.shape),
    req.body,
  )
  await garantirCpfUnico(m.cpf)
  const id = randomUUID()
  const json = (v: object | null | undefined) => (v ? JSON.stringify(v) : null)
  await pool.query(
    `insert into usuarios (id, padaria_id, nome, email, senha_hash, papel, cargo, foto, telefone,
       cpf, data_nascimento, data_admissao, turno, endereco, contato_emergencia, observacoes)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      res.locals.padariaId,
      m.nome,
      m.email.trim().toLowerCase(),
      await hashSenha(m.senha),
      m.papel,
      m.cargo || cargoPadrao[m.papel],
      m.foto ?? null,
      m.telefone ?? null,
      m.cpf ?? null,
      m.data_nascimento ?? null,
      m.data_admissao ?? null,
      m.turno ?? null,
      json(m.endereco),
      json(m.contato_emergencia),
      m.observacoes ?? null,
    ],
  )
  res.status(201).json({ id })
})

equipeRouter.patch('/membros/:id', async (req, res) => {
  const m = validar(
    z
      .object({
        nome: z.string().trim().min(1, 'Informe o nome').optional(),
        papel: papelEquipe.optional(),
        ativo: z.boolean().optional(),
        senha: senhaSchema.optional(),
        cargo: cargoSchema.optional(),
        foto: fotoSchema.optional(),
      })
      .extend(dadosPessoaisSchema.shape)
      .extend(dadosTrabalhoSchema.shape),
    req.body,
  )
  await garantirCpfUnico(m.cpf, req.params.id)
  const [rows] = await pool.query<RowDataPacket[]>(
    'select papel from usuarios where id = ? and padaria_id = ?',
    [req.params.id, res.locals.padariaId],
  )
  if (!rows[0]) throw new HttpError(404, 'Membro não encontrado')
  // Proteção para o dono não se trancar fora do sistema.
  if (rows[0].papel === 'dono' && (m.papel !== undefined || m.ativo !== undefined)) {
    throw new HttpError(400, 'O papel e o acesso do dono não podem ser alterados')
  }

  await alterarPerfil(req.params.id, res.locals.usuario.id, {
    nome: m.nome,
    papel: m.papel,
    ativo: m.ativo,
    cargo: m.cargo,
    foto: m.foto,
    senha_hash: m.senha ? await hashSenha(m.senha) : undefined,
    telefone: m.telefone,
    cpf: m.cpf,
    data_nascimento: m.data_nascimento,
    data_admissao: m.data_admissao,
    turno: m.turno,
    endereco: m.endereco,
    contato_emergencia: m.contato_emergencia,
    observacoes: m.observacoes,
  })
  res.status(204).end()
})

// Desempenho de cada membro no período (vendas, ajustes de estoque, produções concluídas).
// `hoje` (início do dia no navegador) alimenta a barra da meta diária, qualquer que seja o período;
// recorde_dia é o maior total vendido pela pessoa num único dia.
equipeRouter.get('/resumo', async (req, res) => {
  const desde = lerDesde(req)
  const hoje = lerData(req.query.hoje, desde)
  const [rows] = await pool.query(
    `select u.id, u.nome, u.email, u.papel, u.cargo, u.foto, u.ativo, u.ultimo_acesso, u.created_at,
       u.telefone, u.cpf, u.data_nascimento, u.data_admissao, u.turno, u.endereco,
       u.contato_emergencia, u.observacoes,
       (select coalesce(sum(v.total), 0) from vendas v where v.created_by = u.id and v.status <> 'devolvida' and v.created_at >= ?) as vendido_hoje,
       (select coalesce(max(t), 0) from (
          select sum(v.total) as t from vendas v where v.created_by = u.id and v.status <> 'devolvida'
          group by date(v.created_at)
       ) dias) as recorde_dia,
       (select count(*) from vendas v where v.created_by = u.id and v.status <> 'devolvida' and v.created_at >= ?) as vendas,
       (select coalesce(sum(v.total), 0) from vendas v where v.created_by = u.id and v.status <> 'devolvida' and v.created_at >= ?) as total_vendas,
       (select count(*) from movimentacoes_estoque m
         where m.created_by = u.id and m.created_at >= ? and coalesce(m.motivo, '') not in ('venda', 'producao', 'devolucao')) as movimentacoes,
       (select count(*) from producoes p where p.concluida_por = u.id and p.concluida_em >= ?) as producoes,
       (select max(t) from (
          select max(v.created_at) as t from vendas v where v.created_by = u.id
          union all select max(m.created_at) from movimentacoes_estoque m where m.created_by = u.id
          union all select max(p.concluida_em) from producoes p where p.concluida_por = u.id
          union all select u.ultimo_acesso
       ) datas) as ultima_atividade
     from usuarios u
     where u.padaria_id = ?
     order by u.ativo desc, total_vendas desc, u.nome`,
    [hoje, desde, desde, desde, desde, res.locals.padariaId],
  )
  res.json(
    (rows as RowDataPacket[]).map((r) => ({
      ...r,
      vendas: Number(r.vendas),
      total_vendas: Number(r.total_vendas),
      movimentacoes: Number(r.movimentacoes),
      producoes: Number(r.producoes),
      vendido_hoje: Number(r.vendido_hoje),
      recorde_dia: Number(r.recorde_dia),
    })),
  )
})

// Linha do tempo: o que cada um fez por último. Movimentações automáticas de venda/produção
// ficam de fora (já aparecem como a própria venda/produção).
equipeRouter.get('/atividade', async (req, res) => {
  const limite = Math.min(Math.max(Number(req.query.limite) || 50, 1), 200)
  const usuarioId = typeof req.query.usuario_id === 'string' ? req.query.usuario_id : null
  const p = res.locals.padariaId
  const [rows] = await pool.query(
    `select a.*, u.nome as usuario_nome from (
       select 'venda' as tipo, v.id, v.created_at as quando, v.created_by as usuario_id,
              v.forma_pagamento as detalhe, null as produto, null as quantidade, null as unidade, v.total as valor
       from vendas v where v.padaria_id = ? and v.status <> 'devolvida'
       union all
       select 'estoque', m.id, m.created_at, m.created_by,
              m.tipo, p.nome, m.quantidade, p.unidade, null
       from movimentacoes_estoque m join produtos p on p.id = m.produto_id
       where m.padaria_id = ? and coalesce(m.motivo, '') not in ('venda', 'producao', 'devolucao')
       union all
       select 'producao', pr.id, pr.concluida_em, pr.concluida_por,
              null, r.nome, r.rendimento, null, null
       from producoes pr join receitas r on r.id = pr.receita_id
       where pr.padaria_id = ? and pr.status = 'concluido'
     ) a
     left join usuarios u on u.id = a.usuario_id
     where (? is null or a.usuario_id = ?)
     order by a.quando desc
     limit ?`,
    [p, p, p, usuarioId, usuarioId, limite],
  )
  res.json(rows)
})

// Meta diária de vendas por pessoa (0 desliga as comemorações de meta).
equipeRouter.put('/meta', async (req, res) => {
  const { meta } = validar(
    z.object({ meta: z.number().min(0, 'Meta inválida').max(1_000_000, 'Meta muito alta') }),
    req.body,
  )
  await salvarConfig(res.locals.padariaId, 'meta_diaria_vendas', String(meta))
  res.json({ meta })
})
