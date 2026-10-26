import { Loader2, Plus, X } from 'lucide-react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formasPagamento, useSalvarEncomenda, type Encomenda } from '@/features/encomendas/api'
import { useProdutos } from '@/features/produtos/api'
import { mascaraTelefone } from '@/lib/documentos'
import { formatBRL, mensagemErro } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { FormaPagamento } from '@/types/database'


type Linha = { chave: number; produto_id: string; quantidade: string; preco: string }

let proxima = 1
const linhaVazia = (): Linha => ({ chave: proxima++, produto_id: '', quantidade: '1', preco: '' })

const numero = (v: string) => Number(v.replace(/\./g, '').replace(',', '.'))
const paraCampo = (v: number) => String(v).replace('.', ',')

// datetime-local usa o horário local "YYYY-MM-DDTHH:mm".
function paraDataHora(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function amanhaAs(horas: number) {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(horas, 0, 0, 0)
  return d.toISOString()
}

export function EncomendaDialog({
  encomenda,
  aberto,
  onFechar,
}: {
  encomenda: Encomenda | null
  aberto: boolean
  onFechar: () => void
}) {
  const { data: produtos } = useProdutos()
  const salvar = useSalvarEncomenda()
  const porId = useMemo(() => new Map((produtos ?? []).map((p) => [p.id, p])), [produtos])

  const [cliente, setCliente] = useState(encomenda?.cliente_nome ?? '')
  const [telefone, setTelefone] = useState(mascaraTelefone(encomenda?.cliente_telefone) ?? '')
  const [quando, setQuando] = useState(paraDataHora(encomenda?.retirada_em ?? amanhaAs(10)))
  const [entrega, setEntrega] = useState(encomenda?.entrega ?? false)
  const [endereco, setEndereco] = useState(encomenda?.endereco ?? '')
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    encomenda
      ? encomenda.itens.map((i) => ({
          chave: proxima++,
          produto_id: i.produto_id,
          quantidade: paraCampo(i.quantidade),
          preco: paraCampo(i.preco_unitario),
        }))
      : [linhaVazia()],
  )
  const [sinal, setSinal] = useState(encomenda?.sinal ? paraCampo(encomenda.sinal) : '')
  const [formaSinal, setFormaSinal] = useState<FormaPagamento>(encomenda?.forma_sinal ?? 'pix')
  const [obs, setObs] = useState(encomenda?.observacoes ?? '')

  const total = linhas.reduce((s, l) => {
    const q = numero(l.quantidade)
    const p = numero(l.preco)
    return s + (q > 0 && p >= 0 ? q * p : 0)
  }, 0)
  const valorSinal = sinal.trim() ? numero(sinal) : 0

  function mudar(chave: number, campo: keyof Omit<Linha, 'chave'>, valor: string) {
    setLinhas((ls) =>
      ls.map((l) => {
        if (l.chave !== chave) return l
        // Ao escolher o produto, sugere o preço do cadastro (pode ser ajustado).
        if (campo === 'produto_id') {
          const p = porId.get(valor)
          return { ...l, produto_id: valor, preco: l.preco || (p ? paraCampo(p.preco_venda) : '') }
        }
        return { ...l, [campo]: valor }
      }),
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const itens = linhas
      .filter((l) => l.produto_id)
      .map((l) => ({ produto_id: l.produto_id, quantidade: numero(l.quantidade), preco_unitario: numero(l.preco) }))
    if (!cliente.trim()) return toast.error('Informe o nome do cliente')
    if (itens.length === 0) return toast.error('Adicione pelo menos um produto')
    if (itens.some((i) => !(i.quantidade > 0) || !(i.preco_unitario >= 0))) {
      return toast.error('Confira a quantidade e o preço de cada item')
    }
    if (!quando) return toast.error('Informe a data e a hora')
    if (!(valorSinal >= 0)) return toast.error('Sinal inválido')
    try {
      const r = await salvar.mutateAsync({
        id: encomenda?.id ?? null,
        dados: {
          cliente_nome: cliente.trim(),
          cliente_telefone: telefone || null,
          retirada_em: new Date(quando).toISOString(),
          entrega,
          endereco: entrega ? endereco.trim() || null : null,
          itens,
          sinal: valorSinal,
          forma_sinal: valorSinal > 0 ? formaSinal : null,
          observacoes: obs.trim() || null,
        },
      })
      toast.success(encomenda ? 'Encomenda atualizada' : `Encomenda nº ${r?.numero} registrada`)
      onFechar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível salvar'))
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{encomenda ? `Encomenda nº ${encomenda.numero}` : 'Nova encomenda'}</DialogTitle>
          <DialogDescription>Combine os itens, a data e o sinal com o cliente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="enc-cliente">Cliente</Label>
              <Input id="enc-cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enc-tel">WhatsApp</Label>
              <Input
                id="enc-tel"
                inputMode="tel"
                placeholder="(11) 98765-4321"
                value={telefone}
                onChange={(e) => setTelefone(mascaraTelefone(e.target.value) ?? '')}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="enc-quando">{entrega ? 'Entregar em' : 'Retirar em'}</Label>
              <Input id="enc-quando" type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Como recebe</Label>
              <div className="grid grid-cols-2 gap-1 rounded-lg border p-1">
                {[false, true].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setEntrega(v)}
                    className={cn(
                      'rounded-md py-1 text-sm',
                      entrega === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {v ? 'Entrega' : 'Retirada'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {entrega && (
            <div className="space-y-1.5">
              <Label htmlFor="enc-end">Endereço de entrega</Label>
              <Input id="enc-end" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <Label>Itens</Label>
            {linhas.map((l) => (
              <div key={l.chave} className="flex gap-2">
                <Select value={l.produto_id} onValueChange={(v) => mudar(l.chave, 'produto_id', v)}>
                  <SelectTrigger className="min-w-0 flex-1">
                    <SelectValue placeholder="Produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {(produtos ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  aria-label="Quantidade"
                  inputMode="decimal"
                  className="w-16 tabular-nums"
                  value={l.quantidade}
                  onChange={(e) => mudar(l.chave, 'quantidade', e.target.value)}
                />
                <div className="relative w-24">
                  <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-muted-foreground">
                    R$
                  </span>
                  <Input
                    aria-label="Preço unitário"
                    inputMode="decimal"
                    className="pl-7 tabular-nums"
                    value={l.preco}
                    onChange={(e) => mudar(l.chave, 'preco', e.target.value)}
                  />
                </div>
                {linhas.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remover item"
                    onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setLinhas((ls) => [...ls, linhaVazia()])}>
              <Plus className="size-4" />
              Adicionar item
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="enc-obs">Detalhes</Label>
            <textarea
              id="enc-obs"
              rows={2}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              placeholder='Ex.: bolo de 2 kg, escrever "Parabéns, Ana!", sem lactose'
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
          </div>

          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-heading text-2xl font-bold tabular-nums">{formatBRL(total)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="enc-sinal" className="text-sm">
                Sinal
              </Label>
              <div className="relative w-28">
                <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-muted-foreground">
                  R$
                </span>
                <Input
                  id="enc-sinal"
                  inputMode="decimal"
                  className="pl-7 tabular-nums"
                  placeholder="0,00"
                  value={sinal}
                  onChange={(e) => setSinal(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSinal(paraCampo(Math.round(total * 50) / 100))}
                disabled={total <= 0}
              >
                50%
              </Button>
              {valorSinal > 0 && (
                <Select value={formaSinal} onValueChange={(v) => setFormaSinal(v as FormaPagamento)}>
                  <SelectTrigger className="w-28">
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
              )}
            </div>
            {valorSinal > 0 && total > 0 && (
              <p className="text-sm text-muted-foreground">
                Falta pagar na {entrega ? 'entrega' : 'retirada'}:{' '}
                <strong className="text-foreground tabular-nums">{formatBRL(Math.max(0, total - valorSinal))}</strong>
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Fechar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
              {encomenda ? 'Salvar alterações' : 'Registrar encomenda'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
