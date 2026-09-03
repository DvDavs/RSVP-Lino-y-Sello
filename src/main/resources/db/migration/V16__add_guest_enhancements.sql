-- Migration V16: Add guest management enhancements
-- Adds support for optional fields, table numbers, congratulations messages, cancellation tokens
-- and replaces is_attending boolean with attendance_status enum (PENDING, CONFIRMED, DECLINED)

-- Add new columns
ALTER TABLE invitation_guest ADD COLUMN table_number INT;
ALTER TABLE invitation_guest ADD COLUMN congratulations_message TEXT;
ALTER TABLE invitation_guest ADD COLUMN cancellation_token VARCHAR(255);

-- Modify existing columns to allow NULL
ALTER TABLE invitation_guest ALTER COLUMN full_name DROP NOT NULL;
ALTER TABLE invitation_guest ALTER COLUMN email DROP NOT NULL;
ALTER TABLE invitation_guest ALTER COLUMN adults_count DROP NOT NULL;

-- Add attendance_status column (nullable first for migration)
ALTER TABLE invitation_guest ADD COLUMN attendance_status VARCHAR(20);

-- Migrate existing data from is_attending to attendance_status
-- PENDING: Guest has not responded yet (confirmation_token is still present)
UPDATE invitation_guest 
SET attendance_status = 'PENDING'
WHERE confirmation_token IS NOT NULL;

-- CONFIRMED: Guest confirmed attendance (is_attending = true and used their confirmation token)
UPDATE invitation_guest 
SET attendance_status = 'CONFIRMED'
WHERE confirmation_token IS NULL 
  AND is_attending = true;

-- DECLINED: Guest declined attendance (is_attending = false and used their confirmation token)
UPDATE invitation_guest 
SET attendance_status = 'DECLINED'
WHERE confirmation_token IS NULL 
  AND is_attending = false;

-- Make attendance_status NOT NULL now that all rows have been migrated
ALTER TABLE invitation_guest ALTER COLUMN attendance_status SET NOT NULL;

-- Add check constraint for attendance_status values
ALTER TABLE invitation_guest 
ADD CONSTRAINT chk_attendance_status 
CHECK (attendance_status IN ('PENDING', 'CONFIRMED', 'DECLINED'));

-- Drop the deprecated is_attending column (replaced by attendance_status)
ALTER TABLE invitation_guest DROP COLUMN is_attending;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invitation_guest_cancellation_token 
ON invitation_guest(cancellation_token);

CREATE INDEX idx_invitation_guest_attendance_status 
ON invitation_guest(attendance_status);

-- Add comments to document the changes
COMMENT ON COLUMN invitation_guest.table_number IS 'Optional table number assignment for seating organization';
COMMENT ON COLUMN invitation_guest.congratulations_message IS 'Optional congratulations message from guest (max 1000 chars)';
COMMENT ON COLUMN invitation_guest.cancellation_token IS 'Token for cancelling attendance, generated when attendance is confirmed';
COMMENT ON COLUMN invitation_guest.attendance_status IS 'Guest attendance status: PENDING (not responded), CONFIRMED (will attend), DECLINED (will not attend)';

