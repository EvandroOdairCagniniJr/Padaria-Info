import {
  Briefcase,
  HeartPulse,
  KeyRound,
  Loader2,
  MapPin,
  NotebookPen,
  UserRound,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import {
  Campo,
  CamposContatoEmergencia,
  CamposEndereco,
  contatoVazio,
  Secao,
  type Contato,
} from '@/components/cadastro/Formulario'
import { FotoPicker } from '@/components/FotoPicker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAlterarMembro, useCriarMembro } from '@/features/equipe/api'
import { CARGO_DONO, cargosSugeridos, turnoLabels } from '@/lib/cargos'
import {
  cpfValido,
  enderecoVazio,
  mascaraCEP,
  mascaraCPF,
  mascaraTelefone,
  telefoneValido,
  type Endereco,
} from '@/lib/documentos'
import { hojeISO, mensagemErro } from '@/lib/format'
import type { ResumoMembro, Turno } from '@/types/database'
import { REGRA_SENHA, erroSenha } from '@/lib/senha'

const papeisEquipe = [
  { value: 'funcionario', label: 'Funcionário — balcão, estoque e produção' },
  { value: 'admin', label: 'Gerente — toda a operação e o financeiro' },
] as const

type PapelEquipe = (typeof papeisEquipe)[number]['value']

interface Formulario {
  nome: string
  email: string
  senha: string
  papel: PapelEquipe
  cargo: string
  foto: string | null
  cpf: string
  telefone: string
  data_nascimento: string
  data_admissao: string
  turno: Turno | ''
  endereco: Endereco
  contato: Contato
  observacoes: string
}

function inicial(membro: ResumoMembro | null | undefined): Formulario {
  return {
    nome: membro?.nome ?? '',
    email: membro?.email ?? '',
    senha: '',
    papel: membro && membro.papel !== 'dono' ? membro.papel : 'funcionario',
    cargo: membro?.cargo ?? '',
    foto: membro?.foto ?? null,
    cpf: mascaraCPF(membro?.cpf),
    telefone: mascaraTelefone(membro?.telefone),
    data_nascimento: membro?.data_nascimento ?? '',
    // Novo membro: admissão já vem com a data de hoje.
    data_admissao: membro ? (membro.data_admissao ?? '') : hojeISO(),
    turno: membro?.turno ?? '',
    endereco: membro?.endereco
      ? { ...enderecoVazio, ...membro.endereco, cep: mascaraCEP(membro.endereco.cep) }
      : enderecoVazio,
    contato: membro?.contato_emergencia
      ? {
          ...contatoVazio,
          ...membro.contato_emergencia,
          telefone: mascaraTelefone(membro.contato_emergencia.telefone),
        }
      : contatoVazio,
    observacoes: membro?.observacoes ?? '',
  }
}

type Erros = Partial<Record<keyof Formulario, string>>

function validar(f: Formulario, criando: boolean): Erros {
  const erros: Erros = {}
  if (!f.nome.trim()) erros.nome = 'Informe o nome completo'
  if (criando && !/^\S+@\S+\.\S+$/.test(f.email.trim())) erros.email = 'Informe um e-mail válido'
  const erroDaSenha = criando || f.senha ? erroSenha(f.senha) : null
  if (erroDaSenha) erros.senha = erroDaSenha
  if (f.cpf && !cpfValido(f.cpf)) erros.cpf = 'CPF inválido'
  if (f.telefone && !telefoneValido(f.telefone)) erros.telefone = 'Use DDD + número'
  if (f.data_nascimento && f.data_nascimento > hojeISO()) erros.data_nascimento = 'Data no futuro'
  return erros
}

interface MembroFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  membro?: ResumoMembro | null
}

