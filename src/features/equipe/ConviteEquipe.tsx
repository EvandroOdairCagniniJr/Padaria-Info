import { Check, Copy, Loader2, RefreshCw, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useConvite, useNovoConvite } from '@/features/padaria/api'

// Painel do dono: código que a equipe usa em "Criar conta" para pedir acesso a esta padaria.
export function ConviteEquipe() {
  const convite = useConvite(true)
  const novo = useNovoConvite()
  const [copiado, setCopiado] = useState(false)
  const codigo = convite.data?.codigo

  async function copiar() {
    if (!codigo) return
    await navigator.clipboard.writeText(codigo)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function gerarNovo() {
    if (!confirm('Gerar um código novo? O código atual deixa de funcionar.')) return
    try {
      await novo.mutateAsync()
      toast.success('Código novo gerado')
    } catch {
      toast.error('Não foi possível gerar um código novo')
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <UserPlus className="size-5" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">Convide sua equipe</p>
        <p className="text-muted-foreground">
          Na tela de login, a pessoa escolhe "Criar conta" → "Entrar na equipe" e informa este
          código. Depois é só liberar o acesso aqui embaixo.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-lg border bg-muted px-3 py-1.5 font-mono text-lg font-semibold tracking-widest">
          {codigo ?? <Loader2 className="size-4 animate-spin" />}
        </span>
        <Button size="icon" variant="outline" onClick={copiar} title="Copiar código">
          {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={gerarNovo}
          disabled={novo.isPending}
          title="Gerar código novo"
        >
          <RefreshCw className={novo.isPending ? 'size-4 animate-spin' : 'size-4'} />
        </Button>
      </div>
    </div>
  )
}
