import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, setOnUnauthorized } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import type { Papel } from '@/types/database'

export interface Usuario {
  id: string
  padaria_id: string
  nome: string
  email: string
  papel: Papel
  cargo: string
  foto: string | null
}

export interface AlteracaoPerfil {
  nome?: string
  cargo?: string
  foto?: string | null
  cpf?: string | null
  telefone?: string | null
  data_nascimento?: string | null
  endereco?: object | null
  contato_emergencia?: object | null
}

interface AuthContextValue {
  user: Usuario | null
  loading: boolean
  signIn: (email: string, senha: string) => Promise<{ error: string | null }>
  // Esqueci minha senha: entra com o código do e-mail (e troca a senha, se informada).
  entrarComCodigo: (
    email: string,
    codigo: string,
    novaSenha?: string,
  ) => Promise<{ error: string | null }>
  // Cadastrar minha padaria: conta do dono + dados da padaria (POST /api/auth/setup).
  primeiroAcesso: (dados: Record<string, unknown>) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  // Editar perfil: salva no servidor e já atualiza o nome/foto no menu.
  editarPerfil: (dados: AlteracaoPerfil) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function autenticar(
  path: string,
  dados: Record<string, unknown>,
  setUser: (u: Usuario) => void,
) {
  try {
    setUser(await api.post<Usuario>(path, dados))
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Não foi possível entrar' }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<Usuario>('/auth/me')
      .then(setUser)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) console.error(err)
        setUser(null)
      })
      .finally(() => setLoading(false))

    // Sessão expirada em qualquer chamada → volta para o login.
    setOnUnauthorized(() => setUser(null))
    return () => setOnUnauthorized(null)
  }, [])

  async function signOut() {
    await api.post('/auth/logout').catch(() => undefined)
    setUser(null)
    queryClient.clear()
  }

  async function editarPerfil(dados: AlteracaoPerfil) {
    setUser(await api.patch<Usuario>('/auth/perfil', dados))
    queryClient.invalidateQueries({ queryKey: ['time'] })
    queryClient.invalidateQueries({ queryKey: ['equipe'] })
    queryClient.invalidateQueries({ queryKey: ['perfil'] })
  }

  return (
    <AuthContext
      value={{
        user,
        loading,
        signIn: (email, senha) => autenticar('/auth/login', { email, senha }, setUser),
        entrarComCodigo: (email, codigo, novaSenha) =>
          autenticar('/auth/codigo/entrar', { email, codigo, novaSenha }, setUser),
        primeiroAcesso: (dados) => autenticar('/auth/setup', dados, setUser),
        signOut,
        editarPerfil,
      }}
    >
      {children}
    </AuthContext>
  )
}

export function useAuth() {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  return ctx
}
