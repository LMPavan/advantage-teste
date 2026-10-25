-- Aceite dos termos de uso e da política de privacidade (LGPD)
ALTER TABLE usuarios
  ADD COLUMN termos_versao     text,
  ADD COLUMN termos_aceitos_em timestamptz,
  ADD COLUMN termos_ip         text,
  ADD COLUMN lembretes         boolean NOT NULL DEFAULT true;

-- Recuperação de senha por e-mail. Só o hash do código fica guardado.
CREATE TABLE redefinicoes_senha (
  hash        text PRIMARY KEY,
  usuario_id  int NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em   timestamptz NOT NULL,
  usada_em    timestamptz
);

-- Evita mandar o mesmo lembrete duas vezes
CREATE TABLE lembretes_enviados (
  usuario_id  int  NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  semana      date NOT NULL,
  tipo        text NOT NULL,
  enviado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, semana, tipo)
);
