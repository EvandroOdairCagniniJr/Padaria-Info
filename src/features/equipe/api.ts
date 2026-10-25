import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  AtividadeEquipe,
  ContatoEmergencia,
  EnderecoCadastro,
  Turno,
  MuralEquipe,
  NovidadePerfil,
  Papel,
  ResumoMembro,
} from '@/types/database'

const EQUIPE_KEY = ['equipe'] as const
const MURAL_KEY = ['time'] as const

// Tudo que mostra pessoas: painel do dono, mural e novidades.
export function invalidarEquipe(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: EQUIPE_KEY })
  queryClient.invalidateQueries({ queryKey: MURAL_KEY })
}

// Mural (todos veem). Atualiza a cada 15 s para o ranking acompanhar as vendas dos outros caixas;
// as vendas deste computador já atualizam na hora (useFinalizarVenda).
export function useMural(desdeISO: string, hojeISO: string) {
  return useQuery({
    queryKey: [...MURAL_KEY, desdeISO, hojeISO],
    queryFn: () =>
      api.get<MuralEquipe>(
        `/time?desde=${encodeURIComponent(desdeISO)}&hoje=${encodeURIComponent(hojeISO)}`,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  })
}

export function useNovidades(habilitado: boolean) {
  return useQuery({
    queryKey: [...MURAL_KEY, 'novidades'],
    queryFn: () => api.get<NovidadePerfil[]>('/time/novidades'),
    enabled: habilitado,
    refetchInterval: 60_000,
  })
}

export function useResumoEquipe(desdeISO: string, hojeISO: string) {
  return useQuery({
    queryKey: [...EQUIPE_KEY, 'resumo', desdeISO, hojeISO],
    queryFn: () =>
      api.get<ResumoMembro[]>(
        `/equipe/resumo?desde=${encodeURIComponent(desdeISO)}&hoje=${encodeURIComponent(hojeISO)}`,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })
}

export function useAtividadeEquipe(usuarioId: string | null) {
  return useQuery({
    queryKey: [...EQUIPE_KEY, 'atividade', usuarioId],
    queryFn: () =>
      api.get<AtividadeEquipe[]>(
        `/equipe/atividade?limite=50${usuarioId ? `&usuario_id=${encodeURIComponent(usuarioId)}` : ''}`,
      ),
    refetchInterval: 60_000,
  })
}

// Cadastro completo (documentos e telefones podem ir com máscara: o servidor guarda só dígitos).
export interface CadastroPessoa {
  cpf?: string | null
  telefone?: string | null
  data_nascimento?: string | null
  data_admissao?: string | null
  turno?: Turno | null
  endereco?: Partial<EnderecoCadastro> | null
  contato_emergencia?: Partial<ContatoEmergencia> | null
  observacoes?: string | null
}

export interface NovoMembro extends CadastroPessoa {
  nome: string
  email: string
  senha: string
  papel: Exclude<Papel, 'dono'>
  cargo?: string
  foto?: string | null
}

export interface AlteracaoMembro extends CadastroPessoa {
  nome?: string
  papel?: Exclude<Papel, 'dono'>
  ativo?: boolean
  senha?: string
  cargo?: string
  foto?: string | null
}

export function useCriarMembro() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (membro: NovoMembro) => api.post('/equipe/membros', membro),
    onSuccess: () => invalidarEquipe(queryClient),
  })
}

export function useAlterarMembro() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: AlteracaoMembro }) =>
      api.patch(`/equipe/membros/${id}`, changes),
    onSuccess: () => invalidarEquipe(queryClient),
  })
}

