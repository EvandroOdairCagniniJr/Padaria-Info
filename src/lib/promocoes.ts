// Regras de promoção — o MESMO código roda no PDV (prévia do carrinho) e no servidor (que
// recalcula e grava a venda). Sem dependências do navegador nem do Node.

export type TipoPromocao = 'percentual' | 'valor' | 'preco_fixo' | 'leve_pague'
export type Abrangencia = 'produtos' | 'categorias' | 'tudo'

export type Promocao = {
  id: string
  nome: string
  tipo: TipoPromocao
  // percentual: % de desconto; valor: R$ a menos por unidade; preco_fixo: preço por unidade.
  valor: number
  leve: number | null
  pague: number | null
  abrangencia: Abrangencia
  // ids de produto ou nomes de categoria, conforme a abrangência.
  alvos: string[] | null
  inicio: string | null
  fim: string | null
  // 0 = domingo ... 6 = sábado; null = todos os dias.
  dias_semana: number[] | null
  hora_inicio: string | null
  hora_fim: string | null
  ativa: boolean
}

export type ItemParaPromocao = {
  produto_id: string
  categoria: string | null
  unidade: string
  quantidade: number
  preco: number
}

const centavos = (v: number) => Math.round(v * 100) / 100
const normalizar = (s: string) => s.trim().toLocaleLowerCase('pt-BR')

// A promoção vale agora? `tz` = Date.getTimezoneOffset() da padaria (Brasília = 180).
export function promocaoVigente(p: Promocao, agora: Date, tz: number) {
  if (!p.ativa) return false
  if (p.inicio && agora < new Date(p.inicio)) return false
  if (p.fim && agora >= new Date(p.fim)) return false
  const local = new Date(agora.getTime() - tz * 60_000)
  if (p.dias_semana && p.dias_semana.length && !p.dias_semana.includes(local.getUTCDay())) return false
  const hhmm = local.toISOString().slice(11, 16)
  if (p.hora_inicio && p.hora_fim) {
    // Faixa que vira a meia-noite (ex.: 22:00–02:00) também funciona.
    const dentro =
      p.hora_inicio <= p.hora_fim
        ? hhmm >= p.hora_inicio && hhmm < p.hora_fim
        : hhmm >= p.hora_inicio || hhmm < p.hora_fim
    if (!dentro) return false
  } else if (p.hora_inicio && hhmm < p.hora_inicio) return false
  else if (p.hora_fim && hhmm >= p.hora_fim) return false
  return true
}

export function promocaoAlcanca(p: Promocao, item: ItemParaPromocao) {
  if (p.abrangencia === 'tudo') return true
  const alvos = p.alvos ?? []
  if (p.abrangencia === 'produtos') return alvos.includes(item.produto_id)
  return item.categoria != null && alvos.some((c) => normalizar(c) === normalizar(item.categoria!))
}

// Quanto a promoção desconta do item inteiro (quantidade × preço).
export function descontoDaPromocao(p: Promocao, item: ItemParaPromocao) {
  const bruto = item.quantidade * item.preco
  let desconto = 0
  if (p.tipo === 'percentual') desconto = bruto * (Math.min(100, Math.max(0, p.valor)) / 100)
  else if (p.tipo === 'valor') desconto = item.quantidade * Math.min(item.preco, Math.max(0, p.valor))
  else if (p.tipo === 'preco_fixo') desconto = item.quantidade * Math.max(0, item.preco - p.valor)
  else if (p.tipo === 'leve_pague' && p.leve && p.pague != null && p.leve > p.pague) {
    // Leve 3 pague 2: a cada 3 unidades inteiras, 1 sai de graça.
    const grupos = Math.floor(item.quantidade / p.leve)
    desconto = grupos * (p.leve - p.pague) * item.preco
  }
  return centavos(Math.min(bruto, Math.max(0, desconto)))
}

// Melhor promoção de cada item (a que dá mais desconto ao cliente).
export function aplicarPromocoes(
  itens: ItemParaPromocao[],
  promocoes: Promocao[],
  agora: Date,
  tz: number,
) {
  const vigentes = promocoes.filter((p) => promocaoVigente(p, agora, tz))
  return itens.map((item) => {
    let melhor: { promocao: Promocao; desconto: number } | null = null
    for (const p of vigentes) {
      if (!promocaoAlcanca(p, item)) continue
      const desconto = descontoDaPromocao(p, item)
      if (desconto > 0 && (!melhor || desconto > melhor.desconto)) melhor = { promocao: p, desconto }
    }
    const bruto = centavos(item.quantidade * item.preco)
    return {
      ...item,
      bruto,
      desconto: melhor?.desconto ?? 0,
      promocao: melhor ? { id: melhor.promocao.id, nome: melhor.promocao.nome } : null,
      subtotal: centavos(bruto - (melhor?.desconto ?? 0)),
    }
  })
}

// Texto curto para selo/lista: "−20%", "R$ 2,00 off", "por R$ 5,00", "Leve 3 pague 2".
export function descreverPromocao(p: Pick<Promocao, 'tipo' | 'valor' | 'leve' | 'pague'>) {
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (p.tipo === 'percentual') return `−${Number(p.valor).toLocaleString('pt-BR')}%`
  if (p.tipo === 'valor') return `${brl(p.valor)} off`
  if (p.tipo === 'preco_fixo') return `por ${brl(p.valor)}`
  return `Leve ${p.leve} pague ${p.pague}`
}
