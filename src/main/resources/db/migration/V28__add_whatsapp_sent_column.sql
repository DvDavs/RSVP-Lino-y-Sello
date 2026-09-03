-- Agregar columna custom_name
ALTER TABLE invitation_guest 
    ADD COLUMN IF NOT EXISTS custom_name VARCHAR(255);

-- 👇 AGREGAR ESTA PARTE (te falta)
ALTER TABLE invitation_guest 
    ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN DEFAULT FALSE;

-- Comentarios
COMMENT ON COLUMN invitation_guest.custom_name IS 'Custom name for display purposes';
COMMENT ON COLUMN invitation_guest.whatsapp_sent IS 'Indicates if a WhatsApp message has been sent to the guest';