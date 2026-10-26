import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChefHat,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Plus,
  Truck,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { IconeProduto } from '@/components/IconeProduto'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useEncomendas,
  useMudarStatusEncomenda,
  type Encomenda,
  type StatusEncomenda,
} from '@/features/encomendas/api'
import { EncomendaDialog } from '@/features/encomendas/EncomendaDialog'
import { EntregarDialog } from '@/features/encomendas/EntregarDialog'
import { usePadaria } from '@/features/padaria/api'
import { linkWhatsapp, normalizarWhatsapp } from '@/features/pdv/comprovante'
import { mascaraTelefone } from '@/lib/documentos'
import { formatBRL, formatQuantidade, mensagemErro } from '@/lib/format'
import { cn } from '@/lib/utils'

const statusInfo: Record<StatusEncomenda, { label: string; classe: string }> = {
  reservada: { label: 'Reservada', classe: 'bg-slate-100 text-slate-700' },
  confirmada: { label: 'Confirmada', classe: 'bg-sky-100 text-sky-800' },
  em_producao: { label: 'Em produção', classe: 'bg-amber-100 text-amber-800' },
  pronta: { label: 'Pronta', classe: 'bg-emerald-100 text-emerald-800' },
  entregue: { label: 'Entregue', classe: 'bg-muted text-muted-foreground' },
  cancelada: { label: 'Cancelada', classe: 'bg-destructive/10 text-destructive' },
}

// Próximo passo natural de cada status (botão principal do cartão).
const proximo: Partial<Record<StatusEncomenda, { status: StatusEncomenda; label: string; icone: typeof Check }>> = {
  reservada: { status: 'confirmada', label: 'Confirmar', icone: Check },
  confirmada: { status: 'em_producao', label: 'Iniciar produção', icone: ChefHat },
  em_producao: { status: 'pronta', label: 'Marcar pronta', icone: PackageCheck },
}

type Aba = 'proximas' | 'concluidas'

