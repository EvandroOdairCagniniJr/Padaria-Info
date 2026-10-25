import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FormaPagamento, PaginaHistorico, VendaDetalhe } from '@/types/database'

export interface FiltrosHistorico {
  desde: string
  ate: string
  busca: string
  forma: FormaPagamento | null
}

// Histórico em páginas de 50 ("Carregar mais" continua da última venda mostrada).
// Fica sob a chave ['vendas'], que o PDV já atualiza a cada venda.
export function useHistoricoVendas(f: FiltrosHistorico) {
  return useInfiniteQuery({
    queryKey: ['vendas', 'historico', f],
    initialPageParam: null as { data: string; id: string } | null,
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams({ desde: f.desde, ate: f.ate })
      if (f.busca.trim()) q.set('busca', f.busca.trim())
      if (f.forma) q.set('forma', f.forma)
      if (pageParam) {
        q.set('antes_data', pageParam.data)
        q.set('antes_id', pageParam.id)
      }
      return api.get<PaginaHistorico>(`/vendas/historico?${q}`)
    },
    getNextPageParam: (ultima) => {
      const fim = ultima.vendas.at(-1)
      return ultima.temMais && fim ? { data: fim.created_at, id: fim.id } : null
    },
    placeholderData: keepPreviousData,
  })
}

export function useVenda(id: string | null) {
  return useQuery({
    queryKey: ['vendas', 'detalhe', id],
    queryFn: () => api.get<VendaDetalhe>(`/vendas/${id}`),
    enabled: Boolean(id),
    // Venda feita só muda na devolução, que já atualiza a tela.
    staleTime: Infinity,
    refetchInterval: false,
  })
}

// Devolução: estoque, dashboard, metas e histórico mudam juntos — recarrega tudo.
export function useDevolverVenda() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      api.post(`/vendas/${id}/devolver`, { motivo }),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
