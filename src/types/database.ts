// Tipos das linhas devolvidas pela API (server/routes.ts), espelhando server/schema.sql.

export type FormaPagamento = 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix'
export type TipoMovimentacao = 'entrada' | 'saida' | 'ajuste'
export type TipoConta = 'pagar' | 'receber'
export type StatusConta = 'pendente' | 'pago' | 'cancelado'
export type StatusProducao = 'planejado' | 'concluido' | 'cancelado'

export type Produto = {
  id: string
  nome: string
  categoria: string | null
  // Variedade de (ex.: "Café"): produtos do mesmo grupo viram um card só no PDV.
  grupo?: string | null
  unidade: string
  preco_venda: number
  preco_custo: number | null
  estoque_atual: number
  estoque_minimo: number
  ativo: boolean
  created_at: string
}

export type ProdutoInsert = {
  nome: string
  categoria?: string | null
  grupo?: string | null
  unidade: string
  preco_venda: number
  preco_custo?: number | null
  estoque_atual?: number
  estoque_minimo?: number
  ativo?: boolean
}

export type ProdutoUpdate = Partial<ProdutoInsert>

export type MovimentacaoEstoque = {
  id: string
  produto_id: string
  tipo: TipoMovimentacao
  quantidade: number
  motivo: string | null
  created_at: string
  created_by: string | null
}

export type MovimentacaoEstoqueInsert = {
  produto_id: string
  tipo: TipoMovimentacao
  quantidade: number
  motivo?: string | null
}

export type Venda = {
  id: string
  total: number
  forma_pagamento: FormaPagamento
  status: string
  created_at: string
  created_by: string | null
  // Nome de quem registrou a venda (join feito pela API).
  vendedor_nome?: string | null
}

export type VendaInsert = {
  total: number
  forma_pagamento: FormaPagamento
  status?: string
}

export type VendaItem = {
  id: string
  venda_id: string
  produto_id: string
  quantidade: number
  preco_unitario: number
  subtotal: number
}

export type VendaItemInsert = Omit<VendaItem, 'id'>

export type ContaFinanceira = {
  id: string
  tipo: TipoConta
  descricao: string
  categoria: string | null
  valor: number
  data_vencimento: string
  data_pagamento: string | null
  status: StatusConta
  forma_pagamento: string | null
  observacoes: string | null
  created_at: string
  created_by: string | null
}

export type ContaFinanceiraInsert = {
  tipo: TipoConta
  descricao: string
  categoria?: string | null
  valor: number
  data_vencimento: string
  data_pagamento?: string | null
  status?: StatusConta
  forma_pagamento?: string | null
  observacoes?: string | null
}

export type ContaFinanceiraUpdate = Partial<ContaFinanceiraInsert>

export type Receita = {
  id: string
  produto_id: string
  nome: string
  rendimento: number
  modo_preparo: string | null
  created_at: string
}

export type ReceitaInsert = {
  produto_id: string
  nome: string
  rendimento: number
  modo_preparo?: string | null
}

export type ReceitaUpdate = Partial<ReceitaInsert>

export type ReceitaItem = {
  id: string
  receita_id: string
  ingrediente_id: string
  quantidade: number
}

export type ReceitaItemInsert = {
  receita_id: string
  ingrediente_id: string
  quantidade: number
}

export type ReceitaItemUpdate = Partial<ReceitaItemInsert>

export type Producao = {
  id: string
  receita_id: string
  data: string
  status: StatusProducao
  observacoes: string | null
  created_at: string
  created_by: string | null
  concluida_em: string | null
  concluida_por: string | null
}

export type ProducaoInsert = {
  receita_id: string
  data: string
  status?: StatusProducao
  observacoes?: string | null
}

export type ProducaoUpdate = Partial<ProducaoInsert>

export type Papel = 'dono' | 'admin' | 'funcionario'

export type Turno = 'manha' | 'tarde' | 'noite' | 'madrugada' | 'integral'

