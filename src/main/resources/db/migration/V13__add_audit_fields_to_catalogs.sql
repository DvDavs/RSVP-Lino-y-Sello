-- V13: Add audit fields to catalog tables
-- This migration adds created_by, updated_by, deleted_by fields to all catalog tables
-- to maintain a complete audit trail of who creates, updates, and deactivates catalog items.

-- Add audit fields to invitation_plan
ALTER TABLE invitation_plan
    ADD COLUMN IF NOT EXISTS created_by BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by BIGINT,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT;

-- Add audit fields to event_type
ALTER TABLE event_type
    ADD COLUMN IF NOT EXISTS created_by BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by BIGINT,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT;

-- Add audit fields to dress_code
ALTER TABLE dress_code
    ADD COLUMN IF NOT EXISTS created_by BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by BIGINT,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT;

-- Add audit fields to invitation_template
ALTER TABLE invitation_template
    ADD COLUMN IF NOT EXISTS created_by BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by BIGINT,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT;

-- Add audit fields and is_enabled to custom_phrase
ALTER TABLE custom_phrase
    ADD COLUMN IF NOT EXISTS created_by BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by BIGINT,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT,
    ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;

-- Add is_enabled and created_by to phrase_options
ALTER TABLE phrase_options
    ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS created_by BIGINT;

-- Add audit fields to gift_message
ALTER TABLE gift_message
    ADD COLUMN IF NOT EXISTS created_by BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by BIGINT,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT;

-- Add audit fields to gift_image
ALTER TABLE gift_image
    ADD COLUMN IF NOT EXISTS created_by BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by BIGINT,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT;

