import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { enderecoEmLinha, mascaraCNPJ, mascaraTelefone } from '@/lib/documentos'
import type { DadosPadaria } from '@/types/database'

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
  // Linhas do cabeçalho do comprovante (endereço, CNPJ, telefone).
  linhas: string[]
  mensagem: string | null
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
    }
  }
  const telefone = p.telefone || p.whatsapp
  return {
    nome: p.nome_fantasia,
    linhas: [
      enderecoEmLinha(p.endereco),
      p.cnpj && `CNPJ ${mascaraCNPJ(p.cnpj)}`,
      telefone && `Tel. ${mascaraTelefone(telefone)}`,
    ].filter(Boolean) as string[],
    mensagem: p.mensagem_comprovante,
  }
}
