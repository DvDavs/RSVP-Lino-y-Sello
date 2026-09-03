-- Add missing couple phrase combinations for premium wedding invitations
-- OTHER + HETEROSEXUAL (novie → novia): id 16
-- OTHER + GAY (novie → novio): id 17

-- Insert custom_phrase entries
INSERT INTO public.custom_phrase (id, created_at, genre, genre_orientation, updated_at, event_type_id, invitation_plan_id)
VALUES 
    (16, NOW(), 'OTHER', 'HETEROSEXUAL', NOW(), 1, 2),
    (17, NOW(), 'OTHER', 'GAY', NOW(), 1, 2);

-- Phrases for OTHER + HETEROSEXUAL (novie → novia)
INSERT INTO public.phrase_options (id, created_at, text, updated_at, custom_phrase_id)
VALUES
    (47, NOW(), 'Hoy inicio un nuevo camino junto a ti, la persona que ilumina cada uno de mis días. Prometo ser tu apoyo incondicional, tu refugio en los momentos difíciles y tu cómplice en cada aventura. Te amo con todo mi ser.', NOW(), 16),
    (48, NOW(), 'Ante todas las personas que nos acompañan, quiero expresar lo afortunade que me siento de tenerte como mi compañera de vida. Tu amor me ha transformado y me ha mostrado que el amor verdadero no conoce límites. Gracias por elegirme.', NOW(), 16),
    (49, NOW(), 'Mi amor, este día marca el comienzo de nuestra historia juntes. Prometo respetarte, cuidarte y celebrar cada aspecto de quien eres. Tu sonrisa es mi mayor alegría, y tu felicidad, mi mayor objetivo. Te amaré por siempre.', NOW(), 16),
    (50, NOW(), 'Desde que te conocí, supe que eras la persona con quien quería compartir mi vida. Hoy, frente a todes, declaro mi amor por ti. Prometo ser tu compañere fiel, tu mejor amigue y tu amor eterno. Juntes por siempre, mi amor.', NOW(), 16);

-- Phrases for OTHER + GAY (novie → novio)
INSERT INTO public.phrase_options (id, created_at, text, updated_at, custom_phrase_id)
VALUES
    (51, NOW(), 'Hoy comienzo este viaje junto al hombre que ha cambiado mi vida para siempre. Prometo ser tu compañere incondicional, estar a tu lado en cada momento y construir juntos un hogar lleno de amor y respeto. Te amo con todo mi corazón.', NOW(), 17),
    (52, NOW(), 'Mi amor, no hay palabras suficientes para expresar lo que siento por ti. Eres el hombre que me completa, quien me entiende sin juzgar y quien me hace sentir amade y respetade. Hoy me comprometo a amarte todos los días de mi vida.', NOW(), 17),
    (53, NOW(), 'Ante todes les presentes, declaro mi amor por ti, el hombre que me ha mostrado que el amor verdadero trasciende cualquier barrera. Prometo cuidarte, respetarte y celebrar nuestra autenticidad cada día. Gracias por ser mi luz.', NOW(), 17),
    (54, NOW(), 'Hoy celebramos nuestro amor, ese que desafía normas y se nutre de lo genuino. Te miro y veo mi futuro, mi alegría y mi paz. Estaré a tu lado en cada amanecer, porque el amor que siento por ti es tan real como infinito. Te amo, mi vida.', NOW(), 17);

-- Update sequence to next available value
SELECT setval('public.custom_phrase_id_seq', 17, true);
SELECT setval('public.phrase_options_id_seq', 54, true);

