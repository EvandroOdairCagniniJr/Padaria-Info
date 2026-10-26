import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import mysql, { type PoolConnection, type RowDataPacket } from 'mysql2/promise'

const database = process.env.MYSQL_DATABASE ?? 'padaria_info'

const connectionOptions = {
  // 127.0.0.1 e não localhost: no Windows, localhost tenta IPv6 antes e atrasa cada conexão.
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? '',
  // MySQL na nuvem (Aiven, TiDB...) exige conexão criptografada. MYSQL_SSL_CA = certificado PEM.
  ssl:
    process.env.MYSQL_SSL === 'true'
      ? {
          // No painel do Render o PEM costuma ir numa linha só, com \n literais.
          ca: process.env.MYSQL_SSL_CA?.replace(/\\n/g, '\n') || undefined,
          rejectUnauthorized: Boolean(process.env.MYSQL_SSL_CA),
        }
      : undefined,
}

export const pool = mysql.createPool({
  ...connectionOptions,
  database,
  connectionLimit: 10,
  // DECIMAL como number e DATE como 'YYYY-MM-DD' — o formato que o front espera.
  decimalNumbers: true,
  dateStrings: ['DATE'],
  typeCast(field, next) {
    if (field.type === 'TINY' && field.length === 1) return field.string() === '1'
    return next()
  },
})

// Colunas criadas depois da primeira versão do schema: [tabela, coluna, definição].
const colunasNovas: [string, string, string][] = [
  ['usuarios', 'nome', "nome varchar(255) not null default '' after id"],
  ['usuarios', 'papel', "papel enum('dono', 'admin', 'funcionario') not null default 'funcionario'"],
  ['usuarios', 'ativo', 'ativo boolean not null default true'],
  ['usuarios', 'ultimo_acesso', 'ultimo_acesso timestamp null'],
  ['usuarios', 'cargo', "cargo varchar(60) not null default ''"],
  ['usuarios', 'foto', 'foto mediumtext null'],
  // Cadastro completo da pessoa (dados pessoais, trabalho, endereço, contato de emergência).
  ['usuarios', 'telefone', 'telefone varchar(11) null'],
  ['usuarios', 'cpf', 'cpf char(11) null'],
  ['usuarios', 'data_nascimento', 'data_nascimento date null'],
  ['usuarios', 'data_admissao', 'data_admissao date null'],
  ['usuarios', 'turno', "turno enum('manha', 'tarde', 'noite', 'madrugada', 'integral') null"],
  ['usuarios', 'endereco', 'endereco json null'],
  ['usuarios', 'contato_emergencia', 'contato_emergencia json null'],
  ['usuarios', 'observacoes', 'observacoes text null'],
  ['produtos', 'emoji', 'emoji varchar(16)'],
  ['produtos', 'foto', 'foto mediumtext'],
  // Quanto o cliente entregou em dinheiro (para o troco na 2ª via do comprovante).
  ['vendas', 'valor_recebido', 'valor_recebido decimal(10, 2) null after forma_pagamento'],
  // Devolução: a venda continua no histórico, mas sai dos totais e o estoque volta.
  ['vendas', 'devolvida_em', 'devolvida_em timestamp null'],
  ['vendas', 'devolvida_por', 'devolvida_por char(36) null'],
  ['vendas', 'motivo_devolucao', 'motivo_devolucao varchar(255) null'],
  // Promoções: desconto por item (e qual promoção) e descontos da venda.
  ['vendas_itens', 'desconto', 'desconto decimal(10, 2) not null default 0'],
  ['vendas_itens', 'promocao_id', 'promocao_id char(36) null'],
  ['vendas', 'desconto_promocoes', 'desconto_promocoes decimal(10, 2) not null default 0'],
  ['vendas', 'desconto_manual', 'desconto_manual decimal(10, 2) not null default 0'],
  // Caixa em que a venda entrou (abertura/fechamento de caixa por operador).
  ['vendas', 'caixa_id', 'caixa_id char(36) null'],
  // Caixa em que o sinal da encomenda foi recebido.
  ['encomendas', 'caixa_sinal_id', 'caixa_sinal_id char(36) null'],
  ['producoes', 'concluida_por', 'concluida_por char(36), add foreign key (concluida_por) references usuarios (id)'],
]

