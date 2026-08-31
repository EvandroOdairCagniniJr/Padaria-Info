import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { FormaPagamento } from '@/types/database'

export interface CartItemInput {
  produto_id: string
  quantidade: number
  preco_unitario: number
}

interface FinalizarVendaInput {
  itens: CartItemInput[]
  formaPagamento: FormaPagamento
}

export function useFinalizarVenda() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itens, formaPagamento }: FinalizarVendaInput) => {
      const { data, error } = await supabase.rpc('finalizar_venda', {
        p_itens: itens,
        p_forma_pagamento: formaPagamento,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['produtos'] }),
  })
}
