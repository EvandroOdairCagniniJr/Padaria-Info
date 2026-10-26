import {
  Banknote,
  CreditCard,
  Loader2,
  Lock,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingBasket,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar } from '@/components/Avatar'
import { IconeCategoria, IconeProduto } from '@/components/IconeProduto'
import { Button } from '@/components/ui/button'
import { VendaConcluida } from '@/components/VendaConcluida'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/AuthContext'
import { useCaixaAtual } from '@/features/caixa/api'
import { useFinalizarVenda } from '@/features/pdv/api'
import { lojaDoComprovante, usePadaria } from '@/features/padaria/api'
import { ComprovanteDialog } from '@/features/pdv/ComprovanteDialog'
import type { Comprovante } from '@/features/pdv/comprovante'
import { useProdutos } from '@/features/produtos/api'
import { api } from '@/lib/api'
import { formatBRL, formatQuantidade, inicioDoDiaISO, mensagemErro } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { FormaPagamento, Produto } from '@/types/database'

interface CartLine {
  produto: Produto
  quantidade: number
}

const formasPagamento: { value: FormaPagamento; label: string; curto: string; icon: LucideIcon }[] =
  [
    { value: 'dinheiro', label: 'Dinheiro', curto: 'Dinheiro', icon: Banknote },
    { value: 'pix', label: 'Pix', curto: 'Pix', icon: QrCode },
    { value: 'cartao_debito', label: 'Cartão de débito', curto: 'Débito', icon: CreditCard },
    { value: 'cartao_credito', label: 'Cartão de crédito', curto: 'Crédito', icon: CreditCard },
  ]

// "10", "10,50" ou "10.50" → número; vazio/inválido → null.
function lerValor(texto: string) {
  const n = Number(texto.replace(',', '.'))
  return texto.trim() && Number.isFinite(n) ? n : null
}

function arredondar(valor: number) {
  return Math.round(valor * 100) / 100
}

// Atalhos de dinheiro: valor exato e as notas mais prováveis que o cliente entrega.
function sugestoesDinheiro(total: number) {
  if (total <= 0) return []
  const opcoes = new Set<number>([total])
  for (const passo of [5, 10, 50]) opcoes.add(Math.ceil(total / passo) * passo)
  for (const nota of [2, 5, 10, 20, 50, 100, 200]) if (nota > total) opcoes.add(nota)
  return [...opcoes].sort((a, b) => a - b).slice(0, 4)
}

