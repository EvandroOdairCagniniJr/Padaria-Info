import { useState } from 'react'
import { cn } from '@/lib/utils'
import { PlanejamentoView } from '@/features/producao/PlanejamentoView'
import { PerdasView } from '@/features/producao/PerdasView'
import { ReceitasView } from '@/features/producao/ReceitasView'
import { SugestaoView } from '@/features/producao/SugestaoView'

type Aba = 'sugestao' | 'planejamento' | 'receitas' | 'perdas'

export function ProducaoPage() {
  const [aba, setAba] = useState<Aba>('sugestao')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Produção</h1>
        <p className="text-sm text-muted-foreground">
          Quanto produzir, planejamento das fornadas, fichas técnicas e perdas
        </p>
      </div>

      <div className="inline-flex max-w-full overflow-x-auto rounded-lg border bg-card p-1">
        {(
          [
            { key: 'sugestao', label: 'Sugestão do dia' },
            { key: 'planejamento', label: 'Planejamento' },
            { key: 'receitas', label: 'Receitas' },
            { key: 'perdas', label: 'Perdas' },
          ] as { key: Aba; label: string }[]
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setAba(item.key)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              aba === item.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {aba === 'sugestao' && <SugestaoView />}
      {aba === 'planejamento' && <PlanejamentoView />}
      {aba === 'receitas' && <ReceitasView />}
      {aba === 'perdas' && <PerdasView />}
    </div>
  )
}
