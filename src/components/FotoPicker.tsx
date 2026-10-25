import { Camera, Loader2, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/button'
import { reduzirFoto } from '@/lib/imagem'

// Foto do crachá: escolhe do computador/celular (no celular abre a câmera ou a galeria).
export function FotoPicker({
  nome,
  foto,
  onChange,
}: {
  nome: string
  foto: string | null
  onChange: (foto: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [processando, setProcessando] = useState(false)

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return
    setProcessando(true)
    try {
      onChange(await reduzirFoto(arquivo))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível usar essa imagem')
    } finally {
      setProcessando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar nome={nome || '?'} foto={foto} tamanho="lg" className="ring-4 ring-amber-100" />
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
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
          {processando ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          {foto ? 'Trocar foto' : 'Escolher foto'}
        </Button>
        {foto && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 className="size-4" />
            Remover
          </Button>
        )}
      </div>
    </div>
  )
}
