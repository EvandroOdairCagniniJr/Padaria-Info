import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChefHat, Loader2, Percent, PiggyBank, Receipt, Tag, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { IconeProduto } from '@/components/IconeProduto'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/AuthContext'
import { useUpdateProduto } from '@/features/produtos/api'
import { api } from '@/lib/api'
import { formatBRL, formatQuantidade, mensagemErro } from '@/lib/format'
import { useContagem } from '@/lib/useContagem'
import { cn } from '@/lib/utils'

type ProdutoMargem = {
  id: string
  nome: string
  categoria: string | null
  unidade: string
  preco_venda: number
  preco_custo: number | null
  custo: number | null
  origem: 'receita' | 'cadastro' | null
  ficha_incompleta: boolean
  margem: number | null
  cmv: number | null
  vendido: number
  faturamento: number
  lucro_bruto: number | null
  preco_sugerido: number | null
  acima_da_meta: boolean
}

type Margens = {
  cmv_alvo: number
  resumo: {
    faturamento: number
    custo: number
    lucro_bruto: number
    cmv: number | null
    faturamento_sem_custo: number
  }
  produtos: ProdutoMargem[]
}

const periodos = [
  { chave: '7', label: '7 dias' },
  { chave: '30', label: '30 dias' },
  { chave: 'mes', label: 'Este mês' },
] as const

