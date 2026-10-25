import { CalendarDays, CalendarRange, Loader2, Pencil, PartyPopper, Sun, Target, TrendingUp } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/features/auth/AuthContext'
import {
  iniciosDosPeriodos,
  useMetas,
  useSalvarMetas,
  type MembroMetas,
  type PainelMetas,
  type PeriodoMeta,
  type Progresso,
  type ValoresMeta,
} from '@/features/metas/api'
import { formatBRL, mensagemErro } from '@/lib/format'
import { cn } from '@/lib/utils'

const periodos: { key: PeriodoMeta; titulo: string; curto: string; icone: typeof Sun }[] = [
  { key: 'dia', titulo: 'Hoje', curto: 'Dia', icone: Sun },
  { key: 'semana', titulo: 'Esta semana', curto: 'Semana', icone: CalendarRange },
  { key: 'mes', titulo: 'Este mês', curto: 'Mês', icone: CalendarDays },
]

// Quanto do período já passou (0–1): base da projeção "no ritmo atual".
function fracaoDecorrida(periodo: PeriodoMeta, agora = new Date()) {
  const { dia, semana, mes } = iniciosDosPeriodos(agora)
  const inicio = { dia, semana, mes }[periodo]
  const fim = new Date(inicio)
  if (periodo === 'dia') fim.setDate(fim.getDate() + 1)
  if (periodo === 'semana') fim.setDate(fim.getDate() + 7)
  if (periodo === 'mes') fim.setMonth(fim.getMonth() + 1)
  return Math.min(1, Math.max(0.01, (agora.getTime() - inicio.getTime()) / (fim.getTime() - inicio.getTime())))
}

