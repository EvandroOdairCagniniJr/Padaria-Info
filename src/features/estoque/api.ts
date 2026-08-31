import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TipoMovimentacao } from '@/types/database'

interface AjustarEstoqueInput {
  produtoId: string
  tipo: TipoMovimentacao
  quantidade: number
  motivo?: string
}

export function useAjustarEstoque() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ produtoId, tipo, quantidade, motivo }: AjustarEstoqueInput) => {
      const { error } = await supabase.rpc('registrar_movimentacao_estoque', {
        p_produto_id: produtoId,
        p_tipo: tipo,
        p_quantidade: quantidade,
        p_motivo: motivo ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['produtos'] }),
  })
}
