<!-- Arquivo gerado por `npm run docs` (scripts/gerar-docs.mjs). Não edite à mão. -->

# Banco de dados

PostgreSQL (Supabase), schema `padaria`. **22 tabelas**, **44 chaves estrangeiras**, **58 índices**. Fonte da verdade: [server/schema.sql](../server/schema.sql), aplicado sozinho quando o servidor inicia.

> Multi-padaria: toda tabela de negócio tem `padaria_id`, e toda consulta do servidor filtra por ele. Todas as tabelas têm RLS ligado e sem políticas: só o servidor lê. A API pública do Supabase não enxerga nada.

## Diagrama ER

```mermaid
erDiagram
  caixas ||--o{ caixa_movimentos : "caixa"
  usuarios ||--o{ caixa_movimentos : "created"
  padarias ||--o{ caixa_movimentos : "padaria"
  usuarios ||--o{ caixas : "operador"
  padarias ||--o{ caixas : "padaria"
  padarias ||--o{ categorias_fotos : "padaria"
  usuarios ||--o{ codigos_senha : "usuario"
  usuarios ||--o{ contas_financeiras : "created"
  padarias ||--o{ contas_financeiras : "padaria"
  caixas ||--o{ encomendas : "caixa_sinal"
  usuarios ||--o{ encomendas : "created"
  padarias ||--o{ encomendas : "padaria"
  vendas ||--o{ encomendas : "venda"
  encomendas ||--o{ encomendas_itens : "encomenda"
  produtos ||--o{ encomendas_itens : "produto"
  usuarios ||--o{ historico_perfil : "alterado"
  padarias ||--o{ historico_perfil : "padaria"
  usuarios ||--o{ historico_perfil : "usuario"
  padarias ||--o{ metas : "padaria"
  usuarios ||--o{ movimentacoes_estoque : "created"
  padarias ||--o{ movimentacoes_estoque : "padaria"
  produtos ||--o{ movimentacoes_estoque : "produto"
  padarias ||--o{ padaria_config : "padaria"
  usuarios ||--o{ perdas : "created"
  padarias ||--o{ perdas : "padaria"
  produtos ||--o{ perdas : "produto"
  usuarios ||--o{ producoes : "concluida"
  usuarios ||--o{ producoes : "created"
  padarias ||--o{ producoes : "padaria"
  receitas ||--o{ producoes : "receita"
  padarias ||--o{ produtos : "padaria"
  padarias ||--o{ promocoes : "padaria"
  produtos ||--o{ receita_itens : "ingrediente"
  receitas ||--o{ receita_itens : "receita"
  padarias ||--o{ receitas : "padaria"
  produtos ||--o{ receitas : "produto"
  padarias ||--o{ usuarios : "padaria"
  caixas ||--o{ vendas : "caixa"
  usuarios ||--o{ vendas : "created"
  usuarios ||--o{ vendas : "devolvida"
  padarias ||--o{ vendas : "padaria"
  produtos ||--o{ vendas_itens : "produto"
  promocoes ||--o{ vendas_itens : "promocao"
  vendas ||--o{ vendas_itens : "venda"
  caixa_movimentos {
    text id PK
    text padaria_id FK
    text caixa_id FK
    text tipo
    numeric_10_2 valor
    varchar_255 motivo
    text created_by FK
    timestamptz created_at
  }
  caixas {
    text id PK
    text padaria_id FK
    text operador_id FK
    timestamptz aberto_em
    numeric_10_2 fundo_troco
    timestamptz fechado_em
    jsonb esperado
    jsonb contado
    numeric_10_2 diferenca
    varchar_500 observacoes
  }
  categorias_fotos {
    text padaria_id PK
    varchar_255 nome PK
    text foto
  }
  codigos_senha {
    text usuario_id PK
    char_64 codigo_hash
    timestamptz expira_em
    integer tentativas
    timestamptz created_at
  }
  contas_financeiras {
    text id PK
    text padaria_id FK
    text tipo
    varchar_255 descricao
    varchar_255 categoria
    numeric_10_2 valor
    date data_vencimento
    date data_pagamento
    text status
    varchar_50 forma_pagamento
    text observacoes
    timestamptz created_at
    text created_by FK
  }
  encomendas {
    text id PK
    text padaria_id FK
    integer numero
    varchar_120 cliente_nome
    varchar_11 cliente_telefone
    timestamptz retirada_em
    boolean entrega
    varchar_255 endereco
    text status
    numeric_10_2 total
    numeric_10_2 sinal
    text forma_sinal
    text observacoes
    text venda_id FK
    text caixa_sinal_id FK
    text created_by FK
    timestamptz created_at
  }
  encomendas_itens {
    text id PK
    text encomenda_id FK
    text produto_id FK
    numeric_10_3 quantidade
    numeric_10_2 preco_unitario
    numeric_10_2 subtotal
  }
  historico_perfil {
    text id PK
    text padaria_id FK
    text usuario_id FK
    text campo
    varchar_255 valor_antigo
    varchar_255 valor_novo
    text alterado_por FK
    timestamptz created_at
  }
  log_acessos {
    text id PK
    text padaria_id
    text usuario_id
    varchar_255 email
    varchar_30 evento
    varchar_64 ip
    varchar_255 navegador
    timestamptz created_at
  }
  metas {
    text padaria_id PK
    varchar_36 alvo PK
    text periodo PK
    numeric_12_2 valor
  }
  movimentacoes_estoque {
    text id PK
    text padaria_id FK
    text produto_id FK
    text tipo
    numeric_10_3 quantidade
    varchar_255 motivo
    timestamptz created_at
    text created_by FK
  }
  padaria_config {
    text padaria_id PK
    varchar_60 chave PK
    text valor
  }
  padarias {
    text id PK
    jsonb dados
    char_8 codigo_convite
    timestamptz created_at
  }
  perdas {
    text id PK
    text padaria_id FK
    text produto_id FK
    numeric_10_3 quantidade
    text motivo
    varchar_255 observacao
    numeric_10_2 custo_unitario
    text created_by FK
    timestamptz created_at
  }
  producoes {
    text id PK
    text padaria_id FK
    text receita_id FK
    date data
    text status
    text observacoes
    timestamptz created_at
    text created_by FK
    timestamptz concluida_em
    text concluida_por FK
  }
  produtos {
    text id PK
    text padaria_id FK
    varchar_255 nome
    varchar_255 categoria
    varchar_80 grupo
    varchar_20 unidade
    numeric_10_2 preco_venda
    numeric_10_2 preco_custo
    numeric_10_3 estoque_atual
    numeric_10_3 estoque_minimo
    boolean ativo
    varchar_16 emoji
    text foto
    timestamptz created_at
  }
  promocoes {
    text id PK
    text padaria_id FK
    varchar_80 nome
    text tipo
    numeric_10_2 valor
    integer leve
    integer pague
    text abrangencia
    jsonb alvos
    timestamptz inicio
    timestamptz fim
    jsonb dias_semana
    char_5 hora_inicio
    char_5 hora_fim
    boolean ativa
    timestamptz created_at
  }
  receita_itens {
    text id PK
    text receita_id FK
    text ingrediente_id FK
    numeric_10_3 quantidade
  }
  receitas {
    text id PK
    text padaria_id FK
    text produto_id FK
    varchar_255 nome
    numeric_10_3 rendimento
    text modo_preparo
    timestamptz created_at
  }
  usuarios {
    text id PK
    text padaria_id FK
    varchar_255 nome
    varchar_255 email
    varchar_255 senha_hash
    text papel
    varchar_60 cargo
    text foto
    varchar_11 telefone
    char_11 cpf
    date data_nascimento
    date data_admissao
    text turno
    jsonb endereco
    jsonb contato_emergencia
    text observacoes
    boolean ativo
    timestamptz ultimo_acesso
    integer falhas_login
    timestamptz bloqueado_ate
    integer sessao_versao
    timestamptz created_at
  }
  vendas {
    text id PK
    text padaria_id FK
    numeric_10_2 total
    text forma_pagamento
    numeric_10_2 valor_recebido
    varchar_20 status
    timestamptz devolvida_em
    text devolvida_por FK
    varchar_255 motivo_devolucao
    numeric_10_2 desconto_promocoes
    numeric_10_2 desconto_manual
    text caixa_id FK
    timestamptz created_at
    text created_by FK
  }
  vendas_itens {
    text id PK
    text venda_id FK
    text produto_id FK
    numeric_10_3 quantidade
    numeric_10_2 preco_unitario
    numeric_10_2 subtotal
    numeric_10_2 desconto
    text promocao_id FK
  }
```

