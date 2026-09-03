-- Add phrases, gift images, and songs for all event types
-- V26 Correction

-- ============================================
-- CUSTOM PHRASES FOR XV AÑOS PREMIUM & OTHERS
-- ============================================

-- Insert custom_phrase entries for all event types
INSERT INTO public.custom_phrase (id, created_at, genre, genre_orientation, updated_at, event_type_id, invitation_plan_id)
VALUES 
    -- XV Años
    (18, NOW(), 'FEMALE', 'CELEBRATED', NOW(), 2, 2),
    (19, NOW(), 'FEMALE', 'GUESTS', NOW(), 2, 2),
    -- Bautizo
    (20, NOW(), 'ANY', 'CELEBRATED', NOW(), 3, 2),
    (21, NOW(), 'ANY', 'GUESTS', NOW(), 3, 2),
    -- Comunión
    (22, NOW(), 'ANY', 'CELEBRATED', NOW(), 4, 2),
    (23, NOW(), 'ANY', 'GUESTS', NOW(), 4, 2),
    -- Confirmación
    (24, NOW(), 'ANY', 'CELEBRATED', NOW(), 5, 2),
    (25, NOW(), 'ANY', 'GUESTS', NOW(), 5, 2),
    -- Cumpleaños
    (26, NOW(), 'ANY', 'CELEBRATED', NOW(), 6, 2),
    (27, NOW(), 'ANY', 'GUESTS', NOW(), 6, 2);

-- Phrases for FEMALE + CELEBRATED (XV Años)
INSERT INTO public.phrase_options (id, created_at, text, updated_at, custom_phrase_id)
VALUES
    (55, NOW(), 'Con ilusión y emoción, llego a mis XV Años. Este día marca el inicio de una nueva etapa llena de sueños por cumplir. Gracias por ser parte de este momento inolvidable y por acompañarme en mi camino hacia la vida adulta.', NOW(), 18),
    (56, NOW(), 'Hoy celebro mis quince primaveras rodeada del amor de mi familia y amigos. Dejo atrás mi niñez para convertirme en una joven llena de esperanzas y proyectos. Agradezco a Dios por esta bendición y por cada uno de ustedes que están aquí presentes.', NOW(), 18),
    (57, NOW(), 'Este día tan especial marca el comienzo de una nueva etapa en mi vida. Soy el reflejo del amor y dedicación de mi familia. Con humildad y alegría, inicio mi camino como mujer, lista para enfrentar el mundo con valentía y optimismo.', NOW(), 18),
    (58, NOW(), 'Llegó el día con el que tanto soñé. Mis XV Años representan un momento único e irrepetible. Agradezco infinitamente a mis padres por su apoyo incondicional y a todos ustedes por compartir conmigo esta celebración llena de amor y felicidad.', NOW(), 18),
    (59, NOW(), 'Hoy florezco como una rosa en primavera. Dejo mi infancia con nostalgia pero miro hacia adelante con entusiasmo. Gracias por ser testigos de mi transformación y por llenar este día con su presencia y cariño. Los llevaré siempre en mi corazón.', NOW(), 18);

