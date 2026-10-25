import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, ChevronRight, Eye, EyeOff, Loader2, Store, Users } from 'lucide-react'
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
    codigo: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{8}$/, 'O código tem 8 letras e números'),
  })
  .refine((d) => d.senha === d.confirmacao, {
    path: ['confirmacao'],
    message: 'As duas senhas não são iguais',
  })

type LoginForm = z.infer<typeof loginSchema>
type CadastroForm = z.infer<typeof cadastroSchema>
type Modo = 'entrar' | 'criar' | 'equipe' | 'padaria' | 'esqueci'

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
  const [perfil, setPerfil] = useState<'dono' | 'equipe'>('dono')
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginForm) {
    const { error } = await signIn(values.email, values.password, perfil)
    if (error) {
      setError('root', { message: error })
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Como você entra">
        {(
          [
            ['dono', Store, 'Sou dono(a)'],
            ['equipe', Users, 'Sou da equipe'],
          ] as const
        ).map(([valor, Icone, rotulo]) => (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={perfil === valor}
            onClick={() => setPerfil(valor)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
              perfil === valor
                ? 'border-primary bg-primary/10 text-primary'
                : 'text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            <Icone className="size-4" />
            {rotulo}
          </button>
        ))}
      </div>

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

  async function onSubmit({ nome, email, senha, codigo }: CadastroForm) {
    try {
      await api.post('/auth/cadastro', { nome, email, senha, codigo })
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
        <Label htmlFor="codigo">Código da padaria</Label>
        <Input
          id="codigo"
          autoComplete="off"
          placeholder="Ex.: K7M2QX9A"
          maxLength={8}
          className="font-mono tracking-widest uppercase"
          {...register('codigo')}
        />
        <p className="text-xs text-muted-foreground">
          Peça ao responsável: ele encontra o código em Equipe.
        </p>
        <Erro>{errors.codigo?.message}</Erro>
      </div>
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

function OpcaoConta({
  icone: Icone,
  titulo,
  texto,
  onClick,
}: {
  icone: typeof Store
  titulo: string
  texto: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/60 hover:bg-accent/40"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icone className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{titulo}</span>
        <span className="block text-sm text-muted-foreground">{texto}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}

export function LoginPage() {
  const { user } = useAuth()
  const [modo, setModo] = useState<Modo>('entrar')
  const [emailEsqueci, setEmailEsqueci] = useState('')

  if (user) return <Navigate to="/" replace />
  if (modo === 'padaria') return <PrimeiroAcesso onVoltar={() => setModo('criar')} />

  return (
    <div className="flex min-h-svh items-center justify-center bg-linear-to-br from-amber-50 via-orange-50 to-amber-100 px-4 py-8">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card/95 p-8 shadow-xl shadow-amber-900/10">
        <div className="space-y-2 text-center">
          <LogoPao className="mx-auto size-16 rounded-2xl shadow-md" />
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Padaria Info</h1>
          <p className="text-sm text-muted-foreground">
            {modo === 'entrar' || modo === 'esqueci'
              ? 'Gestão completa para a sua padaria'
              : 'Crie sua conta em poucos passos'}
          </p>
        </div>

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
                  aria-selected={modo === valor || (valor === 'criar' && modo === 'equipe')}
                  onClick={() => setModo(valor)}
                  className={cn(
                    'rounded-md py-1.5 text-sm font-medium transition-colors',
                    modo === valor || (valor === 'criar' && modo === 'equipe')
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
            ) : modo === 'equipe' ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setModo('criar')}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Outras opções
                </button>
                <FormCriarConta onCriada={() => setModo('entrar')} />
              </div>
            ) : (
              <div className="space-y-3">
                <OpcaoConta
                  icone={Store}
                  titulo="Cadastrar minha padaria"
                  texto="Sou dono(a): quero usar o sistema na minha padaria."
                  onClick={() => setModo('padaria')}
                />
                <OpcaoConta
                  icone={Users}
                  titulo="Entrar na equipe de uma padaria"
                  texto="Trabalho numa padaria que já usa o Padaria Info."
                  onClick={() => setModo('equipe')}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
