-- V14: Add audit fields to invitation_song table
-- This migration adds created_by, updated_by, deleted_by fields to the invitation_song table
-- to maintain a complete audit trail of who creates, updates, and deactivates songs.

-- Add audit fields to invitation_song
ALTER TABLE invitation_song
    ADD COLUMN IF NOT EXISTS created_by BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by BIGINT,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT;

-- Add comment for documentation
COMMENT ON COLUMN invitation_song.created_by IS 'ID of the user who created this song entry';
COMMENT ON COLUMN invitation_song.updated_by IS 'ID of the user who last updated this song entry';
COMMENT ON COLUMN invitation_song.deleted_by IS 'ID of the user who deactivated this song entry';

