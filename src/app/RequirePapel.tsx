import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import type { Papel } from '@/types/database'

// Rotas restritas: quem não tem o papel vai para o PDV (liberado para todos).
export function RequirePapel({ papeis }: { papeis: Papel[] }) {
  const { user } = useAuth()
  if (!user || !papeis.includes(user.papel)) return <Navigate to="/pdv" replace />
  return <Outlet />
}
