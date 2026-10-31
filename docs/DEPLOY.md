# Checklist de deploy: Coffee Break

Como o sistema vai para o ar: **push na `main` → o Render faz o build e o deploy sozinho** (plano free, Oregon), em 1 a 2 minutos. O banco é o **Supabase** (PostgreSQL). O `server/schema.sql` é aplicado **cada vez que o servidor inicia**, então qualquer mudança nele é uma migração em produção.

Endereço: https://padaria-info.onrender.com · Painel: Render → serviço `padaria-info`

## Antes do push

- [ ] `git status` limpo: só o que é para subir está no commit.
- [ ] `npx tsc -b`: sem erros de tipo.
- [ ] `npx oxlint`: sem **erros** (avisos de fast refresh já conhecidos podem ficar).
- [ ] `npm run build`: o site compila.
- [ ] `npm run teste`: **110 de 110** (65 funcionais + 45 de segurança), num banco temporário. A **Checagem** do GitHub roda o mesmo a cada push: confira se ficou verde.
- [ ] `npm audit --omit=dev`: 0 vulnerabilidades no que vai para produção.
- [ ] Mexeu em tela? Confira num servidor de demonstração (banco em memória, dados fictícios) ou no `npm run dev` com o banco local.

### Se mexeu no banco (`server/schema.sql`)

- [ ] A mudança é **idempotente** (`if not exists`, blocos `do $$` que conferem antes), porque roda a cada início do servidor.
- [ ] Testada num banco vazio (PGlite) **e** conferida contra os dados de produção (por exemplo: não há órfãos antes de criar uma chave estrangeira).
- [ ] Se puder falhar com dado antigo, ela **avisa no log e não derruba** o servidor (padrão das chaves estrangeiras do `schema.sql`).
- [ ] Nada que apague coluna ou tabela com dados sem um plano de volta.

### Se mexeu em conexões ou variáveis

- [ ] O Supabase grátis aceita **15 conexões**. Cada servidor usa no máximo 5 (`DATABASE_POOL`), e num deploy a versão velha e a nova ficam ligadas juntas por alguns segundos.
- [ ] Nenhum servidor local apontando para o banco de produção (o `.env` local usa o banco local).
- [ ] Variável nova? Cadastre no Render (Environment) **antes** do push, ou o deploy sobe sem ela.

## Deploy

- [ ] `git push origin main`.
- [ ] Acompanhe no Render até **Live** (Events/Deploys). Se aparecer **Failed**, leia a aba Logs. Nada muda para os usuários, porque a versão anterior continua no ar.

## Depois do deploy (fumaça, 5 minutos)

- [ ] `https://padaria-info.onrender.com/api/saude/banco` → `{"ok":true}`.
- [ ] A tela de login abre, e o título da aba é "Coffee Break".
- [ ] Entrar com uma conta de teste e fazer o caminho principal: **PDV → venda → comprovante** e **Caixa**.
- [ ] Logs do Render sem `erro`/`Error`/`EMAXCONN` nos primeiros minutos.
- [ ] Cabeçalhos de segurança presentes (`strict-transport-security`, `content-security-policy`).

## Fechamento

- [ ] Release no GitHub (`vX.Y.Z`) com notas em português: destaques, novidades, configuração e o que foi verificado.
- [ ] Mudou alguma tela que aparece nos vídeos? Anote para regravar (`docs/VIDEOS.md`).
- [ ] Mudou rota ou tabela? Rode `npm run docs` para atualizar `docs/API.md` e `docs/BANCO.md`.

## Quando voltar atrás (rollback)

Volte se, depois do deploy:

- `/api/saude/banco` não responder `ok` por mais de 2 minutos;
- **venda no PDV**, **login** ou **fechamento de caixa** falharem;
- aparecerem erros repetidos no log (mais de 3 iguais em 5 minutos);
- o tempo de resposta passar de **3 s** com o servidor já acordado.

**Como voltar:**

1. **Mais rápido:** Render → Deploys → no deploy anterior que estava **Live**, clique em **Rollback**. O código volta em 1 a 2 minutos.
2. **No código:** `git revert <commit>` e `git push`. O Render publica a versão desfeita.
3. **Banco:** as mudanças do `schema.sql` **não** voltam sozinhas com o rollback. Se uma migração causou o problema, desfaça com um SQL específico no Supabase (SQL Editor), revisado antes. Por isso as migrações devem ser pequenas e só adicionar coisas.
