// Servidor do Padaria Info: API em /api e o site (pasta dist) no mesmo endereço.
// Rodar com `npm start` (gera o build e sobe o servidor) ou `npm run server`.
import { existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'

if (existsSync('.env')) process.loadEnvFile('.env')

const { default: express } = await import('express')
const { default: cookieParser } = await import('cookie-parser')
const { default: compression } = await import('compression')
// Importados depois do loadEnvFile: db.ts e auth.ts leem process.env ao carregar.
const { initDatabase } = await import('./db.ts')
const { authRouter, exigirLogin } = await import('./auth.ts')
const { apiRouter } = await import('./routes.ts')
const { equipeRouter } = await import('./equipe.ts')
const { timeRouter } = await import('./time.ts')
const { padariaRouter } = await import('./padaria.ts')
const { metasRouter } = await import('./metas.ts')
const { perdasRouter } = await import('./perdas.ts')
const { encomendasRouter } = await import('./encomendas.ts')
const { caixaRouter } = await import('./caixa.ts')
const { errorHandler } = await import('./http.ts')
const { assetsComprimidos } = await import('./estaticos.ts')

const port = Number(process.env.PORT ?? 3000)

try {
  await initDatabase()
} catch (err) {
  console.error('\nNão foi possível conectar ao MySQL:', (err as Error).message)
  console.error('Confira se o serviço MySQL80 está rodando e os dados MYSQL_* no arquivo .env.\n')
  process.exit(1)
}

const app = express()
// Atrás do proxy do Render (HTTPS): IP real do cliente e cookie seguro.
app.set('trust proxy', 1)
app.use(compression())
// Limite maior por causa das fotos da equipe (já reduzidas no navegador).
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

// Verificação de saúde do Render (sem login).
app.get('/api/saude', (_req, res) => {
  res.json({ ok: true })
})
app.use('/api/auth', authRouter)
app.use('/api/equipe', exigirLogin, equipeRouter)
app.use('/api/time', exigirLogin, timeRouter)
app.use('/api/padaria', exigirLogin, padariaRouter)
app.use('/api/metas', exigirLogin, metasRouter)
app.use('/api/encomendas', exigirLogin, encomendasRouter)
app.use('/api/caixa', exigirLogin, caixaRouter)
app.use('/api', exigirLogin, perdasRouter)
app.use('/api', exigirLogin, apiRouter)
app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Rota não encontrada' })
})
app.use(errorHandler)

const dist = fileURLToPath(new URL('../dist', import.meta.url))
if (existsSync(dist)) {
  // /assets tem hash no nome: o navegador guarda por 1 ano e não pergunta de novo.
  app.use('/assets', assetsComprimidos(`${dist}/assets`))
  app.use('/assets', express.static(`${dist}/assets`, { immutable: true, maxAge: '1y' }))
  app.use(express.static(dist))
  // Rotas do React Router (/estoque, /pdv...) devolvem o app.
  app.get(/.*/, (_req, res) => res.sendFile('index.html', { root: dist }))
}

// Sem host = IPv4 e IPv6. Escutar só em 0.0.0.0 fazia o navegador tentar o IPv6 de
// "localhost" primeiro e esperar ~200 ms (ou segundos) em cada conexão no Windows.
app.listen(port, () => {
  console.log(`\nPadaria Info rodando em http://localhost:${port}`)
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i!.address}:${port}`)
  if (ips.length) console.log(`Na rede da padaria: ${ips.join('  ')}`)
  if (!existsSync(dist)) console.log('(pasta dist não encontrada — rode `npm run build` para servir o site)')
})
