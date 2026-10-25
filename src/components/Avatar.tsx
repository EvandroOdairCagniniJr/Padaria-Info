import { cn } from '@/lib/utils'

// Sem foto: iniciais num fundo "de padaria", sempre a mesma cor para a mesma pessoa.
const fundos = [
  'bg-amber-200 text-amber-900',
  'bg-orange-200 text-orange-900',
  'bg-rose-200 text-rose-900',
  'bg-yellow-200 text-yellow-900',
  'bg-stone-300 text-stone-800',
  'bg-lime-200 text-lime-900',
]

const tamanhos = {
  xs: 'size-5 text-[9px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-20 text-2xl',
  xl: 'size-24 text-3xl',
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  const primeira = partes[0][0]
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primeira + ultima).toUpperCase()
}

function corDoNome(nome: string) {
  let soma = 0
  for (const c of nome) soma = (soma + c.charCodeAt(0)) % fundos.length
  return fundos[soma]
}

export function Avatar({
  nome,
  foto,
  tamanho = 'md',
  className,
}: {
  nome: string
  foto?: string | null
  tamanho?: keyof typeof tamanhos
  className?: string
}) {
  if (foto) {
    return (
      <img
        src={foto}
        alt={nome}
        className={cn('shrink-0 rounded-full object-cover', tamanhos[tamanho], className)}
      />
    )
  }
  return (
    <span
      aria-label={nome}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-heading font-semibold',
        tamanhos[tamanho],
        corDoNome(nome),
        className,
      )}
    >
      {iniciais(nome)}
    </span>
  )
}
