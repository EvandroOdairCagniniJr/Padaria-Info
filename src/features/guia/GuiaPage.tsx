import {
  ArrowRight,
  Banknote,
  BarChart3,
  CalendarClock,
  Check,
  ChefHat,
  ChevronDown,
  CircleHelp,
  HeartHandshake,
  KeyRound,
  Lightbulb,
  Package,
  Percent,
  Receipt,
  Search,
  ShoppingCart,
  Store,
  Tag,
  Target,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/AuthContext'
import { usePadaria } from '@/features/padaria/api'
import { VideoApresentacao } from '@/features/guia/VideoApresentacao'
import { mascaraTelefone } from '@/lib/documentos'
import { papelLabels } from '@/lib/permissoes'
import { cn } from '@/lib/utils'
import type { Papel } from '@/types/database'

type Categoria = 'balcao' | 'producao' | 'gestao' | 'conta'

const categorias: Record<Categoria, string> = {
  balcao: 'Balcão',
  producao: 'Produção e estoque',
  gestao: 'Gestão',
  conta: 'Conta e equipe',
}

type Publico = 'equipe' | 'gestao'

interface Guia {
  id: string
  // Para quem é o guia: a equipe do dia a dia ou quem administra (dono e gerente).
  publico: Publico
  categoria: Categoria
  titulo: string
  resumo: string
  icone: LucideIcon
  link?: { to: string; label: string }
  papeis: Papel[]
  passos: string[]
  dicas: string[]
}

const todos: Papel[] = ['dono', 'admin', 'funcionario']
const gestao: Papel[] = ['dono', 'admin']

const guias: Guia[] = [
  {
    id: 'primeiro-dia',
    publico: 'equipe',
    categoria: 'conta',
    titulo: 'Primeiro dia: entrando no sistema',
    resumo: 'Entrar, conferir sua conta e sair com segurança.',
    icone: KeyRound,
    papeis: todos,
    passos: [
      'Entre com o e-mail e a senha que o responsável pela padaria passou para você.',
      'Ainda não tem conta? Na tela de login, use "Criar conta", informe o código da padaria e aguarde o responsável liberar seu acesso.',
      'Confira no canto de baixo do menu se o nome e o papel são os seus.',
      'O menu da esquerda mostra só o que faz parte do seu trabalho.',
      'No fim do turno, clique em "Sair", principalmente em computador compartilhado.',
    ],
    dicas: [
      'Tudo o que você registra (vendas, estoque, produção) fica no seu nome. Não use a conta de outra pessoa, nem empreste a sua.',
      'Clique no seu nome, embaixo do menu, para trocar a foto, o nome e a senha.',
    ],
  },
  {
    id: 'pdv',
    publico: 'equipe',
    categoria: 'balcao',
    titulo: 'Vendendo no balcão (PDV)',
    resumo: 'Montar o pedido, cobrar e mandar o comprovante.',
    icone: ShoppingCart,
    link: { to: '/pdv', label: 'Abrir o PDV' },
    papeis: todos,
    passos: [
      'Digite o nome do produto na busca. Apertar Enter já adiciona o primeiro resultado.',
      'Ou toque no produto. Tocar de novo soma mais uma unidade. Produtos com variedades (como "Café") abrem as opções.',
      'No pedido, use − e + para ajustar a quantidade, ou a lixeira para tirar o item.',
      'Escolha a forma de pagamento. Em dinheiro, informe o valor recebido e o troco aparece sozinho.',
      'Confira o total com o cliente e clique em "Finalizar venda" (ou aperte F2).',
      'Quer mandar o comprovante? Digite o WhatsApp do cliente (com DDD) e toque em "Enviar". Também dá para baixar a imagem ou o PDF.',
    ],
    dicas: [
      'Promoções ativas entram sozinhas no pedido: não precisa calcular nada.',
      'Desconto manual: o funcionário pode dar até 10%. Mais que isso, só o gerente ou o dono.',
      'O estoque aparece embaixo do preço. Em vermelho, acabou ou está negativo: avise quem cuida do estoque.',
      'Preço errado? Avise o gerente em vez de "compensar" no troco.',
    ],
  },
  {
    id: 'caixa',
    publico: 'equipe',
    categoria: 'balcao',
    titulo: 'Abrindo e fechando o caixa',
    resumo: 'Fundo de troco, sangria, suprimento e conferência.',
    icone: Banknote,
    link: { to: '/caixa', label: 'Abrir o Caixa' },
    papeis: todos,
    passos: [
      'No começo do turno, abra o Caixa e informe o fundo de troco (o dinheiro que já está na gaveta).',
      'Tirou dinheiro da gaveta (cofre, pagar um fornecedor)? Registre uma "Sangria" com o motivo.',
      'Colocou dinheiro para troco? Registre um "Suprimento".',
      'No fim do turno, clique em "Fechar caixa" e conte as notas e as moedas: o sistema mostra na hora se bateu, sobrou ou faltou.',
    ],
    dicas: [
      'Cada pessoa abre e fecha o próprio caixa. As vendas entram no caixa de quem está logado.',
      'Diferença pequena e frequente costuma ser troco errado: confira com calma antes de entregar.',
    ],
  },
  {
    id: 'vendas',
    publico: 'equipe',
    categoria: 'balcao',
    titulo: 'Vendas anteriores, 2ª via e devoluções',
    resumo: 'Achar uma venda, reenviar o comprovante ou desfazer.',
    icone: Receipt,
    link: { to: '/vendas', label: 'Abrir Vendas' },
    papeis: todos,
    passos: [
      'Em Vendas, busque pelo número do comprovante, pelo produto ou por quem vendeu.',
      'Abra a venda para ver os itens e mandar a 2ª via do comprovante (WhatsApp, imagem ou PDF).',
      'Venda errada ou cliente desistiu: o gerente ou o dono abre a venda e clica em "Devolver", com o motivo.',
    ],
    dicas: [
      'Na devolução, o estoque volta sozinho e a venda sai de todos os totais.',
      'Depois de devolver, é só fazer a venda certa de novo no PDV.',
    ],
  },
  {
    id: 'encomendas',
    publico: 'equipe',
    categoria: 'balcao',
    titulo: 'Encomendas (bolos e pedidos de festa)',
    resumo: 'Anotar, cobrar o sinal e entregar no dia certo.',
    icone: CalendarClock,
    link: { to: '/encomendas', label: 'Abrir Encomendas' },
    papeis: todos,
    passos: [
      'Clique em "Nova encomenda": cliente, WhatsApp, dia e hora, retirada ou entrega.',
      'Adicione os itens. O preço do cadastro vem sugerido, mas pode ser ajustado ao combinado.',
      'Escreva os detalhes, como a frase do bolo ou restrições ("sem lactose").',
      'Recebeu sinal? Informe o valor (o botão "50%" calcula metade) e a forma de pagamento.',
      'Acompanhe pelos botões: Confirmar → Iniciar produção → Marcar pronta.',
      'Na retirada, clique em "Entregar": o sistema cobra só o que falta e registra a venda.',
    ],
    dicas: [
      'Use "Enviar confirmação" e "Avisar que está pronta" para mandar a mensagem pronta no WhatsApp do cliente.',
      'Encomendas atrasadas aparecem no topo, em vermelho.',
    ],
  },
  {
    id: 'metas',
    publico: 'equipe',
    categoria: 'balcao',
    titulo: 'Metas de vendas',
    resumo: 'Quanto já vendeu e quanto falta no dia, semana e mês.',
    icone: Target,
    link: { to: '/metas', label: 'Abrir Metas' },
    papeis: todos,
    passos: [
      'Em Metas você acompanha quanto já vendeu hoje, na semana e no mês, e quanto falta.',
      'Dono: clique em "Definir metas" e escolha de quem é a meta: a padaria toda, o padrão de cada pessoa ou uma pessoa específica.',
      'Preencha o valor do dia e use "Preencher semana e mês a partir do dia" para o sistema fazer a conta. Depois ajuste se quiser.',
    ],
    dicas: [
      'A semana nunca pode ter meta menor que o dia, nem o mês menor que a semana: o sistema avisa na hora.',
      'Na semana e no mês aparece a projeção "no ritmo atual": dá para saber cedo se vai bater.',
    ],
  },
  {
    id: 'estoque',
    publico: 'equipe',
    categoria: 'producao',
    titulo: 'Recebendo mercadoria (Estoque)',
    resumo: 'Entradas, contagens e ajustes do estoque.',
    icone: Warehouse,
    link: { to: '/estoque', label: 'Abrir Estoque' },
    papeis: todos,
    passos: [
      'Chegou mercadoria: em Estoque, clique em "Ajustar" no produto e escolha "Entrada" com a quantidade recebida.',
      'Contagem do estoque: use "Ajuste" e informe o total que você contou na prateleira.',
      'Sobra, vencido ou queimado: registre em Produção → Perdas.',
    ],
    dicas: [
      'Estoque negativo quer dizer que saiu mais do que entrou no sistema: lance a entrada que faltou ou faça um ajuste.',
      'Vendas e produções já mexem no estoque sozinhas. Não lance de novo.',
      'Preencha sempre o motivo nas saídas: ajuda o dono a entender as perdas.',
    ],
  },
  {
    id: 'sugestao',
    publico: 'equipe',
    categoria: 'producao',
    titulo: 'Quanto produzir e as perdas do dia',
    resumo: 'A sugestão de fornadas e por que registrar as sobras.',
    icone: ChefHat,
    link: { to: '/producao', label: 'Abrir Produção' },
    papeis: todos,
    passos: [
      'Em Produção → Sugestão do dia, veja quanto produzir de cada item hoje ou amanhã.',
      'A conta usa as vendas das últimas 4 semanas no mesmo dia da semana e as sobras registradas, e já desconta o estoque.',
      'Clique em "Planejar" (ou "Planejar todas as fornadas") para mandar direto para o planejamento.',
      'No fechamento, em Produção → Perdas, registre o que sobrou, venceu ou queimou.',
    ],
    dicas: [
      'Quase nunca sobra? O sistema sugere um pouco a mais: provavelmente estava faltando.',
      'Registrar as sobras todo dia é o segredo de uma sugestão certeira.',
    ],
  },
  {
    id: 'producao',
    publico: 'equipe',
    categoria: 'producao',
    titulo: 'Produção do dia e fichas técnicas',
    resumo: 'Planejar e concluir fornadas com as receitas.',
    icone: ChefHat,
    link: { to: '/producao', label: 'Abrir Produção' },
    papeis: todos,
    passos: [
      'Em Produção → Planejamento, veja o que precisa ser feito hoje.',
      'Para planejar uma fornada: "Planejar produção", escolha a receita e a data.',
      'Quando a fornada estiver pronta: no menu ⋯ da linha, clique em "Concluir produção". O sistema dá baixa nos ingredientes e soma o produto pronto no estoque.',
      'Gerente ou dono: em Receitas, cadastre a ficha técnica (produto final, rendimento e ingredientes).',
    ],
    dicas: [
      'Conclua só quando a fornada estiver realmente pronta: não dá para desfazer.',
      'Com as fichas certas, o custo de cada produto aparece sozinho em Margens e CMV.',
    ],
  },
  {
    id: 'produtos',
    publico: 'gestao',
    categoria: 'gestao',
    titulo: 'Cadastrando produtos e preços',
    resumo: 'Produtos, variedades, ingredientes e estoque mínimo.',
    icone: Package,
    link: { to: '/produtos', label: 'Abrir Produtos' },
    papeis: gestao,
    passos: [
      'Em Produtos, clique em "Novo produto".',
      'Preencha nome, unidade (un, kg...) e preço de venda. O preço de custo é opcional, mas mostra a margem.',
      'Defina o estoque mínimo: abaixo disso o produto aparece em alerta no Dashboard e no Estoque.',
      'Variedades: produtos com o mesmo "Variedade de" (ex.: Café → Coado, Cappuccino) viram um cartão só no PDV, com as opções.',
      'Ingredientes (farinha, fermento...) também são produtos: cadastre-os para usar nas receitas.',
    ],
    dicas: [
      'Mudar o preço vale para as próximas vendas; as antigas mantêm o preço da época.',
      'Remover um produto só o esconde: o histórico de vendas continua intacto.',
    ],
  },
  {
    id: 'promocoes',
    publico: 'gestao',
    categoria: 'gestao',
    titulo: 'Promoções automáticas',
    resumo: 'Descontos que o PDV aplica sozinho, no dia e horário certos.',
    icone: Tag,
    link: { to: '/promocoes', label: 'Abrir Promoções' },
    papeis: gestao,
    passos: [
      'Em Promoções, clique em "Nova promoção" e dê um nome que o cliente entenda (ex.: "Café da manhã").',
      'Escolha o tipo: porcentagem, valor em reais, preço fixo ou leve X pague Y.',
      'Diga a quais produtos ou categorias ela vale, ou se vale para tudo.',
      'Se quiser, limite o período, os dias da semana e o horário (ex.: dias úteis, das 6h às 9h).',
    ],
    dicas: [
      'O nome da promoção aparece no comprovante, junto com quanto o cliente economizou.',
      'Desative em vez de apagar uma promoção sazonal: no ano seguinte é só ligar de novo.',
    ],
  },
  {
    id: 'analise',
    publico: 'gestao',
    categoria: 'gestao',
    titulo: 'Análise de vendas',
    resumo: 'Os mais vendidos, os horários fortes e os combos.',
    icone: BarChart3,
    link: { to: '/analise', label: 'Abrir Análise' },
    papeis: gestao,
    passos: [
      'Escolha o período: dia, semana ou mês. Tudo é comparado com o período anterior.',
      'Veja o faturamento, o ticket médio, os produtos que mais venderam e os que caíram.',
      'Confira os horários mais fortes e os produtos que saem juntos: são boas ideias de combo.',
    ],
    dicas: [
      'Use os horários fortes para planejar fornadas e escala de equipe.',
      'Produto caindo toda semana? Teste uma promoção ou reduza a produção.',
    ],
  },
  {
    id: 'margens',
    publico: 'gestao',
    categoria: 'gestao',
    titulo: 'Margens, CMV e preço certo',
    resumo: 'Quanto cada produto realmente dá de lucro.',
    icone: Percent,
    link: { to: '/margens', label: 'Abrir Margens e CMV' },
    papeis: gestao,
    passos: [
      'Em Margens e CMV, veja faturamento, custo dos produtos vendidos, lucro bruto e CMV do período.',
      'O custo vem da ficha técnica (ingredientes ÷ rendimento) ou do custo cadastrado no produto.',
      'Produtos com custo acima da meta ficam em vermelho, com o preço sugerido: "Usar R$ X" aplica na hora.',
    ],
    dicas: [
      'Mantenha o custo dos ingredientes atualizado a cada compra: a margem de todos os produtos se ajusta sozinha.',
      'Referência de mercado: padaria com produção própria trabalha com CMV entre 35% e 42%.',
    ],
  },
  {
    id: 'financeiro',
    publico: 'gestao',
    categoria: 'gestao',
    titulo: 'Contas a pagar e a receber',
    resumo: 'Boletos, fornecedores e vendas a prazo.',
    icone: Wallet,
    link: { to: '/financeiro', label: 'Abrir Financeiro' },
    papeis: gestao,
    passos: [
      'Lance cada boleto, fornecedor ou aluguel em "Novo lançamento" → Conta a pagar.',
      'Vendas a prazo e valores a receber vão em Conta a receber.',
      'Quando pagar ou receber, use o menu ⋯ → "Marcar como pago".',
    ],
    dicas: ['O Dashboard avisa as contas que vencem nos próximos 7 dias e as atrasadas.'],
  },
  {
    id: 'minha-padaria',
    publico: 'gestao',
    categoria: 'conta',
    titulo: 'Minha padaria: logo e comprovante',
    resumo: 'Os dados da empresa, a logo e o comprovante do seu jeito.',
    icone: Store,
    link: { to: '/padaria', label: 'Abrir Minha padaria' },
    papeis: ['dono'],
    passos: [
      'Preencha nome, CNPJ, endereço, telefone, WhatsApp, Instagram e horário: eles vão para o comprovante.',
      'Envie a logo: ela aparece no menu, no comprovante e no ícone da aba do navegador.',
      'Em "Personalizar comprovante", escolha a cor do cabeçalho, o título, um recado extra (ex.: senha do Wi-Fi) e o que aparece ou não.',
      'Confira na prévia ao lado e clique em "Salvar".',
    ],
    dicas: ['A prévia mostra uma venda de exemplo completa: o cupom real sai igual.'],
  },
  {
    id: 'equipe',
    publico: 'gestao',
    categoria: 'conta',
    titulo: 'Coordenando a equipe',
    resumo: 'Convidar, liberar acesso e acompanhar cada pessoa.',
    icone: Users,
    link: { to: '/equipe', label: 'Abrir Equipe' },
    papeis: ['dono'],
    passos: [
      'Convide a equipe: mostre o código de convite que aparece em Equipe. A pessoa cria a conta e você libera o acesso.',
      'Ou cadastre direto: em Equipe, clique em "Novo membro", preencha nome, e-mail e uma senha inicial, e escolha o papel.',
      'Funcionário: PDV, caixa, estoque, produção e encomendas. Gerente: toda a operação, menos a página Equipe.',
      'Acompanhe por período quanto cada um vendeu, as produções e os ajustes de estoque, e veja a linha do tempo de cada pessoa.',
    ],
    dicas: [
      'Quando alguém sair da padaria, use "Desativar acesso": a pessoa perde o acesso na hora e o histórico continua.',
      'Senha esquecida? Em Equipe, "Editar / redefinir senha" e passe a nova para a pessoa.',
      'Mostre este Guia (e o vídeo) a cada pessoa no primeiro dia.',
    ],
  },
]

const duvidas: { pergunta: string; resposta: string; papeis: Papel[] }[] = [
  {
    pergunta: 'Registrei uma venda errada. E agora?',
    resposta:
      'Não se preocupe: chame o gerente ou o dono. Em Vendas, ele abre a venda e clica em "Devolver" (o estoque volta sozinho). Depois é só fazer a venda certa no PDV.',
    papeis: todos,
  },
  {
    pergunta: 'Esqueci de abrir o caixa e já vendi.',
    resposta:
      'Abra o caixa agora: as próximas vendas entram nele. Avise o gerente sobre as vendas de antes, para a conferência do fim do dia bater.',
    papeis: todos,
  },
  {
    pergunta: 'A internet caiu no meio de uma venda.',
    resposta:
      'Espere voltar e confira em Vendas se a venda entrou antes de fazer de novo. Assim o cliente não é cobrado duas vezes.',
    papeis: todos,
  },
  {
    pergunta: 'O estoque de um produto ficou negativo.',
    resposta:
      'Saiu mais do que foi lançado de entrada. Em Estoque, lance a entrada que faltou ou faça um ajuste com a quantidade contada na prateleira.',
    papeis: todos,
  },
  {
    pergunta: 'Esqueci minha senha.',
    resposta:
      'Na tela de login, use "Esqueci minha senha": chega um código no seu e-mail. Se o e-mail não chegar, peça ao dono para criar uma senha nova em Equipe.',
    papeis: todos,
  },
  {
    pergunta: 'O cliente pediu o comprovante depois.',
    resposta: 'Em Vendas, abra a venda e mande a 2ª via pelo WhatsApp, ou baixe a imagem ou o PDF.',
    papeis: todos,
  },
  {
    pergunta: 'Posso usar no celular ou no tablet?',
    resposta:
      'Pode. O Coffee Break funciona no navegador de qualquer computador, tablet ou celular: é só entrar com seu e-mail e senha.',
    papeis: todos,
  },
  {
    pergunta: 'Alguém viu minha senha ou esqueci a conta aberta em outro aparelho.',
    resposta:
      'Clique no seu nome, embaixo do menu, troque a senha e use "Sair de todos os aparelhos". Os outros logins caem na hora.',
    papeis: todos,
  },
]

// "Já aprendi": cada pessoa marca no próprio aparelho. Falhar em ler/gravar não atrapalha o guia.
function useAprendidos(usuarioId: string | undefined) {
  const chave = `coffee-break:guia-aprendidos:${usuarioId ?? 'anonimo'}`
  const [aprendidos, setAprendidos] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(chave) ?? '[]') as string[])
    } catch {
      return new Set()
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(chave, JSON.stringify([...aprendidos]))
    } catch {
      // Sem armazenamento (aba anônima): a marcação vale só nesta visita.
    }
  }, [chave, aprendidos])
  const alternar = (id: string) =>
    setAprendidos((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  return { aprendidos, alternar }
}

const semAcento = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function GuiaPage() {
  const { user } = useAuth()
  const papel = user?.papel ?? 'funcionario'
  const primeiroNome = user?.nome?.split(' ')[0] ?? ''
  const padaria = usePadaria().data
  const { aprendidos, alternar } = useAprendidos(user?.id)
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState<Categoria | 'todas'>('todas')
  const [aberto, setAberto] = useState<string | null>(null)
  // Dono e gerente escolhem entre os guias deles e os da equipe; o funcionário vê só os da equipe.
  const gestor = papel !== 'funcionario'
  const [publico, setPublico] = useState<Publico>(gestor ? 'gestao' : 'equipe')

  const doPapel = useMemo(
    () => guias.filter((g) => g.papeis.includes(papel) && g.publico === publico),
    [papel, publico],
  )
  const proximo = doPapel.find((g) => !aprendidos.has(g.id))
  const feitos = doPapel.filter((g) => aprendidos.has(g.id)).length
  const pct = doPapel.length ? Math.round((feitos / doPapel.length) * 100) : 0

  const termo = semAcento(busca.trim())
  const visiveis = doPapel.filter(
    (g) =>
      (categoria === 'todas' || g.categoria === categoria) &&
      (!termo || semAcento([g.titulo, g.resumo, ...g.passos, ...g.dicas].join(' ')).includes(termo)),
  )
  const duvidasVisiveis = duvidas.filter(
    (d) => d.papeis.includes(papel) && (!termo || semAcento(d.pergunta + ' ' + d.resposta).includes(termo)),
  )
  const categoriasDoPapel = (Object.keys(categorias) as Categoria[]).filter((c) =>
    doPapel.some((g) => g.categoria === c),
  )

  const contato = padaria?.whatsapp || padaria?.telefone

  return (
    <div className="max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {primeiroNome ? `Olá, ${primeiroNome}! Vamos aprender juntos?` : 'Guia e dicas'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Tudo o que você precisa para o dia a dia como {papelLabels[papel].toLowerCase()}, no seu
          ritmo. Ninguém nasce sabendo: volte aqui sempre que tiver dúvida.
        </p>
      </header>

      {gestor && (
        <div className="grid gap-2 rounded-xl border bg-card p-1.5 shadow-sm sm:grid-cols-2" role="tablist">
          {(
            [
              ['gestao', 'Para donos e gerentes', 'Produtos, preços, promoções, números e equipe'],
              ['equipe', 'Para a equipe da padaria', 'Balcão, caixa, encomendas, estoque e produção'],
            ] as const
          ).map(([valor, titulo, sub]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={publico === valor}
              onClick={() => {
                setPublico(valor)
                setCategoria('todas')
                setAberto(null)
              }}
              className={cn(
                'rounded-lg px-4 py-2.5 text-left transition-colors',
                publico === valor ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted/60',
              )}
            >
              <span className="block text-sm font-semibold">{titulo}</span>
              <span className={cn('block text-xs', publico === valor ? 'opacity-85' : 'text-muted-foreground')}>
                {sub}
              </span>
            </button>
          ))}
        </div>
      )}

      <VideoApresentacao publico={publico} />

      {/* Progresso e próximo passo sugerido */}
      <section className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5 shadow-sm">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium">
            {feitos === doPapel.length
              ? 'Você já viu todos os guias. Parabéns!'
              : `Você já aprendeu ${feitos} de ${doPapel.length} guias`}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {proximo && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setBusca('')
              setCategoria('todas')
              setAberto(proximo.id)
              document.getElementById(`guia-${proximo.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            Próximo: {proximo.titulo.split(':')[0]}
            <ArrowRight className="size-4" />
          </Button>
        )}
      </section>

      {/* Busca e categorias */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="guia-busca"
            value={busca}
            onChange={(e) => {
              const texto = e.target.value
              setBusca(texto)
              // Ao procurar, o primeiro guia encontrado já abre; os outros abrem e fecham no clique.
              const t = semAcento(texto.trim())
              const primeiro = t
                ? doPapel.find(
                    (g) =>
                      (categoria === 'todas' || g.categoria === categoria) &&
                      semAcento([g.titulo, g.resumo, ...g.passos, ...g.dicas].join(' ')).includes(t),
                  )
                : undefined
              setAberto(primeiro?.id ?? null)
            }}
            placeholder='Procure uma dúvida: "troco", "senha", "bolo", "promoção"...'
            className="pl-9"
            aria-label="Procurar no guia"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['todas', ...categoriasDoPapel] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                categoria === c
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card hover:border-primary/60',
              )}
            >
              {c === 'todas' ? 'Todos' : categorias[c]}
            </button>
          ))}
        </div>
      </div>

      {/* Guias em sanfona */}
      <div className="space-y-3">
        {visiveis.length === 0 && duvidasVisiveis.length === 0 && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nada encontrado para "{busca}". Tente outra palavra ou pergunte ao responsável pela padaria.
          </p>
        )}
        {visiveis.map((guia) => {
          const estaAberto = aberto === guia.id
          const aprendeu = aprendidos.has(guia.id)
          return (
            <article
              key={guia.id}
              id={`guia-${guia.id}`}
              className={cn(
                'scroll-mt-4 overflow-hidden rounded-xl border bg-card shadow-sm transition-colors',
                estaAberto && 'border-primary/40',
              )}
            >
              <button
                type="button"
                onClick={() => setAberto(estaAberto ? null : guia.id)}
                aria-expanded={estaAberto}
                className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/40"
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg',
                    aprendeu ? 'bg-emerald-100 text-emerald-700' : 'bg-secondary text-primary',
                  )}
                >
                  {aprendeu ? <Check className="size-4" /> : <guia.icone className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {guia.titulo}
                    {guia.papeis.length < todos.length && (
                      <Badge variant="outline" className="font-normal">
                        {guia.papeis.map((p) => papelLabels[p]).join(' e ')}
                      </Badge>
                    )}
                  </span>
                  <span className="block text-sm text-muted-foreground">{guia.resumo}</span>
                </span>
                <ChevronDown
                  className={cn('size-4 shrink-0 text-muted-foreground transition-transform', estaAberto && 'rotate-180')}
                />
              </button>
              {estaAberto && (
                <div className="space-y-4 border-t px-4 pt-4 pb-4 text-sm sm:px-5">
                  <ol className="space-y-2">
                    {guia.passos.map((passo, i) => (
                      <li key={passo} className="flex gap-3">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {i + 1}
                        </span>
                        <span className="pt-0.5">{passo}</span>
                      </li>
                    ))}
                  </ol>
                  <ul className="space-y-1.5 rounded-lg bg-muted/50 p-3">
                    {guia.dicas.map((dica) => (
                      <li key={dica} className="flex gap-2 text-muted-foreground">
                        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                        {dica}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center gap-2">
                    {guia.link && (
                      <Button asChild size="sm">
                        <Link to={guia.link.to}>
                          {guia.link.label}
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant={aprendeu ? 'secondary' : 'outline'}
                      onClick={() => {
                        alternar(guia.id)
                        if (!aprendeu) setAberto(null)
                      }}
                    >
                      <Check className="size-4" />
                      {aprendeu ? 'Aprendido (desmarcar)' : 'Já aprendi'}
                    </Button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {/* Dúvidas comuns */}
      {duvidasVisiveis.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
            <CircleHelp className="size-5 text-primary" />
            Dúvidas comuns
          </h2>
          <div className="divide-y rounded-xl border bg-card shadow-sm">
            {duvidasVisiveis.map((d) => (
              <details key={d.pergunta} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                  {d.pergunta}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{d.resposta}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Precisa de ajuda? */}
      <section className="flex flex-wrap items-start gap-4 rounded-xl border bg-secondary/60 p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-sm">
          <HeartHandshake className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <h2 className="font-heading text-lg font-semibold">Precisa de ajuda?</h2>
          {papel === 'dono' ? (
            <p className="text-muted-foreground">
              Mostre este guia e o vídeo para cada pessoa da equipe no primeiro dia: começar sabendo
              o caminho evita erro no caixa e no estoque. Algo deu errado? A mensagem aparece no
              canto da tela: tire um print para não perder os detalhes.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Ficou com dúvida ou algo deu errado? Fale com o responsável pela padaria
              {contato ? (
                <>
                  {' '}
                  pelo número <strong className="text-foreground">{mascaraTelefone(contato)}</strong>
                </>
              ) : null}
              . Se aparecer uma mensagem de erro no canto da tela, tire um print: ajuda a resolver
              mais rápido. Perguntar nunca é demais!
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
