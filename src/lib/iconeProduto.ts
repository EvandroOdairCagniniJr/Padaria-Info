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
    cor: 'vitrine-manteiga',
    categoria: 'Folhados',
  },
  {
    termos: /bolo|torta|cuca|panetone|chocotone/,
    icone: CakeSlice,
    cor: 'vitrine-morango',
    categoria: 'Bolos e tortas',
  },
  {
    termos: /sonho|rosquinha|donut|churros/,
    icone: Donut,
    cor: 'vitrine-doce-de-leite',
    categoria: 'Doces',
  },
  {
    termos: /biscoito|bolacha|cookie|broa|amanteigad/,
    icone: Cookie,
    cor: 'vitrine-biscoito',
    categoria: 'Biscoitos',
  },
  {
    termos: /caf[eé]|capuccino|cappuccino|expresso|pingado/,
    icone: Coffee,
    cor: 'vitrine-cafe',
    categoria: 'Cafés',
  },
  {
    termos: /farinha|fermento|a[cç][uú]car|\bsal\b|ingrediente|insumo|[oó]leo|margarina/,
    icone: Package,
    cor: 'vitrine-farinha',
    categoria: 'Ingredientes',
  },
  {
    termos: /p[aã]o|p[aã]es|baguete|bisnaga|ciabatta|de forma|careca|sovado|bengala/,
    icone: Wheat,
    cor: 'vitrine-trigo',
    categoria: 'Pães',
  },
  {
    termos: /sandu[ií]che|misto|lanche|salgad|coxinha|esfiha|empada|pastel|enroladinho|hamb/,
    icone: Sandwich,
    cor: 'vitrine-queijo',
    categoria: 'Salgados e lanches',
  },
  {
    termos: /leite|latic[ií]nio|iogurte|requeij|manteiga|queijo|nata/,
    icone: Milk,
    cor: 'vitrine-nata',
    categoria: 'Laticínios',
  },
  {
    termos: /refri|suco|[aá]gua|bebida|ch[aá] gelado|energ/,
    icone: CupSoda,
    cor: 'vitrine-laranja',
    categoria: 'Bebidas',
  },
  {
    termos: /sorvete|picol[eé]|a[cç]a[ií]/,
    icone: IceCreamCone,
    cor: 'vitrine-frutas',
    categoria: 'Sorvetes',
  },
  { termos: /pizza/, icone: Pizza, cor: 'vitrine-tomate', categoria: 'Pizzas' },
  {
    termos: /doce|brigadeiro|bala|chocolate|bombom|pudim/,
    icone: Candy,
    cor: 'vitrine-chocolate',
    categoria: 'Doces',
  },
  {
    termos: /\bovos?\b|merceari/,
    icone: Egg,
    cor: 'vitrine-farinha',
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
  return regraDoProduto(produto) ?? { icone: Croissant, cor: 'vitrine-manteiga' }
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
