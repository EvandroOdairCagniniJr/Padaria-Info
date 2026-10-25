// Máscaras e validação de documentos brasileiros (iguais às do servidor, em server/cadastro.ts).
// O que vai para a API é só dígitos; a máscara é só para digitar e ler.

export const digitos = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '')

function aplicar(valor: string, padrao: string) {
  const d = digitos(valor)
  let saida = ''
  let i = 0
  for (const ch of padrao) {
    if (i >= d.length) break
    if (ch === '#') saida += d[i++]
    else saida += ch
  }
  return saida
}

export const mascaraCPF = (v: string | null | undefined) => aplicar(v ?? '', '###.###.###-##')
export const mascaraCNPJ = (v: string | null | undefined) => aplicar(v ?? '', '##.###.###/####-##')
export const mascaraCEP = (v: string | null | undefined) => aplicar(v ?? '', '#####-###')
export function mascaraTelefone(v: string | null | undefined) {
  const d = digitos(v)
  return d.length <= 10 ? aplicar(d, '(##) ####-####') : aplicar(d, '(##) #####-####')
}

const todosIguais = (d: string) => /^(\d)\1+$/.test(d)

export function cpfValido(valor: string) {
  const d = digitos(valor)
  if (d.length !== 11 || todosIguais(d)) return false
  for (const pos of [9, 10]) {
    let soma = 0
    for (let i = 0; i < pos; i++) soma += Number(d[i]) * (pos + 1 - i)
    if (((soma * 10) % 11) % 10 !== Number(d[pos])) return false
  }
  return true
}

export function cnpjValido(valor: string) {
  const d = digitos(valor)
  if (d.length !== 14 || todosIguais(d)) return false
  for (const pos of [12, 13]) {
    let soma = 0
    let peso = pos - 7
    for (let i = 0; i < pos; i++) {
      soma += Number(d[i]) * peso
      peso = peso === 2 ? 9 : peso - 1
    }
    const resto = soma % 11
    if ((resto < 2 ? 0 : 11 - resto) !== Number(d[pos])) return false
  }
  return true
}

export const telefoneValido = (v: string) => [10, 11].includes(digitos(v).length)

export interface Endereco {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

export const enderecoVazio: Endereco = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
}

// Uma linha só: "Rua das Flores, 120 - Centro, Campinas/SP".
export function enderecoEmLinha(e: Partial<Endereco> | null | undefined) {
  if (!e) return ''
  const rua = [e.logradouro, e.numero].filter(Boolean).join(', ')
  const bairro = [rua, e.complemento, e.bairro].filter(Boolean).join(' - ')
  const cidade = [e.cidade, e.uf].filter(Boolean).join('/')
  return [bairro, cidade].filter(Boolean).join(', ')
}

// Busca o endereço pelo CEP (ViaCEP). Sem internet ou CEP inexistente: null, e a pessoa digita.
export async function buscarCEP(cep: string): Promise<Partial<Endereco> | null> {
  const d = digitos(cep)
  if (d.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, {
      signal: AbortSignal.timeout(5000),
    })
    const r = await res.json()
    if (!res.ok || r.erro) return null
    return {
      logradouro: r.logradouro ?? '',
      bairro: r.bairro ?? '',
      cidade: r.localidade ?? '',
      uf: r.uf ?? '',
    }
  } catch {
    return null
  }
}

export const ufs = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]
