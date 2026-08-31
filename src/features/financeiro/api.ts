import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ContaFinanceira, ContaFinanceiraInsert, ContaFinanceiraUpdate } from '@/types/database'

const CONTAS_KEY = ['contas_financeiras'] as const

export function useContasFinanceiras() {
  return useQuery({
    queryKey: CONTAS_KEY,
    queryFn: async (): Promise<ContaFinanceira[]> => {
      const { data, error } = await supabase
        .from('contas_financeiras')
        .select('*')
        .neq('status', 'cancelado')
        .order('data_vencimento')

      if (error) throw error
      return data
    },
  })
}

export function useCreateConta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (conta: ContaFinanceiraInsert) => {
      const { error } = await supabase.from('contas_financeiras').insert(conta)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTAS_KEY }),
  })
}

export function useUpdateConta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: ContaFinanceiraUpdate }) => {
      const { error } = await supabase.from('contas_financeiras').update(changes).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTAS_KEY }),
  })
}

export function useDeleteConta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contas_financeiras').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTAS_KEY }),
  })
}

export function useMarcarComoPago() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contas_financeiras')
        .update({ status: 'pago', data_pagamento: new Date().toISOString().slice(0, 10) })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTAS_KEY }),
  })
}
