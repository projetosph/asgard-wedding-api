CREATE TABLE IF NOT EXISTS mercadopago_webhook_eventos (
    id BIGSERIAL PRIMARY KEY,
    notification_id VARCHAR(100) UNIQUE,
    order_id VARCHAR(120),
    action VARCHAR(120),
    recebido_em TIMESTAMPTZ DEFAULT NOW(),
    processado_em TIMESTAMPTZ,
    status_processamento VARCHAR(40) DEFAULT 'recebido',
    erro TEXT
);

CREATE INDEX IF NOT EXISTS idx_mp_webhook_order
ON mercadopago_webhook_eventos(order_id);