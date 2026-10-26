import { Loader2, Pause, Pencil, Play, Plus, Tag, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  usePromocoes,
  useRemoverPromocao,
  useSalvarPromocao,
  type PromocaoComUso,
  type PromocaoInput,
} from '@/features/promocoes/api'
import { useProdutos } from '@/features/produtos/api'
import { formatBRL, formatDataHora, mensagemErro } from '@/lib/format'
import { descreverPromocao, promocaoVigente, type Abrangencia, type TipoPromocao } from '@/lib/promocoes'
import { cn } from '@/lib/utils'

const tipos: { value: TipoPromocao; label: string; dica: string }[] = [
  { value: 'percentual', label: '% de desconto', dica: 'Ex.: 20% em todos os pães' },
  { value: 'valor', label: 'R$ de desconto', dica: 'Ex.: R$ 1,00 a menos por unidade' },
  { value: 'preco_fixo', label: 'Preço fixo', dica: 'Ex.: sonho por R$ 5,00' },
  { value: 'leve_pague', label: 'Leve X, pague Y', dica: 'Ex.: leve 3, pague 2' },
]
const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Modelos prontos para começar rápido.
const modelos: { nome: string; emoji: string; dados: Partial<PromocaoInput> }[] = [
  { nome: 'Black Friday', emoji: '🖤', dados: { nome: 'Black Friday', tipo: 'percentual', valor: 20, abrangencia: 'tudo' } },
  {
    nome: 'Fim do dia',
    emoji: '🌙',
    dados: { nome: 'Pão do fim do dia', tipo: 'percentual', valor: 50, abrangencia: 'categorias', hora_inicio: '18:00', hora_fim: '23:59' },
  },
  { nome: 'Leve 3, pague 2', emoji: '🥐', dados: { nome: 'Leve 3, pague 2', tipo: 'leve_pague', leve: 3, pague: 2, abrangencia: 'produtos' } },
  {
    nome: 'Happy hour do café',
    emoji: '☕',
    dados: { nome: 'Happy hour do café', tipo: 'percentual', valor: 15, abrangencia: 'categorias', hora_inicio: '15:00', hora_fim: '17:00' },
  },
]

const vazio: PromocaoInput = {
  nome: '',
  tipo: 'percentual',
  valor: 10,
  leve: null,
  pague: null,
  abrangencia: 'tudo',
  alvos: null,
  inicio: null,
  fim: null,
  dias_semana: null,
  hora_inicio: null,
  hora_fim: null,
  ativa: true,
}

function situacao(p: PromocaoComUso) {
  const agora = new Date()
  if (!p.ativa) return { texto: 'Pausada', classe: 'bg-muted text-muted-foreground' }
  if (p.fim && agora >= new Date(p.fim)) return { texto: 'Encerrada', classe: 'bg-muted text-muted-foreground' }
  if (p.inicio && agora < new Date(p.inicio)) return { texto: 'Agendada', classe: 'bg-sky-100 text-sky-800' }
  if (promocaoVigente(p, agora, agora.getTimezoneOffset())) return { texto: 'Valendo agora', classe: 'bg-emerald-100 text-emerald-800' }
  return { texto: 'Fora do horário', classe: 'bg-amber-100 text-amber-800' }
}

