import {
  CircleCheck,
  Crown,
  Gem,
  Loader2,
  Receipt,
  Search,
  ShoppingBasket,
  TrendingUp,
  Trophy,
  Wallet,
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar } from '@/components/Avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/AuthContext'
import { useMural } from '@/features/equipe/api'
import {
  calcularDestaques,
  familias,
  itensVendidos,
  selosDoMembro,
  ticketMedio,
  tonsPodio,
  vendasPorFamilia,
  type Destaque,
  type Selo,
} from '@/features/equipe/premios'
import { formatBRL, formatQuantidade } from '@/lib/format'
import type { Familia } from '@/lib/iconeProduto'
import { papelLabels } from '@/lib/permissoes'
import { cn } from '@/lib/utils'
import type { MembroMural } from '@/types/database'

// Pódio: anel da foto e degrau, em ouro, prata e bronze discretos.
const podio = {
  1: {
    anel: 'ring-amber-400',
    degrau: 'h-20 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
  2: {
    anel: 'ring-slate-300',
    degrau: 'h-14 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  },
  3: {
    anel: 'ring-orange-300',
    degrau: 'h-10 bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  },
} as const

type Lugar = 1 | 2 | 3

function lugarDe(posicao: number | null): Lugar | null {
  return posicao === 1 || posicao === 2 || posicao === 3 ? posicao : null
}

function IconeSelo({ selo, tamanho = 'sm' }: { selo: Selo; tamanho?: 'sm' | 'lg' }) {
  return (
    <span
      title={`${selo.titulo} — ${selo.criterio}`}
      aria-label={selo.titulo}
      className={cn(
        'inline-flex shrink-0 items-center justify-center ring-1 ring-inset',
        tamanho === 'sm' ? 'size-7 rounded-md' : 'size-10 rounded-lg',
        selo.tom,
      )}
    >
      <selo.icone className={tamanho === 'sm' ? 'size-3.5' : 'size-5'} strokeWidth={2} />
    </span>
  )
}

// Coroa do 1º lugar: dourada, pulando (animação em index.css), com sombra e um brilho.
function CoroaAnimada() {
  return (
    <span aria-label="1º lugar" className="relative mb-1.5 flex flex-col items-center">
      <span className="coroa-pulo relative">
        <Crown
          className="size-9 fill-amber-300 text-amber-500 drop-shadow-[0_2px_3px_rgba(217,119,6,0.35)]"
          strokeWidth={1.8}
        />
        <span className="coroa-brilho absolute -top-0.5 -right-1 size-2 rotate-45 rounded-[1px] bg-amber-200 shadow-[0_0_6px_2px_rgba(253,230,138,0.9)]" />
      </span>
      <span className="coroa-sombra mt-0.5 h-1 w-6 rounded-full bg-amber-900/40 blur-[1px]" />
    </span>
  )
}

function SeloPosicao({ posicao, className }: { posicao: Lugar; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-7 items-center justify-center rounded-full text-xs font-bold tabular-nums shadow-sm ring-1 ring-inset',
        tonsPodio[posicao],
        className,
      )}
    >
      {posicao}º
    </span>
  )
}

function Foto({ membro, tamanho }: { membro: MembroMural; tamanho: 'lg' | 'xl' }) {
  const lugar = lugarDe(membro.posicao)
  return (
    <Avatar
      nome={membro.nome || '?'}
      foto={membro.foto}
      tamanho={tamanho}
      className={cn(
        'ring-offset-2 ring-offset-card',
        lugar ? cn('ring-[3px]', podio[lugar].anel) : 'ring-1 ring-border',
      )}
    />
  )
}

export function MuralEquipe({
  desde,
  hoje,
  periodoLabel,
}: {
  desde: string
  hoje: string
  periodoLabel: string
}) {
  const { user } = useAuth()
  const mural = useMural(desde, hoje)
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<'ranking' | 'nome'>('ranking')
  const [aberto, setAberto] = useState<MembroMural | null>(null)

  const membros = useMemo(() => mural.data?.membros ?? [], [mural.data])
  const meta = mural.data?.meta ?? 0
  const agora = mural.dataUpdatedAt
  const destaques = useMemo(() => calcularDestaques(membros), [membros])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const lista = membros.filter(
      (m) =>
        !termo || m.nome.toLowerCase().includes(termo) || m.cargo.toLowerCase().includes(termo),
    )
    return ordem === 'nome' ? [...lista].sort((a, b) => a.nome.localeCompare(b.nome)) : lista
  }, [membros, busca, ordem])

  // Dados do membro aberto sempre atualizados (o mural recarrega a cada venda).
  const membroAberto = aberto ? (membros.find((m) => m.id === aberto.id) ?? aberto) : null

  if (mural.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Podio membros={membros} periodoLabel={periodoLabel} onAbrir={setAberto} />
        <QuadroDestaques destaques={destaques} periodoLabel={periodoLabel} onAbrir={setAberto} />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">Mural da equipe</h2>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Atualizado em tempo real · clique em uma pessoa para ver os detalhes
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative flex-1 sm:w-56 sm:flex-none">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar pessoa ou cargo"
                className="h-9 bg-card pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="inline-flex shrink-0 rounded-lg border bg-card p-1 text-sm">
              {(['ranking', 'nome'] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOrdem(o)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors',
                    ordem === o
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {o === 'ranking' && <Trophy className="size-3.5" />}
                  {o === 'ranking' ? 'Ranking' : 'A–Z'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {visiveis.length === 0 ? (
          <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            Ninguém encontrado com “{busca}”
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {visiveis.map((m) => (
              <CartaoMembro
                key={m.id}
                membro={m}
                meta={meta}
                selos={selosDoMembro(m, destaques, meta, agora).filter((s) => s.id !== 'posicao')}
                ehVoce={m.id === user?.id}
                onAbrir={() => setAberto(m)}
              />
            ))}
          </ul>
        )}
      </section>

      <DetalheMembro
        membro={membroAberto}
        selos={membroAberto ? selosDoMembro(membroAberto, destaques, meta, agora) : []}
        meta={meta}
        periodoLabel={periodoLabel}
        onFechar={() => setAberto(null)}
      />
    </div>
  )
}

// ---------------------------------------------------------------- Pódio

function Podio({
  membros,
  periodoLabel,
  onAbrir,
}: {
  membros: MembroMural[]
  periodoLabel: string
  onAbrir: (m: MembroMural) => void
}) {
  const porPosicao = (p: number) => membros.find((m) => m.posicao === p) ?? null
  // Ordem visual clássica: 2º, 1º, 3º.
  const lugares = ([2, 1, 3] as const).map((p) => ({ posicao: p, membro: porPosicao(p) }))
  const vazio = !porPosicao(1)

  return (
    <section className="relative flex flex-col overflow-hidden rounded-xl border bg-card p-5 shadow-sm">
      <Trophy
        aria-hidden
        className="pointer-events-none absolute -top-4 -right-4 size-28 rotate-12 text-amber-500/[0.07]"
      />
      <h2 className="font-heading text-lg font-semibold">Ranking de vendas</h2>
      <p className="text-xs text-muted-foreground">
        Faturamento por pessoa · {periodoLabel.toLowerCase()}
      </p>

      {vazio ? (
        <div className="my-auto flex flex-col items-center justify-center gap-2 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Wheat className="size-6 text-muted-foreground" />
          </span>
          <p className="font-medium">Nenhuma venda no período</p>
          <p className="text-sm text-muted-foreground">
            O ranking aparece a partir da primeira venda.
          </p>
        </div>
      ) : (
        <div className="mt-auto grid grid-cols-3 items-end gap-2 pt-5 sm:gap-3">
          {lugares.map(({ posicao, membro }) => (
            <div key={posicao} className="flex min-w-0 flex-col items-center">
              {membro ? (
                <button
                  type="button"
                  onClick={() => onAbrir(membro)}
                  className="group flex w-full min-w-0 flex-col items-center rounded-lg px-1 pb-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {posicao === 1 && (
                    <CoroaAnimada />
                  )}
                  <div className="relative transition-transform group-hover:-translate-y-0.5">
                    <Foto membro={membro} tamanho={posicao === 1 ? 'xl' : 'lg'} />
                    <SeloPosicao posicao={posicao} className="absolute -right-1 -bottom-1" />
                  </div>
                  <span className="mt-3 w-full truncate text-sm font-semibold">
                    {membro.nome.split(' ')[0]}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatBRL(membro.total_vendas)}
                  </span>
                </button>
              ) : (
                <div className="flex flex-col items-center pb-3 text-muted-foreground/60">
                  <span className="size-20 rounded-full border-2 border-dashed" />
                  <span className="mt-3 text-xs">Em aberto</span>
                </div>
              )}
              <div
                className={cn(
                  'flex w-full items-start justify-center rounded-t-md pt-1.5 text-sm font-semibold tabular-nums',
                  podio[posicao].degrau,
                )}
              >
                {posicao}º
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- Destaques

function QuadroDestaques({
  destaques,
  periodoLabel,
  onAbrir,
}: {
  destaques: Destaque[]
  periodoLabel: string
  onAbrir: (m: MembroMural) => void
}) {
  return (
    <section className="min-w-0 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-heading text-lg font-semibold">Destaques do período</h2>
      <p className="text-xs text-muted-foreground">
        Melhor resultado em cada categoria · {periodoLabel.toLowerCase()}
      </p>
      {/* Celular: rola para o lado; telas maiores: grade. */}
      <ul className="-mx-5 mt-4 flex snap-x gap-2.5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {destaques.map((d) => (
          <li key={d.id} className="w-60 shrink-0 snap-start sm:w-auto">
            <button
              type="button"
              disabled={!d.vencedor}
              onClick={() => d.vencedor && onAbrir(d.vencedor)}
              className={cn(
                'flex h-full w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                d.vencedor
                  ? 'bg-card hover:border-primary/40 hover:bg-muted/40'
                  : 'border-dashed bg-transparent',
              )}
            >
              <span className={cn(!d.vencedor && 'opacity-40 grayscale')}>
                <IconeSelo selo={d} tamanho="lg" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-tight font-medium">{d.titulo}</span>
                {d.vencedor ? (
                  <>
                    <span className="mt-1.5 flex items-center gap-1.5">
                      <Avatar nome={d.vencedor.nome} foto={d.vencedor.foto} tamanho="xs" />
                      <span className="truncate text-xs font-semibold">
                        {d.vencedor.nome.split(' ')[0]}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                      {d.resultado}
                    </span>
                  </>
                ) : (
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    Sem vencedor ainda
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------- Cartão

function BarraMeta({ vendido, meta }: { vendido: number; meta: number }) {
  const pct = Math.min(100, Math.round((vendido / meta) * 100))
  const atingida = pct >= 100
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span
          className={cn(
            'flex items-center gap-1',
            atingida && 'font-medium text-emerald-700 dark:text-emerald-400',
          )}
        >
          {atingida && <CircleCheck className="size-3" />}
          {atingida ? 'Meta do dia atingida' : 'Meta do dia'}
        </span>
        <span className="font-medium tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-700',
            atingida ? 'bg-emerald-500' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const MAX_SELOS_CARTAO = 4

function CartaoMembro({
  membro: m,
  meta,
  selos,
  ehVoce,
  onAbrir,
}: {
  membro: MembroMural
  meta: number
  selos: Selo[]
  ehVoce: boolean
  onAbrir: () => void
}) {
  const lugar = lugarDe(m.posicao)
  const extras = selos.length - MAX_SELOS_CARTAO

  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        className={cn(
          'relative flex h-full w-full flex-col items-center rounded-xl border bg-card px-3 pt-6 pb-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          ehVoce && 'border-primary/40',
        )}
      >
        {ehVoce && (
          <span className="absolute top-2.5 left-2.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            Você
          </span>
        )}
        {m.posicao &&
          (lugar ? (
            <SeloPosicao posicao={lugar} className="absolute top-2 right-2 size-6 text-[10px]" />
          ) : (
            <span className="absolute top-2.5 right-2.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
              {m.posicao}º
            </span>
          ))}

        <div className="relative">
          <Foto membro={m} tamanho="xl" />
          {/* Promoção: selo embaixo da foto. */}
          {m.promovido_em && (
            <span
              title={m.promovido_para ? `Promovido(a) a ${m.promovido_para}` : 'Promovido(a)'}
              className="absolute -bottom-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white shadow-sm ring-2 ring-card"
            >
              <TrendingUp className="size-3" />
              Promovido(a)
            </span>
          )}
        </div>

        <p className="mt-4 line-clamp-1 font-semibold">{m.nome || 'Sem nome'}</p>
        <p className="line-clamp-1 text-sm text-muted-foreground">{m.cargo || 'Sem cargo'}</p>
        <p className="mt-0.5 text-[10px] font-medium tracking-wider text-muted-foreground/80 uppercase">
          {papelLabels[m.papel]}
        </p>

        {selos.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1">
            {selos.slice(0, MAX_SELOS_CARTAO).map((s) => (
              <IconeSelo key={s.id} selo={s} />
            ))}
            {extras > 0 && (
              <span className="px-1 text-xs font-medium text-muted-foreground">+{extras}</span>
            )}
          </div>
        )}

        <div className="mt-auto w-full space-y-2.5 pt-3">
          <div className="flex items-baseline justify-between border-t pt-2.5 text-left">
            <span className="text-[11px] text-muted-foreground">
              {m.vendas} venda{m.vendas === 1 ? '' : 's'}
            </span>
            <span className="text-sm font-semibold tabular-nums">{formatBRL(m.total_vendas)}</span>
          </div>
          {meta > 0 && <BarraMeta vendido={m.vendido_hoje} meta={meta} />}
        </div>
      </button>
    </li>
  )
}

// ---------------------------------------------------------------- Detalhes

function DetalheMembro({
  membro: m,
  selos,
  meta,
  periodoLabel,
  onFechar,
}: {
  membro: MembroMural | null
  selos: Selo[]
  meta: number
  periodoLabel: string
  onFechar: () => void
}) {
  const porFamilia = m ? vendasPorFamilia(m) : {}
  const totalFamilias = Object.values(porFamilia).reduce((s, v) => s + (v ?? 0), 0)
  const topProdutos = m ? [...m.produtos].sort((a, b) => b.total - a.total).slice(0, 3) : []
  const lugar = m ? lugarDe(m.posicao) : null

  const numeros: [LucideIcon, string, string][] = m
    ? [
        [Wallet, 'Faturamento', formatBRL(m.total_vendas)],
        [Receipt, 'Vendas', String(m.vendas)],
        [Gem, 'Ticket médio', formatBRL(ticketMedio(m))],
        [ShoppingBasket, 'Itens', formatQuantidade(itensVendidos(m))],
      ]
    : []

  return (
    <Dialog open={Boolean(m)} onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        {m && (
          <>
            <DialogHeader className="items-center text-center sm:text-center">
              <div className="relative mx-auto">
                <Foto membro={m} tamanho="xl" />
                {lugar && <SeloPosicao posicao={lugar} className="absolute -right-1 -bottom-1" />}
              </div>
              <DialogTitle className="mt-3 text-xl">{m.nome || 'Sem nome'}</DialogTitle>
              <DialogDescription>
                {m.cargo || 'Sem cargo'} · {papelLabels[m.papel]}
                {m.posicao && ` · ${m.posicao}º em vendas`}
              </DialogDescription>
            </DialogHeader>

            <div>
              <div className="grid grid-cols-2 gap-2">
                {numeros.map(([Icone, rotulo, valor]) => (
                  <div key={rotulo} className="rounded-lg border p-3">
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Icone className="size-3.5" />
                      {rotulo}
                    </p>
                    <p className="mt-0.5 font-semibold tabular-nums">{valor}</p>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                Período: {periodoLabel.toLowerCase()}
              </p>
            </div>

            {meta > 0 && <BarraMeta vendido={m.vendido_hoje} meta={meta} />}

            <div>
              <h3 className="mb-2 text-sm font-semibold">Conquistas</h3>
              {selos.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                  Nenhuma conquista no período.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {selos.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 p-2.5">
                      <IconeSelo selo={s} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{s.titulo}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {s.criterio}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {totalFamilias > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Vendas por categoria</h3>
                <ul className="space-y-2.5">
                  {(Object.entries(porFamilia) as [Familia, number][])
                    .sort((a, b) => b[1] - a[1])
                    .map(([familia, valor]) => {
                      const Icone = familias[familia].icone
                      return (
                        <li key={familia} className="text-sm">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Icone className="size-3.5 text-muted-foreground" />
                              {familias[familia].nome}
                            </span>
                            <span className="font-medium tabular-nums">{formatBRL(valor)}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.round((valor / totalFamilias) * 100)}%` }}
                            />
                          </div>
                        </li>
                      )
                    })}
                </ul>
                {topProdutos.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Mais vendidos: {topProdutos.map((p) => p.nome).join(', ')}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
