<div align="center">

<img src="public/favicon.svg" alt="Coffee Break" width="96" height="96" />

# Coffee Break

**Gestão completa para padarias — do balcão ao forno, do estoque ao caixa.**

Um sistema web pensado para o dia a dia real de uma padaria: rápido no balcão,
claro para a equipe e confiável para quem cuida do negócio.

[![Release](https://img.shields.io/github/v/release/EvandroOdairCagniniJr/Coffee-Break?color=b9772f&label=vers%C3%A3o)](https://github.com/EvandroOdairCagniniJr/Coffee-Break/releases)
![React](https://img.shields.io/badge/React-19-5a3a22?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-5a3a22?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-5a3a22?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-5a3a22?logo=postgresql&logoColor=white)

[Funcionalidades](#-funcionalidades) ·
[Perfis de acesso](#-perfis-de-acesso) ·
[Como rodar](#-como-rodar) ·
[Arquitetura](#-arquitetura) ·
[Novidades](https://github.com/EvandroOdairCagniniJr/Coffee-Break/releases)

</div>

---

## ✨ Por que o Coffee Break

- **Feito para o balcão.** O PDV registra uma venda em poucos toques e já dá baixa no estoque.
- **Cada um vê o que usa.** Dono, gerente e funcionário têm telas e permissões próprias,
  conferidas no servidor — não apenas escondidas na tela.
- **Nada some sem rastro.** Ajustes de estoque, devoluções e alterações de perfil ficam
  registrados com quem fez, quando e por quê.
- **Uma plataforma, muitas padarias.** Cada padaria se cadastra sozinha e tem seus dados
  completamente isolados das demais — produtos, vendas, equipe e financeiro.
- **Na internet ou na rede da padaria.** Publicado na nuvem com HTTPS, ou rodando num computador
  da loja; nos dois casos, basta um navegador.
- **Com a cara da sua padaria.** O nome cadastrado aparece no topo do sistema e no
  comprovante enviado ao cliente.

## 🥖 Funcionalidades

| Módulo | O que resolve |
|---|---|
| **PDV** | Venda rápida no balcão, cálculo de troco e comprovante enviado pelo WhatsApp do cliente. |
| **Vendas** | Histórico com busca por comprovante, produto ou vendedor; 2ª via do comprovante; **devolução de venda** com retorno ao estoque. |
| **Dashboard** | Vendas do dia, estoque baixo, contas a vencer e produções pendentes em uma só tela. |
| **Produtos** | Cadastro com preço de venda, custo, unidade, categoria, ícone e foto. |
| **Estoque** | Entradas, saídas e ajustes com histórico completo e alerta de estoque mínimo. |
| **Produção** | Ficha técnica (receitas) e planejamento; ao concluir, os ingredientes saem e o produto pronto entra no estoque. |
| **Financeiro** | Contas a pagar e a receber e fluxo de caixa. |
| **Equipe** | Cadastro completo, liberação de acessos, desempenho por pessoa, mural, ranking e conquistas. |
| **Minha padaria** | Nome, CNPJ, endereço e mensagem do comprovante. |
| **Guia e dicas** | Passo a passo de cada tela, adaptado ao perfil de quem está usando. |

### Contas e segurança

- **Cadastrar minha padaria:** o dono cria a padaria e a própria conta em poucos passos.
- **Entrar na equipe:** o funcionário cria a conta com o **código de convite** que o dono vê em
  Equipe, e fica *aguardando liberação* até ser aprovado.
- **Esqueci minha senha** com código de 6 dígitos enviado por e-mail — válido por 15 minutos,
  de uso único e com limite de tentativas. Com o código, a pessoa entra e pode definir uma
  senha nova na hora.
- Senhas com hash **bcrypt**, sessão em **cookie httpOnly** (JWT) e respostas que não revelam
  quais e-mails estão cadastrados.

### Devolução de vendas

O cliente voltou e não quer mais o produto? Dono ou gerente abre a venda, informa o motivo e
confirma. Os itens **voltam ao estoque**, o valor **sai do faturamento, das metas e dos
rankings**, e a venda **permanece no histórico** marcada como *Devolvida* — com responsável,
data e motivo.

## 👥 Perfis de acesso

| | Dono | Gerente | Funcionário |
|---|:-:|:-:|:-:|
| PDV, Vendas, Estoque, Produção (planejar e concluir) | ✓ | ✓ | ✓ |
| Dashboard, Produtos, Financeiro, editar receitas | ✓ | ✓ | |
| Devolução de vendas | ✓ | ✓ | |
| Equipe (cadastro e liberação de acessos), Minha padaria | ✓ | | |

## 🚀 Como rodar

**Pré-requisitos:** Node.js 22.18+ (roda o TypeScript do servidor direto) e um banco PostgreSQL —
o do [Supabase](https://supabase.com) (plano gratuito) ou o banco local embutido (`npm run banco:local`).

```bash
# 1. Instale as dependências
npm install

# 2. Crie o arquivo de configuração e preencha o DATABASE_URL
cp .env.example .env

# (opcional) sem Supabase: banco local embutido, em outro terminal
npm run banco:local

# 3. Gere o build e suba o servidor
npm start
```

Abra **http://localhost:3000**. O schema `padaria` e as tabelas são criados
automaticamente. Em **Criar conta → Cadastrar minha padaria**, crie a padaria e a conta do
**dono**; a equipe entra por **Criar conta → Entrar na equipe**, com o código de convite.

O terminal também mostra o endereço na rede (ex.: `http://192.168.0.10:3000`) para abrir nos
outros computadores e celulares da padaria.

### Configuração (`.env`)

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Connection string do PostgreSQL (Supabase: *Connect → Session pooler*) |
| `JWT_SECRET` | Chave que assina os logins — use um texto longo e aleatório (obrigatória em produção) |
| `DATABASE_SSL` | `false` só para o banco local; com o Supabase a conexão é criptografada |
| `PORT` | Porta do servidor (padrão `3000`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Envio do código de "Esqueci minha senha" |

> **Gmail:** `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465` e, em `SMTP_PASS`, uma
> [senha de app](https://myaccount.google.com/apppasswords) (exige verificação em 2 etapas).
> Sem SMTP configurado, o código aparece no terminal do servidor.

## ☁️ Publicar na internet

O repositório já traz o [`render.yaml`](render.yaml) para o [Render](https://render.com):

1. No [Supabase](https://supabase.com), em **Connect → Session pooler**, copie a URI do banco
   (troque `[YOUR-PASSWORD]` pela senha do banco).
2. No Render: **New → Blueprint** e escolha este repositório.
3. Preencha `DATABASE_URL` e, para o "Esqueci minha senha", as `SMTP_*`. O `JWT_SECRET` é
   gerado automaticamente.
4. Pronto: o Render gera o build, cria as tabelas no banco e publica com HTTPS.

> As tabelas ficam no schema `padaria`, **fora da API pública** do Supabase, e com RLS ligado:
> só o servidor do Coffee Break acessa os dados. Tem uma instalação antiga em MySQL?
> `npm run migrar:mysql` copia tudo para o PostgreSQL.

## 🔐 Segurança

- **Senhas** com hash bcrypt; senhas novas com 8+ caracteres, letras e números.
- **Bloqueio de conta** por 15 minutos após 5 senhas erradas seguidas; o código por e-mail destrava.
- **Sessão** em cookie httpOnly e seguro (HTTPS); trocar a senha ou desativar o acesso derruba
  os logins abertos em outros aparelhos. Botão **Sair de todos os aparelhos** no perfil.
- **Cabeçalhos de proteção**: Content-Security-Policy, HSTS, anti-clickjacking, nosniff.
- **CSRF**: ações só são aceitas vindas do próprio site.
- **Limite de requisições** por IP (geral e nas rotas de login e recuperação).
- **Isolamento por padaria** em todas as consultas e **registro de acessos** visível ao dono.
- Recuperação de senha que **não revela** quais e-mails estão cadastrados.

## 🧱 Arquitetura

Documentação técnica completa em [docs/](docs/): [ARQUITETURA.md](docs/ARQUITETURA.md) (diagramas e fluxos), [API.md](docs/API.md) (todas as rotas e quem pode acessar) e [BANCO.md](docs/BANCO.md) (diagrama ER e tabelas). Os dois últimos são gerados do código com `npm run docs`.

```
Navegador (React)  ──/api──▶  Servidor Node/Express  ──▶  PostgreSQL (Supabase)
       ▲                          │
       └──── site (dist/) ────────┘   mesmo endereço e porta
```

| Camada | Tecnologias |
|---|---|
| Interface | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, TanStack Query, React Hook Form + Zod |
| Servidor | Node.js, Express 5, node-postgres, JWT, bcrypt, Nodemailer |
| Banco | PostgreSQL (Supabase) — schema idempotente aplicado na inicialização (`server/schema.sql`) |

Cada tabela de negócio carrega o `padaria_id`, e toda consulta do servidor filtra pela padaria
de quem está logado — uma padaria nunca lê nem altera dados de outra. Rotas públicas de login,
cadastro e recuperação de senha têm limite de tentativas por minuto.

Regras de negócio que mexem em mais de uma tabela (venda, devolução, movimentação de estoque,
conclusão de produção) rodam em **transações** no servidor. Preços sempre vêm do cadastro,
nunca do navegador.

```
server/               API, autenticação, regras de negócio e schema
src/app/              rotas, layout e controle de acesso por perfil
src/features/<módulo> telas e hooks de dados de cada módulo
src/components/       componentes compartilhados (ui/ = shadcn)
src/lib/              utilitários (formatação, documentos, imagens, permissões)
```

### Scripts

| Comando | Descrição |
|---|---|
| `npm start` | Build de produção + servidor |
| `npm run dev:server` | API em `localhost:3000`, reiniciando ao salvar |
| `npm run dev` | Interface com recarregamento instantâneo em `localhost:5173` (encaminha `/api`) |
| `npm run build` | Checagem de tipos e build |
| `npm run lint` | Lint com oxlint |

## 🗺️ Novidades

Cada versão é publicada em [**Releases**](https://github.com/EvandroOdairCagniniJr/Coffee-Break/releases),
com o que mudou e o que é preciso configurar.

---

## 📄 Licença

Software proprietário — todos os direitos reservados. Veja [LICENSE](LICENSE).

<div align="center">
<sub>Feito com carinho para quem acorda antes do sol. 🥐</sub>
</div>
