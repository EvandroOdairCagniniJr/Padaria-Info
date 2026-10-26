import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowUpRight,
  Gem,
  Lightbulb,
  Loader2,
  Receipt,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { IconeProduto } from '@/components/IconeProduto'
import { api } from '@/lib/api'
import { formatBRL, formatQuantidade } from '@/lib/format'
import { useContagem } from '@/lib/useContagem'
import { cn } from '@/lib/utils'

type Periodo = 'dia' | 'semana' | 'mes'

type ProdutoAnalise = {
  id: string
  nome: string
  categoria: string | null
  unidade: string
  quantidade: number
  faturamento: number
  vendas: number
  quantidade_anterior: number
  variacao: number | null
  participacao: number
}

type Analise = {
  periodo: { rotulo_anterior: string }
  resumo: {
    vendas: number
    faturamento: number
    ticket_medio: number
    vendas_anterior: number
    faturamento_anterior: number
    ticket_anterior: number
  }
  ranking: ProdutoAnalise[]
  por_quantidade: ProdutoAnalise[]
  linha_tempo: { rotulo: string; vendas: number; faturamento: number }[]
  categorias: { nome: string; faturamento: number; participacao: number }[]
  juntos: { produtos: string[]; vezes: number }[]
  recomendacoes: { tom: 'boa' | 'atencao' | 'oportunidade'; titulo: string; texto: string }[]
}

