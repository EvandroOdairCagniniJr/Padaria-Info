import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Promocao } from '@/lib/promocoes'

export type PromocaoComUso = Promocao & { desconto_total: number; vendas: number }
export type PromocaoInput = Omit<Promocao, 'id'>

// Para o PDV: promoções ativas (o dia/horário é conferido na hora de calcular).
export function usePromocoesAtivas() {
  return useQuery({
    queryKey: ['promocoes', 'ativas'],
    queryFn: () => api.get<Promocao[]>('/promocoes/ativas'),
  })
}

export function usePromocoes() {
  return useQuery({
    queryKey: ['promocoes', 'todas'],
    queryFn: () => api.get<PromocaoComUso[]>('/promocoes'),
  })
}

export function useSalvarPromocao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dados }: { id: string | null; dados: PromocaoInput }) =>
      id ? api.put(`/promocoes/${id}`, dados) : api.post('/promocoes', dados),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promocoes'] }),
  })
}

export function useRemoverPromocao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/promocoes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promocoes'] }),
  })
}
