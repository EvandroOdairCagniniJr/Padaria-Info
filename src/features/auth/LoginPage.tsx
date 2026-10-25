import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { LogoPao } from '@/components/LogoPao'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/AuthContext'
import { EsqueciSenha } from '@/features/auth/EsqueciSenha'
import { PrimeiroAcesso } from '@/features/auth/PrimeiroAcesso'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  email: z.email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe a senha'),
})

const cadastroSchema = z
  .object({
    nome: z.string().trim().min(1, 'Informe seu nome'),
    email: z.email('Informe um e-mail válido'),
    senha: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres'),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, {
    path: ['confirmacao'],
    message: 'As duas senhas não são iguais',
  })

type LoginForm = z.infer<typeof loginSchema>
type CadastroForm = z.infer<typeof cadastroSchema>
type Modo = 'entrar' | 'criar' | 'esqueci'

function CampoSenha({
  id,
  autoComplete,
  ...props
}: ComponentProps<typeof Input> & { id: string }) {
  const [ver, setVer] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={ver ? 'text' : 'password'}
        autoComplete={autoComplete}
        className="pr-10"
        {...props}
      />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

function Erro({ children }: { children?: string }) {
  if (!children) return null
  return <p className="text-sm text-destructive">{children}</p>
}

function FormEntrar({ onEsqueci }: { onEsqueci: (email: string) => void }) {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginForm) {
    const { error } = await signIn(values.email, values.password)
    if (error) {
      setError('root', { message: error })
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        <Erro>{errors.email?.message}</Erro>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Senha</Label>
          <button
            type="button"
            onClick={() => onEsqueci(getValues('email') ?? '')}
            className="text-sm font-medium text-primary hover:underline"
          >
            Esqueci minha senha
          </button>
        </div>
        <CampoSenha id="password" autoComplete="current-password" {...register('password')} />
        <Erro>{errors.password?.message}</Erro>
      </div>

      {errors.root && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Entrar
      </Button>
    </form>
  )
}

function FormCriarConta({ onCriada }: { onCriada: () => void }) {
  const [criada, setCriada] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CadastroForm>({ resolver: zodResolver(cadastroSchema) })

  async function onSubmit({ nome, email, senha }: CadastroForm) {
    try {
      await api.post('/auth/cadastro', { nome, email, senha })
      setCriada(true)
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Não foi possível criar a conta' })
    }
  }

  if (criada) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Conta criada!</h2>
          <p className="text-sm text-muted-foreground">
            Agora é só aguardar o responsável pela padaria liberar o seu acesso. Assim que ele
            liberar, entre com seu e-mail e senha.
          </p>
        </div>
        <Button className="w-full" onClick={onCriada}>
          Ir para o login
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Seu nome</Label>
        <Input id="nome" autoComplete="name" {...register('nome')} />
        <Erro>{errors.nome?.message}</Erro>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-novo">E-mail</Label>
        <Input id="email-novo" type="email" autoComplete="email" {...register('email')} />
        <Erro>{errors.email?.message}</Erro>
      </div>
      <div className="space-y-2">
        <Label htmlFor="senha-nova">Senha</Label>
        <CampoSenha
          id="senha-nova"
          autoComplete="new-password"
          placeholder="Pelo menos 6 caracteres"
          {...register('senha')}
        />
        <Erro>{errors.senha?.message}</Erro>
      </div>
      <div className="space-y-2">
        <Label htmlFor="senha-confirmar">Repita a senha</Label>
        <CampoSenha id="senha-confirmar" autoComplete="new-password" {...register('confirmacao')} />
        <Erro>{errors.confirmacao?.message}</Erro>
      </div>

      {errors.root && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Criar conta
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Por segurança, o responsável pela padaria precisa liberar contas novas.
      </p>
    </form>
  )
}

export function LoginPage() {
  const { user } = useAuth()
  const [modo, setModo] = useState<Modo>('entrar')
  const [emailEsqueci, setEmailEsqueci] = useState('')

  const setup = useQuery({
    queryKey: ['auth', 'setup'],
    queryFn: () => api.get<{ precisaSetup: boolean; padaria: string | null }>('/auth/setup'),
    retry: false,
    refetchInterval: false,
  })

  if (user) return <Navigate to="/" replace />
  if (setup.data?.precisaSetup) return <PrimeiroAcesso />

  return (
    <div className="flex min-h-svh items-center justify-center bg-linear-to-br from-amber-50 via-orange-50 to-amber-100 px-4 py-8">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card/95 p-8 shadow-xl shadow-amber-900/10">
        <div className="space-y-2 text-center">
          <LogoPao className="mx-auto size-16 rounded-2xl shadow-md" />
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {setup.data?.padaria || 'Padaria Info'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {modo === 'criar' ? 'Crie sua conta para fazer parte da equipe' : 'Que bom ter você aqui'}
          </p>
        </div>

        {setup.isError && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {setup.error.message}
          </p>
        )}

        {modo === 'esqueci' ? (
          <EsqueciSenha emailInicial={emailEsqueci} onVoltar={() => setModo('entrar')} />
        ) : (
          <>
            <div className="grid grid-cols-2 rounded-lg bg-muted p-1" role="tablist">
              {(
                [
                  ['entrar', 'Entrar'],
                  ['criar', 'Criar conta'],
                ] as const
              ).map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  role="tab"
                  aria-selected={modo === valor}
                  onClick={() => setModo(valor)}
                  className={cn(
                    'rounded-md py-1.5 text-sm font-medium transition-colors',
                    modo === valor
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>

            {modo === 'entrar' ? (
              <FormEntrar
                onEsqueci={(email) => {
                  setEmailEsqueci(email)
                  setModo('esqueci')
                }}
              />
            ) : (
              <FormCriarConta onCriada={() => setModo('entrar')} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
