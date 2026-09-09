-- V44__product_invitation_bridge_by_name_and_plan2.sql
-- Fase 5, sesión E3, agente 5-E3-C2. Cierra R1-12 y R1-15 de `bitacora/5-E3-R1-seguridad.md`.
-- ADR-5-E3-C2-03 y ADR-5-E3-C2-04.
--
-- V42 ya está aplicada y NO se edita: lo que estaba mal se corrige desde aquí.
--
-- QUÉ ARREGLA
--
-- (1) R1-12a · V42 ató las filas puente a ids fijos de `event_type` (`INSERT … (7,…),(8,…)
--     ON CONFLICT (id) DO NOTHING`). El catálogo antiguo es ADMINISTRABLE: si los ids 7 u 8 ya
--     estaban ocupados por otros tipos, la inserción se saltó **en silencio** y las plantillas puente
--     907/908 quedaron colgando de otro tipo de evento. `BusinessSnapshotReader` deduce el `eventKind`
--     de la invitación por ese join (`BusinessSnapshotReader.kt:31-38`), así que el tipo de evento que
--     la clienta eligió en el asistente se perdía sin ningún error. Aquí el tipo se resuelve por
--     NOMBRE —exacto primero, patrón después— y solo se inserta uno nuevo si de verdad no existe; los
--     ids los pone la secuencia, nunca esta migración.
--
--     El nombre elegido para cada tipo no es decorativo: `BusinessSnapshotReader.mapEventKind`
--     (`:69-86`) normaliza acentos y mayúsculas y compara el nombre contra una tabla fija. El nombre
--     ES la clave del mapeo, y por eso resolver por nombre es más sólido que resolver por id.
--
-- (2) R1-12b · No había puente de plan 2, así que E4 no tenía por dónde subir una invitación a plan
--     pagado al cobrar: las ocho filas de V42 llevan `invitation_plan_id` = básico → `planTier = 1`
--     (`BusinessSnapshotReader.kt:63`) y `:choose-template` bloquea las plantillas de `minPlanTier = 2`.
--     Se siembran las ocho GEMELAS de plan 2, con el marcador `templates2:<eventKind>:plan2`.
--     Qué tiene que hacer E4 al cobrar: `memoria/handoffs/5-E3-C2-para-E4.md`.
--
-- (3) R1-15 · `invitation_template_id_seq` se quedó en 10 (`V25:10`), así que la plantilla nº 891 que
--     diera de alta la administración antigua chocaría contra las filas 901-908 —`ON CONFLICT` no
--     protege un `INSERT` ajeno—. Se avanza la secuencia por encima de toda la banda ocupada, igual
--     que `V42:42` sí hizo con `event_type_id_seq`.
--
-- Idempotente y sin ids codificados: todo se resuelve por marcador de `url` o por nombre.
-- No toca código Kotlin de ningún módulo prohibido: es SQL sobre tablas compartidas, como V42.

