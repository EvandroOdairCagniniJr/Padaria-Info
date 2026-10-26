import { useQuery } from '@tanstack/react-query'
import { KeyRound, Lock, LogIn, Mail, ShieldAlert, ShieldCheck, LogOut, type LucideIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDataHora } from '@/lib/format'
import { cn } from '@/lib/utils'

type Acesso = {
  id: string
  evento: string
  email: string | null
  ip: string | null
  navegador: string | null
  created_at: string
  nome: string | null
}

const eventos: Record<string, { texto: string; icone: LucideIcon; alerta?: boolean }> = {
  login: { texto: 'Entrou no sistema', icone: LogIn },
  login_falhou: { texto: 'Errou a senha', icone: ShieldAlert, alerta: true },
  conta_bloqueada: { texto: 'Tentou entrar com a conta bloqueada', icone: Lock, alerta: true },
  codigo_enviado: { texto: 'Pediu código de recuperação', icone: Mail },
  entrou_com_codigo: { texto: 'Entrou com código do e-mail', icone: KeyRound },
  senha_alterada: { texto: 'Trocou a senha', icone: ShieldCheck },
  saiu_de_todos: { texto: 'Saiu de todos os aparelhos', icone: LogOut },
}

// Navegador em poucas palavras ("Chrome no Windows").
function aparelho(ua: string | null) {
  if (!ua) return ''
  const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador'
  const so = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : ''
  return so ? `${nav} no ${so}` : nav
}

// Painel do dono: quem entrou, de onde, e tentativas suspeitas.
export function AcessosRecentes() {
  const { data } = useQuery({
    queryKey: ['equipe', 'acessos'],
    queryFn: () => api.get<Acesso[]>('/equipe/acessos'),
  })
  if (!data?.length) return null
  const suspeitos = data.filter((a) => eventos[a.evento]?.alerta).length
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
        <ShieldCheck className="size-5 text-primary" />
        Segurança: acessos recentes
        {suspeitos > 0 && (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
            {suspeitos} tentativa(s) com senha errada
          </span>
        )}
      </h2>
      <ul className="max-h-80 divide-y overflow-y-auto rounded-2xl border bg-card shadow-sm">
        {data.map((a) => {
          const e = eventos[a.evento] ?? { texto: a.evento, icone: LogIn }
          return (
            <li key={a.id} className={cn('flex items-center gap-3 px-4 py-2 text-sm', e.alerta && 'bg-destructive/5')}>
              <e.icone className={cn('size-4 shrink-0', e.alerta ? 'text-destructive' : 'text-muted-foreground')} />
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <span className="font-medium">{a.nome ?? a.email}</span> · {e.texto}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {aparelho(a.navegador)}
                  {a.ip && ` · IP ${a.ip}`}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDataHora(a.created_at)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
