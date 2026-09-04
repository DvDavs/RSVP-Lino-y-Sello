-- V36__add_uses_templates2_to_invitation.sql
-- Fuente: 02-persistencia-y-catalogo.md §2 V36, ADR-023. Única columna que templates2 añade a una
-- tabla existente. DEFAULT false es obligatorio (no cosmético, objeción B-08): con ddl-auto: validate
-- una columna NOT NULL sin DEFAULT rompería cualquier INSERT del módulo antiguo generado por Hibernate.
-- No se mapea en InvitationEntity (módulo antiguo, no se toca): el acceso exclusivo es
-- Templates2FlagRepository con @Query nativo.
ALTER TABLE invitation ADD COLUMN uses_templates2 BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX ix_invitation_uses_templates2 ON invitation (uses_templates2) WHERE uses_templates2;
