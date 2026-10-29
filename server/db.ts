// Banco PostgreSQL (Supabase). As consultas do sistema são escritas com "?" e passam por um
// adaptador (converter) que troca por $1, $2... e expande listas em "in (?)".
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import pg from 'pg'

// numeric/bigint chegam como texto no pg: viram number (valores de padaria cabem com folga).
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v))
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v))
// date fica como 'YYYY-MM-DD' (o formato que o front espera), sem virar Date com fuso.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v)

// Linha de resultado (nome mantido dos tempos de MySQL).
export type RowDataPacket = Record<string, any>

const conexao = process.env.DATABASE_URL
if (!conexao) {
  console.warn('DATABASE_URL não definido no .env — usando postgres://postgres@127.0.0.1:5432/postgres')
}

const pgPool = new pg.Pool({
  connectionString: conexao ?? 'postgres://postgres@127.0.0.1:5432/postgres',
  // O Supabase grátis aceita só 15 conexões no total ("pool_size: 15"). Num deploy, a versão velha
  // e a nova ficam ligadas juntas por alguns segundos: 5 por servidor deixa folga para as duas.
  max: Number(process.env.DATABASE_POOL ?? 5),
  // Conexão criptografada E verificada: só aceita o servidor com certificado assinado pela CA do
  // Supabase (server/supabase-ca.crt, "Supabase Root 2021 CA"). Sem a verificação, alguém no meio
  // do caminho poderia se passar pelo banco e ler senhas e dados. DATABASE_SSL=false só para o
  // banco local de testes.
  ssl:
    process.env.DATABASE_SSL === 'false'
      ? false
      : {
          ca: readFileSync(new URL('./supabase-ca.crt', import.meta.url), 'utf8'),
          rejectUnauthorized: true,
        },
  // Conexão parada é devolvida ao Supabase depois de 1 min (o padrão do pg era 10 s; 10 min
  // segurava vagas demais e travou um deploy). Keep-alive para a rede não derrubá-las antes.
  idleTimeoutMillis: 60_000,
  keepAlive: true,
})
// Conexão que caiu enquanto parada: só sai do pool (o pg abre outra na próxima consulta).
pgPool.on('error', (err) => console.warn('Conexão com o banco caiu:', err.message))
// Cada conexão trabalha no schema da aplicação (fora da API pública do Supabase). Configurado uma
// vez por conexão, antes da primeira consulta. Use a conexão direta ou o "Session pooler".
const configuradas = new WeakSet<pg.PoolClient>()
async function conectar() {
  const client = await pgPool.connect()
  if (!configuradas.has(client)) {
    await client.query('set search_path to padaria')
    configuradas.add(client)
  }
  return client
}

// "?" → $n (fora de textos entre aspas); array vira uma lista ($1, $2, $3) para "in (?)".
function converter(sql: string, params: unknown[] = []) {
  const valores: unknown[] = []
  let i = 0
  let emTexto = false
  let saida = ''
  for (const c of sql) {
    if (c === "'") emTexto = !emTexto
    if (c !== '?' || emTexto) {
      saida += c
      continue
    }
    const valor = params[i++]
    if (Array.isArray(valor)) {
      if (valor.length === 0) {
        saida += 'null'
        continue
      }
      saida += valor.map((v) => (valores.push(v), `$${valores.length}`)).join(', ')
    } else {
      valores.push(valor === undefined ? null : valor)
      saida += `$${valores.length}`
    }
  }
  return { texto: saida, valores }
}

type Executor = { query: (texto: string, valores: unknown[]) => Promise<pg.QueryResult> }

async function executar<T>(alvo: Executor, sql: string, params?: unknown[]) {
  const { texto, valores } = converter(sql, params)
  const r = await alvo.query(texto, valores)
  // Mesmo formato de antes: [linhas], com affectedRows nas alterações.
  const linhas = Object.assign(r.rows, { affectedRows: r.rowCount ?? 0 })
  return [linhas as unknown as T] as const
}

export type PoolConnection = {
  query: <T = RowDataPacket[]>(sql: string, params?: unknown[]) => Promise<readonly [T]>
}

export const pool: PoolConnection = {
  query: async <T = RowDataPacket[]>(sql: string, params?: unknown[]) => {
    const client = await conectar()
    try {
      return await executar<T>(client, sql, params)
    } finally {
      client.release()
    }
  },
}

// Cria o schema e as tabelas (server/schema.sql é idempotente) e já deixa conexões abertas,
// para a primeira tela não esperar a abertura delas. Se o banco estiver lotado ou fora do ar
// (ex.: num deploy, enquanto a versão velha ainda segura conexões), tenta de novo por ~2 min
// antes de desistir.
export async function initDatabase() {
  const tentativas = 12
  for (let i = 1; ; i++) {
    try {
      await pgPool.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
      break
    } catch (err) {
      const e = err as { code?: string; message?: string }
      const passageiro =
        ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '53300', '57P03'].includes(e.code ?? '') ||
        /EMAXCONN|max clients reached|too many clients/i.test(e.message ?? '')
      if (!passageiro || i >= tentativas) throw err
      console.warn(`Banco indisponível (${e.code}), nova tentativa em 10 s (${i}/${tentativas - 1})...`)
      await new Promise((r) => setTimeout(r, 10_000))
    }
  }
  const prontas = await Promise.all(Array.from({ length: Math.min(2, pgPool.options.max ?? 2) }, conectar))
  for (const c of prontas) c.release()
}

export function novoCodigoConvite() {
  // Sem 0/O e 1/I para não confundir quem digita.
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(randomBytes(8), (b) => letras[b % letras.length]).join('')
}

export async function transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const client = await conectar()
  const conn: PoolConnection = {
    query: <R = RowDataPacket[]>(sql: string, params?: unknown[]) => executar<R>(client, sql, params),
  }
  try {
    await client.query('begin')
    const result = await fn(conn)
    await client.query('commit')
    return result
  } catch (err) {
    await client.query('rollback').catch(() => undefined)
    throw err
  } finally {
    client.release()
  }
}

export async function lerConfig(padariaId: string, chave: string, padrao: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    'select valor from padaria_config where padaria_id = ? and chave = ?',
    [padariaId, chave],
  )
  return (rows[0]?.valor as string | undefined) ?? padrao
}

export async function salvarConfig(padariaId: string, chave: string, valor: string) {
  await pool.query(
    `insert into padaria_config (padaria_id, chave, valor) values (?, ?, ?)
     on conflict (padaria_id, chave) do update set valor = excluded.valor`,
    [padariaId, chave, valor],
  )
}
