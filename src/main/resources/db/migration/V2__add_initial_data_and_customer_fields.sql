CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO customer (name, lastName, email, password, role, is_enabled, is_banned)
VALUES ('Moises', 'Reyes', 'moises@evolutiondev.mx', crypt('4dm1n1straT0r123$', gen_salt('bf')), 'MASTER', true, false)
    ON CONFLICT (email) DO NOTHING;

INSERT INTO customer (name, lastName, email, password, role, is_enabled, is_banned)
VALUES ('Jessica', 'Hernandez', 'invitacionesdigitalesagape@gmail.com', crypt('4dm1n1straT0r123$', gen_salt('bf')), 'MASTER', true, false)
    ON CONFLICT (email) DO NOTHING;

INSERT INTO customer (name, lastName, email, password, role, is_enabled, is_banned)
VALUES ('Omar', 'Rocha', 'omar@evolutiondev.mx', crypt('4dm1n1straT0r123$', gen_salt('bf')), 'ADMIN', true, false)
    ON CONFLICT (email) DO NOTHING;

INSERT INTO customer (name, lastName, email, password, role, is_enabled, is_banned)
VALUES ('Denisse', 'Rosado', 'denisse@evolutiondev.mx', crypt('4dm1n1straT0r123$', gen_salt('bf')), 'ADMIN', true, false)
    ON CONFLICT (email) DO NOTHING;

