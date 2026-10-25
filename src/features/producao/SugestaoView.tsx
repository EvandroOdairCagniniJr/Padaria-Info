import { CalendarPlus, Lightbulb, Loader2, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { IconeProduto } from '@/components/IconeProduto'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  useCreateProducao,
  useSugestaoProducao,
  type SugestaoProducao,
} from '@/features/producao/api'
import { adicionarDias, formatQuantidade, hojeISO, mensagemErro } from '@/lib/format'
import { cn } from '@/lib/utils'

const diasSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

// Início do dia (relógio da padaria) de uma data YYYY-MM-DD.
function inicioDe(dataISO: string) {
  return new Date(`${dataISO}T00:00:00`).toISOString()
}

// Quanto produzir: média das 4 últimas semanas no mesmo dia da semana, ajustada pelas sobras.
export function SugestaoView() {
  // Depois do almoço a pergunta já é "quanto produzir amanhã?".
  const [dia, setDia] = useState<'hoje' | 'amanha'>(() =>
    new Date().getHours() >= 13 ? 'amanha' : 'hoje',
  )
  const data = dia === 'hoje' ? hojeISO() : adicionarDias(hojeISO(), 1)
  const sugestao = useSugestaoProducao(inicioDe(data))
  const criar = useCreateProducao()
  const [planejando, setPlanejando] = useState<string | null>(null)
  const nomeDia = diasSemana[new Date(`${data}T00:00:00`).getDay()]

  async function planejar(itens: SugestaoProducao[]) {
    const comReceita = itens.filter((s) => s.receita_id && s.fornadas)
    if (comReceita.length === 0) return
    setPlanejando(comReceita.length === 1 ? comReceita[0].produto_id : 'todos')
    try {
      for (const s of comReceita) {
        for (let i = 0; i < s.fornadas!; i++) {
          await criar.mutateAsync({
            receita_id: s.receita_id!,
            data,
            observacoes: 'Sugestão automática pelo histórico de vendas',
          })
        }
      }
      const total = comReceita.reduce((n, s) => n + s.fornadas!, 0)
      toast.success(`${total} fornada(s) planejada(s) para ${dia === 'hoje' ? 'hoje' : 'amanhã'}`)
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível planejar'))
    } finally {
      setPlanejando(null)
    }
  }

  const lista = sugestao.data ?? []
  const planejaveis = lista.filter((s) => s.receita_id && s.fornadas)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border bg-card p-1">
          {(['hoje', 'amanha'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDia(d)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                dia === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {d === 'hoje' ? 'Hoje' : 'Amanhã'}
            </button>
          ))}
        </div>
        {planejaveis.length > 0 && (
          <Button onClick={() => planejar(planejaveis)} disabled={planejando !== null}>
            {planejando === 'todos' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CalendarPlus className="size-4" />
            )}
            Planejar todas as fornadas
          </Button>
        )}
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          Calculado com as vendas das <strong>últimas 4 {nomeDia}s</strong> (as mais recentes
          pesam mais) e com as sobras registradas em Perdas. Já desconta o que tem em estoque.
        </span>
      </p>

      {sugestao.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-12 text-center">
          <Sparkles className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 font-medium">Ainda sem histórico para {nomeDia}</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Conforme as vendas forem acontecendo, o sistema aprende quanto sai em cada dia da
            semana e passa a sugerir a produção.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {lista.map((s) => (
            <li key={s.produto_id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <IconeProduto produto={s} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Vende em média {formatQuantidade(s.media_vendida)} {s.unidade} · sobra{' '}
                    {formatQuantidade(s.media_perdida)} {s.unidade} · estoque{' '}
                    {formatQuantidade(s.estoque)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-heading text-2xl font-bold tabular-nums">
                    {formatQuantidade(s.sugestao)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{s.unidade} a produzir</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge
                  variant="secondary"
                  className={cn(
                    'gap-1',
                    s.taxa_sobra > 0.15 && 'bg-amber-100 text-amber-800',
                    s.taxa_sobra < 0.05 && 'bg-emerald-100 text-emerald-800',
                  )}
                >
                  {s.taxa_sobra > 0.15 ? (
                    <TrendingDown className="size-3" />
                  ) : (
                    <TrendingUp className="size-3" />
                  )}
                  {s.motivo}
                </Badge>
                {s.semanas < 4 && (
                  <span className="text-[11px] text-muted-foreground">
                    baseado em {s.semanas} semana{s.semanas === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              {s.receita_id && s.fornadas ? (
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-sm">
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">{s.fornadas}</strong> fornada
                    {s.fornadas === 1 ? '' : 's'} de {s.receita_nome} ({formatQuantidade(s.rendimento!)}{' '}
                    cada)
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => planejar([s])}
                    disabled={planejando !== null}
                  >
                    {planejando === s.produto_id && <Loader2 className="size-4 animate-spin" />}
                    Planejar
                  </Button>
                </div>
              ) : (
                !s.receita_id &&
                s.sugestao > 0 && (
                  <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                    Sem ficha técnica: cadastre a receita para planejar as fornadas.
                  </p>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
