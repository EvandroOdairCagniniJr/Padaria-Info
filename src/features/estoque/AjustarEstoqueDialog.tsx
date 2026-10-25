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
import { useAjustarEstoque } from '@/features/estoque/api'
import type { Produto, TipoMovimentacao } from '@/types/database'
import { mensagemErro } from '@/lib/format'

const ajusteSchema = z.object({
  tipo: z.enum(['entrada', 'saida', 'ajuste']),
  quantidade: z.coerce.number().nonnegative('Informe uma quantidade válida'),
  motivo: z.string().optional(),
})

type AjusteFormInput = z.input<typeof ajusteSchema>
type AjusteForm = z.output<typeof ajusteSchema>

const tipoLabels: Record<TipoMovimentacao, string> = {
  entrada: 'Entrada (adiciona ao estoque)',
  saida: 'Saída (remove do estoque)',
  ajuste: 'Ajuste (define o total exato)',
}

interface AjustarEstoqueDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  produto: Produto | null
}

export function AjustarEstoqueDialog({ open, onOpenChange, produto }: AjustarEstoqueDialogProps) {
  const ajustarEstoque = useAjustarEstoque()
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AjusteFormInput, unknown, AjusteForm>({
    resolver: zodResolver(ajusteSchema),
    defaultValues: { tipo: 'entrada' },
  })

  useEffect(() => {
    if (open) reset({ tipo: 'entrada', quantidade: undefined, motivo: '' })
  }, [open, reset])

  async function onSubmit(values: AjusteForm) {
    if (!produto) return
    try {
      await ajustarEstoque.mutateAsync({ produtoId: produto.id, ...values })
      toast.success('Estoque atualizado')
      onOpenChange(false)
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao ajustar estoque'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar estoque {produto ? `— ${produto.nome}` : ''}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de movimentação</Label>
            <Select value={watch('tipo')} onValueChange={(v) => setValue('tipo', v as TipoMovimentacao)}>
              <SelectTrigger id="tipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(tipoLabels) as TipoMovimentacao[]).map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipoLabels[tipo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantidade">
              {watch('tipo') === 'ajuste' ? 'Novo total em estoque' : 'Quantidade'}
            </Label>
            <Input id="quantidade" type="number" step="0.001" {...register('quantidade')} />
            {errors.quantidade && (
              <p className="text-sm text-destructive">{errors.quantidade.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Input id="motivo" placeholder="Ex: compra, perda, contagem..." {...register('motivo')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
