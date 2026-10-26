// Análise de vendas por período (dia, semana, mês): mais vendidos, comparação com o período
// anterior, vendas por hora/dia, categorias, produtos comprados juntos e recomendações de venda.
import { Router } from 'express'
import type { RowDataPacket } from 'mysql2/promise'
import { z } from 'zod'
import { exigirPapel } from './auth.ts'
import { pool } from './db.ts'
import { validar } from './http.ts'

export const analiseRouter = Router()
analiseRouter.use(exigirPapel('dono', 'admin'))

const DIA = 24 * 60 * 60 * 1000
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (v: number) => `${Math.round(Math.abs(v) * 100)}%`
const nomesDia = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

// [início, fim) do período atual e do anterior equivalente, no relógio da padaria.
function periodos(tipo: 'dia' | 'semana' | 'mes', hoje: Date) {
  if (tipo === 'dia') {
    return { de: hoje, ate: new Date(hoje.getTime() + DIA), antDe: new Date(hoje.getTime() - 7 * DIA) }
  }
  if (tipo === 'semana') {
    // Semana de segunda a domingo; hoje + 12h evita erro de fuso ao achar o dia da semana.
    const diaSemana = (new Date(hoje.getTime() + 12 * 3600e3).getUTCDay() + 6) % 7
    const de = new Date(hoje.getTime() - diaSemana * DIA)
    return { de, ate: new Date(de.getTime() + 7 * DIA), antDe: new Date(de.getTime() - 7 * DIA) }
  }
  // Mês: o cliente manda o início do mês em `mes`; o anterior tem a mesma quantidade de dias decorridos.
  return null
}

