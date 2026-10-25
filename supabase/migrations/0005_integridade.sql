-- Padaria Info — reforços de integridade nas funções e políticas.
--
-- 1. registrar_movimentacao_estoque valida tipo/quantidade e produto existente.
-- 2. finalizar_venda usa o preço cadastrado no banco (não confia no preço enviado
--    pelo cliente) e rejeita carrinho vazio ou quantidades inválidas.
-- 3. concluir_producao trava a linha da produção (FOR UPDATE) para que dois
--    cliques/usuários simultâneos não deem baixa no estoque duas vezes.
-- 4. salvar_receita grava receita + ingredientes numa única transação
--    (antes o update apagava os itens e, se o insert falhasse, a receita ficava vazia).
-- 5. Produções concluídas não podem mais ser removidas (o estoque já foi movimentado).
-- Todas as funções fixam search_path, como recomenda o Supabase.

create or replace function registrar_movimentacao_estoque(
  p_produto_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_motivo text default null
) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_tipo not in ('entrada', 'saida', 'ajuste') then
    raise exception 'Tipo de movimentação inválido: %', p_tipo;
  end if;

  if p_quantidade is null or p_quantidade < 0 or (p_tipo <> 'ajuste' and p_quantidade = 0) then
    raise exception 'Quantidade inválida: %', p_quantidade;
  end if;

  update produtos
  set estoque_atual = case p_tipo
    when 'entrada' then estoque_atual + p_quantidade
    when 'saida' then estoque_atual - p_quantidade
    else p_quantidade
  end
  where id = p_produto_id;

  if not found then
    raise exception 'Produto % não encontrado', p_produto_id;
  end if;

  insert into movimentacoes_estoque (produto_id, tipo, quantidade, motivo, created_by)
  values (p_produto_id, p_tipo, p_quantidade, p_motivo, auth.uid());
end;
$$;

-- p_itens: jsonb array de { produto_id, quantidade } (preco_unitario, se enviado, é ignorado)
create or replace function finalizar_venda(
  p_itens jsonb,
  p_forma_pagamento text
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_venda_id uuid;
  v_item record;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A venda precisa ter pelo menos um item';
  end if;

  insert into vendas (total, forma_pagamento, created_by)
  values (0, p_forma_pagamento, auth.uid())
  returning id into v_venda_id;

  for v_item in
    select (item->>'produto_id')::uuid as produto_id,
           (item->>'quantidade')::numeric as quantidade,
           p.preco_venda,
           p.ativo
    from jsonb_array_elements(p_itens) as item
    left join produtos p on p.id = (item->>'produto_id')::uuid
  loop
    if v_item.preco_venda is null or not v_item.ativo then
      raise exception 'Produto % não encontrado ou inativo', v_item.produto_id;
    end if;
    if v_item.quantidade is null or v_item.quantidade <= 0 then
      raise exception 'Quantidade inválida para o produto %', v_item.produto_id;
    end if;

    insert into vendas_itens (venda_id, produto_id, quantidade, preco_unitario, subtotal)
    values (
      v_venda_id,
      v_item.produto_id,
      v_item.quantidade,
      v_item.preco_venda,
      round(v_item.quantidade * v_item.preco_venda, 2)
    );

    perform registrar_movimentacao_estoque(v_item.produto_id, 'saida', v_item.quantidade, 'venda');
  end loop;

  update vendas
  set total = (select coalesce(sum(subtotal), 0) from vendas_itens where venda_id = v_venda_id)
  where id = v_venda_id;

  return v_venda_id;
end;
$$;

-- finalizar_venda agora atualiza o total após inserir os itens.
create policy "authenticated update vendas" on vendas
  for update to authenticated using (true) with check (true);

create or replace function concluir_producao(p_producao_id uuid) returns void
language plpgsql
set search_path = public
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
  where id = p_producao_id
  for update;

  if v_status is null then
    raise exception 'Produção % não encontrada', p_producao_id;
  end if;

  if v_status <> 'planejado' then
    raise exception 'Esta produção não está mais planejada (status atual: %)', v_status;
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

-- p_id null = cria; caso contrário atualiza. p_itens: jsonb array de { ingrediente_id, quantidade }.
create function salvar_receita(
  p_id uuid,
  p_produto_id uuid,
  p_nome text,
  p_rendimento numeric,
  p_modo_preparo text,
  p_itens jsonb
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A receita precisa ter pelo menos um ingrediente';
  end if;

  if p_id is null then
    insert into receitas (produto_id, nome, rendimento, modo_preparo)
    values (p_produto_id, p_nome, p_rendimento, p_modo_preparo)
    returning id into v_id;
  else
    update receitas
    set produto_id = p_produto_id, nome = p_nome, rendimento = p_rendimento, modo_preparo = p_modo_preparo
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Receita % não encontrada', p_id;
    end if;

    delete from receita_itens where receita_id = v_id;
  end if;

  insert into receita_itens (receita_id, ingrediente_id, quantidade)
  select v_id, (item->>'ingrediente_id')::uuid, (item->>'quantidade')::numeric
  from jsonb_array_elements(p_itens) as item;

  return v_id;
end;
$$;

drop policy "authenticated delete producoes" on producoes;
create policy "authenticated delete producoes" on producoes
  for delete to authenticated using (status <> 'concluido');
