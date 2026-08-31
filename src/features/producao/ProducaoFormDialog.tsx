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
import { useCreateProducao, useReceitas } from '@/features/producao/api'

const producaoSchema = z.object({
  receita_id: z.string().min(1, 'Selecione a receita'),
  data: z.string().min(1, 'Informe a data'),
  observacoes: z.string().optional(),
})

type ProducaoForm = z.infer<typeof producaoSchema>

interface ProducaoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const hoje = new Date().toISOString().slice(0, 10)

export function ProducaoFormDialog({ open, onOpenChange }: ProducaoFormDialogProps) {
  const { data: receitas } = useReceitas()
  const createProducao = useCreateProducao()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProducaoForm>({
    resolver: zodResolver(producaoSchema),
    defaultValues: { data: hoje },
  })

  useEffect(() => {
    if (open) reset({ receita_id: '', data: hoje, observacoes: '' })
  }, [open, reset])

  async function onSubmit(values: ProducaoForm) {
    try {
      await createProducao.mutateAsync(values)
      toast.success('Produção planejada')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao planejar produção')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Planejar produção</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="receita_id">Receita</Label>
            <Select value={watch('receita_id')} onValueChange={(v) => setValue('receita_id', v)}>
              <SelectTrigger id="receita_id" className="w-full">
                <SelectValue placeholder="Selecione a receita" />
              </SelectTrigger>
              <SelectContent>
                {receitas?.map((receita) => (
                  <SelectItem key={receita.id} value={receita.id}>
                    {receita.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.receita_id && (
              <p className="text-sm text-destructive">{errors.receita_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="data">Data</Label>
            <Input id="data" type="date" {...register('data')} />
            {errors.data && <p className="text-sm text-destructive">{errors.data.message}</p>}
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
              Planejar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
