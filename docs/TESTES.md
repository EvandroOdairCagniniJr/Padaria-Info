# Testes do Coffee Break

Dois testes automáticos, que rodam isolados: banco temporário em memória, servidor numa porta própria e dados fictícios. Eles **não tocam no Supabase** nem no servidor da porta 3000.

| Comando | O que testa | Verificações |
|---|---|---|
| `npm run teste:funcional` | O dia a dia da padaria, de ponta a ponta, conferindo valores, estoque e caixa centavo por centavo | 65 |
| `npm run teste:seguranca` | Ataques: login forjado, isolamento entre padarias, papéis, SQL injection, CSRF, vazamentos e força bruta | 45 |
| `npm run teste` | Os dois, em sequência | 110 |

Rode `npm run teste` antes de todo push (veja [DEPLOY.md](DEPLOY.md)).

## Cenários funcionais

Padaria fictícia: dona (dono), Caio (funcionário) e os produtos Pão francês (R$ 20/kg, 10 kg), Coxinha (R$ 7,50, 20 un), Café coado (R$ 5, 50 un), Farinha (25 kg) e Bolo de cenoura (R$ 30, 5 un).

| # | Cenário | Casos de teste |
|---|---|---|
| 1 | Abrir o caixa | Abre com fundo de R$ 100 · não abre um segundo caixa para a mesma pessoa |
| 2 | Venda simples no Pix | 2 coxinhas = R$ 15,00 · estoque 20 → 18 |
| 3 | Venda por quilo, em dinheiro | 0,5 kg × R$ 20 = R$ 10,00 · estoque 10 → 9,5 kg |
| 4 | Promoções automáticas | 10% em Bebidas: 2 cafés = R$ 9,00 (desconto R$ 1,00) · leve 3 pague 2: 3 coxinhas = R$ 15,00 · promoção de 150% é recusada |
| 5 | Desconto manual | Funcionário dá 5% · funcionário **não** dá 20% · dono dá 20% (R$ 7,50 → R$ 6,00) |
| 6 | Vendas inválidas | Pedido vazio, quantidade zero, produto inexistente e forma de pagamento inválida são recusados |
| 7 | Devolução | Funcionário não devolve · sem motivo é recusada · dono devolve e o estoque volta · venda fica "devolvida" · não devolve duas vezes |
| 8 | Estoque | Entrada soma · ajuste deixa o valor exato · entrada negativa é recusada |
| 9 | Encomenda | 2 bolos = R$ 60 com sinal de R$ 20 · sinal maior que o total é recusado · reservada → confirmada → em produção → pronta · recebido menor que o restante é recusado · entrega gera a venda e baixa o estoque · não entrega duas vezes |
| 10 | Fechamento do caixa | Sangria R$ 30 e suprimento R$ 10 · **dinheiro esperado R$ 130** (100 + 10 + 40 + 10 − 30) · **Pix R$ 26** (sem a venda devolvida; sinal contado uma vez) · débito R$ 9 e crédito R$ 15 · contou R$ 125 → diferença −R$ 5 · não fecha duas vezes |
| 11 | Receita e produção | Ficha técnica: 10 kg de pão com 6 kg de farinha · concluir soma +10 kg de pão e tira −6 kg de farinha · não conclui duas vezes |
| 12 | Perdas | Sobra de 1 kg baixa o estoque · motivo fora da lista é recusado |
| 13 | Metas | Semana menor que o dia é recusada (com mensagem) · mês menor que o dia é recusado · metas coerentes são salvas e aparecem no painel · funcionário não define metas |
| 14 | Minha padaria | Logo e comprovante personalizado salvos e devolvidos iguais · logo que não é imagem, cor fora da lista e título longo são recusados · funcionário vê a logo |

## Quando um teste falhar

1. Leia a linha com ❌: ela diz o esperado e o que veio (por exemplo, `status 403` ou `total 14.5`).
2. Confira se a regra de negócio mudou de propósito. Se mudou, atualize o teste e esta tabela.
3. Se não mudou, é um defeito: corrija antes de publicar.
