import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function validar<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? 'Dados inválidos')
  return result.data
}

// Erros do MySQL mais comuns traduzidos para mensagens de balcão.
const mensagensMysql: Record<number, [number, string]> = {
  1451: [409, 'Este registro está sendo usado em outro lugar e não pode ser removido.'],
  1452: [400, 'Um dos registros relacionados não existe mais.'],
  3819: [400, 'Algum valor informado é inválido.'],
  1062: [409, 'Já existe um registro com esses dados.'],
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message })
    return
  }
  const errno = (err as { errno?: number }).errno
  if (errno && mensagensMysql[errno]) {
    const [status, message] = mensagensMysql[errno]
    res.status(status).json({ message })
    return
  }
  console.error(err)
  res.status(500).json({ message: 'Erro interno no servidor.' })
}

// Limite simples em memória: 20 tentativas por minuto por IP e rota (login, cadastro, código).
// Freia quem tenta adivinhar senhas ou códigos; com um único servidor, memória basta.
const JANELA_MS = 60_000
const MAX_TENTATIVAS = 20
const tentativas = new Map<string, { inicio: number; total: number }>()

export function limitarTentativas(req: Request, res: Response, next: NextFunction) {
  const agora = Date.now()
  const chave = `${req.ip}|${req.baseUrl}${req.path}`
  const atual = tentativas.get(chave)
  if (!atual || agora - atual.inicio > JANELA_MS) {
    tentativas.set(chave, { inicio: agora, total: 1 })
  } else if (++atual.total > MAX_TENTATIVAS) {
    res.status(429).json({ message: 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.' })
    return
  }
  if (tentativas.size > 10_000) {
    for (const [k, v] of tentativas) if (agora - v.inicio > JANELA_MS) tentativas.delete(k)
  }
  next()
}
