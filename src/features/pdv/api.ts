import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FormaPagamento } from '@/types/database'

// O preço é sempre lido do cadastro no servidor (POST /api/vendas).
export interface CartItemInput {
  produto_id: string
  quantidade: number
}

interface FinalizarVendaInput {
  itens: CartItemInput[]
  formaPagamento: FormaPagamento
  // Dinheiro: quanto o cliente entregou (fica guardado para a 2ª via mostrar o troco).
  recebido?: number | null
  // Desconto dado no caixa (o servidor confere o limite de quem está vendendo).
  descontoManual?: { tipo: 'valor' | 'percentual'; valor: number } | null
}

export interface VendaRegistrada {
  id: string
  total: number
  bruto: number
  desconto_promocoes: number
  desconto_manual: number
  itens: { produto_id: string; desconto: number; promocao: string | null }[]
}

export function useFinalizarVenda() {
  const queryClient = useQueryClient()
  return useMutation({
    // Devolve o id e o total realmente cobrado (calculado com os preços do cadastro).
    mutationFn: ({ itens, formaPagamento, recebido, descontoManual }: FinalizarVendaInput) =>
      api.post<VendaRegistrada>('/vendas', {
        itens,
        forma_pagamento: formaPagamento,
        valor_recebido: recebido ?? null,
        desconto_manual: descontoManual ?? null,
        // Promoções por dia/horário usam o relógio da padaria.
        tz: new Date().getTimezoneOffset(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      queryClient.invalidateQueries({ queryKey: ['vendas'] })
      // Ranking da Equipe e metas mudam a cada venda.
      queryClient.invalidateQueries({ queryKey: ['time'] })
      queryClient.invalidateQueries({ queryKey: ['equipe'] })
      queryClient.invalidateQueries({ queryKey: ['conquistas'] })
      queryClient.invalidateQueries({ queryKey: ['metas'] })
      queryClient.invalidateQueries({ queryKey: ['caixa'] })
    },
  })
}
