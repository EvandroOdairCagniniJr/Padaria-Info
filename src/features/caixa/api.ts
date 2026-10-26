import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type FormaCaixa = 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito'
export type PorForma = Record<FormaCaixa, number>

export const formasCaixa: { value: FormaCaixa; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'cartao_debito', label: 'Débito' },
  { value: 'cartao_credito', label: 'Crédito' },
]

export type MovimentoCaixa = {
  id: string
  tipo: 'sangria' | 'suprimento'
  valor: number
  motivo: string | null
  created_at: string
  feito_por: string | null
}

export type ResumoCaixa = {
  recebido: PorForma
  esperado: PorForma
  total_recebido: number
  quantidade_vendas: number
  sinais: number
  devolvidas: { quantidade: number; valor: number }
  sangrias: number
  suprimentos: number
  movimentos: MovimentoCaixa[]
}

export type Caixa = {
  id: string
  operador_id: string
  operador_nome?: string
  aberto_em: string
  fechado_em: string | null
  fundo_troco: number
  esperado: PorForma | null
  contado: Partial<PorForma> | null
  diferenca: number | null
  observacoes: string | null
  resumo?: ResumoCaixa
}

const KEY = ['caixa'] as const

export function useCaixaAtual() {
  return useQuery({
    queryKey: [...KEY, 'atual'],
    queryFn: () =>
      api.get<{ caixa: (Caixa & { resumo: ResumoCaixa }) | null; fundo_sugerido?: number | null }>(
        '/caixa/atual',
      ),
  })
}

export function useHistoricoCaixa(desde: string, ate: string, ativo: boolean) {
  return useQuery({
    queryKey: [...KEY, 'historico', desde, ate],
    queryFn: () =>
      api.get<Caixa[]>(
        `/caixa/historico?desde=${encodeURIComponent(desde)}&ate=${encodeURIComponent(ate)}`,
      ),
    enabled: ativo,
  })
}

function useAcaoCaixa<T, R>(fn: (dados: T) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export const useAbrirCaixa = () =>
  useAcaoCaixa((fundo_troco: number) => api.post('/caixa/abrir', { fundo_troco }))

export const useMovimentoCaixa = () =>
  useAcaoCaixa((m: { tipo: 'sangria' | 'suprimento'; valor: number; motivo: string | null }) =>
    api.post('/caixa/movimento', m),
  )

export const useFecharCaixa = () =>
  useAcaoCaixa((f: { contado: Partial<PorForma> & { dinheiro: number }; observacoes: string | null }) =>
    api.post<{ diferenca: number; esperado: PorForma }>('/caixa/fechar', f),
  )
