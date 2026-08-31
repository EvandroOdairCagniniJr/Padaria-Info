import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Produto, ProdutoInsert, ProdutoUpdate } from '@/types/database'

const PRODUTOS_KEY = ['produtos'] as const

export function useProdutos() {
  return useQuery({
    queryKey: PRODUTOS_KEY,
    queryFn: async (): Promise<Produto[]> => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('ativo', true)
        .order('nome')

      if (error) throw error
      return data
    },
  })
}

export function useCreateProduto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (produto: ProdutoInsert) => {
      const { error } = await supabase.from('produtos').insert(produto)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUTOS_KEY }),
  })
}

export function useUpdateProduto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: ProdutoUpdate }) => {
      const { error } = await supabase.from('produtos').update(changes).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUTOS_KEY }),
  })
}

export function useDeleteProduto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('produtos').update({ ativo: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUTOS_KEY }),
  })
}
