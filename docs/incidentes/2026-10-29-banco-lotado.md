# Pós-morte: deploy bloqueado por banco lotado (EMAXCONNSESSION)

**Data:** 29/10/2026 · **Duração:** cerca de 10 minutos com deploy bloqueado (03:19 → 03:29 UTC) · **Severidade:** SEV3
**Autores:** Evandro (dono) e Claude · **Status:** Concluído, com ações em aberto

## Resumo

Um deploy da versão com chaves estrangeiras novas falhou ao iniciar: o servidor novo não conseguiu conexão porque o banco (Supabase grátis, limite de **15 conexões**) estava lotado. Quase todas as vagas eram de um **servidor de testes no computador do desenvolvedor, ligado ao banco de produção**. A versão anterior seguiu no ar, e **nenhum cliente foi afetado**. A correção liberou as vagas e mudou o código para gastar menos conexões e tentar de novo antes de desistir.

## Impacto

- **Clientes:** nenhum. O Render manteve a versão anterior no ar, e o site respondeu normalmente o tempo todo.
- **Entrega:** a versão nova ficou cerca de 10 minutos sem conseguir subir.
- **Banco:** as 22 chaves estrangeiras novas foram aplicadas durante as tentativas, antes de a versão nova ficar no ar. Não houve problema, porque a mudança só acrescenta proteção e o código antigo é compatível.

## Linha do tempo

| Hora (UTC) | Hora (Brasília) | Evento |
|---|---|---|
| 27/10 01:15 | 26/10 22:15 | Servidor de testes (`npm run dev:server`, com recarga automática) ligado no computador, com o `.env` apontando para o **banco de produção**. |
| 29/10 03:10 | 29/10 00:10 | O servidor de testes reinicia sozinho (recarga após edição de arquivo) e abre um novo lote de conexões, que ficam paradas por até **10 minutos** (pool de até 10). |
| 03:18 | 00:18 | Push do commit `fd2b830` (chaves estrangeiras + documentação). O Render começa o build. |
| 03:18:50 | 00:18:50 | Build concluído. Início do deploy. |
| 03:19:09 | 00:19:09 | 1ª tentativa de iniciar: `EMAXCONNSESSION max clients reached in session mode - max clients are limited to pool_size: 15`. O servidor encerra (`exit 1`). |
| 03:19:25–03:19:57 | 00:19–00:20 | O Render tenta de novo mais 3 vezes, todas com o mesmo erro. O deploy fica **Failed**, e a versão anterior continua no ar. |
| 03:23 | 00:23 | **Detecção:** o acompanhamento do deploy mostra `update_failed`. O site continua respondendo `{"ok":true}`. |
| 03:24 | 00:24 | **Diagnóstico:** os logs do Render (pela API) mostram `EMAXCONNSESSION`. No banco, `pg_stat_activity` mostra **15 de 15 vagas** usadas: 14 conexões paradas desde 03:10:55 e mais a da consulta. |
| 03:25 | 00:25 | **Causa identificada:** o servidor de testes local (processo de 03:10) estava ligado na produção. |
| 03:26 | 00:26 | **Mitigação 1:** o `.env` local passa a apontar para o banco local (a URL de produção fica comentada). O servidor de testes reinicia e solta as vagas: **15 → 7 conexões**. |
| 03:27 | 00:27 | **Mitigação 2:** commit `f335bf3`: no máximo 5 conexões por servidor, conexões paradas soltas após 60 s e nova tentativa por até 2 minutos ao iniciar. |
| 03:29:11 | 00:29:11 | Deploy de `f335bf3` **Live**. Site ok. **Resolvido.** |
| 03:57 | 00:57 | Revisão de código encontra 9 pontos na correção. Commit `04048e0` (v0.21.1): aquecimento que não derruba nem prende vaga, timeout de 15 s para conectar, mais falhas tratadas como passageiras, `min: 1`. Deploy **Live** às 03:58. |

## Causa raiz

O banco grátis do Supabase aceita 15 conexões no total. A conta não fechava:

