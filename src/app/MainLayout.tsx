import {
  Banknote,
  BarChart3,
  BookOpen,
  CalendarClock,
  ChefHat,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Package,
  Percent,
  Receipt,
  ShoppingCart,
  Store,
  Tag,
  Target,
  Users,
  Warehouse,
  Wallet,
  X,
} from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { BoasVindas } from '@/app/BoasVindas'
import { Avatar } from '@/components/Avatar'
import { LogoPadaria } from '@/components/LogoPao'
import { usePadaria } from '@/features/padaria/api'
import { PerfilDialog } from '@/features/auth/PerfilDialog'
import { useNovidadesNaoVistas } from '@/features/equipe/Novidades'
import { precarregarPaginas } from '@/app/paginas'
import { useAuth } from '@/features/auth/AuthContext'
import { papelLabels } from '@/lib/permissoes'
import type { Papel } from '@/types/database'

const todos: Papel[] = ['dono', 'admin', 'funcionario']
const gestao: Papel[] = ['dono', 'admin']

type ItemMenu = {
  to: string
  label: string
  icon: typeof LayoutDashboard
  papeis: Papel[]
  end?: boolean
}

// Menu em seções. Mesmas regras das rotas em AppRouter (RequirePapel).
const secoes: { titulo: string | null; itens: ItemMenu[] }[] = [
  {
    titulo: null,
    itens: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, papeis: gestao }],
  },
  {
    titulo: 'Balcão',
    itens: [
      { to: '/pdv', label: 'PDV', icon: ShoppingCart, papeis: todos },
      { to: '/caixa', label: 'Caixa', icon: Banknote, papeis: todos },
      { to: '/vendas', label: 'Vendas', icon: Receipt, papeis: todos },
      { to: '/encomendas', label: 'Encomendas', icon: CalendarClock, papeis: todos },
      { to: '/promocoes', label: 'Promoções', icon: Tag, papeis: gestao },
    ],
  },
  {
    titulo: 'Produção',
    itens: [
      { to: '/producao', label: 'Produção', icon: ChefHat, papeis: todos },
      { to: '/estoque', label: 'Estoque', icon: Warehouse, papeis: todos },
      { to: '/produtos', label: 'Produtos', icon: Package, papeis: gestao },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      { to: '/analise', label: 'Análise de vendas', icon: BarChart3, papeis: gestao },
      { to: '/metas', label: 'Metas', icon: Target, papeis: todos },
      { to: '/financeiro', label: 'Financeiro', icon: Wallet, papeis: gestao },
      { to: '/margens', label: 'Margens e CMV', icon: Percent, papeis: gestao },
    ],
  },
  {
    titulo: 'Equipe',
    itens: [
      { to: '/equipe', label: 'Equipe', icon: Users, papeis: todos },
      { to: '/padaria', label: 'Minha padaria', icon: Store, papeis: ['dono'] },
      { to: '/guia', label: 'Guia e dicas', icon: BookOpen, papeis: todos },
    ],
  },
]

// Topo do menu: a logo e o nome cadastrados em "Minha padaria" (sem logo, o pão do sistema).
function Logo() {
  const padaria = usePadaria()
  const nome = padaria.data?.nome_fantasia || (padaria.isLoading ? '' : 'Padaria Info')
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <LogoPadaria />
      <div className="min-w-0 font-heading text-lg leading-tight font-semibold">
        <span className="line-clamp-2 break-words" title={nome}>
          {nome}
        </span>
      </div>
    </div>
  )
}

