-- =====================================================================================
-- V42 — product_plan: el catalogo que se VENDE (fase 5, sesion E4; ADR-5-4-01).
--
-- Por que una tabla nueva y no `invitation_plan` (12-producto-completo.md A5.3, verificado):
--   1. `invitation_plan` NO tiene precio, ni moneda, ni identificador externo: es imposible
--      vender con ella. El precio real vive hoy en `invitation_template.price`, y ese modulo
--      (`modules/master/templates`) esta prohibido y se retira en la fase 7.
--   2. `invitation_plan` describe otra cosa: con `is_premium` y dos filas sirve para FILTRAR
--      catalogos (frases, canciones, codigos de vestimenta, imagenes de regalo: seis claves
--      foraneas hacia ella). Cambiarle el significado romperia esos seis catalogos.
-- Por eso `invitation_plan` NO se toca en esta migracion ni en ninguna otra de E4.
--
-- Importes en CENTAVOS (bigint). Nunca `double precision`: `invitation.total_amount` ya
-- arrastra ese error y se queda como dato heredado.
-- =====================================================================================

CREATE TABLE IF NOT EXISTS product_plan (
    id              bigserial     PRIMARY KEY,
    codigo          varchar(40)   NOT NULL UNIQUE,
    nombre          varchar(80)   NOT NULL,
    descripcion     varchar(240)  NOT NULL DEFAULT '',
    precio_centavos bigint        NOT NULL CHECK (precio_centavos > 0),
    -- varchar(3) y no char(3): Postgres implementa char(n) como `bpchar`, que Hibernate rechaza al
    -- validar contra un campo String (`ddl-auto: validate` no arranca). Ver nota del contrato.
    moneda          varchar(3)    NOT NULL DEFAULT 'MXN',
    invitados_max   int           NULL,
    incluye         jsonb         NOT NULL DEFAULT '[]'::jsonb,
    recomendado     boolean       NOT NULL DEFAULT false,
    activo          boolean       NOT NULL DEFAULT true,
    orden           int           NOT NULL DEFAULT 0,
    -- Identificador del precio en Stripe. NULL = el importe se manda como `price_data` en el
    -- checkout. No es un secreto (`price_...` es publico), pero nace NULL: lo rellena quien
    -- configure la cuenta real, nunca esta migracion.
    stripe_price_id varchar(80)   NULL,
    created_at      timestamptz   NOT NULL DEFAULT now(),
    updated_at      timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE  product_plan IS 'Catalogo de planes que se venden (fase 5, ADR-5-4-01). No sustituye a invitation_plan, que filtra catalogos.';
COMMENT ON COLUMN product_plan.invitados_max IS 'NULL = sin limite de invitados.';
COMMENT ON COLUMN product_plan.incluye IS 'Array JSON de frases que la pantalla de precios pinta tal cual.';

CREATE INDEX IF NOT EXISTS ix_product_plan_activo_orden ON product_plan (activo, orden);

-- Siembra de los tres planes. Los PRECIOS son los del catalogo inicial acordado en el contrato
-- de E4 (5-4-contrato-pagos.md 1) y estan anotados como PREGUNTA ABIERTA al dueno: si cambian,
-- se cambian con un UPDATE en una migracion posterior, no editando esta.
INSERT INTO product_plan (codigo, nombre, descripcion, precio_centavos, moneda, invitados_max, incluye, recomendado, activo, orden)
VALUES
  ('sencillo', 'Sencillo',
   'Para una celebracion intima, con todo lo necesario para invitar y confirmar.',
   49900, 'MXN', 60,
   '["Hasta 60 invitados","Confirmaciones ilimitadas","Enlace propio"]'::jsonb,
   false, true, 10),
  ('fiesta', 'Fiesta',
   'El plan con el que se queda la mayoria: mas invitados y galeria de fotos.',
   89900, 'MXN', 150,
   '["Hasta 150 invitados","Confirmaciones ilimitadas","Enlace propio","Galeria de fotos"]'::jsonb,
   true, true, 20),
  ('grande', 'Grande',
   'Sin limite de invitados, para bodas y fiestas grandes.',
   149900, 'MXN', NULL,
   '["Invitados sin limite","Confirmaciones ilimitadas","Enlace propio","Galeria de fotos","Soporte prioritario"]'::jsonb,
   false, true, 30)
ON CONFLICT (codigo) DO NOTHING;
