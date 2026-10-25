import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AjustarEstoqueDialog } from '@/features/estoque/AjustarEstoqueDialog'
import { useProdutos } from '@/features/produtos/api'
import type { Produto } from '@/types/database'
import { IconeProduto } from '@/components/IconeProduto'

export function EstoquePage() {
  const { data: produtos, isLoading } = useProdutos()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selected, setSelected] = useState<Produto | null>(null)

  function openAjuste(produto: Produto) {
    setSelected(produto)
    setDialogOpen(true)
  }

  const produtosOrdenados = [...(produtos ?? [])].sort((a, b) => {
    const aBaixo = a.estoque_atual <= a.estoque_minimo
    const bBaixo = b.estoque_atual <= b.estoque_minimo
    if (aBaixo === bBaixo) return a.nome.localeCompare(b.nome)
    return aBaixo ? -1 : 1
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Estoque</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe o estoque atual e registre entradas, saídas e ajustes
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Estoque atual</TableHead>
              <TableHead className="text-right">Estoque mínimo</TableHead>
              <TableHead className="w-40" />
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

            {!isLoading && produtosOrdenados.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhum produto cadastrado
                </TableCell>
              </TableRow>
            )}

            {produtosOrdenados.map((produto) => {
              const baixo = produto.estoque_atual <= produto.estoque_minimo
              return (
                <TableRow key={produto.id}>
                  <TableCell className="font-medium">
                  <div className="flex items-center gap-2.5">
                    <IconeProduto produto={produto} />
                    {produto.nome}
                  </div>
                </TableCell>
                  <TableCell className="text-muted-foreground">{produto.unidade}</TableCell>
                  <TableCell className={`text-right ${baixo ? 'font-medium text-destructive' : ''}`}>
                    {produto.estoque_atual}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {produto.estoque_minimo}
                  </TableCell>
                  <TableCell className="flex items-center justify-end gap-2">
                    {baixo && <Badge variant="destructive">Baixo</Badge>}
                    <Button variant="outline" size="sm" onClick={() => openAjuste(produto)}>
                      Ajustar
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <AjustarEstoqueDialog open={dialogOpen} onOpenChange={setDialogOpen} produto={selected} />
    </div>
  )
}
