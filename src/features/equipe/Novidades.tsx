import { ArrowBigUpDash, Bell, Camera, IdCard, Loader2, UserPen } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Avatar } from '@/components/Avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/AuthContext'
import { useNovidades } from '@/features/equipe/api'
import { formatDataHora, tempoRelativo } from '@/lib/format'
import { ehGestao, papelLabels } from '@/lib/permissoes'
import type { NovidadePerfil, Papel } from '@/types/database'

// "Já vi até aqui": guardado por usuário neste navegador; o menu conta o que veio depois.
const EVENTO = 'padaria:novidades-vistas'

function chave(usuarioId: string) {
  return `padaria:novidades-vistas:${usuarioId}`
}

function lerVisto(usuarioId: string) {
  try {
    return localStorage.getItem(chave(usuarioId)) ?? ''
  } catch {
    return ''
  }
}

function marcarVisto(usuarioId: string, quando: string) {
  try {
    localStorage.setItem(chave(usuarioId), quando)
  } catch {
    // Sem localStorage o contador só some ao recarregar.
  }
  window.dispatchEvent(new Event(EVENTO))
}

function useVisto(usuarioId: string | undefined) {
  return useSyncExternalStore(
    (avisar) => {
      window.addEventListener(EVENTO, avisar)
      return () => window.removeEventListener(EVENTO, avisar)
    },
    () => (usuarioId ? lerVisto(usuarioId) : ''),
  )
}

// Para o menu lateral: quantas novidades o dono/gerente ainda não viu (feitas por outras pessoas).
export function useNovidadesNaoVistas() {
  const { user } = useAuth()
  const gestao = ehGestao(user?.papel)
  const novidades = useNovidades(gestao)
  const visto = useVisto(user?.id)
  if (!gestao || !user) return 0
  return (novidades.data ?? []).filter((n) => n.created_at > visto && n.alterado_por !== user.id)
    .length
}

function rotuloPapel(valor: string | null) {
  return valor ? (papelLabels[valor as Papel] ?? valor) : '—'
}

function descrever(n: NovidadePerfil) {
  const proprio = n.alterado_por === n.usuario_id
  const autor = n.alterado_por_nome ?? 'Alguém'
  switch (n.campo) {
    case 'foto':
      return proprio
        ? `${n.usuario_nome} ${n.valor_novo ? 'trocou a foto do perfil' : 'tirou a foto do perfil'}`
        : `${autor} ${n.valor_novo ? 'trocou a foto' : 'tirou a foto'} de ${n.usuario_nome}`
    case 'nome':
      return `${n.valor_antigo || 'Sem nome'} agora aparece como ${n.valor_novo}`
    case 'cargo':
      return proprio
        ? `${n.usuario_nome} mudou o próprio cargo: ${n.valor_antigo || 'sem cargo'} → ${n.valor_novo || 'sem cargo'}`
        : `${autor} promoveu ${n.usuario_nome} a ${n.valor_novo || 'sem cargo'} (antes: ${n.valor_antigo || 'sem cargo'})`
    case 'papel':
      return `${autor} mudou a função de ${n.usuario_nome}: ${rotuloPapel(n.valor_antigo)} → ${rotuloPapel(n.valor_novo)}`
  }
}

function icone(n: NovidadePerfil) {
  if (n.campo === 'foto') return Camera
  if (n.campo === 'nome') return UserPen
  if (n.alterado_por !== n.usuario_id) return ArrowBigUpDash
  return IdCard
}

// Card da Equipe para dono e gerência: o que cada um mudou no perfil.
export function NovidadesEquipe() {
  const { user } = useAuth()
  const novidades = useNovidades(true)
  // Marca do que já tinha visto ao abrir a tela: as novas ficam destacadas até sair dela.
  const [visto] = useState(() => (user ? lerVisto(user.id) : ''))
  const lista = novidades.data ?? []
  const maisRecente = lista[0]?.created_at

  // Abriu a Equipe = viu as novidades (zera o contador do menu).
  useEffect(() => {
    if (user && maisRecente && maisRecente > lerVisto(user.id)) marcarVisto(user.id, maisRecente)
  }, [user, maisRecente])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4 text-primary" />
          Novidades da equipe
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Mudanças de foto, nome, cargo e função. Só o dono e a gerência veem.
        </p>
      </CardHeader>
      <CardContent>
        {novidades.isLoading ? (
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        ) : lista.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Ninguém mudou o perfil ainda
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {lista.map((n) => {
              const Icone = icone(n)
              const nova = n.created_at > visto && n.alterado_por !== user?.id
              return (
                <li key={n.id} className="flex items-center gap-3 py-2.5">
                  <div className="relative">
                    <Avatar nome={n.usuario_nome} foto={n.usuario_foto} tamanho="md" />
                    <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-card shadow ring-1 ring-border">
                      <Icone className="size-3 text-primary" />
                    </span>
                  </div>
                  <span className="min-w-0 flex-1">{descrever(n)}</span>
                  {nova && (
                    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      Nova
                    </span>
                  )}
                  <span
                    className="shrink-0 text-xs text-muted-foreground"
                    title={formatDataHora(n.created_at)}
                  >
                    {tempoRelativo(n.created_at)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
