import { ArrowLeft, ArrowRight, Check, KeyRound, Loader2, UserRound } from 'lucide-react'
import { LogoPao } from '@/components/LogoPao'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Campo, Secao } from '@/components/cadastro/Formulario'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/AuthContext'
import {
  CamposPadaria,
  padariaParaForm,
  validarPadaria,
  type ErrosPadaria,
  type FormPadaria,
} from '@/features/padaria/CamposPadaria'
import { cpfValido, digitos, mascaraCPF, mascaraTelefone, telefoneValido } from '@/lib/documentos'
import { hojeISO } from '@/lib/format'
import { cn } from '@/lib/utils'
import { REGRA_SENHA, erroSenha } from '@/lib/senha'

interface Dono {
  nome: string
  email: string
  senha: string
  confirmacao: string
  telefone: string
  cpf: string
  data_nascimento: string
}

type ErrosDono = Partial<Record<keyof Dono, string>>

function validarDono(d: Dono): ErrosDono {
  const e: ErrosDono = {}
  if (!d.nome.trim()) e.nome = 'Informe seu nome completo'
  if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) e.email = 'Informe um e-mail válido'
  const erro = erroSenha(d.senha)
  if (erro) e.senha = erro
  if (d.confirmacao !== d.senha) e.confirmacao = 'As senhas não conferem'
  if (d.telefone && !telefoneValido(d.telefone)) e.telefone = 'Use DDD + número'
  if (d.cpf && !cpfValido(d.cpf)) e.cpf = 'CPF inválido'
  return e
}

const etapas = [
  { titulo: 'Seus dados', descricao: 'Conta do dono' },
  { titulo: 'Sua padaria', descricao: 'Dados da empresa' },
]

