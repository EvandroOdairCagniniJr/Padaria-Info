import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { AppRouter } from '@/app/AppRouter'
import { AuthProvider } from '@/features/auth/AuthContext'
import { queryClient } from '@/lib/queryClient'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