function inicioDoDia(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function rotuloDia(data: Date) {
  const hoje = inicioDoDia(new Date())
  const dias = Math.round((inicioDoDia(data).getTime() - hoje.getTime()) / 864e5)
  const extenso = data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  if (dias === 0) return `Hoje · ${extenso}`
  if (dias === 1) return `Amanhã · ${extenso}`
  return extenso.charAt(0).toUpperCase() + extenso.slice(1)
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function EncomendasPage() {
  const [aba, setAba] = useState<Aba>('proximas')
  const [editando, setEditando] = useState<Encomenda | 'nova' | null>(null)
  const [entregando, setEntregando] = useState<Encomenda | null>(null)

  const { desde, ate } = useMemo(() => {
    const hoje = inicioDoDia(new Date())
    return aba === 'proximas'
      ? { desde: hoje.toISOString(), ate: new Date(hoje.getTime() + 60 * 864e5).toISOString() }
      : { desde: new Date(hoje.getTime() - 30 * 864e5).toISOString(), ate: new Date(hoje.getTime() + 864e5).toISOString() }
  }, [aba])
  const encomendas = useEncomendas(desde, ate)

  // Hora de referência para "atrasada" (o painel atualiza sozinho a cada 20 s).
  const [agora] = useState(() => Date.now())
  const lista = (encomendas.data ?? []).filter((e) =>
    aba === 'proximas'
      ? e.status !== 'entregue' && e.status !== 'cancelada'
      : e.status === 'entregue' || e.status === 'cancelada',
  )
  const atrasadas = aba === 'proximas' ? lista.filter((e) => new Date(e.retirada_em).getTime() < agora) : []
  const restantes = lista.filter((e) => !atrasadas.includes(e))
  const dias: { chave: string; data: Date; itens: Encomenda[] }[] = []
  for (const e of aba === 'concluidas' ? [...restantes].reverse() : restantes) {
    const data = new Date(e.retirada_em)
    const chave = data.toDateString()
    let g = dias.at(-1)
    if (!g || g.chave !== chave) dias.push((g = { chave, data, itens: [] }))
    g.itens.push(e)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Encomendas</h1>
          <p className="text-sm text-muted-foreground">
            Bolos, salgados e pedidos agendados, com sinal e retirada
          </p>
        </div>
        <Button onClick={() => setEditando('nova')}>
          <Plus className="size-4" />
          Nova encomenda
        </Button>
      </div>

      <div className="inline-flex rounded-lg border bg-card p-1">
        {(
          [
            ['proximas', 'Próximas'],
            ['concluidas', 'Entregues e canceladas'],
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setAba(valor)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              aba === valor ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {encomendas.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-14 text-center">
          <CalendarClock className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 font-medium">
            {aba === 'proximas' ? 'Nenhuma encomenda agendada' : 'Nada entregue nos últimos 30 dias'}
          </p>
          {aba === 'proximas' && (
            <p className="text-sm text-muted-foreground">
              Registre bolos e pedidos de festa para não esquecer nenhum detalhe.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {atrasadas.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-destructive">
                <AlertTriangle className="size-4" />
                Atrasadas ({atrasadas.length})
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {atrasadas.map((e) => (
                  <CartaoEncomenda key={e.id} e={e} atrasada onEditar={() => setEditando(e)} onEntregar={() => setEntregando(e)} />
                ))}
              </div>
            </section>
          )}
          {dias.map((d) => (
            <section key={d.chave}>
              <h2 className="mb-2 text-sm font-semibold">{rotuloDia(d.data)}</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {d.itens.map((e) => (
                  <CartaoEncomenda key={e.id} e={e} onEditar={() => setEditando(e)} onEntregar={() => setEntregando(e)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <EncomendaDialog
        key={editando === 'nova' ? 'nova' : (editando?.id ?? '')}
        encomenda={editando === 'nova' ? null : editando}
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
      />
      <EntregarDialog key={entregando?.id ?? ''} encomenda={entregando} onFechar={() => setEntregando(null)} />
    </div>
  )
}

function CartaoEncomenda({
  e,
  atrasada,
  onEditar,
  onEntregar,
}: {
  e: Encomenda
  atrasada?: boolean
  onEditar: () => void
  onEntregar: () => void
}) {
  const mudar = useMudarStatusEncomenda()
  const padaria = usePadaria()
  const aberta = e.status !== 'entregue' && e.status !== 'cancelada'
  const falta = Math.max(0, e.total - e.sinal)
  const passo = proximo[e.status]
  const whatsapp = e.cliente_telefone ? normalizarWhatsapp(e.cliente_telefone) : null
  const nomePadaria = padaria.data?.nome_fantasia ?? 'padaria'
  const primeiroNome = e.cliente_nome.split(' ')[0]
  const quando = `${new Date(e.retirada_em).toLocaleDateString('pt-BR')} às ${hora(e.retirada_em)}`

  const mensagem =
    e.status === 'pronta'
      ? `Olá, ${primeiroNome}! Sua encomenda nº ${e.numero} da ${nomePadaria} está pronta${e.entrega ? ' e já vai sair para entrega' : ' para retirada'} 😊${falta > 0 ? ` Falta pagar ${formatBRL(falta)}.` : ''}`
      : `Olá, ${primeiroNome}! Confirmamos sua encomenda nº ${e.numero} na ${nomePadaria} para ${quando}. Total ${formatBRL(e.total)}${e.sinal > 0 ? `, sinal recebido ${formatBRL(e.sinal)}` : ''}${falta > 0 ? `, falta ${formatBRL(falta)}` : ''}. Obrigado!`

  async function irPara(status: StatusEncomenda, texto: string) {
    try {
      await mudar.mutateAsync({ id: e.id, status })
      toast.success(texto)
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível atualizar'))
    }
  }

  return (
    <article
      className={cn(
        'flex flex-col rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md',
        atrasada && 'border-destructive/50',
        e.status === 'pronta' && 'border-emerald-300',
      )}
    >
      <header className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
          <span className="text-[10px] leading-none font-medium">nº</span>
          <span className="font-heading text-lg leading-none font-bold">{e.numero}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{e.cliente_nome}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className={cn('font-medium', atrasada && 'text-destructive')}>
              {e.entrega ? <Truck className="mr-1 inline size-3.5" /> : null}
              {atrasada ? quando : hora(e.retirada_em)}
            </span>
            {e.cliente_telefone && <span>{mascaraTelefone(e.cliente_telefone)}</span>}
          </p>
        </div>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', statusInfo[e.status].classe)}>
          {statusInfo[e.status].label}
        </span>
        {aberta && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label="Mais ações">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEditar}>
                <Pencil className="size-4" />
                Editar
              </DropdownMenuItem>
              {e.status !== 'pronta' && (
                <DropdownMenuItem onClick={() => irPara('pronta', `Encomenda nº ${e.numero} pronta`)}>
                  <PackageCheck className="size-4" />
                  Marcar pronta
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  confirm(`Cancelar a encomenda nº ${e.numero} de ${e.cliente_nome}?`) &&
                  irPara('cancelada', 'Encomenda cancelada')
                }
              >
                <X className="size-4" />
                Cancelar encomenda
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <ul className="mt-3 space-y-1.5">
        {e.itens.map((i) => (
          <li key={i.id} className="flex items-center gap-2 text-sm">
            <IconeProduto produto={i} />
            <span className="min-w-0 flex-1 truncate">
              <strong className="tabular-nums">{formatQuantidade(i.quantidade)}</strong> {i.unidade} · {i.nome}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{formatBRL(i.subtotal)}</span>
          </li>
        ))}
      </ul>
      {e.observacoes && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">📝 {e.observacoes}</p>
      )}
      {e.entrega && e.endereco && (
        <p className="mt-2 text-xs text-muted-foreground">
          <Truck className="mr-1 inline size-3.5" />
          {e.endereco}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">
          Total <strong className="text-foreground tabular-nums">{formatBRL(e.total)}</strong>
          {e.sinal > 0 && <> · sinal {formatBRL(e.sinal)}</>}
        </span>
        {e.status !== 'cancelada' && (
          <span className={cn('font-semibold tabular-nums', falta > 0 ? 'text-amber-700' : 'text-emerald-700')}>
            {falta > 0 ? `Falta ${formatBRL(falta)}` : 'Pago ✓'}
          </span>
        )}
      </div>

      {aberta && (
        <div className="mt-3 flex flex-wrap gap-2">
          {whatsapp && (
            <Button size="sm" variant="outline" asChild>
              <a href={linkWhatsapp(whatsapp, mensagem)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" />
                {e.status === 'pronta' ? 'Avisar que está pronta' : 'Enviar confirmação'}
              </a>
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            {passo && (
              <Button
                size="sm"
                variant="secondary"
                disabled={mudar.isPending}
                onClick={() => irPara(passo.status, `Encomenda nº ${e.numero}: ${statusInfo[passo.status].label.toLowerCase()}`)}
              >
                <passo.icone className="size-4" />
                {passo.label}
              </Button>
            )}
            <Button size="sm" onClick={onEntregar}>
              <PackageCheck className="size-4" />
              Entregar
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}
