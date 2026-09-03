# 08 — Verificación adversarial: esquema y composición

Autor: fase 1, rol `1-adv-esquema` (ronda 2). Objetivo: romper `01-dominio-y-esquema.md`, `02-persistencia-y-catalogo.md` y `05-migracion.md` con casos límite: plantillas con distinta cantidad de bloques, contenido más largo que la plantilla, cambio de versión con bloques eliminados, cambio de plantilla en una invitación editada, colisión de ids, contenido inválido, invariantes que Zod no exporta.

Método: para cada caso del brief, se buscó el mecanismo concreto (regla R1-R9, invariante I-xx, o control de escritura) que debería impedirlo, y se verificó si existe de verdad o si es solo una afirmación de prosa sin control mecánico. Cada objeción cita documento y sección exactos.

---

## Casos que SÍ están cubiertos (verificado, no objeción)

- **Plantillas con distinta cantidad de bloques**: `boda-clasica` (12 secciones) vs. `xv-jardin` (9 secciones, construida a propósito con menos, `01 §7`) — R1 (`01 §5.2`) resuelve claves de `structure` desconocidas como huérfanas (log, no crash) y añade las que faltan con sus valores por defecto. Verificado en los dos ejemplos.
- **Contenido más largo que la plantilla** (más ítems de grupo de los que `max` permite): `I-04_GROUP_SIZE_OUT_OF_BOUNDS` (`esquema/invariants.ts:39,111`) lo rechaza en la escritura, antes de llegar a componer.
- **Contenido inválido** (tipo equivocado, opción inexistente, texto demasiado largo): `TPL_BLOCK_TYPE_MISMATCH`/`I-15`, `I-02`, `I-16` (`01 §3.2`, `invariants.ts`) — rechazado en escritura, nunca coaccionado.
- **Invariantes que Zod no exporta**: ADR-005 ya es la respuesta correcta — verificado empíricamente (`01 §8`) que `.refine()` se descarta en silencio; la mitigación (doble implementación + tabla de casos compartida, `06 §4`) es sólida siempre que se implemente disciplinadamente. No es un defecto de diseño, es un riesgo de disciplina de implementación — se deja como riesgo, no como objeción.

## Objeciones

### E-01 (ALTA) — El registro de plantillas no detecta cambios incompatibles ocultos en una versión no-mayor
**Documento/sección atacada**: `01-dominio-y-esquema.md` §6 ("un cambio mayor de semver exige plan de migración; un minor/patch solo puede añadir bloques/secciones opcionales — si añade uno required sin default, el registro falla"); `02-persistencia-y-catalogo.md` §4 (algoritmo de registro).

**Ataque**: registrar `boda-clasica@1.1.0` (bump *minor*, sin `MigrationPlan`) cuyo manifiesto **elimina** `couple.groomText` (bloque `required: false` pero con contenido real de usuarios existentes) o **cambia** `event.cards` de `min: 1` a `min: 3`. El texto de `01 §6` dice que esto "no debería" pasar en un minor/patch, pero el algoritmo de registro descrito en `02 §4` (4 pasos: validar manifiesto solo, comparar hash, insertar) **nunca compara el manifiesto nuevo contra la versión previa publicada del mismo slug**. No hay ningún paso que calcule un diff estructural. El registro de una `1.1.0` rota pasa exactamente igual que uno correcto: `validateManifest` valida el manifiesto **en aislamiento**, no relativo a `1.0.0`.

**Consecuencia real**: cualquier `tpl_document` existente en `1.0.0` que intente `:choose-template` hacia `1.1.0` (`03 §3.1`) encontrará un manifiesto sin `couple.groomText` — R1/R2 lo tratan como sección/bloque que ya no existe (mueve a `attic`, ADR-006), lo cual no pierde datos, PERO el cliente nunca fue advertido de que subir de "versión menor" iba a ocultar contenido que había escrito, porque "menor" prometía ser aditivo. Es el mismo tipo de silencio que causó H-04/H-05, reintroducido en un punto nuevo del sistema.

