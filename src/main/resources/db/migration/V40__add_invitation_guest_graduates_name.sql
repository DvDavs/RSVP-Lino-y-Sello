-- V40 — corrige un desajuste PREEXISTENTE y AJENO al módulo templates2 (ADR-2-ORQ-02, ADR-3-0a-01).
-- `InvitationGuestEntity.kt:28-29` mapea `invitation_guest.graduates_name`, columna que ninguna
-- migración de `db/migration` creaba, y `spring.jpa.hibernate.ddl-auto` es `validate`
-- (`application.yml:32`): una base construida solo con Flyway NO arrancaba la aplicación completa,
-- así que las 19 rutas de templates2 nunca habían respondido sobre un Tomcat real.
-- V38 (`tpl_migration_run`, fase 5) y V39 (`tpl_ai_proposal`, fase IA) están reservadas: se usa V40.
-- Una sola línea de DDL; no toca ninguna otra tabla ni dato.
ALTER TABLE invitation_guest ADD COLUMN graduates_name varchar(255);
