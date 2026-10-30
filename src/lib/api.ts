// Cliente da API do servidor Coffee Break (server/). O login fica num cookie httpOnly,
// enviado automaticamente pelo navegador.

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Avisado pelo AuthContext para voltar à tela de login quando a sessão expira.
let onUnauthorized: (() => void) | null = null
export function setOnUnauthorized(fn: (() => void) | null) {
  onUnauthorized = fn
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor da padaria. Verifique se ele está ligado.')
  }

  if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized?.()

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new ApiError(res.status, data?.message ?? `Erro ${res.status} no servidor`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T = void>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T = void>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T = void>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
}
