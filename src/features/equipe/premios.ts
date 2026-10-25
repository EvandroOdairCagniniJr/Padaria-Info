// Destaques da Equipe: um vencedor por critério no período, mais os selos pessoais
// (posição no ranking, meta, promoção, novo na equipe). Calculado a partir do mural (GET /api/time).
import {
  Coffee,
  Croissant,
  Donut,
  Gem,
  Milk,
  ShoppingBasket,
  Sunrise,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
  Wheat,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { formatBRL, formatQuantidade } from '@/lib/format'
import { familiaDoProduto, type Familia } from '@/lib/iconeProduto'
import type { MembroMural } from '@/types/database'

export interface Selo {
  id: string
  icone: LucideIcon
  titulo: string
  // Frase curta do critério ("maior faturamento em doces").
  criterio: string
  // Tom do ícone (fundo claro + cor do traço).
  tom: string
}

export interface Destaque extends Selo {
  vencedor: MembroMural | null
  // Resultado do vencedor ("R$ 120,00 em doces").
  resultado: string | null
}

const tons = {
  ambar:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900',
  rosa: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-900',
  marrom:
    'bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:ring-orange-900',
  azul: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-900',
  violeta:
    'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-900',
  verde:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900',
  cinza:
    'bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700',
}

export const familias: Record<Familia, { icone: LucideIcon; nome: string }> = {
  paes: { icone: Wheat, nome: 'Pães' },
  doces: { icone: Donut, nome: 'Doces' },
  bebidas: { icone: Coffee, nome: 'Bebidas' },
  salgados: { icone: Croissant, nome: 'Salgados' },
  mercearia: { icone: Milk, nome: 'Mercearia' },
}

// Quanto cada membro vendeu de cada família (R$) no período.
export function vendasPorFamilia(m: MembroMural) {
  const total: Partial<Record<Familia, number>> = {}
  for (const p of m.produtos) {
    const familia = familiaDoProduto(p)
    if (familia) total[familia] = (total[familia] ?? 0) + p.total
  }
  return total
}

export function ticketMedio(m: MembroMural) {
  return m.vendas ? m.total_vendas / m.vendas : 0
}

export function itensVendidos(m: MembroMural) {
  return m.produtos.reduce((s, p) => s + p.quantidade, 0)
}

function horaDe(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

interface Regra extends Selo {
  // Pontuação do membro (maior vence); 0 ou menos = não concorre.
  pontos: (m: MembroMural) => number
  resultado: (m: MembroMural) => string
}

const porFamilia = (familia: Familia, tom: string, criterio: string): Regra => ({
  id: familia,
  icone: familias[familia].icone,
  titulo: `Destaque em ${familias[familia].nome}`,
  criterio,
  tom,
  pontos: (m) => vendasPorFamilia(m)[familia] ?? 0,
  resultado: (m) =>
    `${formatBRL(vendasPorFamilia(m)[familia] ?? 0)} em ${familias[familia].nome.toLowerCase()}`,
})

const regras: Regra[] = [
  porFamilia('doces', tons.rosa, 'maior faturamento em doces, bolos e biscoitos'),
  porFamilia('bebidas', tons.marrom, 'maior faturamento em cafés e bebidas'),
  porFamilia('paes', tons.ambar, 'maior faturamento em pães e folhados'),
  porFamilia('salgados', tons.ambar, 'maior faturamento em salgados e lanches'),
  porFamilia('mercearia', tons.azul, 'maior faturamento em frios, laticínios e mercearia'),
  {
    id: 'atendimentos',
    icone: Zap,
    titulo: 'Mais atendimentos',
    criterio: 'maior número de vendas',
    tom: tons.violeta,
    pontos: (m) => m.vendas,
    resultado: (m) => `${m.vendas} venda${m.vendas === 1 ? '' : 's'}`,
  },
  {
    id: 'ticket',
    icone: Gem,
    titulo: 'Maior ticket médio',
    criterio: 'maior valor médio por venda (mín. 3 vendas)',
    tom: tons.azul,
    pontos: (m) => (m.vendas >= 3 ? ticketMedio(m) : 0),
    resultado: (m) => `${formatBRL(ticketMedio(m))} por venda`,
  },
  {
    id: 'itens',
    icone: ShoppingBasket,
    titulo: 'Mais itens vendidos',
    criterio: 'maior quantidade de itens',
    tom: tons.verde,
    pontos: itensVendidos,
    resultado: (m) => `${formatQuantidade(itensVendidos(m))} itens`,
  },
  {
    id: 'abertura',
    icone: Sunrise,
    titulo: 'Abertura do dia',
    criterio: 'fez a primeira venda de hoje',
    tom: tons.ambar,
    // Mais cedo = mais pontos.
    pontos: (m) => (m.primeira_venda_hoje ? 1e13 - new Date(m.primeira_venda_hoje).getTime() : 0),
    resultado: (m) => (m.primeira_venda_hoje ? `às ${horaDe(m.primeira_venda_hoje)}` : ''),
  },
]

// Um vencedor por destaque; empate fica com quem está melhor no ranking (ordem do mural).
export function calcularDestaques(membros: MembroMural[]): Destaque[] {
  return regras.map(({ pontos, resultado, ...selo }) => {
    let vencedor: MembroMural | null = null
    let melhor = 0
    for (const m of membros) {
      const p = pontos(m)
      if (p > melhor) {
        melhor = p
        vencedor = m
      }
    }
    return { ...selo, vencedor, resultado: vencedor ? resultado(vencedor) : null }
  })
}

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

// Ouro, prata e bronze em tons discretos.
export const tonsPodio: Record<1 | 2 | 3, string> = {
  1: 'bg-amber-50 text-amber-700 ring-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800',
  2: 'bg-slate-50 text-slate-600 ring-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-600',
  3: 'bg-orange-50 text-orange-700 ring-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:ring-orange-800',
}

// Todos os selos que a pessoa tem agora: posição, destaques que ganhou e selos pessoais.
export function selosDoMembro(
  m: MembroMural,
  destaques: Destaque[],
  meta: number,
  agora: number,
): Selo[] {
  const lista: Selo[] = []
  if (m.posicao === 1 || m.posicao === 2 || m.posicao === 3) {
    lista.push({
      id: 'posicao',
      icone: Trophy,
      titulo: `${m.posicao}º em vendas`,
      criterio: 'posição no ranking do período',
      tom: tonsPodio[m.posicao],
    })
  }
  for (const d of destaques) if (d.vencedor?.id === m.id) lista.push(d)
  if (meta > 0 && m.vendido_hoje >= meta) {
    lista.push({
      id: 'meta',
      icone: Target,
      titulo: 'Meta do dia atingida',
      criterio: `vendeu ${formatBRL(m.vendido_hoje)} de ${formatBRL(meta)}`,
      tom: tons.verde,
    })
  }
  if (m.promovido_em) {
    lista.push({
      id: 'promovido',
      icone: TrendingUp,
      titulo: 'Promovido(a)',
      criterio: m.promovido_para ? `agora é ${m.promovido_para}` : 'subiu de cargo',
      tom: tons.verde,
    })
  }
  if (m.papel !== 'dono' && agora - new Date(m.created_at).getTime() < SETE_DIAS_MS) {
    lista.push({
      id: 'novo',
      icone: UserPlus,
      titulo: 'Novo(a) na equipe',
      criterio: 'entrou nos últimos 7 dias',
      tom: tons.cinza,
    })
  }
  return lista
}
