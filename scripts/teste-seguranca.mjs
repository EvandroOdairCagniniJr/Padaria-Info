// Teste de segurança automático: ataca o sistema de verdade e mostra o que passou e o que falhou.
// Uso: npm run teste:seguranca
//
// Roda isolado: sobe um banco temporário em memória (apagado no fim) e um servidor numa porta
// própria. Não toca no Supabase (produção) nem no servidor da porta 3000. Os dados são fictícios.
import { spawn } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const PORTA_BANCO = 5498
const PORTA = 3997
const BASE = `http://localhost:${PORTA}/api`
const SENHA = 'SenhaDeTeste123'

// ------------------------------------------------------------------ ambiente isolado
const db = await PGlite.create()
const banco = new PGLiteSocketServer({ db, port: PORTA_BANCO, host: '127.0.0.1', maxConnections: 20 })
await banco.start()

const servidor = spawn(process.execPath, ['server/index.ts'], {
  env: {
    ...process.env,
    PORT: String(PORTA),
    DATABASE_URL: `postgres://postgres@127.0.0.1:${PORTA_BANCO}/postgres`,
    DATABASE_SSL: 'false',
    DATABASE_POOL: '1',
    JWT_SECRET: randomBytes(32).toString('hex'),
    NODE_ENV: 'test',
    // Nenhum e-mail de verdade sai durante o teste.
    SMTP_HOST: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let logServidor = ''
servidor.stdout.on('data', (d) => (logServidor += d))
servidor.stderr.on('data', (d) => (logServidor += d))

async function encerrar(codigo) {
  servidor.kill()
  await banco.stop().catch(() => {})
  await db.close().catch(() => {})
  process.exit(codigo)
}

for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${BASE}/saude`)).ok) break
  } catch {}
  if (i > 120) {
    console.error('O servidor de teste não subiu:\n' + logServidor)
    await encerrar(1)
  }
  await new Promise((r) => setTimeout(r, 250))
}

// ------------------------------------------------------------------ ferramentas
const respostas = [] // tudo o que o servidor devolveu, para procurar vazamentos no fim

async function api(metodo, caminho, { corpo, cookie, headers = {} } = {}) {
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers: {
      ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: corpo === undefined ? undefined : typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  })
  const texto = await r.text()
  respostas.push(texto)
  let json = null
  try {
    json = JSON.parse(texto)
  } catch {}
  const setCookie = r.headers.get('set-cookie')
  return { status: r.status, json, texto, headers: r.headers, cookie: setCookie?.split(';')[0] }
}

function cpfValido() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  for (const t of [10, 11]) {
    const soma = n.reduce((s, d, i) => s + d * (t - i), 0)
    n.push(((soma * 10) % 11) % 10)
  }
  return n.join('')
}

let passou = 0
let falhou = 0
const falhas = []
function confere(grupo, descricao, ok, detalhe = '') {
  if (ok) passou++
  else {
    falhou++
    falhas.push(`${grupo} — ${descricao}${detalhe ? ` (${detalhe})` : ''}`)
  }
  console.log(`  ${ok ? '✅' : '❌'} ${descricao}${!ok && detalhe ? `  → ${detalhe}` : ''}`)
}
const titulo = (t) => console.log(`\n${t}`)

// ------------------------------------------------------------------ dados fictícios
const id = randomBytes(3).toString('hex')
const cpfDonoA = cpfValido()
const donoA = { email: `dono.a.${id}@teste.local`, nome: 'Dono Padaria A' }
const donoB = { email: `dono.b.${id}@teste.local`, nome: 'Dono Padaria B' }
const func = { email: `func.a.${id}@teste.local`, nome: 'Funcionário A' }

const setupA = await api('POST', '/auth/setup', {
  corpo: { nome: donoA.nome, email: donoA.email, senha: SENHA, cpf: cpfDonoA, padaria: { nome_fantasia: 'Padaria A' } },
})
const setupB = await api('POST', '/auth/setup', {
  corpo: { nome: donoB.nome, email: donoB.email, senha: SENHA, padaria: { nome_fantasia: 'Padaria B' } },
})
if (setupA.status !== 200 || setupB.status !== 200) {
  console.error('Não foi possível preparar os dados de teste:', setupA.texto, setupB.texto)
  await encerrar(1)
}
const A = setupA.cookie
const B = setupB.cookie

const produtoA = (await api('POST', '/produtos', {
  cookie: A,
  corpo: { nome: 'Pão francês A', unidade: 'un', preco_venda: 1, estoque_atual: 100 },
})).json.id
await api('POST', '/produtos', { cookie: B, corpo: { nome: 'Pão de queijo B', unidade: 'un', preco_venda: 2 } })
await api('POST', '/equipe/membros', {
  cookie: A,
  corpo: { nome: func.nome, email: func.email, senha: SENHA, papel: 'funcionario' },
})
const F = (await api('POST', '/auth/login', { corpo: { email: func.email, senha: SENHA } })).cookie
const funcId = (await api('GET', '/auth/me', { cookie: F })).json?.id
await api('POST', '/caixa/abrir', { cookie: A, corpo: { fundo_troco: 0 } })
const vendaA = (await api('POST', '/vendas', {
  cookie: A,
  corpo: { itens: [{ produto_id: produtoA, quantidade: 1 }], forma_pagamento: 'pix' },
})).json?.id

console.log('🔒 Teste de segurança do Coffee Break (banco temporário, dados fictícios)')

// ------------------------------------------------------------------ 1. sem login
titulo('1. Acesso sem login')
for (const rota of ['/produtos', '/vendas/historico?desde=2020-01-01&ate=2100-01-01', '/equipe/membros', '/auth/perfil', '/caixa/atual']) {
  const r = await api('GET', rota)
  confere('Sem login', `GET ${rota.split('?')[0]} é recusado`, r.status === 401, `status ${r.status}`)
}

// ------------------------------------------------------------------ 2. login forjado
titulo('2. Login falsificado')
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const semAssinatura = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: funcId, v: 0 })}.`
const chaveErrada = (() => {
  const corpo = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: funcId, v: 0, exp: 9999999999 })}`
  return `${corpo}.${createHmac('sha256', 'chute-de-chave').update(corpo).digest('base64url')}`
})()
let r = await api('GET', '/auth/me', { cookie: `padaria_token=${semAssinatura}` })
confere('Login forjado', 'token sem assinatura ("alg: none") é recusado', r.status === 401, `status ${r.status}`)
r = await api('GET', '/auth/me', { cookie: `padaria_token=${chaveErrada}` })
confere('Login forjado', 'token assinado com chave errada é recusado', r.status === 401, `status ${r.status}`)

// ------------------------------------------------------------------ 3. isolamento entre padarias
titulo('3. Uma padaria não acessa os dados de outra')
r = await api('GET', '/produtos', { cookie: B })
confere('Isolamento', 'B não vê os produtos de A', r.status === 200 && r.texto.includes('Pão de queijo B') && !r.texto.includes('Pão francês A'))
r = await api('PATCH', `/produtos/${produtoA}`, { cookie: B, corpo: { nome: 'HACKEADO', preco_venda: 0 } })
confere('Isolamento', 'B não altera produto de A', r.status === 404, `status ${r.status}`)
r = await api('DELETE', `/produtos/${produtoA}`, { cookie: B })
confere('Isolamento', 'B não apaga produto de A', r.status === 404, `status ${r.status}`)
r = await api('GET', '/produtos', { cookie: A })
confere('Isolamento', 'produto de A continua intacto', r.texto.includes('Pão francês A') && !r.texto.includes('HACKEADO'))
if (vendaA) {
  r = await api('GET', `/vendas/${vendaA}`, { cookie: B })
  confere('Isolamento', 'B não abre venda de A', r.status === 404, `status ${r.status}`)
  r = await api('POST', `/vendas/${vendaA}/devolver`, { cookie: B, corpo: { motivo: 'teste' } })
  confere('Isolamento', 'B não devolve venda de A', r.status >= 400 && r.status !== 500, `status ${r.status}`)
} else {
  confere('Isolamento', 'venda de teste criada para os testes de venda', false, 'não executado')
}
r = await api('GET', '/equipe/membros', { cookie: B })
confere('Isolamento', 'B não vê a equipe de A', r.status === 200 && r.texto.includes(donoB.email) && !r.texto.includes(func.email) && !r.texto.includes(donoA.email))
r = await api('PATCH', `/equipe/membros/${funcId}`, { cookie: B, corpo: { ativo: false } })
confere('Isolamento', 'B não desativa funcionário de A', r.status === 404, `status ${r.status}`)
r = await api('POST', '/produtos', {
  cookie: B,
  corpo: { nome: 'Infiltrado', unidade: 'un', preco_venda: 1, padaria_id: 'x', id: produtoA },
})
const listaA = await api('GET', '/produtos', { cookie: A })
confere('Isolamento', 'B não cria produto dentro de A informando padaria_id/id', !listaA.texto.includes('Infiltrado'))

// ------------------------------------------------------------------ 4. papéis
titulo('4. Funcionário não faz o que é só do dono/gerente')
const proibidos = [
  ['GET', '/equipe/membros'],
  ['GET', '/analise'],
  ['GET', '/margens'],
  ['GET', '/contas'],
  ['POST', '/produtos', { nome: 'x', unidade: 'un', preco_venda: 1 }],
  ['PUT', '/padaria', { nome_fantasia: 'Tomada' }],
  ['GET', '/padaria/convite'],
]
for (const [metodo, rota, corpo] of proibidos) {
  r = await api(metodo, rota, { cookie: F, corpo })
  confere('Papéis', `${metodo} ${rota} é recusado ao funcionário`, r.status === 403, `status ${r.status}`)
}
r = await api('PATCH', `/equipe/membros/${funcId}`, { cookie: F, corpo: { papel: 'admin' } })
confere('Papéis', 'funcionário não se promove pela Equipe', r.status === 403, `status ${r.status}`)
await api('PATCH', '/auth/perfil', { cookie: F, corpo: { papel: 'dono', ativo: true } })
r = await api('GET', '/auth/me', { cookie: F })
confere('Papéis', 'funcionário não se promove pelo próprio perfil', r.json?.papel === 'funcionario', `papel ${r.json?.papel}`)

// ------------------------------------------------------------------ 5. SQL injection
titulo('5. SQL injection')
r = await api('POST', '/auth/login', { corpo: { email: "' or 1=1 --", senha: "' or '1'='1" } })
confere('SQL injection', 'login com SQL no e-mail/senha é recusado', r.status === 401, `status ${r.status}`)
r = await api('GET', `/vendas/historico?desde=2020-01-01&ate=2100-01-01&busca=${encodeURIComponent("' or 1=1 --")}`, { cookie: B })
confere('SQL injection', 'busca com SQL não traz vendas de outra padaria', r.status === 200 && !r.texto.includes('Pão francês A'), `status ${r.status}`)
const nomeMalicioso = "Bolo'); drop table padaria.produtos; --"
r = await api('POST', '/produtos', { cookie: A, corpo: { nome: nomeMalicioso, unidade: 'un', preco_venda: 1 } })
r = await api('GET', '/produtos', { cookie: A })
confere('SQL injection', 'texto com SQL é gravado como texto comum (tabela intacta)', r.status === 200 && r.texto.includes('drop table'))

// ------------------------------------------------------------------ 6. CSRF
titulo('6. Ataque vindo de outro site (CSRF)')
r = await api('POST', '/produtos', {
  cookie: A,
  corpo: { nome: 'csrf', unidade: 'un', preco_venda: 1 },
  headers: { Origin: 'https://site-falso.com' },
})
confere('CSRF', 'ação com origem de outro site é recusada', r.status === 403, `status ${r.status}`)
r = await api('POST', '/produtos', {
  cookie: A,
  corpo: 'nome=csrf&unidade=un&preco_venda=1',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
})
confere('CSRF', 'formulário comum (não JSON) é recusado', r.status === 415, `status ${r.status}`)

// ------------------------------------------------------------------ 7. dados pessoais
titulo('7. Dados pessoais')
r = await api('POST', '/auth/setup', {
  corpo: { nome: 'Curioso', email: `curioso.${id}@teste.local`, senha: SENHA, cpf: cpfDonoA, padaria: { nome_fantasia: 'X' } },
})
confere('Dados pessoais', 'CPF repetido não revela o nome do titular', r.status === 409 && !r.texto.includes(donoA.nome), r.json?.message)
const naoExiste = await api('POST', '/auth/login', { corpo: { email: `ninguem.${id}@teste.local`, senha: 'Errada123' } })
const senhaErrada = await api('POST', '/auth/login', { corpo: { email: donoB.email, senha: 'Errada123' } })
confere('Dados pessoais', 'login não revela se o e-mail existe', naoExiste.json?.message === senhaErrada.json?.message)
r = await api('GET', '/auth/me', { cookie: A })
confere('Dados pessoais', 'respostas da API não ficam em cache (no-store)', r.headers.get('cache-control') === 'no-store')

// ------------------------------------------------------------------ 8. sessões e senhas
titulo('8. Sessões e senhas')
for (let i = 0; i < 5; i++) await api('POST', '/auth/login', { corpo: { email: func.email, senha: 'Errada123' } })
r = await api('POST', '/auth/login', { corpo: { email: func.email, senha: SENHA } })
confere('Sessões', 'conta bloqueada após 5 senhas erradas (nem a certa entra)', r.status === 423, `status ${r.status}`)
await api('POST', '/auth/sair-de-todos', { cookie: A })
r = await api('GET', '/auth/me', { cookie: A })
confere('Sessões', '"Sair de todos os aparelhos" invalida o login antigo', r.status === 401, `status ${r.status}`)
r = await api('POST', '/auth/setup', {
  corpo: { nome: 'Fraca', email: `fraca.${id}@teste.local`, senha: '123', padaria: { nome_fantasia: 'Y' } },
})
confere('Sessões', 'senha fraca é recusada no cadastro', r.status === 400, `status ${r.status}`)

// ------------------------------------------------------------------ 9. cabeçalhos
titulo('9. Cabeçalhos de proteção do navegador')
r = await api('GET', '/saude')
for (const [nome, esperado] of [
  ['content-security-policy', "script-src 'self'"],
  ['x-frame-options', 'DENY'],
  ['x-content-type-options', 'nosniff'],
  ['referrer-policy', 'strict-origin-when-cross-origin'],
]) {
  confere('Cabeçalhos', `${nome}`, (r.headers.get(nome) ?? '').includes(esperado))
}
confere('Cabeçalhos', 'servidor não anuncia a tecnologia (x-powered-by)', !r.headers.get('x-powered-by'))

// ------------------------------------------------------------------ 10. vazamentos
titulo('10. Vazamento de senhas')
const tudo = respostas.join('\n')
confere('Vazamento', 'nenhuma resposta contém hash de senha', !/\$2[aby]\$\d{2}\$/.test(tudo) && !tudo.includes('senha_hash'))
confere('Vazamento', 'nenhuma resposta contém a senha digitada', !tudo.includes(SENHA))
confere('Vazamento', 'erros não expõem detalhes internos (SQL, stack)', !/at .+\.ts:\d+|syntax error at|relation "/.test(tudo))

// ------------------------------------------------------------------ 11. força bruta (por último)
titulo('11. Força bruta')
// O limite (20 por minuto, por IP e rota) vale para login, cadastro, setup e código de senha.
// Usa /auth/cadastro, que o teste não chamou antes: a janela de 60 s começa aqui, então o
// bloqueio tem que vir exatamente na 21ª tentativa (nem antes, nem depois).
const codigos = []
for (let i = 0; i < 25; i++) {
  codigos.push(
    (await api('POST', '/auth/cadastro', {
      corpo: { nome: 'Robô', email: `robo.${id}@teste.local`, senha: 'Chute1234', codigo: 'ZZZZZZZZ' },
    })).status,
  )
}
confere('Força bruta', 'após 20 tentativas por minuto, o servidor bloqueia (429)', codigos.indexOf(429) === 20, codigos.join(' '))

// ------------------------------------------------------------------ resultado
console.log(`\n${'─'.repeat(60)}`)
console.log(`Resultado: ${passou} passaram, ${falhou} falharam`)
if (falhou) {
  console.log('\nFalhas:')
  for (const f of falhas) console.log(`  ❌ ${f}`)
}
console.log(
  '\nO teste cobre as falhas mais comuns (OWASP Top 10) nas rotas principais. Passar em tudo é\n' +
    'um ótimo sinal, mas não é garantia absoluta: rode de novo a cada mudança no sistema.',
)
await encerrar(falhou ? 1 : 0)
