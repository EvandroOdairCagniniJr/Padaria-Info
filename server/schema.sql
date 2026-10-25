-- Padaria Info — schema MySQL 8. Aplicado automaticamente ao iniciar o servidor
-- (todas as instruções são idempotentes). As regras de negócio que antes eram
-- funções no Supabase (venda, movimentação de estoque, produção, receita) estão em
-- server/routes.ts, dentro de transações.

-- papel: dono (tudo + Equipe), admin (gerente: toda a operação), funcionario (PDV, estoque, produção).
-- Colunas acrescentadas depois da primeira versão também estão em db.ts (colunasNovas),
-- para bancos já criados.
create table if not exists usuarios (
  id char(36) primary key default (uuid()),
  nome varchar(255) not null default '',
  email varchar(255) not null unique,
  senha_hash varchar(255) not null,
  papel enum('dono', 'admin', 'funcionario') not null default 'funcionario',
  -- cargo: a função na padaria (Caixa, Padeiro(a)...), só para exibição; quem manda no acesso é o papel.
  cargo varchar(60) not null default '',
  -- foto: data URL JPEG pequena (o navegador reduz para 256px antes de enviar).
  foto mediumtext null,
  -- Cadastro: documentos e telefones só com dígitos; endereço e contato de emergência em JSON.
  telefone varchar(11) null,
  cpf char(11) null,
  data_nascimento date null,
  data_admissao date null,
  turno enum('manha', 'tarde', 'noite', 'madrugada', 'integral') null,
  endereco json null,
  contato_emergencia json null,
  observacoes text null,
  ativo boolean not null default true,
  ultimo_acesso timestamp null,
  created_at timestamp not null default current_timestamp
);

create table if not exists produtos (
  id char(36) primary key default (uuid()),
  nome varchar(255) not null,
  categoria varchar(255),
  unidade varchar(20) not null default 'un',
  preco_venda decimal(10, 2) not null check (preco_venda >= 0),
  preco_custo decimal(10, 2) check (preco_custo >= 0),
  estoque_atual decimal(10, 3) not null default 0,
  estoque_minimo decimal(10, 3) not null default 0,
  ativo boolean not null default true,
  -- Vitrine: emoji escolhido (vazio = automático pelo nome) e foto pequena opcional.
  emoji varchar(16),
  foto mediumtext,
  created_at timestamp not null default current_timestamp
);

create table if not exists movimentacoes_estoque (
  id char(36) primary key default (uuid()),
  produto_id char(36) not null,
  tipo enum('entrada', 'saida', 'ajuste') not null,
  quantidade decimal(10, 3) not null,
  motivo varchar(255),
  created_at timestamp not null default current_timestamp,
  created_by char(36),
  foreign key (produto_id) references produtos (id),
  foreign key (created_by) references usuarios (id)
);

create table if not exists vendas (
  id char(36) primary key default (uuid()),
  total decimal(10, 2) not null check (total >= 0),
  forma_pagamento enum('dinheiro', 'cartao_credito', 'cartao_debito', 'pix') not null,
  valor_recebido decimal(10, 2) null,
  -- concluida | devolvida (devolvida não entra em nenhum total; o estoque já voltou).
  status varchar(20) not null default 'concluida',
  devolvida_em timestamp null,
  devolvida_por char(36) null,
  motivo_devolucao varchar(255) null,
  created_at timestamp not null default current_timestamp,
  created_by char(36),
  index vendas_created_at_idx (created_at),
  foreign key (created_by) references usuarios (id)
);

create table if not exists vendas_itens (
  id char(36) primary key default (uuid()),
  venda_id char(36) not null,
  produto_id char(36) not null,
  quantidade decimal(10, 3) not null check (quantidade > 0),
  preco_unitario decimal(10, 2) not null check (preco_unitario >= 0),
  subtotal decimal(10, 2) not null check (subtotal >= 0),
  foreign key (venda_id) references vendas (id) on delete cascade,
  foreign key (produto_id) references produtos (id)
);

create table if not exists contas_financeiras (
  id char(36) primary key default (uuid()),
  tipo enum('pagar', 'receber') not null,
  descricao varchar(255) not null,
  categoria varchar(255),
  valor decimal(10, 2) not null check (valor >= 0),
  data_vencimento date not null,
  data_pagamento date,
  status enum('pendente', 'pago', 'cancelado') not null default 'pendente',
  forma_pagamento varchar(50),
  observacoes text,
  created_at timestamp not null default current_timestamp,
  created_by char(36),
  index contas_tipo_status_idx (tipo, status),
  index contas_vencimento_idx (data_vencimento),
  foreign key (created_by) references usuarios (id)
);

