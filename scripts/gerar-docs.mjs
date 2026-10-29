// Gera a documentação técnica a partir do próprio código (engenharia reversa automática):
//   docs/BANCO.md → diagrama ER, tabelas, colunas, chaves e índices (lidos do server/schema.sql)
//   docs/API.md   → todas as rotas da API, quem pode acessar e para que servem (lidas de server/*.ts)
// Uso: npm run docs   (não acessa o Supabase: monta o banco num PGlite temporário em memória)
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const raiz = new URL('../', import.meta.url)
const ler = (p) => readFileSync(new URL(p, raiz), 'utf8')
mkdirSync(new URL('docs/', raiz), { recursive: true })
const aviso = '<!-- Arquivo gerado por `npm run docs` (scripts/gerar-docs.mjs). Não edite à mão. -->\n\n'

// ------------------------------------------------------------------ banco
const db = await PGlite.create()
await db.exec(ler('server/schema.sql'))
const q = async (sql) => (await db.query(sql)).rows

const colunas = await q(`
  select c.table_name t, c.column_name c, c.data_type tipo, c.is_nullable = 'YES' nulo, c.column_default padrao,
         c.character_maximum_length tam, c.numeric_precision prec, c.numeric_scale esc
  from information_schema.columns c where c.table_schema = 'padaria' order by c.table_name, c.ordinal_position`)
const restricoes = await q(`
  select conrelid::regclass::text t, conname nome, contype tipo, pg_get_constraintdef(oid) def
  from pg_constraint where connamespace = 'padaria'::regnamespace and contype in ('p','f','u','c')
  order by 1, 2`)
const indices = await q(`select tablename t, indexname nome, indexdef def from pg_indexes where schemaname = 'padaria' order by 1, 2`)
await db.close()

const limpar = (s) => s.replace(/padaria\./g, '')
const tabelas = [...new Set(colunas.map((c) => c.t))]
const fks = restricoes
  .filter((r) => r.tipo === 'f')
  .map((r) => {
    const m = r.def.match(/FOREIGN KEY \((\w+)\) REFERENCES (?:padaria\.)?(\w+)\((\w+)\)(.*)/)
    return { t: limpar(r.t), col: m[1], ref: m[2], extra: m[4].trim() }
  })
const pks = new Map()
for (const r of restricoes.filter((r) => r.tipo === 'p')) {
  pks.set(limpar(r.t), r.def.match(/\(([^)]+)\)/)[1].split(', '))
}
const tipoCurto = (c) => {
  const base = { 'character varying': 'varchar', 'timestamp with time zone': 'timestamptz', character: 'char' }[c.tipo] ?? c.tipo
  if (c.tam) return `${base}(${c.tam})`
  if (base === 'numeric' && c.prec) return `numeric(${c.prec},${c.esc})`
  return base
}

// Comentários do schema.sql logo acima de cada "create table" viram a descrição da tabela.
const descricoes = new Map()
const linhasSchema = ler('server/schema.sql').split(/\r?\n/)
linhasSchema.forEach((linha, i) => {
  const m = linha.match(/^create table if not exists (\w+)/)
  if (!m) return
  const coment = []
  for (let j = i - 1; j >= 0 && linhasSchema[j].startsWith('--'); j--) coment.unshift(linhasSchema[j].replace(/^--\s?/, ''))
  if (coment.length) descricoes.set(m[1], coment.join(' '))
})