export function MainLayout() {
  const { user, signOut } = useAuth()
  // Gaveta do menu em telas pequenas.
  const [menuAberto, setMenuAberto] = useState(false)
  const [perfilAberto, setPerfilAberto] = useState(false)
  // Cada clique na conta remonta a foto e dispara o "pulo" + anel (ver index.css).
  const [cliquesConta, setCliquesConta] = useState(0)
  const { pathname } = useLocation()
  // Dono e gerência: mudanças de perfil que ainda não viram (aparece no item Equipe).
  const novidades = useNovidadesNaoVistas()

  // Com a tela atual já aberta, baixa os outros módulos sem atrapalhar.
  useEffect(() => {
    const id = setTimeout(precarregarPaginas, 1000)
    return () => clearTimeout(id)
  }, [])

  const menu = (
    <>
      <nav className="rolagem-menu flex-1 space-y-4 overflow-y-auto p-3">
        {secoes.map((secao) => {
          const itens = secao.itens.filter((item) => user && item.papeis.includes(user.papel))
          if (itens.length === 0) return null
          return (
            <div key={secao.titulo ?? 'inicio'} className="space-y-1">
              {secao.titulo && (
                <p className="px-3 pb-0.5 text-[10px] font-semibold tracking-wider text-sidebar-foreground/45 uppercase">
                  {secao.titulo}
                </p>
              )}
              {itens.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuAberto(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                        : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    )
                  }
                >
                  <item.icon className="size-4" />
                  {item.label}
                  {item.to === '/equipe' && novidades > 0 && (
                    <span
                      className="ml-auto rounded-full bg-destructive px-1.5 text-[11px] leading-5 font-semibold text-white"
                      title={`${novidades} novidade(s) da equipe`}
                    >
                      {novidades}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {user && (
          <button
            type="button"
            onClick={() => {
              setCliquesConta((n) => n + 1)
              // Dá tempo de ver a foto pular antes de a janela do perfil abrir.
              setTimeout(() => {
                setMenuAberto(false)
                setPerfilAberto(true)
              }, 260)
            }}
            title="Editar perfil"
            className="group mb-1 flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-sidebar-accent active:scale-[0.98]"
          >
            <span
              key={cliquesConta}
              className={cn(
                'relative shrink-0 transition-transform group-hover:scale-105',
                cliquesConta > 0 && 'conta-pulo',
              )}
            >
              {cliquesConta > 0 && (
                <span
                  aria-hidden
                  className="conta-anel pointer-events-none absolute inset-0 rounded-full ring-2 ring-sidebar-primary"
                />
              )}
              <Avatar nome={user.nome || user.email} foto={user.foto} tamanho="md" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user.nome || user.email}</div>
              <div className="truncate text-xs text-sidebar-foreground/60">
                {user.cargo || papelLabels[user.papel]} · Editar perfil
              </div>
            </div>
          </button>
        )}
        <button
          type="button"
          onClick={() => signOut()}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" />
          Sair
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-svh flex-col md:flex-row">
      {/* Telas pequenas: barra no topo com botão de menu */}
      <header className="flex items-center justify-between bg-sidebar px-4 py-2.5 text-sidebar-foreground md:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setMenuAberto(true)}
          aria-label="Abrir menu"
          className="rounded-lg p-2 hover:bg-sidebar-accent"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {menuAberto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAberto(false)} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
              <Logo />
              <button
                type="button"
                onClick={() => setMenuAberto(false)}
                aria-label="Fechar menu"
                className="rounded-lg p-2 hover:bg-sidebar-accent"
              >
                <X className="size-5" />
              </button>
            </div>
            {menu}
          </aside>
        </div>
      )}

      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-4 py-4">
          <Logo />
        </div>
        {menu}
      </aside>

      {/* min-h-0 + flex-col: o conteúdo rola por dentro; o PDV usa flex-1 para caber na tela sem rolar. */}
      <main className="flex min-h-0 flex-1 flex-col overflow-auto p-4 md:p-6">
        <Suspense
          fallback={
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <BoasVindas />
          {/* key: cada troca de tela reapresenta o conteúdo com uma entrada suave. */}
          <div key={pathname} className="tela-entra flex min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        </Suspense>
        <PerfilDialog open={perfilAberto} onOpenChange={setPerfilAberto} />
      </main>
    </div>
  )
}