export function MetasPage() {
  const { user } = useAuth()
  const metas = useMetas()
  const [editando, setEditando] = useState<string | null>(null)
  const ehDono = user?.papel === 'dono'
  const ehFuncionario = user?.papel === 'funcionario'

  if (metas.isLoading || !metas.data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  const dados = metas.data
  const semNenhuma =
    periodos.every((p) => dados.geral[p.key].meta == null) &&
    periodos.every((p) => dados.padrao[p.key] == null) &&
    dados.membros.every((m) => periodos.every((p) => m.individual[p.key] == null))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Metas</h1>
          <p className="text-sm text-muted-foreground">
            {ehFuncionario
              ? 'Acompanhe suas metas do dia, da semana e do mês'
              : 'Metas de vendas da padaria e de cada pessoa da equipe'}
          </p>
        </div>
        {ehDono && (
          <Button onClick={() => setEditando('geral')}>
            <Target className="size-4" />
            Definir metas
          </Button>
        )}
      </div>

      {semNenhuma && ehDono && (
        <div className="rounded-2xl border border-dashed bg-card p-6 text-center">
          <Target className="mx-auto size-8 text-primary" />
          <p className="mt-2 font-medium">Nenhuma meta definida ainda</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Defina quanto a padaria precisa vender por dia, semana e mês — e, se quiser, uma meta
            para cada pessoa da equipe. Todos acompanham o progresso em tempo real.
          </p>
        </div>
      )}

      {!ehFuncionario && (
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold">Padaria</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {periodos.map((p) => (
              <CartaoMeta key={p.key} periodo={p} progresso={dados.geral[p.key]} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold">
            {ehFuncionario ? 'Suas metas' : 'Equipe'}
          </h2>
          {!ehFuncionario && <PadraoEquipe padrao={dados.padrao} />}
        </div>
        {ehFuncionario && dados.membros[0] ? (
          <div className="grid gap-3 md:grid-cols-3">
            {periodos.map((p) => (
              <CartaoMeta key={p.key} periodo={p} progresso={dados.membros[0][p.key]} />
            ))}
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
            {dados.membros.map((m) => (
              <LinhaMembro
                key={m.id}
                membro={m}
                onEditar={ehDono ? () => setEditando(m.id) : undefined}
              />
            ))}
          </ul>
        )}
      </section>

      {ehDono && (
        <DialogMetas
          key={editando ?? ''}
          alvoInicial={editando}
          dados={dados}
          onFechar={() => setEditando(null)}
        />
      )}
    </div>
  )
}

function PadraoEquipe({ padrao }: { padrao: ValoresMeta }) {
  const partes = periodos
    .filter((p) => padrao[p.key] != null)
    .map((p) => `${p.curto.toLowerCase()} ${formatBRL(padrao[p.key]!)}`)
  return (
    <p className="text-xs text-muted-foreground">
      Padrão por pessoa: {partes.length ? partes.join(' · ') : 'nenhum'}
    </p>
  )
}

function CartaoMeta({
  periodo,
  progresso,
}: {
  periodo: (typeof periodos)[number]
  progresso: Progresso
}) {
  const { meta, vendido } = progresso
  const pct = meta ? Math.round((vendido / meta) * 100) : 0
  const atingida = meta != null && vendido >= meta
  const projecao = vendido / fracaoDecorrida(periodo.key)

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card p-4 shadow-sm',
        atingida && 'border-emerald-300 bg-emerald-50/60',
      )}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <periodo.icone className="size-4" />
        {periodo.titulo}
      </p>
      <p className="mt-1 font-heading text-3xl font-bold tabular-nums">{formatBRL(vendido)}</p>
      {meta == null ? (
        <p className="mt-2 text-sm text-muted-foreground">Sem meta definida</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">de {formatBRL(meta)}</p>
          <Barra pct={pct} atingida={atingida} className="mt-3 h-2.5" />
          <p className="mt-2 flex items-center gap-1.5 text-sm">
            {atingida ? (
              <>
                <PartyPopper className="size-4 text-emerald-600" />
                <span className="font-medium text-emerald-700">Meta atingida! ({pct}%)</span>
              </>
            ) : (
              <span>
                <span className="font-medium">{pct}%</span> · faltam{' '}
                <span className="font-medium tabular-nums">{formatBRL(meta - vendido)}</span>
              </span>
            )}
          </p>
          {periodo.key !== 'dia' && !atingida && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="size-3.5" />
              No ritmo atual: {formatBRL(projecao)}
              {projecao >= meta ? ' — dá para bater' : ' — precisa acelerar'}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function Barra({ pct, atingida, className }: { pct: number; atingida: boolean; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-full bg-muted', className)}>
      <div
        className={cn('h-full rounded-full transition-all', atingida ? 'bg-emerald-500' : 'bg-primary')}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  )
}

function LinhaMembro({ membro: m, onEditar }: { membro: MembroMetas; onEditar?: () => void }) {
  const propria = periodos.some((p) => m.individual[p.key] != null)
  return (
    <li className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5 sm:w-56">
        <Avatar nome={m.nome} foto={m.foto} tamanho="md" />
        <div className="min-w-0">
          <p className="truncate font-medium">{m.nome}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            {m.cargo || '—'}
            {propria && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                meta própria
              </Badge>
            )}
          </p>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-3">
        {periodos.map((p) => {
          const { meta, vendido } = m[p.key]
          const pct = meta ? Math.round((vendido / meta) * 100) : 0
          return (
            <div key={p.key} className="min-w-0">
              <p className="flex justify-between text-[11px] text-muted-foreground">
                <span>{p.curto}</span>
                {meta != null && <span className="tabular-nums">{pct}%</span>}
              </p>
              <p className="truncate text-sm font-semibold tabular-nums">{formatBRL(vendido)}</p>
              {meta != null ? (
                <>
                  <Barra pct={pct} atingida={vendido >= meta} className="mt-1 h-1.5" />
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    de {formatBRL(meta)}
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">sem meta</p>
              )}
            </div>
          )
        })}
      </div>
      {onEditar && (
        <Button size="icon" variant="ghost" onClick={onEditar} title="Definir metas desta pessoa">
          <Pencil className="size-4" />
        </Button>
      )}
    </li>
  )
}

function DialogMetas({
  alvoInicial,
  dados,
  onFechar,
}: {
  alvoInicial: string | null
  dados: PainelMetas
  onFechar: () => void
}) {
  const salvar = useSalvarMetas()
  const [alvo, setAlvo] = useState(alvoInicial ?? 'geral')

  function valoresDe(a: string): ValoresMeta {
    if (a === 'geral') {
      return { dia: dados.geral.dia.meta, semana: dados.geral.semana.meta, mes: dados.geral.mes.meta }
    }
    if (a === 'pessoa') return dados.padrao
    return dados.membros.find((m) => m.id === a)?.individual ?? { dia: null, semana: null, mes: null }
  }
  const paraCampo = (v: ValoresMeta) =>
    Object.fromEntries(periodos.map((p) => [p.key, v[p.key] == null ? '' : String(v[p.key])])) as Record<
      PeriodoMeta,
      string
    >
  const [campos, setCampos] = useState(() => paraCampo(valoresDe(alvo)))

  function trocarAlvo(novo: string) {
    setAlvo(novo)
    setCampos(paraCampo(valoresDe(novo)))
  }

  const membro = dados.membros.find((m) => m.id === alvo)
  const descricao =
    alvo === 'geral'
      ? 'Quanto a padaria inteira precisa vender, somando todas as vendas.'
      : alvo === 'pessoa'
        ? 'Vale para cada pessoa da equipe que não tem meta própria.'
        : `Meta própria de ${membro?.nome ?? 'esta pessoa'}. Deixe em branco para usar o padrão da equipe.`

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const valores = {} as ValoresMeta
    for (const p of periodos) {
      const texto = campos[p.key].replace(/\./g, '').replace(',', '.').trim()
      if (!texto) {
        valores[p.key] = null
        continue
      }
      const n = Number(texto)
      if (!(n > 0)) {
        toast.error(`Meta ${p.curto.toLowerCase()} inválida`)
        return
      }
      valores[p.key] = n
    }
    try {
      await salvar.mutateAsync({ alvo, ...valores })
      toast.success('Metas salvas')
      onFechar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível salvar as metas'))
    }
  }

  return (
    <Dialog open={alvoInicial !== null} onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Definir metas</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Meta de quem</Label>
            <Select value={alvo} onValueChange={trocarAlvo}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="geral">Padaria toda</SelectItem>
                <SelectItem value="pessoa">Padrão para cada pessoa da equipe</SelectItem>
                {dados.membros.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Meta individual</SelectLabel>
                    {dados.membros.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {periodos.map((p) => (
              <div key={p.key} className="space-y-1.5">
                <Label htmlFor={`meta-${p.key}`}>Por {p.curto.toLowerCase()}</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id={`meta-${p.key}`}
                    inputMode="decimal"
                    placeholder="—"
                    className="pl-8 tabular-nums"
                    value={campos[p.key]}
                    onChange={(e) => setCampos((c) => ({ ...c, [p.key]: e.target.value }))}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Deixe em branco o período que não precisa de meta. Vendas devolvidas não contam.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
              Salvar metas
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
