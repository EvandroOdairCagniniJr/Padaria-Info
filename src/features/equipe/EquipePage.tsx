import {
  ChefHat,
  Loader2,
  MoreHorizontal,
  Package,
  Plus,
  ShoppingCart,
  UserCheck,
  UserPen,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/features/auth/AuthContext'
import { PerfilDialog } from '@/features/auth/PerfilDialog'
import { useAlterarMembro, useAtividadeEquipe, useResumoEquipe } from '@/features/equipe/api'
import { AcessosRecentes } from '@/features/equipe/AcessosRecentes'
import { ConviteEquipe } from '@/features/equipe/ConviteEquipe'
import { MembroFormDialog } from '@/features/equipe/MembroFormDialog'
import { MuralEquipe } from '@/features/equipe/MuralEquipe'
import { NovidadesEquipe } from '@/features/equipe/Novidades'
import {
  formatBRL,
  formatDataHora,
  formatQuantidade,
  inicioDoDiaISO,
  mensagemErro,
  tempoRelativo,
} from '@/lib/format'
import { ehGestao, papelLabels } from '@/lib/permissoes'
import { cn } from '@/lib/utils'
import type { AtividadeEquipe, ResumoMembro } from '@/types/database'

const periodos = [
  { key: 'hoje', label: 'Hoje', diasAtras: 0 },
  { key: '7d', label: '7 dias', diasAtras: 6 },
  { key: '30d', label: '30 dias', diasAtras: 29 },
] as const

type Periodo = (typeof periodos)[number]['key']

const formaPagamentoLabels: Record<string, string> = {
  dinheiro: 'dinheiro',
  pix: 'Pix',
  cartao_debito: 'débito',
  cartao_credito: 'crédito',
}

const movimentacaoLabels: Record<string, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  ajuste: 'Ajuste para',
}

function descreverAtividade(a: AtividadeEquipe) {
  if (a.tipo === 'venda') {
    return `Venda de ${formatBRL(a.valor ?? 0)} (${formaPagamentoLabels[a.detalhe ?? ''] ?? a.detalhe})`
  }
  if (a.tipo === 'producao') {
    return `Concluiu produção: ${a.produto} (rende ${formatQuantidade(a.quantidade ?? 0)})`
  }
  return `${movimentacaoLabels[a.detalhe ?? ''] ?? a.detalhe} de ${formatQuantidade(a.quantidade ?? 0)} ${a.unidade ?? ''} — ${a.produto}`
}

const iconeAtividade = { venda: ShoppingCart, producao: ChefHat, estoque: Package }

