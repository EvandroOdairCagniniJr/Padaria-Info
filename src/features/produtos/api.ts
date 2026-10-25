import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Produto, ProdutoInsert, ProdutoUpdate } from '@/types/database'

const PRODUTOS_KEY = ['produtos'] as const

export function useProdutos() {
  return useQuery({
    queryKey: PRODUTOS_KEY,
    queryFn: () => api.get<Produto[]>('/produtos'),
  })
}

export function useCreateProduto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (produto: ProdutoInsert) => api.post('/produtos', produto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUTOS_KEY }),
  })
}

export function useUpdateProduto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: ProdutoUpdate }) =>
      api.patch(`/produtos/${id}`, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUTOS_KEY }),
  })
}

export function useDeleteProduto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/produtos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUTOS_KEY }),
  })
}

// Chave em minúsculas: "Pães" e "pães" são a mesma categoria (como no MySQL).
export function chaveCategoria(nome: string) {
  return nome.trim().toLowerCase()
}

// Fotos das categorias: muda pouco, então não entra na atualização automática de 20 s.
export function useFotosCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: () => api.get<{ nome: string; foto: string }[]>('/categorias'),
    select: (rows) => new Map(rows.map((r) => [chaveCategoria(r.nome), r.foto])),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  })
}

export function useSalvarFotoCategoria() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dados: { nome: string; foto: string | null }) => api.put('/categorias/foto', dados),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categorias'] }),
  })
}
