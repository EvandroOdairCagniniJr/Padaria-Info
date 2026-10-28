// Copia os dados do MySQL antigo (MYSQL_* no .env) para o PostgreSQL/Supabase (DATABASE_URL).
// Uso: node scripts/migrar-mysql.mjs
// Pode rodar mais de uma vez: linhas que já existem no destino são mantidas (on conflict do nothing).
// Rode o servidor uma vez antes (ele cria as tabelas), ou deixe este script criar.
import { readFileSync, existsSync } from 'node:fs'
import mysql from 'mysql2/promise'
import pg from 'pg'

if (existsSync('.env')) process.loadEnvFile('.env')

// Ordem que respeita as chaves estrangeiras.
const tabelas = [
  'padarias',
  'usuarios',
  'produtos',
  'caixas',
  'vendas',
  'vendas_itens',
  'movimentacoes_estoque',
  'contas_financeiras',
  'receitas',
  'receita_itens',
  'producoes',
  'padaria_config',
  'categorias_fotos',
  'historico_perfil',
  'metas',
  'perdas',
  'encomendas',
  'encomendas_itens',
  'caixa_movimentos',
  'promocoes',
  'log_acessos',
]

const origem = await mysql.createConnection({
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? '',
  database: process.env.MYSQL_DATABASE ?? 'padaria_info',
  // Datas como texto (sem conversão de fuso) e JSON como texto.
  dateStrings: true,
  typeCast(field, next) {
    if (field.type === 'TINY' && field.length === 1) return field.string() === '1'
    if (field.type === 'JSON') return field.string('utf8')
    return next()
  },
})
const destino = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
})
await destino.connect()
await destino.query(readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8'))
await destino.query('set search_path to padaria')

// MySQL guardava datas/horas no fuso do servidor local: informa o fuso ao Postgres.
const fuso = process.env.FUSO_MYSQL ?? 'America/Sao_Paulo'
await destino.query(`set timezone to '${fuso.replace(/'/g, '')}'`)

let total = 0
for (const tabela of tabelas) {
  const [existe] = await origem.query(
    'select 1 from information_schema.tables where table_schema = database() and table_name = ?',
    [tabela],
  )
  if (!existe.length) continue
  const { rows: colunasDestino } = await destino.query(
    `select column_name from information_schema.columns where table_schema = 'padaria' and table_name = $1`,
    [tabela],
  )
  const permitidas = new Set(colunasDestino.map((c) => c.column_name))
  const [linhas] = await origem.query(`select * from \`${tabela}\``)
  // Em lotes de 200 linhas por comando (com o banco longe, uma linha por vez era lento).
  const colunas = linhas.length ? Object.keys(linhas[0]).filter((c) => permitidas.has(c)) : []
  let copiadas = 0
  for (let i = 0; i < linhas.length; i += 200) {
    const lote = linhas.slice(i, i + 200)
    const valores = lote.flatMap((linha) => colunas.map((c) => linha[c]))
    const tuplas = lote
      .map((_, l) => `(${colunas.map((_, k) => `$${l * colunas.length + k + 1}`).join(', ')})`)
      .join(', ')
    const r = await destino.query(
      `insert into ${tabela} (${colunas.map((c) => `"${c}"`).join(', ')}) values ${tuplas}
       on conflict do nothing`,
      valores,
    )
    copiadas += r.rowCount ?? 0
  }
  total += copiadas
  console.log(`${tabela.padEnd(24)} ${String(copiadas).padStart(6)} de ${linhas.length}`)
}

await origem.end()
await destino.end()
console.log(`\nPronto: ${total} linha(s) copiadas para o PostgreSQL.`)
