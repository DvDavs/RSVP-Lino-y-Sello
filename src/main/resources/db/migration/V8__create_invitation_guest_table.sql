-- V8: Create invitation_guest table
-- This table stores guest information for each invitation, including contact details,
-- RSVP status, and the number of confirmed attendees.

CREATE TABLE IF NOT EXISTS invitation_guest (
    id BIGSERIAL PRIMARY KEY,
    invitation_id BIGINT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    adults_count INT NOT NULL DEFAULT 0,
    children_count INT NOT NULL DEFAULT 0,
    young_count INT NOT NULL DEFAULT 0,
    adults_count_confirmed INT NOT NULL DEFAULT 0,
    children_count_confirmed INT NOT NULL DEFAULT 0,
    young_count_confirmed INT NOT NULL DEFAULT 0,
    is_attending BOOLEAN NOT NULL DEFAULT false,
    confirmation_token VARCHAR(255),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    notification_date_sent VARCHAR(255),
    created_by BIGINT,
    updated_by BIGINT,
    deleted_by BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_invitation_guest_invitation
        FOREIGN KEY (invitation_id)
        REFERENCES invitation(id),
    
    CONSTRAINT fk_invitation_guest_created_by
        FOREIGN KEY (created_by)
        REFERENCES customer(id),

    CONSTRAINT fk_invitation_guest_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES customer(id),
    
    CONSTRAINT fk_invitation_guest_deleted_by
        FOREIGN KEY (deleted_by)
        REFERENCES customer(id)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_invitation_guest_invitation_id ON invitation_guest(invitation_id);
CREATE INDEX IF NOT EXISTS idx_invitation_guest_email ON invitation_guest(email);
CREATE INDEX IF NOT EXISTS idx_invitation_guest_phone ON invitation_guest(phone);
CREATE INDEX IF NOT EXISTS idx_invitation_guest_confirmation_token ON invitation_guest(confirmation_token);
CREATE INDEX IF NOT EXISTS idx_invitation_guest_deleted_by ON invitation_guest(deleted_by);

