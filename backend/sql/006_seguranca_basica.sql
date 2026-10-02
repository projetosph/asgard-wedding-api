-- Fase 6.1 - Segurança básica

ALTER TABLE usuarios
DROP CONSTRAINT IF EXISTS usuarios_perfil_casamento_check;

ALTER TABLE usuarios
ADD CONSTRAINT usuarios_perfil_casamento_check
CHECK (
  (perfil = 'admin' AND casamento_id IS NULL)
  OR
  (perfil = 'casal' AND casamento_id IS NOT NULL)
);

-- Tickets curtos e de uso único para iniciar OAuth do Mercado Pago
-- sem colocar o JWT na URL.
CREATE TABLE IF NOT EXISTS mercadopago_connect_tickets (
    token_hash VARCHAR(64) PRIMARY KEY,
    usuario_id BIGINT NOT NULL
        REFERENCES usuarios(id)
        ON DELETE CASCADE,
    casamento_id BIGINT NOT NULL
        REFERENCES casamentos(id)
        ON DELETE CASCADE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    usado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mp_connect_ticket_expira
ON mercadopago_connect_tickets(expires_at);
