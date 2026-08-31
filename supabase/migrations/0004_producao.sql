-- Padaria Info — módulo Produção/Receitas
-- Ingredientes são produtos (reaproveita a tabela `produtos` já existente).

create table receitas (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos (id),
  nome text not null,
  rendimento numeric(10, 3) not null check (rendimento > 0),
  modo_preparo text,
  created_at timestamptz not null default now()
);

create table receita_itens (
  id uuid primary key default gen_random_uuid(),
  receita_id uuid not null references receitas (id) on delete cascade,
  ingrediente_id uuid not null references produtos (id),
  quantidade numeric(10, 3) not null check (quantidade > 0)
);

create table producoes (
  id uuid primary key default gen_random_uuid(),
  receita_id uuid not null references receitas (id),
  data date not null,
  status text not null default 'planejado' check (status in ('planejado', 'concluido', 'cancelado')),
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  concluida_em timestamptz
);

create index receitas_produto_id_idx on receitas (produto_id);
create index receita_itens_receita_id_idx on receita_itens (receita_id);
create index receita_itens_ingrediente_id_idx on receita_itens (ingrediente_id);
create index producoes_receita_id_idx on producoes (receita_id);
create index producoes_status_idx on producoes (status);

alter table receitas enable row level security;
alter table receita_itens enable row level security;
alter table producoes enable row level security;

create policy "authenticated select receitas" on receitas
  for select to authenticated using (true);
create policy "authenticated insert receitas" on receitas
  for insert to authenticated with check (true);
create policy "authenticated update receitas" on receitas
  for update to authenticated using (true) with check (true);
create policy "authenticated delete receitas" on receitas
  for delete to authenticated using (true);

create policy "authenticated select receita_itens" on receita_itens
  for select to authenticated using (true);
create policy "authenticated insert receita_itens" on receita_itens
  for insert to authenticated with check (true);
create policy "authenticated delete receita_itens" on receita_itens
  for delete to authenticated using (true);

create policy "authenticated select producoes" on producoes
  for select to authenticated using (true);
create policy "authenticated insert producoes" on producoes
  for insert to authenticated with check (true);
create policy "authenticated update producoes" on producoes
  for update to authenticated using (true) with check (true);
create policy "authenticated delete producoes" on producoes
  for delete to authenticated using (true);

-- Conclui uma produção planejada: dá baixa nos ingredientes da receita e
-- entrada no produto final, reaproveitando registrar_movimentacao_estoque
-- (definida em 0002_functions.sql) — mesmo princípio de finalizar_venda.
create function concluir_producao(p_producao_id uuid) returns void
language plpgsql
as $$
declare
  v_receita_id uuid;
  v_status text;
  v_produto_id uuid;
  v_rendimento numeric(10, 3);
  v_item record;
begin
  select receita_id, status into v_receita_id, v_status
  from producoes
  where id = p_producao_id;

  if v_status is null then
    raise exception 'Produção % não encontrada', p_producao_id;
  end if;

  if v_status <> 'planejado' then
    raise exception 'Produção % não está mais planejada (status atual: %)', p_producao_id, v_status;
  end if;

  select produto_id, rendimento into v_produto_id, v_rendimento
  from receitas
  where id = v_receita_id;

  for v_item in select ingrediente_id, quantidade from receita_itens where receita_id = v_receita_id
  loop
    perform registrar_movimentacao_estoque(v_item.ingrediente_id, 'saida', v_item.quantidade, 'producao');
  end loop;

  perform registrar_movimentacao_estoque(v_produto_id, 'entrada', v_rendimento, 'producao');

  update producoes
  set status = 'concluido', concluida_em = now()
  where id = p_producao_id;
end;
$$;
