-- V25: Agregar plantillas faltantes para Bautizo, Comunion, etc.
INSERT INTO public.invitation_template (id, name, price, url, image, event_type_id, invitation_plan_id, is_enabled, created_at, updated_at)
VALUES 
    (7, 'Bautizo Premium Elegance', 3860.0, 'https://www.invitaciones-digitales.com.mx/bautizo/georgina', 'https://invitacionesdigitales.s3.us-east-2.amazonaws.com/demos/bautizo/captura-bautizo.jpg', 3, 2, true, NOW(), NOW()),
    (8, 'Comunión Premium Elegance', 3860.0, 'https://www.invitaciones-digitales.com.mx/comunion/vanessa', 'https://invitacionesdigitales.s3.us-east-2.amazonaws.com/demos/comunion/captura-comunion.jpg', 4, 2, true, NOW(), NOW()),
    (9, 'Confirmación Premium Elegance', 3860.0, 'https://www.invitaciones-digitales.com.mx/comunion/vanessa1', 'https://invitacionesdigitales.s3.us-east-2.amazonaws.com/demos/confirmacion/captura-confirmacion.jpg', 5, 2, true, NOW(), NOW()),
    (10, 'Cumpleaños Premium Elegance', 3860.0, 'https://www.invitaciones-digitales.com.mx/cumple/maxileon', 'https://invitacionesdigitales.s3.us-east-2.amazonaws.com/demos/cumple/captura-cumple.jpg', 6, 2, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

SELECT setval('public.invitation_template_id_seq', 10, true);