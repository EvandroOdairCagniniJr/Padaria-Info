import { formatBRL, formatDataHora, formatQuantidade } from '@/lib/format'

import { lojaDoComprovante, type Loja } from '@/features/padaria/api'

// Cabeçalho quando a venda não trouxe os dados da padaria (cadastro ainda vazio).
const lojaPadrao = lojaDoComprovante(null)

export function lojaDe(c: Comprovante) {
  return c.loja ?? lojaPadrao
}

export interface Comprovante {
  vendaId: string
  quando: string
  itens: { nome: string; quantidade: number; unidade: string; precoUnitario: number }[]
  total: number
  formaPagamento: string
  // Só em dinheiro, quando o atendente informou quanto recebeu.
  recebido?: number | null
  atendente: string | null
  // Reemitido depois pelo Histórico de vendas.
  segundaVia?: boolean
  // Nome, endereço, CNPJ e telefone da padaria (Minha padaria).
  loja?: Loja
}

export function numeroComprovante(c: Comprovante) {
  return c.vendaId.slice(0, 8).toUpperCase()
}

// ---------------------------------------------------------------- Cupom (texto em colunas)

// 32 colunas: a largura de um cupom de 58 mm, cabe na tela do celular sem quebrar.
const LARGURA = 32
const TRACO = '-'.repeat(LARGURA)

// O toLocaleString usa espaço especial (NBSP) em "R$ 4,99"; no cupom vira espaço comum.
function brl(valor: number) {
  return formatBRL(valor).replace(/\s/g, ' ')
}

function centro(texto: string) {
  return quebrar(texto).map((l) => ' '.repeat(Math.floor((LARGURA - l.length) / 2)) + l)
}

// Texto à esquerda e valor encostado na direita, na mesma linha.
function colunas(esquerda: string, direita: string) {
  const espaco = LARGURA - esquerda.length - direita.length
  if (espaco >= 1) return [esquerda + ' '.repeat(espaco) + direita]
  return [...quebrar(esquerda), direita.padStart(LARGURA)]
}

function quebrar(texto: string) {
  const linhas: string[] = []
  let atual = ''
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    if (!atual) atual = palavra
    else if (atual.length + 1 + palavra.length <= LARGURA) atual += ` ${palavra}`
    else {
      linhas.push(atual)
      atual = palavra
    }
    while (atual.length > LARGURA) {
      linhas.push(atual.slice(0, LARGURA))
      atual = atual.slice(LARGURA)
    }
  }
  if (atual) linhas.push(atual)
  return linhas
}

// As linhas do cupom em texto: usadas no WhatsApp e no Copiar.
export function linhasComprovante(c: Comprovante) {
  const qtdItens = c.itens.length
  const linhas = [
    ...centro(lojaDe(c).nome.toUpperCase()),
    ...lojaDe(c).linhas.flatMap(centro),
    TRACO,
    ...centro(c.segundaVia ? 'COMPROVANTE DE VENDA - 2ª VIA' : 'COMPROVANTE DE VENDA'),
    ...colunas(`Nº ${numeroComprovante(c)}`, formatDataHora(c.quando)),
    TRACO,
    ...c.itens.flatMap((i) => [
      ...quebrar(i.nome),
      ...colunas(
        `  ${formatQuantidade(i.quantidade)} ${i.unidade} x ${brl(i.precoUnitario)}`,
        brl(i.quantidade * i.precoUnitario),
      ),
    ]),
    TRACO,
    ...colunas(`${qtdItens} ${qtdItens === 1 ? 'item' : 'itens'}`, ''),
    ...colunas('TOTAL', brl(c.total)),
    TRACO,
    ...colunas('Pagamento', c.formaPagamento),
  ]
  if (c.recebido != null) {
    linhas.push(...colunas('Valor recebido', brl(c.recebido)))
    linhas.push(...colunas('Troco', brl(c.recebido - c.total)))
  }
  linhas.push(TRACO)
  if (c.atendente) linhas.push(...quebrar(`Atendente: ${c.atendente}`))
  linhas.push(
    ...centro('Documento sem valor fiscal'),
    '',
    ...centro(lojaDe(c).mensagem || 'Obrigado pela preferência!'),
  )
  return linhas
}

// WhatsApp: o bloco entre ``` sai em fonte de largura fixa, então as colunas ficam alinhadas.
export function textoComprovante(c: Comprovante) {
  return '```\n' + linhasComprovante(c).join('\n') + '\n```'
}

// ---------------------------------------------------------------- WhatsApp

// Aceita "(11) 98765-4321", "11987654321" ou "+55 11 98765-4321".
// Devolve só dígitos com o 55 do Brasil, ou null se não parecer um celular/fixo válido.
export function normalizarWhatsapp(entrada: string) {
  let digitos = entrada.replace(/\D/g, '')
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`
  return /^55\d{10,11}$/.test(digitos) ? digitos : null
}

// wa.me abre o WhatsApp (app ou web) com a conversa e a mensagem prontas para enviar.
export function linkWhatsapp(numero: string, texto: string) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}
