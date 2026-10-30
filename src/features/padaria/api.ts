import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { enderecoEmLinha, mascaraCNPJ, mascaraTelefone } from '@/lib/documentos'
import type { DadosPadaria } from '@/types/database'
import { completarOpcoes, type OpcoesComprovante } from '@/features/padaria/opcoesComprovante'

const PADARIA_KEY = ['padaria'] as const

// Muda raramente: não entra na atualização automática.
export function usePadaria() {
  return useQuery({
    queryKey: PADARIA_KEY,
    queryFn: () => api.get<DadosPadaria | null>('/padaria'),
    staleTime: 10 * 60_000,
    refetchInterval: false,
  })
}

export function useSalvarPadaria() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dados: unknown) => api.put<DadosPadaria>('/padaria', dados),
    onSuccess: (dados) => queryClient.setQueryData(PADARIA_KEY, dados),
  })
}

export interface Loja {
  nome: string
  // Linhas do cabeçalho do comprovante (endereço, CNPJ, contato, Instagram, horário).
  linhas: string[]
  mensagem: string | null
  // Logo enviada pelo dono (data URL); sem ela, a inicial do nome no cabeçalho.
  logo?: string | null
  // Cor, título, recado extra e o que aparece (Minha padaria → Personalizar comprovante).
  opcoes: OpcoesComprovante
}

// Cabeçalho do comprovante a partir do cadastro da padaria (ou do .env, em instalações antigas).
export function lojaDoComprovante(p: DadosPadaria | null | undefined): Loja {
  if (!p) {
    return {
      nome: import.meta.env.VITE_NOME_PADARIA || 'Padaria',
      linhas: [
        import.meta.env.VITE_ENDERECO_PADARIA,
        import.meta.env.VITE_CNPJ_PADARIA && `CNPJ ${import.meta.env.VITE_CNPJ_PADARIA}`,
        import.meta.env.VITE_TELEFONE_PADARIA && `Tel. ${import.meta.env.VITE_TELEFONE_PADARIA}`,
      ].filter(Boolean) as string[],
      mensagem: null,
      opcoes: completarOpcoes(null),
    }
  }
  const opcoes = completarOpcoes(p.comprovante)
  const ver = opcoes.mostrar
  // Telefone e WhatsApp numa linha só (se forem o mesmo número, aparece uma vez).
  const contato = [
    p.telefone && `Tel. ${mascaraTelefone(p.telefone)}`,
    p.whatsapp && p.whatsapp !== p.telefone && `WhatsApp ${mascaraTelefone(p.whatsapp)}`,
  ].filter(Boolean)
  const instagram = p.instagram?.trim().replace(/^@?/, '@')
  return {
    nome: p.nome_fantasia,
    linhas: [
      ver.endereco && enderecoEmLinha(p.endereco),
      ver.cnpj && p.cnpj && `CNPJ ${mascaraCNPJ(p.cnpj)}`,
      ver.telefone && contato.length > 0 && contato.join(' · '),
      ver.instagram && instagram && instagram.length > 1 && instagram,
      ver.horario && p.horario && p.horario,
    ].filter(Boolean) as string[],
    mensagem: p.mensagem_comprovante,
    logo: ver.logo ? (p.logo ?? null) : null,
    opcoes,
  }
}

// Código de convite: o funcionário informa em "Criar conta" para pedir acesso à equipe.
export function useConvite(ativo: boolean) {
  return useQuery({
    queryKey: ['padaria', 'convite'],
    queryFn: () => api.get<{ codigo: string | null }>('/padaria/convite'),
    enabled: ativo,
    refetchInterval: false,
  })
}

export function useNovoConvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ codigo: string }>('/padaria/convite'),
    onSuccess: (dados) => queryClient.setQueryData(['padaria', 'convite'], dados),
  })
}
