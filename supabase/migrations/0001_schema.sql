-- Padaria Info — schema inicial (Fase 2: Produtos/Estoque + PDV)
-- Modelo single-tenant por enquanto: todas as linhas pertencem à mesma padaria.
-- Extensão futura para multi-tenant: adicionar coluna `padaria_id` nas tabelas
-- abaixo e trocar as policies de "authenticated" para "padaria_id = current padaria".

create extension if not exists pgcrypto;

create table produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text,
  unidade text not null default 'un',
  preco_venda numeric(10, 2) not null check (preco_venda >= 0),
  preco_custo numeric(10, 2) check (preco_custo >= 0),
  estoque_atual numeric(10, 3) not null default 0,
  estoque_minimo numeric(10, 3) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos (id),
  tipo text not null check (tipo in ('entrada', 'saida', 'ajuste')),
  quantidade numeric(10, 3) not null,
  motivo text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create table vendas (
  id uuid primary key default gen_random_uuid(),
  total numeric(10, 2) not null check (total >= 0),
  forma_pagamento text not null
    check (forma_pagamento in ('dinheiro', 'cartao_credito', 'cartao_debito', 'pix')),
  status text not null default 'concluida',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create table vendas_itens (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references vendas (id) on delete cascade,
  produto_id uuid not null references produtos (id),
  quantidade numeric(10, 3) not null check (quantidade > 0),
  preco_unitario numeric(10, 2) not null check (preco_unitario >= 0),
  subtotal numeric(10, 2) not null check (subtotal >= 0)
);

create index movimentacoes_estoque_produto_id_idx on movimentacoes_estoque (produto_id);
create index vendas_itens_venda_id_idx on vendas_itens (venda_id);
create index vendas_itens_produto_id_idx on vendas_itens (produto_id);

alter table produtos enable row level security;
alter table movimentacoes_estoque enable row level security;
alter table vendas enable row level security;
alter table vendas_itens enable row level security;

-- Single-tenant: qualquer usuário autenticado do projeto Supabase é um
-- funcionário/dono da padaria e pode ler/escrever tudo.
create policy "authenticated select produtos" on produtos
  for select to authenticated using (true);
create policy "authenticated insert produtos" on produtos
  for insert to authenticated with check (true);
create policy "authenticated update produtos" on produtos
  for update to authenticated using (true) with check (true);

create policy "authenticated select movimentacoes_estoque" on movimentacoes_estoque
  for select to authenticated using (true);
create policy "authenticated insert movimentacoes_estoque" on movimentacoes_estoque
  for insert to authenticated with check (true);

create policy "authenticated select vendas" on vendas
  for select to authenticated using (true);
create policy "authenticated insert vendas" on vendas
  for insert to authenticated with check (true);

create policy "authenticated select vendas_itens" on vendas_itens
  for select to authenticated using (true);
create policy "authenticated insert vendas_itens" on vendas_itens
  for insert to authenticated with check (true);
