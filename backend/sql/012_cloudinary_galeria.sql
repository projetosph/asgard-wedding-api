-- 012_cloudinary_galeria.sql
-- Permite que a Noivaria gerencie e exclua as fotos hospedadas no Cloudinary
-- sem quebrar as fotos antigas cadastradas apenas por URL.

ALTER TABLE casamento_galeria
  ADD COLUMN IF NOT EXISTS cloudinary_public_id VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_casamento_galeria_cloudinary_public_id
  ON casamento_galeria (cloudinary_public_id)
  WHERE cloudinary_public_id IS NOT NULL;