-- Phrases for FEMALE + GUESTS (XV Años)
INSERT INTO public.phrase_options (id, created_at, text, updated_at, custom_phrase_id)
VALUES
    (60, NOW(), 'Queridos familiares y amigos: Su presencia en esta celebración es el mejor regalo que podría recibir. Gracias por acompañarme en este día tan especial y por formar parte de mi vida. Disfruten de esta fiesta que hemos preparado con mucho cariño para ustedes.', NOW(), 19),
    (61, NOW(), 'A todas las personas que hoy me acompañan: Les agradezco de corazón por estar aquí. Cada uno de ustedes ha dejado una huella importante en mi vida. Que esta noche sea memorable para todos. Los quiero mucho y valoro su compañía en este momento único.', NOW(), 19),
    (62, NOW(), 'Estimados invitados: Es un honor contar con su presencia en mis XV Años. Su cariño y buenos deseos son invaluables para mí. Espero que disfruten de esta celebración tanto como yo disfruto tenerlos aquí. Gracias por ser parte de mi historia y de mi crecimiento.', NOW(), 19),
    (63, NOW(), 'Con el corazón lleno de alegría les doy la bienvenida a mi fiesta de XV Años. Gracias por tomarse el tiempo para celebrar conmigo este día tan importante. Su amor y apoyo significan el mundo para mí. Que la música, la comida y la diversión hagan de esta noche una experiencia inolvidable.', NOW(), 19),
    (64, NOW(), 'A mis seres queridos: No hay palabras suficientes para agradecer su presencia. Cada sonrisa, cada abrazo y cada palabra de aliento que recibo hoy se quedarán grabados en mi memoria para siempre. Celebremos juntos esta noche mágica con alegría y gratitud.', NOW(), 19);

-- ============================================
-- PHRASES FOR BAUTIZO (eventTypeId=3)
-- ============================================

-- Phrases for ANY + CELEBRATED (Bautizo)
INSERT INTO public.phrase_options (id, created_at, text, updated_at, custom_phrase_id)
VALUES
    (65, NOW(), 'Hoy recibo el sacramento del Bautismo, el primer paso en mi camino de fe. Agradezco a mis padres y padrinos por guiarme en este hermoso inicio de mi vida espiritual.', NOW(), 20),
    (66, NOW(), 'En este día especial, mi familia me presenta ante Dios y la comunidad. Gracias por acompañarme en este momento sagrado que marca el comienzo de mi vida cristiana.', NOW(), 20),
    (67, NOW(), 'Con amor y bendiciones, inicio mi camino en la fe. Gracias a todos los que me acompañan en este día tan importante para mi vida y mi familia.', NOW(), 20);

-- Phrases for ANY + GUESTS (Bautizo)
INSERT INTO public.phrase_options (id, created_at, text, updated_at, custom_phrase_id)
VALUES
    (68, NOW(), 'Queridos familiares y amigos: Su presencia en el bautismo de nuestro hijo/a es una bendición. Gracias por compartir con nosotros este momento sagrado lleno de amor y fe.', NOW(), 21),
    (69, NOW(), 'Agradecemos de corazón su compañía en este día tan especial. Que Dios bendiga a cada uno de ustedes por ser parte de este hermoso sacramento.', NOW(), 21),
    (70, NOW(), 'Su presencia hace de esta celebración un momento aún más especial. Gracias por acompañarnos en este inicio del camino espiritual de nuestro pequeño/a.', NOW(), 21);

-- ============================================
-- PHRASES FOR COMUNIÓN (eventTypeId=4)
-- ============================================

-- Phrases for ANY + CELEBRATED (Comunión)
INSERT INTO public.phrase_options (id, created_at, text, updated_at, custom_phrase_id)
VALUES
    (71, NOW(), 'Hoy recibo por primera vez el Cuerpo de Cristo. Este momento marca un paso importante en mi vida de fe y me llena de alegría poder compartirlo con ustedes.', NOW(), 22),
    (72, NOW(), 'Con el corazón lleno de emoción y gratitud, celebro mi Primera Comunión. Gracias a mi familia, mis padrinos y todos los que me han guiado en mi preparación para este sacramento.', NOW(), 22),
    (73, NOW(), 'Este día tan especial representa mi encuentro personal con Jesús. Agradezco a todos los que me acompañan y han sido parte de mi formación espiritual.', NOW(), 22);

-- Phrases for ANY + GUESTS (Comunión)
INSERT INTO public.phrase_options (id, created_at, text, updated_at, custom_phrase_id)
VALUES
    (74, NOW(), 'Queridos invitados: Su presencia en la Primera Comunión de nuestro hijo/a es un regalo invaluable. Gracias por compartir con nosotros este momento de fe y alegría.', NOW(), 23),
    (75, NOW(), 'Agradecemos su compañía en este día tan importante. Que la bendición de este sacramento llegue también a sus vidas y familias.', NOW(), 23),
    (76, NOW(), 'Gracias por acompañarnos en la celebración de este sacramento. Su presencia hace de este día un momento inolvidable para nuestra familia.', NOW(), 23);

