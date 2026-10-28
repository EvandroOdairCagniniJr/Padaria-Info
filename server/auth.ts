import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express'
import jwt from 'jsonwebtoken'
import type { RowDataPacket } from './db.ts'
import { z } from 'zod'
import { novoCodigoConvite, pool } from './db.ts'
import { HttpError, limitarTentativas, validar } from './http.ts'
import { registrarAcesso } from './seguranca.ts'
import { esquecerUsuario, guardarNoCache, lerDoCache } from './cacheUsuarios.ts'
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

// Senha nova: 8+ caracteres, com letras e números (as já existentes continuam valendo).
export const senhaSchema = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres, com letras e números')
  .max(128, 'Senha muito longa')
  .refine((s) => /[a-zA-Z]/.test(s) && /\d/.test(s), 'A senha precisa ter letras e números')

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

// Bloqueio depois de muitas senhas erradas seguidas na mesma conta.
const MAX_FALHAS = 5
const BLOQUEIO_MIN = 15
// Hash qualquer: conta inexistente leva o mesmo tempo que senha errada (não revela e-mails).
const HASH_FALSO = bcrypt.hashSync('senha-que-nao-existe', 10)

// httpOnly: o JavaScript da página não lê o token (um script injetado não consegue roubá-lo).
const opcoesCookie = { httpOnly: true, sameSite: 'lax', secure: producao, path: '/' } as const

function sairDoAparelho(res: Response) {
  res.clearCookie(COOKIE, opcoesCookie)
}

async function iniciarSessao(res: Response, usuario: Usuario) {
  // A versão da sessão vai no token: trocar a senha ou desativar invalida os tokens antigos.
  const [rows] = await pool.query<RowDataPacket[]>('select sessao_versao from usuarios where id = ?', [
    usuario.id,
  ])
  const token = jwt.sign({ sub: usuario.id, v: Number(rows[0]?.sessao_versao ?? 0) }, jwtSecret, {
    expiresIn: '7d',
  })
  // Em produção (HTTPS) o cookie só trafega criptografado.
  res.cookie(COOKIE, token, { ...opcoesCookie, maxAge: SETE_DIAS_MS })
  res.json(usuario)
}

async function buscarUsuarioAtivo(
  id: string,
  versao?: number,
  { usarCache = false } = {},
): Promise<Usuario | null> {
  let u = usarCache ? lerDoCache(id) : null
  if (!u) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `select ${colunasUsuario}, sessao_versao from usuarios where id = ? and ativo = true`,
      [id],
    )
    u = rows[0] ?? null
    if (u) guardarNoCache(id, u)
    else esquecerUsuario(id)
  }
  if (!u) return null
  if (versao !== undefined && Number(u.sessao_versao) !== versao) return null
  const { sessao_versao: _v, ...usuario } = u
  return usuario as Usuario
}