export function PromocoesPage() {
  const promocoes = usePromocoes()
  const salvar = useSalvarPromocao()
  const remover = useRemoverPromocao()
  const { data: produtos } = useProdutos()
  const [editando, setEditando] = useState<{ id: string | null; dados: PromocaoInput } | null>(null)
  const nomeProduto = useMemo(() => new Map((produtos ?? []).map((p) => [p.id, p.nome])), [produtos])

  async function alternar(p: PromocaoComUso) {
    try {
      const { id, desconto_total: _d, vendas: _v, ...dados } = p
      await salvar.mutateAsync({ id, dados: { ...dados, ativa: !p.ativa } })
      toast.success(p.ativa ? 'Promoção pausada' : 'Promoção reativada')
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível atualizar'))
    }
  }

  async function apagar(p: PromocaoComUso) {
    if (!confirm(`Apagar a promoção "${p.nome}"? As vendas já feitas continuam com o desconto registrado.`)) return
    try {
      await remover.mutateAsync(p.id)
      toast.success('Promoção apagada')
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível apagar'))
    }
  }

  const lista = promocoes.data ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Promoções</h1>
          <p className="text-sm text-muted-foreground">
            Descontos automáticos no PDV: por produto, categoria ou a loja toda, com dia e horário
          </p>
        </div>
        <Button onClick={() => setEditando({ id: null, dados: vazio })}>
          <Plus className="size-4" />
          Nova promoção
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {modelos.map((m) => (
          <button
            key={m.nome}
            type="button"
            onClick={() => setEditando({ id: null, dados: { ...vazio, ...m.dados } })}
            className="flex items-center gap-2 rounded-xl border border-dashed bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/60 hover:bg-primary/5"
          >
            <span className="text-xl">{m.emoji}</span>
            <span className="font-medium">{m.nome}</span>
          </button>
        ))}
      </div>

      {promocoes.isLoading ? (
        <Loader2 className="mx-auto my-10 size-6 animate-spin text-muted-foreground" />
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-12 text-center">
          <Tag className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 font-medium">Nenhuma promoção ainda</p>
          <p className="text-sm text-muted-foreground">Comece por um dos modelos acima.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lista.map((p) => {
            const s = situacao(p)
            const onde =
              p.abrangencia === 'tudo'
                ? 'Todos os produtos'
                : p.abrangencia === 'categorias'
                  ? `Categorias: ${(p.alvos ?? []).join(', ')}`
                  : `Produtos: ${(p.alvos ?? []).map((id) => nomeProduto.get(id) ?? '—').join(', ')}`
            const quando = [
              p.dias_semana?.length ? p.dias_semana.map((d) => diasSemana[d]).join(', ') : null,
              p.hora_inicio || p.hora_fim ? `${p.hora_inicio ?? '00:00'}–${p.hora_fim ?? '23:59'}` : null,
              p.inicio ? `de ${formatDataHora(p.inicio)}` : null,
              p.fim ? `até ${formatDataHora(p.fim)}` : null,
            ].filter(Boolean)
            return (
              <article key={p.id} className={cn('rounded-2xl border bg-card p-4 shadow-sm', !p.ativa && 'opacity-70')}>
                <div className="flex items-start gap-3">
                  <span className="flex h-12 min-w-12 items-center justify-center rounded-xl bg-emerald-500 px-2 text-sm font-bold text-white shadow-sm">
                    {descreverPromocao(p)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">{onde}</p>
                    <p className="text-xs text-muted-foreground">{quando.length ? quando.join(' · ') : 'Todos os dias, o dia todo'}</p>
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold', s.classe)}>{s.texto}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
                  <span className="text-muted-foreground">
                    {p.vendas > 0 ? (
                      <>
                        <strong className="text-foreground">{formatBRL(p.desconto_total)}</strong> de desconto em {p.vendas} venda(s)
                      </>
                    ) : (
                      'Ainda não usada'
                    )}
                  </span>
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="ghost" title={p.ativa ? 'Pausar' : 'Reativar'} onClick={() => alternar(p)}>
                      {p.ativa ? <Pause className="size-4" /> : <Play className="size-4" />}
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="Editar"
                      onClick={() => {
                        const { id, desconto_total: _d, vendas: _v, ...dados } = p
                        setEditando({ id, dados })
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" title="Apagar" onClick={() => apagar(p)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {editando && (
        <PromocaoDialog
          key={editando.id ?? 'nova'}
          id={editando.id}
          inicial={editando.dados}
          onFechar={() => setEditando(null)}
        />
      )}
    </div>
  )
}

// datetime-local ↔ ISO no horário local.
function paraCampo(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function PromocaoDialog({ id, inicial, onFechar }: { id: string | null; inicial: PromocaoInput; onFechar: () => void }) {
  const salvar = useSalvarPromocao()
  const { data: produtos } = useProdutos()
  const [f, setF] = useState(inicial)
  const [valor, setValor] = useState(String(inicial.valor ?? '').replace('.', ','))
  const [inicio, setInicio] = useState(paraCampo(inicial.inicio))
  const [fim, setFim] = useState(paraCampo(inicial.fim))
  const categorias = useMemo(
    () => [...new Set((produtos ?? []).map((p) => p.categoria?.trim()).filter(Boolean) as string[])].sort(),
    [produtos],
  )
  const mudar = <K extends keyof PromocaoInput>(k: K, v: PromocaoInput[K]) => setF((x) => ({ ...x, [k]: v }))

  function alternarAlvo(alvo: string) {
    const atual = f.alvos ?? []
    mudar('alvos', atual.includes(alvo) ? atual.filter((a) => a !== alvo) : [...atual, alvo])
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const n = Number(valor.replace(/\./g, '').replace(',', '.'))
    try {
      await salvar.mutateAsync({
        id,
        dados: {
          ...f,
          valor: f.tipo === 'leve_pague' ? 0 : n,
          alvos: f.abrangencia === 'tudo' ? null : f.alvos,
          inicio: inicio ? new Date(inicio).toISOString() : null,
          fim: fim ? new Date(fim).toISOString() : null,
        },
      })
      toast.success(id ? 'Promoção atualizada' : 'Promoção criada — já vale no PDV')
      onFechar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível salvar'))
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{id ? 'Editar promoção' : 'Nova promoção'}</DialogTitle>
          <DialogDescription>O PDV aplica sozinho o melhor desconto de cada item.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="promo-nome">Nome</Label>
            <Input id="promo-nome" value={f.nome} maxLength={80} onChange={(e) => mudar('nome', e.target.value)} placeholder="Ex.: Black Friday" />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de desconto</Label>
            <div className="grid grid-cols-2 gap-2">
              {tipos.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => mudar('tipo', t.value)}
                  className={cn(
                    'rounded-lg border p-2 text-left text-sm transition-colors',
                    f.tipo === t.value ? 'border-primary bg-primary/10' : 'hover:border-primary/40',
                  )}
                >
                  <span className="block font-medium">{t.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{t.dica}</span>
                </button>
              ))}
            </div>
          </div>

          {f.tipo === 'leve_pague' ? (
            <div className="flex items-center gap-2 text-sm">
              Leve
              <Input type="number" min={2} className="w-20" value={f.leve ?? ''} onChange={(e) => mudar('leve', Number(e.target.value) || null)} />
              pague
              <Input type="number" min={0} className="w-20" value={f.pague ?? ''} onChange={(e) => mudar('pague', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
          ) : (
            <div className="relative w-40">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                {f.tipo === 'percentual' ? '%' : 'R$'}
              </span>
              <Input inputMode="decimal" className="pl-9 tabular-nums" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Vale para</Label>
            <div className="inline-flex rounded-lg border p-1">
              {(
                [
                  ['tudo', 'Loja toda'],
                  ['categorias', 'Categorias'],
                  ['produtos', 'Produtos'],
                ] as [Abrangencia, string][]
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setF((x) => ({ ...x, abrangencia: v, alvos: [] }))}
                  className={cn('rounded-md px-3 py-1 text-sm', f.abrangencia === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
                >
                  {l}
                </button>
              ))}
            </div>
            {f.abrangencia !== 'tudo' && (
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg border p-2">
                {(f.abrangencia === 'categorias'
                  ? categorias.map((c) => ({ id: c, nome: c }))
                  : (produtos ?? []).map((p) => ({ id: p.id, nome: p.nome }))
                ).map((a) => {
                  const marcado = (f.alvos ?? []).includes(a.id)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => alternarAlvo(a.id)}
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                        marcado ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:border-primary/50',
                      )}
                    >
                      {a.nome}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Dias da semana (vazio = todos)</Label>
            <div className="flex flex-wrap gap-1.5">
              {diasSemana.map((d, i) => {
                const marcado = (f.dias_semana ?? []).includes(i)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      const atual = f.dias_semana ?? []
                      mudar('dias_semana', marcado ? atual.filter((x) => x !== i) : [...atual, i].sort())
                    }}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs',
                      marcado ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="promo-hi">Das (horário)</Label>
              <Input id="promo-hi" type="time" value={f.hora_inicio ?? ''} onChange={(e) => mudar('hora_inicio', e.target.value || null)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-hf">Até</Label>
              <Input id="promo-hf" type="time" value={f.hora_fim ?? ''} onChange={(e) => mudar('hora_fim', e.target.value || null)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-ini">Começa em (opcional)</Label>
              <Input id="promo-ini" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-fim">Termina em (opcional)</Label>
              <Input id="promo-fim" type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
              {id ? 'Salvar' : 'Criar promoção'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
