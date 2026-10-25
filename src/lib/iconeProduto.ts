import {
  CakeSlice,
  Candy,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Donut,
  Egg,
  IceCreamCone,
  Milk,
  Package,
  Pizza,
  Sandwich,
  Wheat,
  type LucideIcon,
} from 'lucide-react'

// Ícone e cor de "vitrine" para cada produto, pelo nome ou categoria.
// A primeira regra que casar vence (por isso pães vêm antes de leite/doce: "pão de queijo",
// "pão doce"); sem regra, vira um croissant.
const regras: { termos: RegExp; icone: LucideIcon; cor: string; categoria?: string }[] = [
  {
    termos: /croissant|folhad/,
    icone: Croissant,
    cor: 'bg-amber-100 text-amber-700',
    categoria: 'Folhados',
  },
  {
    termos: /bolo|torta|cuca|panetone|chocotone/,
    icone: CakeSlice,
    cor: 'bg-rose-100 text-rose-700',
    categoria: 'Bolos e tortas',
  },
  {
    termos: /sonho|rosquinha|donut|churros/,
    icone: Donut,
    cor: 'bg-pink-100 text-pink-700',
    categoria: 'Doces',
  },
  {
    termos: /biscoito|bolacha|cookie|broa|amanteigad/,
    icone: Cookie,
    cor: 'bg-orange-100 text-orange-700',
    categoria: 'Biscoitos',
  },
  {
    termos: /caf[eé]|capuccino|cappuccino|expresso|pingado/,
    icone: Coffee,
    cor: 'bg-stone-200 text-stone-700',
    categoria: 'Cafés',
  },
  {
    termos: /farinha|fermento|a[cç][uú]car|\bsal\b|ingrediente|insumo|[oó]leo|margarina/,
    icone: Package,
    cor: 'bg-neutral-200 text-neutral-600',
    categoria: 'Ingredientes',
  },
  {
    termos: /p[aã]o|p[aã]es|baguete|bisnaga|ciabatta|de forma|careca|sovado|bengala/,
    icone: Wheat,
    cor: 'bg-amber-100 text-amber-800',
    categoria: 'Pães',
  },
  {
    termos: /sandu[ií]che|misto|lanche|salgad|coxinha|esfiha|empada|pastel|enroladinho|hamb/,
    icone: Sandwich,
    cor: 'bg-yellow-100 text-yellow-800',
    categoria: 'Salgados e lanches',
  },
  {
    termos: /leite|latic[ií]nio|iogurte|requeij|manteiga|queijo|nata/,
    icone: Milk,
    cor: 'bg-sky-100 text-sky-700',
    categoria: 'Laticínios',
  },
  {
    termos: /refri|suco|[aá]gua|bebida|ch[aá] gelado|energ/,
    icone: CupSoda,
    cor: 'bg-cyan-100 text-cyan-700',
    categoria: 'Bebidas',
  },
  {
    termos: /sorvete|picol[eé]|a[cç]a[ií]/,
    icone: IceCreamCone,
    cor: 'bg-violet-100 text-violet-700',
    categoria: 'Sorvetes',
  },
  { termos: /pizza/, icone: Pizza, cor: 'bg-red-100 text-red-700', categoria: 'Pizzas' },
  {
    termos: /doce|brigadeiro|bala|chocolate|bombom|pudim/,
    icone: Candy,
    cor: 'bg-fuchsia-100 text-fuchsia-700',
    categoria: 'Doces',
  },
  {
    termos: /\bovos?\b|merceari/,
    icone: Egg,
    cor: 'bg-amber-50 text-amber-600',
    categoria: 'Mercearia',
  },
]

// A categoria vem primeiro: todos os produtos de uma categoria ficam com a mesma imagem.
function regraDoProduto(produto: { nome: string; categoria?: string | null }) {
  const categoria = produto.categoria?.trim().toLowerCase() ?? ''
  const nome = produto.nome.toLowerCase()
  return (
    (categoria && regras.find((r) => r.termos.test(categoria))) ||
    regras.find((r) => r.termos.test(nome)) ||
    null
  )
}

export function iconeProduto(produto: { nome: string; categoria?: string | null }) {
  return regraDoProduto(produto) ?? { icone: Croissant, cor: 'bg-amber-100 text-amber-700' }
}

// "Família" do produto para os destaques da Equipe (melhor vendedor de doces, de bebidas...).
export type Familia = 'paes' | 'doces' | 'bebidas' | 'salgados' | 'mercearia'

const familiaDaCategoria: Record<string, Familia> = {
  Pães: 'paes',
  Folhados: 'paes',
  Doces: 'doces',
  'Bolos e tortas': 'doces',
  Biscoitos: 'doces',
  Sorvetes: 'doces',
  Cafés: 'bebidas',
  Bebidas: 'bebidas',
  'Salgados e lanches': 'salgados',
  Pizzas: 'salgados',
  Laticínios: 'mercearia',
  Mercearia: 'mercearia',
  Ingredientes: 'mercearia',
}

export function familiaDoProduto(produto: { nome: string; categoria?: string | null }) {
  const categoria = regraDoProduto(produto)?.categoria
  return categoria ? (familiaDaCategoria[categoria] ?? null) : null
}

// Categoria sugerida pelo nome ("Pão francês" → "Pães"); null quando nenhuma regra casa.
export function categoriaSugerida(nome: string) {
  const texto = nome.trim().toLowerCase()
  if (!texto) return null
  return regras.find((r) => r.termos.test(texto))?.categoria ?? null
}

// Categorias de padaria oferecidas na lista mesmo antes de existir produto nelas.
export const categoriasPadrao = [
  ...new Set(regras.map((r) => r.categoria).filter(Boolean)),
] as string[]
