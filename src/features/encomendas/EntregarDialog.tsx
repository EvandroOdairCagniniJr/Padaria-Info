import { Loader2, PackageCheck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { VendaConcluida } from '@/components/VendaConcluida'
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
import { formasPagamento, useEntregarEncomenda, type Encomenda } from '@/features/encomendas/api'
import { formatBRL, mensagemErro } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { FormaPagamento } from '@/types/database'

// Entrega: recebe o que falta (o sinal já foi pago) e registra a venda.
export function EntregarDialog({ encomenda, onFechar }: { encomenda: Encomenda | null; onFechar: () => void }) {
  const entregar = useEntregarEncomenda()
  const [forma, setForma] = useState<FormaPagamento>('pix')
  const [recebido, setRecebido] = useState('')
  const [festa, setFesta] = useState<number | null>(null)
  const falta = encomenda ? Math.max(0, Math.round((encomenda.total - encomenda.sinal) * 100) / 100) : 0
  const valorRecebido = recebido.trim() ? Number(recebido.replace(/\./g, '').replace(',', '.')) : null
  const troco = forma === 'dinheiro' && valorRecebido != null ? valorRecebido - falta : null

  async function confirmar() {
    if (!encomenda) return
    if (troco != null && troco < 0) return toast.error('Valor recebido menor que o que falta')
    try {
      await entregar.mutateAsync({ id: encomenda.id, forma_pagamento: forma })
      setFesta(encomenda.total)
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível entregar'))
    }
  }

  if (festa != null) {
    return <VendaConcluida total={festa} bateuMeta={false} onFim={onFechar} />
  }

  return (
    <Dialog open={Boolean(encomenda)} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Entregar encomenda nº {encomenda?.numero}</DialogTitle>
          <DialogDescription>{encomenda?.cliente_nome}</DialogDescription>
        </DialogHeader>
        {encomenda && (
          <div className="space-y-4">
            <div className="space-y-1 rounded-xl border p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="tabular-nums">{formatBRL(encomenda.total)}</span>
              </div>
              {encomenda.sinal > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sinal já pago</span>
                  <span className="tabular-nums">− {formatBRL(encomenda.sinal)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t pt-2">
                <span className="font-semibold">A receber agora</span>
                <span className="font-heading text-2xl font-bold tabular-nums">{formatBRL(falta)}</span>
              </div>
            </div>
            {falta > 0 && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {formasPagamento.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setForma(f.value)}
                      className={cn(
                        'rounded-lg border py-2 text-sm font-medium transition-colors',
                        forma === f.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:border-primary/40',
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {forma === 'dinheiro' && (
                  <div className="space-y-1">
                    <Input
                      inputMode="decimal"
                      placeholder="Valor recebido (para o troco)"
                      value={recebido}
                      onChange={(e) => setRecebido(e.target.value)}
                    />
                    {troco != null && (
                      <p className={cn('text-sm font-medium', troco < 0 ? 'text-destructive' : 'text-emerald-700')}>
                        {troco < 0 ? `Faltam ${formatBRL(-troco)}` : `Troco: ${formatBRL(troco)}`}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Voltar
          </Button>
          <Button onClick={confirmar} disabled={entregar.isPending}>
            {entregar.isPending ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
            Confirmar entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
