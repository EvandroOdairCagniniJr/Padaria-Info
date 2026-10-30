import { Loader2, Save } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useSalvarPadaria, usePadaria, lojaDoComprovante } from '@/features/padaria/api'
import {
  CamposPadaria,
  padariaParaForm,
  validarPadaria,
  type ErrosPadaria,
  type FormPadaria,
} from '@/features/padaria/CamposPadaria'
import { LogoPicker } from '@/features/padaria/LogoPicker'
import { PersonalizarComprovante } from '@/features/padaria/PersonalizarComprovante'
import type { Comprovante } from '@/features/pdv/comprovante'
import { desenharComprovante } from '@/features/pdv/comprovanteArquivo'
import { digitos } from '@/lib/documentos'
import { mensagemErro } from '@/lib/format'
import type { DadosPadaria } from '@/types/database'

// Converte o formulário no formato da API (o servidor guarda só os dígitos dos documentos).
function formParaDados(f: FormPadaria): DadosPadaria {
  const vazioViraNull = (v: string) => (v.trim() ? v.trim() : null)
  return {
    nome_fantasia: f.nome_fantasia.trim(),
    razao_social: vazioViraNull(f.razao_social),
    cnpj: digitos(f.cnpj) || null,
    inscricao_estadual: vazioViraNull(f.inscricao_estadual),
    telefone: digitos(f.telefone) || null,
    whatsapp: digitos(f.whatsapp) || null,
    email: vazioViraNull(f.email),
    instagram: vazioViraNull(f.instagram),
    horario: vazioViraNull(f.horario),
    endereco: { ...f.endereco, cep: digitos(f.endereco.cep) },
    mensagem_comprovante: vazioViraNull(f.mensagem_comprovante),
    logo: f.logo ?? null,
    comprovante: f.comprovante ?? null,
  }
}

// Venda de exemplo só para a prévia do comprovante.
const exemplo: Omit<Comprovante, 'loja'> = {
  vendaId: 'a1b2c3d4-0000-0000-0000-000000000000',
  quando: new Date().toISOString(),
  itens: [
    { nome: 'Pão francês', quantidade: 0.5, unidade: 'kg', precoUnitario: 18.9 },
    {
      nome: 'Café com leite',
      quantidade: 2,
      unidade: 'un',
      precoUnitario: 6,
      desconto: 1.2,
      promocao: 'Café da manhã -10%',
    },
    { nome: 'Pão de queijo', quantidade: 3, unidade: 'un', precoUnitario: 3.5 },
  ],
  total: 30.75,
  descontos: 1.2,
  formaPagamento: 'Dinheiro',
  recebido: 50,
  atendente: 'Atendente',
}

export function MinhaPadariaPage() {
  const padaria = usePadaria()
  const salvar = useSalvarPadaria()
  const [form, setForm] = useState<FormPadaria | null>(null)
  const [erros, setErros] = useState<ErrosPadaria>({})
  const [previa, setPrevia] = useState<string | null>(null)

  // O formulário começa com o que está salvo (quando a consulta termina).
  const salvo = useMemo(() => padariaParaForm(padaria.data), [padaria.data])
  const atual = form ?? salvo
  const alterado = form !== null && JSON.stringify(form) !== JSON.stringify(salvo)

  // Prévia do comprovante ao vivo (espera 300 ms sem digitar para redesenhar).
  useEffect(() => {
    let ativo = true
    const t = setTimeout(() => {
      const dados = formParaDados(atual)
      desenharComprovante({ ...exemplo, loja: lojaDoComprovante(dados) })
        .then((canvas) => ativo && setPrevia(canvas.toDataURL('image/png')))
        .catch(() => undefined)
    }, 300)
    return () => {
      ativo = false
      clearTimeout(t)
    }
  }, [atual])

  function mudar(f: FormPadaria) {
    setForm(f)
    setErros((e) => (Object.keys(e).length ? validarPadaria(f) : e))
  }

  async function aoSalvar(e: FormEvent) {
    e.preventDefault()
    const encontrados = validarPadaria(atual)
    setErros(encontrados)
    if (Object.keys(encontrados).length > 0) {
      toast.error('Confira os campos destacados')
      return
    }
    try {
      await salvar.mutateAsync(formParaDados(atual))
      setForm(null)
      toast.success('Dados da padaria salvos')
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível salvar'))
    }
  }

  if (padaria.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <form onSubmit={aoSalvar} className="space-y-6" noValidate>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Minha padaria</h1>
          <p className="text-sm text-muted-foreground">
            Dados da empresa usados no comprovante e no sistema
          </p>
        </div>
        <div className="flex items-center gap-3">
          {alterado && <span className="text-xs text-muted-foreground">Alterações não salvas</span>}
          {alterado && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setForm(null)
                setErros({})
              }}
            >
              Descartar
            </Button>
          )}
          <Button type="submit" disabled={salvar.isPending || (!alterado && Boolean(padaria.data))}>
            {salvar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <LogoPicker logo={atual.logo ?? null} onChange={(logo) => mudar({ ...atual, logo })} />
          <PersonalizarComprovante
            valor={atual.comprovante}
            onChange={(comprovante) => mudar({ ...atual, comprovante })}
          />
          <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
            <CamposPadaria valor={atual} onChange={mudar} erros={erros} />
          </div>
        </div>

        <aside className="space-y-2 lg:sticky lg:top-0">
          <h2 className="text-sm font-semibold">Prévia do comprovante</h2>
          <div className="flex justify-center rounded-xl border bg-[#f5efe6] p-4">
            {previa ? (
              <img
                src={previa}
                alt="Prévia do comprovante"
                className="h-auto w-full max-w-[300px] rounded-sm shadow-md"
              />
            ) : (
              <Loader2 className="my-20 size-6 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Exemplo de venda. Nome, endereço, CNPJ, telefone e mensagem saem como no cupom real.
          </p>
        </aside>
      </div>
    </form>
  )
}
