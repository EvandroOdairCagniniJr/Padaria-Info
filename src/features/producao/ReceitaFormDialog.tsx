import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
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
import { useProdutos } from '@/features/produtos/api'
import { useCreateReceita, useReceitaItens, useUpdateReceita } from '@/features/producao/api'
import type { Receita } from '@/types/database'

const itemSchema = z.object({
  ingrediente_id: z.string().min(1, 'Selecione o ingrediente'),
  quantidade: z.coerce.number().positive('Informe uma quantidade válida'),
})

const receitaSchema = z.object({
  produto_id: z.string().min(1, 'Selecione o produto final'),
  nome: z.string().min(1, 'Informe o nome da receita'),
  rendimento: z.coerce.number().positive('Informe um rendimento válido'),
  modo_preparo: z.string().optional(),
  itens: z.array(itemSchema).min(1, 'Adicione pelo menos um ingrediente'),
})

type ReceitaFormInput = z.input<typeof receitaSchema>
type ReceitaForm = z.output<typeof receitaSchema>

interface ReceitaFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  receita?: Receita | null
}

export function ReceitaFormDialog({ open, onOpenChange, receita }: ReceitaFormDialogProps) {
  const isEditing = Boolean(receita)
  const { data: produtos } = useProdutos()
  const { data: itensExistentes } = useReceitaItens(open ? (receita?.id ?? null) : null)
  const createReceita = useCreateReceita()
  const updateReceita = useUpdateReceita()

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReceitaFormInput, unknown, ReceitaForm>({
    resolver: zodResolver(receitaSchema),
    defaultValues: { itens: [{ ingrediente_id: '', quantidade: undefined }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' })

  useEffect(() => {
    if (!open) return
    if (!receita) {
      reset({
        produto_id: '',
        nome: '',
        rendimento: undefined,
        modo_preparo: '',
        itens: [{ ingrediente_id: '', quantidade: undefined }],
      })
      return
    }
    if (itensExistentes) {
      reset({
        produto_id: receita.produto_id,
        nome: receita.nome,
        rendimento: receita.rendimento,
        modo_preparo: receita.modo_preparo ?? '',
        itens: itensExistentes.map((item) => ({
          ingrediente_id: item.ingrediente_id,
          quantidade: item.quantidade,
        })),
      })
    }
  }, [open, receita, itensExistentes, reset])

  async function onSubmit(values: ReceitaForm) {
    try {
      const receitaFields = {
        produto_id: values.produto_id,
        nome: values.nome,
        rendimento: values.rendimento,
        modo_preparo: values.modo_preparo,
      }
      if (isEditing && receita) {
        await updateReceita.mutateAsync({ id: receita.id, changes: receitaFields, itens: values.itens })
        toast.success('Receita atualizada')
      } else {
        await createReceita.mutateAsync({ receita: receitaFields, itens: values.itens })
        toast.success('Receita criada')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar receita')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar receita' : 'Nova receita'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da receita</Label>
            <Input id="nome" {...register('nome')} />
            {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="produto_id">Produto final</Label>
              <Select
                value={watch('produto_id')}
                onValueChange={(v) => setValue('produto_id', v)}
              >
                <SelectTrigger id="produto_id" className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {produtos?.map((produto) => (
                    <SelectItem key={produto.id} value={produto.id}>
                      {produto.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.produto_id && (
                <p className="text-sm text-destructive">{errors.produto_id.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rendimento">Rendimento</Label>
              <Input id="rendimento" type="number" step="0.001" {...register('rendimento')} />
              {errors.rendimento && (
                <p className="text-sm text-destructive">{errors.rendimento.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="modo_preparo">Modo de preparo</Label>
            <Input id="modo_preparo" {...register('modo_preparo')} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ingredientes</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ ingrediente_id: '', quantidade: undefined as unknown as number })}
              >
                <Plus className="size-3.5" />
                Adicionar ingrediente
              </Button>
            </div>

            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-2">
                  <div className="flex-1">
                    <Select
                      value={watch(`itens.${index}.ingrediente_id`)}
                      onValueChange={(v) => setValue(`itens.${index}.ingrediente_id`, v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Ingrediente" />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos?.map((produto) => (
                          <SelectItem key={produto.id} value={produto.id}>
                            {produto.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.itens?.[index]?.ingrediente_id && (
                      <p className="text-sm text-destructive">
                        {errors.itens[index]?.ingrediente_id?.message}
                      </p>
                    )}
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      step="0.001"
                      placeholder="Qtd."
                      {...register(`itens.${index}.quantidade`)}
                    />
                    {errors.itens?.[index]?.quantidade && (
                      <p className="text-sm text-destructive">
                        {errors.itens[index]?.quantidade?.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            {errors.itens?.root && (
              <p className="text-sm text-destructive">{errors.itens.root.message}</p>
            )}
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