export function MembroFormDialog({ open, onOpenChange, membro }: MembroFormDialogProps) {
  const criando = !membro
  const ehDono = membro?.papel === 'dono'
  const criarMembro = useCriarMembro()
  const alterarMembro = useAlterarMembro()
  const [f, setF] = useState<Formulario>(() => inicial(membro))
  const [erros, setErros] = useState<Erros>({})
  const [salvando, setSalvando] = useState(false)

  // Cada abertura começa com os dados da pessoa escolhida (ou em branco).
  const [chaveAberta, setChaveAberta] = useState<string | null>(null)
  const chave = open ? (membro?.id ?? 'novo') : null
  if (chave !== chaveAberta) {
    setChaveAberta(chave)
    if (chave) {
      setF(inicial(membro))
      setErros({})
    }
  }

  const mudar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => {
    setF((atual) => ({ ...atual, [campo]: valor }))
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }))
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const encontrados = validar(f, criando)
    setErros(encontrados)
    if (Object.keys(encontrados).length > 0) {
      toast.error('Confira os campos destacados')
      return
    }

    const dados = {
      nome: f.nome.trim(),
      cargo: f.cargo.trim(),
      foto: f.foto,
      cpf: f.cpf || null,
      telefone: f.telefone || null,
      data_nascimento: f.data_nascimento || null,
      data_admissao: f.data_admissao || null,
      turno: f.turno || null,
      endereco: f.endereco,
      contato_emergencia: f.contato,
      observacoes: f.observacoes,
    }

    setSalvando(true)
    try {
      if (membro) {
        await alterarMembro.mutateAsync({
          id: membro.id,
          changes: {
            ...dados,
            papel: ehDono ? undefined : f.papel,
            senha: f.senha || undefined,
          },
        })
        toast.success(f.senha ? 'Cadastro e senha atualizados' : 'Cadastro atualizado')
      } else {
        await criarMembro.mutateAsync({
          ...dados,
          email: f.email.trim(),
          senha: f.senha,
          papel: f.papel,
        })
        toast.success(`${dados.nome} já pode entrar com ${f.email.trim()}`)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao salvar o cadastro'))
    } finally {
      setSalvando(false)
    }
  }

  const sugestoesCargo = ehDono ? [CARGO_DONO] : cargosSugeridos[f.papel]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94svh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle>
            {criando ? 'Cadastrar membro da equipe' : `Editar ${membro?.nome}`}
          </DialogTitle>
          <DialogDescription>
            {criando
              ? 'Campos com * são obrigatórios. O restante pode ser completado depois.'
              : 'Atualize os dados da pessoa. Mudanças de cargo e função ficam no histórico.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={salvar} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <Secao titulo="Dados pessoais" icone={UserRound}>
              <div className="sm:col-span-6">
                <FotoPicker nome={f.nome} foto={f.foto} onChange={(foto) => mudar('foto', foto)} />
              </div>
              <Campo rotulo="Nome completo" obrigatorio col={6} erro={erros.nome}>
                {(id) => (
                  <Input
                    id={id}
                    autoComplete="off"
                    value={f.nome}
                    onChange={(e) => mudar('nome', e.target.value)}
                  />
                )}
              </Campo>
              <Campo rotulo="CPF" col={2} erro={erros.cpf}>
                {(id) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={f.cpf}
                    onChange={(e) => mudar('cpf', mascaraCPF(e.target.value))}
                  />
                )}
              </Campo>
              <Campo rotulo="Data de nascimento" col={2} erro={erros.data_nascimento}>
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    max={hojeISO()}
                    value={f.data_nascimento}
                    onChange={(e) => mudar('data_nascimento', e.target.value)}
                  />
                )}
              </Campo>
              <Campo rotulo="Telefone / WhatsApp" col={2} erro={erros.telefone}>
                {(id) => (
                  <Input
                    id={id}
                    inputMode="tel"
                    placeholder="(00) 00000-0000"
                    value={f.telefone}
                    onChange={(e) => mudar('telefone', mascaraTelefone(e.target.value))}
                  />
                )}
              </Campo>
            </Secao>

            <Secao
              titulo="Acesso ao sistema"
              descricao="E-mail e senha para entrar em qualquer computador da padaria."
              icone={KeyRound}
            >
              <Campo
                rotulo="E-mail de acesso"
                obrigatorio={criando}
                col={3}
                erro={erros.email}
                dica={criando ? undefined : 'O e-mail de acesso não pode ser alterado'}
              >
                {(id) => (
                  <Input
                    id={id}
                    type="email"
                    autoComplete="off"
                    disabled={!criando}
                    value={f.email}
                    onChange={(e) => mudar('email', e.target.value)}
                  />
                )}
              </Campo>
              <Campo
                rotulo={criando ? 'Senha inicial' : 'Nova senha'}
                obrigatorio={criando}
                col={3}
                erro={erros.senha}
                dica={criando ? REGRA_SENHA : 'Deixe em branco para manter a atual'}
              >
                {(id) => (
                  <Input
                    id={id}
                    type="text"
                    autoComplete="new-password"
                    value={f.senha}
                    onChange={(e) => mudar('senha', e.target.value)}
                  />
                )}
              </Campo>
              {!ehDono && (
                <Campo rotulo="Função no sistema" obrigatorio col={6}>
                  {(id) => (
                    <Select value={f.papel} onValueChange={(v) => mudar('papel', v as PapelEquipe)}>
                      <SelectTrigger id={id} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {papeisEquipe.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Campo>
              )}
            </Secao>

            <Secao titulo="Trabalho na padaria" icone={Briefcase}>
              <Campo rotulo="Cargo" col={2} dica="Ex: Caixa, Padeiro(a)">
                {(id) => (
                  <>
                    <Input
                      id={id}
                      list="cargos-sugeridos"
                      maxLength={60}
                      placeholder={ehDono ? CARGO_DONO : 'Escolha ou digite'}
                      value={f.cargo}
                      onChange={(e) => mudar('cargo', e.target.value)}
                    />
                    <datalist id="cargos-sugeridos">
                      {sugestoesCargo.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </>
                )}
              </Campo>
              <Campo rotulo="Data de admissão" col={2}>
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={f.data_admissao}
                    onChange={(e) => mudar('data_admissao', e.target.value)}
                  />
                )}
              </Campo>
              <Campo rotulo="Turno" col={2}>
                {(id) => (
                  <Select
                    value={f.turno || undefined}
                    onValueChange={(v) => mudar('turno', v as Turno)}
                  >
                    <SelectTrigger id={id} className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(turnoLabels).map(([valor, rotulo]) => (
                        <SelectItem key={valor} value={valor}>
                          {rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Campo>
            </Secao>

            <Secao titulo="Endereço" icone={MapPin}>
              <CamposEndereco valor={f.endereco} onChange={(e) => mudar('endereco', e)} />
            </Secao>

            <Secao
              titulo="Contato de emergência"
              descricao="Quem avisar se algo acontecer durante o expediente."
              icone={HeartPulse}
            >
              <CamposContatoEmergencia valor={f.contato} onChange={(c) => mudar('contato', c)} />
            </Secao>

            <Secao
              titulo="Observações internas"
              descricao="Visível só para o dono."
              icone={NotebookPen}
            >
              <Campo rotulo="Anotações" col={6}>
                {(id) => (
                  <textarea
                    id={id}
                    rows={3}
                    maxLength={1000}
                    placeholder="Ex: alergias, restrições de horário, uniforme entregue..."
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={f.observacoes}
                    onChange={(e) => mudar('observacoes', e.target.value)}
                  />
                )}
              </Campo>
            </Secao>
          </div>

          <DialogFooter className="border-t bg-muted/30 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="size-4 animate-spin" />}
              {criando ? 'Cadastrar' : 'Salvar alterações'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
