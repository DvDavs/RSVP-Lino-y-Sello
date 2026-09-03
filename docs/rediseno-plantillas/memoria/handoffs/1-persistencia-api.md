# Handoff — 1-persistencia + 1-api → 1-frontend, 1-migracion, 1-pruebas, 1-ia, verificadores adversariales

Entregables: `diseno/02-persistencia-y-catalogo.md` (tablas `tpl_*`, migraciones V29-V36), `diseno/03-api.md` (rutas, errores, preflight, caché). ADR-009…016 en `decisiones.md`.

## Contratos que los demás roles DEBEN reutilizar
- Tablas y columnas exactas de `02 §2` (nombres de migración V29-V36 ya fijados; no renumerar).
- Rutas y payloads exactos de `03 §2-§3`; catálogo de errores `TPL_*` de `03 §5` — 1-pruebas escribe un caso de contrato por código.
- `public_token` (en `tpl_document`, NO en `invitation`) es el único identificador del enlace público — 1-frontend lo usa como base de la URL `/i/{publicToken}`, 1-migracion debe generarlo al migrar cada invitación existente (`05-migracion.md` §4).
- Publicación = `tpl_release` inmutable (`02 §2.4`); el render público SOLO lee esa tabla — 1-frontend no debe diseñar ninguna ruta pública que lea `tpl_document`.
- `OperationBatch` humano es todo-o-nada (`03 §3.3`); `EditProposal` de IA (07) NO comparte esa semántica — descarta-y-continúa.

## Pendiente para otros roles
- 1-frontend: implementar el canal `postMessage` del iframe (ADR-018) consumiendo exactamente `GET .../document` → `composed`/`report`.
- 1-migracion: usar `POST .../document:choose-template` + `POST .../document/operations` (o un camino de import directo a `tpl_document.doc` en la misma forma, documentado en `05 §2`) para poblar `tpl_document` desde las 8 plantillas + `invitation_configs` existentes.
- 1-pruebas: golden files de contrato de API (request→response por ruta) además de los de composición ya definidos por 1-dominio.

## Lo que no pude determinar
Cuota de assets, validación de `minPlanTier` (`03 §10`) — supuestos conservadores tomados, en `preguntas-abiertas.md`.
