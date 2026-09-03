-- V11: Create avatars table
-- This table will store predefined avatars that users can select for their profile.

CREATE TABLE IF NOT EXISTS avatars (
    id BIGSERIAL PRIMARY KEY,
    s3_key VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for performance optimization on s3_key
CREATE INDEX IF NOT EXISTS idx_avatars_s3_key ON avatars(s3_key);