-- ============================================
-- PHRASES FOR CONFIRMACIÓN (eventTypeId=5)
-- ============================================

-- Phrases for ANY + CELEBRATED (Confirmación)
INSERT INTO public.phrase_options (id, created_at, text, updated_at, custom_phrase_id)
VALUES
    (77, NOW(), 'Hoy reafirmo mi fe y recibo los dones del Espíritu Santo. Este sacramento me fortalece en mi camino cristiano y me compromete a vivir según los valores del Evangelio.', NOW(), 24),
    (78, NOW(), 'Con madurez y convicción, confirmo mi fe ante Dios y la comunidad. Agradezco a todos los que me han acompañado en este camino de formación y crecimiento espiritual.', NOW(), 24),
    (79, NOW(), 'Este día marca un momento importante en mi vida de fe. Acepto con responsabilidad y alegría los compromisos que adquiero al recibir el sacramento de la Confirmación.', NOW(), 24);

-- Phrases for ANY + GUESTS (Confirmación)
INSERT INTO public.phrase_options (id, created_at, text, updated_at, custom_phrase_id)
VALUES
    (80, NOW(), 'Estimados familiares y amigos: Su presencia en la Confirmación de nuestro hijo/a es muy significativa. Gracias por acompañarnos en este paso importante de su vida espiritual.', NOW(), 25),
    (81, NOW(), 'Agradecemos profundamente su compañía en este sacramento. Su apoyo y oraciones son fundamentales en el camino de fe de nuestro joven.', NOW(), 25),
    (82, NOW(), 'Gracias por celebrar con nosotros este momento de madurez espiritual. Su presencia es una bendición para nuestra familia.', NOW(), 25);

-- ============================================
-- PHRASES FOR CUMPLEAÑOS (eventTypeId=6)
-- ============================================

-- Phrases for ANY + CELEBRATED (Cumpleaños)
INSERT INTO public.phrase_options (id, created_at, text, updated_at, custom_phrase_id)
VALUES
    (83, NOW(), 'Hoy celebro un año más de vida rodeado/a del amor de mi familia y amigos. Gracias por ser parte de este día especial y por todos los momentos compartidos.', NOW(), 26),
    (84, NOW(), 'Agradezco a la vida por permitirme celebrar un cumpleaños más junto a las personas que más amo. Su presencia hace de este día algo verdaderamente memorable.', NOW(), 26),
    (85, NOW(), 'Con alegría y gratitud celebro mi cumpleaños. Gracias por acompañarme en este día y por ser parte importante de mi vida.', NOW(), 26),
    (86, NOW(), 'Cada año que pasa es una bendición, y celebrarlo con ustedes lo hace aún más especial. Gracias por estar aquí y compartir mi felicidad.', NOW(), 26);

-- Phrases for ANY + GUESTS (Cumpleaños)
INSERT INTO public.phrase_options (id, created_at, text, updated_at, custom_phrase_id)
VALUES
    (87, NOW(), 'Queridos amigos y familiares: Su presencia en mi cumpleaños es el mejor regalo. Gracias por tomarse el tiempo de celebrar conmigo este día tan especial.', NOW(), 27),
    (88, NOW(), 'Agradezco infinitamente su compañía en esta celebración. Que disfrutemos juntos de esta fiesta llena de alegría y buenos momentos.', NOW(), 27),
    (89, NOW(), 'Gracias por estar aquí y hacer de mi cumpleaños un día inolvidable. Su amistad y cariño son los mejores regalos que puedo recibir.', NOW(), 27),
    (90, NOW(), 'Su presencia ilumina esta celebración. Gracias por compartir conmigo este día especial. ¡Que disfrutemos juntos de esta fiesta!', NOW(), 27);