analiseRouter.get('/', async (req, res) => {
  const q = validar(
    z.object({
      periodo: z.enum(['dia', 'semana', 'mes']),
      hoje: z.coerce.date('Data inválida'),
      mes: z.coerce.date('Data inválida'),
      mes_anterior: z.coerce.date('Data inválida'),
      tz: z.coerce.number().min(-840).max(840).default(180),
    }),
    req.query,
  )
  const padariaId: string = res.locals.padariaId
  const agora = new Date()
  let de: Date
  let ate: Date
  let antDe: Date
  const p = periodos(q.periodo, q.hoje)
  if (p) ({ de, ate, antDe } = p)
  else {
    de = q.mes
    ate = new Date(q.hoje.getTime() + DIA)
    antDe = q.mes_anterior
  }
  // Comparação justa: o período anterior só até o mesmo ponto (ex.: semana passada até hoje, mesmo horário).
  const decorrido = Math.min(agora.getTime(), ate.getTime()) - de.getTime()
  const antAte = new Date(antDe.getTime() + decorrido)
  // Dia: compara com o mesmo dia da semana passada.
  const rotuloAnterior =
    q.periodo === 'dia' ? 'mesmo dia da semana passada' : q.periodo === 'semana' ? 'semana passada' : 'mês passado'
  // "acima da semana passada", "contra 15 na semana passada".
  const daAnterior = `${q.periodo === 'semana' ? 'da' : 'do'} ${rotuloAnterior}`
  const naAnterior = `${q.periodo === 'semana' ? 'na' : 'no'} ${rotuloAnterior}`

  const [[tot]] = await pool.query<RowDataPacket[]>(
    `select
       sum(case when created_at >= ? and created_at < ? then 1 else 0 end) as vendas,
       coalesce(sum(case when created_at >= ? and created_at < ? then total end), 0) as faturamento,
       sum(case when created_at >= ? and created_at < ? then 1 else 0 end) as vendas_ant,
       coalesce(sum(case when created_at >= ? and created_at < ? then total end), 0) as faturamento_ant
     from vendas where padaria_id = ? and status <> 'devolvida' and created_at >= ?`,
    [de, ate, de, ate, antDe, antAte, antDe, antAte, padariaId, antDe],
  )
  const vendas = Number(tot.vendas ?? 0)
  const faturamento = Number(tot.faturamento)
  const vendasAnt = Number(tot.vendas_ant ?? 0)
  const faturamentoAnt = Number(tot.faturamento_ant)

  const [prods] = await pool.query<RowDataPacket[]>(
    `select p.id, p.nome, p.categoria, p.unidade,
       coalesce(sum(case when v.created_at >= ? then i.quantidade end), 0) as quantidade,
       coalesce(sum(case when v.created_at >= ? then i.subtotal end), 0) as faturamento,
       coalesce(sum(case when v.created_at < ? then i.quantidade end), 0) as quantidade_ant,
       count(distinct case when v.created_at >= ? then v.id end) as vendas
     from vendas_itens i
     join vendas v on v.id = i.venda_id
     join produtos p on p.id = i.produto_id
     where v.padaria_id = ? and v.status <> 'devolvida'
       and ((v.created_at >= ? and v.created_at < ?) or (v.created_at >= ? and v.created_at < ?))
     group by p.id, p.nome, p.categoria, p.unidade`,
    [de, de, de, de, padariaId, de, ate, antDe, antAte],
  )
  const produtos = prods
    .map((r) => {
      const quantidade = Number(r.quantidade)
      const quantidadeAnt = Number(r.quantidade_ant)
      return {
        id: r.id as string,
        nome: r.nome as string,
        categoria: r.categoria as string | null,
        unidade: r.unidade as string,
        quantidade,
        faturamento: Number(r.faturamento),
        vendas: Number(r.vendas),
        quantidade_anterior: quantidadeAnt,
        variacao: quantidadeAnt > 0 ? (quantidade - quantidadeAnt) / quantidadeAnt : null,
        participacao: faturamento > 0 ? Number(r.faturamento) / faturamento : 0,
      }
    })
    .filter((r) => r.quantidade > 0 || r.quantidade_anterior > 0)
  const ranking = produtos.filter((r) => r.quantidade > 0).sort((a, b) => b.faturamento - a.faturamento)
  const porQuantidade = [...ranking].sort((a, b) => b.quantidade - a.quantidade)

  // Linha do tempo: por hora no dia; por dia na semana e no mês (no fuso da padaria).
  const offset = q.tz * 60
  const [tempo] = await pool.query<RowDataPacket[]>(
    q.periodo === 'dia'
      ? `select floor(mod(unix_timestamp(created_at) - ?, 86400) / 3600) as chave,
                count(*) as vendas, sum(total) as faturamento
         from vendas where padaria_id = ? and status <> 'devolvida' and created_at >= ? and created_at < ?
         group by chave order by chave`
      : `select floor((unix_timestamp(created_at) - ?) / 86400) as chave,
                count(*) as vendas, sum(total) as faturamento
         from vendas where padaria_id = ? and status <> 'devolvida' and created_at >= ? and created_at < ?
         group by chave order by chave`,
    [offset, padariaId, de, ate],
  )
  const linhaTempo = tempo.map((t) => {
    const chave = Number(t.chave)
    // Dia: chave = hora; semana/mês: dias desde 1970 → data local (meio-dia UTC daquele dia).
    const data = q.periodo === 'dia' ? null : new Date(chave * DIA + 12 * 3600e3)
    return {
      rotulo:
        q.periodo === 'dia'
          ? `${chave}h`
          : q.periodo === 'semana'
            ? nomesDia[data!.getUTCDay()].slice(0, 3)
            : String(data!.getUTCDate()),
      dia_semana: data ? data.getUTCDay() : null,
      vendas: Number(t.vendas),
      faturamento: Number(t.faturamento),
    }
  })

  const categorias = new Map<string, number>()
  for (const r of ranking) {
    const c = r.categoria || 'Sem categoria'
    categorias.set(c, (categorias.get(c) ?? 0) + r.faturamento)
  }

  // Comprados juntos: pares de produtos que mais aparecem na mesma venda do período.
  const [pares] = await pool.query<RowDataPacket[]>(
    `select a.produto_id as a, b.produto_id as b, pa.nome as nome_a, pb.nome as nome_b, count(*) as vezes
     from vendas_itens a
     join vendas_itens b on b.venda_id = a.venda_id and a.produto_id < b.produto_id
     join vendas v on v.id = a.venda_id
     join produtos pa on pa.id = a.produto_id
     join produtos pb on pb.id = b.produto_id
     where v.padaria_id = ? and v.status <> 'devolvida' and v.created_at >= ? and v.created_at < ?
     group by a.produto_id, b.produto_id, pa.nome, pb.nome
     having vezes >= 2
     order by vezes desc limit 5`,
    [padariaId, de, ate],
  )
  const juntos = pares.map((x) => ({ produtos: [x.nome_a, x.nome_b], vezes: Number(x.vezes) }))

  // Recomendações de venda do período.
  const rec: { tom: 'boa' | 'atencao' | 'oportunidade'; titulo: string; texto: string }[] = []
  const ticket = vendas ? faturamento / vendas : 0
  const ticketAnt = vendasAnt ? faturamentoAnt / vendasAnt : 0
  if (faturamentoAnt > 0 && faturamento > 0) {
    const v = (faturamento - faturamentoAnt) / faturamentoAnt
    if (Math.abs(v) >= 0.05) {
      rec.push({
        tom: v > 0 ? 'boa' : 'atencao',
        titulo: v > 0 ? `Faturamento ${pct(v)} acima ${daAnterior}` : `Faturamento ${pct(v)} abaixo ${daAnterior}`,
        texto: `${brl(faturamento)} contra ${brl(faturamentoAnt)} no mesmo ponto.${v < 0 ? ' Movimente o balcão: promoção do dia, aviso no WhatsApp ou fornada extra no horário de pico.' : ''}`,
      })
    }
  }
  if (ticketAnt > 0 && ticket > 0 && (ticket - ticketAnt) / ticketAnt <= -0.08) {
    rec.push({
      tom: 'atencao',
      titulo: `Ticket médio caiu para ${brl(ticket)}`,
      texto: `Era ${brl(ticketAnt)}. Ofereça um acompanhamento no caixa ("vai um café com o pão?") ou monte um combo.`,
    })
  }
  const subindo = produtos
    .filter((r) => r.variacao != null && r.variacao >= 0.25 && r.quantidade >= 5)
    .sort((a, b) => b.variacao! - a.variacao!)
  for (const r of subindo.slice(0, 2)) {
    rec.push({
      tom: 'boa',
      titulo: `${r.nome} em alta: +${pct(r.variacao!)}`,
      texto: `${r.quantidade} ${r.unidade} contra ${r.quantidade_anterior} ${naAnterior}. Garanta produção e deixe em destaque — não pode faltar.`,
    })
  }
  const caindo = produtos
    .filter((r) => r.variacao != null && r.variacao <= -0.25 && r.quantidade_anterior >= 5)
    .sort((a, b) => a.variacao! - b.variacao!)
  for (const r of caindo.slice(0, 2)) {
    rec.push({
      tom: 'atencao',
      titulo: `${r.nome} vendendo menos: −${pct(r.variacao!)}`,
      texto: `${r.quantidade} ${r.unidade} contra ${r.quantidade_anterior} ${naAnterior}. Reduza a produção ou faça uma promoção para girar.`,
    })
  }
  if (juntos[0]) {
    rec.push({
      tom: 'oportunidade',
      titulo: `Combo: ${juntos[0].produtos.join(' + ')}`,
      texto: `Saíram juntos em ${juntos[0].vezes} vendas. Um combo com pequeno desconto aumenta o ticket médio.`,
    })
  }
  if (ranking[0] && ranking[0].participacao >= 0.3) {
    rec.push({
      tom: 'oportunidade',
      titulo: `${ranking[0].nome} é ${pct(ranking[0].participacao)} do faturamento`,
      texto: 'Seu carro-chefe. Cuide da qualidade e do horário das fornadas; aproveite para vender junto um item de maior margem.',
    })
  }
  if (q.periodo === 'dia' && linhaTempo.length >= 3) {
    const pico = [...linhaTempo].sort((a, b) => b.faturamento - a.faturamento)[0]
    rec.push({
      tom: 'oportunidade',
      titulo: `Horário mais forte: ${pico.rotulo}`,
      texto: `${brl(pico.faturamento)} em ${pico.vendas} ${pico.vendas === 1 ? 'venda' : 'vendas'}. Tenha pão quentinho e balcão reforçado nesse horário.`,
    })
  }
  if (q.periodo !== 'dia' && linhaTempo.length >= 3) {
    const melhor = [...linhaTempo].sort((a, b) => b.faturamento - a.faturamento)[0]
    const pior = [...linhaTempo].sort((a, b) => a.faturamento - b.faturamento)[0]
    rec.push({
      tom: 'oportunidade',
      titulo: `Melhor dia: ${melhor.dia_semana != null ? nomesDia[melhor.dia_semana] : melhor.rotulo} (${brl(melhor.faturamento)})`,
      texto: `O dia mais fraco foi ${pior.dia_semana != null ? nomesDia[pior.dia_semana] : pior.rotulo} (${brl(pior.faturamento)}): bom dia para promoção.`,
    })
  }

  res.json({
    periodo: { de, ate, anterior_de: antDe, anterior_ate: antAte, rotulo_anterior: rotuloAnterior },
    resumo: {
      vendas,
      faturamento,
      ticket_medio: ticket,
      vendas_anterior: vendasAnt,
      faturamento_anterior: faturamentoAnt,
      ticket_anterior: ticketAnt,
    },
    ranking: ranking.slice(0, 15),
    por_quantidade: porQuantidade.slice(0, 15),
    linha_tempo: linhaTempo,
    categorias: [...categorias.entries()]
      .map(([nome, valor]) => ({ nome, faturamento: valor, participacao: faturamento ? valor / faturamento : 0 }))
      .sort((a, b) => b.faturamento - a.faturamento),
    juntos,
    recomendacoes: rec,
  })
})
