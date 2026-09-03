-- V22: Add is_survey_answered flag to customer table
ALTER TABLE customer
    ADD COLUMN IF NOT EXISTS is_survey_answered BOOLEAN NOT NULL DEFAULT false;

-- Opcional: Si quieres marcar usuarios antiguos con datos en 'how_know' como ya contestados:
-- UPDATE customer SET is_survey_answered = true WHERE how_know IS NOT NULL;