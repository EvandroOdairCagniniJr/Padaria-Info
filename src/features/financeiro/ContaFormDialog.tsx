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
import { useCreateConta, useUpdateConta } from '@/features/financeiro/api'
import type { ContaFinanceira, TipoConta } from '@/types/database'
import { mensagemErro } from '@/lib/format'

const contaSchema = z.object({
  tipo: z.enum(['pagar', 'receber']),
  descricao: z.string().min(1, 'Informe a descrição'),
  categoria: z.string().optional(),
  valor: z.coerce.number().positive('Informe um valor válido'),
  data_vencimento: z.string().min(1, 'Informe o vencimento'),
  forma_pagamento: z.string().optional(),
  observacoes: z.string().optional(),
})

type ContaFormInput = z.input<typeof contaSchema>
type ContaForm = z.output<typeof contaSchema>

const tipoLabels: Record<TipoConta, string> = {
  pagar: 'Conta a pagar',
  receber: 'Conta a receber',
}

const formasPagamento = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
]

interface ContaFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conta?: ContaFinanceira | null
  tipoPadrao: TipoConta
}

export function ContaFormDialog({ open, onOpenChange, conta, tipoPadrao }: ContaFormDialogProps) {
  const isEditing = Boolean(conta)
  const createConta = useCreateConta()
  const updateConta = useUpdateConta()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContaFormInput, unknown, ContaForm>({
    resolver: zodResolver(contaSchema),
    defaultValues: { tipo: tipoPadrao },
  })

  useEffect(() => {
    if (open) {
      reset(
        conta
          ? {
              tipo: conta.tipo,
              descricao: conta.descricao,
              categoria: conta.categoria ?? '',
              valor: conta.valor,
              data_vencimento: conta.data_vencimento,
              forma_pagamento: conta.forma_pagamento ?? '',
              observacoes: conta.observacoes ?? '',
            }
          : { tipo: tipoPadrao },
      )
    }
  }, [open, conta, tipoPadrao, reset])

  async function onSubmit(values: ContaForm) {
    try {
      if (isEditing && conta) {
        await updateConta.mutateAsync({ id: conta.id, changes: values })
        toast.success('Lançamento atualizado')
      } else {
        await createConta.mutateAsync(values)
        toast.success('Lançamento criado')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao salvar lançamento'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar lançamento' : 'Novo lançamento'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select value={watch('tipo')} onValueChange={(v) => setValue('tipo', v as TipoConta)}>
              <SelectTrigger id="tipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(tipoLabels) as TipoConta[]).map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipoLabels[tipo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" {...register('descricao')} />
            {errors.descricao && (
              <p className="text-sm text-destructive">{errors.descricao.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Input id="categoria" {...register('categoria')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor">Valor</Label>
              <Input id="valor" type="number" step="0.01" {...register('valor')} />
              {errors.valor && <p className="text-sm text-destructive">{errors.valor.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_vencimento">Vencimento</Label>
              <Input id="data_vencimento" type="date" {...register('data_vencimento')} />
              {errors.data_vencimento && (
                <p className="text-sm text-destructive">{errors.data_vencimento.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="forma_pagamento">Forma de pagamento</Label>
              <Select
                value={watch('forma_pagamento') || undefined}
                onValueChange={(v) => setValue('forma_pagamento', v)}
              >
                <SelectTrigger id="forma_pagamento" className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {formasPagamento.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Input id="observacoes" {...register('observacoes')} />
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
