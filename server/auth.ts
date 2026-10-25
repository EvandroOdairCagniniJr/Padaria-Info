import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express'
import jwt from 'jsonwebtoken'
import type { RowDataPacket } from 'mysql2'
import { z } from 'zod'
import { novoCodigoConvite, pool } from './db.ts'
import { HttpError, limitarTentativas, validar } from './http.ts'
import {
  dadosPessoaisSchema,
  garantirCpfUnico,
  lerPadaria,
  padariaSchema,
} from './cadastro.ts'
import { alterarPerfil } from './perfil.ts'
import { enviarCodigoSenha } from './email.ts'

const COOKIE = 'padaria_token'
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

const producao = process.env.NODE_ENV === 'production'
if (producao && !process.env.JWT_SECRET) {
  throw new Error('Defina JWT_SECRET nas variáveis de ambiente antes de subir em produção.')
}
const jwtSecret =
  process.env.JWT_SECRET ??
  (console.warn('JWT_SECRET não definido no .env — os logins expiram ao reiniciar o servidor.'),
  randomBytes(32).toString('hex'))

export type Papel = 'dono' | 'admin' | 'funcionario'

export interface Usuario {
  id: string
  // Padaria da pessoa: toda consulta de negócio filtra por ela (res.locals.padariaId).
  padaria_id: string
  nome: string
  email: string
  papel: Papel
  cargo: string
  foto: string | null
}

export const senhaSchema = z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres')

// Foto já reduzida pelo navegador (src/lib/imagem.ts); ~30 KB, limite folgado de 400 KB.
export const fotoSchema = z
  .string()
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'Foto inválida')
  .max(400_000, 'Foto muito grande')
  .nullable()

export const CARGO_DONO = 'Dono(a) da padaria'

const colunasUsuario = 'id, padaria_id, nome, email, papel, cargo, foto'

export function hashSenha(senha: string) {
  return bcrypt.hash(senha, 10)
}

function iniciarSessao(res: Response, usuario: Usuario) {
  const token = jwt.sign({ sub: usuario.id }, jwtSecret, { expiresIn: '7d' })
  // Em produção (HTTPS) o cookie só trafega criptografado.
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: producao,
    maxAge: SETE_DIAS_MS,
  })
  res.json(usuario)
}

async function buscarUsuarioAtivo(id: string): Promise<Usuario | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `select ${colunasUsuario} from usuarios where id = ? and ativo = true`,
    [id],
  )
  return (rows[0] as Usuario | undefined) ?? null
}

async function emailEmUso(email: string) {
  const [rows] = await pool.query<RowDataPacket[]>('select 1 from usuarios where email = ?', [email])
  return rows.length > 0
}

export const authRouter = Router()

// Rotas públicas que recebem senha ou disparam e-mail: poucas tentativas por minuto por IP.
authRouter.use(['/login', '/cadastro', '/setup', '/esqueci-senha', '/codigo'], limitarTentativas)

authRouter.post('/login', async (req, res) => {
  const { email, senha, perfil } = validar(
    z.object({
      email: z.string(),
      senha: z.string(),
      // Escolha da tela de login: "Sou dono(a)" ou "Sou da equipe".
      perfil: z.enum(['dono', 'equipe']).optional(),
    }),
    req.body,
  )
  const [rows] = await pool.query<RowDataPacket[]>(
    `select ${colunasUsuario}, ativo, ultimo_acesso, senha_hash from usuarios where email = ?`,
    [email.trim().toLowerCase()],
  )
  const u = rows[0]
  if (!u || !(await bcrypt.compare(senha, u.senha_hash))) {
    throw new HttpError(401, 'E-mail ou senha inválidos')
  }
  // Só depois da senha certa: não revela o perfil de contas alheias.
  if (perfil === 'dono' && u.papel !== 'dono') {
    throw new HttpError(403, 'Esta conta é da equipe da padaria. Escolha "Sou da equipe" para entrar.')
  }
  if (perfil === 'equipe' && u.papel === 'dono') {
    throw new HttpError(403, 'Esta conta é do dono da padaria. Escolha "Sou dono(a)" para entrar.')
  }
  garantirAtivo(u)
  await entrar(res, u)
})

// Conta criada pela própria pessoa (Criar conta) nasce desativada e sem nenhum acesso:
// fica "aguardando liberação" até o dono reativar em Equipe.
function garantirAtivo(u: RowDataPacket) {
  if (u.ativo) return
  throw new HttpError(
    403,
    u.ultimo_acesso
      ? 'Seu acesso foi desativado. Fale com o responsável pela padaria.'
      : 'Sua conta foi criada e está aguardando a liberação do responsável pela padaria.',
  )
}

async function entrar(res: Response, u: RowDataPacket) {
  await pool.query('update usuarios set ultimo_acesso = now() where id = ?', [u.id])
  iniciarSessao(res, {
    id: u.id,
    padaria_id: u.padaria_id,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    cargo: u.cargo,
    foto: u.foto,
  })
}

