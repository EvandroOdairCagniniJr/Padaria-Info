import { useQuery } from '@tanstack/react-query'
import { Briefcase, HeartPulse, Loader2, MapPin, ShieldCheck, UserRound } from 'lucide-react'
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
import { useAuth, type Usuario } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
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
import { formatData, hojeISO, mensagemErro } from '@/lib/format'
import { papelLabels } from '@/lib/permissoes'
import type { DadosCadastro } from '@/types/database'

const descricaoPapel = {
  dono: 'Acesso a tudo, inclusive a Equipe.',
  admin: 'Toda a operação e o financeiro.',
  funcionario: 'Balcão, estoque e produção.',
}

type PerfilCompleto = Usuario & DadosCadastro & { created_at: string }

// Cada pessoa mantém o próprio cadastro em dia: foto, nome, cargo, documentos, endereço e
// contato de emergência. Dono e gerência veem as mudanças de nome/cargo/foto em Equipe → Novidades.
// O papel (o que pode fazer no sistema), a admissão e o turno só o dono troca.
export function PerfilDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const perfil = useQuery({
    queryKey: ['perfil', user?.id],
    queryFn: () => api.get<PerfilCompleto>('/auth/perfil'),
    enabled: open && Boolean(user),
    refetchInterval: false,
  })
  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94svh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle>Editar perfil</DialogTitle>
          <DialogDescription>
            Mantenha seus dados em dia. Foto, nome e cargo aparecem na Equipe e nas suas vendas.
          </DialogDescription>
        </DialogHeader>
        {perfil.data ? (
          // Montado só com os dados carregados: cada abertura começa com o cadastro atual.
          <FormularioPerfil
            key={perfil.dataUpdatedAt}
            perfil={perfil.data}
            onFechar={() => onOpenChange(false)}
          />
        ) : (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FormularioPerfil({ perfil, onFechar }: { perfil: PerfilCompleto; onFechar: () => void }) {
  const { editarPerfil } = useAuth()
  const [nome, setNome] = useState(perfil.nome)
  const [cargo, setCargo] = useState(perfil.cargo)
  const [foto, setFoto] = useState<string | null>(perfil.foto)
  const [cpf, setCpf] = useState(mascaraCPF(perfil.cpf))
  const [telefone, setTelefone] = useState(mascaraTelefone(perfil.telefone))
  const [nascimento, setNascimento] = useState(perfil.data_nascimento ?? '')
  const [endereco, setEndereco] = useState<Endereco>(
    perfil.endereco
      ? { ...enderecoVazio, ...perfil.endereco, cep: mascaraCEP(perfil.endereco.cep) }
      : enderecoVazio,
  )
  const [contato, setContato] = useState<Contato>(
    perfil.contato_emergencia
      ? {
          ...contatoVazio,
          ...perfil.contato_emergencia,
          telefone: mascaraTelefone(perfil.contato_emergencia.telefone),
        }
      : contatoVazio,
  )
  const [erros, setErros] = useState<{ nome?: string; cpf?: string; telefone?: string }>({})
  const [salvando, setSalvando] = useState(false)

  const sugestoes =
    perfil.papel === 'dono'
      ? [CARGO_DONO]
      : [...cargosSugeridos.admin, ...cargosSugeridos.funcionario]

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const encontrados = {
      nome: nome.trim() ? undefined : 'Informe seu nome',
      cpf: cpf && !cpfValido(cpf) ? 'CPF inválido' : undefined,
      telefone: telefone && !telefoneValido(telefone) ? 'Use DDD + número' : undefined,
    }
    setErros(encontrados)
    if (Object.values(encontrados).some(Boolean)) {
      toast.error('Confira os campos destacados')
      return
    }
    setSalvando(true)
    try {
      // Nome, cargo e foto só vão se mudaram (cada mudança vira um aviso para a gerência).
      await editarPerfil({
        nome: nome.trim() !== perfil.nome ? nome.trim() : undefined,
        cargo: cargo.trim() !== perfil.cargo ? cargo.trim() : undefined,
        foto: foto !== perfil.foto ? foto : undefined,
        cpf: cpf || null,
        telefone: telefone || null,
        data_nascimento: nascimento || null,
        endereco,
        contato_emergencia: contato,
      })
      toast.success('Perfil atualizado')
      onFechar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível salvar o perfil'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="flex min-h-0 flex-1 flex-col" noValidate>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <Secao titulo="Dados pessoais" icone={UserRound}>
          <div className="sm:col-span-6">
            <FotoPicker nome={nome} foto={foto} onChange={setFoto} />
          </div>
          <Campo rotulo="Nome completo" obrigatorio col={6} erro={erros.nome}>
            {(id) => <Input id={id} value={nome} onChange={(e) => setNome(e.target.value)} />}
          </Campo>
          <Campo rotulo="CPF" col={2} erro={erros.cpf}>
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(mascaraCPF(e.target.value))}
              />
            )}
          </Campo>
          <Campo rotulo="Data de nascimento" col={2}>
            {(id) => (
              <Input
                id={id}
                type="date"
                max={hojeISO()}
                value={nascimento}
                onChange={(e) => setNascimento(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Celular / WhatsApp" col={2} erro={erros.telefone}>
            {(id) => (
              <Input
                id={id}
                inputMode="tel"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
              />
            )}
          </Campo>
        </Secao>

        <Secao titulo="Trabalho" icone={Briefcase}>
          <Campo rotulo="Cargo na padaria" col={6}>
            {(id) => (
              <>
                <Input
                  id={id}
                  list="perfil-cargos"
                  maxLength={60}
                  placeholder="Ex: Caixa, Padeiro(a), Confeiteiro(a)"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                />
                <datalist id="perfil-cargos">
                  {sugestoes.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
          </Campo>
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3 text-sm sm:col-span-6">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Função no sistema: {papelLabels[perfil.papel]}</p>
              <p className="text-xs text-muted-foreground">
                {descricaoPapel[perfil.papel]}{' '}
                {perfil.papel !== 'dono' && 'Função, admissão e turno são definidos pelo dono.'}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">E-mail de acesso</dt>
                  <dd className="truncate font-medium">{perfil.email}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Admissão</dt>
                  <dd className="font-medium">
                    {perfil.data_admissao ? formatData(perfil.data_admissao) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Turno</dt>
                  <dd className="font-medium">{perfil.turno ? turnoLabels[perfil.turno] : '—'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </Secao>

        <Secao titulo="Endereço" icone={MapPin}>
          <CamposEndereco valor={endereco} onChange={setEndereco} />
        </Secao>

        <Secao
          titulo="Contato de emergência"
          descricao="Quem avisar se algo acontecer durante o expediente."
          icone={HeartPulse}
        >
          <CamposContatoEmergencia valor={contato} onChange={setContato} />
        </Secao>
      </div>

      <DialogFooter className="border-t bg-muted/30 px-6 py-4">
        <Button type="button" variant="outline" onClick={onFechar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando && <Loader2 className="size-4 animate-spin" />}
          Salvar
        </Button>
      </DialogFooter>
    </form>
  )
}
