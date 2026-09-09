-- =====================================================================================
-- V43 — product_payment: el registro del cobro (fase 5, sesion E4; ADR-5-4-01).
--
-- Hoy el modelo de pago del repositorio es UN BOOLEANO (`invitation.is_paid`) y ahi acaba:
-- no hay importe cobrado, ni moneda, ni fecha, ni referencia externa, asi que no se puede
-- conciliar, ni reembolsar, ni auditar (12-producto-completo.md A5.2, verificado). Esta tabla
-- es ese registro. `invitation.is_paid` se conserva porque el panel heredado lo lee, y lo
-- escribe SOLO el webhook, con una consulta nativa acotada (patron Templates2FlagRepository).
--
-- `stripe_checkout_session_id` y `stripe_payment_intent_id` son UNIQUE a proposito: son la
-- llave por la que el webhook encuentra el pago, y dos filas con la misma llave convertirian
-- un reintento de Stripe en dos cobros distintos en el registro.
-- =====================================================================================

CREATE TABLE IF NOT EXISTS product_payment (
    id                         bigserial    PRIMARY KEY,
    invitation_id              bigint       NOT NULL REFERENCES invitation(id) ON DELETE CASCADE,
    customer_id                bigint       NOT NULL REFERENCES customer(id),
    product_plan_id            bigint       NOT NULL REFERENCES product_plan(id),
    estado                     varchar(20)  NOT NULL
        CHECK (estado IN ('PENDIENTE','PAGADO','FALLIDO','CADUCADO','REEMBOLSADO')),
    -- El importe lo fija el SERVIDOR desde product_plan.precio_centavos. Nunca llega del cliente.
    importe_centavos           bigint       NOT NULL CHECK (importe_centavos > 0),
    -- varchar(3): ver la nota de V42 sobre `char(n)` y `ddl-auto: validate`.
    moneda                     varchar(3)   NOT NULL,
    stripe_checkout_session_id varchar(120) NULL UNIQUE,
    stripe_payment_intent_id   varchar(120) NULL UNIQUE,
    -- receipt_url del cargo, si Stripe la devolvio. Nullable: no siempre viene.
    comprobante_url            varchar(500) NULL,
    pagado_en                  timestamptz  NULL,
    created_at                 timestamptz  NOT NULL DEFAULT now(),
    updated_at                 timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  product_payment IS 'Cobro por invitacion (pago unico, Stripe Checkout mode=payment). ADR-5-4-01.';
COMMENT ON COLUMN product_payment.importe_centavos IS 'Lo fija el servidor desde product_plan; el webhook comprueba que amount_total coincide.';

CREATE INDEX IF NOT EXISTS ix_product_payment_invitation ON product_payment (invitation_id);
CREATE INDEX IF NOT EXISTS ix_product_payment_customer   ON product_payment (customer_id, created_at DESC);
