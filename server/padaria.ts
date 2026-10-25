// Dados da padaria (nome, CNPJ, endereço...): cabeçalho do comprovante e página "Minha padaria".
// Guardados como JSON em padarias.dados.
import { Router } from 'express'
import type { RowDataPacket } from 'mysql2/promise'
import { exigirPapel } from './auth.ts'
import { lerPadaria, padariaSchema, salvarPadaria } from './cadastro.ts'
import { novoCodigoConvite, pool } from './db.ts'
import { validar } from './http.ts'

export const padariaRouter = Router()

padariaRouter.get('/', async (_req, res) => {
  res.json(await lerPadaria(res.locals.padariaId))
})

padariaRouter.put('/', exigirPapel('dono'), async (req, res) => {
  const dados = validar(padariaSchema, req.body)
  await salvarPadaria(res.locals.padariaId, dados)
  res.json(dados)
})

// Código que o funcionário informa em "Criar conta" para pedir acesso a esta padaria.
padariaRouter.get('/convite', exigirPapel('dono'), async (_req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'select codigo_convite from padarias where id = ?',
    [res.locals.padariaId],
  )
  res.json({ codigo: rows[0]?.codigo_convite ?? null })
})

// Gera um código novo (o antigo deixa de valer) — por exemplo, se vazou.
padariaRouter.post('/convite', exigirPapel('dono'), async (_req, res) => {
  const codigo = novoCodigoConvite()
  await pool.query('update padarias set codigo_convite = ? where id = ?', [
    codigo,
    res.locals.padariaId,
  ])
  res.json({ codigo })
})
