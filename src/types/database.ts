// Tipos manuais alinhados ao schema em supabase/migrations.
// Quando o projeto Supabase estiver criado, prefira gerar este arquivo com:
// npx supabase gen types typescript --project-id SEU_PROJECT_ID > src/types/database.ts
//
// Nota: usamos `type X = {...}` (object literal) em vez de `interface X {...}`
// porque o supabase-js exige que os tipos de linha satisfaçam Record<string, unknown>,
// e apenas object literal types recebem essa assinatura de índice implícita no TypeScript.

export type FormaPagamento = 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix'
export type TipoMovimentacao = 'entrada' | 'saida' | 'ajuste'
export type TipoConta = 'pagar' | 'receber'
export type StatusConta = 'pendente' | 'pago' | 'cancelado'
export type StatusProducao = 'planejado' | 'concluido' | 'cancelado'

export type Produto = {
  id: string
  nome: string
  categoria: string | null
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
}

export type ProducaoInsert = {
  receita_id: string
  data: string
  status?: StatusProducao
  observacoes?: string | null
}

export type ProducaoUpdate = Partial<ProducaoInsert>

export type Database = {
  public: {
    Tables: {
      produtos: {
        Row: Produto
        Insert: ProdutoInsert
        Update: ProdutoUpdate
        Relationships: []
      }
      movimentacoes_estoque: {
        Row: MovimentacaoEstoque
        Insert: MovimentacaoEstoqueInsert
        Update: Partial<MovimentacaoEstoqueInsert>
        Relationships: []
      }
      vendas: {
        Row: Venda
        Insert: VendaInsert
        Update: Partial<VendaInsert>
        Relationships: []
      }
      vendas_itens: {
        Row: VendaItem
        Insert: VendaItemInsert
        Update: Partial<VendaItemInsert>
        Relationships: []
      }
      contas_financeiras: {
        Row: ContaFinanceira
        Insert: ContaFinanceiraInsert
        Update: ContaFinanceiraUpdate
        Relationships: []
      }
      receitas: {
        Row: Receita
        Insert: ReceitaInsert
        Update: ReceitaUpdate
        Relationships: []
      }
      receita_itens: {
        Row: ReceitaItem
        Insert: ReceitaItemInsert
        Update: ReceitaItemUpdate
        Relationships: []
      }
      producoes: {
        Row: Producao
        Insert: ProducaoInsert
        Update: ProducaoUpdate
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      registrar_movimentacao_estoque: {
        Args: {
          p_produto_id: string
          p_tipo: TipoMovimentacao
          p_quantidade: number
          p_motivo: string | null
        }
        Returns: void
      }
      finalizar_venda: {
        Args: {
          p_itens: { produto_id: string; quantidade: number; preco_unitario: number }[]
          p_forma_pagamento: FormaPagamento
        }
        Returns: string
      }
      concluir_producao: {
        Args: {
          p_producao_id: string
        }
        Returns: void
      }
    }
  }
}