create table if not exists receitas (
  id char(36) primary key default (uuid()),
  produto_id char(36) not null,
  nome varchar(255) not null,
  rendimento decimal(10, 3) not null check (rendimento > 0),
  modo_preparo text,
  created_at timestamp not null default current_timestamp,
  foreign key (produto_id) references produtos (id)
);

create table if not exists receita_itens (
  id char(36) primary key default (uuid()),
  receita_id char(36) not null,
  ingrediente_id char(36) not null,
  quantidade decimal(10, 3) not null check (quantidade > 0),
  foreign key (receita_id) references receitas (id) on delete cascade,
  foreign key (ingrediente_id) references produtos (id)
);

create table if not exists producoes (
  id char(36) primary key default (uuid()),
  receita_id char(36) not null,
  data date not null,
  status enum('planejado', 'concluido', 'cancelado') not null default 'planejado',
  observacoes text,
  created_at timestamp not null default current_timestamp,
  created_by char(36),
  concluida_em timestamp null,
  concluida_por char(36),
  index producoes_status_idx (status),
  foreign key (receita_id) references receitas (id),
  foreign key (created_by) references usuarios (id),
  foreign key (concluida_por) references usuarios (id)
);

-- Configurações da padaria (ex: meta_diaria_vendas).
create table if not exists configuracoes (
  chave varchar(60) primary key,
  valor mediumtext not null
);

-- Foto escolhida para uma categoria de produto (sem linha aqui = ícone automático pelo nome).
-- A categoria em si continua sendo o texto em produtos.categoria.
create table if not exists categorias (
  nome varchar(255) primary key,
  foto mediumtext not null
);

-- Histórico de mudanças de perfil (nome, cargo, papel, foto): avisa dono e gerência e marca
-- as promoções (cargo/papel trocado por outra pessoa) com um selo na Equipe.
create table if not exists historico_perfil (
  id char(36) primary key default (uuid()),
  usuario_id char(36) not null,
  campo enum('nome', 'cargo', 'papel', 'foto') not null,
  valor_antigo varchar(255),
  valor_novo varchar(255),
  alterado_por char(36),
  created_at timestamp(3) not null default current_timestamp(3),
  index historico_perfil_created_idx (created_at),
  foreign key (usuario_id) references usuarios (id),
  foreign key (alterado_por) references usuarios (id)
);

-- Esqueci minha senha: código de 6 dígitos enviado por e-mail (guardado só o hash).
-- Vale 15 minutos e aceita poucas tentativas; um pedido novo substitui o anterior.
create table if not exists codigos_senha (
  usuario_id char(36) primary key,
  codigo_hash char(64) not null,
  expira_em timestamp not null,
  tentativas int not null default 0,
  created_at timestamp not null default current_timestamp,
  foreign key (usuario_id) references usuarios (id) on delete cascade
);

-- Multi-padaria (SaaS): cada padaria tem seus dados; toda tabela de negócio tem padaria_id
-- (acrescentada em db.ts, colunasNovas). dados = cadastro da padaria (nome, CNPJ...) em JSON.
-- codigo_convite: o funcionário informa em "Criar conta" para pedir acesso à equipe.
create table if not exists padarias (
  id char(36) primary key,
  dados json not null,
  codigo_convite char(8) not null unique,
  created_at timestamp not null default current_timestamp
);

-- Configurações por padaria (ex.: metas). Substitui a antiga tabela configuracoes.
create table if not exists padaria_config (
  padaria_id char(36) not null,
  chave varchar(60) not null,
  valor mediumtext not null,
  primary key (padaria_id, chave)
);

-- Foto de uma categoria de produto, por padaria. Substitui a antiga tabela categorias.
create table if not exists categorias_fotos (
  padaria_id char(36) not null,
  nome varchar(255) not null,
  foto mediumtext not null,
  primary key (padaria_id, nome)
);

-- Metas de vendas definidas pelo dono. alvo: 'geral' (a padaria toda), 'pessoa' (padrão para
-- cada membro da equipe) ou o id de um usuário (meta individual, vale no lugar do padrão).
create table if not exists metas (
  padaria_id char(36) not null,
  alvo varchar(36) not null,
  periodo enum('dia', 'semana', 'mes') not null,
  valor decimal(12, 2) not null check (valor > 0),
  primary key (padaria_id, alvo, periodo)
);
