-- V10: Create invitation_guest_notification table
-- This table saves notifications sent to guests regarding their invitations.

CREATE TABLE IF NOT EXISTS invitation_guest_notification (
    id BIGSERIAL PRIMARY KEY,
    invitation_id BIGINT NOT NULL,
    notified_by BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_invitation_guest_notification_invitation
    FOREIGN KEY (invitation_id)
    REFERENCES invitation(id)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_invitation_guest_notification_invitation_id ON invitation_guest_notification(invitation_id);
