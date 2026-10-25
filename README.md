<div align="center">

<img src="public/favicon.svg" alt="Padaria Info" width="96" height="96" />

# Padaria Info

**Gestão completa para padarias — do balcão ao forno, do estoque ao caixa.**

Um sistema web pensado para o dia a dia real de uma padaria: rápido no balcão,
claro para a equipe e confiável para quem cuida do negócio.

[![Release](https://img.shields.io/github/v/release/EvandroOdairCagniniJr/Padaria-Info?color=b9772f&label=vers%C3%A3o)](https://github.com/EvandroOdairCagniniJr/Padaria-Info/releases)
![React](https://img.shields.io/badge/React-19-5a3a22?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-5a3a22?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-5a3a22?logo=nodedotjs&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-5a3a22?logo=mysql&logoColor=white)

[Funcionalidades](#-funcionalidades) ·
[Perfis de acesso](#-perfis-de-acesso) ·
[Como rodar](#-como-rodar) ·
[Arquitetura](#-arquitetura) ·
[Novidades](https://github.com/EvandroOdairCagniniJr/Padaria-Info/releases)

</div>

---

## ✨ Por que o Padaria Info

- **Feito para o balcão.** O PDV registra uma venda em poucos toques e já dá baixa no estoque.
- **Cada um vê o que usa.** Dono, gerente e funcionário têm telas e permissões próprias,
  conferidas no servidor — não apenas escondidas na tela.
- **Nada some sem rastro.** Ajustes de estoque, devoluções e alterações de perfil ficam
  registrados com quem fez, quando e por quê.
- **Funciona na rede da padaria.** Um computador roda o servidor; os demais computadores e
  celulares só precisam do navegador.
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

- **Entrar ou criar conta** direto na tela de login. Contas novas ficam *aguardando liberação*
  até o dono aprovar.
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

**Pré-requisitos:** Node.js 22.18+ (roda o TypeScript do servidor direto) e MySQL 8 (no Windows, o serviço `MySQL80`).

```bash
# 1. Instale as dependências
npm install

# 2. Crie o arquivo de configuração e preencha os dados
cp .env.example .env

# 3. Gere o build e suba o servidor
npm start
```

Abra **http://localhost:3000**. O banco `padaria_info` e as tabelas são criados
automaticamente. No primeiro acesso, o sistema guia a criação da conta do **dono** e o cadastro
da padaria; os demais membros entram por **Equipe** ou por **Criar conta**.

O terminal também mostra o endereço na rede (ex.: `http://192.168.0.10:3000`) para abrir nos
outros computadores e celulares da padaria.

### Configuração (`.env`)

| Variável | Para quê |
|---|---|
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | Conexão com o MySQL |
| `JWT_SECRET` | Chave que assina os logins — use um texto longo e aleatório |
| `PORT` | Porta do servidor (padrão `3000`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Envio do código de "Esqueci minha senha" |

> **Gmail:** `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465` e, em `SMTP_PASS`, uma
> [senha de app](https://myaccount.google.com/apppasswords) (exige verificação em 2 etapas).
> Sem SMTP configurado, o código aparece no terminal do servidor.

## 🧱 Arquitetura

```
Navegador (React)  ──/api──▶  Servidor Node/Express  ──▶  MySQL 8
       ▲                          │
       └──── site (dist/) ────────┘   mesmo endereço e porta
```

| Camada | Tecnologias |
|---|---|
| Interface | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, TanStack Query, React Hook Form + Zod |
| Servidor | Node.js, Express 5, mysql2, JWT, bcrypt, Nodemailer |
| Banco | MySQL 8 — schema idempotente aplicado na inicialização (`server/schema.sql`) |

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

Cada versão é publicada em [**Releases**](https://github.com/EvandroOdairCagniniJr/Padaria-Info/releases),
com o que mudou e o que é preciso configurar.

---

<div align="center">
<sub>Feito com carinho para quem acorda antes do sol. 🥐</sub>
</div>