let banco = aviso + '# Banco de dados\n\n'
banco += `PostgreSQL (Supabase), schema \`padaria\`. **${tabelas.length} tabelas**, **${fks.length} chaves estrangeiras**, **${indices.length} índices**. `
banco += 'Fonte da verdade: [server/schema.sql](../server/schema.sql), aplicado sozinho quando o servidor inicia.\n\n'
banco += '> Multi-padaria: toda tabela de negócio tem `padaria_id`, e toda consulta do servidor filtra por ele. '
banco += 'Todas as tabelas têm RLS ligado e sem políticas: só o servidor lê. A API pública do Supabase não enxerga nada.\n\n'
banco += '## Diagrama ER\n\n```mermaid\nerDiagram\n'
const nomeRel = (f) => f.col.replace(/_id$/, '').replace(/_por$/, '').replace(/_by$/, '')
for (const f of fks) banco += `  ${f.ref} ||--o{ ${f.t} : "${nomeRel(f)}"\n`
for (const t of tabelas) {
  banco += `  ${t} {\n`
  const fkCols = new Set(fks.filter((f) => f.t === t).map((f) => f.col))
  for (const c of colunas.filter((c) => c.t === t)) {
    const chave = (pks.get(t) ?? []).includes(c.c) ? ' PK' : fkCols.has(c.c) ? ' FK' : ''
    banco += `    ${tipoCurto(c).replace(/[(),]/g, '_').replace(/_+$/, '')} ${c.c}${chave}\n`
  }
  banco += '  }\n'
}
banco += '```\n\n## Tabelas\n'
for (const t of tabelas) {
  banco += `\n### ${t}\n\n`
  if (descricoes.has(t)) banco += `${descricoes.get(t)}\n\n`
  banco += '| Coluna | Tipo | Obrigatória | Padrão | Chave |\n|---|---|---|---|---|\n'
  for (const c of colunas.filter((c) => c.t === t)) {
    const fk = fks.find((f) => f.t === t && f.col === c.c)
    const chave = (pks.get(t) ?? []).includes(c.c) ? 'PK' : fk ? `→ ${fk.ref}${fk.extra ? ` (${fk.extra.toLowerCase()})` : ''}` : ''
    banco += `| \`${c.c}\` | ${tipoCurto(c)} | ${c.nulo ? '' : 'sim'} | ${c.padrao ? `\`${c.padrao}\`` : ''} | ${chave} |\n`
  }
  const regras = restricoes.filter((r) => limpar(r.t) === t && (r.tipo === 'c' || r.tipo === 'u'))
  if (regras.length) banco += `\nRegras: ${regras.map((r) => `\`${limpar(r.def)}\``).join(' · ')}\n`
  const idx = indices.filter((i) => i.t === t && !i.nome.endsWith('_pkey'))
  if (idx.length) banco += `\nÍndices: ${idx.map((i) => `\`${limpar(i.def).replace(/^CREATE (UNIQUE )?INDEX \w+ ON \w+ USING btree /, '$1')}\``).join(' · ')}\n`
}
writeFileSync(new URL('docs/BANCO.md', raiz), banco)

// ------------------------------------------------------------------ API
const index = ler('server/index.ts')
const montagens = new Map() // nome do router → { prefixo, login }
for (const m of index.matchAll(/app\.use\('([^']+)',\s*(exigirLogin,\s*)?(\w+Router)\)/g)) {
  montagens.set(m[3], { prefixo: m[1], login: Boolean(m[2]) })
}
const papeis = (txt) => {
  if (/\bgestao\b/.test(txt)) return 'dono, gerente'
  const m = txt.match(/exigirPapel\(([^)]*)\)/)
  return m ? m[1].replace(/'/g, '').replace('admin', 'gerente') : null
}
const rotas = []
for (const arq of readdirSync(new URL('server/', raiz)).filter((f) => f.endsWith('.ts'))) {
  const fonte = ler(`server/${arq}`)
  const linhas = fonte.split(/\r?\n/)
  const gestaoArquivo = /const gestao = exigirPapel\('dono', 'admin'\)/.test(fonte)
  const restricaoRouter = new Map()
  for (const m of fonte.matchAll(/(\w+Router)\.use\((exigirPapel\([^)]*\))\)/g)) restricaoRouter.set(m[1], papeis(m[2]))
  linhas.forEach((linha, i) => {
    const m = linha.match(/^(\w+Router)\.(get|post|put|patch|delete)\(\s*'([^']+)'(.*)$/)
    if (!m) return
    const [, router, metodo, caminho, resto] = m
    const montagem = montagens.get(router)
    if (!montagem) return
    const coment = []
    for (let j = i - 1; j >= 0 && /^\s*\/\//.test(linhas[j]); j--) coment.unshift(linhas[j].replace(/^\s*\/\/\s?/, ''))
    const exigeLogin = montagem.login || /exigirLogin/.test(resto)
    const quem =
      papeis(resto.replace(/gestao/, gestaoArquivo ? 'gestao' : '')) ??
      restricaoRouter.get(router) ??
      (exigeLogin ? 'todos logados' : 'público')
    rotas.push({
      metodo: metodo.toUpperCase(),
      caminho: (montagem.prefixo + (caminho === '/' ? '' : caminho)).replace(/\/+/g, '/'),
      quem,
      arquivo: `${arq}:${i + 1}`,
      descricao: coment.join(' '),
    })
  })
}
// Rotas declaradas direto no app (server/index.ts), como as de saúde.
index.split(/\r?\n/).forEach((linha, i, linhas) => {
  const m = linha.match(/^app\.(get|post)\('(\/api[^']*)'/)
  if (!m) return
  const coment = []
  for (let j = i - 1; j >= 0 && /^\s*\/\//.test(linhas[j]); j--) coment.unshift(linhas[j].replace(/^\s*\/\/\s?/, ''))
  rotas.push({ metodo: m[1].toUpperCase(), caminho: m[2], quem: 'público', arquivo: `index.ts:${i + 1}`, descricao: coment.join(' ') })
})
rotas.sort((a, b) => a.caminho.localeCompare(b.caminho) || a.metodo.localeCompare(b.metodo))
const contagem = (f) => rotas.filter(f).length
let api = aviso + '# API\n\n'
api += `**${rotas.length} rotas**, todas em \`/api\`, todas JSON. `
api += `Públicas: ${contagem((r) => r.quem === 'público')} · todos os logados: ${contagem((r) => r.quem === 'todos logados')} · `
api += `restritas a dono/gerente: ${contagem((r) => /dono/.test(r.quem))}.\n\n`
api += '## Regras que valem para todas as rotas\n\n'
api += '- **Login:** cookie `padaria_token` (JWT HS256, httpOnly, 7 dias). A versão da sessão vai no token, então trocar a senha derruba os logins antigos.\n'
api += '- **Multi-padaria:** o servidor pega a padaria do usuário logado (`res.locals.padariaId`), nunca do que o navegador envia.\n'
api += '- **Ações (POST/PUT/PATCH/DELETE):** só em JSON e só vindas do próprio site (proteção contra CSRF).\n'
api += '- **Limites:** 600 pedidos por minuto por IP, e 20 por minuto nas rotas de login e senha.\n'
api += '- **Respostas:** `Cache-Control: no-store` (nada fica salvo no navegador).\n'
api += '- **Testes:** `npm run teste:seguranca` ataca estas rotas e confere as regras acima.\n\n'
api += '## Rotas\n\n| Método | Rota | Quem pode | Para que serve | Código |\n|---|---|---|---|---|\n'
for (const r of rotas) {
  api += `| ${r.metodo} | \`${r.caminho}\` | ${r.quem} | ${r.descricao.replace(/\|/g, '\\|') || ''} | [${r.arquivo}](../server/${r.arquivo.replace(':', '#L')}) |\n`
}
writeFileSync(new URL('docs/API.md', raiz), api)

console.log(`docs/BANCO.md: ${tabelas.length} tabelas, ${fks.length} FKs · docs/API.md: ${rotas.length} rotas`)
