import { Loader2, type LucideIcon } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { buscarCEP, mascaraCEP, mascaraTelefone, ufs, type Endereco } from '@/lib/documentos'
import { cn } from '@/lib/utils'

// Bloco de um formulário de cadastro: título com ícone, descrição curta e os campos em grade.
export function Secao({
  titulo,
  descricao,
  icone: Icone,
  children,
}: {
  titulo: string
  descricao?: string
  icone: LucideIcon
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2.5 border-b pb-2">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icone className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold">{titulo}</h3>
          {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">{children}</div>
    </section>
  )
}

// Campo com rótulo, marca de obrigatório, dica e erro. `col` = quantas das 6 colunas ocupa.
export function Campo({
  rotulo,
  obrigatorio,
  dica,
  erro,
  col = 6,
  children,
}: {
  rotulo: string
  obrigatorio?: boolean
  dica?: string
  erro?: string | null
  col?: 1 | 2 | 3 | 4 | 6
  children: (id: string) => ReactNode
}) {
  const id = useId()
  const colunas = {
    1: 'sm:col-span-1',
    2: 'sm:col-span-2',
    3: 'sm:col-span-3',
    4: 'sm:col-span-4',
    6: 'sm:col-span-6',
  }
  return (
    <div className={cn('space-y-1.5', colunas[col])}>
      <Label htmlFor={id} className="text-xs font-medium">
        {rotulo}
        {obrigatorio && <span className="text-destructive">*</span>}
      </Label>
      {children(id)}
      {erro ? (
        <p className="text-xs text-destructive">{erro}</p>
      ) : (
        dica && <p className="text-[11px] text-muted-foreground">{dica}</p>
      )}
    </div>
  )
}

// Endereço com busca automática pelo CEP (rua, bairro, cidade e UF se preenchem sozinhos).
export function CamposEndereco({
  valor,
  onChange,
}: {
  valor: Endereco
  onChange: (e: Endereco) => void
}) {
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const mudar = (campo: keyof Endereco, v: string) => onChange({ ...valor, [campo]: v })

  async function aoMudarCEP(texto: string) {
    const cep = mascaraCEP(texto)
    const novo = { ...valor, cep }
    onChange(novo)
    setAviso(null)
    if (cep.length !== 9) return
    setBuscando(true)
    const achado = await buscarCEP(cep)
    setBuscando(false)
    if (achado) onChange({ ...novo, ...achado })
    else setAviso('CEP não encontrado — preencha o endereço manualmente.')
  }

  return (
    <>
      <Campo rotulo="CEP" col={2} dica="Preenche o endereço sozinho" erro={aviso}>
        {(id) => (
          <div className="relative">
            <Input
              id={id}
              inputMode="numeric"
              placeholder="00000-000"
              value={valor.cep}
              onChange={(e) => aoMudarCEP(e.target.value)}
            />
            {buscando && (
              <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        )}
      </Campo>
      <Campo rotulo="Rua / Avenida" col={4}>
        {(id) => (
          <Input
            id={id}
            value={valor.logradouro}
            onChange={(e) => mudar('logradouro', e.target.value)}
          />
        )}
      </Campo>
      <Campo rotulo="Número" col={2}>
        {(id) => (
          <Input id={id} value={valor.numero} onChange={(e) => mudar('numero', e.target.value)} />
        )}
      </Campo>
      <Campo rotulo="Complemento" col={4}>
        {(id) => (
          <Input
            id={id}
            placeholder="Apto, bloco, casa..."
            value={valor.complemento}
            onChange={(e) => mudar('complemento', e.target.value)}
          />
        )}
      </Campo>
      <Campo rotulo="Bairro" col={2}>
        {(id) => (
          <Input id={id} value={valor.bairro} onChange={(e) => mudar('bairro', e.target.value)} />
        )}
      </Campo>
      <Campo rotulo="Cidade" col={3}>
        {(id) => (
          <Input id={id} value={valor.cidade} onChange={(e) => mudar('cidade', e.target.value)} />
        )}
      </Campo>
      <Campo rotulo="UF" col={1}>
        {(id) => (
          <Select value={valor.uf || undefined} onValueChange={(v) => mudar('uf', v)}>
            <SelectTrigger id={id} className="w-full">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {ufs.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Campo>
    </>
  )
}

export interface Contato {
  nome: string
  parentesco: string
  telefone: string
}

export const contatoVazio: Contato = { nome: '', parentesco: '', telefone: '' }

export function CamposContatoEmergencia({
  valor,
  onChange,
}: {
  valor: Contato
  onChange: (c: Contato) => void
}) {
  return (
    <>
      <Campo rotulo="Nome do contato" col={3}>
        {(id) => (
          <Input
            id={id}
            value={valor.nome}
            onChange={(e) => onChange({ ...valor, nome: e.target.value })}
          />
        )}
      </Campo>
      <Campo rotulo="Parentesco" col={1}>
        {(id) => (
          <Input
            id={id}
            placeholder="Mãe, cônjuge..."
            value={valor.parentesco}
            onChange={(e) => onChange({ ...valor, parentesco: e.target.value })}
          />
        )}
      </Campo>
      <Campo rotulo="Telefone" col={2}>
        {(id) => (
          <Input
            id={id}
            inputMode="tel"
            placeholder="(00) 00000-0000"
            value={valor.telefone}
            onChange={(e) => onChange({ ...valor, telefone: mascaraTelefone(e.target.value) })}
          />
        )}
      </Campo>
    </>
  )
}
