import { ImageUp, Loader2, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { LogoPao } from '@/components/LogoPao'
import { Button } from '@/components/ui/button'
import { reduzirLogo } from '@/lib/imagem'

// Logo da padaria em "Minha padaria": aparece no menu, no comprovante e no ícone da aba.
export function LogoPicker({
  logo,
  onChange,
}: {
  logo: string | null
  onChange: (logo: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [processando, setProcessando] = useState(false)

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return
    setProcessando(true)
    try {
      onChange(await reduzirLogo(arquivo))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível usar essa imagem')
    } finally {
      setProcessando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-background">
        {logo ? (
          <img src={logo} alt="Logo da padaria" className="size-full object-contain p-1.5" />
        ) : (
          <LogoPao className="size-14 shadow-none" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="font-heading text-lg font-semibold">Logo da padaria</h2>
        <p className="text-sm text-muted-foreground">
          Aparece no menu, no comprovante e no ícone da aba do navegador. Sem logo, fica o pãozinho
          do Padaria Info.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => escolher(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={processando}
          onClick={() => inputRef.current?.click()}
        >
          {processando ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
          {logo ? 'Trocar logo' : 'Enviar logo'}
        </Button>
        {logo && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 className="size-4" />
            Remover
          </Button>
        )}
      </div>
    </div>
  )
}
