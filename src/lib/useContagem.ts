import { useEffect, useRef, useState } from 'react'

const reduzMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Número que "conta" até o valor (ex.: R$ 0 → R$ 152,40). Ao mudar, anima do valor atual ao novo.
export function useContagem(alvo: number, duracaoMs = 900) {
  const [valor, setValor] = useState(() => (reduzMovimento() ? alvo : 0))
  const atual = useRef(valor)

  useEffect(() => {
    if (reduzMovimento()) {
      atual.current = alvo
      return
    }
    const inicio = atual.current
    const comeco = performance.now()
    let quadro = 0
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - comeco) / duracaoMs)
      // Começa rápido e desacelera no fim (ease-out cúbico).
      const v = inicio + (alvo - inicio) * (1 - (1 - t) ** 3)
      atual.current = v
      setValor(v)
      if (t < 1) quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [alvo, duracaoMs])

  // Com "reduzir movimento" ligado no sistema, mostra o valor final direto.
  return reduzMovimento() ? alvo : valor
}