**Corrección propuesta**: el registro (`02 §4`, paso 1) debe, cuando `(template_id, version)` no es la primera versión del slug, cargar el manifiesto **inmediatamente anterior publicado** (mayor `version_major.minor.patch` con `status='published'`) y calcular un diff estructural: `blockId`s removidos, `sectionKey`s removidos, `type` de un `blockId` existente cambiado, `min`/`max` de un grupo reducido por debajo del contenido típicamente ya escrito. Si el diff no está vacío **y** el bump no es mayor (`version_major` mayor que el anterior) **y** no hay una entrada en `migrationsFrom` que cubra exactamente ese salto con un `MigrationPlan` ya registrado con las operaciones (`removeBlock`/`renameBlock`/etc.) que expliquen cada elemento del diff → `422 TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR`, registro rechazado.

### E-02 (ALTA) — `restore` no revalida el documento restaurado contra la plantilla vigente
**Documento/sección atacada**: `03-api.md` §4 ("Undo e historial") y §2 (`POST .../document/restore`).

**Ataque**: (1) invitación en `boda-clasica@1.0.0`, varias revisiones editando `couple.groomText`. (2) Cliente cambia de plantilla a `xv-jardin@1.0.0` (flujo C, `04 §2.1`) — `couple.groomText` no existe en `xv-jardin`, todo el contenido de boda se mueve a `attic["boda-clasica@1.0.0"]` (ADR-006/023), `tpl_document.template_version_id` ahora apunta a `xv-jardin@1.0.0`. (3) El cliente, confundido, usa `GET .../document/history` y hace `POST .../document/restore {revision: <una de las revisiones de boda-clasica>}`. Tal como está descrito (`03 §4`: "restaura una revisión pasada... como una revisión nueva"), el `doc` restaurado es el JSON crudo de esa snapshot antigua — con `template: {slug: "boda-clasica", version: "1.0.0"}` y `content` lleno de `blockId`s que **no existen** en el manifiesto vigente de la fila (`xv-jardin`). Ningún paso descrito revalida esto.

**Consecuencia real**: `tpl_document.doc` queda en un estado que `GET .../document` intentaría componer con `compose(xv-jardin-manifest, doc-de-boda, ...)` — R1/R2 tratarían la mayoría del contenido como huérfano (`orphanContent`), pero el propio `InvitationDocument.template` del documento restaurado no coincide con `template_version_id` de la fila (`02 §2.3`), violando la invariante 1 de `01 §4` ("`template.slug@version` debe existir y estar `published`" — sí existe, pero no es coherente con la fila). Es un estado inconsistente que ningún control de escritura existente impide, porque `restore` fue diseñado como una copia, no como una escritura validada.

**Corrección propuesta**: `restore` no copia el `doc` crudo de la snapshot. En su lugar: (a) toma **solo** `content`/`structure`/`theme` de la snapshot elegida, (b) los pasa por el mismo pipeline de normalización que usa `:choose-template` al cambiar de plantilla (`03 §3.1`) contra el `template_version_id` **actual** de la fila — todo `blockId`/`sectionKey` que no exista en el manifiesto vigente va a `attic`, no se reintroduce tal cual. Si la snapshot es de la MISMA versión de plantilla que la fila actual, este pipeline es un no-op (restaura exactamente igual) — el costo solo aparece en el caso adversarial que este hallazgo describe.

### E-03 (MEDIA) — Inconsistencia de convención de id de bloque dentro de un grupo
**Documento/sección atacada**: `01-dominio-y-esquema.md` §2.5 (snippet ilustrativo: `{"id": "event.cards.title", ...}` dentro de `itemBlocks`) vs. `diseno/ejemplos/boda-clasica-1.0.0/template.json` y `xv-jardin-1.0.0/template.json` (uso real: `{"id": "title", ...}`, sin prefijo del grupo).

**Ataque**: un implementador de fase 2 que lea solo `01 §2.5` (y no los ejemplos) construirá el direccionamiento de `itemBlocks` asumiendo ids ya prefijados (`event.cards.title`), mientras que quien lea los ejemplos (la fuente que además alimenta los golden files de `06 §3`) asumirá ids cortos relativos al grupo. Son dos convenciones incompatibles para el mismo concepto en el mismo documento.

