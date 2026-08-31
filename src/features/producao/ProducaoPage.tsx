import { useState } from 'react'
import { cn } from '@/lib/utils'
import { PlanejamentoView } from '@/features/producao/PlanejamentoView'
import { ReceitasView } from '@/features/producao/ReceitasView'

type Aba = 'planejamento' | 'receitas'

export function ProducaoPage() {
  const [aba, setAba] = useState<Aba>('planejamento')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Produção</h1>
        <p className="text-sm text-muted-foreground">
          Fichas técnicas de receitas e planejamento de produção
        </p>
      </div>

      <div className="inline-flex rounded-lg border bg-card p-1">
        {(
          [
            { key: 'planejamento', label: 'Planejamento' },
            { key: 'receitas', label: 'Receitas' },
          ] as { key: Aba; label: string }[]
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setAba(item.key)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              aba === item.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {aba === 'planejamento' ? <PlanejamentoView /> : <ReceitasView />}
    </div>
  )
}