## Tabelas

### caixa_movimentos

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `padaria_id` | text | sim |  | → padarias |
| `caixa_id` | text | sim |  | → caixas (on delete cascade) |
| `tipo` | text | sim |  |  |
| `valor` | numeric(10,2) | sim |  |  |
| `motivo` | varchar(255) |  |  |  |
| `created_by` | text |  |  | → usuarios |
| `created_at` | timestamptz | sim | `now()` |  |

Regras: `CHECK ((tipo = ANY (ARRAY['sangria'::text, 'suprimento'::text])))` · `CHECK ((valor > (0)::numeric))`

Índices: `(caixa_id)`

### caixas

Caixa (gaveta) de cada operador: abertura com fundo de troco, sangrias/suprimentos e fechamento.

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `padaria_id` | text | sim |  | → padarias |
| `operador_id` | text | sim |  | → usuarios |
| `aberto_em` | timestamptz | sim | `now()` |  |
| `fundo_troco` | numeric(10,2) | sim | `0` |  |
| `fechado_em` | timestamptz |  |  |  |
| `esperado` | jsonb |  |  |  |
| `contado` | jsonb |  |  |  |
| `diferenca` | numeric(10,2) |  |  |  |
| `observacoes` | varchar(500) |  |  |  |

Índices: `(operador_id, fechado_em)` · `(padaria_id, aberto_em)`

