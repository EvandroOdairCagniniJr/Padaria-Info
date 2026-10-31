import { BookOpen, PlayCircle, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/features/auth/AuthContext'
import { VideoApresentacao } from '@/features/guia/VideoApresentacao'

function lerMarca(chave: string | null) {
  try {
    return !chave || localStorage.getItem(chave) === '1'
  } catch {
    return false
  }
}

function gravarMarca(chave: string | null) {
  try {
    if (chave) localStorage.setItem(chave, '1')
  } catch {
    // Sem localStorage o aviso só volta no próximo carregamento.
  }
}

// Primeira entrada (logo depois de criar a conta ou de ter o acesso liberado): abre o vídeo de
// apresentação do papel da pessoa. Depois, a faixa fica no topo até abrir o Guia ou dispensar.
export function BoasVindas() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const chave = user ? `padaria:boas-vindas:${user.id}` : null
  const chaveVideo = user ? `coffee-break:video-boas-vindas:${user.id}` : null
  const [dispensado, setDispensado] = useState(() => lerMarca(chave))
  const [videoAberto, setVideoAberto] = useState(() => !lerMarca(chaveVideo))

  if (!user) return null
  const publico = user.papel === 'funcionario' ? 'equipe' : 'gestao'
  const primeiroNome = user.nome.split(' ')[0] || 'pessoal'

  function dispensar() {
    setDispensado(true)
    gravarMarca(chave)
  }

  function fecharVideo() {
    setVideoAberto(false)
    gravarMarca(chaveVideo)
  }

  return (
    <>
      <Dialog open={videoAberto && pathname !== '/guia'} onOpenChange={(aberto) => !aberto && fecharVideo()}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Que bom ter você aqui, {primeiroNome}!</DialogTitle>
            <DialogDescription>
              Em 2 minutos, este vídeo mostra o caminho de tudo o que você vai usar no Coffee Break.
              Assista agora ou quando quiser, em Guia e dicas.
            </DialogDescription>
          </DialogHeader>
          <VideoApresentacao publico={publico} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={fecharVideo}>
              Assistir depois
            </Button>
            <Button asChild onClick={fecharVideo}>
              <Link to="/guia">Abrir o Guia e dicas</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!dispensado && pathname !== '/guia' && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-nowrap sm:gap-4">
          <BookOpen className="hidden size-5 shrink-0 text-primary sm:block" />
          <div className="min-w-48 flex-1 text-sm">
            <p className="font-medium">Boas-vindas, {primeiroNome}!</p>
            <p className="text-muted-foreground">
              Primeira vez por aqui? Veja o vídeo de 2 minutos ou o passo a passo no Guia.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setVideoAberto(true)}>
            <PlayCircle className="size-4" />
            Ver o vídeo
          </Button>
          <Button asChild size="sm" onClick={dispensar}>
            <Link to="/guia">Abrir o guia</Link>
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={dispensar} aria-label="Dispensar">
            <X className="size-4" />
          </Button>
        </div>
      )}
    </>
  )
}