-- ---------------------------------------------------------------------------------------------
-- 1. Cada fila puente cuelga del `event_type` que le corresponde POR NOMBRE.
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
    r          RECORD;
    v_event_id BIGINT;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('wedding',      'boda',          '%boda%',       'Boda',          true),
            ('quince',       'quince años',   '%quince%',     'Quince años',   false),
            ('baptism',      'bautizo',       '%bautizo%',    'Bautizo',       false),
            ('communion',    'comunión',      '%comuni%',     'Comunión',      false),
            ('confirmation', 'confirmación',  '%confirmaci%', 'Confirmación',  false),
            ('birthday',     'cumpleaños',    '%cumplea%',    'Cumpleaños',    false),
            ('graduation',   'graduación',    '%graduaci%',   'Graduación',    false),
            -- `generic` es el único que se resuelve por nombre EXACTO y sin patrón: su contrato es
            -- justamente NO casar con ninguna clave de `mapEventKind`, y «Evento» no casa con
            -- ninguna. Un patrón amplio aquí podría capturar un tipo administrativo cualquiera.
            ('generic',      'evento',        NULL,           'Evento',        false)
        ) AS t(kind, nombre_exacto, patron, nombre_canonico, es_boda)
    LOOP
        v_event_id := NULL;

        -- (a) nombre exacto, que es el caso sano y el que deja el mapeo sin ninguna ambigüedad.
        SELECT id INTO v_event_id
          FROM public.event_type
         WHERE lower(name) = r.nombre_exacto
           AND (is_wedding IS TRUE) = r.es_boda
         ORDER BY id
         LIMIT 1;

        -- (b) el catálogo es administrable: puede estar renombrado («XV Años», «Graduaciones»…).
        IF v_event_id IS NULL AND r.patron IS NOT NULL THEN
            IF r.es_boda THEN
                SELECT id INTO v_event_id
                  FROM public.event_type
                 WHERE is_wedding IS TRUE OR lower(name) LIKE r.patron
                 ORDER BY id
                 LIMIT 1;
            ELSE
                -- `is_wedding` manda sobre el nombre en `mapEventKind` (`:81`), así que un tipo
                -- marcado como boda nunca puede servir de puente para otro `eventKind`.
                SELECT id INTO v_event_id
                  FROM public.event_type
                 WHERE is_wedding IS NOT TRUE AND lower(name) LIKE r.patron
                 ORDER BY id
                 LIMIT 1;
            END IF;
        END IF;

        -- (c) no existe: se crea, deshabilitado para que no aparezca en el catálogo antiguo, y con el
        --     id que le toque de la secuencia — nunca uno escrito a mano.
        IF v_event_id IS NULL THEN
            INSERT INTO public.event_type (name, is_wedding, is_enabled, created_at, updated_at)
            VALUES (r.nombre_canonico, r.es_boda, false, NOW(), NOW())
            RETURNING id INTO v_event_id;
        END IF;

        UPDATE public.invitation_template
           SET event_type_id = v_event_id,
               updated_at     = NOW()
         WHERE url = 'templates2:' || r.kind
           AND event_type_id IS DISTINCT FROM v_event_id;
    END LOOP;
END $$;

SELECT setval(
    'public.event_type_id_seq',
    GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.event_type), 1),
    true
);

-- ---------------------------------------------------------------------------------------------
-- 2. R1-15: la secuencia de `invitation_template` por encima de la banda 901-908 de V42, ANTES de
--    sembrar nada nuevo, para que las gemelas de plan 2 tomen ids libres y el catálogo antiguo siga
--    numerando por detrás de ellas.
-- ---------------------------------------------------------------------------------------------
SELECT setval(
    'public.invitation_template_id_seq',
    GREATEST(908, (SELECT COALESCE(MAX(id), 1) FROM public.invitation_template)),
    true
);

-- ---------------------------------------------------------------------------------------------
-- 3. Las ocho gemelas de plan 2. Se derivan de las de plan 1 con un `SELECT`, así que apuntan
--    exactamente al mismo `event_type` que su hermana (ya corregido en el paso 1) y no hay una
--    segunda lista de tipos que se pueda desincronizar. El plan se resuelve por `is_premium`, no
--    por el id 2. Sin ids explícitos: los pone la secuencia que el paso 2 acaba de avanzar.
--    `is_enabled = false` y `price = 0` por las mismas razones que en V42 (`V42:26-30`).
-- ---------------------------------------------------------------------------------------------
INSERT INTO public.invitation_template
    (name, price, url, image, event_type_id, invitation_plan_id, is_enabled, created_at, updated_at)
SELECT
    left(b.name || ' (plan 2)', 255),
    0,
    b.url || ':plan2',
    '',
    b.event_type_id,
    premium.id,
    false,
    NOW(),
    NOW()
  FROM public.invitation_template b
 CROSS JOIN LATERAL (
     SELECT id FROM public.invitation_plan WHERE is_premium IS TRUE ORDER BY id LIMIT 1
 ) AS premium
 WHERE b.url LIKE 'templates2:%'
   AND b.url NOT LIKE '%:plan2'
   AND NOT EXISTS (
       SELECT 1 FROM public.invitation_template g WHERE g.url = b.url || ':plan2'
   );

SELECT setval(
    'public.invitation_template_id_seq',
    GREATEST(908, (SELECT COALESCE(MAX(id), 1) FROM public.invitation_template)),
    true
);