### categorias_fotos

Foto de uma categoria de produto, por padaria.

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `padaria_id` | text | sim |  | PK |
| `nome` | varchar(255) | sim |  | PK |
| `foto` | text | sim |  |  |

### codigos_senha

Esqueci minha senha: código de 6 dígitos (só o hash), 15 minutos, poucas tentativas.

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `usuario_id` | text | sim |  | PK |
| `codigo_hash` | char(64) | sim |  |  |
| `expira_em` | timestamptz | sim |  |  |
| `tentativas` | integer | sim | `0` |  |
| `created_at` | timestamptz | sim | `now()` |  |

### contas_financeiras

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `padaria_id` | text | sim |  | → padarias |
| `tipo` | text | sim |  |  |
| `descricao` | varchar(255) | sim |  |  |
| `categoria` | varchar(255) |  |  |  |
| `valor` | numeric(10,2) | sim |  |  |
| `data_vencimento` | date | sim |  |  |
| `data_pagamento` | date |  |  |  |
| `status` | text | sim | `'pendente'::text` |  |
| `forma_pagamento` | varchar(50) |  |  |  |
| `observacoes` | text |  |  |  |
| `created_at` | timestamptz | sim | `now()` |  |
| `created_by` | text |  |  | → usuarios |

Regras: `CHECK ((status = ANY (ARRAY['pendente'::text, 'pago'::text, 'cancelado'::text])))` · `CHECK ((tipo = ANY (ARRAY['pagar'::text, 'receber'::text])))` · `CHECK ((valor >= (0)::numeric))`

Índices: `(padaria_id, data_vencimento)`

### encomendas

Encomendas: número sequencial por padaria, sinal e status. Ao entregar vira venda (venda_id).

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `padaria_id` | text | sim |  | → padarias |
| `numero` | integer | sim |  |  |
| `cliente_nome` | varchar(120) | sim |  |  |
| `cliente_telefone` | varchar(11) |  |  |  |
| `retirada_em` | timestamptz | sim |  |  |
| `entrega` | boolean | sim | `false` |  |
| `endereco` | varchar(255) |  |  |  |
| `status` | text | sim | `'reservada'::text` |  |
| `total` | numeric(10,2) | sim | `0` |  |
| `sinal` | numeric(10,2) | sim | `0` |  |
| `forma_sinal` | text |  |  |  |
| `observacoes` | text |  |  |  |
| `venda_id` | text |  |  | → vendas |
| `caixa_sinal_id` | text |  |  | → caixas |
| `created_by` | text |  |  | → usuarios |
| `created_at` | timestamptz | sim | `now()` |  |

