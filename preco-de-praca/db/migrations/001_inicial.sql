-- Geografia (IBGE). Não existe saída por município: a menor área publicada é a microrregião.
CREATE TABLE mesorregioes (
  codigo   text PRIMARY KEY,          -- UF (2) + mesorregião (2), ex.: 3507
  nome     text NOT NULL,
  uf       text NOT NULL,
  regiao   text NOT NULL              -- N, NE, CO, SE, S
);

CREATE TABLE microrregioes (
  codigo   text PRIMARY KEY,          -- UF (2) + microrregião (3), ex.: 35032
  nome     text NOT NULL,
  meso     text NOT NULL REFERENCES mesorregioes(codigo)
);

CREATE TABLE municipios (
  codigo   text PRIMARY KEY,          -- código IBGE de 7 dígitos (cMun da NF-e)
  nome     text NOT NULL,
  micro    text NOT NULL REFERENCES microrregioes(codigo)
);

CREATE TABLE produtos (
  id         text PRIMARY KEY,        -- gc, et, s10, s500
  nome       text NOT NULL,
  codigo_anp text NOT NULL UNIQUE,
  ordem      int  NOT NULL,
  preco_min  numeric(8,4) NOT NULL,   -- faixa absoluta aceitável em R$/L
  preco_max  numeric(8,4) NOT NULL
);

INSERT INTO produtos VALUES
  ('gc',   'Gasolina C',       '320102001', 1, 3.0, 9.5),
  ('et',   'Etanol hidratado', '810101001', 2, 2.0, 7.5),
  ('s10',  'Diesel S10',       '820101034', 3, 3.0, 9.5),
  ('s500', 'Diesel S500',      '820101012', 4, 3.0, 9.5);

-- Distribuidoras são criadas automaticamente pela raiz do CNPJ do emitente e revisadas por um administrador.
CREATE TABLE distribuidoras (
  id         serial PRIMARY KEY,
  cnpj_raiz  text NOT NULL UNIQUE,
  nome       text NOT NULL,
  revisada   boolean NOT NULL DEFAULT false
);

CREATE TABLE usuarios (
  id          serial PRIMARY KEY,
  email       text NOT NULL UNIQUE,
  nome        text NOT NULL,
  senha_hash  text NOT NULL,
  admin       boolean NOT NULL DEFAULT false,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessoes (
  token       text PRIMARY KEY,
  usuario_id  int NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em   timestamptz NOT NULL
);

CREATE TABLE postos (
  id               serial PRIMARY KEY,
  usuario_id       int NOT NULL REFERENCES usuarios(id),
  cnpj             text NOT NULL UNIQUE,
  razao_social     text NOT NULL,
  municipio        text REFERENCES municipios(codigo),   -- definido pela primeira NF-e aceita
  assinatura       text NOT NULL DEFAULT 'teste' CHECK (assinatura IN ('teste','ativa','inadimplente','cancelada')),
  teste_ate        date,
  demo             boolean NOT NULL DEFAULT false,
  criado_em        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE nfes (
  id                serial PRIMARY KEY,
  chave             text NOT NULL,
  posto_id          int NOT NULL REFERENCES postos(id),
  distribuidora_id  int REFERENCES distribuidoras(id),
  emitente_cnpj     text NOT NULL,
  emitente_nome     text NOT NULL,
  emitida_em        timestamptz NOT NULL,
  semana            date NOT NULL,                        -- segunda-feira da semana da emissão
  municipio         text,
  mod_frete         text,
  status            text NOT NULL CHECK (status IN ('aceita','em_revisao','recusada')),
  motivos           jsonb NOT NULL DEFAULT '[]',
  assinatura        text NOT NULL CHECK (assinatura IN ('valida','invalida','ausente','nao_verificada')),
  cadeia_icp        boolean NOT NULL DEFAULT false,
  xml               text,
  enviada_em        timestamptz NOT NULL DEFAULT now()
);
-- Uma nota só conta uma vez; uma nota recusada pode ser reenviada.
CREATE UNIQUE INDEX nfes_chave_unica ON nfes (chave) WHERE status <> 'recusada';
CREATE INDEX nfes_semana ON nfes (semana, status);

CREATE TABLE nfe_itens (
  id            serial PRIMARY KEY,
  nfe_id        int NOT NULL REFERENCES nfes(id) ON DELETE CASCADE,
  produto_id    text NOT NULL REFERENCES produtos(id),
  descricao     text NOT NULL,
  cfop          text NOT NULL,
  litros        numeric(14,4) NOT NULL CHECK (litros > 0),
  preco_litro   numeric(10,4) NOT NULL CHECK (preco_litro > 0)
);

-- "Não comprei este produto nesta semana"
CREATE TABLE sem_compra (
  posto_id    int  NOT NULL REFERENCES postos(id),
  semana      date NOT NULL,
  produto_id  text NOT NULL REFERENCES produtos(id),
  PRIMARY KEY (posto_id, semana, produto_id)
);

CREATE TABLE semanas_fechadas (
  semana      date PRIMARY KEY,
  fechada_em  timestamptz NOT NULL DEFAULT now(),
  postos      int NOT NULL
);

-- Estatísticas publicadas. Só são gravadas no fechamento da semana, já com o sigilo aplicado.
-- Valores ficam nulos quando a célula está fechada.
CREATE TABLE estatisticas (
  semana            date NOT NULL REFERENCES semanas_fechadas(semana) ON DELETE CASCADE,
  produto_id        text NOT NULL REFERENCES produtos(id),
  nivel             text NOT NULL CHECK (nivel IN ('brasil','regiao','uf','meso','micro')),
  area              text NOT NULL,
  distribuidora_id  int  NOT NULL DEFAULT 0,             -- 0 = todas
  regiao            text,
  uf                text,
  meso              text,
  postos            int  NOT NULL,
  aberta            boolean NOT NULL,
  minimo            numeric(10,4),
  media             numeric(10,4),
  mediana           numeric(10,4),
  moda              numeric(10,2),
  moda_postos       int,
  maximo            numeric(10,4),
  PRIMARY KEY (semana, produto_id, nivel, area, distribuidora_id)
);
CREATE INDEX estatisticas_busca ON estatisticas (semana, produto_id, nivel, distribuidora_id);
