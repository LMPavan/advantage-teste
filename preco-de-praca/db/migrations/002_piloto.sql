-- Mínima e máxima deixam de ser calculadas e guardadas: são o preço efetivo de um único posto.
ALTER TABLE estatisticas DROP COLUMN minimo, DROP COLUMN maximo;

-- A contagem passa a ser por empresa (raiz do CNPJ), não por posto: uma rede com 5 postos é 1 participante.
-- As semanas publicadas são apagadas e recalculadas com as regras novas no próximo fechamento.
DELETE FROM semanas_fechadas;

-- Chaves de API para o sistema do cliente (ERP) enviar notas e ler o painel sem navegador.
CREATE TABLE tokens_api (
  id          serial PRIMARY KEY,
  usuario_id  int  NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  hash        text NOT NULL UNIQUE,     -- sha256 do token; o token em si só é mostrado na criação
  prefixo     text NOT NULL,            -- primeiros caracteres, para o usuário reconhecer a chave
  criado_em   timestamptz NOT NULL DEFAULT now(),
  usado_em    timestamptz,
  revogado_em timestamptz
);
