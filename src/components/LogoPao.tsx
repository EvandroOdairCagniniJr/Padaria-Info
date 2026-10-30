import { useEffect } from 'react'
import { usePadaria } from '@/features/padaria/api'
import { cn } from '@/lib/utils'

// Logo do sistema: o mesmo pão do ícone da aba do navegador (public/favicon.svg).
export function LogoPao({ className }: { className?: string }) {
  return (
    <img
      src="/favicon.svg"
      alt=""
      aria-hidden
      draggable={false}
      className={cn('size-9 shrink-0 rounded-xl shadow-sm', className)}
    />
  )
}

// Logo da padaria logada (enviada pelo dono em "Minha padaria"); sem ela, o pão do sistema.
// Também troca o ícone e o título da aba do navegador pela logo e o nome da padaria.
export function LogoPadaria({ className }: { className?: string }) {
  const padaria = usePadaria().data
  const logo = padaria?.logo ?? null
  const nome = padaria?.nome_fantasia?.trim() || null

  // Título da aba: o nome da padaria enquanto a pessoa está no sistema (no login, "Coffee Break").
  useEffect(() => {
    if (!nome) return
    const original = document.title
    document.title = nome
    return () => {
      document.title = original
    }
  }, [nome])

  useEffect(() => {
    const icone = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!icone) return
    const original = icone.getAttribute('href') ?? '/favicon.svg'
    const tipoOriginal = icone.getAttribute('type')
    if (logo) {
      icone.setAttribute('href', logo)
      icone.removeAttribute('type')
    }
    return () => {
      icone.setAttribute('href', original)
      if (tipoOriginal) icone.setAttribute('type', tipoOriginal)
    }
  }, [logo])

  if (!logo) return <LogoPao className={className} />
  return (
    <img
      src={logo}
      alt=""
      aria-hidden
      draggable={false}
      className={cn('size-9 shrink-0 rounded-xl bg-white object-contain p-0.5 shadow-sm', className)}
    />
  )
}
