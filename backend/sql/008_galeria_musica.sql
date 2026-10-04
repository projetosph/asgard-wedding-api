-- 008_galeria_musica.sql
-- Execute uma vez no PostgreSQL antes de publicar as novas rotas.

CREATE TABLE IF NOT EXISTS casamento_galeria (
  id BIGSERIAL PRIMARY KEY,
  casamento_id BIGINT NOT NULL REFERENCES casamentos(id) ON DELETE CASCADE,
  imagem_url TEXT NOT NULL,
  legenda VARCHAR(240),
  ordem INTEGER,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_casamento_galeria_ordem
ON casamento_galeria(casamento_id, ativo, ordem);

CREATE TABLE IF NOT EXISTS casamento_musica (
  casamento_id BIGINT PRIMARY KEY REFERENCES casamentos(id) ON DELETE CASCADE,
  titulo VARCHAR(180),
  url TEXT NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