Regras: `CHECK ((forma_sinal = ANY (ARRAY['dinheiro'::text, 'cartao_credito'::text, 'cartao_debito'::text, 'pix'::text])))` · `UNIQUE (padaria_id, numero)` · `CHECK ((status = ANY (ARRAY['reservada'::text, 'confirmada'::text, 'em_producao'::text, 'pronta'::text, 'entregue'::text, 'cancelada'::text])))`

Índices: `(caixa_sinal_id) WHERE (caixa_sinal_id IS NOT NULL)` · `UNIQUE (padaria_id, numero)` · `(padaria_id, retirada_em)` · `(venda_id)`

### encomendas_itens

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `encomenda_id` | text | sim |  | → encomendas (on delete cascade) |
| `produto_id` | text | sim |  | → produtos |
| `quantidade` | numeric(10,3) | sim |  |  |
| `preco_unitario` | numeric(10,2) | sim |  |  |
| `subtotal` | numeric(10,2) | sim |  |  |

Regras: `CHECK ((preco_unitario >= (0)::numeric))` · `CHECK ((quantidade > (0)::numeric))`

Índices: `(encomenda_id)` · `(produto_id)`

### historico_perfil

Histórico de mudanças de perfil (nome, cargo, papel, foto).

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `padaria_id` | text |  |  | → padarias |
| `usuario_id` | text | sim |  | → usuarios |
| `campo` | text | sim |  |  |
| `valor_antigo` | varchar(255) |  |  |  |
| `valor_novo` | varchar(255) |  |  |  |
| `alterado_por` | text |  |  | → usuarios |
| `created_at` | timestamptz | sim | `now()` |  |

Regras: `CHECK ((campo = ANY (ARRAY['nome'::text, 'cargo'::text, 'papel'::text, 'foto'::text])))`

Índices: `(padaria_id, created_at)` · `(usuario_id)`

### log_acessos

Registro de acessos (logins, falhas, bloqueios, recuperação e troca de senha).

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `padaria_id` | text |  |  |  |
| `usuario_id` | text |  |  |  |
| `email` | varchar(255) |  |  |  |
| `evento` | varchar(30) | sim |  |  |
| `ip` | varchar(64) |  |  |  |
| `navegador` | varchar(255) |  |  |  |
| `created_at` | timestamptz | sim | `now()` |  |

Índices: `(padaria_id, created_at)`

### metas

Metas de vendas. alvo: 'geral' (padaria toda), 'pessoa' (padrão da equipe) ou id de usuário.

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `padaria_id` | text | sim |  | PK |
| `alvo` | varchar(36) | sim |  | PK |
| `periodo` | text | sim |  | PK |
| `valor` | numeric(12,2) | sim |  |  |

Regras: `CHECK ((periodo = ANY (ARRAY['dia'::text, 'semana'::text, 'mes'::text])))` · `CHECK ((valor > (0)::numeric))`

### movimentacoes_estoque

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `padaria_id` | text | sim |  | → padarias |
| `produto_id` | text | sim |  | → produtos |
| `tipo` | text | sim |  |  |
| `quantidade` | numeric(10,3) | sim |  |  |
| `motivo` | varchar(255) |  |  |  |
| `created_at` | timestamptz | sim | `now()` |  |
| `created_by` | text |  |  | → usuarios |

Regras: `CHECK ((tipo = ANY (ARRAY['entrada'::text, 'saida'::text, 'ajuste'::text])))`

Índices: `(created_by, created_at)` · `(padaria_id, created_at)` · `(produto_id)`

### padaria_config

Configurações por padaria (ex.: meta de CMV).

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `padaria_id` | text | sim |  | PK |
| `chave` | varchar(60) | sim |  | PK |
| `valor` | text | sim |  |  |

### padarias

Padarias (SaaS). dados = cadastro (nome, CNPJ, endereço...) em JSON. codigo_convite: o funcionário informa em "Criar conta" para pedir acesso à equipe.

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `dados` | jsonb | sim |  |  |
| `codigo_convite` | char(8) | sim |  |  |
| `created_at` | timestamptz | sim | `now()` |  |

Regras: `UNIQUE (codigo_convite)`

