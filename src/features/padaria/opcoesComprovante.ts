// Como o dono quer o comprovante (Minha padaria → Personalizar comprovante): cor do cabeçalho,
// título, recado extra e o que aparece ou não. Mesmas chaves e limites do servidor (server/cadastro.ts).

export const coresComprovante = {
  chocolate: { nome: 'Chocolate', hex: '#9a5420' },
  cafe: { nome: 'Café', hex: '#4a2c1a' },
  caramelo: { nome: 'Caramelo', hex: '#b06a14' },
  vinho: { nome: 'Vinho', hex: '#7a2333' },
  oliva: { nome: 'Oliva', hex: '#4f5d2f' },
  grafite: { nome: 'Grafite', hex: '#2f2f33' },
} as const

export type CorComprovante = keyof typeof coresComprovante

export const itensMostrar = {
  logo: 'Logo da padaria',
  endereco: 'Endereço',
  cnpj: 'CNPJ',
  telefone: 'Telefone e WhatsApp',
  instagram: 'Instagram',
  horario: 'Horário de funcionamento',
  selo: 'Selo "Pagamento confirmado"',
  numero: 'Nº do comprovante',
  atendente: 'Nome de quem atendeu',
  detalhe_itens: 'Quantidade × preço de cada item',
  resumo: 'Resumo: nº de itens, subtotal e economia',
} as const

export type ItemMostrar = keyof typeof itensMostrar

export interface OpcoesComprovante {
  cor: CorComprovante
  titulo: string
  mensagem_extra: string | null
  mostrar: Record<ItemMostrar, boolean>
}

export const TITULO_PADRAO = 'Comprovante de venda'

// Tudo ligado, menos o horário (deixa o cupom mais comprido e nem toda padaria quer).
export const opcoesPadrao: OpcoesComprovante = {
  cor: 'chocolate',
  titulo: TITULO_PADRAO,
  mensagem_extra: null,
  mostrar: {
    logo: true,
    endereco: true,
    cnpj: true,
    telefone: true,
    instagram: true,
    horario: false,
    selo: true,
    numero: true,
    atendente: true,
    detalhe_itens: true,
    resumo: true,
  },
}

// O que está salvo (pode faltar campo, de versões antigas) completado com o padrão.
export function completarOpcoes(salvo: Partial<OpcoesComprovante> | null | undefined): OpcoesComprovante {
  return {
    cor: salvo?.cor && salvo.cor in coresComprovante ? salvo.cor : opcoesPadrao.cor,
    titulo: salvo?.titulo?.trim() || opcoesPadrao.titulo,
    mensagem_extra: salvo?.mensagem_extra?.trim() || null,
    mostrar: { ...opcoesPadrao.mostrar, ...(salvo?.mostrar ?? {}) },
  }
}
