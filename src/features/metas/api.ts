import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Papel } from '@/types/database'

export type PeriodoMeta = 'dia' | 'semana' | 'mes'
export type ValoresMeta = Record<PeriodoMeta, number | null>
export type Progresso = { meta: number | null; vendido: number }

export type MembroMetas = {
  id: string
  nome: string
  cargo: string
  foto: string | null
  papel: Papel
  // Metas próprias da pessoa (sem elas, vale o padrão da equipe).
  individual: ValoresMeta
} & Record<PeriodoMeta, Progresso>

export type PainelMetas = {
  geral: Record<PeriodoMeta, Progresso>
  padrao: ValoresMeta
  membros: MembroMetas[]
}

// Início do dia, da semana (segunda-feira) e do mês no horário da padaria.
export function iniciosDosPeriodos(agora = new Date()) {
  const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  const semana = new Date(dia)
  semana.setDate(dia.getDate() - ((dia.getDay() + 6) % 7))
  const mes = new Date(agora.getFullYear(), agora.getMonth(), 1)
  return { dia, semana, mes }
}

export function useMetas() {
  const { dia, semana, mes } = iniciosDosPeriodos()
  const q = new URLSearchParams({
    dia: dia.toISOString(),
    semana: semana.toISOString(),
    mes: mes.toISOString(),
  })
  return useQuery({
    // A chave muda à meia-noite: o painel recomeça sozinho no dia seguinte.
    queryKey: ['metas', dia.toISOString()],
    queryFn: () => api.get<PainelMetas>(`/metas?${q}`),
  })
}

export function useSalvarMetas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dados: { alvo: string } & ValoresMeta) => api.put('/metas', dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metas'] })
      queryClient.invalidateQueries({ queryKey: ['time'] })
      queryClient.invalidateQueries({ queryKey: ['conquistas'] })
    },
  })
}
