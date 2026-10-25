import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { hojeISO } from '@/lib/format'
import type { ContaFinanceira, ContaFinanceiraInsert, ContaFinanceiraUpdate } from '@/types/database'

const CONTAS_KEY = ['contas_financeiras'] as const

export function useContasFinanceiras() {
  return useQuery({
    queryKey: CONTAS_KEY,
    queryFn: () => api.get<ContaFinanceira[]>('/contas'),
  })
}

export function useCreateConta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (conta: ContaFinanceiraInsert) => api.post('/contas', conta),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTAS_KEY }),
  })
}

export function useUpdateConta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: ContaFinanceiraUpdate }) =>
      api.patch(`/contas/${id}`, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTAS_KEY }),
  })
}

export function useDeleteConta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/contas/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTAS_KEY }),
  })
}

export function useMarcarComoPago() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/contas/${id}/pagar`, { data_pagamento: hojeISO() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTAS_KEY }),
  })
}
