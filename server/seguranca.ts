// Camadas de proteção do servidor: cabeçalhos de segurança, bloqueio de requisições vindas de
// outros sites (CSRF), limite geral de requisições e registro de acessos (login, senha).
import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { pool } from './db.ts'

const producao = process.env.NODE_ENV === 'production'

// Cabeçalhos que fecham as portas mais comuns: script de outro site (XSS), o sistema dentro de
// um iframe alheio (clickjacking), "adivinhar" tipo de arquivo e vazar a URL para outros sites.
export function cabecalhosSeguranca(_req: Request, res: Response, next: NextFunction) {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      // Tailwind/Radix usam estilos inline; fotos são data URLs.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  )
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  // Só com HTTPS (produção): o navegador passa a recusar a versão sem cadeado por 1 ano.
  if (producao) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
}

// Ações (POST/PUT/PATCH/DELETE) só vindas do próprio site: outro site não consegue usar o login
// de quem está com o sistema aberto (CSRF). Complementa o cookie SameSite.
export function mesmaOrigem(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  const origem = req.headers.origin ?? req.headers.referer
  if (origem) {
    let host: string | null = null
    try {
      host = new URL(origem).host
    } catch {
      host = null
    }
    if (host !== req.headers.host) {
      res.status(403).json({ message: 'Requisição recusada: origem desconhecida.' })
      return
    }
  }
  next()
}

// Limite geral por IP (freia robôs que tentam copiar os dados em massa).
const JANELA_MS = 60_000
const MAX_POR_MINUTO = 600
const contagem = new Map<string, { inicio: number; total: number }>()

export function limiteGeral(req: Request, res: Response, next: NextFunction) {
  const agora = Date.now()
  const chave = req.ip ?? 'desconhecido'
  const atual = contagem.get(chave)
  if (!atual || agora - atual.inicio > JANELA_MS) contagem.set(chave, { inicio: agora, total: 1 })
  else if (++atual.total > MAX_POR_MINUTO) {
    res.status(429).json({ message: 'Muitas requisições. Aguarde um instante.' })
    return
  }
  if (contagem.size > 20_000) {
    for (const [k, v] of contagem) if (agora - v.inicio > JANELA_MS) contagem.delete(k)
  }
  next()
}

export type EventoAcesso =
  | 'login'
  | 'login_falhou'
  | 'conta_bloqueada'
  | 'codigo_enviado'
  | 'entrou_com_codigo'
  | 'senha_alterada'
  | 'saiu_de_todos'

// Registro de acessos (o dono vê em Equipe). Falha aqui nunca derruba o login.
export async function registrarAcesso(
  req: Request,
  evento: EventoAcesso,
  dados: { padariaId?: string | null; usuarioId?: string | null; email?: string | null },
) {
  try {
    await pool.query(
      `insert into log_acessos (id, padaria_id, usuario_id, email, evento, ip, navegador)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        dados.padariaId ?? null,
        dados.usuarioId ?? null,
        dados.email?.slice(0, 255) ?? null,
        evento,
        req.ip?.slice(0, 64) ?? null,
        String(req.headers['user-agent'] ?? '').slice(0, 255),
      ],
    )
  } catch (err) {
    console.error('Falha ao registrar acesso:', err)
  }
}
