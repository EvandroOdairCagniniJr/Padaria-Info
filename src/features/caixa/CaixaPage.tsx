import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CreditCard,
  History,
  Loader2,
  Lock,
  LockOpen,
  QrCode,
  Wallet,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
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
import { useAuth } from '@/features/auth/AuthContext'
import {
  formasCaixa,
  useAbrirCaixa,
  useCaixaAtual,
  useFecharCaixa,
  useHistoricoCaixa,
  useMovimentoCaixa,
  type Caixa,
  type FormaCaixa,
  type ResumoCaixa,
} from '@/features/caixa/api'
import { formatBRL, formatDataHora, mensagemErro } from '@/lib/format'
import { ehGestao } from '@/lib/permissoes'
import { useContagem } from '@/lib/useContagem'
import { cn } from '@/lib/utils'

const icones: Record<FormaCaixa, typeof Banknote> = {
  dinheiro: Banknote,
  pix: QrCode,
  cartao_debito: CreditCard,
  cartao_credito: CreditCard,
}

const lerValor = (v: string) => Number(v.replace(/\./g, '').replace(',', '.'))

export function CaixaPage() {
  const gestao = ehGestao(useAuth().user?.papel)
  const atual = useCaixaAtual()
  const [aba, setAba] = useState<'meu' | 'historico'>('meu')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Caixa</h1>
          <p className="text-sm text-muted-foreground">
            Abertura com fundo de troco, sangria, suprimento e fechamento com conferência
          </p>
        </div>
        {gestao && (
          <div className="inline-flex rounded-lg border bg-card p-1">
            {(
              [
                ['meu', 'Meu caixa'],
                ['historico', 'Todos os caixas'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setAba(v)}
                className={cn(
                  'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                  aba === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      {aba === 'historico' ? (
        <HistoricoCaixas />
      ) : atual.isLoading || !atual.data ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : atual.data.caixa ? (
        <CaixaAberto caixa={atual.data.caixa} />
      ) : (
        <AbrirCaixa sugerido={atual.data.fundo_sugerido ?? null} />
      )}
    </div>
  )
}

function AbrirCaixa({ sugerido }: { sugerido: number | null }) {
  const abrir = useAbrirCaixa()
  const [fundo, setFundo] = useState(sugerido != null ? String(sugerido).replace('.', ',') : '')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const valor = fundo.trim() ? lerValor(fundo) : 0
    if (!(valor >= 0)) return toast.error('Fundo de troco inválido')
    try {
      await abrir.mutateAsync(valor)
      toast.success('Caixa aberto. Boas vendas! 🥖')
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível abrir o caixa'))
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4 rounded-2xl border bg-card p-6 text-center shadow-sm">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <LockOpen className="size-7" />
      </span>
      <div>
        <p className="text-lg font-semibold">Seu caixa está fechado</p>
        <p className="text-sm text-muted-foreground">
          Conte o dinheiro da gaveta (o troco) e abra o caixa. As vendas passam a entrar nele.
        </p>
      </div>
      <div className="space-y-1.5 text-left">
        <Label htmlFor="fundo">Fundo de troco</Label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
          <Input
            id="fundo"
            inputMode="decimal"
            autoFocus
            placeholder="0,00"
            className="h-12 pl-10 text-lg tabular-nums"
            value={fundo}
            onChange={(e) => setFundo(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Padarias costumam trabalhar com R$ 300 a R$ 500 em notas pequenas e moedas.
        </p>
      </div>
      <Button type="submit" className="h-11 w-full" disabled={abrir.isPending}>
        {abrir.isPending && <Loader2 className="size-4 animate-spin" />}
        Abrir caixa
      </Button>
    </form>
  )
}

function Valor({ valor }: { valor: number }) {
  return <>{formatBRL(useContagem(valor))}</>
}

function CaixaAberto({ caixa }: { caixa: Caixa & { resumo: ResumoCaixa } }) {
  const r = caixa.resumo
  const [movimento, setMovimento] = useState<'sangria' | 'suprimento' | null>(null)
  const [fechando, setFechando] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
        <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
          <LockOpen className="size-5" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-emerald-900">Caixa aberto</p>
          <p className="text-emerald-800/80">
            Desde {formatDataHora(caixa.aberto_em)} · fundo de troco {formatBRL(caixa.fundo_troco)}
          </p>
        </div>
        <Button variant="outline" onClick={() => setMovimento('suprimento')}>
          <ArrowDownCircle className="size-4" />
          Suprimento
        </Button>
        <Button variant="outline" onClick={() => setMovimento('sangria')}>
          <ArrowUpCircle className="size-4" />
          Sangria
        </Button>
        <Button onClick={() => setFechando(true)}>
          <Lock className="size-4" />
          Fechar caixa
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.2fr_2fr]">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Wallet className="size-4" />
            Dinheiro esperado na gaveta
          </p>
          <p className="mt-1 font-heading text-4xl font-bold tabular-nums">
            <Valor valor={r.esperado.dinheiro} />
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            fundo {formatBRL(caixa.fundo_troco)} + vendas em dinheiro {formatBRL(r.recebido.dinheiro)}
            {r.suprimentos > 0 && ` + suprimentos ${formatBRL(r.suprimentos)}`}
            {r.sangrias > 0 && ` − sangrias ${formatBRL(r.sangrias)}`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {formasCaixa.map((f) => {
            const Icone = icones[f.value]
            return (
              <div key={f.value} className="rounded-2xl border bg-card p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icone className="size-3.5" />
                  {f.label}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums">
                  <Valor valor={r.recebido[f.value]} />
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">{r.quantidade_vendas}</strong> venda(s) ·{' '}
        <strong className="text-foreground">{formatBRL(r.total_recebido)}</strong> recebidos
        {r.sinais > 0 && ` · ${r.sinais} sinal(is) de encomenda`}
        {r.devolvidas.quantidade > 0 &&
          ` · ${r.devolvidas.quantidade} devolução(ões) (${formatBRL(r.devolvidas.valor)}) já descontada(s)`}
      </p>

      {r.movimentos.length > 0 && (
        <div className="rounded-2xl border bg-card shadow-sm">
          <p className="border-b px-4 py-2.5 text-sm font-semibold">Sangrias e suprimentos</p>
          <ul className="divide-y">
            {r.movimentos.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                {m.tipo === 'sangria' ? (
                  <ArrowUpCircle className="size-4 text-amber-600" />
                ) : (
                  <ArrowDownCircle className="size-4 text-emerald-600" />
                )}
                <span className="flex-1">
                  {m.tipo === 'sangria' ? 'Sangria' : 'Suprimento'}
                  {m.motivo && <span className="text-muted-foreground"> · {m.motivo}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{formatDataHora(m.created_at)}</span>
                <span className={cn('font-semibold tabular-nums', m.tipo === 'sangria' ? 'text-amber-700' : 'text-emerald-700')}>
                  {m.tipo === 'sangria' ? '−' : '+'} {formatBRL(m.valor)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <MovimentoDialog key={movimento ?? ''} tipo={movimento} disponivel={r.esperado.dinheiro} onFechar={() => setMovimento(null)} />
      {fechando && <FecharDialog resumo={r} onFechar={() => setFechando(false)} />}
    </div>
  )
}

function MovimentoDialog({
  tipo,
  disponivel,
  onFechar,
}: {
  tipo: 'sangria' | 'suprimento' | null
  disponivel: number
  onFechar: () => void
}) {
  const registrar = useMovimentoCaixa()
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const v = lerValor(valor)
    if (!(v > 0) || !tipo) return toast.error('Informe o valor')
    try {
      await registrar.mutateAsync({ tipo, valor: v, motivo: motivo.trim() || null })
      toast.success(tipo === 'sangria' ? `Sangria de ${formatBRL(v)} registrada` : `Suprimento de ${formatBRL(v)} registrado`)
      onFechar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível registrar'))
    }
  }

  return (
    <Dialog open={tipo !== null} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tipo === 'sangria' ? 'Sangria' : 'Suprimento'}</DialogTitle>
          <DialogDescription>
            {tipo === 'sangria'
              ? `Retirada de dinheiro da gaveta (ex.: levar ao cofre). Na gaveta: ${formatBRL(disponivel)}.`
              : 'Dinheiro colocado na gaveta (ex.: reforço de troco).'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
            <Input autoFocus inputMode="decimal" className="h-11 pl-10 text-lg tabular-nums" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <Input
            placeholder={tipo === 'sangria' ? 'Motivo (ex.: cofre, pagamento de fornecedor)' : 'Motivo (ex.: moedas)'}
            value={motivo}
            maxLength={255}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={registrar.isPending}>
              {registrar.isPending && <Loader2 className="size-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const cedulas = [200, 100, 50, 20, 10, 5, 2]

// Fechamento: conta cédula por cédula (ou digita o total) e confere com o esperado.
function FecharDialog({ resumo, onFechar }: { resumo: ResumoCaixa; onFechar: () => void }) {
  const fechar = useFecharCaixa()
  const [qtd, setQtd] = useState<Record<number, string>>({})
  const [moedas, setMoedas] = useState('')
  const [outros, setOutros] = useState<Record<string, string>>({})
  const [obs, setObs] = useState('')
  const [resultado, setResultado] = useState<number | null>(null)

  const contado = useMemo(
    () =>
      cedulas.reduce((s, c) => s + c * (Number(qtd[c]) || 0), 0) + (moedas.trim() ? lerValor(moedas) || 0 : 0),
    [qtd, moedas],
  )
  const diferenca = Math.round((contado - resumo.esperado.dinheiro) * 100) / 100

  async function confirmar() {
    const extras: Record<string, number> = {}
    for (const f of formasCaixa) {
      if (f.value !== 'dinheiro' && outros[f.value]?.trim()) extras[f.value] = lerValor(outros[f.value])
    }
    try {
      const r = await fechar.mutateAsync({ contado: { dinheiro: contado, ...extras }, observacoes: obs.trim() || null })
      setResultado(r.diferenca)
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível fechar o caixa'))
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        {resultado != null ? (
          <div className="space-y-4 py-2 text-center">
            <span
              className={cn(
                'venda-circulo mx-auto flex size-16 items-center justify-center rounded-full text-white',
                resultado === 0 ? 'bg-emerald-500' : 'bg-amber-500',
              )}
            >
              <Lock className="size-7" />
            </span>
            <DialogTitle>Caixa fechado</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {resultado === 0
                ? 'Tudo certo: o dinheiro contado bateu com o esperado. 👏'
                : resultado > 0
                  ? `Sobraram ${formatBRL(resultado)} na gaveta.`
                  : `Faltaram ${formatBRL(-resultado)} na gaveta.`}
            </p>
            <Button className="w-full" onClick={onFechar}>
              Concluir
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Fechar caixa</DialogTitle>
              <DialogDescription>Conte o dinheiro da gaveta. O sistema compara com o esperado.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {cedulas.map((c) => (
                <label key={c} className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm">
                  <span className="w-12 font-medium tabular-nums">R$ {c}</span>
                  <Input
                    inputMode="numeric"
                    className="h-8 px-2 tabular-nums"
                    placeholder="0"
                    value={qtd[c] ?? ''}
                    onChange={(e) => setQtd((q) => ({ ...q, [c]: e.target.value.replace(/\D/g, '') }))}
                  />
                </label>
              ))}
              <label className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm">
                <span className="w-12 font-medium">Moedas</span>
                <Input
                  inputMode="decimal"
                  className="h-8 px-2 tabular-nums"
                  placeholder="R$"
                  value={moedas}
                  onChange={(e) => setMoedas(e.target.value)}
                />
              </label>
            </div>

            <div className="space-y-1.5 rounded-xl border p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Esperado em dinheiro</span>
                <span className="tabular-nums">{formatBRL(resumo.esperado.dinheiro)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contado</span>
                <span className="font-semibold tabular-nums">{formatBRL(contado)}</span>
              </div>
              <div
                className={cn(
                  'flex justify-between border-t pt-1.5 font-semibold',
                  diferenca === 0 ? 'text-emerald-700' : diferenca > 0 ? 'text-sky-700' : 'text-destructive',
                )}
              >
                <span>{diferenca === 0 ? 'Bateu certinho' : diferenca > 0 ? 'Sobra' : 'Falta'}</span>
                <span className="tabular-nums">{formatBRL(Math.abs(diferenca))}</span>
              </div>
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Conferir Pix e cartões (opcional)</summary>
              <div className="mt-2 space-y-2">
                {formasCaixa
                  .filter((f) => f.value !== 'dinheiro')
                  .map((f) => (
                    <label key={f.value} className="flex items-center gap-2">
                      <span className="w-20">{f.label}</span>
                      <span className="w-28 text-xs text-muted-foreground">
                        sistema: {formatBRL(resumo.esperado[f.value])}
                      </span>
                      <Input
                        inputMode="decimal"
                        className="h-8"
                        placeholder="valor na maquininha/extrato"
                        value={outros[f.value] ?? ''}
                        onChange={(e) => setOutros((o) => ({ ...o, [f.value]: e.target.value }))}
                      />
                    </label>
                  ))}
              </div>
            </details>

            <Input placeholder="Observações (opcional)" maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)} />

            <DialogFooter>
              <Button variant="outline" onClick={onFechar}>
                Voltar
              </Button>
              <Button onClick={confirmar} disabled={fechar.isPending}>
                {fechar.isPending && <Loader2 className="size-4 animate-spin" />}
                Fechar caixa
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function HistoricoCaixas() {
  const [dias, setDias] = useState(7)
  const { desde, ate } = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    return {
      desde: new Date(hoje.getTime() - (dias - 1) * 864e5).toISOString(),
      ate: new Date(hoje.getTime() + 864e5).toISOString(),
    }
  }, [dias])
  const historico = useHistoricoCaixa(desde, ate, true)
  const lista = historico.data ?? []
  const quebra = lista.reduce((s, c) => s + (c.diferenca ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border bg-card p-1">
          {[1, 7, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDias(d)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                dias === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {d === 1 ? 'Hoje' : `${d} dias`}
            </button>
          ))}
        </div>
        {lista.length > 0 && (
          <p className={cn('text-sm font-medium', quebra < 0 ? 'text-destructive' : 'text-muted-foreground')}>
            Diferença acumulada: {quebra < 0 ? '−' : quebra > 0 ? '+' : ''}
            {formatBRL(Math.abs(quebra))}
          </p>
        )}
      </div>
      {historico.isLoading ? (
        <Loader2 className="mx-auto my-8 size-6 animate-spin text-muted-foreground" />
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          <History className="mx-auto mb-2 size-7" />
          Nenhum caixa aberto no período.
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
          {lista.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-lg',
                  c.fechado_em ? 'bg-muted text-muted-foreground' : 'bg-emerald-100 text-emerald-700',
                )}
              >
                {c.fechado_em ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.operador_nome}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDataHora(c.aberto_em)}
                  {c.fechado_em ? ` → ${formatDataHora(c.fechado_em)}` : ' · aberto agora'}
                  {c.observacoes && ` · ${c.observacoes}`}
                </p>
              </div>
              <div className="text-right">
                <p className="tabular-nums">
                  {formatBRL(c.resumo?.total_recebido ?? 0)}
                </p>
                <p className="text-[11px] text-muted-foreground">recebido</p>
              </div>
              <div className="w-28 text-right">
                {c.diferenca == null ? (
                  <span className="text-xs text-muted-foreground">em andamento</span>
                ) : (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      c.diferenca === 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : c.diferenca > 0
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-destructive/10 text-destructive',
                    )}
                  >
                    {c.diferenca === 0 ? 'bateu' : `${c.diferenca > 0 ? 'sobra' : 'falta'} ${formatBRL(Math.abs(c.diferenca))}`}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