// Multi-padaria: toda tabela de negócio pertence a uma padaria. Linhas antigas (de antes do
// multi-padaria) são ligadas à primeira padaria em migrarParaMultiPadaria.
export const tabelasDaPadaria = [
  'usuarios',
  'produtos',
  'movimentacoes_estoque',
  'vendas',
  'contas_financeiras',
  'receitas',
  'producoes',
  'historico_perfil',
] as const
for (const tabela of tabelasDaPadaria) {
  colunasNovas.push([tabela, 'padaria_id', 'padaria_id char(36) null'])
}

// Índices para as consultas "por pessoa" (Equipe, Minhas vendas, conquistas): [tabela, nome, colunas].
const indicesNovos: [string, string, string][] = [
  ['vendas', 'vendas_created_by_idx', 'created_by, created_at'],
  ['movimentacoes_estoque', 'movimentacoes_created_by_idx', 'created_by, created_at'],
  ...tabelasDaPadaria.map((t): [string, string, string] => [t, `${t}_padaria_idx`, 'padaria_id']),
]

// Cria o banco (se preciso) e aplica server/schema.sql.
export async function initDatabase() {
  const admin = await mysql.createConnection({ ...connectionOptions, multipleStatements: true })
  try {
    // Em MySQL gerenciado o banco já existe (e às vezes não há permissão para criar).
    await admin
      .query(
        `create database if not exists \`${database}\` character set utf8mb4 collate utf8mb4_0900_ai_ci`,
      )
      .catch(() => undefined)
    await admin.query(`use \`${database}\``)
    await admin.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))

    // MySQL 8.0 não tem "add column/index if not exists": consulta o information_schema.
    for (const [tabela, coluna, ddl] of colunasNovas) {
      const [rows] = await admin.query<RowDataPacket[]>(
        'select 1 from information_schema.columns where table_schema = ? and table_name = ? and column_name = ?',
        [database, tabela, coluna],
      )
      if (rows.length === 0) await admin.query(`alter table ${tabela} add column ${ddl}`)
    }
    for (const [tabela, indice, colunas] of indicesNovos) {
      const [rows] = await admin.query<RowDataPacket[]>(
        'select 1 from information_schema.statistics where table_schema = ? and table_name = ? and index_name = ?',
        [database, tabela, indice],
      )
      if (rows.length === 0) await admin.query(`create index ${indice} on ${tabela} (${colunas})`)
    }
    await migrarParaMultiPadaria(admin)
  } finally {
    await admin.end()
  }
}

export function novoCodigoConvite() {
  // Sem 0/O e 1/I para não confundir quem digita.
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(randomBytes(8), (b) => letras[b % letras.length]).join('')
}

// Instalação de antes do multi-padaria: cria a padaria com o cadastro antigo e liga todas as
// linhas sem padaria_id a ela; configurações e fotos de categoria vão para as tabelas novas.
async function migrarParaMultiPadaria(conn: mysql.Connection) {
  const [orfaos] = await conn.query<RowDataPacket[]>(
    'select 1 from usuarios where padaria_id is null limit 1',
  )
  if (!orfaos.length) return
  const [antigas] = await conn.query<RowDataPacket[]>(
    "select table_name as t from information_schema.tables where table_schema = database() and table_name in ('configuracoes', 'categorias')",
  )
  const existe = (t: string) => antigas.some((r) => r.t === t)
  let dados = JSON.stringify({ nome_fantasia: 'Minha padaria' })
  if (existe('configuracoes')) {
    const [cfg] = await conn.query<RowDataPacket[]>(
      "select valor from configuracoes where chave = 'padaria'",
    )
    if (cfg[0]?.valor) dados = cfg[0].valor
  }
  const id = randomUUID()
  await conn.query('insert into padarias (id, dados, codigo_convite) values (?, ?, ?)', [
    id,
    dados,
    novoCodigoConvite(),
  ])
  for (const tabela of tabelasDaPadaria) {
    await conn.query(`update ${tabela} set padaria_id = ? where padaria_id is null`, [id])
  }
  if (existe('configuracoes')) {
    await conn.query(
      `insert ignore into padaria_config (padaria_id, chave, valor)
       select ?, chave, valor from configuracoes where chave <> 'padaria'`,
      [id],
    )
  }
  if (existe('categorias')) {
    await conn.query(
      'insert ignore into categorias_fotos (padaria_id, nome, foto) select ?, nome, foto from categorias',
      [id],
    )
  }
  console.log('Banco migrado para o modo multi-padaria.')
}

export async function transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
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
     on duplicate key update valor = values(valor)`,
    [padariaId, chave, valor],
  )
}
