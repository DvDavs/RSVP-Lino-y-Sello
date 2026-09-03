-- Add new fields to invitation_gift_registry table for frontend compatibility
-- bank: stores the bank name (bbva, santander, banorte, etc.) for account type gift registries
-- urltext: stores descriptive text for digital gift registry URLs

ALTER TABLE invitation_gift_registry 
    ADD COLUMN IF NOT EXISTS bank VARCHAR(255),
    ADD COLUMN IF NOT EXISTS urltext VARCHAR(500);

-- Add comment to document the purpose
COMMENT ON COLUMN invitation_gift_registry.bank IS 'Bank name in lowercase for account type gift registries (e.g., bbva, santander, banorte)';
COMMENT ON COLUMN invitation_gift_registry.urltext IS 'Descriptive text for digital gift registry URLs';
