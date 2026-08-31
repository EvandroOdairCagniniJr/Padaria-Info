import {
  ChefHat,
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingCart,
  Warehouse,
  Wallet,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthContext'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/produtos', label: 'Produtos', icon: Package },
  { to: '/estoque', label: 'Estoque', icon: Warehouse },
  { to: '/pdv', label: 'PDV', icon: ShoppingCart },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet },
  { to: '/producao', label: 'Produção', icon: ChefHat },
]

export function MainLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-svh">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
        <div className="border-b px-4 py-4">
          <span className="text-lg font-semibold tracking-tight">Padaria Info</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t p-3">
          <div className="mb-2 truncate px-1 text-xs text-muted-foreground">{user?.email}</div>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-muted/20 p-6">
        <Outlet />
      </main>
    </div>
  )
}
