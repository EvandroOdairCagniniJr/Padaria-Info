import { PartyPopper } from 'lucide-react'
import { useEffect, useMemo, type CSSProperties } from 'react'
import { formatBRL } from '@/lib/format'
import { useContagem } from '@/lib/useContagem'

const delicias = ['🥖', '🥐', '🍞', '🧁', '🥯', '🍩', '🥨', '☕']

// "Sorteio" fixo por posição (0–1): cada pão voa para um lado, sem Math.random na renderização.
function sorteio(i: number, k: number) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return x - Math.floor(x)
}

// Comemoração ao finalizar a venda: check desenhado, total contando e pães estourando.
// Some sozinha (ou com um clique) e então o comprovante abre.
export function VendaConcluida({
  total,
  bateuMeta,
  onFim,
}: {
  total: number
  bateuMeta: boolean
  onFim: () => void
}) {
  const valor = useContagem(total, 700)
  const duracao = bateuMeta ? 2600 : 1700

  useEffect(() => {
    const id = setTimeout(onFim, duracao)
    return () => clearTimeout(id)
  }, [onFim, duracao])

  const particulas = useMemo(
    () => {
      const quantidade = bateuMeta ? 22 : 14
      return Array.from({ length: quantidade }, (_, i) => {
        const angulo = (i / quantidade) * Math.PI * 2 + sorteio(i, 1) * 0.4
        const distancia = 140 + sorteio(i, 2) * 120
        return {
          emoji: delicias[i % delicias.length],
          dx: `${Math.cos(angulo) * distancia}px`,
          dy: `${Math.sin(angulo) * distancia}px`,
          giro: `${Math.round(sorteio(i, 3) * 360 - 180)}deg`,
          atraso: `${0.15 + sorteio(i, 4) * 0.2}s`,
          tamanho: 22 + sorteio(i, 5) * 14,
        }
      })
    },
    [bateuMeta],
  )

  return (
    <div
      className="venda-fundo fixed inset-0 z-[60] flex cursor-pointer items-center justify-center overflow-hidden bg-black/35 backdrop-blur-[2px]"
      onClick={onFim}
      role="status"
      aria-live="assertive"
    >
      {particulas.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="venda-particula pointer-events-none select-none"
          style={
            {
              '--dx': p.dx,
              '--dy': p.dy,
              '--giro': p.giro,
              '--atraso': p.atraso,
              fontSize: p.tamanho,
            } as CSSProperties
          }
        >
          {p.emoji}
        </span>
      ))}

      <div className="venda-cartao relative flex w-72 flex-col items-center rounded-3xl bg-card px-8 py-7 text-center shadow-2xl">
        <div className="relative mb-4 flex size-20 items-center justify-center">
          <span aria-hidden className="venda-onda absolute inset-0 rounded-full bg-emerald-400" />
          <span className="venda-circulo absolute inset-0 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40" />
          <svg viewBox="0 0 52 52" className="relative size-11" aria-hidden>
            <path
              className="venda-check"
              d="M14 27 l8 8 l16 -18"
              fill="none"
              stroke="white"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-muted-foreground">Venda registrada!</p>
        <p className="font-heading text-4xl font-bold tabular-nums">{formatBRL(valor)}</p>
        {bateuMeta && (
          <p
            className="venda-meta mt-3 flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800"
            style={{ animationDelay: '0.6s' }}
          >
            <PartyPopper className="size-4" />
            Meta do dia batida!
          </p>
        )}
        <p className="mt-4 text-[11px] text-muted-foreground">Toque para continuar</p>
      </div>
    </div>
  )
}