const emailUsado = new HttpError(
  409,
  'Já existe uma conta com este e-mail. Use "Entrar" ou "Esqueci minha senha".',
)

// Criar conta como funcionário (tela de login): a pessoa informa o código de convite que o dono
// vê em Equipe. Entra desativada; o dono vê "Aguardando liberação" e decide papel e cargo.
authRouter.post('/cadastro', async (req, res) => {
  const dados = validar(
    z.object({
      nome: z.string().trim().min(1, 'Informe seu nome').max(255),
      email: z.email('Informe um e-mail válido'),
      senha: senhaSchema,
      codigo: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9]{8}$/, 'O código da padaria tem 8 letras e números'),
    }),
    req.body,
  )
  const [padarias] = await pool.query<RowDataPacket[]>(
    'select id from padarias where codigo_convite = ?',
    [dados.codigo],
  )
  if (!padarias[0]) {
    throw new HttpError(404, 'Código da padaria não encontrado. Confira com o responsável.')
  }
  const email = dados.email.trim().toLowerCase()
  if (await emailEmUso(email)) throw emailUsado
  await pool.query(
    `insert into usuarios (id, padaria_id, nome, email, senha_hash, papel, cargo, ativo)
     values (?, ?, ?, ?, ?, 'funcionario', '', false)`,
    [randomUUID(), padarias[0].id, dados.nome, email, await hashSenha(dados.senha)],
  )
  res.status(201).json({ ok: true })
})

// Esqueci minha senha: código de 6 dígitos por e-mail → entra com o código e, se quiser,
// já define uma senha nova.
const MAX_TENTATIVAS = 5
const emailSchema = z.object({ email: z.email('Informe um e-mail válido') })
const codigoSchema = emailSchema.extend({
  codigo: z.string().trim().regex(/^\d{6}$/, 'O código tem 6 números'),
})

function hashCodigo(usuarioId: string, codigo: string) {
  return createHash('sha256').update(`${usuarioId}:${codigo}`).digest('hex')
}

async function buscarPorEmail(email: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `select ${colunasUsuario}, ativo, ultimo_acesso from usuarios where email = ?`,
    [email.trim().toLowerCase()],
  )
  return rows[0]
}

// Sempre responde igual, exista ou não a conta (não revela quais e-mails estão cadastrados).
authRouter.post('/esqueci-senha', async (req, res) => {
  const { email } = validar(emailSchema, req.body)
  const u = await buscarPorEmail(email)
  if (u?.ativo) {
    // Um pedido por minuto por conta: evita encher a caixa de entrada.
    const [recente] = await pool.query<RowDataPacket[]>(
      'select 1 from codigos_senha where usuario_id = ? and created_at > now() - interval 1 minute',
      [u.id],
    )
    if (!recente.length) {
      const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')
      await pool.query(
        `insert into codigos_senha (usuario_id, codigo_hash, expira_em, tentativas, created_at)
         values (?, ?, now() + interval 15 minute, 0, now())
         on duplicate key update codigo_hash = values(codigo_hash), expira_em = values(expira_em),
           tentativas = 0, created_at = now()`,
        [u.id, hashCodigo(u.id, codigo)],
      )
      const padaria = (await lerPadaria(u.padaria_id))?.nome_fantasia || 'Padaria Info'
      try {
        await enviarCodigoSenha(u.email, u.nome, codigo, padaria)
      } catch (err) {
        console.error('Falha ao enviar o e-mail de recuperação:', err)
        await pool.query('delete from codigos_senha where usuario_id = ?', [u.id])
        throw new HttpError(502, 'Não foi possível enviar o e-mail agora. Tente de novo em instantes.')
      }
    }
  }
  res.status(204).end()
})

// Confere o código; cada erro conta uma tentativa e, passado o limite, o código deixa de valer.
async function conferirCodigo(email: string, codigo: string) {
  const invalido = new HttpError(400, 'Código inválido ou expirado. Confira o e-mail ou peça um novo.')
  const u = await buscarPorEmail(email)
  if (!u) throw invalido
  const [rows] = await pool.query<RowDataPacket[]>(
    'select codigo_hash, tentativas from codigos_senha where usuario_id = ? and expira_em > now()',
    [u.id],
  )
  const registro = rows[0]
  if (!registro) throw invalido
  if (registro.codigo_hash !== hashCodigo(u.id, codigo)) {
    if (registro.tentativas + 1 >= MAX_TENTATIVAS) {
      await pool.query('delete from codigos_senha where usuario_id = ?', [u.id])
      throw new HttpError(429, 'Muitas tentativas erradas. Peça um novo código.')
    }
    await pool.query('update codigos_senha set tentativas = tentativas + 1 where usuario_id = ?', [u.id])
    throw new HttpError(400, `Código incorreto. Restam ${MAX_TENTATIVAS - registro.tentativas - 1} tentativa(s).`)
  }
  garantirAtivo(u)
  return u
}

