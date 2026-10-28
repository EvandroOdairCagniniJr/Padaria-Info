// Dados de cadastro (pessoas e padaria): validação dos documentos brasileiros e schemas comuns.
// Documentos e telefones são guardados só com os dígitos; a máscara é coisa da tela.
import type { RowDataPacket } from './db.ts'
import { z } from 'zod'
import { pool } from './db.ts'
import { HttpError } from './http.ts'

export const digitos = (v: string) => v.replace(/\D/g, '')

function todosIguais(d: string) {
  return /^(\d)\1+$/.test(d)
}

export function cpfValido(valor: string) {
  const d = digitos(valor)
  if (d.length !== 11 || todosIguais(d)) return false
  for (const pos of [9, 10]) {
    let soma = 0
    for (let i = 0; i < pos; i++) soma += Number(d[i]) * (pos + 1 - i)
    const dv = ((soma * 10) % 11) % 10
    if (dv !== Number(d[pos])) return false
  }
  return true
}

export function cnpjValido(valor: string) {
  const d = digitos(valor)
  if (d.length !== 14 || todosIguais(d)) return false
  for (const pos of [12, 13]) {
    let soma = 0
    let peso = pos - 7
    for (let i = 0; i < pos; i++) {
      soma += Number(d[i]) * peso
      peso = peso === 2 ? 9 : peso - 1
    }
    const resto = soma % 11
    const dv = resto < 2 ? 0 : 11 - resto
    if (dv !== Number(d[pos])) return false
  }
  return true
}

// Texto opcional: vazio vira null; undefined continua undefined ("não mexer" numa edição).
export const texto = (max: number, rotulo: string) =>
  z
    .string()
    .trim()
    .max(max, `${rotulo}: no máximo ${max} caracteres`)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v ? v : null))

export const telefoneSchema = z
  .string()
  .nullish()
  .transform((v) => (v === undefined ? undefined : v ? digitos(v) : null))
  .refine(
    (v) => v == null || v.length === 10 || v.length === 11,
    'Telefone inválido: use DDD + número',
  )

export const cpfSchema = z
  .string()
  .nullish()
  .transform((v) => (v === undefined ? undefined : v ? digitos(v) : null))
  .refine((v) => v == null || cpfValido(v), 'CPF inválido')

export const cnpjSchema = z
  .string()
  .nullish()
  .transform((v) => (v === undefined ? undefined : v ? digitos(v) : null))
  .refine((v) => v == null || cnpjValido(v), 'CNPJ inválido')

const hoje = () => new Date().toISOString().slice(0, 10)

export const dataSchema = (rotulo: string, opcoes: { passado?: boolean } = {}) =>
  z
    .string()
    .nullish()
    .transform((v) => (v === undefined ? undefined : v ? v : null))
    .refine((v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v), `${rotulo} inválida`)
    .refine((v) => v == null || v >= '1900-01-01', `${rotulo} inválida`)
    .refine((v) => v == null || !opcoes.passado || v <= hoje(), `${rotulo} não pode ser no futuro`)

export const enderecoSchema = z
  .object({
    cep: z.string().optional(),
    logradouro: z.string().trim().max(120).optional(),
    numero: z.string().trim().max(20).optional(),
    complemento: z.string().trim().max(60).optional(),
    bairro: z.string().trim().max(80).optional(),
    cidade: z.string().trim().max(80).optional(),
    uf: z.string().trim().max(2).optional(),
  })
  .nullish()
  .transform((e) => {
    if (e === undefined) return undefined
    if (!e) return null
    const limpo = {
      cep: e.cep ? digitos(e.cep) : '',
      logradouro: e.logradouro ?? '',
      numero: e.numero ?? '',
      complemento: e.complemento ?? '',
      bairro: e.bairro ?? '',
      cidade: e.cidade ?? '',
      uf: (e.uf ?? '').toUpperCase(),
    }
    // Endereço todo em branco = sem endereço.
    return Object.values(limpo).some(Boolean) ? limpo : null
  })
  .refine((e) => !e || !e.cep || e.cep.length === 8, 'CEP inválido')

export const contatoEmergenciaSchema = z
  .object({
    nome: z.string().trim().max(120).optional(),
    parentesco: z.string().trim().max(40).optional(),
    telefone: z.string().optional(),
  })
  .nullish()
  .transform((c) => {
    if (c === undefined) return undefined
    if (!c) return null
    const limpo = {
      nome: c.nome ?? '',
      parentesco: c.parentesco ?? '',
      telefone: c.telefone ? digitos(c.telefone) : '',
    }
    return limpo.nome || limpo.telefone ? limpo : null
  })
  .refine(
    (c) => !c || !c.telefone || c.telefone.length === 10 || c.telefone.length === 11,
    'Telefone do contato de emergência inválido',
  )

export const turnos = ['manha', 'tarde', 'noite', 'madrugada', 'integral'] as const

// Dados pessoais: a própria pessoa (Editar perfil) e o dono (Equipe) podem mudar.
export const dadosPessoaisSchema = z.object({
  telefone: telefoneSchema,
  cpf: cpfSchema,
  data_nascimento: dataSchema('Data de nascimento', { passado: true }),
  endereco: enderecoSchema,
  contato_emergencia: contatoEmergenciaSchema,
})

// Dados do trabalho: só o dono.
export const dadosTrabalhoSchema = z.object({
  data_admissao: dataSchema('Data de admissão'),
  turno: z.enum(turnos, 'Turno inválido').nullish(),
  observacoes: texto(1000, 'Observações'),
})

// Um CPF só pode estar numa conta. A mensagem não diz de quem é: o cadastro é público e mostrar
// o nome deixaria qualquer pessoa descobrir o titular de um CPF.
export async function garantirCpfUnico(cpf: string | null | undefined, exceto?: string) {
  if (!cpf) return
  const [rows] = await pool.query<RowDataPacket[]>(
    'select 1 from usuarios where cpf = ? and id <> ? limit 1',
    [cpf, exceto ?? ''],
  )
  if (rows[0]) throw new HttpError(409, 'Este CPF já está cadastrado em outra conta.')
}

// ---------------------------------------------------------------- Padaria

export const padariaSchema = z.object({
  nome_fantasia: z.string().trim().min(1, 'Informe o nome da padaria').max(80),
  razao_social: texto(120, 'Razão social'),
  cnpj: cnpjSchema,
  inscricao_estadual: texto(20, 'Inscrição estadual'),
  telefone: telefoneSchema,
  whatsapp: telefoneSchema,
  email: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v == null || z.email().safeParse(v).success, 'E-mail da padaria inválido'),
  instagram: texto(60, 'Instagram'),
  horario: texto(120, 'Horário de funcionamento'),
  endereco: enderecoSchema,
  mensagem_comprovante: texto(120, 'Mensagem do comprovante'),
})

export type DadosPadaria = z.output<typeof padariaSchema>

export async function lerPadaria(padariaId: string): Promise<DadosPadaria | null> {
  const [rows] = await pool.query<RowDataPacket[]>('select dados from padarias where id = ?', [
    padariaId,
  ])
  const dados = rows[0]?.dados
  if (!dados) return null
  // O driver já devolve a coluna JSON como objeto.
  return (typeof dados === 'string' ? JSON.parse(dados) : dados) as DadosPadaria
}

export async function salvarPadaria(padariaId: string, dados: DadosPadaria) {
  await pool.query('update padarias set dados = ? where id = ?', [JSON.stringify(dados), padariaId])
}
