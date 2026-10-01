ALTER TABLE casamento_pagamentos
  ADD COLUMN IF NOT EXISTS produto_nome VARCHAR(220),
  ADD COLUMN IF NOT EXISTS produto_imagem TEXT,
  ADD COLUMN IF NOT EXISTS tipo_contribuicao VARCHAR(30),
  ADD COLUMN IF NOT EXISTS parcelas INTEGER,
  ADD COLUMN IF NOT EXISTS payment_method_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS aplicado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_casamento_pagamentos_presente
ON casamento_pagamentos(presente_id);

CREATE INDEX IF NOT EXISTS idx_casamento_pagamentos_status
ON casamento_pagamentos(status);
