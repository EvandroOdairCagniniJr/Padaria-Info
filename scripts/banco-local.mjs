// Banco PostgreSQL local para desenvolvimento e testes, sem instalar nada (PGlite).
// Uso: npm run banco:local  →  DATABASE_URL=postgres://postgres@127.0.0.1:5433/postgres
//                              DATABASE_SSL=false
// Os dados ficam na pasta .banco-local (fora do Git).
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const porta = Number(process.env.PORTA_BANCO ?? 5433)
const db = await PGlite.create(process.env.PASTA_BANCO ?? './.banco-local')
const servidor = new PGLiteSocketServer({ db, port: porta, host: '127.0.0.1', maxConnections: 20 })
await servidor.start()
console.log(`Banco local rodando: postgres://postgres@127.0.0.1:${porta}/postgres`)

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, async () => {
    await servidor.stop()
    await db.close()
    process.exit(0)
  })
}
