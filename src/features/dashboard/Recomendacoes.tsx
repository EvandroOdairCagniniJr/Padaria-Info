import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarClock,
  ChefHat,
  Clock,
  Lock,
  Package,
  PauseCircle,
  Sparkles,
  Tag,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { inicioDoDiaISO } from '@/lib/format'
import { cn } from '@/lib/utils'

type Recomendacao = {
  id: string
  tom: 'alerta' | 'atencao' | 'oportunidade' | 'boa'
  icone: string
  titulo: string
  texto: string
  link?: string
  acao?: string
}

const icones: Record<string, LucideIcon> = {
  package: Package,
  calendar: CalendarClock,
  chef: ChefHat,
  trash: Trash2,
  tag: Tag,
  up: TrendingUp,
  down: TrendingDown,
  target: Target,
  wallet: Wallet,
  lock: Lock,
  clock: Clock,
  trophy: Trophy,
  pause: PauseCircle,
}

const tons = {
  alerta: { caixa: 'border-destructive/30 bg-destructive/5', icone: 'bg-destructive text-white' },
  atencao: { caixa: 'border-amber-300/70 bg-amber-50/70', icone: 'bg-amber-500 text-white' },
  oportunidade: { caixa: 'border-primary/25 bg-primary/5', icone: 'bg-primary text-primary-foreground' },
  boa: { caixa: 'border-emerald-300/70 bg-emerald-50/70', icone: 'bg-emerald-500 text-white' },
}

// "Hoje na sua padaria": o que pede atenção agora, com o próximo passo em um clique.
export function Recomendacoes() {
  const inicio = inicioDoDiaISO()
  const tz = new Date().getTimezoneOffset()
  const { data, isLoading } = useQuery({
    queryKey: ['recomendacoes', inicio],
    queryFn: () =>
      api.get<Recomendacao[]>(`/recomendacoes?inicio=${encodeURIComponent(inicio)}&tz=${tz}`),
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    )
  }
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/70 bg-emerald-50/70 p-4 text-sm">
        <Sparkles className="size-5 text-emerald-600" />
        Tudo em ordem por aqui: nenhum alerta para hoje. Boas vendas!
      </div>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {data.map((r, i) => {
        const Icone = icones[r.icone] ?? Sparkles
        const conteudo = (
          <>
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm', tons[r.tom].icone)}>
              <Icone className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-snug">{r.titulo}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{r.texto}</span>
              {r.link && r.acao && (
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {r.acao}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </span>
          </>
        )
        const classe = cn(
          'tela-entra group flex gap-3 rounded-2xl border p-4 text-left transition-shadow',
          tons[r.tom].caixa,
          r.link && 'hover:shadow-md',
        )
        // Cartões entram um depois do outro.
        const estilo = { animationDelay: `${Math.min(i, 8) * 60}ms` }
        return r.link ? (
          <Link key={r.id} to={r.link} className={classe} style={estilo}>
            {conteudo}
          </Link>
        ) : (
          <div key={r.id} className={classe} style={estilo}>
            {conteudo}
          </div>
        )
      })}
    </div>
  )
}