- Cada servidor guardava **até 10 conexões**, deixava **4 abertas desde o início** e só soltava uma conexão parada depois de **10 minutos**.
- Um **servidor de testes local apontava para a produção** e, depois de reiniciar, segurava a maior parte das vagas.
- Num deploy, a versão nova precisa conectar **enquanto a antiga ainda está no ar**, com as vagas dela.
- O servidor novo, ao não conseguir conexão na primeira tentativa, **desistia na hora** (`exit 1`), em vez de esperar as vagas voltarem.

## 5 porquês

1. **Por que o deploy falhou?** O servidor novo não conseguiu conexão com o banco e encerrou.
2. **Por que não conseguiu conexão?** As 15 vagas do Supabase grátis estavam ocupadas.
3. **Por que estavam ocupadas?** Um servidor de testes local, ligado ao banco de produção, segurava 14 conexões paradas, porque o pool mantinha até 10 conexões por 10 minutos.
4. **Por que um servidor de testes estava na produção?** O `.env` do computador de desenvolvimento usava a mesma `DATABASE_URL` do sistema no ar. Não havia separação entre testes e produção (o risco já tinha sido apontado, mas a mudança não tinha sido feita).
5. **Por que isso derrubou o deploy em vez de só deixá-lo mais lento?** O código não tinha margem para o limite de 15, nem nova tentativa ao iniciar: qualquer lotação passageira virava falha definitiva.

**Causa raiz:** falta de separação entre o ambiente de testes e a produção, somada a uma configuração de conexões que não cabia no limite do plano grátis e a uma subida que não tolerava falhas passageiras.

## O que deu certo

- O Render **manteve a versão anterior no ar**: o incidente não chegou aos clientes.
- O deploy estava sendo **acompanhado**, e a falha foi vista em cerca de 4 minutos.
- Os **logs pela API do Render** e o `pg_stat_activity` mostraram a causa em minutos, sem adivinhação.
- A mitigação foi pequena e reversível (o `.env` local) e liberou as vagas na hora.
- A **revisão de código** depois da correção pegou falhas que poderiam repetir o incidente (aquecimento sem nova tentativa, conexão sem timeout).

## O que deu errado

- O risco do servidor local na produção era conhecido e não tinha sido tratado.
- O commit que disparou o deploy foi enviado com o teste de segurança em **44 de 45**. A falha era do próprio teste, que dependia do relógio, mas a regra "só enviar com tudo passando" não foi seguida.
- Não existe **alerta automático** de deploy que falhou: a detecção dependeu de alguém estar olhando.
- A migração do banco (chaves estrangeiras) foi aplicada **antes** de a versão nova ficar no ar. Foi inofensiva desta vez, mas uma migração incompatível teria quebrado a versão antiga.

## Ações

| Ação | Responsável | Prioridade | Situação |
|---|---|---|---|
| `.env` local aponta para o banco local; produção comentada | Claude | P0 | ✅ Feito (29/10) |
| No máximo 5 conexões por servidor, soltas após 60 s | Claude | P0 | ✅ Feito (`f335bf3`) |
| Nova tentativa ao iniciar (até ~2 min), timeout de 15 s, aquecimento que não derruba | Claude | P0 | ✅ Feito (`04048e0`) |
| Teste de força bruta sem depender do relógio | Claude | P1 | ✅ Feito (`04048e0`) |
| Checklist de deploy com o limite de conexões e a regra das migrações | Claude | P1 | ✅ Feito (`docs/DEPLOY.md`) |
| Ligar avisos por e-mail de deploy que falhou no Render (Account Settings → Notifications), de graça | Evandro | P1 | Em aberto |
| Usuário próprio do sistema no banco, com permissões mínimas, para limitar o estrago se a senha vazar | Evandro + Claude | P2 | Em aberto |
| Migrações sempre compatíveis com a versão anterior (só acrescentar; remover em outro deploy) | Claude | P2 | ✅ Regra no `docs/DEPLOY.md` |

## Lições

- **Testes nunca na produção.** O servidor do computador usa o banco local, e a URL de produção só entra quando for de propósito.
- **Planos grátis têm limites rígidos.** Toda configuração de conexões precisa caber **duas vezes** no limite (versão velha e nova juntas no deploy), com folga.
- **Subir tem que tolerar falha passageira.** Esperar e tentar de novo é melhor do que desistir na primeira.
- **Migração roda antes do código novo.** Ela precisa funcionar com a versão anterior também.
