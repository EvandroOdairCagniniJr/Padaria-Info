import { Loader2, MoreHorizontal, Plus, Search } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDeleteProduto, useProdutos } from '@/features/produtos/api'
import { ProdutoFormDialog } from '@/features/produtos/ProdutoFormDialog'
import type { Produto } from '@/types/database'
import { mensagemErro } from '@/lib/format'
import { IconeProduto } from '@/components/IconeProduto'

export function ProdutosPage() {
  const { data: produtos, isLoading } = useProdutos()
  const deleteProduto = useDeleteProduto()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Produto | null>(null)

  const filtered = useMemo(() => {
    if (!produtos) return []
    const term = search.trim().toLowerCase()
    if (!term) return produtos
    return produtos.filter(
      (p) => p.nome.toLowerCase().includes(term) || p.categoria?.toLowerCase().includes(term),
    )
  }, [produtos, search])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(produto: Produto) {
    setEditing(produto)
    setDialogOpen(true)
  }

  async function handleDelete(produto: Produto) {
    if (!confirm(`Remover o produto "${produto.nome}"?`)) return
    try {
      await deleteProduto.mutateAsync(produto.id)
      toast.success('Produto removido')
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao remover produto'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground">Cadastro de produtos da padaria</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Novo produto
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou categoria..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Preço de venda</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
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

            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhum produto encontrado
                </TableCell>
              </TableRow>
            )}

            {filtered.map((produto) => (
              <TableRow key={produto.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2.5">
                    <IconeProduto produto={produto} />
                    {produto.nome}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{produto.categoria || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{produto.unidade}</TableCell>
                <TableCell className="text-right">
                  {produto.preco_venda.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={
                      produto.estoque_atual <= produto.estoque_minimo
                        ? 'text-destructive font-medium'
                        : undefined
                    }
                  >
                    {produto.estoque_atual}
                  </span>
                  {produto.estoque_atual <= produto.estoque_minimo && (
                    <Badge variant="destructive" className="ml-2">
                      Baixo
                    </Badge>
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
                      <DropdownMenuItem onClick={() => openEdit(produto)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => handleDelete(produto)}>
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

      <ProdutoFormDialog open={dialogOpen} onOpenChange={setDialogOpen} produto={editing} />
    </div>
  )
}
