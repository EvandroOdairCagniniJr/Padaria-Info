import { Loader2 } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/app/ProtectedRoute'
import { MainLayout } from '@/app/MainLayout'
import { RequirePapel } from '@/app/RequirePapel'
import { paginas } from '@/app/paginas'

const LoginPage = lazy(paginas.login)
const DashboardPage = lazy(paginas.dashboard)
const ProdutosPage = lazy(paginas.produtos)
const EstoquePage = lazy(paginas.estoque)
const PdvPage = lazy(paginas.pdv)
const VendasPage = lazy(paginas.vendas)
const FinanceiroPage = lazy(paginas.financeiro)
const ProducaoPage = lazy(paginas.producao)
const GuiaPage = lazy(paginas.guia)
const EquipePage = lazy(paginas.equipe)
const MinhaPadariaPage = lazy(paginas.padaria)
const MetasPage = lazy(paginas.metas)
const EncomendasPage = lazy(paginas.encomendas)

const carregando = (
  <div className="flex min-h-svh items-center justify-center">
    <Loader2 className="size-6 animate-spin text-muted-foreground" />
  </div>
)

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <Suspense fallback={carregando}>
              <LoginPage />
            </Suspense>
          }
        />

        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="estoque" element={<EstoquePage />} />
            <Route path="pdv" element={<PdvPage />} />
            <Route path="vendas" element={<VendasPage />} />
            <Route path="producao" element={<ProducaoPage />} />
            <Route path="guia" element={<GuiaPage />} />
            <Route path="equipe" element={<EquipePage />} />
            <Route path="metas" element={<MetasPage />} />
            <Route path="encomendas" element={<EncomendasPage />} />

            <Route element={<RequirePapel papeis={['dono', 'admin']} />}>
              <Route index element={<DashboardPage />} />
              <Route path="produtos" element={<ProdutosPage />} />
              <Route path="financeiro" element={<FinanceiroPage />} />
            </Route>

            <Route element={<RequirePapel papeis={['dono']} />}>
              <Route path="padaria" element={<MinhaPadariaPage />} />
            </Route>

          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
