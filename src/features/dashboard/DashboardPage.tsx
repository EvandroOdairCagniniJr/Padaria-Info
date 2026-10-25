import {
  AlertTriangle,
  ArrowRight,
  Store,
  CalendarClock,
  ChefHat,
  DollarSign,
  Loader2,
  Package,
} from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useAuth } from '@/features/auth/AuthContext'
import { useVendasHoje } from '@/features/dashboard/api'
import { useMural } from '@/features/equipe/api'
import { usePadaria } from '@/features/padaria/api'
import { useContasFinanceiras } from '@/features/financeiro/api'
import { useProducoes, useReceitas } from '@/features/producao/api'
import { useProdutos } from '@/features/produtos/api'
import {
  adicionarDias,
  formatBRL,
  formatData,
  formatDataHora,
  formatQuantidade,
  hojeISO,
  inicioDoDiaISO,
} from '@/lib/format'

const formaPagamentoLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_debito: 'Débito',
  cartao_credito: 'Crédito',
}

function saudacao() {
  const hora = new Date().getHours()
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
}

export function DashboardPage() {
  const { user } = useAuth()
  const produtos = useProdutos()
  const vendas = useVendasHoje()
  const contas = useContasFinanceiras()
  const producoes = useProducoes()
  const receitas = useReceitas()
  const padaria = usePadaria()
  // Instalações antigas: o dono ainda não preencheu os dados da padaria.
  const faltaPadaria = user?.papel === 'dono' && padaria.isSuccess && !padaria.data

  const hoje = hojeISO()
  const inicioHoje = useMemo(() => inicioDoDiaISO(), [])
  const mural = useMural(inicioHoje, inicioHoje)
  const fotosEquipe = useMemo(
    () => new Map((mural.data?.membros ?? []).map((m) => [m.id, m.foto])),
    [mural.data],
  )

  const estoqueBaixo = useMemo(
    () => (produtos.data ?? []).filter((p) => p.estoque_atual <= p.estoque_minimo),
    [produtos.data],
  )

  const totalVendasHoje = (vendas.data ?? []).reduce((s, v) => s + v.total, 0)

  const contasProximas = useMemo(() => {
    const limite = adicionarDias(hoje, 7)
    return (contas.data ?? []).filter(
      (c) => c.status === 'pendente' && c.tipo === 'pagar' && c.data_vencimento <= limite,
    )
  }, [contas.data, hoje])
  const contasAtrasadas = contasProximas.filter((c) => c.data_vencimento < hoje).length

  const receitaNomeById = useMemo(() => {
    const map = new Map<string, string>()
    receitas.data?.forEach((r) => map.set(r.id, r.nome))
    return map
  }, [receitas.data])

  const producoesHoje = (producoes.data ?? []).filter(
    (p) => p.status === 'planejado' && p.data <= hoje,
  )

  const stats = [
    {
      label: 'Vendas hoje',
      value: vendas.isLoading ? null : formatBRL(totalVendasHoje),
      detail: vendas.data ? `${vendas.data.length} venda(s)` : undefined,
      icon: DollarSign,
    },
    {
      label: 'Produtos cadastrados',
      value: produtos.isLoading ? null : String(produtos.data?.length ?? 0),
      icon: Package,
    },
    {
      label: 'Estoque baixo',
      value: produtos.isLoading ? null : String(estoqueBaixo.length),
      icon: AlertTriangle,
      alerta: estoqueBaixo.length > 0,
    },
    {
      label: 'Contas a pagar (7 dias)',
      value: contas.isLoading ? null : String(contasProximas.length),
      detail: contasAtrasadas > 0 ? `${contasAtrasadas} atrasada(s)` : undefined,
      icon: CalendarClock,
      alerta: contasAtrasadas > 0,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {saudacao()}, {user?.nome.split(' ')[0] || 'pessoal'}!
        </h1>
        <p className="text-sm text-muted-foreground">
          Como está a padaria hoje,{' '}
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </div>

      {faltaPadaria && (
        <Link
          to="/padaria"
          className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Complete os dados da sua padaria</span>
            <span className="block text-sm text-muted-foreground">
              Nome, CNPJ, endereço e telefone — eles aparecem no comprovante dos clientes.
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-primary" />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon
                className={stat.alerta ? 'size-4 text-destructive' : 'size-4 text-muted-foreground'}
              />
            </CardHeader>
            <CardContent>
              <div
                className={
                  stat.alerta ? 'text-2xl font-bold text-destructive' : 'text-2xl font-bold'
                }
              >
                {stat.value ?? <Loader2 className="size-5 animate-spin text-muted-foreground" />}
              </div>
              {stat.detail && <p className="text-xs text-muted-foreground">{stat.detail}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Painel titulo="Estoque baixo" link="/estoque" vazio="Nenhum produto abaixo do mínimo">
          {estoqueBaixo.slice(0, 8).map((p) => (
            <li key={p.id} className="flex items-center justify-between">
              <span>{p.nome}</span>
              <span className="text-destructive">
                {formatQuantidade(p.estoque_atual)} / mín. {formatQuantidade(p.estoque_minimo)}{' '}
                {p.unidade}
              </span>
            </li>
          ))}
        </Painel>

        <Painel
          titulo="Contas a pagar próximas"
          link="/financeiro"
          vazio="Nenhuma conta nos próximos 7 dias"
        >
          {contasProximas.slice(0, 8).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{c.descricao}</span>
              <span className="flex shrink-0 items-center gap-2">
                {c.data_vencimento < hoje && <Badge variant="destructive">Atrasada</Badge>}
                <span className="text-muted-foreground">{formatData(c.data_vencimento)}</span>
                <span className="font-medium">{formatBRL(c.valor)}</span>
              </span>
            </li>
          ))}
        </Painel>

        <Painel
          titulo="Produções pendentes até hoje"
          link="/producao"
          vazio="Nenhuma produção pendente"
          icone={<ChefHat className="size-4 text-muted-foreground" />}
        >
          {producoesHoje.slice(0, 8).map((p) => (
            <li key={p.id} className="flex items-center justify-between">
              <span>{receitaNomeById.get(p.receita_id) ?? '—'}</span>
              <span className="text-muted-foreground">{formatData(p.data)}</span>
            </li>
          ))}
        </Painel>

        <Painel titulo="Últimas vendas de hoje" link="/vendas" vazio="Nenhuma venda hoje">
          {(vendas.data ?? []).slice(0, 8).map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-muted-foreground">
                  {formatDataHora(v.created_at)} ·{' '}
                  {formaPagamentoLabels[v.forma_pagamento] ?? v.forma_pagamento}
                </div>
                {/* Quem estava logado e fez a venda. */}
                <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                  <Avatar
                    nome={v.vendedor_nome ?? '?'}
                    foto={v.created_by ? fotosEquipe.get(v.created_by) : null}
                    tamanho="xs"
                  />
                  <span className="truncate">
                    Vendido por <span className="font-medium">{v.vendedor_nome ?? '—'}</span>
                  </span>
                </div>
              </div>
              <span className="shrink-0 font-medium">{formatBRL(v.total)}</span>
            </li>
          ))}
        </Painel>
      </div>
    </div>
  )
}

function Painel({
  titulo,
  link,
  vazio,
  icone,
  children,
}: {
  titulo: string
  link: string
  vazio: string
  icone?: ReactNode
  children: ReactNode[]
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icone}
          {titulo}
        </CardTitle>
        <Link to={link} className="text-xs text-muted-foreground hover:text-foreground">
          Ver tudo
        </Link>
      </CardHeader>
      <CardContent>
        {children.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{vazio}</p>
        ) : (
          <ul className="space-y-2 text-sm">{children}</ul>
        )}
      </CardContent>
    </Card>
  )
}