function intervalo(chave: (typeof periodos)[number]['chave']) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const ate = new Date(hoje.getTime() + 864e5)
  const desde =
    chave === 'mes'
      ? new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      : new Date(hoje.getTime() - (Number(chave) - 1) * 864e5)
  return { desde: desde.toISOString(), ate: ate.toISOString() }
}

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`)

export function MargensPage() {
  const ehDono = useAuth().user?.papel === 'dono'
  const [periodo, setPeriodo] = useState<(typeof periodos)[number]['chave']>('30')
  const { desde, ate } = useMemo(() => intervalo(periodo), [periodo])
  const queryClient = useQueryClient()
  const margens = useQuery({
    queryKey: ['margens', desde, ate],
    queryFn: () => api.get<Margens>(`/margens?desde=${encodeURIComponent(desde)}&ate=${encodeURIComponent(ate)}`),
  })
  const salvarAlvo = useMutation({
    mutationFn: (cmv_alvo: number) => api.put('/margens/alvo', { cmv_alvo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['margens'] }),
  })
  const [alvo, setAlvo] = useState('')

  if (margens.isLoading || !margens.data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  const { resumo, produtos, cmv_alvo } = margens.data
  const ordenados = [...produtos].sort(
    (a, b) =>
      Number(b.acima_da_meta) - Number(a.acima_da_meta) ||
      Number(a.custo == null) - Number(b.custo == null) ||
      b.faturamento - a.faturamento,
  )
  const alertas = produtos.filter((p) => p.acima_da_meta).length
  const semCusto = produtos.filter((p) => p.custo == null).length

  async function trocarAlvo() {
    const n = Number(alvo.replace(',', '.'))
    if (!(n >= 5 && n <= 90)) return toast.error('Informe uma meta entre 5% e 90%')
    try {
      await salvarAlvo.mutateAsync(n)
      setAlvo('')
      toast.success(`Meta de CMV: ${n}%`)
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível salvar'))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Margens e CMV</h1>
          <p className="text-sm text-muted-foreground">
            Quanto cada produto custa de verdade, quanto sobra e onde o preço ficou defasado
          </p>
        </div>
        <div className="inline-flex rounded-lg border bg-card p-1">
          {periodos.map((p) => (
            <button
              key={p.chave}
              type="button"
              onClick={() => setPeriodo(p.chave)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                periodo === p.chave ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao icone={Receipt} titulo="Faturamento" valor={resumo.faturamento} />
        <Cartao icone={Tag} titulo="Custo dos produtos vendidos" valor={resumo.custo} />
        <Cartao icone={PiggyBank} titulo="Lucro bruto" valor={resumo.lucro_bruto} destaque />
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Percent className="size-3.5" />
            CMV do período
          </p>
          <p
            className={cn(
              'mt-1 font-heading text-2xl font-bold tabular-nums',
              resumo.cmv != null && resumo.cmv * 100 > cmv_alvo ? 'text-destructive' : 'text-emerald-700',
            )}
          >
            {pct(resumo.cmv)}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            meta {cmv_alvo}%
            {ehDono && (
              <>
                <Input
                  className="h-6 w-14 px-1.5 text-xs"
                  inputMode="decimal"
                  placeholder={String(cmv_alvo)}
                  value={alvo}
                  onChange={(e) => setAlvo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && trocarAlvo()}
                  aria-label="Nova meta de CMV"
                />
                {alvo && (
                  <button type="button" className="font-medium text-primary" onClick={trocarAlvo}>
                    salvar
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {alertas > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 font-medium text-destructive">
            <AlertTriangle className="size-4" />
            {alertas} produto(s) com custo acima da meta — reveja o preço
          </span>
        )}
        {semCusto > 0 && (
          <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
            {semCusto} produto(s) sem custo: cadastre o custo ou a ficha técnica
          </span>
        )}
        {resumo.faturamento_sem_custo > 0 && (
          <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
            {formatBRL(resumo.faturamento_sem_custo)} vendidos sem custo conhecido (fora do CMV)
          </span>
        )}
      </div>

      <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
        {ordenados.map((p) => (
          <LinhaProduto key={p.id} p={p} cmvAlvo={cmv_alvo} />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Referência de mercado: padarias com produção própria trabalham com CMV entre 35% e 42% do
        preço de venda. Vendas devolvidas não entram no cálculo.
      </p>
    </div>
  )
}

function Cartao({
  icone: Icone,
  titulo,
  valor,
  destaque,
}: {
  icone: typeof Receipt
  titulo: string
  valor: number
  destaque?: boolean
}) {
  const animado = useContagem(valor)
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icone className="size-3.5" />
        {titulo}
      </p>
      <p className={cn('mt-1 font-heading text-2xl font-bold tabular-nums', destaque && 'text-emerald-700')}>
        {formatBRL(animado)}
      </p>
    </div>
  )
}

function LinhaProduto({ p, cmvAlvo }: { p: ProdutoMargem; cmvAlvo: number }) {
  const atualizar = useUpdateProduto()
  const queryClient = useQueryClient()

  async function aplicar(campos: { preco_venda?: number; preco_custo?: number }, texto: string) {
    try {
      await atualizar.mutateAsync({ id: p.id, changes: campos })
      queryClient.invalidateQueries({ queryKey: ['margens'] })
      toast.success(texto)
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível atualizar o produto'))
    }
  }

  const margemPct = p.margem == null ? 0 : Math.max(0, Math.min(100, Math.round(p.margem * 100)))
  return (
    <li className={cn('flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:px-4', p.acima_da_meta && 'bg-destructive/5')}>
      <div className="flex min-w-0 items-center gap-3 sm:w-64">
        <IconeProduto produto={p} />
        <div className="min-w-0">
          <p className="truncate font-medium">{p.nome}</p>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {formatBRL(p.preco_venda)} / {p.unidade}
            {p.origem === 'receita' && (
              <span className="flex items-center gap-0.5 rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">
                <ChefHat className="size-3" />
                ficha técnica
              </span>
            )}
            {p.ficha_incompleta && <span className="text-amber-700">ingrediente sem custo</span>}
          </p>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-[11px] text-muted-foreground">Custo</p>
          <p className="font-medium tabular-nums">{p.custo == null ? 'sem custo' : formatBRL(p.custo)}</p>
        </div>
        <div>
          <p className="flex justify-between text-[11px] text-muted-foreground">
            <span>Margem</span>
            <span>CMV {pct(p.cmv)}</span>
          </p>
          <p className={cn('font-semibold tabular-nums', p.acima_da_meta ? 'text-destructive' : 'text-emerald-700')}>
            {pct(p.margem)}
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('barra-enche h-full rounded-full', p.acima_da_meta ? 'bg-destructive' : 'bg-emerald-500')}
              style={{ width: `${margemPct}%` }}
            />
          </div>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">No período</p>
          <p className="tabular-nums">
            {formatQuantidade(p.vendido)} {p.unidade}
          </p>
          {p.lucro_bruto != null && p.vendido > 0 && (
            <p className="text-[11px] text-emerald-700 tabular-nums">lucro {formatBRL(p.lucro_bruto)}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sm:w-56 sm:justify-end">
        {p.acima_da_meta && p.preco_sugerido != null && (
          <Button
            size="sm"
            onClick={() =>
              aplicar({ preco_venda: p.preco_sugerido! }, `${p.nome}: novo preço ${formatBRL(p.preco_sugerido!)}`)
            }
            disabled={atualizar.isPending}
            title={`Preço para o CMV ficar em ${cmvAlvo}%`}
          >
            <TrendingUp className="size-4" />
            Usar {formatBRL(p.preco_sugerido)}
          </Button>
        )}
        {p.origem === 'receita' && p.custo != null && Math.abs((p.preco_custo ?? -1) - p.custo) > 0.005 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              aplicar({ preco_custo: Math.round(p.custo! * 100) / 100 }, 'Custo do cadastro atualizado pela ficha técnica')
            }
            disabled={atualizar.isPending}
          >
            Atualizar custo no cadastro
          </Button>
        )}
      </div>
    </li>
  )
}
