// "Hoje na sua padaria": recomendações do dia geradas a partir dos dados — estoque, encomendas,
// produção, perdas, preços, ritmo de vendas, metas, contas e caixa. Cada uma traz o próximo passo.
import { Router } from 'express'
import type { RowDataPacket } from './db.ts'
import type { Usuario } from './auth.ts'
import { lerConfig, pool } from './db.ts'
import { HttpError } from './http.ts'
import { custosDosProdutos } from './margens.ts'
import { lerMetas } from './metas.ts'
import { calcularSugestao } from './perdas.ts'

export const recomendacoesRouter = Router()

const DIA = 24 * 60 * 60 * 1000

type Tom = 'alerta' | 'atencao' | 'oportunidade' | 'boa'
type Recomendacao = {
  id: string
  tom: Tom
  icone: string
  titulo: string
  texto: string
  link?: string
  acao?: string
  // Maior = mais importante (ordem no painel).
  peso: number
  gestao?: boolean
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
// 1 → "1 produto", 3 → "3 produtos".
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const lista = (nomes: string[], max = 3) =>
  nomes.length <= max ? nomes.join(', ') : `${nomes.slice(0, max).join(', ')} e mais ${nomes.length - max}`

// `inicio` = início de hoje no relógio da padaria (o servidor roda em UTC).
recomendacoesRouter.get('/', async (req, res) => {
  const inicio = typeof req.query.inicio === 'string' ? new Date(req.query.inicio) : null
  if (!inicio || Number.isNaN(inicio.getTime())) throw new HttpError(400, 'Data inválida')
  const padariaId: string = res.locals.padariaId
  const usuario = res.locals.usuario as Usuario
  const gestao = usuario.papel !== 'funcionario'
  const amanha = new Date(inicio.getTime() + DIA)
  const agora = new Date()
  // Fuso do navegador em minutos (Date.getTimezoneOffset; Brasília = 180).
  const tz = Number(req.query.tz ?? 180)
  if (!Number.isFinite(tz) || Math.abs(tz) > 14 * 60) throw new HttpError(400, 'Fuso inválido')
  const horaLocal = (d: Date) => new Date(d.getTime() - tz * 60_000).toISOString().slice(11, 16)
  const r: Recomendacao[] = []

  // 1. Estoque no mínimo ou abaixo.
  const [baixos] = await pool.query<RowDataPacket[]>(
    `select nome, estoque_atual, unidade from produtos
     where padaria_id = ? and ativo = true and estoque_minimo > 0 and estoque_atual <= estoque_minimo
     order by estoque_atual / estoque_minimo`,
    [padariaId],
  )
  if (baixos.length) {
    r.push({
      id: 'estoque',
      tom: 'alerta',
      icone: 'package',
      titulo: `${plural(baixos.length, 'produto', 'produtos')} no estoque mínimo`,
      texto: `Repor: ${lista(baixos.map((b) => b.nome))}.`,
      link: '/estoque',
      acao: 'Ver estoque',
      peso: 90,
    })
  }

  // 2. Encomendas atrasadas e de hoje.
  const [encomendas] = await pool.query<RowDataPacket[]>(
    `select numero, cliente_nome, retirada_em, status from encomendas
     where padaria_id = ? and status in ('reservada', 'confirmada', 'em_producao', 'pronta')
       and retirada_em < ? order by retirada_em`,
    [padariaId, amanha],
  )
  const atrasadas = encomendas.filter((e) => new Date(e.retirada_em) < agora && e.status !== 'pronta')
  const deHoje = encomendas.filter((e) => new Date(e.retirada_em) >= inicio && !atrasadas.includes(e))
  if (atrasadas.length) {
    r.push({
      id: 'encomendas-atrasadas',
      tom: 'alerta',
      icone: 'calendar',
      titulo: plural(atrasadas.length, 'encomenda atrasada', 'encomendas atrasadas'),
      texto: `Já passou do horário: ${lista(atrasadas.map((e) => `nº ${e.numero} (${e.cliente_nome})`))}.`,
      link: '/encomendas',
      acao: 'Ver encomendas',
      peso: 95,
    })
  }
  if (deHoje.length) {
    const naoProntas = deHoje.filter((e) => e.status !== 'pronta').length
    r.push({
      id: 'encomendas-hoje',
      tom: naoProntas ? 'atencao' : 'boa',
      icone: 'calendar',
      titulo: `${plural(deHoje.length, 'encomenda', 'encomendas')} para hoje`,
      texto: naoProntas
        ? `${naoProntas === 1 ? '1 ainda não está pronta' : `${naoProntas} ainda não estão prontas`}. A primeira sai às ${horaLocal(new Date(deHoje[0].retirada_em))}.`
        : 'Todas prontas. Que tal avisar os clientes pelo WhatsApp?',
      link: '/encomendas',
      acao: 'Abrir agenda',
      peso: 80,
    })
  }

  // 3. Produção sugerida ainda não planejada para hoje.
  const sugestao = await calcularSugestao(padariaId, inicio)
  const fornadas = sugestao.reduce((s, x) => s + (x.fornadas ?? 0), 0)
  const dataHoje = new Date(inicio.getTime() + 12 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [[planejadas]] = await pool.query<RowDataPacket[]>(
    'select count(*) as n from producoes where padaria_id = ? and data = ?',
    [padariaId, dataHoje],
  )
  if (fornadas > 0 && Number(planejadas.n) === 0) {
    const principais = sugestao.filter((s) => s.sugestao > 0).slice(0, 3)
    r.push({
      id: 'producao',
      tom: 'oportunidade',
      icone: 'chef',
      titulo: `Produção sugerida: ${plural(fornadas, 'fornada', 'fornadas')} hoje`,
      texto: `Pelo histórico deste dia da semana: ${lista(principais.map((s) => `${s.sugestao} ${s.unidade} de ${s.nome}`))}.`,
      link: '/producao',
      acao: 'Planejar',
      peso: 70,
    })
  }

  // 4. Sobra alta nos últimos 7 dias.
  const [sobras] = await pool.query<RowDataPacket[]>(
    `select p.nome, sum(pe.quantidade) as perdido, sum(pe.quantidade * pe.custo_unitario) as custo,
            (select coalesce(sum(i.quantidade), 0) from vendas_itens i join vendas v on v.id = i.venda_id
              where i.produto_id = p.id and v.status <> 'devolvida' and v.created_at >= ?) as vendido
     from perdas pe join produtos p on p.id = pe.produto_id
     where pe.padaria_id = ? and pe.created_at >= ?
     group by p.id, p.nome`,
    [new Date(inicio.getTime() - 7 * DIA), padariaId, new Date(inicio.getTime() - 7 * DIA)],
  )
  const altas = sobras
    .map((s) => ({
      nome: String(s.nome),
      custo: Number(s.custo),
      taxa: Number(s.perdido) / (Number(s.perdido) + Number(s.vendido) || 1),
    }))
    .filter((s) => s.taxa > 0.1)
    .sort((a, b) => b.custo - a.custo)
  if (altas.length) {
    const custo = altas.reduce((s, a) => s + a.custo, 0)
    r.push({
      id: 'perdas',
      tom: 'atencao',
      icone: 'trash',
      titulo: `Sobra alta: ${brl(custo)} perdidos em 7 dias`,
      texto: `Produza menos de ${lista(altas.map((a) => `${a.nome} (${Math.round(a.taxa * 100)}% sobrou)`), 2)}.`,
      link: '/producao',
      acao: 'Ver perdas',
      peso: 65,
      gestao: true,
    })
  }

  // 5. Preço defasado (custo acima da meta de CMV) em produto que vende.
  if (gestao) {
    const cmvAlvo = Number(await lerConfig(padariaId, 'cmv_alvo', '35')) / 100
    const custos = await custosDosProdutos(padariaId)
    const [vendidos30] = await pool.query<RowDataPacket[]>(
      `select distinct i.produto_id from vendas_itens i join vendas v on v.id = i.venda_id
       where v.padaria_id = ? and v.status <> 'devolvida' and v.created_at >= ?`,
      [padariaId, new Date(inicio.getTime() - 30 * DIA)],
    )
    const vende = new Set(vendidos30.map((v) => v.produto_id))
    const defasados = custos.filter(
      (p) => p.preco_venda > 0 && p.custo != null && p.custo / p.preco_venda > cmvAlvo && vende.has(p.id),
    )
    if (defasados.length) {
      r.push({
        id: 'precos',
        tom: 'atencao',
        icone: 'tag',
        titulo: plural(defasados.length, 'preço defasado', 'preços defasados'),
        texto: `O custo passou da meta de CMV (${Math.round(cmvAlvo * 100)}%) em ${lista(defasados.map((d) => d.nome))}.`,
        link: '/margens',
        acao: 'Revisar preços',
        peso: 60,
        gestao: true,
      })
    }
  }

  // 6. Ritmo de vendas: hoje até agora × mesmo horário do mesmo dia da semana passada.
  const decorrido = Math.min(agora.getTime(), amanha.getTime()) - inicio.getTime()
  const [[ritmo]] = await pool.query<RowDataPacket[]>(
    `select
       coalesce(sum(case when created_at >= ? and created_at < ? then total end), 0) as hoje,
       coalesce(sum(case when created_at >= ? and created_at < ? then total end), 0) as semana_passada
     from vendas where padaria_id = ? and status <> 'devolvida' and created_at >= ?`,
    [
      inicio,
      agora,
      new Date(inicio.getTime() - 7 * DIA),
      new Date(inicio.getTime() - 7 * DIA + decorrido),
      padariaId,
      new Date(inicio.getTime() - 7 * DIA),
    ],
  )
  const vendidoHoje = Number(ritmo.hoje)
  const passado = Number(ritmo.semana_passada)
  if (gestao && passado > 0 && vendidoHoje > 0) {
    const variacao = (vendidoHoje - passado) / passado
    if (Math.abs(variacao) >= 0.1) {
      r.push({
        id: 'ritmo',
        tom: variacao > 0 ? 'boa' : 'atencao',
        icone: variacao > 0 ? 'up' : 'down',
        titulo:
          variacao > 0
            ? `Vendas ${Math.round(variacao * 100)}% acima da semana passada`
            : `Vendas ${Math.round(-variacao * 100)}% abaixo da semana passada`,
        texto: `Até agora: ${brl(vendidoHoje)} contra ${brl(passado)} no mesmo horário.${variacao < 0 ? ' Vale uma promoção no balcão ou um aviso no WhatsApp.' : ''}`,
        peso: 50,
        gestao: true,
      })
    }
  }

  // 7. Meta do dia da padaria.
  const metas = await lerMetas(padariaId)
  const metaDia = metas.get('geral')?.dia
  if (gestao && metaDia) {
    const falta = metaDia - vendidoHoje
    r.push({
      id: 'meta',
      tom: falta <= 0 ? 'boa' : 'oportunidade',
      icone: 'target',
      titulo: falta <= 0 ? 'Meta do dia batida! 🎉' : `Faltam ${brl(falta)} para a meta do dia`,
      texto:
        falta <= 0
          ? `Já são ${brl(vendidoHoje)} de ${brl(metaDia)}.`
          : `${Math.round((vendidoHoje / metaDia) * 100)}% de ${brl(metaDia)}.`,
      link: '/metas',
      acao: 'Ver metas',
      peso: falta <= 0 ? 40 : 55,
      gestao: true,
    })
  }

  // 8. Contas vencidas e vencendo hoje/amanhã.
  if (gestao) {
    const [contas] = await pool.query<RowDataPacket[]>(
      `select tipo, descricao, valor, data_vencimento from contas_financeiras
       where padaria_id = ? and status = 'pendente' and data_vencimento <= ?
       order by data_vencimento`,
      [padariaId, new Date(amanha.getTime() + 12 * 60 * 60 * 1000).toISOString().slice(0, 10)],
    )
    const pagar = contas.filter((c) => c.tipo === 'pagar')
    if (pagar.length) {
      const vencidas = pagar.filter((c) => String(c.data_vencimento) < dataHoje).length
      r.push({
        id: 'contas',
        tom: vencidas ? 'alerta' : 'atencao',
        icone: 'wallet',
        titulo: vencidas
          ? plural(vencidas, 'conta a pagar vencida', 'contas a pagar vencidas')
          : `${plural(pagar.length, 'conta vence', 'contas vencem')} até amanhã`,
        texto: `${lista(pagar.map((c) => c.descricao))} — total ${brl(pagar.reduce((s, c) => s + Number(c.valor), 0))}.`,
        link: '/financeiro',
        acao: 'Abrir financeiro',
        peso: vencidas ? 85 : 58,
        gestao: true,
      })
    }

    // 9. Caixa esquecido aberto desde um dia anterior.
    const [esquecidos] = await pool.query<RowDataPacket[]>(
      `select u.nome from caixas c join usuarios u on u.id = c.operador_id
       where c.padaria_id = ? and c.fechado_em is null and c.aberto_em < ?`,
      [padariaId, inicio],
    )
    if (esquecidos.length) {
      r.push({
        id: 'caixa',
        tom: 'alerta',
        icone: 'lock',
        titulo: 'Caixa esquecido aberto',
        texto: `${lista(esquecidos.map((e) => e.nome))} não fechou o caixa de um dia anterior. Confira a gaveta.`,
        link: '/caixa',
        acao: 'Ver caixas',
        peso: 75,
        gestao: true,
      })
    }

    // 10. Horário de pico das últimas 4 semanas neste dia da semana.
    const [horas] = await pool.query<RowDataPacket[]>(
      // epoch = instante real em segundos (sem fuso); 1/1/1970 foi quinta-feira.
      `select floor(mod((extract(epoch from created_at) - ?)::numeric, 86400) / 3600) as hora, count(*) as vendas
       from vendas where padaria_id = ? and status <> 'devolvida'
         and created_at >= ? and created_at < ?
         and mod((floor((extract(epoch from created_at) - ?) / 86400) + 3)::numeric, 7) = ?
       group by hora order by vendas desc limit 1`,
      [tz * 60, padariaId, new Date(inicio.getTime() - 28 * DIA), inicio, tz * 60, (new Date(inicio.getTime() + 12 * 3600e3).getUTCDay() + 6) % 7],
    )
    if (horas[0] && Number(horas[0].vendas) >= 5) {
      const h = Number(horas[0].hora)
      r.push({
        id: 'pico',
        tom: 'oportunidade',
        icone: 'clock',
        titulo: `Pico de movimento às ${h}h`,
        texto: `É o horário que mais vende neste dia da semana. Reforce o balcão e tenha pão quentinho saindo perto das ${h}h.`,
        peso: 35,
        gestao: true,
      })
    }

    // 11. Campeão de vendas da semana e produto parado com estoque.
    const [campeao] = await pool.query<RowDataPacket[]>(
      `select p.nome, sum(i.subtotal) as total from vendas_itens i
       join vendas v on v.id = i.venda_id join produtos p on p.id = i.produto_id
       where v.padaria_id = ? and v.status <> 'devolvida' and v.created_at >= ?
       group by p.id, p.nome order by total desc limit 1`,
      [padariaId, new Date(inicio.getTime() - 7 * DIA)],
    )
    if (campeao[0]) {
      r.push({
        id: 'campeao',
        tom: 'boa',
        icone: 'trophy',
        titulo: `${campeao[0].nome} é o campeão da semana`,
        texto: `${brl(Number(campeao[0].total))} em 7 dias. Deixe sempre em destaque na vitrine e não deixe faltar.`,
        peso: 30,
        gestao: true,
      })
    }
    const [parados] = await pool.query<RowDataPacket[]>(
      `select p.nome from produtos p
       where p.padaria_id = ? and p.ativo = true and p.preco_venda > 0 and p.estoque_atual > 0
         and p.created_at < ?
         and not exists (select 1 from vendas_itens i join vendas v on v.id = i.venda_id
                         where i.produto_id = p.id and v.status <> 'devolvida' and v.created_at >= ?)`,
      [padariaId, new Date(inicio.getTime() - 14 * DIA), new Date(inicio.getTime() - 14 * DIA)],
    )
    if (parados.length) {
      r.push({
        id: 'parados',
        tom: 'atencao',
        icone: 'pause',
        titulo: `${plural(parados.length, 'produto', 'produtos')} sem venda há 14 dias`,
        texto: `${lista(parados.map((p) => p.nome))} têm estoque parado. Faça uma promoção ou pare de produzir.`,
        link: '/produtos',
        acao: 'Ver produtos',
        peso: 25,
        gestao: true,
      })
    }
  }

  res.json(
    r
      .filter((x) => gestao || !x.gestao)
      .sort((a, b) => b.peso - a.peso)
      .map(({ peso: _p, gestao: _g, ...x }) => x),
  )
})