// Derruba todos os logins da pessoa (troca de senha, "sair de todos os aparelhos").
export async function encerrarSessoes(usuarioId: string) {
  await pool.query('update usuarios set sessao_versao = sessao_versao + 1 where id = ?', [usuarioId])
  esquecerUsuario(usuarioId)
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
  const emailLimpo = email.trim().toLowerCase()
  const [rows] = await pool.query<RowDataPacket[]>(
    `select ${colunasUsuario}, ativo, ultimo_acesso, senha_hash, falhas_login,
            greatest(extract(epoch from (bloqueado_ate - now())), 0) as bloqueio_restante
     from usuarios where email = ?`,
    [emailLimpo],
  )
  const u = rows[0]
  if (u && Number(u.bloqueio_restante) > 0) {
    await registrarAcesso(req, 'conta_bloqueada', { padariaId: u.padaria_id, usuarioId: u.id, email: emailLimpo })
    throw new HttpError(
      423,
      `Conta bloqueada por segurança após várias senhas erradas. Tente de novo em ${Math.ceil(Number(u.bloqueio_restante) / 60)} min ou use "Esqueci minha senha".`,
    )
  }
  const senhaCerta = await bcrypt.compare(senha.slice(0, 128), u?.senha_hash ?? HASH_FALSO)
  if (!u || !senhaCerta) {
    if (u) {
      const falhas = Number(u.falhas_login) + 1
      await pool.query(
        falhas >= MAX_FALHAS
          ? `update usuarios set falhas_login = 0, bloqueado_ate = now() + interval '${BLOQUEIO_MIN} minutes' where id = ?`
          : 'update usuarios set falhas_login = falhas_login + 1 where id = ?',
        [u.id],
      )
    }
    await registrarAcesso(req, 'login_falhou', { padariaId: u?.padaria_id, usuarioId: u?.id, email: emailLimpo })
    throw new HttpError(401, 'E-mail ou senha inválidos')
  }
  await pool.query('update usuarios set falhas_login = 0, bloqueado_ate = null where id = ?', [u.id])
  // Só depois da senha certa: não revela o perfil de contas alheias.
  if (perfil === 'dono' && u.papel !== 'dono') {
    throw new HttpError(403, 'Esta conta é da equipe da padaria. Escolha "Sou da equipe" para entrar.')
  }
  if (perfil === 'equipe' && u.papel === 'dono') {
    throw new HttpError(403, 'Esta conta é do dono da padaria. Escolha "Sou dono(a)" para entrar.')
  }
  garantirAtivo(u)
  await registrarAcesso(req, 'login', { padariaId: u.padaria_id, usuarioId: u.id, email: emailLimpo })
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
  await iniciarSessao(res, {
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
      `select 1 from codigos_senha where usuario_id = ? and created_at > now() - interval '1 minute'`,
      [u.id],
    )
    if (!recente.length) {
      const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')
      await pool.query(
        `insert into codigos_senha (usuario_id, codigo_hash, expira_em, tentativas, created_at)
         values (?, ?, now() + interval '15 minutes', 0, now())
         on conflict (usuario_id) do update set codigo_hash = excluded.codigo_hash,
           expira_em = excluded.expira_em, tentativas = 0, created_at = now()`,
        [u.id, hashCodigo(u.id, codigo)],
      )
      const padaria = (await lerPadaria(u.padaria_id))?.nome_fantasia || 'Padaria Info'
      try {
        await enviarCodigoSenha(u.email, u.nome, codigo, padaria)
        await registrarAcesso(req, 'codigo_enviado', { padariaId: u.padaria_id, usuarioId: u.id, email: u.email })
      } catch (err) {
        console.error('Falha ao enviar o e-mail de recuperação:', (err as Error).message)
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
  // Comparação em tempo constante: o tempo da resposta não dá pistas sobre o código.
  const certo = Buffer.from(String(registro.codigo_hash))
  const informado = Buffer.from(hashCodigo(u.id, codigo))
  if (certo.length !== informado.length || !timingSafeEqual(certo, informado)) {
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
  // Quem provou ser dono do e-mail destrava a conta.
  await pool.query('update usuarios set falhas_login = 0, bloqueado_ate = null where id = ?', [u.id])
  if (novaSenha) {
    await pool.query('update usuarios set senha_hash = ? where id = ?', [await hashSenha(novaSenha), u.id])
    // Senha nova: derruba logins antigos em outros aparelhos (este recebe um novo em seguida).
    await encerrarSessoes(u.id)
    await registrarAcesso(req, 'senha_alterada', { padariaId: u.padaria_id, usuarioId: u.id, email: u.email })
  }
  await registrarAcesso(req, 'entrou_com_codigo', { padariaId: u.padaria_id, usuarioId: u.id, email: u.email })
  await entrar(res, u)
})

authRouter.post('/logout', (_req, res) => {
  sairDoAparelho(res)
  res.status(204).end()
})

// Sair de todos os aparelhos (ex.: esqueceu o sistema aberto num computador da padaria).
authRouter.post('/sair-de-todos', exigirLogin, async (req, res) => {
  const u = res.locals.usuario as Usuario
  await encerrarSessoes(u.id)
  await registrarAcesso(req, 'saiu_de_todos', { padariaId: u.padaria_id, usuarioId: u.id, email: u.email })
  sairDoAparelho(res)
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
  await iniciarSessao(res, usuario)
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
  let versao = 0
  try {
    if (token) {
      const dados = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as { sub: string; v?: number }
      id = dados.sub
      versao = dados.v ?? 0
    }
  } catch {
    id = null
  }
  const usuario = id ? await buscarUsuarioAtivo(id, versao, { usarCache: true }) : null
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
