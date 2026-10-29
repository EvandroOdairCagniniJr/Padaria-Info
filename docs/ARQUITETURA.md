# Arquitetura do Padaria Info

Como o sistema funciona de ponta a ponta. Para os detalhes, veja [API.md](API.md) (todas as rotas) e [BANCO.md](BANCO.md) (todas as tabelas). Esses dois arquivos são gerados por `npm run docs`.

## Visão geral

```mermaid
flowchart LR
  N["Navegador<br/>(React + Vite)"] -- "HTTPS · cookie de login" --> R["Render (plano free, Oregon)<br/>Node 24 + Express<br/>site + /api"]
  R -- "TLS verificado<br/>(CA do Supabase)" --> S[("Supabase<br/>PostgreSQL 17<br/>schema padaria")]
  G["GitHub Actions<br/>a cada 10 min"] -. "GET /api/saude/banco" .-> R
  R -. "código de senha" .-> E["E-mail (SMTP)"]
  N -. "busca CEP" .-> V["ViaCEP"]
```

| Peça | O que faz | Onde está |
|---|---|---|
| Site (front-end) | Telas: PDV, estoque, caixa, equipe etc. React, gerado em `dist/` | [src/](../src/) |
| Servidor (API) | Regras de negócio, login e acesso ao banco. Também entrega o site. | [server/](../server/) |
| Banco | Todos os dados. Estrutura em `server/schema.sql`, aplicada ao iniciar. | Supabase |
| Hospedagem | Faz o deploy sozinho a cada push na `main` ([render.yaml](../render.yaml)) | Render |
| Cutucada | Impede o Render de dormir e o Supabase de pausar | [.github/workflows/manter-acordado.yml](../.github/workflows/manter-acordado.yml) |

## Caminho de um pedido na API

Todo pedido para `/api` passa pelas mesmas camadas, nesta ordem ([server/index.ts](../server/index.ts)):

```mermaid
flowchart TD
  A[Pedido chega] --> B["Cabeçalhos de segurança<br/>(CSP, HSTS, X-Frame-Options...)"]
  B --> C["Sem cache (no-store)"]
  C --> D{"Mais de 600 pedidos/min<br/>deste IP?"}
  D -- sim --> X1[429]
  D -- não --> E{"Ação vinda de outro site<br/>ou fora do formato JSON?"}
  E -- sim --> X2[403 / 415]
  E -- não --> F{"Cookie de login válido<br/>e conta ativa?"}
  F -- não --> X3[401]
  F -- sim --> G{"Papel permite?<br/>(dono / gerente / funcionário)"}
  G -- não --> X4[403]
  G -- sim --> H["Validação dos dados (zod)"]
  H --> I["Consulta SEMPRE filtrada<br/>pela padaria do usuário"]
  I --> J[Resposta JSON]
```

## Login

```mermaid
sequenceDiagram
  participant N as Navegador
  participant A as API (/api/auth/login)
  participant B as Banco
  N->>A: e-mail + senha (JSON)
  A->>B: busca usuário pelo e-mail
  alt conta bloqueada (5 erros)
    A-->>N: 423 (espere 15 min ou use "Esqueci minha senha")
  end
  A->>A: bcrypt confere a senha (tempo igual se a conta não existe)
  alt senha errada
    A->>B: conta +1 erro
    A-->>N: 401 "E-mail ou senha inválidos"
  end
  A->>B: zera erros, registra acesso
  A-->>N: cookie httpOnly com JWT {usuário, versão da sessão}, válido por 7 dias
  Note over N,A: Nos pedidos seguintes, o servidor confere o JWT e a versão da sessão.<br/>Trocar a senha ou "Sair de todos" muda a versão e derruba os logins antigos.
```

## Uma venda no PDV

```mermaid
sequenceDiagram
  participant N as PDV (navegador)
  participant A as API (POST /api/vendas)
  participant B as Banco
  N->>A: itens {produto, quantidade}, forma de pagamento, desconto
  A->>B: BEGIN (transação: tudo ou nada)
  A->>B: preços atuais dos produtos (o preço enviado pelo navegador é ignorado)
  A->>A: aplica promoções ativas (dia, horário, leve X pague Y...)
  A->>A: desconto manual (funcionário: no máximo 10%)
  A->>B: caixa aberto de quem vendeu
  A->>B: grava venda + itens
  A->>B: baixa o estoque (movimentação de "saída", motivo "venda")
  A->>B: COMMIT
  A-->>N: total cobrado e itens (para o comprovante)
```

Na devolução (`POST /api/vendas/:id/devolver`, só dono ou gerente), a venda vira "devolvida", sai de todos os totais e o estoque volta.

## Papéis

| Papel | Pode |
|---|---|
| **dono** | Tudo, incluindo Equipe, convites, dados da padaria e metas |
| **admin** (gerente) | Toda a operação: produtos, preços, promoções, contas, análise, margens, devoluções |
| **funcionario** | PDV, caixa próprio, estoque, produção, encomendas, perdas, histórico de vendas (para a 2ª via) |

A lista completa, rota por rota, está em [API.md](API.md).

## Segurança e verificação

- `npm run teste:seguranca` faz 45 ataques reais num servidor isolado: login, isolamento entre padarias, papéis, SQL injection, CSRF, vazamentos e força bruta.
- Senhas guardadas só com bcrypt. O código de recuperação é guardado só como hash, vale 15 minutos e aceita 5 tentativas.
- Banco: RLS ligado em todas as tabelas (a API pública do Supabase não lê nada), conexão TLS verificada e chaves estrangeiras garantindo os vínculos.
- LGPD: o registro de acessos é apagado depois de 1 ano. CPF repetido não revela o titular, e os logs não guardam dados pessoais.

## Decisões em aberto (para o dono decidir)

- **Faturamento visível ao funcionário:** o histórico de vendas é aberto a todos, porque o balcão precisa achar a venda para a 2ª via, e ele mostra o total do período. Se o faturamento deve ser só da gerência, dá para esconder os totais para o papel `funcionario`.
- **Usuário do banco:** o servidor conecta como `postgres`, que pode tudo. Um usuário só com as permissões necessárias limitaria o estrago se a senha vazasse.

## Comandos úteis

| Comando | Para quê |
|---|---|
| `npm run dev` + `npm run dev:server` | Rodar no computador (site + API) |
| `npm run banco:local` | Banco PostgreSQL local para testes (sem Supabase) |
| `npm run teste:seguranca` | Teste de segurança automático |
| `npm run docs` | Regenerar `docs/API.md` e `docs/BANCO.md` |
| `npm run build` | Gerar o site de produção (o Render faz isso sozinho) |
