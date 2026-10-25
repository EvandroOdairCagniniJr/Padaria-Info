import { Loader2, Plus, Trash2, Undo2, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { IconeProduto } from '@/components/IconeProduto'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/features/auth/AuthContext'
import {
  useDesfazerPerda,
  usePerdas,
  useRegistrarPerda,
  type MotivoPerda,
} from '@/features/producao/api'
import { useProdutos } from '@/features/produtos/api'
import { formatBRL, formatDataHora, formatQuantidade, mensagemErro } from '@/lib/format'
import { ehGestao } from '@/lib/permissoes'
import { cn } from '@/lib/utils'

const motivos: { value: MotivoPerda; label: string; emoji: string }[] = [
  { value: 'sobra', label: 'Sobra do dia', emoji: '🥖' },
  { value: 'vencido', label: 'Vencido', emoji: '📅' },
  { value: 'queimado', label: 'Queimado', emoji: '🔥' },
  { value: 'quebra', label: 'Caiu/quebrou', emoji: '💥' },
  { value: 'outro', label: 'Outro', emoji: '📝' },
]
const nomeMotivo = Object.fromEntries(motivos.map((m) => [m.value, m]))

const periodos = [
  { dias: 1, label: 'Hoje' },
  { dias: 7, label: '7 dias' },
  { dias: 30, label: '30 dias' },
]

function intervalo(dias: number) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const desde = new Date(hoje)
  desde.setDate(hoje.getDate() - (dias - 1))
  const ate = new Date(hoje)
  ate.setDate(hoje.getDate() + 1)
  return { desde: desde.toISOString(), ate: ate.toISOString() }
}

type Linha = { chave: number; produto_id: string; quantidade: string }

