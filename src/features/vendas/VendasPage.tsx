import {
  Banknote,
  ChevronRight,
  CreditCard,
  Gem,
  Loader2,
  QrCode,
  Receipt,
  Undo2,
  SearchX,
  Search,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Avatar } from '@/components/Avatar'
import { IconeProduto } from '@/components/IconeProduto'
import { Button } from '@/components/ui/button'
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
import { ComprovanteDialog } from '@/features/pdv/ComprovanteDialog'
import type { Comprovante } from '@/features/pdv/comprovante'
import { lojaDoComprovante, usePadaria } from '@/features/padaria/api'
import { useDevolverVenda, useHistoricoVendas, useVenda } from '@/features/vendas/api'
import { formatBRL, formatQuantidade, inicioDoDiaISO } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { FormaPagamento, VendaDetalhe, VendaHistorico } from '@/types/database'

const formas: { value: FormaPagamento; label: string; icone: LucideIcon }[] = [
  { value: 'dinheiro', label: 'Dinheiro', icone: Banknote },
  { value: 'pix', label: 'Pix', icone: QrCode },
  { value: 'cartao_debito', label: 'Débito', icone: CreditCard },
  { value: 'cartao_credito', label: 'Crédito', icone: CreditCard },
]
const formaPorValor = Object.fromEntries(formas.map((f) => [f.value, f]))
const nomeCompletoForma: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_debito: 'Cartão de débito',
  cartao_credito: 'Cartão de crédito',
}

type Periodo = 'hoje' | 'ontem' | '7d' | '30d' | 'mes' | 'personalizado'

const periodos: { key: Periodo; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'ontem', label: 'Ontem' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: 'mes', label: 'Este mês' },
  { key: 'personalizado', label: 'Escolher datas' },
]

