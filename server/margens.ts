// Margem e CMV: custo real de cada produto (pela ficha técnica, quando existe), margem,
// lucro bruto do período e preço sugerido para a meta de CMV da padaria.
import { Router } from 'express'
import type { RowDataPacket } from './db.ts'
import { z } from 'zod'
import { exigirPapel } from './auth.ts'
import { lerConfig, pool, salvarConfig } from './db.ts'
import { validar } from './http.ts'

export const margensRouter = Router()
margensRouter.use(exigirPapel('dono', 'admin'))

// Referência de mercado para padaria com produção própria: CMV entre 35% e 42%.
const CMV_PADRAO = 35

const centavos = (v: number) => Math.round(v * 100) / 100

// Custo unitário de cada produto da padaria: ficha técnica (ingredientes ÷ rendimento) ou cadastro.
export async function custosDosProdutos(padariaId: string) {
  // Produtos e fichas técnicas ao mesmo tempo.
  const [[produtos], [fichas]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `select id, nome, categoria, unidade, preco_venda, preco_custo
       from produtos where padaria_id = ? and ativo = true order by nome`,
      [padariaId],
    ),
    pool.query<RowDataPacket[]>(
      `select r.produto_id, r.rendimento,
              sum(i.quantidade * coalesce(ing.preco_custo, 0)) as custo_receita,
              count(*) filter (where ing.preco_custo is null) as sem_custo
       from receitas r
       join receita_itens i on i.receita_id = r.id
       join produtos ing on ing.id = i.ingrediente_id
       where r.padaria_id = ?
         and r.id = (select r2.id from receitas r2 where r2.produto_id = r.produto_id
                     order by r2.created_at limit 1)
       group by r.id, r.produto_id, r.rendimento`,
      [padariaId],
    ),
  ])
  const porProduto = new Map(fichas.map((f) => [f.produto_id, f]))
  return produtos.map((p) => {
    const ficha = porProduto.get(p.id)
    const custoFicha = ficha ? Number(ficha.custo_receita) / Number(ficha.rendimento) : null
    const custo = custoFicha ?? (p.preco_custo == null ? null : Number(p.preco_custo))
    return {
      id: p.id as string,
      nome: p.nome as string,
      categoria: p.categoria as string | null,
      unidade: p.unidade as string,
      preco_venda: Number(p.preco_venda),
      preco_custo: p.preco_custo == null ? null : Number(p.preco_custo),
      custo: custo == null ? null : Math.round(custo * 10000) / 10000,
      origem:
        custoFicha != null ? ('receita' as const) : custo != null ? ('cadastro' as const) : null,
      // Ficha com ingrediente sem custo cadastrado: o custo calculado fica por baixo.
      ficha_incompleta: Boolean(ficha && Number(ficha.sem_custo) > 0),
    }
  })
}

margensRouter.get('/', async (req, res) => {
  const q = validar(
    z.object({ desde: z.coerce.date('Data inválida'), ate: z.coerce.date('Data inválida') }),
    req.query,
  )
  const padariaId: string = res.locals.padariaId
  // Meta de CMV, custos e vendas ao mesmo tempo.
  const [cmvTexto, custos, [vendidos]] = await Promise.all([
    lerConfig(padariaId, 'cmv_alvo', String(CMV_PADRAO)),
    custosDosProdutos(padariaId),
    pool.query<RowDataPacket[]>(
      `select i.produto_id, sum(i.quantidade) as quantidade, sum(i.subtotal) as faturamento
       from vendas_itens i join vendas v on v.id = i.venda_id
       where v.padaria_id = ? and v.status <> 'devolvida' and v.created_at >= ? and v.created_at < ?
       group by i.produto_id`,
      [padariaId, q.desde, q.ate],
    ),
  ])
  const cmvAlvo = Number(cmvTexto)
  const vendaPor = new Map(vendidos.map((v) => [v.produto_id, v]))

  let faturamento = 0
  let custoTotal = 0
  let semCusto = 0
  const produtos = custos
    // Insumos (preço de venda zero) não entram na análise de margem.
    .filter((p) => p.preco_venda > 0)
    .map((p) => {
      const v = vendaPor.get(p.id)
      const quantidade = v ? Number(v.quantidade) : 0
      const fat = v ? Number(v.faturamento) : 0
      const custoVendido = p.custo == null ? null : p.custo * quantidade
      faturamento += fat
      if (custoVendido != null) custoTotal += custoVendido
      else if (fat > 0) semCusto += fat
      const margem = p.custo == null ? null : (p.preco_venda - p.custo) / p.preco_venda
      return {
        ...p,
        margem,
        cmv: p.custo == null ? null : p.custo / p.preco_venda,
        vendido: quantidade,
        faturamento: centavos(fat),
        lucro_bruto: custoVendido == null ? null : centavos(fat - custoVendido),
        // Preço para o custo ficar dentro da meta de CMV.
        preco_sugerido: p.custo == null ? null : centavos(p.custo / (cmvAlvo / 100)),
        acima_da_meta: p.custo != null && p.custo / p.preco_venda > cmvAlvo / 100 + 0.0001,
      }
    })
  const comCusto = faturamento - semCusto
  res.json({
    cmv_alvo: cmvAlvo,
    resumo: {
      faturamento: centavos(faturamento),
      custo: centavos(custoTotal),
      lucro_bruto: centavos(comCusto - custoTotal),
      // CMV só sobre o que tem custo conhecido.
      cmv: comCusto > 0 ? custoTotal / comCusto : null,
      faturamento_sem_custo: centavos(semCusto),
    },
    produtos,
  })
})

margensRouter.put('/alvo', exigirPapel('dono'), async (req, res) => {
  const { cmv_alvo } = validar(
    z.object({ cmv_alvo: z.number().min(5, 'Meta muito baixa').max(90, 'Meta muito alta') }),
    req.body,
  )
  await salvarConfig(res.locals.padariaId, 'cmv_alvo', String(cmv_alvo))
  res.json({ cmv_alvo })
})
