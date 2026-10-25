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

// ---------------------------------------------------------------- Sugestão e perdas

export type SugestaoProducao = {
  produto_id: string
  nome: string
  unidade: string
  categoria: string | null
  media_vendida: number
  media_perdida: number
  taxa_sobra: number
  estoque: number
  sugestao: number
  motivo: string
  // Quantas das 4 semanas analisadas já tinham o produto.
  semanas: number
  receita_id: string | null
  receita_nome: string | null
  rendimento: number | null
  fornadas: number | null
}

export function useSugestaoProducao(inicio: string) {
  return useQuery({
    queryKey: ['producao', 'sugestao', inicio],
    queryFn: () =>
      api.get<SugestaoProducao[]>(`/producao/sugestao?inicio=${encodeURIComponent(inicio)}`),
    refetchInterval: false,
  })
}

export type MotivoPerda = 'sobra' | 'vencido' | 'queimado' | 'quebra' | 'outro'

export type Perda = {
  id: string
  produto_id: string
  nome: string
  unidade: string
  categoria: string | null
  quantidade: number
  motivo: MotivoPerda
  observacao: string | null
  custo_unitario: number
  created_at: string
  registrado_por: string | null
}

export type ResumoPerdas = {
  perdas: Perda[]
  resumo: {
    custo: number
    porMotivo: { motivo: MotivoPerda; custo: number; registros: number }[]
    produtos: {
      id: string
      nome: string
      unidade: string
      categoria: string | null
      perdido: number
      vendido: number
      custo: number
      taxa: number
    }[]
  }
}

export function usePerdas(desde: string, ate: string) {
  return useQuery({
    queryKey: ['perdas', desde, ate],
    queryFn: () =>
      api.get<ResumoPerdas>(
        `/perdas?desde=${encodeURIComponent(desde)}&ate=${encodeURIComponent(ate)}`,
      ),
  })
}

function invalidarPerdas(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['perdas'] })
  queryClient.invalidateQueries({ queryKey: ['produtos'] })
  queryClient.invalidateQueries({ queryKey: ['producao', 'sugestao'] })
}

export function useRegistrarPerda() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dados: {
      itens: { produto_id: string; quantidade: number }[]
      motivo: MotivoPerda
      observacao?: string | null
    }) => api.post('/perdas', dados),
    onSuccess: () => invalidarPerdas(queryClient),
  })
}

export function useDesfazerPerda() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/perdas/${id}`),
    onSuccess: () => invalidarPerdas(queryClient),
  })
}