// 'YYYY-MM-DD' (campo de data) no fuso local.
function dataLocal(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

function paraCampo(data: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`
}

// Intervalo [desde, ate) em ISO, sempre de dias inteiros no horário da padaria.
function intervalo(periodo: Periodo, de: string, ateDia: string) {
  const hoje = new Date(inicioDoDiaISO())
  const amanha = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1)
  const diasAtras = (n: number) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n)
  switch (periodo) {
    case 'hoje':
      return [hoje, amanha]
    case 'ontem':
      return [diasAtras(1), hoje]
    case '7d':
      return [diasAtras(6), amanha]
    case '30d':
      return [diasAtras(29), amanha]
    case 'mes':
      return [new Date(hoje.getFullYear(), hoje.getMonth(), 1), amanha]
    case 'personalizado': {
      const inicio = dataLocal(de)
      const fim = dataLocal(ateDia)
      return [inicio, new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() + 1)]
    }
  }
}

function numero(id: string) {
  return id.slice(0, 8).toUpperCase()
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function rotuloDia(data: Date) {
  const hoje = new Date()
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1)
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const extenso = data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  if (mesmoDia(data, hoje)) return `Hoje · ${extenso}`
  if (mesmoDia(data, ontem)) return `Ontem · ${extenso}`
  return extenso.charAt(0).toUpperCase() + extenso.slice(1)
}

export function VendasPage() {
  const [periodo, setPeriodo] = useState<Periodo>('hoje')
  const [de, setDe] = useState(() => paraCampo(new Date()))
  const [ateDia, setAteDia] = useState(() => paraCampo(new Date()))
  const [busca, setBusca] = useState('')
  const [forma, setForma] = useState<FormaPagamento | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const [comprovante, setComprovante] = useState<Comprovante | null>(null)

  // A busca espera a pessoa parar de digitar (300 ms) para não consultar a cada letra.
  const [buscaAdiada, setBuscaAdiada] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setBuscaAdiada(busca), 300)
    return () => clearTimeout(t)
  }, [busca])
  const [desde, ate] = intervalo(periodo, de, ateDia)
  const filtros = {
    desde: desde.toISOString(),
    ate: ate.toISOString(),
    busca: buscaAdiada,
    forma,
  }
  const historico = useHistoricoVendas(filtros)
  const padaria = usePadaria()

  // Fotos de quem vendeu (o mural já tem a equipe toda).
  const hojeISO = useMemo(() => inicioDoDiaISO(), [])
  const mural = useMural(hojeISO, hojeISO)
  const fotos = useMemo(
    () => new Map((mural.data?.membros ?? []).map((m) => [m.id, m.foto])),
    [mural.data],
  )

  const paginas = historico.data?.pages ?? []
  const vendas = paginas.flatMap((p) => p.vendas)
  const totais = paginas[0]?.totais ?? null

  // Agrupa por dia, mantendo a ordem (mais recente primeiro).
  const dias = useMemo(() => {
    const grupos: {
      chave: string
      data: Date
      vendas: VendaHistorico[]
      total: number
      quantidade: number
    }[] = []
    for (const v of vendas) {
      const data = new Date(v.created_at)
      const chave = data.toDateString()
      let grupo = grupos.at(-1)
      if (!grupo || grupo.chave !== chave) {
        grupo = { chave, data, vendas: [], total: 0, quantidade: 0 }
        grupos.push(grupo)
      }
      grupo.vendas.push(v)
      // Devolvida aparece na lista, mas não soma.
      if (v.status !== 'devolvida') {
        grupo.total += v.total
        grupo.quantidade += 1
      }
    }
    return grupos
  }, [vendas])

  // Fecha os detalhes e abre o comprovante (duas janelas ao mesmo tempo brigam pelo foco).
  function emitir(venda: VendaDetalhe) {
    setAberta(null)
    setComprovante({
      vendaId: venda.id,
      quando: venda.created_at,
      itens: venda.itens.map((i) => ({
        nome: i.nome,
        quantidade: i.quantidade,
        unidade: i.unidade,
        precoUnitario: i.preco_unitario,
      })),
      total: venda.total,
      formaPagamento: nomeCompletoForma[venda.forma_pagamento],
      recebido: venda.valor_recebido,
      atendente: venda.vendedor_nome,
      segundaVia: true,
      loja: lojaDoComprovante(padaria.data),
    })
  }

  const stats = [
    { icone: Wallet, label: 'Faturamento', valor: totais ? formatBRL(totais.total) : null },
    { icone: Receipt, label: 'Vendas', valor: totais ? String(totais.quantidade) : null },
    {
      icone: Gem,
      label: 'Ticket médio',
      valor: totais ? formatBRL(totais.quantidade ? totais.total / totais.quantidade : 0) : null,
    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vendas</h1>
        <p className="text-sm text-muted-foreground">
          Histórico de vendas e emissão de 2ª via do comprovante
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border bg-card p-3 shadow-sm sm:p-4">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Nº do comprovante, produto ou quem vendeu"
            className="h-10 pr-9 pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              aria-label="Limpar busca"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {periodos.map((p) => (
            <Chip key={p.key} ativo={periodo === p.key} onClick={() => setPeriodo(p.key)}>
              {p.label}
            </Chip>
          ))}
        </div>

        {periodo === 'personalizado' && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              De
              <Input
                type="date"
                className="h-9 w-auto"
                value={de}
                max={ateDia}
                onChange={(e) => e.target.value && setDe(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2">
              até
              <Input
                type="date"
                className="h-9 w-auto"
                value={ateDia}
                min={de}
                max={paraCampo(new Date())}
                onChange={(e) => e.target.value && setAteDia(e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip ativo={forma === null} onClick={() => setForma(null)}>
            Todas as formas
          </Chip>
          {formas.map((f) => (
            <Chip key={f.value} ativo={forma === f.value} onClick={() => setForma(f.value)}>
              <f.icone className="size-3.5" />
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3 shadow-sm">
            <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground sm:text-xs">
              <s.icone className="size-3.5 shrink-0" />
              {s.label}
            </p>
            <p className="mt-0.5 truncate text-base font-bold tabular-nums sm:text-xl">
              {s.valor ?? <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            </p>
          </div>
        ))}
      </div>

      {totais && totais.devolvidas > 0 && (
        <p className="-mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Undo2 className="size-3.5 shrink-0" />
          {totais.devolvidas === 1 ? '1 devolução' : `${totais.devolvidas} devoluções`} no
          período ({formatBRL(totais.total_devolvido)}), já fora do faturamento
        </p>
      )}

      {historico.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : vendas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted">
            <SearchX className="size-6 text-muted-foreground" />
          </span>
          <p className="font-medium">Nenhuma venda encontrada</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            {busca || forma
              ? 'Tente outra busca, outra forma de pagamento ou um período maior.'
              : 'Nesse período ainda não houve vendas.'}
          </p>
        </div>
      ) : (
        <div
          className={cn(
            'space-y-5 transition-opacity',
            historico.isPlaceholderData && 'opacity-60',
          )}
        >
          {dias.map((dia) => (
            <section key={dia.chave}>
              <div className="sticky top-0 z-10 -mx-1 mb-2 flex items-baseline justify-between bg-background/95 px-1 py-1.5 backdrop-blur">
                <h2 className="text-sm font-semibold">{rotuloDia(dia.data)}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {dia.quantidade} venda{dia.quantidade === 1 ? '' : 's'} ·{' '}
                  <span className="font-semibold text-foreground">{formatBRL(dia.total)}</span>
                </span>
              </div>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
                {dia.vendas.map((v) => (
                  <li key={v.id}>
                    <LinhaVenda
                      venda={v}
                      foto={v.created_by ? (fotos.get(v.created_by) ?? null) : null}
                      onAbrir={() => setAberta(v.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {historico.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => historico.fetchNextPage()}
                disabled={historico.isFetchingNextPage}
              >
                {historico.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
                Carregar mais vendas
              </Button>
            </div>
          )}
        </div>
      )}

      {/* key: cada venda aberta começa sem a confirmação de devolução. */}
      <DetalheVenda key={aberta ?? ''} id={aberta} onFechar={() => setAberta(null)} onEmitir={emitir} />
      <ComprovanteDialog
        key={comprovante?.vendaId}
        comprovante={comprovante}
        onClose={() => setComprovante(null)}
      />
    </div>
  )
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
        ativo
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function LinhaVenda({
  venda: v,
  foto,
  onAbrir,
}: {
  venda: VendaHistorico
  foto: string | null
  onAbrir: () => void
}) {
  const forma = formaPorValor[v.forma_pagamento]
  const devolvida = v.status === 'devolvida'
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-4',
        devolvida && 'bg-muted/30',
      )}
    >
      <span
        title={forma?.label}
        className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-muted-foreground"
      >
        {forma ? <forma.icone className="size-4" /> : <Receipt className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2 text-sm">
          <span className="font-semibold tabular-nums">{hora(v.created_at)}</span>
          <span className="font-mono text-xs text-muted-foreground">Nº {numero(v.id)}</span>
          {devolvida && <SeloDevolvida />}
        </span>
        <span className="block truncate text-sm text-muted-foreground">{v.resumo ?? '—'}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Avatar nome={v.vendedor_nome ?? '?'} foto={foto} tamanho="xs" />
          <span className="truncate">
            Vendido por{' '}
            <span className="font-medium text-foreground">{v.vendedor_nome ?? '—'}</span>
          </span>
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span
          className={cn(
            'block font-semibold tabular-nums',
            devolvida && 'text-muted-foreground line-through',
          )}
        >
          {formatBRL(v.total)}
        </span>
        <span className="block text-[11px] text-muted-foreground">
          {v.qtd_itens} {v.qtd_itens === 1 ? 'item' : 'itens'} · {forma?.label}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
    </button>
  )
}

function DetalheVenda({
  id,
  onFechar,
  onEmitir,
}: {
  id: string | null
  onFechar: () => void
  onEmitir: (venda: VendaDetalhe) => void
}) {
  const { data: venda, isLoading, isError } = useVenda(id)
  const quando = venda ? new Date(venda.created_at) : null
  const { user } = useAuth()
  // Devolução: só dono e gerência (fica registrado quem fez).
  const podeDevolver = user?.papel === 'dono' || user?.papel === 'admin'
  const devolver = useDevolverVenda()
  const [confirmando, setConfirmando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function confirmarDevolucao() {
    if (!venda) return
    if (!motivo.trim()) {
      setErro('Conte rapidinho o motivo (ex.: cliente desistiu da compra)')
      return
    }
    setErro(null)
    try {
      await devolver.mutateAsync({ id: venda.id, motivo: motivo.trim() })
      setConfirmando(false)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível devolver a venda')
    }
  }

  return (
    <Dialog open={Boolean(id)} onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-5 text-primary" />
            Venda Nº {id ? numero(id) : ''}
          </DialogTitle>
          <DialogDescription>
            {quando
              ? `${quando.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} às ${hora(venda!.created_at)}`
              : ' '}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Loader2 className="mx-auto my-10 size-6 animate-spin text-muted-foreground" />
        ) : isError || !venda ? (
          <p className="py-6 text-center text-sm text-destructive">
            Não foi possível abrir esta venda.
          </p>
        ) : (
          <div className="space-y-4">
            {venda.status === 'devolvida' && (
              <div className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Undo2 className="size-4" />
                  Venda devolvida
                </p>
                <p>
                  {venda.devolvida_em &&
                    `Em ${new Date(venda.devolvida_em).toLocaleDateString('pt-BR')} às ${hora(venda.devolvida_em)}`}
                  {venda.devolvida_por_nome && `, por ${venda.devolvida_por_nome}`}. Os produtos
                  voltaram ao estoque e o valor não conta no faturamento.
                </p>
                {venda.motivo_devolucao && (
                  <p>
                    <span className="font-medium">Motivo:</span> {venda.motivo_devolucao}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
              <Avatar nome={venda.vendedor_nome ?? '?'} foto={venda.vendedor_foto} tamanho="md" />
              <div className="text-sm">
                <p className="text-xs text-muted-foreground">Vendido por</p>
                <p className="font-semibold">{venda.vendedor_nome ?? '—'}</p>
              </div>
            </div>

            <ul className="space-y-2">
              {venda.itens.map((i) => (
                <li key={i.id} className="flex items-center gap-3">
                  <IconeProduto produto={i} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{i.nome}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatQuantidade(i.quantidade)} {i.unidade} × {formatBRL(i.preco_unitario)}
                    </span>
                  </span>
                  <span className="text-sm font-medium tabular-nums">{formatBRL(i.subtotal)}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-1.5 rounded-xl border p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pagamento</span>
                <span className="font-medium">{nomeCompletoForma[venda.forma_pagamento]}</span>
              </div>
              {venda.valor_recebido != null && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor recebido</span>
                    <span className="tabular-nums">{formatBRL(venda.valor_recebido)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Troco</span>
                    <span className="tabular-nums">
                      {formatBRL(venda.valor_recebido - venda.total)}
                    </span>
                  </div>
                </>
              )}
              <div className="flex items-baseline justify-between border-t pt-2">
                <span className="font-semibold">Total</span>
                <span
                  className={cn(
                    'font-heading text-2xl font-bold tabular-nums',
                    venda.status === 'devolvida' && 'text-muted-foreground line-through',
                  )}
                >
                  {formatBRL(venda.total)}
                </span>
              </div>
            </div>

            {venda.status !== 'devolvida' && (
              <Button className="h-11 w-full text-base" onClick={() => onEmitir(venda)}>
                <Receipt className="size-4" />
                Emitir comprovante (2ª via)
              </Button>
            )}

            {venda.status !== 'devolvida' &&
              podeDevolver &&
              (confirmando ? (
                <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
                  <div className="text-sm">
                    <p className="font-semibold">Devolver esta venda?</p>
                    <p className="text-muted-foreground">
                      {venda.itens.length === 1 ? 'O produto volta' : 'Os produtos voltam'} para o
                      estoque e {formatBRL(venda.total)} sai do faturamento. A venda continua no
                      histórico, marcada como devolvida.
                    </p>
                  </div>
                  <Input
                    autoFocus
                    placeholder="Motivo (ex.: cliente desistiu da compra)"
                    value={motivo}
                    maxLength={255}
                    onChange={(e) => setMotivo(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmarDevolucao()}
                  />
                  {erro && <p className="text-sm text-destructive">{erro}</p>}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setConfirmando(false)}
                      disabled={devolver.isPending}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={confirmarDevolucao}
                      disabled={devolver.isPending}
                    >
                      {devolver.isPending && <Loader2 className="size-4 animate-spin" />}
                      Confirmar devolução
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => setConfirmando(true)}>
                  <Undo2 className="size-4" />
                  Devolver venda
                </Button>
              ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SeloDevolvida() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
      Devolvida
    </span>
  )
}