**Corrección propuesta**: la convención correcta es la de los ejemplos (ids cortos, relativos al grupo — coincide con la descripción en prosa "los `itemBlocks` llevan ids relativos al grupo" que sí es correcta, solo el snippet jsonc de ejemplo estaba desactualizado). Corregir el snippet de `01 §2.5` a `{"id": "title", ...}` etc.

### E-04 (MEDIA) — `itemBlocks` no restringe `source` a `"user"`, pero la composición no define cómo resolver un ítem de negocio
**Documento/sección atacada**: `esquema/blocks.ts` (`GroupSpec.itemBlocks: z.array(ScalarSpec)`, `ScalarSpec` incluye `source` sin restricción); `01-dominio-y-esquema.md` §5.2 regla R4 (negocio "por rol", sin mención a grupos).

**Ataque**: nada impide declarar un `itemBlock` con `source: "business"` dentro de un grupo (p. ej., pretender que cada "momento del itinerario" lea su hora de un campo de negocio). No hay ningún campo de negocio indexado por ítem en `BusinessSnapshot` (`composed.ts`) — R4 no dice qué pasaría, y `invariants.ts` `validateValueAgainstSpec` para `group` no verifica `ib.source` en absoluto antes de validar el valor.

**Corrección propuesta**: prohibir `source !== "user"` dentro de `itemBlocks` — añadir invariante `I-22_ITEM_BLOCK_SOURCE_NOT_USER` en `validateManifest` (recorrer `itemBlocks` de cada `GroupSpec` y rechazar si `ib.source !== "user"`), y una nota explícita en `01 §2.5`.

### E-05 (MEDIA) — `attic` no tiene retención; puede crecer sin límite
**Documento/sección atacada**: ADR-006 ("nunca se borra"); `02-persistencia-y-catalogo.md` §5 (retención, ADR-011) — solo cubre `tpl_document_snapshot`, no el campo `attic` dentro de `tpl_document.doc`.

**Ataque**: un cliente que cambia de plantilla repetidamente (indeciso, o probando el catálogo) acumula una entrada de `attic` por cada cambio, cada una con el `content` completo de esa vez — sin límite, dentro de la misma fila `JSONB` que se lee en cada `GET .../document`.

**Corrección propuesta** (mitigación, no bloqueante — severidad media, no alta, porque el caso de uso real es cambiar de plantilla pocas veces): documentar como límite operativo razonable (no lo bloquea el esquema, lo advierte el editor): más de 5 entradas en `attic` muestra un aviso "tu historial de plantillas anteriores está creciendo, ¿quieres archivarlo?" — sin acción automática de borrado (ADR-006 se mantiene: nunca se borra automáticamente). Si esto se vuelve un problema real de tamaño de fila, una ADR futura puede mover `attic` a una tabla aparte (`tpl_document_attic`) sin cambiar el contrato del documento hacia el cliente.

### E-06 (BAJA) — Ninguna invariante verifica `doc.meta.locale ∈ manifest.locales`
**Documento/sección atacada**: `esquema/invariants.ts` (`validateDocument`); `esquema/document.ts` (`meta: z.strictObject({locale: Locale})`).

**Corrección propuesta**: añadir `I-23_LOCALE_NOT_SUPPORTED` — trivial, una línea en `validateDocument`.

### E-07 (BAJA) — IDs de ejemplo no verificados carácter por carácter contra el patrón ULID
**Documento/sección atacada**: `diseno/ejemplos/**/*.json` (`itemId`s). No se ejecutó un validador real contra el patrón Crockford base32 salvo los generados por script en esta sesión (ver `memoria/bitacora/1-dominio.md`). Riesgo cosmético: si fase 2 usa estos JSON como fixtures literales de prueba (no solo como referencia de lectura), un id fuera de patrón haría fallar una prueba de esquema por un motivo ajeno al caso que se quiere probar.

**Corrección propuesta**: antes de usar estos ejemplos como fixtures ejecutables en fase 2, correr el schema TS real contra ellos una vez (`06 §3` ya lo exige como prueba de golden file — esa misma prueba, al ejecutarse por primera vez, revela cualquier id fuera de patrón).

---

## Resumen de severidad

| Severidad | Cantidad | IDs |
|---|---|---|
| Alta | 2 | E-01, E-02 |
| Media | 3 | E-03, E-04, E-05 |
| Baja | 2 | E-06, E-07 |
