INSERT INTO public.event_type (id, name, is_wedding, is_enabled, created_at, updated_at)
VALUES 
    (3, 'Bautizo', false, true, NOW(), NOW()),
    (4, 'Comunión', false, true, NOW(), NOW()),
    (5, 'Confirmación', false, true, NOW(), NOW()),
    (6, 'Cumpleaños', false, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;


INSERT INTO public.invitation_template (id, name, price, url, image, event_type_id, invitation_plan_id, is_enabled, created_at, updated_at)
VALUES 
    (6, 'XV Años Elegance Premium', 3860.00, 'https://www.invitaciones-digitales.com.mx/demo/xv', 'https://invitacionesdigitales.s3.us-east-2.amazonaws.com/demos/xv/premium/captura-xv.jpg', 2, 2, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Sincronizar la secuencia de IDs
SELECT setval('public.event_type_id_seq', 6, true);
SELECT setval('public.invitation_template_id_seq', 6, true);