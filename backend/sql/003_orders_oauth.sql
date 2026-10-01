-- ASGARD WEDDING - FASE 4
-- Orders API + Mercado Pago OAuth por casamento.

ALTER TABLE casamento_pagamentos
  ADD COLUMN IF NOT EXISTS order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS transacao_id VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS uq_casamento_pagamentos_order_id
ON casamento_pagamentos(order_id)
WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_casamento_pagamentos_transacao_id
ON casamento_pagamentos(transacao_id)
WHERE transacao_id IS NOT NULL;