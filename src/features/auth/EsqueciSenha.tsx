import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, MailCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'

type Etapa = 'email' | 'codigo' | 'senha'

const ESPERA_REENVIO = 60

// Esqueci minha senha: e-mail → código de 6 números que chega no e-mail → entra
// (e, se quiser, já cria uma senha nova).
export function EsqueciSenha({
  emailInicial,
  onVoltar,
}: {
  emailInicial: string
  onVoltar: () => void
}) {
  const { entrarComCodigo } = useAuth()
  const navigate = useNavigate()
  const [etapa, setEtapa] = useState<Etapa>('email')
  const [email, setEmail] = useState(emailInicial)
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [espera, setEspera] = useState(0)

  // Contagem para liberar o "Reenviar código".
  useEffect(() => {
    if (espera <= 0) return
    const id = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [espera])

  async function executar(fn: () => Promise<void>) {
    setErro(null)
    setEnviando(true)
    try {
      await fn()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  function enviarCodigo(e?: FormEvent) {
    e?.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErro('Informe o e-mail que você usou para criar a conta')
      return
    }
    void executar(async () => {
      await api.post('/auth/esqueci-senha', { email: email.trim() })
      setCodigo('')
      setEtapa('codigo')
      setEspera(ESPERA_REENVIO)
    })
  }

  function confirmarCodigo(e: FormEvent) {
    e.preventDefault()
    if (codigo.length !== 6) {
      setErro('Digite os 6 números do código')
      return
    }
    void executar(async () => {
      await api.post('/auth/codigo/verificar', { email: email.trim(), codigo })
      setEtapa('senha')
    })
  }

  function entrar(novaSenha?: string) {
    if (novaSenha !== undefined) {
      if (novaSenha.length < 6) {
        setErro('A senha precisa ter pelo menos 6 caracteres')
        return
      }
      if (novaSenha !== confirmacao) {
        setErro('As duas senhas não são iguais')
        return
      }
    }
    void executar(async () => {
      const { error } = await entrarComCodigo(email.trim(), codigo, novaSenha)
      if (error) throw new Error(error)
      navigate('/', { replace: true })
    })
  }

  const mensagemErro = erro && (
    <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      {erro}
    </p>
  )

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={etapa === 'email' ? onVoltar : () => (setErro(null), setEtapa('email'))}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {etapa === 'email' ? 'Voltar para o login' : 'Usar outro e-mail'}
      </button>

      {etapa === 'email' && (
        <form onSubmit={enviarCodigo} className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Esqueceu a senha?</h2>
            <p className="text-sm text-muted-foreground">
              Sem problema. Informe o e-mail da sua conta e enviaremos um código de acesso.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-recuperar">E-mail</Label>
            <Input
              id="email-recuperar"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </div>
          {mensagemErro}
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando && <Loader2 className="size-4 animate-spin" />}
            Enviar código
          </Button>
        </form>
      )}

      {etapa === 'codigo' && (
        <form onSubmit={confirmarCodigo} className="space-y-4">
          <div className="space-y-2 text-center">
            <MailCheck className="mx-auto size-10 text-primary" />
            <h2 className="text-xl font-semibold">Confira seu e-mail</h2>
            <p className="text-sm text-muted-foreground">
              Se existir uma conta com <strong className="text-foreground">{email.trim()}</strong>,
              você vai receber um código de 6 números. Ele vale por 15 minutos.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="codigo">Código</Label>
            <Input
              id="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="h-14 text-center text-2xl font-semibold tracking-[0.5em] tabular-nums"
            />
          </div>
          {mensagemErro}
          <Button type="submit" className="w-full" disabled={enviando || codigo.length !== 6}>
            {enviando && <Loader2 className="size-4 animate-spin" />}
            Confirmar código
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Não chegou? Olhe também a caixa de spam.{' '}
            {espera > 0 ? (
              <span>Reenviar em {espera}s</span>
            ) : (
              <button
                type="button"
                onClick={() => enviarCodigo()}
                disabled={enviando}
                className="font-medium text-primary hover:underline"
              >
                Reenviar código
              </button>
            )}
          </p>
        </form>
      )}

      {etapa === 'senha' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            entrar(senha)
          }}
          className="space-y-4"
        >
          <div className="space-y-2 text-center">
            <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
            <h2 className="text-xl font-semibold">Código confirmado!</h2>
            <p className="text-sm text-muted-foreground">
              Aproveite para criar uma senha nova — ou entre agora e troque depois.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <div className="relative">
              <Input
                id="nova-senha"
                type={verSenha ? 'text' : 'password'}
                autoComplete="new-password"
                autoFocus
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Pelo menos 6 caracteres"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setVerSenha((v) => !v)}
                aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {verSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmar-senha">Repita a nova senha</Label>
            <Input
              id="confirmar-senha"
              type={verSenha ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
            />
          </div>
          {mensagemErro}
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando && <Loader2 className="size-4 animate-spin" />}
            Salvar nova senha e entrar
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={enviando}
            onClick={() => entrar()}
          >
            Entrar sem trocar a senha
          </Button>
        </form>
      )}
    </div>
  )
}
