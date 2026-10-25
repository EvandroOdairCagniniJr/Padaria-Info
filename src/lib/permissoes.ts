// Espelha as regras do servidor (server/routes.ts e server/equipe.ts). A tela só esconde
// o que o papel não pode fazer; quem garante a permissão é o servidor.
import type { Papel } from '@/types/database'

export const papelLabels: Record<Papel, string> = {
  dono: 'Dono',
  admin: 'Gerente',
  funcionario: 'Funcionário',
}

// Dono e admin: cadastros, financeiro, receitas e remoções.
export function ehGestao(papel: Papel | undefined) {
  return papel === 'dono' || papel === 'admin'
}
