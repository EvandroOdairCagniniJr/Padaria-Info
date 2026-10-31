import { PlayCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PublicoVideo = 'equipe' | 'gestao'

// Vídeos de apresentação (public/videos): narrados, com legenda, gerados a partir das telas do
// próprio sistema. Um para a equipe da padaria e outro para donos e gerentes.
export const videos: Record<PublicoVideo, { src: string; poster: string; titulo: string; duracao: string }> = {
  equipe: {
    src: '/videos/coffee-break-equipe.mp4',
    poster: '/videos/coffee-break-equipe.jpg',
    titulo: 'Coffee Break para a equipe da padaria',
    duracao: '2 min',
  },
  gestao: {
    src: '/videos/coffee-break-gestao.mp4',
    poster: '/videos/coffee-break-gestao.jpg',
    titulo: 'Coffee Break para donos e gerentes',
    duracao: '2 min',
  },
}

export function VideoApresentacao({
  publico,
  className,
  autoPlay = false,
}: {
  publico: PublicoVideo
  className?: string
  autoPlay?: boolean
}) {
  const v = videos[publico]
  return (
    <section className={cn('overflow-hidden rounded-xl border bg-card shadow-sm', className)}>
      <div className="flex items-center gap-2 px-4 py-3">
        <PlayCircle className="size-5 text-primary" />
        <h2 className="min-w-0 flex-1 font-heading text-lg font-semibold">{v.titulo}</h2>
        <span className="text-xs text-muted-foreground">{v.duracao}</span>
      </div>
      <video
        key={v.src}
        src={v.src}
        poster={v.poster}
        controls
        autoPlay={autoPlay}
        preload="metadata"
        playsInline
        className="aspect-video w-full bg-black"
      >
        Seu navegador não conseguiu abrir o vídeo.
      </video>
    </section>
  )
}
