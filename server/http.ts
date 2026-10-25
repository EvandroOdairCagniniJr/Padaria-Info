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
