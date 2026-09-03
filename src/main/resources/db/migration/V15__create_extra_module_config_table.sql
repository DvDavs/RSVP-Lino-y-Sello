-- V15: Create extra_module_config table to store prices and configuration for extra modules.

CREATE TABLE IF NOT EXISTS extra_module_config (
    id BIGSERIAL PRIMARY KEY,
    module VARCHAR(255) UNIQUE NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by BIGINT,
    updated_by BIGINT,
    deleted_by BIGINT
);

-- Insert initial data for existing modules with a default price of 0.
INSERT INTO extra_module_config (module, price) VALUES
    ('DRESS_CODE', 0.00),
    ('RECOMMENDATIONS', 0.00),
    ('OUR_STORY', 0.00),
    ('AMENITIES_AND_ACTIVITIES', 0.00),
    ('PARENTS_AND_GODPARENTS', 0.00)
ON CONFLICT (module) DO NOTHING;

