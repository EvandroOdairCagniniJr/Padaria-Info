import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { inicioDoDiaISO } from '@/lib/format'
import type { Venda } from '@/types/database'

export function useVendasHoje() {
  return useQuery({
    queryKey: ['vendas', 'hoje'],
    queryFn: () => api.get<Venda[]>(`/vendas?desde=${encodeURIComponent(inicioDoDiaISO())}`),
  })
}
