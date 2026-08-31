import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  Producao,
  ProducaoInsert,
  Receita,
  ReceitaInsert,
  ReceitaItem,
  ReceitaItemInsert,
  ReceitaUpdate,
} from '@/types/database'

const RECEITAS_KEY = ['receitas'] as const
const PRODUCOES_KEY = ['producoes'] as const

export function useReceitas() {
  return useQuery({
    queryKey: RECEITAS_KEY,
    queryFn: async (): Promise<Receita[]> => {
      const { data, error } = await supabase.from('receitas').select('*').order('nome')
      if (error) throw error
      return data
    },
  })
}

export function useReceitaItens(receitaId: string | null) {
  return useQuery({
    queryKey: ['receita_itens', receitaId],
    enabled: Boolean(receitaId),
    queryFn: async (): Promise<ReceitaItem[]> => {
      const { data, error } = await supabase
        .from('receita_itens')
        .select('*')
        .eq('receita_id', receitaId as string)
      if (error) throw error
      return data
    },
  })
}

export function useTodosReceitaItens() {
  return useQuery({
    queryKey: ['receita_itens', 'todos'],
    queryFn: async (): Promise<ReceitaItem[]> => {
      const { data, error } = await supabase.from('receita_itens').select('*')
      if (error) throw error
      return data
    },
  })
}

interface SalvarReceitaInput {
  receita: ReceitaInsert
  itens: { ingrediente_id: string; quantidade: number }[]
}

export function useCreateReceita() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ receita, itens }: SalvarReceitaInput) => {
      const { data, error } = await supabase.from('receitas').insert(receita).select('id').single()
      if (error) throw error

      const itensInsert: ReceitaItemInsert[] = itens.map((item) => ({
        receita_id: data.id,
        ingrediente_id: item.ingrediente_id,
        quantidade: item.quantidade,
      }))
      const { error: itensError } = await supabase.from('receita_itens').insert(itensInsert)
      if (itensError) throw itensError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECEITAS_KEY })
      queryClient.invalidateQueries({ queryKey: ['receita_itens', 'todos'] })
    },
  })
}

export function useUpdateReceita() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      changes,
      itens,
    }: {
      id: string
      changes: ReceitaUpdate
      itens: { ingrediente_id: string; quantidade: number }[]
    }) => {
      const { error } = await supabase.from('receitas').update(changes).eq('id', id)
      if (error) throw error

      const { error: deleteError } = await supabase
        .from('receita_itens')
        .delete()
        .eq('receita_id', id)
      if (deleteError) throw deleteError

      const itensInsert: ReceitaItemInsert[] = itens.map((item) => ({
        receita_id: id,
        ingrediente_id: item.ingrediente_id,
        quantidade: item.quantidade,
      }))
      const { error: itensError } = await supabase.from('receita_itens').insert(itensInsert)
      if (itensError) throw itensError
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: RECEITAS_KEY })
      queryClient.invalidateQueries({ queryKey: ['receita_itens', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['receita_itens', 'todos'] })
    },
  })
}

export function useDeleteReceita() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('receitas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECEITAS_KEY })
      queryClient.invalidateQueries({ queryKey: ['receita_itens', 'todos'] })
    },
  })
}

export function useProducoes() {
  return useQuery({
    queryKey: PRODUCOES_KEY,
    queryFn: async (): Promise<Producao[]> => {
      const { data, error } = await supabase
        .from('producoes')
        .select('*')
        .order('data', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateProducao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (producao: ProducaoInsert) => {
      const { error } = await supabase.from('producoes').insert(producao)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCOES_KEY }),
  })
}

export function useDeleteProducao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('producoes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCOES_KEY }),
  })
}

export function useConcluirProducao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('concluir_producao', { p_producao_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRODUCOES_KEY })
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
    },
  })
}
