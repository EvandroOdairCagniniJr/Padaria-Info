import { readdirSync, readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import type { RequestHandler } from 'express'

const tipos: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
}

interface Arquivo {
  tipo: string
  br: Buffer
  gzip: Buffer
}

// Comprime os arquivos de /assets uma vez ao ligar o servidor (brotli no nível máximo).
// Comprimir a cada pedido levava ~350 ms no arquivo principal; assim sai pronto da memória.
// Fontes (.woff2) já vêm comprimidas e ficam com o express.static.
export function assetsComprimidos(pasta: string): RequestHandler {
  const arquivos = new Map<string, Arquivo>()
  for (const nome of readdirSync(pasta)) {
    const tipo = tipos[extname(nome)]
    if (!tipo) continue
    const conteudo = readFileSync(`${pasta}/${nome}`)
    arquivos.set(`/${nome}`, {
      tipo,
      br: brotliCompressSync(conteudo, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }),
      gzip: gzipSync(conteudo, { level: 9 }),
    })
  }

  return (req, res, next) => {
    const arquivo = arquivos.get(req.path)
    const aceita = req.headers['accept-encoding'] ?? ''
    const codificacao = /\bbr\b/.test(aceita) ? 'br' : /\bgzip\b/.test(aceita) ? 'gzip' : null
    if (!arquivo || !codificacao) return next()
    res.set({
      'Content-Type': arquivo.tipo,
      'Content-Encoding': codificacao,
      'Cache-Control': 'public, max-age=31536000, immutable',
      Vary: 'Accept-Encoding',
    })
    res.end(arquivo[codificacao])
  }
}
