import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/app/ProtectedRoute'
import { MainLayout } from '@/app/MainLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ProdutosPage } from '@/features/produtos/ProdutosPage'
import { EstoquePage } from '@/features/estoque/EstoquePage'
import { PdvPage } from '@/features/pdv/PdvPage'
import { FinanceiroPage } from '@/features/financeiro/FinanceiroPage'
import { ProducaoPage } from '@/features/producao/ProducaoPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="produtos" element={<ProdutosPage />} />
            <Route path="estoque" element={<EstoquePage />} />
            <Route path="pdv" element={<PdvPage />} />
            <Route path="financeiro" element={<FinanceiroPage />} />
            <Route path="producao" element={<ProducaoPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