Índices: `UNIQUE (codigo_convite)`

### perdas

Perdas (sobra, vencido, queimado...). custo_unitario = preço de custo no momento.

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `padaria_id` | text | sim |  | → padarias |
| `produto_id` | text | sim |  | → produtos |
| `quantidade` | numeric(10,3) | sim |  |  |
| `motivo` | text | sim |  |  |
| `observacao` | varchar(255) |  |  |  |
| `custo_unitario` | numeric(10,2) | sim | `0` |  |
| `created_by` | text |  |  | → usuarios |
| `created_at` | timestamptz | sim | `now()` |  |

Regras: `CHECK ((motivo = ANY (ARRAY['sobra'::text, 'vencido'::text, 'queimado'::text, 'quebra'::text, 'outro'::text])))` · `CHECK ((quantidade > (0)::numeric))`

Índices: `(padaria_id, created_at)` · `(produto_id)`

### producoes

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `padaria_id` | text | sim |  | → padarias |
| `receita_id` | text | sim |  | → receitas |
| `data` | date | sim |  |  |
| `status` | text | sim | `'planejado'::text` |  |
| `observacoes` | text |  |  |  |
| `created_at` | timestamptz | sim | `now()` |  |
| `created_by` | text |  |  | → usuarios |
| `concluida_em` | timestamptz |  |  |  |
| `concluida_por` | text |  |  | → usuarios |

Regras: `CHECK ((status = ANY (ARRAY['planejado'::text, 'concluido'::text, 'cancelado'::text])))`

Índices: `(concluida_por, concluida_em)` · `(padaria_id, data)` · `(receita_id)`

### produtos

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `padaria_id` | text | sim |  | → padarias |
| `nome` | varchar(255) | sim |  |  |
| `categoria` | varchar(255) |  |  |  |
| `grupo` | varchar(80) |  |  |  |
| `unidade` | varchar(20) | sim | `'un'::character varying` |  |
| `preco_venda` | numeric(10,2) | sim |  |  |
| `preco_custo` | numeric(10,2) |  |  |  |
| `estoque_atual` | numeric(10,3) | sim | `0` |  |
| `estoque_minimo` | numeric(10,3) | sim | `0` |  |
| `ativo` | boolean | sim | `true` |  |
| `emoji` | varchar(16) |  |  |  |
| `foto` | text |  |  |  |
| `created_at` | timestamptz | sim | `now()` |  |

Regras: `CHECK ((preco_custo >= (0)::numeric))` · `CHECK ((preco_venda >= (0)::numeric))`

Índices: `(padaria_id)`

### promocoes

Promoções automáticas: %, R$ por unidade, preço fixo ou leve X pague Y; com período, dias da semana (0 = domingo) e horário.

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `padaria_id` | text | sim |  | → padarias |
| `nome` | varchar(80) | sim |  |  |
| `tipo` | text | sim |  |  |
| `valor` | numeric(10,2) | sim | `0` |  |
| `leve` | integer |  |  |  |
| `pague` | integer |  |  |  |
| `abrangencia` | text | sim |  |  |
| `alvos` | jsonb |  |  |  |
| `inicio` | timestamptz |  |  |  |
| `fim` | timestamptz |  |  |  |
| `dias_semana` | jsonb |  |  |  |
| `hora_inicio` | char(5) |  |  |  |
| `hora_fim` | char(5) |  |  |  |
| `ativa` | boolean | sim | `true` |  |
| `created_at` | timestamptz | sim | `now()` |  |

Regras: `CHECK ((abrangencia = ANY (ARRAY['produtos'::text, 'categorias'::text, 'tudo'::text])))` · `CHECK ((tipo = ANY (ARRAY['percentual'::text, 'valor'::text, 'preco_fixo'::text, 'leve_pague'::text])))`

Índices: `(padaria_id)`

### receita_itens

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `receita_id` | text | sim |  | → receitas (on delete cascade) |
| `ingrediente_id` | text | sim |  | → produtos |
| `quantidade` | numeric(10,3) | sim |  |  |

Regras: `CHECK ((quantidade > (0)::numeric))`

Índices: `(ingrediente_id)` · `(receita_id)`

