# Resumen de auditoría para el rol "Persistencia y catálogo" (fase 1, sub-agente 2)

Fuente completa: `docs/analisis-plantillas/ANALISIS-GENERACION-PLANTILLAS.md` §2 (mapa del subsistema, claves reales Postgres↔Mongo), §4 (ciclo de vida/6 vías de alta), §6.3–6.5. Detalle: `fases/A-modelo-datos.md`, `fases/B-alta-plantillas.md`, `fases/C3-regeneracion.md`.

## Hallazgos H-xx relevantes

- **H-04**: ningún cambio en PostgreSQL (fecha, plantilla, módulos extra) se propaga a Mongo; no existe endpoint de regeneración ni `force` → informe §5.2 H-04, `fases/C3-regeneracion.md` hallazgos 2/13.
- **H-05**: cambiar la plantilla de una invitación deja estado mixto permanente; `GET` y `PUT` se contradicen sobre qué `templateId` prevalece → §5.2 H-05.
- **H-07**: `reuseExistingContent` (vía por defecto de alta) busca por la clave equivocada y falla siempre en entorno nuevo, dejando un huérfano en Mongo por intento → §5.2 H-07 (la corrección ya está escrita y comentada dos líneas arriba, `MasterTemplatesService.kt:153-154`).
- **H-08**: cero transaccionalidad Mongo/Postgres, cero compensación, cero borrado sobre `default_visual_configs`/`default_content_configs`; Mongo corre standalone sin replica set (`docker-compose.yml:24`) → §5.2 H-08.
- **H-09**: el seed pisa en cada arranque las plantillas con `templateId` cableado; colisión real con el id 13 tras `V25` dejar la secuencia en 10 → §5.2 H-09.
- **H-10**: falta el documento visual → HTTP 500 en cada apertura, sin fallback (correcto no relajarlo; falta validar en el alta) → §5.2 H-10.
- **H-15**: el índice único que sostiene la idempotencia se crea dentro de un `catch` vacío; los `@Indexed` declarados son inertes sin `auto-index-creation` → §5.2 H-15.
- **H-16 / H-17**: `POST /master/templates` sigue vivo y crea plantillas sin nombre ni visual; si Mongo no responde al arrancar, la app arranca igual sin plantillas ni índice → §5.2 H-16/H-17.
- **H-21 / H-22 / H-23**: resolución de contenido con round-trip siempre fallido y elección arbitraria sin `Sort`; duplicados en `default_content_configs` rompen la siembra en silencio; duplicados en `default_visual_configs` dejan la plantilla inservible → §5.2 H-21/H-22/H-23.
- **H-36 / H-37**: `contentConfig` del request se guarda sin contrastar claves de negocio; borrado duro de usuario deja configs huérfanas en Mongo → §5.2 H-36/H-37.
- **H-41 / H-42**: el script de alta "11/12" solo hace `UPDATE` (nunca `INSERT`) y escribe Mongo aunque afecte 0 filas; se siembran configs para entidades que no existen en Postgres → §5.2 H-41/H-42.
- **H-53**: FK de `invitation_template_extra_modules` apunta a la tabla equivocada (`invitation` en vez de `invitation_template`) → §5.2 H-53.
- **H-59**: basura empaquetada en el JAR, 358 KB de payloads huérfanos sin referencia en código → §5.2 H-59.

## Contrato implícito relevante a persistencia (informe §6.3–6.5)

No hay FK ni validación cruzada entre `invitation_template.id` y `default_visual_configs.templateId` — la relación es solo convención de aplicación. La secuencia `invitation_template_id_seq` queda en 10 tras `V25`; los ids 11-17 los asigna la API en runtime y colisionan con lo sembrado. Elementos que **viven fuera de Git** (no reproducibles desde el repo): filas `invitation_template` 11/12/16/17, `event_type.id=7`, documentos visuales de los ids 12/14, capturas de preview y HTML de demo en S3, estado real de los índices Mongo, valor real de la secuencia — todo NO DETERMINABLE sin acceso a la base de producción.

## 6 vías de alta actuales, todas con resultado distinto (informe §4.1)

Flyway V1/V24/V25 (SQL versionado, sin Mongo) · seed de arranque (`MongoDataInitializer`, upsert destructivo del visual, skip-if-exists del contenido) · `POST /master/templates` (Postgres sin Mongo) · `POST /master/templates/complete` (la vía "oficial", falla por defecto en `reuse` y deja huérfanos) · scripts `mongosh`/`psql` (solo `UPDATE`, único camino que preserva `itemsSinglePlace`) · edición manual no versionada. Ninguna es idempotente salvo la primera.

## 3 opciones de rediseño (informe §9.2, 3 líneas)

- **Opción A** (1×): índices únicos reales con log, `id=null` forzado, cerrar `reuseExistingContent` — no resuelve H-04/H-05/H-08 (siguen dos almacenes sin transacción).
- **Opción B** (4×–6×): separar plantilla/contenido con reconciliación en cada lectura — exige migrar cada `invitation_configs` existente sin metadato de autoría del campo; riesgo alto de migración y de rendimiento (composición en cada lectura).
- **Opción C** (10×+, **la que fija el stack del prompt**, `contratos.md` §2): **PostgreSQL con JSONB para todo el módulo nuevo, retirar Mongo del alcance nuevo** — misma transacción que invitación e invitados, FK real plantilla↔documento; es el único enfoque que elimina H-08 de raíz para el módulo nuevo (el antiguo sigue en convivencia detrás de bandera, P10).
