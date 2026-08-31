-- Padaria Info — módulo Financeiro (contas a pagar/receber)

create table contas_financeiras (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('pagar', 'receber')),
  descricao text not null,
  categoria text,
  valor numeric(10, 2) not null check (valor >= 0),
  data_vencimento date not null,
  data_pagamento date,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  forma_pagamento text,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index contas_financeiras_tipo_status_idx on contas_financeiras (tipo, status);
create index contas_financeiras_data_vencimento_idx on contas_financeiras (data_vencimento);

alter table contas_financeiras enable row level security;

create policy "authenticated select contas_financeiras" on contas_financeiras
  for select to authenticated using (true);
create policy "authenticated insert contas_financeiras" on contas_financeiras
  for insert to authenticated with check (true);
create policy "authenticated update contas_financeiras" on contas_financeiras
  for update to authenticated using (true) with check (true);
create policy "authenticated delete contas_financeiras" on contas_financeiras
  for delete to authenticated using (true);
