import { Check, Receipt, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  completarOpcoes,
  coresComprovante,
  itensMostrar,
  opcoesPadrao,
  TITULO_PADRAO,
  type CorComprovante,
  type ItemMostrar,
  type OpcoesComprovante,
} from '@/features/padaria/opcoesComprovante'
import { cn } from '@/lib/utils'

// Minha padaria → Personalizar comprovante. A prévia ao lado se atualiza a cada mudança.
export function PersonalizarComprovante({
  valor,
  onChange,
}: {
  valor: Partial<OpcoesComprovante> | null | undefined
  onChange: (opcoes: OpcoesComprovante) => void
}) {
  const o = completarOpcoes(valor)
  const mudar = (parcial: Partial<OpcoesComprovante>) => onChange({ ...o, ...parcial })
  const alternar = (chave: ItemMostrar) => mudar({ mostrar: { ...o.mostrar, [chave]: !o.mostrar[chave] } })

  return (
    <section className="space-y-5 rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            <Receipt className="size-4" />
          </span>
          <div>
            <h2 className="font-heading text-lg font-semibold">Personalizar comprovante</h2>
            <p className="text-sm text-muted-foreground">
              Do seu jeito: cor, título, recado e o que aparece para o cliente.
            </p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(opcoesPadrao)}>
          <RotateCcw className="size-4" />
          Voltar ao padrão
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Cor do cabeçalho</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor do cabeçalho">
          {(Object.keys(coresComprovante) as CorComprovante[]).map((cor) => {
            const ativa = o.cor === cor
            return (
              <button
                key={cor}
                type="button"
                role="radio"
                aria-checked={ativa}
                onClick={() => mudar({ cor })}
                className={cn(
                  'flex items-center gap-2 rounded-full border bg-background py-1 pr-3 pl-1 text-sm transition-colors hover:border-primary/60',
                  ativa && 'border-primary ring-2 ring-primary/25',
                )}
              >
                <span
                  className="flex size-6 items-center justify-center rounded-full text-white"
                  style={{ background: coresComprovante[cor].hex }}
                >
                  {ativa && <Check className="size-3.5" />}
                </span>
                {coresComprovante[cor].nome}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="comprovante-titulo">Título</Label>
          <Input
            id="comprovante-titulo"
            maxLength={40}
            placeholder={TITULO_PADRAO}
            value={o.titulo === TITULO_PADRAO ? '' : o.titulo}
            onChange={(e) => mudar({ titulo: e.target.value || TITULO_PADRAO })}
          />
          <p className="text-xs text-muted-foreground">Ex.: Cupom de venda, Seu pedido, Recibo</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="comprovante-recado">Recado extra no rodapé</Label>
          <Input
            id="comprovante-recado"
            maxLength={160}
            placeholder="Ex.: Wi-Fi: Padaria123 · Encomendas pelo WhatsApp"
            value={o.mensagem_extra ?? ''}
            onChange={(e) => mudar({ mensagem_extra: e.target.value || null })}
          />
          <p className="text-xs text-muted-foreground">
            Aparece embaixo da mensagem de agradecimento
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>O que aparece no comprovante</Label>
        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {(Object.keys(itensMostrar) as ItemMostrar[]).map((chave) => (
            <label
              key={chave}
              htmlFor={`mostrar-${chave}`}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm hover:bg-muted/60"
            >
              <input
                id={`mostrar-${chave}`}
                type="checkbox"
                className="size-4 accent-primary"
                checked={o.mostrar[chave]}
                onChange={() => alternar(chave)}
              />
              {itensMostrar[chave]}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Data, forma de pagamento, itens, total, troco e "Documento sem valor fiscal" sempre aparecem.
          Endereço, contatos e horário vêm dos dados preenchidos abaixo.
        </p>
      </div>
    </section>
  )
}
