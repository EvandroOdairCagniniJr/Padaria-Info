-- Funções que centralizam a lógica de estoque/vendas para evitar
-- inconsistências entre múltiplos usuários do PDV.
-- Rodam com SECURITY INVOKER (padrão): respeitam as RLS policies do usuário logado.

create function registrar_movimentacao_estoque(
  p_produto_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_motivo text default null
) returns void
language plpgsql
as $$
begin
  insert into movimentacoes_estoque (produto_id, tipo, quantidade, motivo, created_by)
  values (p_produto_id, p_tipo, p_quantidade, p_motivo, auth.uid());

  update produtos
  set estoque_atual = case p_tipo
    when 'entrada' then estoque_atual + p_quantidade
    when 'saida' then estoque_atual - p_quantidade
    when 'ajuste' then p_quantidade
    else estoque_atual
  end
  where id = p_produto_id;
end;
$$;

-- p_itens: jsonb array de { produto_id, quantidade, preco_unitario }
create function finalizar_venda(
  p_itens jsonb,
  p_forma_pagamento text
) returns uuid
language plpgsql
as $$
declare
  v_venda_id uuid;
  v_total numeric(10, 2);
  v_item jsonb;
begin
  select coalesce(sum((item->>'quantidade')::numeric * (item->>'preco_unitario')::numeric), 0)
  into v_total
  from jsonb_array_elements(p_itens) as item;

  insert into vendas (total, forma_pagamento, created_by)
  values (v_total, p_forma_pagamento, auth.uid())
  returning id into v_venda_id;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    insert into vendas_itens (venda_id, produto_id, quantidade, preco_unitario, subtotal)
    values (
      v_venda_id,
      (v_item->>'produto_id')::uuid,
      (v_item->>'quantidade')::numeric,
      (v_item->>'preco_unitario')::numeric,
      (v_item->>'quantidade')::numeric * (v_item->>'preco_unitario')::numeric
    );

    perform registrar_movimentacao_estoque(
      (v_item->>'produto_id')::uuid,
      'saida',
      (v_item->>'quantidade')::numeric,
      'venda'
    );
  end loop;

  return v_venda_id;
end;
$$;
