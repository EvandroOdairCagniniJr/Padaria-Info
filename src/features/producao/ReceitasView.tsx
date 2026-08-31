import { Loader2, MoreHorizontal, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
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
import { useProdutos } from '@/features/produtos/api'
import { useDeleteReceita, useReceitas, useTodosReceitaItens } from '@/features/producao/api'
import { ReceitaFormDialog } from '@/features/producao/ReceitaFormDialog'
import type { Receita } from '@/types/database'

export function ReceitasView() {
  const { data: receitas, isLoading } = useReceitas()
  const { data: produtos } = useProdutos()
  const { data: itens } = useTodosReceitaItens()
  const deleteReceita = useDeleteReceita()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Receita | null>(null)

  const produtoNomeById = useMemo(() => {
    const map = new Map<string, string>()
    produtos?.forEach((p) => map.set(p.id, p.nome))
    return map
  }, [produtos])

  const contagemIngredientes = useMemo(() => {
    const map = new Map<string, number>()
    itens?.forEach((item) => map.set(item.receita_id, (map.get(item.receita_id) ?? 0) + 1))
    return map
  }, [itens])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(receita: Receita) {
    setEditing(receita)
    setDialogOpen(true)
  }

  async function handleDelete(receita: Receita) {
    if (!confirm(`Remover a receita "${receita.nome}"?`)) return
    try {
      await deleteReceita.mutateAsync(receita.id)
      toast.success('Receita removida')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover receita')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Nova receita
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receita</TableHead>
              <TableHead>Produto final</TableHead>
              <TableHead className="text-right">Rendimento</TableHead>
              <TableHead className="text-right">Ingredientes</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </TableCell>
              </TableRow>
            )}

            {!isLoading && (receitas?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhuma receita cadastrada
                </TableCell>
              </TableRow>
            )}

            {receitas?.map((receita) => (
              <TableRow key={receita.id}>
                <TableCell className="font-medium">{receita.nome}</TableCell>
                <TableCell className="text-muted-foreground">
                  {produtoNomeById.get(receita.produto_id) ?? '—'}
                </TableCell>
                <TableCell className="text-right">{receita.rendimento}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {contagemIngredientes.get(receita.id) ?? 0}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(receita)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => handleDelete(receita)}>
                        Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ReceitaFormDialog open={dialogOpen} onOpenChange={setDialogOpen} receita={editing} />
    </div>
  )
}
