-- Agregar columna is_finished a la tabla invitation
-- Esta columna sirve como bandera para indicar si una invitación ha sido editada y guardada al menos una vez
ALTER TABLE invitation ADD COLUMN IF NOT EXISTS is_finished BOOLEAN NOT NULL DEFAULT false;