-- ============================================
-- GIFT IMAGES
-- ============================================

-- XV Básico (2, 1)
INSERT INTO public.gift_image (id, category, created_at, imageurl, is_enabled, name, updated_at, event_type_id, invitation_plan_id)
VALUES 
    (7, 'DIGITAL', NOW(), '/images/mesa/amazon.png', true, 'amazon', NOW(), 2, 1),
    (8, 'DIGITAL', NOW(), '/images/mesa/liverpool.png', true, 'liverpool', NOW(), 2, 1),
    (9, 'DIGITAL', NOW(), '/images/mesa/mercadolibre.png', true, 'mercadolibre', NOW(), 2, 1),
    (10, 'BANK', NOW(), '/images/mesa/bbva.png', true, 'bbva', NOW(), 2, 1),
    (11, 'BANK', NOW(), '/images/mesa/santander.png', true, 'santander', NOW(), 2, 1),
    (12, 'BANK', NOW(), '/images/mesa/banorte.png', true, 'banorte', NOW(), 2, 1);

-- XV Premium (2, 2)
INSERT INTO public.gift_image (id, category, created_at, imageurl, is_enabled, name, updated_at, event_type_id, invitation_plan_id)
VALUES 
    (13, 'DIGITAL', NOW(), '/images/mesa/amazon.png', true, 'amazon', NOW(), 2, 2),
    (14, 'DIGITAL', NOW(), '/images/mesa/liverpool.png', true, 'liverpool', NOW(), 2, 2),
    (15, 'DIGITAL', NOW(), '/images/mesa/mercadolibre.png', true, 'mercadolibre', NOW(), 2, 2),
    (16, 'BANK', NOW(), '/images/mesa/bbva.png', true, 'bbva', NOW(), 2, 2),
    (17, 'BANK', NOW(), '/images/mesa/santander.png', true, 'santander', NOW(), 2, 2),
    (18, 'BANK', NOW(), '/images/mesa/banorte.png', true, 'banorte', NOW(), 2, 2);

-- Bautizo Premium (3, 2)
INSERT INTO public.gift_image (id, category, created_at, imageurl, is_enabled, name, updated_at, event_type_id, invitation_plan_id)
VALUES 
    (19, 'DIGITAL', NOW(), '/images/mesa/amazon.png', true, 'amazon', NOW(), 3, 2),
    (20, 'DIGITAL', NOW(), '/images/mesa/liverpool.png', true, 'liverpool', NOW(), 3, 2),
    (21, 'DIGITAL', NOW(), '/images/mesa/mercadolibre.png', true, 'mercadolibre', NOW(), 3, 2),
    (22, 'BANK', NOW(), '/images/mesa/bbva.png', true, 'bbva', NOW(), 3, 2),
    (23, 'BANK', NOW(), '/images/mesa/santander.png', true, 'santander', NOW(), 3, 2),
    (24, 'BANK', NOW(), '/images/mesa/banorte.png', true, 'banorte', NOW(), 3, 2);

-- Comunión Premium (4, 2)
INSERT INTO public.gift_image (id, category, created_at, imageurl, is_enabled, name, updated_at, event_type_id, invitation_plan_id)
VALUES 
    (25, 'DIGITAL', NOW(), '/images/mesa/amazon.png', true, 'amazon', NOW(), 4, 2),
    (26, 'DIGITAL', NOW(), '/images/mesa/liverpool.png', true, 'liverpool', NOW(), 4, 2),
    (27, 'DIGITAL', NOW(), '/images/mesa/mercadolibre.png', true, 'mercadolibre', NOW(), 4, 2),
    (28, 'BANK', NOW(), '/images/mesa/bbva.png', true, 'bbva', NOW(), 4, 2),
    (29, 'BANK', NOW(), '/images/mesa/santander.png', true, 'santander', NOW(), 4, 2),
    (30, 'BANK', NOW(), '/images/mesa/banorte.png', true, 'banorte', NOW(), 4, 2);

