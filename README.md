# Padaria Info

Sistema web de gestão para padarias — feito para uso em computadores, com foco em qualidade e praticidade no dia a dia.

Stack: React + Vite + TypeScript, Tailwind CSS + shadcn/ui, Supabase (banco de dados, autenticação e API).

## Módulos

Concluídos (Fase 1 e 2):
- Autenticação (login)
- Dashboard
- Produtos (cadastro)
- Estoque (entradas, saídas e ajustes)
- PDV (venda rápida no balcão)

Planejados para próximas fases:
- Financeiro (contas a pagar/receber, fluxo de caixa)
- Produção/Receitas (ficha técnica, planejamento de produção)

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar um projeto no Supabase

1. Crie uma conta e um projeto em [supabase.com](https://supabase.com) (o plano gratuito é suficiente para começar).
2. No painel do projeto, vá em **Settings → API** e copie a **Project URL** e a **anon public key**.
3. Copie `.env.example` para `.env.local` e preencha os dois valores:

```bash
cp .env.example .env.local
```

Sem essas credenciais o app sobe normalmente e a tela de login aparece, mas o login não funciona.

### 3. Rodar as migrations do banco

No painel do Supabase, abra o **SQL Editor** e execute, em ordem, o conteúdo dos arquivos em `supabase/migrations/`:

1. `0001_schema.sql` — cria as tabelas e as políticas de acesso (RLS)
2. `0002_functions.sql` — cria as funções que registram movimentações de estoque e finalizam vendas

(Alternativamente, se preferir usar o Supabase CLI: `supabase db push`.)

### 4. Criar um usuário de teste

No painel do Supabase, vá em **Authentication → Users → Add user** e crie um usuário com e-mail e senha. É esse usuário que você usará para logar no sistema (não há tela de cadastro pública ainda — o acesso é apenas para a equipe da padaria).

### 5. Rodar o projeto

```bash
npm run dev
```

Acesse http://localhost:5173.

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção (roda o type-check antes)
- `npm run lint` — lint (oxlint)
- `npm run preview` — pré-visualiza o build de produção
