CREATE INDEX IF NOT EXISTS idx_invitation_customer_id ON invitation(customer_id);
CREATE INDEX IF NOT EXISTS idx_invitation_created_at ON invitation(created_at);
CREATE INDEX IF NOT EXISTS idx_invitation_date ON invitation(date);
CREATE INDEX IF NOT EXISTS idx_invitation_is_enabled ON invitation(is_enabled);
CREATE INDEX IF NOT EXISTS idx_invitation_is_paid ON invitation(is_paid);