### receitas

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `padaria_id` | text | sim |  | → padarias |
| `produto_id` | text | sim |  | → produtos |
| `nome` | varchar(255) | sim |  |  |
| `rendimento` | numeric(10,3) | sim |  |  |
| `modo_preparo` | text |  |  |  |
| `created_at` | timestamptz | sim | `now()` |  |

Regras: `CHECK ((rendimento > (0)::numeric))`

Índices: `(padaria_id)` · `(produto_id)`

### usuarios

papel: dono (tudo + Equipe), admin (gerente: toda a operação), funcionario (PDV, estoque, produção).

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `padaria_id` | text |  |  | → padarias |
| `nome` | varchar(255) | sim | `''::character varying` |  |
| `email` | varchar(255) | sim |  |  |
| `senha_hash` | varchar(255) | sim |  |  |
| `papel` | text | sim | `'funcionario'::text` |  |
| `cargo` | varchar(60) | sim | `''::character varying` |  |
| `foto` | text |  |  |  |
| `telefone` | varchar(11) |  |  |  |
| `cpf` | char(11) |  |  |  |
| `data_nascimento` | date |  |  |  |
| `data_admissao` | date |  |  |  |
| `turno` | text |  |  |  |
| `endereco` | jsonb |  |  |  |
| `contato_emergencia` | jsonb |  |  |  |
| `observacoes` | text |  |  |  |
| `ativo` | boolean | sim | `true` |  |
| `ultimo_acesso` | timestamptz |  |  |  |
| `falhas_login` | integer | sim | `0` |  |
| `bloqueado_ate` | timestamptz |  |  |  |
| `sessao_versao` | integer | sim | `0` |  |
| `created_at` | timestamptz | sim | `now()` |  |

Regras: `UNIQUE (email)` · `CHECK ((papel = ANY (ARRAY['dono'::text, 'admin'::text, 'funcionario'::text])))` · `CHECK ((turno = ANY (ARRAY['manha'::text, 'tarde'::text, 'noite'::text, 'madrugada'::text, 'integral'::text])))`

Índices: `(cpf) WHERE (cpf IS NOT NULL)` · `UNIQUE (email)` · `(padaria_id)`

### vendas

status: concluida | devolvida (devolvida não entra em nenhum total; o estoque já voltou).

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `padaria_id` | text | sim |  | → padarias |
| `total` | numeric(10,2) | sim |  |  |
| `forma_pagamento` | text | sim |  |  |
| `valor_recebido` | numeric(10,2) |  |  |  |
| `status` | varchar(20) | sim | `'concluida'::character varying` |  |
| `devolvida_em` | timestamptz |  |  |  |
| `devolvida_por` | text |  |  | → usuarios |
| `motivo_devolucao` | varchar(255) |  |  |  |
| `desconto_promocoes` | numeric(10,2) | sim | `0` |  |
| `desconto_manual` | numeric(10,2) | sim | `0` |  |
| `caixa_id` | text |  |  | → caixas |
| `created_at` | timestamptz | sim | `now()` |  |
| `created_by` | text |  |  | → usuarios |

Regras: `CHECK ((forma_pagamento = ANY (ARRAY['dinheiro'::text, 'cartao_credito'::text, 'cartao_debito'::text, 'pix'::text])))` · `CHECK ((total >= (0)::numeric))`

Índices: `(caixa_id)` · `(created_by, created_at)` · `(padaria_id, created_at)`

### vendas_itens

| Coluna | Tipo | Obrigatória | Padrão | Chave |
|---|---|---|---|---|
| `id` | text | sim |  | PK |
| `venda_id` | text | sim |  | → vendas (on delete cascade) |
| `produto_id` | text | sim |  | → produtos |
| `quantidade` | numeric(10,3) | sim |  |  |
| `preco_unitario` | numeric(10,2) | sim |  |  |
| `subtotal` | numeric(10,2) | sim |  |  |
| `desconto` | numeric(10,2) | sim | `0` |  |
| `promocao_id` | text |  |  | → promocoes (on delete set null) |

Regras: `CHECK ((preco_unitario >= (0)::numeric))` · `CHECK ((quantidade > (0)::numeric))` · `CHECK ((subtotal >= (0)::numeric))`

Índices: `(produto_id)` · `(venda_id)`
