-- 013_credenciais_casal_compat.sql
-- Compatibilidade para criação/redefinição do acesso do casal pelo ADM.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS senha_admin_enc TEXT;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email_unique
  ON usuarios (LOWER(email));
