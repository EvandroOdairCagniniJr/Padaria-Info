import { Loader2, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useProdutos } from '@/features/produtos/api'
import { useFinalizarVenda } from '@/features/pdv/api'
import type { FormaPagamento, Produto } from '@/types/database'

interface CartLine {
  produto: Produto
  quantidade: number
}

const formasPagamento: { value: FormaPagamento; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'cartao_debito', label: 'Cartão de débito' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
]

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function PdvPage() {
  const { data: produtos, isLoading } = useProdutos()
  const finalizarVenda = useFinalizarVenda()

  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('dinheiro')
  const [recibo, setRecibo] = useState<{ itens: CartLine[]; total: number; forma: FormaPagamento } | null>(
    null,
  )

  const produtosFiltrados = useMemo(() => {
    if (!produtos) return []
    const term = search.trim().toLowerCase()
    if (!term) return produtos
    return produtos.filter((p) => p.nome.toLowerCase().includes(term))
  }, [produtos, search])

  const total = cart.reduce((sum, line) => sum + line.produto.preco_venda * line.quantidade, 0)

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
          line.produto.id === produtoId
            ? { ...line, quantidade: line.quantidade + delta }
            : line,
        )
        .filter((line) => line.quantidade > 0),
    )
  }

  function removeFromCart(produtoId: string) {
    setCart((prev) => prev.filter((line) => line.produto.id !== produtoId))
  }

  async function handleFinalizar() {
    if (cart.length === 0) return
    try {
      await finalizarVenda.mutateAsync({
        itens: cart.map((line) => ({
          produto_id: line.produto.id,
          quantidade: line.quantidade,
          preco_unitario: line.produto.preco_venda,
        })),
        formaPagamento,
      })
      setRecibo({ itens: cart, total, forma: formaPagamento })
      setCart([])
      setFormaPagamento('dinheiro')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao finalizar venda')
    }
  }

  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">PDV</h1>
          <p className="text-sm text-muted-foreground">Venda rápida no balcão</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Buscar produto..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {produtosFiltrados.map((produto) => (
              <button
                key={produto.id}
                type="button"
                onClick={() => addToCart(produto)}
                className="flex flex-col items-start gap-1 rounded-lg border bg-card p-3 text-left hover:border-primary hover:shadow-sm"
              >
                <span className="text-sm font-medium">{produto.nome}</span>
                <span className="text-sm text-muted-foreground">
                  {formatBRL(produto.preco_venda)}
                </span>
              </button>
            ))}

            {produtosFiltrados.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                Nenhum produto encontrado
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col rounded-lg border bg-card">
        <div className="border-b p-4">
          <h2 className="font-medium">Carrinho</h2>
        </div>

        <div className="flex-1 space-y-3 overflow-auto p-4">
          {cart.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Carrinho vazio</p>
          )}

          {cart.map((line) => (
            <div key={line.produto.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{line.produto.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBRL(line.produto.preco_venda)} un.
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => updateQuantidade(line.produto.id, -1)}
                >
                  <Minus className="size-3" />
                </Button>
                <span className="w-6 text-center text-sm">{line.quantidade}</span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => updateQuantidade(line.produto.id, 1)}
                >
                  <Plus className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeFromCart(line.produto.id)}
                >
                  <Trash2 className="size-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t p-4">
          <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as FormaPagamento)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {formasPagamento.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center justify-between text-lg font-semibold">
            <span>Total</span>
            <span>{formatBRL(total)}</span>
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={cart.length === 0 || finalizarVenda.isPending}
            onClick={handleFinalizar}
          >
            {finalizarVenda.isPending && <Loader2 className="size-4 animate-spin" />}
            Finalizar venda
          </Button>
        </div>
      </div>

      <Dialog open={Boolean(recibo)} onOpenChange={(open) => !open && setRecibo(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Venda concluída</DialogTitle>
          </DialogHeader>

          {recibo && (
            <div className="space-y-3 text-sm">
              <ul className="space-y-1">
                {recibo.itens.map((line) => (
                  <li key={line.produto.id} className="flex justify-between">
                    <span>
                      {line.quantidade}x {line.produto.nome}
                    </span>
                    <span>{formatBRL(line.produto.preco_venda * line.quantidade)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span>{formatBRL(recibo.total)}</span>
              </div>
              <p className="text-muted-foreground">
                Pagamento: {formasPagamento.find((f) => f.value === recibo.forma)?.label}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button className="w-full" onClick={() => setRecibo(null)}>
              Nova venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
