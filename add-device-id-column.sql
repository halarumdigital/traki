-- Adicionar coluna device_id na tabela drivers
ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS device_id VARCHAR(255);