export type EnderecoCadastro = {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

export type ContatoEmergencia = { nome: string; parentesco: string; telefone: string }

// Cadastro completo de uma pessoa (o que não foi preenchido vem null).
export type DadosCadastro = {
  telefone: string | null
  cpf: string | null
  data_nascimento: string | null
  data_admissao: string | null
  turno: Turno | null
  endereco: EnderecoCadastro | null
  contato_emergencia: ContatoEmergencia | null
  observacoes?: string | null
}

// GET/PUT /api/padaria
export type DadosPadaria = {
  nome_fantasia: string
  razao_social: string | null
  cnpj: string | null
  inscricao_estadual: string | null
  telefone: string | null
  whatsapp: string | null
  email: string | null
  instagram: string | null
  horario: string | null
  endereco: EnderecoCadastro | null
  mensagem_comprovante: string | null
}

// Linha de GET /api/equipe/resumo: desempenho de um membro no período + cadastro completo.
export type ResumoMembro = DadosCadastro & {
  created_at: string
  id: string
  nome: string
  email: string
  papel: Papel
  cargo: string
  foto: string | null
  ativo: boolean
  ultimo_acesso: string | null
  ultima_atividade: string | null
  vendas: number
  total_vendas: number
  movimentacoes: number
  producoes: number
  vendido_hoje: number
  recorde_dia: number
}

// Linha de GET /api/equipe/atividade.
export type AtividadeEquipe = {
  tipo: 'venda' | 'estoque' | 'producao'
  id: string
  quando: string
  usuario_id: string | null
  usuario_nome: string | null
  detalhe: string | null
  produto: string | null
  quantidade: number | null
  unidade: string | null
  valor: number | null
}

// GET /api/conquistas: base das comemorações de meta e recorde de quem está logado.
export type Conquistas = {
  meta: number
  vendidoHoje: number
  vendasHoje: number
  recordeAnterior: number
}

// GET /api/time: mural da equipe (todos veem). posicao = lugar no ranking de vendas do período.
export type MembroMural = {
  id: string
  nome: string
  cargo: string
  papel: Papel
  foto: string | null
  created_at: string
  vendas: number
  total_vendas: number
  vendido_hoje: number
  // Meta do dia desta pessoa (individual ou padrão da equipe); 0 = sem meta.
  meta_dia: number
  primeira_venda_hoje: string | null
  // O que vendeu no período, por produto (base dos destaques por tipo).
  produtos: { nome: string; categoria: string | null; total: number; quantidade: number }[]
  posicao: number | null
  promovido_em: string | null
  promovido_para: string | null
}

export type MuralEquipe = {
  meta: number
  membros: MembroMural[]
}

// GET /api/time/novidades: mudanças de perfil (dono e gerência).
export type NovidadePerfil = {
  id: string
  usuario_id: string
  usuario_nome: string
  usuario_foto: string | null
  campo: 'nome' | 'cargo' | 'papel' | 'foto'
  valor_antigo: string | null
  valor_novo: string | null
  alterado_por: string | null
  alterado_por_nome: string | null
  created_at: string
}

// GET /api/vendas/historico: uma linha do histórico.
export type VendaHistorico = {
  id: string
  total: number
  forma_pagamento: FormaPagamento
  valor_recebido: number | null
  created_at: string
  created_by: string | null
  // devolvida: continua no histórico, mas não soma nos totais (o estoque já voltou).
  status: 'concluida' | 'devolvida'
  vendedor_nome: string | null
  qtd_itens: number
  // Nomes dos produtos, do mais caro para o mais barato.
  resumo: string | null
}

export type PaginaHistorico = {
  vendas: VendaHistorico[]
  temMais: boolean
  // Só na primeira página.
  totais: {
    quantidade: number
    total: number
    devolvidas: number
    total_devolvido: number
  } | null
}

// GET /api/vendas/:id
export type VendaDetalhe = Omit<VendaHistorico, 'qtd_itens' | 'resumo'> & {
  vendedor_foto: string | null
  devolvida_em: string | null
  devolvida_por_nome: string | null
  desconto_promocoes: number
  desconto_manual: number
  motivo_devolucao: string | null
  itens: {
    id: string
    nome: string
    categoria: string | null
    unidade: string
    quantidade: number
    preco_unitario: number
    subtotal: number
    desconto: number
    promocao: string | null
  }[]
}
