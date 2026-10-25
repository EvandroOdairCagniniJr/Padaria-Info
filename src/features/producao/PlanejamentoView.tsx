import { Loader2, MoreHorizontal, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  useConcluirProducao,
  useDeleteProducao,
  useProducoes,
  useReceitas,
} from '@/features/producao/api'
import { ProducaoFormDialog } from '@/features/producao/ProducaoFormDialog'
import { useAuth } from '@/features/auth/AuthContext'
import { ehGestao } from '@/lib/permissoes'
import type { Producao } from '@/types/database'
import { formatData, mensagemErro } from '@/lib/format'

export function PlanejamentoView() {
  const { data: producoes, isLoading } = useProducoes()
  const { data: receitas } = useReceitas()
  const concluirProducao = useConcluirProducao()
  const deleteProducao = useDeleteProducao()
  const podeRemover = ehGestao(useAuth().user?.papel)

  const [dialogOpen, setDialogOpen] = useState(false)

  const receitaNomeById = useMemo(() => {
    const map = new Map<string, string>()
    receitas?.forEach((r) => map.set(r.id, r.nome))
    return map
  }, [receitas])

  async function handleConcluir(producao: Producao) {
    try {
      await concluirProducao.mutateAsync(producao.id)
      toast.success('Produção concluída — estoque atualizado')
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao concluir produção'))
    }
  }

  async function handleDelete(producao: Producao) {
    if (!confirm('Remover esta produção planejada?')) return
    try {
      await deleteProducao.mutateAsync(producao.id)
      toast.success('Produção removida')
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao remover produção'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Planejar produção
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receita</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </TableCell>
              </TableRow>
            )}

            {!isLoading && (producoes?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Nenhuma produção planejada
                </TableCell>
              </TableRow>
            )}

            {producoes?.map((producao) => (
              <TableRow key={producao.id}>
                <TableCell className="font-medium">
                  {receitaNomeById.get(producao.receita_id) ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatData(producao.data)}</TableCell>
                <TableCell>
                  {producao.status === 'concluido' ? (
                    <Badge variant="secondary">Concluída</Badge>
                  ) : producao.status === 'cancelado' ? (
                    <Badge variant="outline">Cancelada</Badge>
                  ) : (
                    <Badge variant="outline">Planejada</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {/* Concluída já movimentou o estoque — não pode ser removida (policy no banco). */}
                  {producao.status !== 'concluido' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {producao.status === 'planejado' && (
                          <DropdownMenuItem onClick={() => handleConcluir(producao)}>
                            Concluir produção
                          </DropdownMenuItem>
                        )}
                        {podeRemover && (
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDelete(producao)}
                          >
                            Remover
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ProducaoFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