const abas: { key: Periodo; label: string }[] = [
  { key: 'dia', label: 'Hoje' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Este mês' },
]

const medalhas = ['🥇', '🥈', '🥉']

function parametros(periodo: Periodo) {
  const agora = new Date()
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  const mes = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const mesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
  return new URLSearchParams({
    periodo,
    hoje: hoje.toISOString(),
    mes: mes.toISOString(),
    mes_anterior: mesAnterior.toISOString(),
    tz: String(agora.getTimezoneOffset()),
  })
}

export function AnalisePage() {
  const [periodo, setPeriodo] = useState<Periodo>('dia')
  const [ordem, setOrdem] = useState<'valor' | 'quantidade'>('valor')
  const params = parametros(periodo)
  const analise = useQuery({
    queryKey: ['analise', periodo, params.get('hoje')],
    queryFn: () => api.get<Analise>(`/analise?${params}`),
  })
  const a = analise.data

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Análise de vendas</h1>
          <p className="text-sm text-muted-foreground">
            Mais vendidos, comparação com o período anterior e recomendações de venda
          </p>
        </div>
        <div className="inline-flex rounded-lg border bg-card p-1">
          {abas.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setPeriodo(x.key)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                periodo === x.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      {analise.isLoading || !a ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div key={periodo} className="tela-entra space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Indicador icone={Wallet} titulo="Faturamento" valor={a.resumo.faturamento} anterior={a.resumo.faturamento_anterior} moeda rotulo={a.periodo.rotulo_anterior} />
            <Indicador icone={Receipt} titulo="Vendas" valor={a.resumo.vendas} anterior={a.resumo.vendas_anterior} rotulo={a.periodo.rotulo_anterior} />
            <Indicador icone={Gem} titulo="Ticket médio" valor={a.resumo.ticket_medio} anterior={a.resumo.ticket_anterior} moeda rotulo={a.periodo.rotulo_anterior} />
          </div>

          {a.recomendacoes.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
                <Lightbulb className="size-5 text-primary" />
                Recomendações de venda
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {a.recomendacoes.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      'tela-entra flex gap-3 rounded-2xl border p-4',
                      r.tom === 'boa' && 'border-emerald-300/70 bg-emerald-50/70',
                      r.tom === 'atencao' && 'border-amber-300/70 bg-amber-50/70',
                      r.tom === 'oportunidade' && 'border-primary/25 bg-primary/5',
                    )}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-xl text-white',
                        r.tom === 'boa' ? 'bg-emerald-500' : r.tom === 'atencao' ? 'bg-amber-500' : 'bg-primary',
                      )}
                    >
                      {r.tom === 'boa' ? <TrendingUp className="size-4" /> : r.tom === 'atencao' ? <TrendingDown className="size-4" /> : <Sparkles className="size-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug">{r.titulo}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{r.texto}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <section className="rounded-2xl border bg-card shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <h2 className="flex items-center gap-2 font-semibold">
                  <ShoppingBag className="size-4 text-primary" />
                  Mais vendidos {abas.find((x) => x.key === periodo)?.label.toLowerCase()}
                </h2>
                <div className="inline-flex rounded-md border p-0.5 text-xs">
                  {(
                    [
                      ['valor', 'Por valor'],
                      ['quantidade', 'Por quantidade'],
                    ] as const
                  ).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setOrdem(v)}
                      className={cn('rounded px-2 py-1', ordem === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {a.ranking.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma venda no período ainda.</p>
              ) : (
                <ol className="divide-y">
                  {(ordem === 'valor' ? a.ranking : a.por_quantidade).map((p, i) => {
                    const lista = ordem === 'valor' ? a.ranking : a.por_quantidade
                    const maior = ordem === 'valor' ? lista[0].faturamento : lista[0].quantidade
                    const valor = ordem === 'valor' ? p.faturamento : p.quantidade
                    return (
                      <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-6 text-center text-lg">{medalhas[i] ?? <span className="text-sm text-muted-foreground">{i + 1}º</span>}</span>
                        <IconeProduto produto={p} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.nome}</p>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="barra-enche h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (valor / maior) * 100)}%`, animationDelay: `${i * 40}ms` }} />
                          </div>
                        </div>
                        <div className="w-28 text-right">
                          <p className="text-sm font-semibold tabular-nums">
                            {ordem === 'valor' ? formatBRL(p.faturamento) : `${formatQuantidade(p.quantidade)} ${p.unidade}`}
                          </p>
                          <p className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                            {ordem === 'valor' ? `${formatQuantidade(p.quantidade)} ${p.unidade}` : formatBRL(p.faturamento)}
                            <Variacao v={p.variacao} />
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>

            <div className="space-y-5">
              <section className="rounded-2xl border bg-card p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">{periodo === 'dia' ? 'Vendas por horário' : 'Vendas por dia'}</h2>
                <Grafico pontos={a.linha_tempo} />
              </section>

              {a.categorias.length > 0 && (
                <section className="rounded-2xl border bg-card p-4 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold">Por categoria</h2>
                  <ul className="space-y-2">
                    {a.categorias.map((c) => (
                      <li key={c.nome} className="text-sm">
                        <div className="flex justify-between">
                          <span>{c.nome}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {formatBRL(c.faturamento)} · {Math.round(c.participacao * 100)}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="barra-enche h-full rounded-full bg-chart-1" style={{ width: `${Math.max(3, c.participacao * 100)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {a.juntos.length > 0 && (
                <section className="rounded-2xl border bg-card p-4 shadow-sm">
                  <h2 className="mb-2 text-sm font-semibold">Comprados juntos</h2>
                  <ul className="space-y-1.5 text-sm">
                    {a.juntos.map((j) => (
                      <li key={j.produtos.join('+')} className="flex justify-between gap-2">
                        <span className="truncate">{j.produtos.join(' + ')}</span>
                        <span className="shrink-0 text-muted-foreground">{j.vezes} vendas</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Variacao({ v }: { v: number | null }) {
  if (v == null) return <span className="rounded bg-sky-100 px-1 text-[10px] font-medium text-sky-800">novo</span>
  if (Math.abs(v) < 0.05) return null
  return (
    <span className={cn('flex items-center font-medium', v > 0 ? 'text-emerald-700' : 'text-destructive')}>
      {v > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {Math.round(Math.abs(v) * 100)}%
    </span>
  )
}

function Indicador({
  icone: Icone,
  titulo,
  valor,
  anterior,
  moeda,
  rotulo,
}: {
  icone: typeof Wallet
  titulo: string
  valor: number
  anterior: number
  moeda?: boolean
  rotulo: string
}) {
  const animado = useContagem(valor)
  const variacao = anterior > 0 ? (valor - anterior) / anterior : null
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icone className="size-3.5" />
        {titulo}
      </p>
      <p className="mt-1 font-heading text-3xl font-bold tabular-nums">
        {moeda ? formatBRL(animado) : Math.round(animado)}
      </p>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        {variacao != null ? (
          <>
            <span className={cn('flex items-center font-semibold', variacao >= 0 ? 'text-emerald-700' : 'text-destructive')}>
              {variacao >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.round(Math.abs(variacao) * 100)}%
            </span>
            vs. {rotulo} ({moeda ? formatBRL(anterior) : anterior})
          </>
        ) : (
          `sem dados no ${rotulo}`
        )}
      </p>
    </div>
  )
}

// Barras simples (sem biblioteca): altura proporcional ao faturamento.
function Grafico({ pontos }: { pontos: { rotulo: string; vendas: number; faturamento: number }[] }) {
  if (pontos.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Sem vendas ainda.</p>
  const maior = Math.max(...pontos.map((p) => p.faturamento))
  return (
    <div className="flex h-36 items-end gap-1">
      {pontos.map((p, i) => (
        <div key={p.rotulo} className="group flex min-w-0 flex-1 flex-col items-center gap-1" title={`${p.rotulo}: ${formatBRL(p.faturamento)} em ${p.vendas} venda(s)`}>
          <div className="relative flex w-full flex-1 items-end">
            <div
              className="barra-sobe w-full rounded-t-md bg-primary/80 transition-colors group-hover:bg-primary"
              style={{ height: `${Math.max(4, (p.faturamento / maior) * 100)}%`, animationDelay: `${i * 30}ms` }}
            />
          </div>
          <span className="truncate text-[10px] text-muted-foreground">{p.rotulo}</span>
        </div>
      ))}
    </div>
  )
}