// Perdas: registrar o que foi para o lixo (ex.: sobras no fechamento) e ver quanto isso custa.
export function PerdasView() {
  const podeDesfazer = ehGestao(useAuth().user?.papel)
  const [dias, setDias] = useState(1)
  const { desde, ate } = useMemo(() => intervalo(dias), [dias])
  const perdas = usePerdas(desde, ate)
  const desfazer = useDesfazerPerda()
  const resumo = perdas.data?.resumo
  const perdidoTotal = resumo?.produtos.reduce((s, p) => s + p.perdido, 0) ?? 0
  const vendidoTotal = resumo?.produtos.reduce((s, p) => s + p.vendido, 0) ?? 0

  async function onDesfazer(id: string) {
    if (!confirm('Desfazer este registro? A quantidade volta para o estoque.')) return
    try {
      await desfazer.mutateAsync(id)
      toast.success('Registro desfeito')
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível desfazer'))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <RegistrarPerda />

      <div className="space-y-4">
        <div className="inline-flex rounded-lg border bg-card p-1">
          {periodos.map((p) => (
            <button
              key={p.dias}
              type="button"
              onClick={() => setDias(p.dias)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                dias === p.dias
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Indicador titulo="Dinheiro perdido" valor={resumo ? formatBRL(resumo.custo) : null} destaque />
          <Indicador
            titulo="Itens perdidos"
            valor={resumo ? formatQuantidade(perdidoTotal) : null}
          />
          <Indicador
            titulo="Perda sobre a produção"
            valor={
              resumo
                ? perdidoTotal + vendidoTotal > 0
                  ? `${Math.round((perdidoTotal / (perdidoTotal + vendidoTotal)) * 100)}%`
                  : '0%'
                : null
            }
            dica="dos produtos que tiveram perda"
          />
        </div>

        {perdas.isLoading ? (
          <Loader2 className="mx-auto my-8 size-6 animate-spin text-muted-foreground" />
        ) : !resumo || resumo.produtos.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-10 text-center">
            <p className="text-2xl">🎉</p>
            <p className="font-medium">Nenhuma perda registrada no período</p>
            <p className="text-sm text-muted-foreground">
              Registre as sobras no fechamento: é isso que deixa a sugestão de produção certeira.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border bg-card shadow-sm">
              <p className="border-b px-4 py-2.5 text-sm font-semibold">O que mais se perde</p>
              <ul className="divide-y">
                {resumo.produtos.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <IconeProduto produto={p} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.nome}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'barra-enche h-full rounded-full',
                              p.taxa > 0.15 ? 'bg-destructive' : p.taxa > 0.05 ? 'bg-amber-500' : 'bg-emerald-500',
                            )}
                            style={{ width: `${Math.max(3, Math.round(p.taxa * 100))}%` }}
                          />
                        </div>
                        <span className="w-24 text-right text-[11px] text-muted-foreground tabular-nums">
                          {Math.round(p.taxa * 100)}% perdido
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold tabular-nums">{formatBRL(p.custo)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatQuantidade(p.perdido)} {p.unidade}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border bg-card shadow-sm">
              <p className="border-b px-4 py-2.5 text-sm font-semibold">Registros</p>
              <ul className="divide-y">
                {perdas.data!.perdas.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="text-lg" title={nomeMotivo[r.motivo]?.label}>
                      {nomeMotivo[r.motivo]?.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <strong>
                          {formatQuantidade(r.quantidade)} {r.unidade}
                        </strong>{' '}
                        de {r.nome} · {nomeMotivo[r.motivo]?.label.toLowerCase()}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDataHora(r.created_at)}
                        {r.registrado_por && ` · ${r.registrado_por}`}
                        {r.observacao && ` · ${r.observacao}`}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatBRL(r.quantidade * r.custo_unitario)}
                    </span>
                    {podeDesfazer && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Desfazer (volta para o estoque)"
                        onClick={() => onDesfazer(r.id)}
                      >
                        <Undo2 className="size-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Indicador({
  titulo,
  valor,
  destaque,
  dica,
}: {
  titulo: string
  valor: string | null
  destaque?: boolean
  dica?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm" title={dica}>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={cn('mt-0.5 text-xl font-bold tabular-nums', destaque && 'text-destructive')}>
        {valor ?? <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </p>
    </div>
  )
}

let proximaChave = 1
const novaLinha = (): Linha => ({ chave: proximaChave++, produto_id: '', quantidade: '' })

function RegistrarPerda() {
  const { data: produtos } = useProdutos()
  const registrar = useRegistrarPerda()
  const [motivo, setMotivo] = useState<MotivoPerda>('sobra')
  const [linhas, setLinhas] = useState<Linha[]>(() => [novaLinha()])
  const [observacao, setObservacao] = useState('')
  const porId = useMemo(() => new Map((produtos ?? []).map((p) => [p.id, p])), [produtos])

  function mudar(chave: number, campo: 'produto_id' | 'quantidade', valor: string) {
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const itens = linhas
      .filter((l) => l.produto_id)
      .map((l) => ({ produto_id: l.produto_id, quantidade: Number(l.quantidade.replace(',', '.')) }))
    if (itens.length === 0) {
      toast.error('Escolha pelo menos um produto')
      return
    }
    if (itens.some((i) => !(i.quantidade > 0))) {
      toast.error('Informe a quantidade de cada produto')
      return
    }
    try {
      await registrar.mutateAsync({ itens, motivo, observacao: observacao.trim() || null })
      const custo = itens.reduce(
        (s, i) => s + i.quantidade * (porId.get(i.produto_id)?.preco_custo ?? 0),
        0,
      )
      toast.success(`Perda registrada${custo ? ` (${formatBRL(custo)})` : ''}`)
      setLinhas([novaLinha()])
      setObservacao('')
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível registrar'))
    }
  }

  return (
    <form onSubmit={onSubmit} className="h-fit space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
      <div>
        <p className="font-semibold">Registrar perda</p>
        <p className="text-xs text-muted-foreground">
          Sai do estoque e entra no cálculo da sugestão de produção.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {motivos.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMotivo(m.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              motivo === m.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            {m.emoji} {m.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {linhas.map((l) => (
          <div key={l.chave} className="flex gap-2">
            <Select value={l.produto_id} onValueChange={(v) => mudar(l.chave, 'produto_id', v)}>
              <SelectTrigger className="min-w-0 flex-1">
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                {(produtos ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              inputMode="decimal"
              placeholder={porId.get(l.produto_id)?.unidade ?? 'qtd'}
              className="w-20 tabular-nums"
              value={l.quantidade}
              onChange={(e) => mudar(l.chave, 'quantidade', e.target.value)}
            />
            {linhas.length > 1 && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                aria-label="Remover linha"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setLinhas((ls) => [...ls, novaLinha()])}
        >
          <Plus className="size-4" />
          Outro produto
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="obs-perda">Observação (opcional)</Label>
        <Input
          id="obs-perda"
          maxLength={255}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: forno desregulado"
        />
      </div>

      <Button type="submit" className="w-full" disabled={registrar.isPending}>
        {registrar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        Registrar perda
      </Button>
    </form>
  )
}
