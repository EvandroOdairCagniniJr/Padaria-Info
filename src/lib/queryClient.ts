import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Trocar de tela mostra o que já está em cache na hora e confere com o servidor por trás.
      staleTime: 10_000,
      // Vários computadores na padaria: a tela aberta busca novidades sozinha (só com a aba visível).
      refetchInterval: 20_000,
      retry: 1,
    },
  },
})
