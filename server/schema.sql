-- Padaria Info — schema PostgreSQL (Supabase). Aplicado automaticamente ao iniciar o servidor;
-- todas as instruções são idempotentes (rodar de novo não estraga nada).
--
-- Tudo fica no schema "padaria", FORA do schema public: a API automática do Supabase (PostgREST)
-- só expõe o public, então ninguém acessa estas tabelas pela URL do projeto. Como segunda trava,
-- todas têm RLS ligado sem políticas (só o servidor, que conecta como dono das tabelas, enxerga).
--
-- Multi-padaria: toda tabela de negócio tem padaria_id e toda consulta do servidor filtra por ele.
-- Ids são UUIDs gerados pelo servidor (texto). Dinheiro em numeric(10,2); datas/horas em timestamptz.

create schema if not exists padaria;
-- Nenhum papel além do dono usa o schema (anon/authenticated do Supabase ficam de fora).
revoke all on schema padaria from public;
set search_path to padaria;

-- Padarias (SaaS). dados = cadastro (nome, CNPJ, endereço...) em JSON.
-- codigo_convite: o funcionário informa em "Criar conta" para pedir acesso à equipe.
create table if not exists padarias (
  id text primary key,
  dados jsonb not null,
  codigo_convite char(8) not null unique,
  created_at timestamptz not null default now()
);