export function EquipePage() {
  const { user } = useAuth()
  const ehDono = user?.papel === 'dono'
  const [periodo, setPeriodo] = useState<Periodo>('hoje')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ResumoMembro | null>(null)
  const [perfilAberto, setPerfilAberto] = useState(false)

  const periodoAtual = periodos.find((p) => p.key === periodo)!
  const desde = useMemo(() => inicioDoDiaISO(periodoAtual.diasAtras), [periodoAtual])
  const hoje = useMemo(() => inicioDoDiaISO(), [])

  function abrirMembro(membro: ResumoMembro | null) {
    setEditing(membro)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
          <p className="text-sm text-muted-foreground">
            Quem faz a padaria acontecer — e quem está vendendo mais
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border bg-card p-1">
            {periodos.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodo(p.key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  periodo === p.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => setPerfilAberto(true)}>
            <UserPen className="size-4" />
            Editar meu perfil
          </Button>
          {ehDono && (
            <Button onClick={() => abrirMembro(null)}>
              <Plus className="size-4" />
              Novo membro
            </Button>
          )}
        </div>
      </div>

      <MuralEquipe desde={desde} hoje={hoje} periodoLabel={periodoAtual.label} />

      {ehGestao(user?.papel) && <NovidadesEquipe />}

      {ehDono && <PainelDono desde={desde} hoje={hoje} onEditar={abrirMembro} />}
      {ehDono && <AcessosRecentes />}

      <MembroFormDialog open={dialogOpen} onOpenChange={setDialogOpen} membro={editing} />
      <PerfilDialog open={perfilAberto} onOpenChange={setPerfilAberto} />
    </div>
  )
}

// Só o dono: números da equipe, acessos e atividade de cada um.
function PainelDono({
  desde,
  hoje,
  onEditar,
}: {
  desde: string
  hoje: string
  onEditar: (membro: ResumoMembro) => void
}) {
  const [filtroMembro, setFiltroMembro] = useState<ResumoMembro | null>(null)
  const resumo = useResumoEquipe(desde, hoje)
  const atividade = useAtividadeEquipe(filtroMembro?.id ?? null)
  const alterarMembro = useAlterarMembro()

  const membros = resumo.data ?? []
  const ativos = membros.filter((m) => m.ativo)
  const totais = ativos.reduce(
    (t, m) => ({
      vendas: t.vendas + m.vendas,
      valor: t.valor + m.total_vendas,
      producoes: t.producoes + m.producoes,
    }),
    { vendas: 0, valor: 0, producoes: 0 },
  )
  // "Ativo agora": fez algo ou entrou até 30 min antes da última atualização (a cada minuto).
  const ativosAgora = ativos.filter(
    (m) =>
      m.ultima_atividade &&
      resumo.dataUpdatedAt - new Date(m.ultima_atividade).getTime() < 30 * 60_000,
  ).length

  async function alternarAcesso(membro: ResumoMembro) {
    const desativar = membro.ativo
    if (
      desativar &&
      !confirm(`Desativar o acesso de ${membro.nome}? A pessoa sai do sistema na hora.`)
    ) {
      return
    }
    try {
      await alterarMembro.mutateAsync({ id: membro.id, changes: { ativo: !desativar } })
      toast.success(
        desativar
          ? `Acesso de ${membro.nome} desativado`
          : `Acesso de ${membro.nome} liberado`,
      )
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao alterar acesso'))
    }
  }

  const stats = [
    {
      label: 'Membros ativos',
      value: String(ativos.length),
      detail: `${ativosAgora} ativo(s) agora`,
      icon: UserCheck,
    },
    {
      label: 'Vendas da equipe',
      value: formatBRL(totais.valor),
      detail: `${totais.vendas} venda(s)`,
      icon: ShoppingCart,
    },
    {
      label: 'Ticket médio',
      value: formatBRL(totais.vendas ? totais.valor / totais.vendas : 0),
      detail: 'valor médio por venda',
      icon: Package,
    },
    {
      label: 'Produções concluídas',
      value: String(totais.producoes),
      detail: 'fornadas no período',
      icon: ChefHat,
    },
  ]

  return (
    <section className="space-y-4">
      <h2 className="font-heading text-lg font-semibold">Painel do dono</h2>

      <ConviteEquipe />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {resumo.isLoading ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : (
                  stat.value
                )}
              </div>
              <p className="text-xs text-muted-foreground">{stat.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membro</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Total vendido</TableHead>
              <TableHead className="text-right">Ticket médio</TableHead>
              <TableHead className="text-right">Produções</TableHead>
              <TableHead className="text-right">Ajustes de estoque</TableHead>
              <TableHead>Última atividade</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {resumo.isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </TableCell>
              </TableRow>
            )}

            {membros.map((m) => (
              <TableRow key={m.id} className={cn(!m.ativo && m.ultimo_acesso && 'opacity-50')}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar nome={m.nome || m.email} foto={m.foto} tamanho="sm" />
                    <span className="font-medium">{m.nome || m.email}</span>
                    <Badge variant={m.papel === 'funcionario' ? 'outline' : 'secondary'}>
                      {papelLabels[m.papel]}
                    </Badge>
                    {!m.ativo &&
                      (m.ultimo_acesso ? (
                        <Badge variant="destructive">Desativado</Badge>
                      ) : (
                        // Conta criada pela própria pessoa na tela de login.
                        <Badge className="bg-amber-500 text-white">Aguardando liberação</Badge>
                      ))}
                  </div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </TableCell>
                <TableCell className="text-right">{m.vendas}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatBRL(m.total_vendas)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {m.vendas ? formatBRL(m.total_vendas / m.vendas) : '—'}
                </TableCell>
                <TableCell className="text-right">{m.producoes}</TableCell>
                <TableCell className="text-right">{m.movimentacoes}</TableCell>
                <TableCell className="text-muted-foreground">
                  <span title={m.ultima_atividade ? formatDataHora(m.ultima_atividade) : undefined}>
                    {tempoRelativo(m.ultima_atividade)}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${m.nome}`}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setFiltroMembro(m)}>
                        Ver atividade
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEditar(m)}>
                        Editar / redefinir senha
                      </DropdownMenuItem>
                      {m.papel !== 'dono' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant={m.ativo ? 'destructive' : 'default'}
                            onClick={() => alternarAcesso(m)}
                          >
                            {m.ativo
                              ? 'Desativar acesso'
                              : m.ultimo_acesso
                                ? 'Reativar acesso'
                                : 'Liberar acesso'}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">
            Atividade recente{filtroMembro ? ` — ${filtroMembro.nome}` : ' da equipe'}
          </CardTitle>
          {filtroMembro && (
            <Button variant="ghost" size="sm" onClick={() => setFiltroMembro(null)}>
              <X className="size-3.5" />
              Ver todos
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {atividade.isLoading ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : (atividade.data?.length ?? 0) === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma atividade ainda
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {atividade.data?.map((a) => {
                const Icone = iconeAtividade[a.tipo]
                return (
                  <li key={`${a.tipo}-${a.id}`} className="flex items-center gap-3 py-2">
                    <Icone className="size-4 shrink-0 text-muted-foreground" />
                    <span className="w-32 shrink-0 text-muted-foreground">
                      {formatDataHora(a.quando)}
                    </span>
                    <span className="w-32 shrink-0 truncate font-medium">
                      {a.usuario_nome ?? '—'}
                    </span>
                    <span className="truncate">{descreverAtividade(a)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

    </section>
  )
}
