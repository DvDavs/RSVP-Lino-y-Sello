-- V41 — verificación de correo de la cuenta (fase 5, sesión E3; `12-producto-completo.md §A2.1` y §A6.4).
--
-- `spring.jpa.hibernate.ddl-auto` es `validate` (`application.yml:32`), así que las columnas nuevas de
-- `CustomerEntity` TIENEN que venir en una migración o la aplicación no arranca. Es exactamente el
-- problema que documenta V40 (`V40:1-7`). V42 queda reservada para otro agente de la fase 5.
--
-- `email_verified` nace en **true** a propósito (§A6.4, condición aceptada nº 2): si naciera en `false`
-- todas las cuentas que ya existen quedarían marcadas como no verificadas de un día para otro. Solo las
-- altas nuevas se guardan con `false` (`CustomerService.signUp`).
--
-- `email_pending` guarda el correo al que la persona quiere mudarse mientras no confirme el enlace: el
-- correo de acceso NO cambia hasta la confirmación, así que un enlace interceptado no muda la cuenta.
-- No lleva restricción de unicidad: dos personas pueden tener pendiente el mismo correo y gana quien
-- confirme primero; la disponibilidad se vuelve a comprobar al confirmar, contra el índice único real
-- de `customer.email` (`V1__initial_schema.sql:1605`).
--
-- El patrón de las tres primeras columnas es el de `resettoken`/`resettokenexpiry`
-- (`CustomerEntity.kt:39-40`), que ya respalda la recuperación de contraseña.
ALTER TABLE customer ADD COLUMN email_verified boolean NOT NULL DEFAULT true;
ALTER TABLE customer ADD COLUMN email_verification_token character varying(255);
ALTER TABLE customer ADD COLUMN email_verification_expiry timestamp(6) with time zone;
ALTER TABLE customer ADD COLUMN email_pending character varying(255);

-- Búsqueda por token en cada confirmación. Parcial: solo las filas con verificación en curso, que son
-- una minoría permanente.
CREATE INDEX IF NOT EXISTS idx_customer_email_verification_token
    ON customer (email_verification_token)
    WHERE email_verification_token IS NOT NULL;
