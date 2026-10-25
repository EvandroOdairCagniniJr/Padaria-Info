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
