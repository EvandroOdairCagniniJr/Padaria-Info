import { BookOpen, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthContext'

// Aparece até a pessoa abrir o Guia ou dispensar (guardado por usuário neste navegador).
export function BoasVindas() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const chave = user ? `padaria:boas-vindas:${user.id}` : null
  const [dispensado, setDispensado] = useState(() => {
    try {
      return !chave || localStorage.getItem(chave) === '1'
    } catch {
      return false
    }
  })

  function dispensar() {
    setDispensado(true)
    try {
      if (chave) localStorage.setItem(chave, '1')
    } catch {
      // Sem localStorage o aviso só volta no próximo carregamento.
    }
  }

  if (dispensado || !user || pathname === '/guia') return null

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-nowrap sm:gap-4">
      <BookOpen className="hidden size-5 shrink-0 text-primary sm:block" />
      <div className="min-w-48 flex-1 text-sm">
        <p className="font-medium">Boas-vindas, {user.nome.split(' ')[0] || 'pessoal'}!</p>
        <p className="text-muted-foreground">
          Primeira vez por aqui? O Guia mostra o passo a passo de tudo que você vai usar.
        </p>
      </div>
      <Button asChild size="sm" onClick={dispensar}>
        <Link to="/guia">Abrir o guia</Link>
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={dispensar} aria-label="Dispensar">
        <X className="size-4" />
      </Button>
    </div>
  )
}
