import { Building2, Clock, MapPin, Phone, Receipt } from 'lucide-react'
import { Campo, CamposEndereco, Secao } from '@/components/cadastro/Formulario'
import { Input } from '@/components/ui/input'
import {
  cnpjValido,
  enderecoVazio,
  mascaraCEP,
  mascaraCNPJ,
  mascaraTelefone,
  telefoneValido,
  type Endereco,
} from '@/lib/documentos'
import type { DadosPadaria } from '@/types/database'

export interface FormPadaria {
  nome_fantasia: string
  razao_social: string
  cnpj: string
  inscricao_estadual: string
  telefone: string
  whatsapp: string
  email: string
  instagram: string
  horario: string
  endereco: Endereco
  mensagem_comprovante: string
  logo?: string | null
}

export type ErrosPadaria = Partial<Record<keyof FormPadaria, string>>

export function padariaParaForm(p: DadosPadaria | null | undefined): FormPadaria {
  return {
    nome_fantasia: p?.nome_fantasia ?? '',
    razao_social: p?.razao_social ?? '',
    cnpj: mascaraCNPJ(p?.cnpj),
    inscricao_estadual: p?.inscricao_estadual ?? '',
    telefone: mascaraTelefone(p?.telefone),
    whatsapp: mascaraTelefone(p?.whatsapp),
    email: p?.email ?? '',
    instagram: p?.instagram ?? '',
    horario: p?.horario ?? '',
    endereco: p?.endereco
      ? { ...enderecoVazio, ...p.endereco, cep: mascaraCEP(p.endereco.cep) }
      : enderecoVazio,
    mensagem_comprovante: p?.mensagem_comprovante ?? '',
    logo: p?.logo ?? null,
  }
}

export function validarPadaria(f: FormPadaria): ErrosPadaria {
  const erros: ErrosPadaria = {}
  if (!f.nome_fantasia.trim()) erros.nome_fantasia = 'Informe o nome da padaria'
  if (f.cnpj && !cnpjValido(f.cnpj)) erros.cnpj = 'CNPJ inválido'
  if (f.telefone && !telefoneValido(f.telefone)) erros.telefone = 'Use DDD + número'
  if (f.whatsapp && !telefoneValido(f.whatsapp)) erros.whatsapp = 'Use DDD + número'
  if (f.email && !/^\S+@\S+\.\S+$/.test(f.email.trim())) erros.email = 'E-mail inválido'
  return erros
}

// Dados da padaria. `completo` = também os campos do comprovante (só em Minha padaria).
export function CamposPadaria({
  valor,
  onChange,
  erros,
  completo = true,
}: {
  valor: FormPadaria
  onChange: (f: FormPadaria) => void
  erros: ErrosPadaria
  completo?: boolean
}) {
  const mudar = <K extends keyof FormPadaria>(campo: K, v: FormPadaria[K]) =>
    onChange({ ...valor, [campo]: v })

  return (
    <div className="space-y-6">
      <Secao titulo="Identificação" icone={Building2}>
        <Campo
          rotulo="Nome da padaria"
          obrigatorio
          col={6}
          erro={erros.nome_fantasia}
          dica="Como os clientes conhecem — aparece no comprovante"
        >
          {(id) => (
            <Input
              id={id}
              maxLength={80}
              placeholder="Ex: Padaria Pão Dourado"
              value={valor.nome_fantasia}
              onChange={(e) => mudar('nome_fantasia', e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="Razão social" col={6}>
          {(id) => (
            <Input
              id={id}
              maxLength={120}
              placeholder="Nome registrado da empresa"
              value={valor.razao_social}
              onChange={(e) => mudar('razao_social', e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="CNPJ" col={3} erro={erros.cnpj}>
          {(id) => (
            <Input
              id={id}
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              value={valor.cnpj}
              onChange={(e) => mudar('cnpj', mascaraCNPJ(e.target.value))}
            />
          )}
        </Campo>
        <Campo rotulo="Inscrição estadual" col={3} dica="Se tiver">
          {(id) => (
            <Input
              id={id}
              maxLength={20}
              value={valor.inscricao_estadual}
              onChange={(e) => mudar('inscricao_estadual', e.target.value)}
            />
          )}
        </Campo>
      </Secao>

      <Secao titulo="Contato" icone={Phone}>
        <Campo rotulo="Telefone" col={2} erro={erros.telefone}>
          {(id) => (
            <Input
              id={id}
              inputMode="tel"
              placeholder="(00) 0000-0000"
              value={valor.telefone}
              onChange={(e) => mudar('telefone', mascaraTelefone(e.target.value))}
            />
          )}
        </Campo>
        <Campo rotulo="WhatsApp" col={2} erro={erros.whatsapp}>
          {(id) => (
            <Input
              id={id}
              inputMode="tel"
              placeholder="(00) 00000-0000"
              value={valor.whatsapp}
              onChange={(e) => mudar('whatsapp', mascaraTelefone(e.target.value))}
            />
          )}
        </Campo>
        <Campo rotulo="Instagram" col={2}>
          {(id) => (
            <Input
              id={id}
              maxLength={60}
              placeholder="@suapadaria"
              value={valor.instagram}
              onChange={(e) => mudar('instagram', e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="E-mail" col={6} erro={erros.email}>
          {(id) => (
            <Input
              id={id}
              type="email"
              placeholder="contato@suapadaria.com.br"
              value={valor.email}
              onChange={(e) => mudar('email', e.target.value)}
            />
          )}
        </Campo>
      </Secao>

      <Secao titulo="Endereço da padaria" icone={MapPin}>
        <CamposEndereco valor={valor.endereco} onChange={(e) => mudar('endereco', e)} />
      </Secao>

      {completo && (
        <>
          <Secao titulo="Funcionamento" icone={Clock}>
            <Campo rotulo="Horário de funcionamento" col={6}>
              {(id) => (
                <Input
                  id={id}
                  maxLength={120}
                  placeholder="Ex: Seg a Sáb, 6h às 20h · Dom, 6h às 12h"
                  value={valor.horario}
                  onChange={(e) => mudar('horario', e.target.value)}
                />
              )}
            </Campo>
          </Secao>

          <Secao titulo="Comprovante" icone={Receipt}>
            <Campo
              rotulo="Mensagem no fim do comprovante"
              col={6}
              dica="Deixe em branco para usar “Obrigado pela preferência!”"
            >
              {(id) => (
                <Input
                  id={id}
                  maxLength={120}
                  placeholder="Ex: Volte sempre! Pão quentinho toda hora."
                  value={valor.mensagem_comprovante}
                  onChange={(e) => mudar('mensagem_comprovante', e.target.value)}
                />
              )}
            </Campo>
          </Secao>
        </>
      )}
    </div>
  )
}