-- Confirmación Premium (5, 2)
INSERT INTO public.gift_image (id, category, created_at, imageurl, is_enabled, name, updated_at, event_type_id, invitation_plan_id)
VALUES 
    (31, 'DIGITAL', NOW(), '/images/mesa/amazon.png', true, 'amazon', NOW(), 5, 2),
    (32, 'DIGITAL', NOW(), '/images/mesa/liverpool.png', true, 'liverpool', NOW(), 5, 2),
    (33, 'DIGITAL', NOW(), '/images/mesa/mercadolibre.png', true, 'mercadolibre', NOW(), 5, 2),
    (34, 'BANK', NOW(), '/images/mesa/bbva.png', true, 'bbva', NOW(), 5, 2),
    (35, 'BANK', NOW(), '/images/mesa/santander.png', true, 'santander', NOW(), 5, 2),
    (36, 'BANK', NOW(), '/images/mesa/banorte.png', true, 'banorte', NOW(), 5, 2);

-- Cumpleaños Premium (6, 2)
INSERT INTO public.gift_image (id, category, created_at, imageurl, is_enabled, name, updated_at, event_type_id, invitation_plan_id)
VALUES 
    (37, 'DIGITAL', NOW(), '/images/mesa/amazon.png', true, 'amazon', NOW(), 6, 2),
    (38, 'DIGITAL', NOW(), '/images/mesa/liverpool.png', true, 'liverpool', NOW(), 6, 2),
    (39, 'DIGITAL', NOW(), '/images/mesa/mercadolibre.png', true, 'mercadolibre', NOW(), 6, 2),
    (40, 'BANK', NOW(), '/images/mesa/bbva.png', true, 'bbva', NOW(), 6, 2),
    (41, 'BANK', NOW(), '/images/mesa/santander.png', true, 'santander', NOW(), 6, 2),
    (42, 'BANK', NOW(), '/images/mesa/banorte.png', true, 'banorte', NOW(), 6, 2);


-- ============================================
-- INVITATION SONGS
-- ============================================

INSERT INTO public.invitation_song (id, created_at, is_enabled, name, updated_at, url, event_type_id, invitation_plan_id)
VALUES 
    (1, NOW(), true, 'Canción XV Años', NOW(), 'https://invitacionesdigitales.s3.us-east-2.amazonaws.com/wedding/demo/premium-new/song.mp3', 2, 1),
    (2, NOW(), true, 'Canción XV Años Premium', NOW(), 'https://invitacionesdigitales.s3.us-east-2.amazonaws.com/wedding/demo/premium-new/song.mp3', 2, 2),
    (3, NOW(), true, 'Canción Bautizo', NOW(), 'https://invitacionesdigitales.s3.us-east-2.amazonaws.com/wedding/demo/premium-new/song.mp3', 3, 2),
    (4, NOW(), true, 'Canción Comunión', NOW(), 'https://invitacionesdigitales.s3.us-east-2.amazonaws.com/wedding/demo/premium-new/song.mp3', 4, 2),
    (5, NOW(), true, 'Canción Confirmación', NOW(), 'https://invitacionesdigitales.s3.us-east-2.amazonaws.com/wedding/demo/premium-new/song.mp3', 5, 2),
    (6, NOW(), true, 'Canción Cumpleaños', NOW(), 'https://invitacionesdigitales.s3.us-east-2.amazonaws.com/wedding/demo/premium-new/song.mp3', 6, 2);


-- ============================================
-- FINAL SEQUENCE UPDATES
-- ============================================

-- Phrases
SELECT setval('public.custom_phrase_id_seq', 27, true);
SELECT setval('public.phrase_options_id_seq', 90, true);

-- Gift Images
SELECT setval('public.gift_image_id_seq', 42, true);

-- Songs
SELECT setval('public.invitation_song_id_seq', 6, true);