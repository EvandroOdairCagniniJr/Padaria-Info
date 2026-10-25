# Padaria Info

Sistema web de gestão para padarias — feito para uso nos computadores da padaria, com foco em qualidade e praticidade no dia a dia.

Stack: React + Vite + TypeScript, Tailwind CSS + shadcn/ui no navegador; servidor Node (Express) + MySQL 8. O servidor entrega o site e a API no mesmo endereço, então os outros computadores e celulares da rede só precisam do navegador.

## Módulos

- **Login e papéis**: dono, admin (gerente) e funcionário. Cada um vê só o que usa
- **Dashboard**: vendas do dia, estoque baixo, contas a vencer, produções pendentes
- **PDV**: venda rápida no balcão, com comprovante enviado pelo WhatsApp do cliente
- **Produtos** e **Estoque**: entradas, saídas e ajustes, com histórico de quem fez
- **Produção/Receitas**: ficha técnica e planejamento; concluir dá baixa nos ingredientes
- **Financeiro**: contas a pagar e a receber
- **Equipe** (só o dono): cadastro e acessos, desempenho por pessoa e linha do tempo
- **Guia e dicas**: passo a passo para cada papel, com aviso de boas-vindas no primeiro acesso

| | Dono | Admin | Funcionário |
|---|:-:|:-:|:-:|
| PDV, Estoque, Produção (planejar/concluir) | ✓ | ✓ | ✓ |
| Dashboard, Produtos, Financeiro, editar receitas | ✓ | ✓ | |
| Equipe | ✓ | | |

As permissões são checadas no servidor, não só escondidas na tela.

## Configuração

1. **MySQL 8** instalado e rodando (no Windows: serviço `MySQL80`).
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Copie `.env.example` para `.env` e preencha a senha do MySQL e um `JWT_SECRET` aleatório. Opcional: `VITE_NOME_PADARIA` com o nome que sai no comprovante.
4. Suba tudo:
   ```bash
   npm start
   ```
   Isso gera o build e liga o servidor. O banco `padaria_info` e as tabelas são criados sozinhos.
5. Abra http://localhost:3000. No primeiro acesso a tela pede para criar a conta do **dono**. Os demais membros são cadastrados em **Equipe**.

O terminal mostra também o endereço de rede (ex: `http://192.168.0.10:3000`) para abrir nos outros computadores da padaria. O computador com o servidor precisa ficar ligado.

## Desenvolvimento

- `npm run dev:server` — API em http://localhost:3000, reinicia ao salvar
- `npm run dev` — front com recarregamento instantâneo em http://localhost:5173 (encaminha `/api` para o servidor)
- `npm run build` — type-check e build de produção
- `npm run lint` — lint (oxlint)

Estrutura: `server/` (API, regras de negócio em transações, `schema.sql`), `src/features/<módulo>/` (telas e hooks de dados de cada módulo).
