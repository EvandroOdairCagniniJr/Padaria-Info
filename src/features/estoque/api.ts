import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
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
    mutationFn: ({ produtoId, tipo, quantidade, motivo }: AjustarEstoqueInput) =>
      api.post('/estoque/movimentacoes', {
        produto_id: produtoId,
        tipo,
        quantidade,
        motivo: motivo ?? null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['produtos'] }),
  })
}
