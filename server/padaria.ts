// Dados da padaria (nome, CNPJ, endereço...): cabeçalho do comprovante e página "Minha padaria".
// Guardados como JSON em configuracoes ('padaria').
import { Router } from 'express'
import { exigirPapel } from './auth.ts'
import { lerPadaria, padariaSchema, salvarPadaria } from './cadastro.ts'
import { validar } from './http.ts'

export const padariaRouter = Router()

padariaRouter.get('/', async (_req, res) => {
  res.json(await lerPadaria())
})

padariaRouter.put('/', exigirPapel('dono'), async (req, res) => {
  const dados = validar(padariaSchema, req.body)
  await salvarPadaria(dados)
  res.json(dados)
})
