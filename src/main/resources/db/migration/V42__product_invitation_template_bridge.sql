-- V42__product_invitation_template_bridge.sql
-- Fase 5, bloque 5-1b (agente 5-E3-A1). ADR-5-E3-02.
--
-- POR QUÉ EXISTE ESTA MIGRACIÓN
-- `invitation.template_id` es `NOT NULL` y apunta a `invitation_template`, tabla del catálogo ANTIGUO
-- (`V1__initial_schema.sql:281-282`). El alta nueva `POST /product/invitations` crea invitaciones de
-- `templates2`, que no tienen plantilla antigua ninguna. Las dos salidas que planteó el diseño
-- (`12-producto-completo.md §A2.4`) eran hacer la columna anulable o apuntar a una fila puente.
--
-- Se elige la FILA PUENTE. Hacer la columna anulable rompería a los lectores vivos del módulo antiguo:
-- `InvitationEntity.template` es `@ManyToOne(nullable = false)` sobre un tipo Kotlin NO anulable
-- (`InvitationEntity.kt:22-24`), así que un `NULL` convierte en 500 cualquier listado que cargue esa
-- fila — entre ellos `GET /admin/invitations/unpaid`, que E5 reutiliza tal cual.
--
-- Y son OCHO filas, no una, porque `BusinessSnapshotReader` deduce el `eventKind` y el `planTier` de
-- la invitación **por esta FK**: `invitation → invitation_template → event_type / invitation_plan`
-- (`BusinessSnapshotReader.kt:31-38`). Con una sola fila puente, toda invitación nueva compondría
-- como `GENERIC`. Con ocho, el `eventKind` que la clienta elige en el asistente es el que ve
-- `templates2` sin guardar el dato dos veces (P1: una sola fuente de verdad).
--
-- El plan es el BÁSICO (`invitation_plan.id = 1`, `is_premium = false`) → `planTier = 1`: una
-- invitación recién creada no ha pagado nada (ADR-5-0B-01), y `:choose-template` ya bloquea con
-- `PlanTierInsufficientException` las plantillas que exigen plan 2
-- (`EditorDocumentService.kt:121-128`). Subir de nivel al pagar es trabajo de E4.
--
-- NADA DE ESTO TOCA CÓDIGO KOTLIN DEL MÓDULO PROHIBIDO: es data en tablas compartidas. Las filas
-- nacen `is_enabled = false` para no aparecer en el catálogo antiguo (`InvitationTemplateEntity`
-- lleva `@Filter(name = "enabledFilter")`, `InvitationTemplateEntity.kt:15`) y con `price = 0`, para
-- que ningún recálculo de `total_amount` por precio de plantilla antigua invente un importe.
-- Se retiran en la fase 7 junto con la tabla.

-- 1. Dos tipos de evento que el catálogo antiguo nunca tuvo. Los ocho `eventKind` del esquema
--    necesitan uno cada uno para que `BusinessSnapshotReader.mapEventKind` acierte
--    (`BusinessSnapshotReader.kt:69-86`: normaliza el nombre y compara; "Evento" no casa con ninguna
--    clave y cae en GENERIC, que es justo lo que se quiere).
INSERT INTO public.event_type (id, name, is_wedding, is_enabled, created_at, updated_at)
VALUES
    (7, 'Graduación', false, false, NOW(), NOW()),
    (8, 'Evento',     false, false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

SELECT setval('public.event_type_id_seq', GREATEST(8, (SELECT MAX(id) FROM public.event_type)), true);

-- 2. Las ocho filas puente. Ids en la banda reservada 901-908, muy por encima de la secuencia
--    (`invitation_template_id_seq` quedó en 10 en `V25`), que **no se toca**: el módulo antiguo sigue
--    numerando 11, 12, … si alguien da de alta una plantilla vieja.
--    `url` lleva el marcador estable `templates2:<eventKind>` — es la clave por la que el módulo
--    `product` resuelve la fila, para no codificar ids mágicos en Kotlin. `image` y `url` van con
--    cadena, nunca `NULL`: `InvitationTemplateEntity` los mapea a `String` no anulable
--    (`InvitationTemplateEntity.kt:20-26`).
INSERT INTO public.invitation_template
    (id, name, price, url, image, event_type_id, invitation_plan_id, is_enabled, created_at, updated_at)
VALUES
    (901, 'Puente templates2 · Boda',         0, 'templates2:wedding',      '', 1, 1, false, NOW(), NOW()),
    (902, 'Puente templates2 · XV años',      0, 'templates2:quince',       '', 2, 1, false, NOW(), NOW()),
    (903, 'Puente templates2 · Bautizo',      0, 'templates2:baptism',      '', 3, 1, false, NOW(), NOW()),
    (904, 'Puente templates2 · Comunión',     0, 'templates2:communion',    '', 4, 1, false, NOW(), NOW()),
    (905, 'Puente templates2 · Confirmación', 0, 'templates2:confirmation', '', 5, 1, false, NOW(), NOW()),
    (906, 'Puente templates2 · Cumpleaños',   0, 'templates2:birthday',     '', 6, 1, false, NOW(), NOW()),
    (907, 'Puente templates2 · Graduación',   0, 'templates2:graduation',   '', 7, 1, false, NOW(), NOW()),
    (908, 'Puente templates2 · Evento',       0, 'templates2:generic',      '', 8, 1, false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. La resolución por marcador tiene que devolver como mucho una fila, siempre. Este índice parcial
--    lo garantiza en la base y no afecta a ninguna fila del catálogo antiguo.
CREATE UNIQUE INDEX IF NOT EXISTS ux_invitation_template_puente_templates2
    ON public.invitation_template (url)
    WHERE url LIKE 'templates2:%';

-- 4. Índice para el conteo de borradores por clienta de `POST /product/invitations`, que filtra
--    siempre por `customer_id` (nunca cuenta la tabla entera).
CREATE INDEX IF NOT EXISTS ix_invitation_customer_templates2
    ON public.invitation (customer_id)
    WHERE uses_templates2;
