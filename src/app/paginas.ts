// Cada módulo vira um chunk separado. O import fica guardado para pré-carregar todos
// em segundo plano depois do login (precarregarPaginas): trocar de tela fica instantâneo.
export const paginas = {
  login: () => import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
  dashboard: () =>
    import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
  produtos: () =>
    import('@/features/produtos/ProdutosPage').then((m) => ({ default: m.ProdutosPage })),
  estoque: () => import('@/features/estoque/EstoquePage').then((m) => ({ default: m.EstoquePage })),
  vendas: () => import('@/features/vendas/VendasPage').then((m) => ({ default: m.VendasPage })),
  pdv: () => import('@/features/pdv/PdvPage').then((m) => ({ default: m.PdvPage })),
  financeiro: () =>
    import('@/features/financeiro/FinanceiroPage').then((m) => ({ default: m.FinanceiroPage })),
  producao: () =>
    import('@/features/producao/ProducaoPage').then((m) => ({ default: m.ProducaoPage })),
  padaria: () =>
    import('@/features/padaria/MinhaPadariaPage').then((m) => ({ default: m.MinhaPadariaPage })),
  guia: () => import('@/features/guia/GuiaPage').then((m) => ({ default: m.GuiaPage })),
  metas: () => import('@/features/metas/MetasPage').then((m) => ({ default: m.MetasPage })),
  encomendas: () =>
    import('@/features/encomendas/EncomendasPage').then((m) => ({ default: m.EncomendasPage })),
  caixa: () => import('@/features/caixa/CaixaPage').then((m) => ({ default: m.CaixaPage })),
  margens: () => import('@/features/margens/MargensPage').then((m) => ({ default: m.MargensPage })),
  analise: () => import('@/features/analise/AnalisePage').then((m) => ({ default: m.AnalisePage })),
  promocoes: () =>
    import('@/features/promocoes/PromocoesPage').then((m) => ({ default: m.PromocoesPage })),
  equipe: () => import('@/features/equipe/EquipePage').then((m) => ({ default: m.EquipePage })),
}

export function precarregarPaginas() {
  for (const carregar of Object.values(paginas)) carregar().catch(() => undefined)
}
