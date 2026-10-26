import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FormaPagamento } from '@/types/database'

export type StatusEncomenda =
  | 'reservada'
  | 'confirmada'
  | 'em_producao'
  | 'pronta'
  | 'entregue'
  | 'cancelada'

export type ItemEncomenda = {
  id: string
  produto_id: string
  nome: string
  unidade: string
  categoria: string | null
  quantidade: number
  preco_unitario: number
  subtotal: number
}

export type Encomenda = {
  id: string
  numero: number
  cliente_nome: string
  cliente_telefone: string | null
  retirada_em: string
  entrega: boolean
  endereco: string | null
  status: StatusEncomenda
  total: number
  sinal: number
  forma_sinal: FormaPagamento | null
  observacoes: string | null
  venda_id: string | null
  created_at: string
  criado_por_nome: string | null
  itens: ItemEncomenda[]
}

export type EncomendaInput = {
  cliente_nome: string
  cliente_telefone: string | null
  retirada_em: string
  entrega: boolean
  endereco: string | null
  itens: { produto_id: string; quantidade: number; preco_unitario: number }[]
  sinal: number
  forma_sinal: FormaPagamento | null
  observacoes: string | null
}

export const formasPagamento: { value: FormaPagamento; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao_debito', label: 'Débito' },
  { value: 'cartao_credito', label: 'Crédito' },
]

const KEY = ['encomendas'] as const

// Período pela data de retirada; abertas e atrasadas sempre vêm junto.
export function useEncomendas(desde: string, ate: string) {
  return useQuery({
    queryKey: [...KEY, desde, ate],
    queryFn: () =>
      api.get<Encomenda[]>(
        `/encomendas?desde=${encodeURIComponent(desde)}&ate=${encodeURIComponent(ate)}`,
      ),
  })
}

export function useSalvarEncomenda() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string | null; dados: EncomendaInput }) => {
      if (!id) return api.post<{ id: string; numero: number }>('/encomendas', dados)
      await api.put(`/encomendas/${id}`, dados)
      return null
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useMudarStatusEncomenda() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusEncomenda }) =>
      api.post(`/encomendas/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

// Entregar vira venda: estoque, metas e faturamento mudam juntos.
export function useEntregarEncomenda() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, forma_pagamento }: { id: string; forma_pagamento: FormaPagamento }) =>
      api.post<{ venda_id: string }>(`/encomendas/${id}/entregar`, { forma_pagamento }),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
