-- =====================================================================================
-- V44 — product_stripe_event: idempotencia del webhook (fase 5, sesion E4; ADR-5-4-03).
--
-- Stripe REINTENTA. Sin esta tabla, un mismo `checkout.session.completed` entregado dos veces
-- volveria a escribir el pago y `invitation.is_paid`. `event_id` es la CLAVE PRIMARIA: el
-- webhook inserta PRIMERO y, si la insercion choca, responde 200 sin volver a procesar nada.
-- La insercion va en la MISMA transaccion que el procesamiento: si el proceso falla, el evento
-- no queda marcado como visto y el reintento de Stripe si sirve para algo.
--
-- Aqui no se guarda ni un dato personal: id del evento, tipo, cuando llego y como acabo.
-- =====================================================================================

CREATE TABLE IF NOT EXISTS product_stripe_event (
    event_id     varchar(120) PRIMARY KEY,
    tipo         varchar(80)  NOT NULL,
    recibido_en  timestamptz  NOT NULL DEFAULT now(),
    procesado_en timestamptz  NULL,
    -- PROCESADO | IGNORADO | IMPORTE_DISTINTO | PAGO_NO_ENCONTRADO | ERROR
    resultado    varchar(40)  NULL
);

COMMENT ON TABLE product_stripe_event IS 'Un evento de Stripe ya visto. Clave primaria = event.id: un replay no vuelve a escribir nada (ADR-5-4-03).';
