import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Producao, ProducaoInsert, Receita, ReceitaInsert, ReceitaItem } from '@/types/database'

const RECEITAS_KEY = ['receitas'] as const
const PRODUCOES_KEY = ['producoes'] as const

export function useReceitas() {
  return useQuery({
    queryKey: RECEITAS_KEY,
    queryFn: () => api.get<Receita[]>('/receitas'),
  })
}

export function useReceitaItens(receitaId: string | null) {
  return useQuery({
    queryKey: ['receita_itens', receitaId],
    enabled: Boolean(receitaId),
    queryFn: () =>
      api.get<ReceitaItem[]>(`/receita-itens?receita_id=${encodeURIComponent(receitaId as string)}`),
  })
}

export function useTodosReceitaItens() {
  return useQuery({
    queryKey: ['receita_itens', 'todos'],
    queryFn: () => api.get<ReceitaItem[]>('/receita-itens'),
  })
}

interface SalvarReceitaInput {
  id: string | null
  receita: ReceitaInsert
  itens: { ingrediente_id: string; quantidade: number }[]
}

// Cria (id null) ou atualiza receita + ingredientes numa única transação no servidor.
export function useSalvarReceita() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, receita, itens }: SalvarReceitaInput) => {
      const body = { ...receita, itens }
      const result = id
        ? await api.put<{ id: string }>(`/receitas/${id}`, body)
        : await api.post<{ id: string }>('/receitas', body)
      return result.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECEITAS_KEY })
      queryClient.invalidateQueries({ queryKey: ['receita_itens'] })
    },
  })
}

export function useDeleteReceita() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/receitas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECEITAS_KEY })
      queryClient.invalidateQueries({ queryKey: ['receita_itens', 'todos'] })
    },
  })
}

export function useProducoes() {
  return useQuery({
    queryKey: PRODUCOES_KEY,
    queryFn: () => api.get<Producao[]>('/producoes'),
  })
}

export function useCreateProducao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (producao: ProducaoInsert) => api.post('/producoes', producao),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCOES_KEY }),
  })
}

export function useDeleteProducao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/producoes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCOES_KEY }),
  })
}

export function useConcluirProducao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/producoes/${id}/concluir`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRODUCOES_KEY })
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
    },
  })
}
