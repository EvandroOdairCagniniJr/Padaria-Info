import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, Check, ChevronDown, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  chaveCategoria,
  useCreateProduto,
  useFotosCategorias,
  useProdutos,
  useSalvarFotoCategoria,
  useUpdateProduto,
} from '@/features/produtos/api'
import { categoriaSugerida, categoriasPadrao, iconeProduto } from '@/lib/iconeProduto'
import { reduzirFoto } from '@/lib/imagem'
import { cn } from '@/lib/utils'
import type { Produto } from '@/types/database'
import { mensagemErro } from '@/lib/format'

const produtoSchema = z.object({
  nome: z.string().min(1, 'Informe o nome do produto'),
  categoria: z.string().optional(),
  unidade: z.string().min(1, 'Selecione a unidade'),
  preco_venda: z.coerce.number().positive('Informe um preço de venda válido'),
  // Campo vazio vira null (sem custo informado) em vez de 0.
  preco_custo: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? null : v),
    z.coerce.number().nonnegative('Informe um preço de custo válido').nullable(),
  ),
  estoque_minimo: z.coerce.number().nonnegative('Informe um estoque mínimo válido').default(0),
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
  const { data: produtos } = useProdutos()
  // Categoria automática: segue o nome ("Pão francês" → "Pães") até a pessoa escolher ou digitar outra.
  const [categoriaAuto, setCategoriaAuto] = useState(true)
  const { data: fotosCategorias } = useFotosCategorias()
  const salvarFotoCategoria = useSalvarFotoCategoria()
  // Foto da categoria escolhida neste formulário: undefined = não mexeu, null = voltar ao ícone automático.
  const [fotoCategoria, setFotoCategoria] = useState<string | null | undefined>(undefined)
  const [processandoFoto, setProcessandoFoto] = useState(false)
  const fotoInputRef = useRef<HTMLInputElement>(null)

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
      setCategoriaAuto(!produto?.categoria)
      setFotoCategoria(undefined)
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

  const sugerida = categoriaSugerida(watch('nome') ?? '')
  const categoria = categoriaAuto ? (sugerida ?? '') : (watch('categoria') ?? '')

  // As que já existem nos produtos + as comuns de padaria.
  const categorias = useMemo(
    () =>
      [
        ...new Set([
          ...(produtos ?? []).map((p) => p.categoria?.trim()).filter(Boolean),
          ...categoriasPadrao,
        ] as string[]),
      ].sort((a, b) => a.localeCompare(b)),
    [produtos],
  )
  const categoriaNova = categoria.trim() !== '' && !categorias.includes(categoria.trim())

  const fotoAtual =
    fotoCategoria !== undefined
      ? fotoCategoria
      : (fotosCategorias?.get(chaveCategoria(categoria)) ?? null)
  const iconeAuto = iconeProduto({ nome: watch('nome') ?? '', categoria })

  async function escolherFoto(arquivo: File | undefined) {
    if (!arquivo) return
    setProcessandoFoto(true)
    try {
      setFotoCategoria(await reduzirFoto(arquivo))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível usar essa imagem')
    } finally {
      setProcessandoFoto(false)
      if (fotoInputRef.current) fotoInputRef.current.value = ''
    }
  }

  function escolherCategoria(valor: string) {
    setCategoriaAuto(false)
    setValue('categoria', valor)
  }

  async function onSubmit(form: ProdutoForm) {
    const values = { ...form, categoria: categoria.trim() }
    try {
      if (isEditing && produto) {
        await updateProduto.mutateAsync({ id: produto.id, changes: values })
        toast.success('Produto atualizado')
      } else {
        await createProduto.mutateAsync({ ...values, estoque_atual: 0 })
        toast.success('Produto criado')
      }
      // A foto vale para a categoria inteira (todos os produtos dela).
      if (fotoCategoria !== undefined && values.categoria) {
        await salvarFotoCategoria.mutateAsync({ nome: values.categoria, foto: fotoCategoria })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao salvar produto'))
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

          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria</Label>
            <div className="flex gap-2">
              <Input
                id="categoria"
                placeholder="Escolha na lista ou escreva uma nova"
                autoComplete="off"
                value={categoria}
                onChange={(e) => escolherCategoria(e.target.value)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="h-9 shrink-0">
                    Lista
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
                  <DropdownMenuItem onSelect={() => setCategoriaAuto(true)}>
                    <Sparkles className="size-4 text-primary" />
                    Automática (pelo nome)
                    {categoriaAuto && <Check className="ml-auto size-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Categorias
                  </DropdownMenuLabel>
                  {categorias.map((c) => (
                    <DropdownMenuItem key={c} onSelect={() => escolherCategoria(c)}>
                      {c}
                      {!categoriaAuto && categoria === c && <Check className="ml-auto size-4" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {categoriaAuto ? (
                <>
                  <Sparkles className="size-3 text-primary" />
                  {sugerida
                    ? 'Escolhida automaticamente pelo nome. Pode trocar na lista ou digitar outra.'
                    : 'Escreva o nome para sugerir uma categoria, ou digite uma.'}
                </>
              ) : categoriaNova ? (
                'Categoria nova: ela passa a aparecer na lista depois de salvar.'
              ) : (
                'Pode trocar na lista ou digitar outra.'
              )}
            </p>

            {categoria.trim() && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2.5">
                {fotoAtual ? (
                  <img src={fotoAtual} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span
                    className={cn(
                      'flex size-12 shrink-0 items-center justify-center rounded-xl',
                      iconeAuto.cor,
                    )}
                  >
                    <iconeAuto.icone className="size-6" aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    Imagem de “{categoria.trim()}”
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fotoAtual ? 'Foto escolhida' : 'Automática'} · vale para todos os produtos
                    dessa categoria
                  </p>
                </div>
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => escolherFoto(e.target.files?.[0])}
                />
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={processandoFoto}
                    onClick={() => fotoInputRef.current?.click()}
                  >
                    {processandoFoto ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Camera className="size-4" />
                    )}
                    {fotoAtual ? 'Trocar' : 'Pôr foto'}
                  </Button>
                  {fotoAtual && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFotoCategoria(null)}
                    >
                      <Trash2 className="size-4" />
                      Automática
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="estoque_minimo">Estoque mínimo</Label>
              <Input id="estoque_minimo" type="number" step="0.001" {...register('estoque_minimo')} />
              {errors.estoque_minimo && (
                <p className="text-sm text-destructive">{errors.estoque_minimo.message}</p>
              )}
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
              {errors.preco_custo && (
                <p className="text-sm text-destructive">{errors.preco_custo.message}</p>
              )}
            </div>
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