-- papel: dono (tudo + Equipe), admin (gerente: toda a operação), funcionario (PDV, estoque, produção).
create table if not exists usuarios (
  id text primary key,
  padaria_id text references padarias (id),
  nome varchar(255) not null default '',
  email varchar(255) not null unique,
  senha_hash varchar(255) not null,
  papel text not null default 'funcionario' check (papel in ('dono', 'admin', 'funcionario')),
  -- cargo: a função na padaria (Caixa, Padeiro(a)...), só para exibição.
  cargo varchar(60) not null default '',
  foto text,
  telefone varchar(11),
  cpf char(11),
  data_nascimento date,
  data_admissao date,
  turno text check (turno in ('manha', 'tarde', 'noite', 'madrugada', 'integral')),
  endereco jsonb,
  contato_emergencia jsonb,
  observacoes text,
  ativo boolean not null default true,
  ultimo_acesso timestamptz,
  -- Segurança: bloqueio após senhas erradas e versão da sessão (trocar a senha derruba logins).
  falhas_login int not null default 0,
  bloqueado_ate timestamptz,
  sessao_versao int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists usuarios_padaria_idx on usuarios (padaria_id);

create table if not exists produtos (
  id text primary key,
  padaria_id text not null references padarias (id),
  nome varchar(255) not null,
  categoria varchar(255),
  -- Variedade de: produtos com o mesmo grupo (ex.: "Café") viram um card só no PDV.
  grupo varchar(80),
  unidade varchar(20) not null default 'un',
  preco_venda numeric(10, 2) not null check (preco_venda >= 0),
  preco_custo numeric(10, 2) check (preco_custo >= 0),
  estoque_atual numeric(10, 3) not null default 0,
  estoque_minimo numeric(10, 3) not null default 0,
  ativo boolean not null default true,
  emoji varchar(16),
  foto text,
  created_at timestamptz not null default now()
);
create index if not exists produtos_padaria_idx on produtos (padaria_id);

create table if not exists movimentacoes_estoque (
  id text primary key,
  padaria_id text not null,
  produto_id text not null references produtos (id),
  tipo text not null check (tipo in ('entrada', 'saida', 'ajuste')),
  quantidade numeric(10, 3) not null,
  motivo varchar(255),
  created_at timestamptz not null default now(),
  created_by text references usuarios (id)
);
create index if not exists movimentacoes_padaria_idx on movimentacoes_estoque (padaria_id, created_at);
create index if not exists movimentacoes_created_by_idx on movimentacoes_estoque (created_by, created_at);

-- Caixa (gaveta) de cada operador: abertura com fundo de troco, sangrias/suprimentos e fechamento.
create table if not exists caixas (
  id text primary key,
  padaria_id text not null,
  operador_id text not null references usuarios (id),
  aberto_em timestamptz not null default now(),
  fundo_troco numeric(10, 2) not null default 0,
  fechado_em timestamptz,
  -- Fechamento: o que o sistema esperava e o que foi contado, por forma de pagamento.
  esperado jsonb,
  contado jsonb,
  diferenca numeric(10, 2),
  observacoes varchar(500)
);
create index if not exists caixas_padaria_idx on caixas (padaria_id, aberto_em);
create index if not exists caixas_operador_idx on caixas (operador_id, fechado_em);

-- status: concluida | devolvida (devolvida não entra em nenhum total; o estoque já voltou).
create table if not exists vendas (
  id text primary key,
  padaria_id text not null,
  total numeric(10, 2) not null check (total >= 0),
  forma_pagamento text not null
    check (forma_pagamento in ('dinheiro', 'cartao_credito', 'cartao_debito', 'pix')),
  -- Quanto o cliente entregou em dinheiro (para o troco na 2ª via do comprovante).
  valor_recebido numeric(10, 2),
  status varchar(20) not null default 'concluida',
  devolvida_em timestamptz,
  devolvida_por text,
  motivo_devolucao varchar(255),
  desconto_promocoes numeric(10, 2) not null default 0,
  desconto_manual numeric(10, 2) not null default 0,
  caixa_id text,
  created_at timestamptz not null default now(),
  created_by text references usuarios (id)
);
create index if not exists vendas_padaria_data_idx on vendas (padaria_id, created_at);
create index if not exists vendas_created_by_idx on vendas (created_by, created_at);
create index if not exists vendas_caixa_idx on vendas (caixa_id);

create table if not exists vendas_itens (
  id text primary key,
  venda_id text not null references vendas (id) on delete cascade,
  produto_id text not null references produtos (id),
  quantidade numeric(10, 3) not null check (quantidade > 0),
  preco_unitario numeric(10, 2) not null check (preco_unitario >= 0),
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  -- Desconto do item (promoção e parte do desconto manual) e a promoção aplicada.
  desconto numeric(10, 2) not null default 0,
  promocao_id text
);
create index if not exists vendas_itens_venda_idx on vendas_itens (venda_id);
create index if not exists vendas_itens_produto_idx on vendas_itens (produto_id);

create table if not exists contas_financeiras (
  id text primary key,
  padaria_id text not null,
  tipo text not null check (tipo in ('pagar', 'receber')),
  descricao varchar(255) not null,
  categoria varchar(255),
  valor numeric(10, 2) not null check (valor >= 0),
  data_vencimento date not null,
  data_pagamento date,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  forma_pagamento varchar(50),
  observacoes text,
  created_at timestamptz not null default now(),
  created_by text references usuarios (id)
);
create index if not exists contas_padaria_idx on contas_financeiras (padaria_id, data_vencimento);

create table if not exists receitas (
  id text primary key,
  padaria_id text not null,
  produto_id text not null references produtos (id),
  nome varchar(255) not null,
  rendimento numeric(10, 3) not null check (rendimento > 0),
  modo_preparo text,
  created_at timestamptz not null default now()
);
create index if not exists receitas_padaria_idx on receitas (padaria_id);

create table if not exists receita_itens (
  id text primary key,
  receita_id text not null references receitas (id) on delete cascade,
  ingrediente_id text not null references produtos (id),
  quantidade numeric(10, 3) not null check (quantidade > 0)
);
create index if not exists receita_itens_receita_idx on receita_itens (receita_id);

create table if not exists producoes (
  id text primary key,
  padaria_id text not null,
  receita_id text not null references receitas (id),
  data date not null,
  status text not null default 'planejado' check (status in ('planejado', 'concluido', 'cancelado')),
  observacoes text,
  created_at timestamptz not null default now(),
  created_by text references usuarios (id),
  concluida_em timestamptz,
  concluida_por text references usuarios (id)
);
create index if not exists producoes_padaria_idx on producoes (padaria_id, data);

-- Configurações por padaria (ex.: meta de CMV).
create table if not exists padaria_config (
  padaria_id text not null,
  chave varchar(60) not null,
  valor text not null,
  primary key (padaria_id, chave)
);

-- Foto de uma categoria de produto, por padaria.
create table if not exists categorias_fotos (
  padaria_id text not null,
  nome varchar(255) not null,
  foto text not null,
  primary key (padaria_id, nome)
);

-- Histórico de mudanças de perfil (nome, cargo, papel, foto).
create table if not exists historico_perfil (
  id text primary key,
  padaria_id text,
  usuario_id text not null references usuarios (id),
  campo text not null check (campo in ('nome', 'cargo', 'papel', 'foto')),
  valor_antigo varchar(255),
  valor_novo varchar(255),
  alterado_por text references usuarios (id),
  created_at timestamptz not null default now()
);
create index if not exists historico_perfil_padaria_idx on historico_perfil (padaria_id, created_at);

-- Esqueci minha senha: código de 6 dígitos (só o hash), 15 minutos, poucas tentativas.
create table if not exists codigos_senha (
  usuario_id text primary key references usuarios (id) on delete cascade,
  codigo_hash char(64) not null,
  expira_em timestamptz not null,
  tentativas int not null default 0,
  created_at timestamptz not null default now()
);

-- Metas de vendas. alvo: 'geral' (padaria toda), 'pessoa' (padrão da equipe) ou id de usuário.
create table if not exists metas (
  padaria_id text not null,
  alvo varchar(36) not null,
  periodo text not null check (periodo in ('dia', 'semana', 'mes')),
  valor numeric(12, 2) not null check (valor > 0),
  primary key (padaria_id, alvo, periodo)
);

-- Perdas (sobra, vencido, queimado...). custo_unitario = preço de custo no momento.
create table if not exists perdas (
  id text primary key,
  padaria_id text not null,
  produto_id text not null references produtos (id),
  quantidade numeric(10, 3) not null check (quantidade > 0),
  motivo text not null check (motivo in ('sobra', 'vencido', 'queimado', 'quebra', 'outro')),
  observacao varchar(255),
  custo_unitario numeric(10, 2) not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists perdas_padaria_data_idx on perdas (padaria_id, created_at);

-- Encomendas: número sequencial por padaria, sinal e status. Ao entregar vira venda (venda_id).
create table if not exists encomendas (
  id text primary key,
  padaria_id text not null,
  numero int not null,
  cliente_nome varchar(120) not null,
  cliente_telefone varchar(11),
  retirada_em timestamptz not null,
  entrega boolean not null default false,
  endereco varchar(255),
  status text not null default 'reservada'
    check (status in ('reservada', 'confirmada', 'em_producao', 'pronta', 'entregue', 'cancelada')),
  total numeric(10, 2) not null default 0,
  sinal numeric(10, 2) not null default 0,
  forma_sinal text check (forma_sinal in ('dinheiro', 'cartao_credito', 'cartao_debito', 'pix')),
  observacoes text,
  venda_id text,
  caixa_sinal_id text,
  created_by text,
  created_at timestamptz not null default now(),
  unique (padaria_id, numero)
);
create index if not exists encomendas_retirada_idx on encomendas (padaria_id, retirada_em);
create index if not exists encomendas_venda_idx on encomendas (venda_id);

create table if not exists encomendas_itens (
  id text primary key,
  encomenda_id text not null references encomendas (id) on delete cascade,
  produto_id text not null references produtos (id),
  quantidade numeric(10, 3) not null check (quantidade > 0),
  preco_unitario numeric(10, 2) not null check (preco_unitario >= 0),
  subtotal numeric(10, 2) not null
);

create table if not exists caixa_movimentos (
  id text primary key,
  padaria_id text not null,
  caixa_id text not null references caixas (id) on delete cascade,
  tipo text not null check (tipo in ('sangria', 'suprimento')),
  valor numeric(10, 2) not null check (valor > 0),
  motivo varchar(255),
  created_by text,
  created_at timestamptz not null default now()
);

-- Promoções automáticas: %, R$ por unidade, preço fixo ou leve X pague Y; com período,
-- dias da semana (0 = domingo) e horário.
create table if not exists promocoes (
  id text primary key,
  padaria_id text not null,
  nome varchar(80) not null,
  tipo text not null check (tipo in ('percentual', 'valor', 'preco_fixo', 'leve_pague')),
  valor numeric(10, 2) not null default 0,
  leve int,
  pague int,
  abrangencia text not null check (abrangencia in ('produtos', 'categorias', 'tudo')),
  alvos jsonb,
  inicio timestamptz,
  fim timestamptz,
  dias_semana jsonb,
  hora_inicio char(5),
  hora_fim char(5),
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists promocoes_padaria_idx on promocoes (padaria_id);

-- Registro de acessos (logins, falhas, bloqueios, recuperação e troca de senha).
create table if not exists log_acessos (
  id text primary key,
  padaria_id text,
  usuario_id text,
  email varchar(255),
  evento varchar(30) not null,
  ip varchar(64),
  navegador varchar(255),
  created_at timestamptz not null default now()
);
create index if not exists log_acessos_padaria_idx on log_acessos (padaria_id, created_at);

-- Segunda trava: RLS em todas as tabelas, sem políticas. O servidor conecta como dono das
-- tabelas (que ignora o RLS); qualquer outro papel do Supabase (anon, authenticated) não lê nada.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'padaria' loop
    execute format('alter table padaria.%I enable row level security', t);
  end loop;
end $$;
