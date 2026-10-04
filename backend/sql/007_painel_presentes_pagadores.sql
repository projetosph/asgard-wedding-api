-- 007_ordem_presentes.sql
-- Execute no PostgreSQL ANTES de publicar casalRoutes.js desta etapa.

ALTER TABLE casamento_presentes
  ADD COLUMN IF NOT EXISTS ordem INTEGER;

-- Preenche uma ordem inicial estável para registros antigos.
WITH numerados AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY casamento_id
      ORDER BY id ASC
    ) AS nova_ordem
  FROM casamento_presentes
)
UPDATE casamento_presentes cp
SET ordem = n.nova_ordem
FROM numerados n
WHERE cp.id = n.id
  AND cp.ordem IS NULL;

CREATE INDEX IF NOT EXISTS idx_casamento_presentes_ordem
ON casamento_presentes(casamento_id, ativo, ordem);

-- Observação:
-- casamento_pagamentos já possui nome, email e metodo_pagamento.
-- Não é necessário criar colunas adicionais para esses dados.
