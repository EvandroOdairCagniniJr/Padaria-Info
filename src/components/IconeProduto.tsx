import { chaveCategoria, useFotosCategorias } from '@/features/produtos/api'
import { iconeProduto } from '@/lib/iconeProduto'
import { cn } from '@/lib/utils'

const tamanhos = {
  xs: 'size-5 rounded-md [&_svg]:size-3',
  sm: 'size-8 rounded-lg [&_svg]:size-4',
  lg: 'size-12 rounded-xl [&_svg]:size-6',
}

// Imagem do produto na vitrine: a foto da categoria, se o dono escolheu uma;
// senão o ícone automático (pela categoria e pelo nome).
export function IconeProduto({
  produto,
  tamanho = 'sm',
  className,
}: {
  produto: { nome: string; categoria?: string | null }
  tamanho?: keyof typeof tamanhos
  className?: string
}) {
  const { data: fotos } = useFotosCategorias()
  const foto = produto.categoria ? fotos?.get(chaveCategoria(produto.categoria)) : undefined

  if (foto) {
    return (
      <img
        src={foto}
        alt=""
        className={cn('shrink-0 object-cover', tamanhos[tamanho], className)}
      />
    )
  }

  const { icone: Icone, cor } = iconeProduto(produto)
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center', tamanhos[tamanho], cor, className)}
    >
      <Icone aria-hidden />
    </span>
  )
}

// A imagem de uma categoria sozinha (chips do PDV, formulário de produto).
export function IconeCategoria({
  categoria,
  tamanho = 'sm',
  className,
}: {
  categoria: string
  tamanho?: keyof typeof tamanhos
  className?: string
}) {
  return (
    <IconeProduto produto={{ nome: '', categoria }} tamanho={tamanho} className={className} />
  )
}