// Primeiro acesso: cria a conta do dono e já cadastra a padaria (nome, CNPJ, endereço...).
export function PrimeiroAcesso({ onVoltar }: { onVoltar?: () => void }) {
  const { primeiroAcesso } = useAuth()
  const navigate = useNavigate()
  const [etapa, setEtapa] = useState(0)
  const [dono, setDono] = useState<Dono>({
    nome: '',
    email: '',
    senha: '',
    confirmacao: '',
    telefone: '',
    cpf: '',
    data_nascimento: '',
  })
  const [errosDono, setErrosDono] = useState<ErrosDono>({})
  const [padaria, setPadaria] = useState<FormPadaria>(() => padariaParaForm(null))
  const [errosPadaria, setErrosPadaria] = useState<ErrosPadaria>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const mudarDono = <K extends keyof Dono>(campo: K, v: Dono[K]) => {
    setDono((d) => ({ ...d, [campo]: v }))
    if (errosDono[campo]) setErrosDono((e) => ({ ...e, [campo]: undefined }))
  }

  async function avancar(e: FormEvent) {
    e.preventDefault()
    setErroGeral(null)
    if (etapa === 0) {
      const erros = validarDono(dono)
      setErrosDono(erros)
      if (Object.keys(erros).length === 0) setEtapa(1)
      return
    }
    const erros = validarPadaria(padaria)
    setErrosPadaria(erros)
    if (Object.keys(erros).length > 0) return

    setEnviando(true)
    const { error } = await primeiroAcesso({
      nome: dono.nome.trim(),
      email: dono.email.trim(),
      senha: dono.senha,
      telefone: dono.telefone || null,
      cpf: dono.cpf || null,
      data_nascimento: dono.data_nascimento || null,
      padaria: {
        ...padaria,
        cnpj: digitos(padaria.cnpj) || null,
        telefone: digitos(padaria.telefone) || null,
        whatsapp: digitos(padaria.whatsapp) || null,
      },
    })
    setEnviando(false)
    if (error) {
      setErroGeral(error)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-svh fundo-padaria px-4 py-8">
      <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border bg-card shadow-xl shadow-amber-900/10">
        <div className="border-b px-6 pt-6 pb-5 sm:px-8">
          {onVoltar && (
            <button
              type="button"
              onClick={onVoltar}
              className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Voltar para o login
            </button>
          )}
          <div className="flex items-center gap-3">
            <LogoPao className="size-11" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo ao Coffee Break</h1>
              <p className="text-sm text-muted-foreground">
                Cadastre sua padaria e crie a conta do dono. Leva menos de 2 minutos.
              </p>
            </div>
          </div>

          <ol className="mt-5 grid grid-cols-2 gap-3">
            {etapas.map((et, i) => (
              <li key={et.titulo} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    i < etapa && 'bg-emerald-600 text-white',
                    i === etapa && 'bg-primary text-primary-foreground',
                    i > etapa && 'bg-muted text-muted-foreground',
                  )}
                >
                  {i < etapa ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block text-sm font-medium',
                      i !== etapa && 'text-muted-foreground',
                    )}
                  >
                    {et.titulo}
                  </span>
                  <span className="block text-xs text-muted-foreground">{et.descricao}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: etapa === 0 ? '50%' : '100%' }}
            />
          </div>
        </div>

        <form onSubmit={avancar} noValidate>
          <div className="px-6 py-6 sm:px-8">
            {etapa === 0 ? (
              <div className="space-y-6">
                <Secao titulo="Dados do dono" icone={UserRound}>
                  <Campo rotulo="Nome completo" obrigatorio col={6} erro={errosDono.nome}>
                    {(id) => (
                      <Input
                        id={id}
                        autoComplete="name"
                        autoFocus
                        value={dono.nome}
                        onChange={(e) => mudarDono('nome', e.target.value)}
                      />
                    )}
                  </Campo>
                  <Campo rotulo="CPF" col={2} erro={errosDono.cpf}>
                    {(id) => (
                      <Input
                        id={id}
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        value={dono.cpf}
                        onChange={(e) => mudarDono('cpf', mascaraCPF(e.target.value))}
                      />
                    )}
                  </Campo>
                  <Campo rotulo="Data de nascimento" col={2}>
                    {(id) => (
                      <Input
                        id={id}
                        type="date"
                        max={hojeISO()}
                        value={dono.data_nascimento}
                        onChange={(e) => mudarDono('data_nascimento', e.target.value)}
                      />
                    )}
                  </Campo>
                  <Campo rotulo="Celular / WhatsApp" col={2} erro={errosDono.telefone}>
                    {(id) => (
                      <Input
                        id={id}
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="(00) 00000-0000"
                        value={dono.telefone}
                        onChange={(e) => mudarDono('telefone', mascaraTelefone(e.target.value))}
                      />
                    )}
                  </Campo>
                </Secao>

                <Secao
                  titulo="Acesso ao sistema"
                  descricao="Você vai usar este e-mail e senha para entrar."
                  icone={KeyRound}
                >
                  <Campo rotulo="E-mail" obrigatorio col={6} erro={errosDono.email}>
                    {(id) => (
                      <Input
                        id={id}
                        type="email"
                        autoComplete="email"
                        value={dono.email}
                        onChange={(e) => mudarDono('email', e.target.value)}
                      />
                    )}
                  </Campo>
                  <Campo
                    rotulo="Senha"
                    obrigatorio
                    col={3}
                    erro={errosDono.senha}
                    dica={REGRA_SENHA}
                  >
                    {(id) => (
                      <Input
                        id={id}
                        type="password"
                        autoComplete="new-password"
                        value={dono.senha}
                        onChange={(e) => mudarDono('senha', e.target.value)}
                      />
                    )}
                  </Campo>
                  <Campo rotulo="Confirme a senha" obrigatorio col={3} erro={errosDono.confirmacao}>
                    {(id) => (
                      <Input
                        id={id}
                        type="password"
                        autoComplete="new-password"
                        value={dono.confirmacao}
                        onChange={(e) => mudarDono('confirmacao', e.target.value)}
                      />
                    )}
                  </Campo>
                </Secao>
              </div>
            ) : (
              <CamposPadaria
                valor={padaria}
                onChange={(p) => {
                  setPadaria(p)
                  if (Object.keys(errosPadaria).length) setErrosPadaria(validarPadaria(p))
                }}
                erros={errosPadaria}
                completo={false}
              />
            )}

            {erroGeral && (
              <p className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {erroGeral}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4 sm:px-8">
            {etapa > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setEtapa(0)}>
                <ArrowLeft className="size-4" />
                Voltar
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">* obrigatório</span>
            )}
            <Button type="submit" disabled={enviando} className="min-w-40">
              {enviando && <Loader2 className="size-4 animate-spin" />}
              {etapa === 0 ? (
                <>
                  Continuar
                  <ArrowRight className="size-4" />
                </>
              ) : (
                'Criar conta e entrar'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