authRouter.post('/codigo/verificar', async (req, res) => {
  const { email, codigo } = validar(codigoSchema, req.body)
  await conferirCodigo(email, codigo)
  res.status(204).end()
})

// Usa o código (vale uma vez só) e entra; com novaSenha, troca a senha antes.
authRouter.post('/codigo/entrar', async (req, res) => {
  const { email, codigo, novaSenha } = validar(
    codigoSchema.extend({ novaSenha: senhaSchema.optional() }),
    req.body,
  )
  const u = await conferirCodigo(email, codigo)
  await pool.query('delete from codigos_senha where usuario_id = ?', [u.id])
  if (novaSenha) {
    await pool.query('update usuarios set senha_hash = ? where id = ?', [await hashSenha(novaSenha), u.id])
  }
  await entrar(res, u)
})

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE)
  res.status(204).end()
})

authRouter.get('/me', exigirLogin, (_req, res) => {
  res.json(res.locals.usuario)
})

// Cadastrar minha padaria: cria a padaria e a conta do dono (qualquer pessoa, a qualquer hora).
authRouter.post('/setup', async (req, res) => {
  const dados = validar(
    z
      .object({
        nome: z.string().trim().min(1, 'Informe seu nome'),
        email: z.email('Informe um e-mail válido'),
        senha: senhaSchema,
        padaria: padariaSchema,
      })
      .extend(dadosPessoaisSchema.shape),
    req.body,
  )
  const email = dados.email.trim().toLowerCase()
  if (await emailEmUso(email)) throw emailUsado
  await garantirCpfUnico(dados.cpf)
  const padariaId = randomUUID()
  const usuario: Usuario = {
    id: randomUUID(),
    padaria_id: padariaId,
    nome: dados.nome,
    email,
    papel: 'dono',
    cargo: CARGO_DONO,
    foto: null,
  }
  await pool.query('insert into padarias (id, dados, codigo_convite) values (?, ?, ?)', [
    padariaId,
    JSON.stringify(dados.padaria),
    novoCodigoConvite(),
  ])
  await pool.query(
    `insert into usuarios (id, padaria_id, nome, email, senha_hash, papel, cargo, telefone, cpf,
       data_nascimento, endereco, ultimo_acesso)
     values (?, ?, ?, ?, ?, 'dono', ?, ?, ?, ?, ?, now())`,
    [
      usuario.id,
      padariaId,
      usuario.nome,
      usuario.email,
      await hashSenha(dados.senha),
      CARGO_DONO,
      dados.telefone ?? null,
      dados.cpf ?? null,
      dados.data_nascimento ?? null,
      dados.endereco ? JSON.stringify(dados.endereco) : null,
    ],
  )
  iniciarSessao(res, usuario)
})

export const cargoSchema = z.string().trim().max(60, 'Cargo muito longo')

// Editar perfil: cada pessoa muda a própria foto, nome e cargo quando quiser (fica no histórico,
// que dono e gerência veem). O papel — o que pode fazer no sistema — só o dono muda, em Equipe.
authRouter.patch('/perfil', exigirLogin, async (req, res) => {
  const dados = validar(
    z
      .object({
        nome: z.string().trim().min(1, 'Informe seu nome').max(255).optional(),
        cargo: cargoSchema.optional(),
        foto: fotoSchema.optional(),
      })
      .extend(dadosPessoaisSchema.shape),
    req.body,
  )
  const usuario = res.locals.usuario as Usuario
  await garantirCpfUnico(dados.cpf, usuario.id)
  await alterarPerfil(usuario.id, usuario.id, dados)
  res.json(await buscarUsuarioAtivo(usuario.id))
})

// Perfil completo de quem está logado (Editar perfil): dados pessoais, endereço, trabalho.
authRouter.get('/perfil', exigirLogin, async (_req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `select ${colunasUsuario}, telefone, cpf, data_nascimento, data_admissao, turno, endereco,
            contato_emergencia, created_at
     from usuarios where id = ?`,
    [res.locals.usuario.id],
  )
  res.json(rows[0])
})

// Valida o cookie e recarrega o usuário do banco (papel atualizado; desativado perde o acesso na hora).
export async function exigirLogin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE]
  let id: string | null = null
  try {
    if (token) id = (jwt.verify(token, jwtSecret) as { sub: string }).sub
  } catch {
    id = null
  }
  const usuario = id ? await buscarUsuarioAtivo(id) : null
  if (!usuario) {
    res.status(401).json({ message: 'Sua sessão expirou. Entre novamente.' })
    return
  }
  res.locals.usuario = usuario
  res.locals.padariaId = usuario.padaria_id
  next()
}

export function exigirPapel(...papeis: Papel[]): RequestHandler<Record<string, string>> {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!papeis.includes((res.locals.usuario as Usuario).papel)) {
      res.status(403).json({ message: 'Você não tem permissão para esta operação.' })
      return
    }
    next()
  }
}
