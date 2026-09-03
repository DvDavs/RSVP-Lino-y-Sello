-- V12: Add avatar support to customer table

ALTER TABLE customer ADD COLUMN IF NOT EXISTS avatar_id BIGINT;

UPDATE customer 
SET avatar_id = NULL 
WHERE avatar_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM avatars WHERE id = customer.avatar_id);

-- Add foreign key constraint
ALTER TABLE customer ADD CONSTRAINT fk_customer_avatar 
    FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE SET NULL;
