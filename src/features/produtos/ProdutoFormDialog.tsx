import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
import { useCreateProduto, useUpdateProduto } from '@/features/produtos/api'
import type { Produto } from '@/types/database'

const produtoSchema = z.object({
  nome: z.string().min(1, 'Informe o nome do produto'),
  categoria: z.string().optional(),
  unidade: z.string().min(1, 'Selecione a unidade'),
  preco_venda: z.coerce.number().positive('Informe um preço de venda válido'),
  preco_custo: z.coerce.number().nonnegative().optional(),
  estoque_minimo: z.coerce.number().nonnegative().optional(),
})

type ProdutoFormInput = z.input<typeof produtoSchema>
type ProdutoForm = z.output<typeof produtoSchema>

const unidades = ['un', 'kg', 'g', 'pacote', 'caixa', 'litro']

interface ProdutoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  produto?: Produto | null
}

export function ProdutoFormDialog({ open, onOpenChange, produto }: ProdutoFormDialogProps) {
  const isEditing = Boolean(produto)
  const createProduto = useCreateProduto()
  const updateProduto = useUpdateProduto()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProdutoFormInput, unknown, ProdutoForm>({
    resolver: zodResolver(produtoSchema),
    defaultValues: { unidade: 'un' },
  })

  useEffect(() => {
    if (open) {
      reset(
        produto
          ? {
              nome: produto.nome,
              categoria: produto.categoria ?? '',
              unidade: produto.unidade,
              preco_venda: produto.preco_venda,
              preco_custo: produto.preco_custo ?? undefined,
              estoque_minimo: produto.estoque_minimo,
            }
          : { unidade: 'un' },
      )
    }
  }, [open, produto, reset])

  async function onSubmit(values: ProdutoForm) {
    try {
      if (isEditing && produto) {
        await updateProduto.mutateAsync({ id: produto.id, changes: values })
        toast.success('Produto atualizado')
      } else {
        await createProduto.mutateAsync({ ...values, estoque_atual: 0 })
        toast.success('Produto criado')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar produto')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar produto' : 'Novo produto'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" {...register('nome')} />
            {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Input id="categoria" {...register('categoria')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unidade">Unidade</Label>
              <Select value={watch('unidade')} onValueChange={(v) => setValue('unidade', v)}>
                <SelectTrigger id="unidade" className="w-full">
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="preco_venda">Preço de venda</Label>
              <Input id="preco_venda" type="number" step="0.01" {...register('preco_venda')} />
              {errors.preco_venda && (
                <p className="text-sm text-destructive">{errors.preco_venda.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="preco_custo">Preço de custo</Label>
              <Input id="preco_custo" type="number" step="0.01" {...register('preco_custo')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estoque_minimo">Estoque mínimo</Label>
            <Input id="estoque_minimo" type="number" step="0.001" {...register('estoque_minimo')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