export function PdvPage() {
  const { data: produtos, isLoading } = useProdutos()
  const finalizarVenda = useFinalizarVenda()
  const caixa = useCaixaAtual()
  const padaria = usePadaria()
  const { user } = useAuth()
  const buscaRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('dinheiro')
  const [recebido, setRecebido] = useState('')
  const [comprovante, setComprovante] = useState<Comprovante | null>(null)
  // Comemoração da venda: aparece antes do comprovante.
  const [celebracao, setCelebracao] = useState<{ total: number; bateuMeta: boolean } | null>(
    null,
  )
  const [carrinhoMobileAberto, setCarrinhoMobileAberto] = useState(false)

  const categorias = useMemo(
    () =>
      [
        ...new Set((produtos ?? []).map((p) => p.categoria?.trim()).filter(Boolean) as string[]),
      ].sort((a, b) => a.localeCompare(b)),
    [produtos],
  )

  const produtosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (produtos ?? []).filter(
      (p) =>
        (!categoria || p.categoria?.trim() === categoria) &&
        (!term || p.nome.toLowerCase().includes(term)),
    )
  }, [produtos, search, categoria])

  // O pedido guarda o produto de quando foi adicionado; preço e estoque vêm sempre do cadastro
  // atual (que se atualiza sozinho), assim o total na tela é o mesmo que o servidor cobra.
  const pedido = useMemo(() => {
    const porId = new Map((produtos ?? []).map((p) => [p.id, p]))
    return cart.map((line) => ({ ...line, produto: porId.get(line.produto.id) ?? line.produto }))
  }, [cart, produtos])

  const total = arredondar(
    pedido.reduce((sum, line) => sum + line.produto.preco_venda * line.quantidade, 0),
  )
  const qtdItens = pedido.reduce((sum, line) => sum + line.quantidade, 0)
  const qtdNoCarrinho = useMemo(
    () => new Map(cart.map((line) => [line.produto.id, line.quantidade])),
    [cart],
  )

  function addToCart(produto: Produto) {
    setCart((prev) => {
      const existing = prev.find((line) => line.produto.id === produto.id)
      if (existing) {
        return prev.map((line) =>
          line.produto.id === produto.id ? { ...line, quantidade: line.quantidade + 1 } : line,
        )
      }
      return [...prev, { produto, quantidade: 1 }]
    })
  }

  function updateQuantidade(produtoId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((line) =>
          line.produto.id === produtoId ? { ...line, quantidade: line.quantidade + delta } : line,
        )
        .filter((line) => line.quantidade > 0),
    )
  }

  // Quantidade digitada (ex: 0,350 kg de pão de queijo); zero tira do pedido.
  function setQuantidade(produtoId: string, quantidade: number) {
    setCart((prev) =>
      prev
        .map((line) => (line.produto.id === produtoId ? { ...line, quantidade } : line))
        .filter((line) => line.quantidade > 0),
    )
  }

  function removeFromCart(produtoId: string) {
    setCart((prev) => prev.filter((line) => line.produto.id !== produtoId))
  }

  function limparPedido() {
    setCart([])
    setRecebido('')
    setFormaPagamento('dinheiro')
  }

  async function handleFinalizar() {
    if (cart.length === 0 || finalizarVenda.isPending) return
    const valorRecebido = formaPagamento === 'dinheiro' ? lerValor(recebido) : null
    if (valorRecebido !== null && valorRecebido < total) {
      toast.error(`Valor recebido menor que o total (faltam ${formatBRL(total - valorRecebido)})`)
      return
    }
    try {
      const venda = await finalizarVenda.mutateAsync({
        itens: pedido.map((line) => ({
          produto_id: line.produto.id,
          quantidade: line.quantidade,
        })),
        formaPagamento,
        recebido: valorRecebido,
      })
      setComprovante({
        vendaId: venda.id,
        quando: new Date().toISOString(),
        itens: pedido.map((line) => ({
          nome: line.produto.nome,
          quantidade: line.quantidade,
          unidade: line.produto.unidade,
          precoUnitario: line.produto.preco_venda,
        })),
        total: venda.total,
        formaPagamento:
          formasPagamento.find((f) => f.value === formaPagamento)?.label ?? formaPagamento,
        recebido: valorRecebido,
        atendente: user?.nome || null,
        loja: lojaDoComprovante(padaria.data),
      })
      // Esta venda fez a pessoa passar da meta do dia? (falha aqui não atrapalha a venda)
      const c = await api
        .get<{ meta: number; vendidoHoje: number }>(
          `/conquistas?desde=${encodeURIComponent(inicioDoDiaISO())}`,
        )
        .catch(() => null)
      const bateuMeta = Boolean(
        c && c.meta > 0 && c.vendidoHoje >= c.meta && c.vendidoHoje - venda.total < c.meta,
      )
      setCelebracao({ total: venda.total, bateuMeta })
      limparPedido()
      setCarrinhoMobileAberto(false)
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao finalizar venda'))
    }
  }

  // Atalho do balcão: F2 finaliza de qualquer lugar da tela.
  const finalizarRef = useRef(handleFinalizar)
  useEffect(() => {
    finalizarRef.current = handleFinalizar
  })
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault()
        finalizarRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const painel = (
    <CarrinhoPainel
      cart={pedido}
      qtdItens={qtdItens}
      total={total}
      formaPagamento={formaPagamento}
      onFormaPagamento={setFormaPagamento}
      recebido={recebido}
      onRecebido={setRecebido}
      onQuantidade={updateQuantidade}
      onDefinirQuantidade={setQuantidade}
      onRemover={removeFromCart}
      onLimpar={limparPedido}
      onFinalizar={handleFinalizar}
      finalizando={finalizarVenda.isPending}
    />
  )

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-h-0 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Balcão</h1>
              {/* Quem está logado: as vendas saem no nome desta pessoa. */}
              {user && (
                <span className="flex items-center gap-1.5 rounded-full border bg-card py-0.5 pr-3 pl-0.5 text-xs">
                  <Avatar nome={user.nome || user.email} foto={user.foto} tamanho="sm" />
                  <span>
                    Vendendo como <span className="font-semibold">{user.nome || user.email}</span>
                  </span>
                </span>
              )}
              {caixa.data && !caixa.data.caixa && (
                <Link
                  to="/caixa"
                  className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                >
                  <Lock className="size-3.5" />
                  Caixa fechado — abrir caixa
                </Link>
              )}
            </div>
            <p className="hidden text-sm text-muted-foreground sm:block">
              Enter adiciona o primeiro da busca · F2 finaliza a venda ·{' '}
              <Link to="/vendas" className="font-medium text-primary hover:underline">
                Vendas anteriores e 2ª via
              </Link>
            </p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={buscaRef}
              autoFocus
              placeholder="Buscar pão, bolo, café..."
              className="h-10 bg-card pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim() && produtosFiltrados.length > 0) {
                  e.preventDefault()
                  addToCart(produtosFiltrados[0])
                  setSearch('')
                }
                if (e.key === 'Escape') setSearch('')
              }}
            />
          </div>
        </div>

        {categorias.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[null, ...categorias].map((c) => (
              <button
                key={c ?? 'todos'}
                type="button"
                onClick={() => {
                  setCategoria(c)
                  buscaRef.current?.focus()
                }}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border py-1 pr-3 pl-1.5 text-sm font-medium transition-colors',
                  !c && 'pl-3',
                  categoria === c
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
                )}
              >
                {c && <IconeCategoria categoria={c} tamanho="xs" className="rounded-full" />}
                {c ?? 'Todos'}
              </button>
            ))}
          </div>
        )}

        {/* Só a vitrine rola; pb extra no celular por causa da barra fixa do pedido. */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-24 lg:pb-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {produtosFiltrados.map((produto) => {
                const noCarrinho = qtdNoCarrinho.get(produto.id)
                return (
                  <button
                    key={produto.id}
                    type="button"
                    onClick={() => addToCart(produto)}
                    className={cn(
                      'relative flex flex-col items-start gap-2 rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md active:translate-y-0',
                      noCarrinho && 'border-primary ring-1 ring-primary/30',
                    )}
                  >
                    {noCarrinho && (
                      <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {formatQuantidade(noCarrinho)}
                      </span>
                    )}
                    <IconeProduto produto={produto} tamanho="lg" />
                    <span className="line-clamp-2 text-sm leading-snug font-medium">
                      {produto.nome}
                    </span>
                    <div className="mt-auto flex w-full items-baseline justify-between gap-1">
                      <span className="font-semibold text-primary">
                        {formatBRL(produto.preco_venda)}
                      </span>
                      <span
                        className={cn(
                          'text-xs',
                          produto.estoque_atual <= 0 ? 'text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {formatQuantidade(produto.estoque_atual)} {produto.unidade}
                      </span>
                    </div>
                  </button>
                )
              })}

              {produtosFiltrados.length === 0 && (
                <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <aside className="hidden min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm lg:flex">
        {painel}
      </aside>

      {/* Celular/tablet: barra fixa com o total; o pedido abre por cima. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t bg-card p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] lg:hidden">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">
            {qtdItens ? `${formatQuantidade(qtdItens)} item(ns)` : 'Pedido vazio'}
          </div>
          <div className="text-lg font-bold">{formatBRL(total)}</div>
        </div>
        <Button
          size="lg"
          className="h-11 px-4"
          disabled={cart.length === 0}
          onClick={() => setCarrinhoMobileAberto(true)}
        >
          <ShoppingBasket className="size-4" />
          Ver pedido e finalizar
        </Button>
      </div>

      <Dialog open={carrinhoMobileAberto} onOpenChange={setCarrinhoMobileAberto}>
        <DialogContent className="flex h-[90svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogTitle className="sr-only">Pedido</DialogTitle>
          {painel}
        </DialogContent>
      </Dialog>

      {celebracao && (
        <VendaConcluida
          total={celebracao.total}
          bateuMeta={celebracao.bateuMeta}
          onFim={() => setCelebracao(null)}
        />
      )}
      <ComprovanteDialog
        key={comprovante?.vendaId}
        comprovante={celebracao ? null : comprovante}
        onClose={() => {
          setComprovante(null)
          buscaRef.current?.focus()
        }}
      />
    </div>
  )
}

interface CarrinhoPainelProps {
  cart: CartLine[]
  qtdItens: number
  total: number
  formaPagamento: FormaPagamento
  onFormaPagamento: (forma: FormaPagamento) => void
  recebido: string
  onRecebido: (valor: string) => void
  onQuantidade: (produtoId: string, delta: number) => void
  onDefinirQuantidade: (produtoId: string, quantidade: number) => void
  onRemover: (produtoId: string) => void
  onLimpar: () => void
  onFinalizar: () => void
  finalizando: boolean
}

// Itens rolam no meio; pagamento, total e "Finalizar" ficam sempre visíveis embaixo.
function CarrinhoPainel({
  cart,
  qtdItens,
  total,
  formaPagamento,
  onFormaPagamento,
  recebido,
  onRecebido,
  onQuantidade,
  onDefinirQuantidade,
  onRemover,
  onLimpar,
  onFinalizar,
  finalizando,
}: CarrinhoPainelProps) {
  const emDinheiro = formaPagamento === 'dinheiro'
  const valorRecebido = emDinheiro ? lerValor(recebido) : null
  const troco = valorRecebido !== null ? arredondar(valorRecebido - total) : null
  const faltaDinheiro = troco !== null && troco < 0
  const vazio = cart.length === 0

  return (
    <>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <ShoppingBasket className="size-5 text-primary" />
          Pedido
          {qtdItens > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({formatQuantidade(qtdItens)})
            </span>
          )}
        </h2>
        {!vazio && (
          <Button variant="ghost" size="sm" onClick={onLimpar} disabled={finalizando}>
            Limpar
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {vazio && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <ShoppingBasket className="size-10 opacity-30" />
            Toque nos produtos para montar o pedido
          </div>
        )}

        {cart.map((line) => (
          <LinhaPedido
            key={line.produto.id}
            line={line}
            onQuantidade={onQuantidade}
            onDefinirQuantidade={onDefinirQuantidade}
            onRemover={onRemover}
          />
        ))}
      </div>

      <div className="space-y-3 border-t bg-muted/30 p-4">
        <fieldset disabled={finalizando} className="space-y-3">
          <legend className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Forma de pagamento
          </legend>
          <div className="grid grid-cols-4 gap-1.5">
            {formasPagamento.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={formaPagamento === f.value}
                onClick={() => onFormaPagamento(f.value)}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50',
                  formaPagamento === f.value
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
                )}
              >
                <f.icon className="size-5" />
                {f.curto}
              </button>
            ))}
          </div>

          {emDinheiro && (
            <div className="space-y-2">
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  inputMode="decimal"
                  placeholder="Valor recebido"
                  aria-label="Valor recebido em dinheiro"
                  className="h-11 bg-card pl-9 text-base"
                  value={recebido}
                  onChange={(e) => onRecebido(e.target.value.replace(/[^\d.,]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && onFinalizar()}
                />
              </div>
              {!vazio && (
                <div className="flex flex-wrap gap-1.5">
                  {sugestoesDinheiro(total).map((valor, i) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => onRecebido(valor.toFixed(2).replace('.', ','))}
                      className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/60 hover:text-primary"
                    >
                      {i === 0 ? 'Exato' : formatBRL(valor)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </fieldset>

        <div className="rounded-lg border bg-card p-3" aria-live="polite">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-muted-foreground">Total</span>
            {/* key: cada mudança no total recria o número e dispara o "pulo". */}
            <span key={total} className="total-pulso font-heading text-3xl font-bold tabular-nums">
              {formatBRL(total)}
            </span>
          </div>
          {troco !== null && !vazio && (
            <div
              className={cn(
                'mt-2 flex items-baseline justify-between gap-2 border-t pt-2',
                faltaDinheiro ? 'text-destructive' : 'text-emerald-700 dark:text-emerald-400',
              )}
            >
              <span className="text-sm font-medium">{faltaDinheiro ? 'Falta' : 'Troco'}</span>
              <span className="text-xl font-bold tabular-nums">{formatBRL(Math.abs(troco))}</span>
            </div>
          )}
        </div>

        <Button
          className="h-12 w-full text-base"
          disabled={vazio || finalizando || faltaDinheiro}
          onClick={onFinalizar}
        >
          {finalizando ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Registrando...
            </>
          ) : faltaDinheiro ? (
            'Valor recebido insuficiente'
          ) : (
            <>
              Finalizar venda
              <kbd className="ml-1 hidden rounded bg-primary-foreground/20 px-1.5 text-xs font-normal lg:inline">
                F2
              </kbd>
            </>
          )}
        </Button>
      </div>
    </>
  )
}

interface LinhaPedidoProps {
  line: CartLine
  onQuantidade: (produtoId: string, delta: number) => void
  onDefinirQuantidade: (produtoId: string, quantidade: number) => void
  onRemover: (produtoId: string) => void
}

function LinhaPedido({ line, onQuantidade, onDefinirQuantidade, onRemover }: LinhaPedidoProps) {
  const { produto, quantidade } = line
  // Texto em edição: só vira número ao sair do campo (dá para apagar e digitar "0,35").
  const [editando, setEditando] = useState<string | null>(null)
  const cancelar = useRef(false)

  function confirmar() {
    if (editando === null || cancelar.current) {
      cancelar.current = false
      setEditando(null)
      return
    }
    const valor = lerValor(editando)
    if (valor !== null && valor >= 0) onDefinirQuantidade(produto.id, Math.round(valor * 1000) / 1000)
    setEditando(null)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2">
      <IconeProduto produto={produto} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{produto.nome}</p>
        <p className="text-xs text-muted-foreground">
          {formatBRL(produto.preco_venda)}/{produto.unidade} ·{' '}
          <span className="font-medium text-foreground tabular-nums">
            {formatBRL(produto.preco_venda * quantidade)}
          </span>
        </p>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label={`Diminuir ${produto.nome}`}
          onClick={() => onQuantidade(produto.id, -1)}
        >
          <Minus className="size-3.5" />
        </Button>
        <Input
          inputMode="decimal"
          aria-label={`Quantidade de ${produto.nome}`}
          className="h-8 w-14 bg-card px-1 text-center text-sm font-semibold tabular-nums"
          value={editando ?? formatQuantidade(quantidade)}
          onFocus={(e) => {
            setEditando(formatQuantidade(quantidade))
            e.target.select()
          }}
          onChange={(e) => setEditando(e.target.value.replace(/[^\d.,]/g, ''))}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              cancelar.current = true
              e.currentTarget.blur()
            }
          }}
        />
        <Button
          variant="outline"
          size="icon"
          aria-label={`Aumentar ${produto.nome}`}
          onClick={() => onQuantidade(produto.id, 1)}
        >
          <Plus className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remover ${produto.nome}`}
          onClick={() => onRemover(produto.id)}
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  )
}
