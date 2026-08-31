import { Loader2, MoreHorizontal, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  useContasFinanceiras,
  useDeleteConta,
  useMarcarComoPago,
} from '@/features/financeiro/api'
import { ContaFormDialog } from '@/features/financeiro/ContaFormDialog'
import type { ContaFinanceira, TipoConta } from '@/types/database'

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatData(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR')
}

const hoje = new Date().toISOString().slice(0, 10)

export function FinanceiroPage() {
  const { data: contas, isLoading } = useContasFinanceiras()
  const marcarComoPago = useMarcarComoPago()
  const deleteConta = useDeleteConta()

  const [tipo, setTipo] = useState<TipoConta>('pagar')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ContaFinanceira | null>(null)

  const resumo = useMemo(() => {
    const pendentes = contas?.filter((c) => c.status === 'pendente') ?? []
    const totalPagar = pendentes.filter((c) => c.tipo === 'pagar').reduce((s, c) => s + c.valor, 0)
    const totalReceber = pendentes
      .filter((c) => c.tipo === 'receber')
      .reduce((s, c) => s + c.valor, 0)
    return { totalPagar, totalReceber, saldo: totalReceber - totalPagar }
  }, [contas])

  const listaFiltrada = useMemo(
    () => (contas ?? []).filter((c) => c.tipo === tipo),
    [contas, tipo],
  )

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(conta: ContaFinanceira) {
    setEditing(conta)
    setDialogOpen(true)
  }

  async function handleMarcarComoPago(conta: ContaFinanceira) {
    try {
      await marcarComoPago.mutateAsync(conta.id)
      toast.success(conta.tipo === 'pagar' ? 'Marcado como pago' : 'Marcado como recebido')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar lançamento')
    }
  }

  async function handleDelete(conta: ContaFinanceira) {
    if (!confirm(`Remover o lançamento "${conta.descricao}"?`)) return
    try {
      await deleteConta.mutateAsync(conta.id)
      toast.success('Lançamento removido')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover lançamento')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Contas a pagar, a receber e fluxo de caixa</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Novo lançamento
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              A pagar (pendente)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatBRL(resumo.totalPagar)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              A receber (pendente)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatBRL(resumo.totalReceber)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo previsto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(resumo.saldo)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="inline-flex rounded-lg border bg-card p-1">
        {(['pagar', 'receber'] as TipoConta[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              tipo === t
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'pagar' ? 'A pagar' : 'A receber'}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </TableCell>
              </TableRow>
            )}

            {!isLoading && listaFiltrada.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhum lançamento encontrado
                </TableCell>
              </TableRow>
            )}

            {listaFiltrada.map((conta) => {
              const atrasado = conta.status === 'pendente' && conta.data_vencimento < hoje
              return (
                <TableRow key={conta.id}>
                  <TableCell className="font-medium">{conta.descricao}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {conta.categoria || '—'}
                  </TableCell>
                  <TableCell className="text-right">{formatBRL(conta.valor)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatData(conta.data_vencimento)}
                  </TableCell>
                  <TableCell>
                    {conta.status === 'pago' ? (
                      <Badge variant="secondary">Pago</Badge>
                    ) : atrasado ? (
                      <Badge variant="destructive">Atrasado</Badge>
                    ) : (
                      <Badge variant="outline">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {conta.status === 'pendente' && (
                          <DropdownMenuItem onClick={() => handleMarcarComoPago(conta)}>
                            {conta.tipo === 'pagar' ? 'Marcar como pago' : 'Marcar como recebido'}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => openEdit(conta)}>Editar</DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => handleDelete(conta)}>
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <ContaFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        conta={editing}
        tipoPadrao={tipo}
      />
    </div>
  )
}
