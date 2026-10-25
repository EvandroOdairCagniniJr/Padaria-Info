import type { Turno } from '@/types/database'

// Funções comuns numa padaria brasileira — sugestões no cadastro (o dono pode digitar outra).
// O cargo é só o "crachá"; o que a pessoa pode fazer no sistema vem do papel (lib/permissoes.ts).
export const CARGO_DONO = 'Dono(a) da padaria'

export const cargosSugeridos = {
  admin: ['Gerente', 'Subgerente', 'Encarregado(a)', 'Supervisor(a) de loja'],
  funcionario: [
    'Atendente',
    'Caixa',
    'Balconista',
    'Padeiro(a)',
    'Confeiteiro(a)',
    'Salgadeiro(a)',
    'Auxiliar de padaria',
    'Auxiliar de cozinha',
    'Chapeiro(a)',
    'Barista',
    'Repositor(a)',
    'Entregador(a)',
    'Auxiliar de limpeza',
  ],
} as const

// Para agrupar o "organograma" da Equipe: cozinha x salão.
const daCozinha = /padeir|confeit|salgad|cozinha|chapeir|forno|auxiliar de padaria/i

export function setorDoCargo(cargo: string): 'cozinha' | 'salao' {
  return daCozinha.test(cargo) ? 'cozinha' : 'salao'
}

// Turnos de uma padaria (a madrugada é o turno do forno).
export const turnoLabels: Record<Turno, string> = {
  madrugada: 'Madrugada (forno)',
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  integral: 'Integral',
}
