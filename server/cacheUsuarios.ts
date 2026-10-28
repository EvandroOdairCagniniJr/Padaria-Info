// Cache curto de quem está logado: evita uma consulta ao banco em CADA requisição (com o banco
// longe, isso custava ~200 ms por tela). Qualquer mudança na pessoa (perfil, papel, acesso, senha)
// limpa a entrada na hora; fora isso, no máximo 15 s até o banco ser lido de novo.
import type { RowDataPacket } from './db.ts'

const VALIDADE_MS = 15_000
const cache = new Map<string, { linha: RowDataPacket; ate: number }>()

export function lerDoCache(id: string) {
  const item = cache.get(id)
  if (!item || item.ate < Date.now()) return null
  return item.linha
}

export function guardarNoCache(id: string, linha: RowDataPacket) {
  if (cache.size > 5000) cache.clear()
  cache.set(id, { linha, ate: Date.now() + VALIDADE_MS })
}

export function esquecerUsuario(id: string) {
  cache.delete(id)
}
