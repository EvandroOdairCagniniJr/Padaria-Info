import {
  ChefHat,
  KeyRound,
  Lightbulb,
  Package,
  ShoppingCart,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/AuthContext'
import { papelLabels } from '@/lib/permissoes'
import type { Papel } from '@/types/database'

interface Guia {
  titulo: string
  icone: LucideIcon
  link?: string
  papeis: Papel[]
  passos: string[]
  dicas: string[]
}

const todos: Papel[] = ['dono', 'admin', 'funcionario']
const gestao: Papel[] = ['dono', 'admin']

const guias: Guia[] = [
  {
    titulo: 'Primeiro dia: entrando no sistema',
    icone: KeyRound,
    papeis: todos,
    passos: [
      'Entre com o e-mail e a senha que o responsável pela padaria passou para você.',
      'Ainda não tem conta? Use "Criar conta" na tela de login e aguarde o responsável liberar seu acesso.',
      'Esqueceu a senha? Clique em "Esqueci minha senha": chega um código no seu e-mail para você entrar e criar uma senha nova.',
      'Seu nome e seu papel aparecem no canto de baixo do menu — confira se está na sua conta.',
      'O menu da esquerda mostra só o que você usa no dia a dia.',
      'No fim do turno, clique em "Sair", principalmente em computador compartilhado.',
    ],
    dicas: [
      'Tudo o que você registra (vendas, estoque, produção) fica no seu nome. Não use a conta de outra pessoa.',
      'Esqueceu a senha? Peça ao dono: ele cria uma nova em Equipe.',
    ],
  },
  {
    titulo: 'Vendendo no balcão (PDV)',
    icone: ShoppingCart,
    link: '/pdv',
    papeis: todos,
    passos: [
      'Digite o nome do produto na busca. Apertar Enter já adiciona o primeiro resultado.',
      'Ou clique no produto. Clicar de novo soma mais uma unidade.',
      'No carrinho, use − e + para ajustar a quantidade, ou a lixeira para tirar o item.',
      'Escolha a forma de pagamento (dinheiro, Pix, débito ou crédito).',
      'Confira o total com o cliente e clique em "Finalizar venda".',
      'Se o cliente quiser o comprovante: digite o WhatsApp dele (com DDD) e clique em "Enviar". O WhatsApp abre com a mensagem pronta, é só tocar em enviar.',
    ],
    dicas: [
      'O estoque de cada produto aparece embaixo do preço. Em vermelho = acabou.',
      'O preço vem do cadastro. Se estiver errado, avise o gerente em vez de "compensar" no troco.',
      'O botão "Copiar" no comprovante serve para colar em outro aplicativo.',
    ],
  },
  {
    titulo: 'Recebendo mercadoria e registrando perdas (Estoque)',
    icone: Warehouse,
    link: '/estoque',
    papeis: todos,
    passos: [
      'Chegou mercadoria: em Estoque, clique em "Ajustar" no produto e escolha "Entrada" com a quantidade recebida.',
      'Perda, quebra, vencido ou doação: use "Saída" e escreva o motivo.',
      'Contagem do estoque: use "Ajuste" e informe o total que você contou na prateleira.',
    ],
    dicas: [
      'Produtos com estoque baixo aparecem primeiro na lista, em vermelho.',
      'Sempre preencha o motivo nas saídas: ajuda o dono a entender as perdas.',
      'Vendas e produções já mexem no estoque sozinhas. Não lance de novo.',
    ],
  },
  {
    titulo: 'Produção do dia',
    icone: ChefHat,
    link: '/producao',
    papeis: todos,
    passos: [
      'Em Produção → Planejamento, veja o que precisa ser feito hoje.',
      'Para planejar uma fornada: "Planejar produção", escolha a receita e a data.',
      'Quando a fornada estiver pronta: no menu ⋯ da linha, clique em "Concluir produção".',
      'O sistema dá baixa nos ingredientes e soma o produto pronto no estoque.',
    ],
    dicas: [
      'Conclua só quando a fornada estiver realmente pronta: não dá para desfazer.',
      'Na aba Receitas você consulta a ficha técnica (ingredientes e rendimento) de cada produto.',
    ],
  },
  {
    titulo: 'Cadastrando produtos e preços',
    icone: Package,
    link: '/produtos',
    papeis: gestao,
    passos: [
      'Em Produtos, clique em "Novo produto".',
      'Preencha nome, unidade (un, kg...) e preço de venda. O preço de custo é opcional, mas ajuda a ver a margem.',
      'Defina o estoque mínimo: abaixo disso o produto aparece em alerta no Dashboard e no Estoque.',
      'Ingredientes (farinha, fermento...) também são produtos: cadastre-os para usar nas receitas.',
    ],
    dicas: [
      'Mudar o preço vale para as próximas vendas; as antigas mantêm o preço da época.',
      'Remover um produto só o esconde: o histórico de vendas continua intacto.',
    ],
  },
  {
    titulo: 'Fichas técnicas (Receitas)',
    icone: ChefHat,
    link: '/producao',
    papeis: gestao,
    passos: [
      'Em Produção → Receitas, clique em "Nova receita".',
      'Escolha o produto final e quanto a receita rende (ex: 50 pães).',
      'Adicione cada ingrediente com a quantidade usada em uma receita.',
    ],
    dicas: [
      'Com as fichas certas, cada produção concluída já atualiza o estoque de ingredientes sozinha.',
    ],
  },
  {
    titulo: 'Contas a pagar e a receber (Financeiro)',
    icone: Wallet,
    link: '/financeiro',
    papeis: gestao,
    passos: [
      'Lance cada boleto, fornecedor ou aluguel em "Novo lançamento" → Conta a pagar.',
      'Encomendas e vendas a prazo vão em Conta a receber.',
      'Quando pagar ou receber, use o menu ⋯ → "Marcar como pago".',
    ],
    dicas: ['O Dashboard avisa as contas que vencem nos próximos 7 dias e as atrasadas.'],
  },
  {
    titulo: 'Coordenando a equipe',
    icone: Users,
    link: '/equipe',
    papeis: ['dono'],
    passos: [
      'Em Equipe, clique em "Novo membro", preencha nome, e-mail e uma senha inicial, e escolha o papel.',
      'Funcionário: PDV, estoque e produção. Admin: gerente, vê tudo menos a página Equipe.',
      'Passe o e-mail e a senha para a pessoa e mostre este Guia no primeiro dia.',
      'Acompanhe por período (hoje, 7 ou 30 dias) quanto cada um vendeu, as produções e os ajustes de estoque.',
      'Em "Ver atividade" você vê a linha do tempo de uma pessoa: cada venda, fornada e ajuste.',
    ],
    dicas: [
      'Quando alguém sair da padaria, use "Desativar acesso": a pessoa perde o acesso na hora e o histórico continua.',
      'Muitos ajustes de estoque de uma mesma pessoa podem indicar perdas. Vale conversar.',
      'Senha esquecida: "Editar / redefinir senha" e passe a nova para a pessoa.',
    ],
  },
]

const dicasGerais = [
  'Outros computadores e celulares da padaria podem abrir o sistema pelo endereço de rede que aparece ao ligar o servidor (ex: http://192.168.0.10:3000).',
  'O computador com o servidor precisa ficar ligado (e o MySQL rodando) para o sistema funcionar nos outros.',
  'Se algo der erro, a mensagem aparece no canto da tela. Tire uma foto e mostre ao responsável.',
]

export function GuiaPage() {
  const { user } = useAuth()
  const papel = user?.papel ?? 'funcionario'
  const visiveis = guias.filter((g) => g.papeis.includes(papel))

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Guia e dicas</h1>
        <p className="text-sm text-muted-foreground">
          Passo a passo do dia a dia para quem é {papelLabels[papel].toLowerCase()}
          {papel !== 'funcionario' && ' (inclui o que os funcionários veem)'}
        </p>
      </div>

      {visiveis.map((guia, i) => (
        <Card key={guia.titulo}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {i + 1}
              </span>
              <guia.icone className="size-4 text-muted-foreground" />
              {guia.titulo}
              {guia.papeis.length < todos.length && (
                <Badge variant="outline">
                  {guia.papeis.map((p) => papelLabels[p]).join(' e ')}
                </Badge>
              )}
            </CardTitle>
            {guia.link && (
              <Link to={guia.link} className="text-xs text-muted-foreground hover:text-foreground">
                Abrir
              </Link>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="list-decimal space-y-1.5 pl-5">
              {guia.passos.map((passo) => (
                <li key={passo}>{passo}</li>
              ))}
            </ol>
            <ul className="space-y-1 rounded-md bg-muted/50 p-3">
              {guia.dicas.map((dica) => (
                <li key={dica} className="flex gap-2 text-muted-foreground">
                  <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                  {dica}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="size-4 text-amber-500" />
            Dicas gerais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {dicasGerais.map((dica) => (
              <li key={dica}>{dica}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
