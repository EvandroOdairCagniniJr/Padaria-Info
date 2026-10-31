<!-- Arquivo gerado por `npm run docs` (scripts/gerar-docs.mjs). Não edite à mão. -->

# API

**77 rotas**, todas em `/api`, todas JSON. Públicas: 9 · todos os logados: 33 · restritas a dono/gerente: 35.

## Regras que valem para todas as rotas

- **Login:** cookie `padaria_token` (JWT HS256, httpOnly, 7 dias). A versão da sessão vai no token, então trocar a senha derruba os logins antigos.
- **Multi-padaria:** o servidor pega a padaria do usuário logado (`res.locals.padariaId`), nunca do que o navegador envia.
- **Ações (POST/PUT/PATCH/DELETE):** só em JSON e só vindas do próprio site (proteção contra CSRF).
- **Limites:** 600 pedidos por minuto por IP, e 20 por minuto nas rotas de login e senha.
- **Respostas:** `Cache-Control: no-store` (nada fica salvo no navegador).
- **Testes:** `npm run teste:seguranca` ataca estas rotas e confere as regras acima.

## Rotas

| Método | Rota | Quem pode | Para que serve | Código |
|---|---|---|---|---|
| GET | `/api/analise` | dono, gerente |  | [analise.ts:37](../server/analise.ts#L37) |
| POST | `/api/auth/cadastro` | público | Criar conta como funcionário (tela de login): a pessoa informa o código de convite que o dono vê em Equipe. Entra desativada; o dono vê "Aguardando liberação" e decide papel e cargo. | [auth.ts:220](../server/auth.ts#L220) |
| POST | `/api/auth/codigo/entrar` | público | Usa o código (vale uma vez só) e entra; com novaSenha, troca a senha antes. | [auth.ts:337](../server/auth.ts#L337) |
| POST | `/api/auth/codigo/verificar` | público |  | [auth.ts:330](../server/auth.ts#L330) |
| POST | `/api/auth/esqueci-senha` | público | Sempre responde igual, exista ou não a conta (não revela quais e-mails estão cadastrados). | [auth.ts:272](../server/auth.ts#L272) |
| POST | `/api/auth/login` | público |  | [auth.ts:136](../server/auth.ts#L136) |
| POST | `/api/auth/logout` | público |  | [auth.ts:356](../server/auth.ts#L356) |
| GET | `/api/auth/me` | todos logados |  | [auth.ts:370](../server/auth.ts#L370) |
| GET | `/api/auth/perfil` | todos logados | Perfil completo de quem está logado (Editar perfil): dados pessoais, endereço, trabalho. | [auth.ts:447](../server/auth.ts#L447) |
| PATCH | `/api/auth/perfil` | todos logados | Editar perfil: cada pessoa muda a própria foto, nome e cargo quando quiser (fica no histórico, que dono e gerência veem). O papel — o que pode fazer no sistema — só o dono muda, em Equipe. | [auth.ts:429](../server/auth.ts#L429) |
| POST | `/api/auth/sair-de-todos` | todos logados | Sair de todos os aparelhos (ex.: esqueceu o sistema aberto num computador da padaria). | [auth.ts:362](../server/auth.ts#L362) |
| POST | `/api/auth/setup` | público | Cadastrar minha padaria: cria a padaria e a conta do dono (qualquer pessoa, a qualquer hora). | [auth.ts:375](../server/auth.ts#L375) |
| POST | `/api/caixa/abrir` | todos logados |  | [caixa.ts:144](../server/caixa.ts#L144) |
| GET | `/api/caixa/atual` | todos logados | Meu caixa aberto (com o resumo) e o fundo do último fechamento, para sugerir na abertura. | [caixa.ts:129](../server/caixa.ts#L129) |
| POST | `/api/caixa/fechar` | todos logados | Fechamento: grava o esperado e o contado; a diferença é a do dinheiro (quebra de caixa). | [caixa.ts:194](../server/caixa.ts#L194) |
| GET | `/api/caixa/historico` | dono, gerente | Histórico (dono e gerência): caixas do período com diferenças. | [caixa.ts:230](../server/caixa.ts#L230) |
| POST | `/api/caixa/movimento` | todos logados | Sangria (retirada da gaveta, ex.: levar ao cofre) ou suprimento (reforço de troco). | [caixa.ts:165](../server/caixa.ts#L165) |
| GET | `/api/categorias` | todos logados | Fotos das categorias (vitrine do PDV, listas). Só as que têm foto; as demais usam o ícone automático. | [routes.ts:123](../server/routes.ts#L123) |
| PUT | `/api/categorias/foto` | dono, gerente |  | [routes.ts:131](../server/routes.ts#L131) |
| GET | `/api/conquistas` | todos logados | Para a comemoração na tela de quem está logado: quanto vendeu hoje, a meta da padaria e o recorde anterior (maior dia antes de hoje). `desde` é o início do dia no navegador. | [routes.ts:777](../server/routes.ts#L777) |
| GET | `/api/contas` | dono, gerente |  | [routes.ts:523](../server/routes.ts#L523) |
| POST | `/api/contas` | dono, gerente |  | [routes.ts:532](../server/routes.ts#L532) |
| DELETE | `/api/contas/:id` | dono, gerente |  | [routes.ts:575](../server/routes.ts#L575) |
| PATCH | `/api/contas/:id` | dono, gerente |  | [routes.ts:556](../server/routes.ts#L556) |
| POST | `/api/contas/:id/pagar` | dono, gerente |  | [routes.ts:566](../server/routes.ts#L566) |
| GET | `/api/encomendas` | todos logados | Lista do período (pela data de retirada), com os itens. | [encomendas.ts:75](../server/encomendas.ts#L75) |
| POST | `/api/encomendas` | todos logados |  | [encomendas.ts:117](../server/encomendas.ts#L117) |
| PUT | `/api/encomendas/:id` | todos logados |  | [encomendas.ts:173](../server/encomendas.ts#L173) |
| POST | `/api/encomendas/:id/entregar` | todos logados | Entregar: recebe o restante, registra a venda (preços combinados na encomenda) e baixa o estoque. | [encomendas.ts:220](../server/encomendas.ts#L220) |
| POST | `/api/encomendas/:id/status` | todos logados | Avança o status (confirmada, em produção, pronta) ou cancela. | [encomendas.ts:207](../server/encomendas.ts#L207) |
| GET | `/api/equipe/acessos` | dono | Acessos recentes da padaria: logins, senhas erradas, bloqueios, recuperação e troca de senha. | [equipe.ts:206](../server/equipe.ts#L206) |
| GET | `/api/equipe/atividade` | dono | Linha do tempo: o que cada um fez por último. Movimentações automáticas de venda/produção ficam de fora (já aparecem como a própria venda/produção). | [equipe.ts:176](../server/equipe.ts#L176) |
| GET | `/api/equipe/membros` | dono |  | [equipe.ts:31](../server/equipe.ts#L31) |
| POST | `/api/equipe/membros` | dono |  | [equipe.ts:41](../server/equipe.ts#L41) |
| PATCH | `/api/equipe/membros/:id` | dono |  | [equipe.ts:85](../server/equipe.ts#L85) |
| GET | `/api/equipe/resumo` | dono | Desempenho de cada membro no período (vendas, ajustes de estoque, produções concluídas). `hoje` (início do dia no navegador) alimenta a barra da meta diária, qualquer que seja o período; recorde_dia é o maior total vendido pela pessoa num único dia. | [equipe.ts:133](../server/equipe.ts#L133) |
| POST | `/api/estoque/movimentacoes` | todos logados |  | [routes.ts:184](../server/routes.ts#L184) |
| GET | `/api/margens` | dono, gerente |  | [margens.ts:62](../server/margens.ts#L62) |
| PUT | `/api/margens/alvo` | dono |  | [margens.ts:125](../server/margens.ts#L125) |
| GET | `/api/metas` | todos logados |  | [metas.ts:55](../server/metas.ts#L55) |
| PUT | `/api/metas` | dono | Dono define as metas de um alvo de uma vez; null remove a meta daquele período. | [metas.ts:138](../server/metas.ts#L138) |
| GET | `/api/padaria` | todos logados |  | [padaria.ts:12](../server/padaria.ts#L12) |
| PUT | `/api/padaria` | dono |  | [padaria.ts:16](../server/padaria.ts#L16) |
| GET | `/api/padaria/convite` | dono | Código que o funcionário informa em "Criar conta" para pedir acesso a esta padaria. | [padaria.ts:23](../server/padaria.ts#L23) |
| POST | `/api/padaria/convite` | dono | Gera um código novo (o antigo deixa de valer) — por exemplo, se vazou. | [padaria.ts:32](../server/padaria.ts#L32) |
| GET | `/api/perdas` | todos logados | Perdas do período + resumo: custo total, por motivo e taxa de perda por produto (perdido ÷ (vendido + perdido)). | [perdas.ts:79](../server/perdas.ts#L79) |
| POST | `/api/perdas` | todos logados | Registrar perdas (todos): vários produtos de uma vez, como no fechamento do dia. | [perdas.ts:23](../server/perdas.ts#L23) |
| DELETE | `/api/perdas/:id` | dono, gerente | Desfazer um lançamento de perda feito por engano (o estoque volta). Só dono e gerência. | [perdas.ts:150](../server/perdas.ts#L150) |
| GET | `/api/producao/sugestao` | todos logados | Sugestão de produção para um dia: para cada produto vendido no mesmo dia da semana nas últimas 4 semanas, a média ponderada do que vendeu e do que sobrou. Se quase não sobra, provavelmente faltou → sugere 10% a mais; se sobra muito, sugere só o que vende. `inicio` = início do dia desejado no relógio da padaria. | [perdas.ts:179](../server/perdas.ts#L179) |
| GET | `/api/producoes` | todos logados |  | [routes.ts:679](../server/routes.ts#L679) |
| POST | `/api/producoes` | todos logados |  | [routes.ts:687](../server/routes.ts#L687) |
| DELETE | `/api/producoes/:id` | dono, gerente | Produção concluída já movimentou o estoque — não pode ser removida. | [routes.ts:711](../server/routes.ts#L711) |
| POST | `/api/producoes/:id/concluir` | todos logados |  | [routes.ts:722](../server/routes.ts#L722) |
| GET | `/api/produtos` | todos logados |  | [routes.ts:78](../server/routes.ts#L78) |
| POST | `/api/produtos` | dono, gerente |  | [routes.ts:86](../server/routes.ts#L86) |
| DELETE | `/api/produtos/:id` | dono, gerente | Remoção lógica: o produto continua referenciado por vendas e receitas antigas. | [routes.ts:117](../server/routes.ts#L117) |
| PATCH | `/api/produtos/:id` | dono, gerente |  | [routes.ts:109](../server/routes.ts#L109) |
| GET | `/api/promocoes` | dono, gerente | Todas (inclusive pausadas e encerradas), com quanto já deram de desconto e em quantas vendas. | [promocoes.ts:129](../server/promocoes.ts#L129) |
| POST | `/api/promocoes` | dono, gerente |  | [promocoes.ts:148](../server/promocoes.ts#L148) |
| DELETE | `/api/promocoes/:id` | dono, gerente |  | [promocoes.ts:156](../server/promocoes.ts#L156) |
| PUT | `/api/promocoes/:id` | dono, gerente |  | [promocoes.ts:152](../server/promocoes.ts#L152) |
| GET | `/api/promocoes/ativas` | todos logados | Para o PDV: todos veem as promoções ativas. | [promocoes.ts:45](../server/promocoes.ts#L45) |
| GET | `/api/receita-itens` | todos logados |  | [routes.ts:607](../server/routes.ts#L607) |
| GET | `/api/receitas` | todos logados |  | [routes.ts:600](../server/routes.ts#L600) |
| POST | `/api/receitas` | dono, gerente |  | [routes.ts:648](../server/routes.ts#L648) |
| DELETE | `/api/receitas/:id` | dono, gerente | Produções só planejadas saem junto; com produção concluída a receita fica (é histórico de estoque). | [routes.ts:657](../server/routes.ts#L657) |
| PUT | `/api/receitas/:id` | dono, gerente |  | [routes.ts:652](../server/routes.ts#L652) |
| GET | `/api/recomendacoes` | todos logados | `inicio` = início de hoje no relógio da padaria (o servidor roda em UTC). | [recomendacoes.ts:39](../server/recomendacoes.ts#L39) |
| GET | `/api/saude` | público | Verificação de saúde do Render (sem login). | [index.ts:56](../server/index.ts#L56) |
| GET | `/api/saude/banco` | público | "Cutucada" do GitHub Actions (.github/workflows/manter-acordado.yml): mantém o Render acordado e faz uma consulta mínima no banco, para o Supabase grátis não pausar o projeto por inatividade. | [index.ts:62](../server/index.ts#L62) |
| GET | `/api/time` | todos logados |  | [time.ts:29](../server/time.ts#L29) |
| GET | `/api/time/novidades` | dono, gerente |  | [time.ts:108](../server/time.ts#L108) |
| GET | `/api/vendas` | dono, gerente |  | [routes.ts:210](../server/routes.ts#L210) |
| POST | `/api/vendas` | todos logados | O preço vem sempre do cadastro, nunca do navegador; as promoções são recalculadas aqui (mesmas regras do PDV, em src/lib/promocoes.ts). | [routes.ts:374](../server/routes.ts#L374) |
| GET | `/api/vendas/:id` | todos logados | Uma venda com os itens: tela de detalhes e 2ª via do comprovante. | [routes.ts:306](../server/routes.ts#L306) |
| POST | `/api/vendas/:id/devolver` | dono, gerente | Devolução (dono e gerência): o cliente devolveu tudo. Os produtos voltam ao estoque e a venda sai dos totais, mas continua no histórico como "Devolvida", com quem fez e o motivo. | [routes.ts:330](../server/routes.ts#L330) |
| GET | `/api/vendas/historico` | todos logados | Histórico (todos: o balcão precisa achar a venda para dar a 2ª via do comprovante). Período [desde, ate), busca por nº do comprovante, produto ou vendedor; 50 por página, continuando de onde parou (antes = data + id da última venda da página anterior). | [routes.ts:226](../server/routes.ts#L226) |
