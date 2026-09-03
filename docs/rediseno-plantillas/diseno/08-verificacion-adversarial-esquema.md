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

## Resolución (ronda 3)

Todas las objeciones abiertas se corrigieron directamente en los documentos atacados, no solo en este registro:

| ID | Severidad | Corrección aplicada | ADR |
|---|---|---|---|
| E-01 | Alta | `02-persistencia-y-catalogo.md` §4 paso 1.5: diff estructural obligatorio contra la versión previa publicada | ADR-028 |
| E-02 | Alta | `03-api.md` §4: `restore` renormaliza contra la plantilla vigente, nunca copia el `doc` crudo | ADR-029 |
| E-03 | Media | `01-dominio-y-esquema.md` §2.5: snippet corregido a ids cortos, consistente con los ejemplos | — (corrección editorial, sin ADR) |
| E-04 | Media | `esquema/invariants.ts`: invariante `I-22_ITEM_BLOCK_SOURCE_NOT_USER` | ADR-034 |
| E-05 | Media | `04-frontend-y-editor.md` §2.1 flujo C: aviso de archivado a partir de 5 entradas en `attic` | — (mitigación de UX, ADR-006 no cambia) |
| E-06 | Baja | `esquema/invariants.ts`: invariante `I-23_LOCALE_NOT_SUPPORTED` | ADR-034 |
| E-07 | Baja | Sin corrección de diseño — queda como paso de verificación mecánica al ejecutar la primera prueba de golden file en fase 2 (`06 §3` ya lo cubre) | — |

**Cero objeciones de severidad alta abiertas** tras esta ronda.

---

## Apéndice 1R-dominio (2026-09-03)

La ronda adversarial anterior (E-01…E-07) fue **de lectura**: nadie ejecutó el esquema. La ronda 1R lo
ejecutó, y con eso aparecieron casos límite que ninguna lectura encuentra. Entorno: `node 22.22.2`,
`typescript 5.9.3`, `zod 4.5.4`, `ajv 8.20.0`, `ajv-formats 3.0.1`. Salida literal de consola en
`memoria/bitacora/1R-dominio.md`; el detalle de cada corrección, en `01-dominio-y-esquema.md` §11.

### A. Casos límite nuevos y su resultado

| id | Caso límite atacado | Resultado antes | Resultado después |
|---|---|---|---|
| **A-01** | `ComposedDocument` con `link.href = "javascript:alert(1)"` y con `"data:text/html;base64,…"` | **ROTO**: ajv y Zod lo aceptan — `z.string().url()` emite `format:"uri"` y `ajv-formats` da por buena cualquier URI con esquema. Es el esquema con el que se valida lo que sirve el render público sin auth | **CERRADO**: `HttpUrl` (regex `^https?://…`) en las 9 posiciones; ajv y Zod rechazan ambos y siguen aceptando `https://maps.app.goo.gl/…` |
| **A-02** | `richText` de 1500 caracteres contra un `BlockSpec` con `constraints.maxLength = 5` | **ROTO**: 0 violaciones — el límite de `richText` no se validaba en ningún sitio | **CERRADO**: I-16 extendida a `richText` sobre el texto plano (`richTextLength`) |
| **A-03** | `attic` con claves `"__proto__"` y `"constructor"`, llegando por `JSON.parse` (el camino real: cuerpo HTTP y `jsonb`) | **ROTO** y **peor de lo esperado**: `z.record(BlockId, …)` devuelve `success:true` con el objeto **vacío** — Zod descarta `"__proto__"` **en silencio** (P1 lo prohíbe explícitamente); `"constructor"` casa con el patrón de `BlockId` y pasa entero. ajv sobre el mismo JSON Schema **sí** rechaza `"__proto__"` (`propertyNames`) ⇒ **TypeScript y Kotlin discrepan sobre el mismo documento** | **CERRADO parcialmente por esquema, completado por invariante**: la clave interna de `attic` pasa de `z.string().max(120)` a `BlockId` y la externa a slug+semver estrictos; y **I-29** (`assertNoReservedKeys`) se ejecuta sobre el JSON **crudo**, antes de `parse`, en TS y en Kotlin. La limitación de `z.record` **no se puede cerrar con esquema** y queda documentada |
| **A-04** | `{op:"reorderSections", order:["cover","cover","cover"]}` | **ROTO**: válido para el esquema (solo comprueba `min(1).max(16)`) | **CERRADO**: **I-24** (`validateReorder`) exige permutación exacta de las claves actuales, en el reductor |
| **A-05** | `{op:"setTheme"}` sin `paletteId` ni `fontSetId` | Válido | **Aceptado como no-op** (severidad baja): el reductor lo ignora y no puede corromper nada. Documentado, no corregido |
| **A-06** | `{op:"setBlock", blockId:"cover.date", …}` sobre un bloque `source:"business"` | Válido para el esquema | **Aceptado**: es correcto que el esquema no lo sepa (no conoce el manifiesto). Lo frena I-21 en el reductor; ahora está escrito explícitamente en `01 §6.5` |
| **A-07** | ¿Coinciden los roles de `01 §3.3` con los de `esquema/blocks.ts`? | **ROTO**: 7 de los 31 roles del documento **no existían** en el esquema (`witness`, `storyMilestone`, `giftOption`, `bankAccount`, `dressCodeRule`, `amenity`, `suggestion`) | **CERRADO**: `blocks.ts` es la fuente normativa; los que faltaban se añadieron o se mapearon; §3.3 reescrita |
| **A-08** | Determinismo de `compose` frente al orden de claves de un objeto | **ROTO**: las listas del `CompositionReport` se construían iterando `Object.entries(doc.content)`, que respeta el orden de inserción — y **Postgres reordena las claves de un `jsonb`**, así que `contentHash` y los golden files cambiarían tras un round-trip por la base de datos | **CERRADO**: `compose.ts` ordena las cinco listas; el orden de bloques y de ítems lo fija siempre el manifiesto/el array, nunca las claves del objeto. R9 reescrita con las 5 fuentes de no-determinismo |
| **A-09** | ¿Qué rol lleva un bloque `group`? | **ROTO**: los 8 grupos de `boda-clasica@1.0.0` reutilizaban el rol de uno de sus propios `itemBlocks` (`event.cards` → `eventTitle`, igual que `event.cards.title`) ⇒ direccionamiento por rol ambiguo para la IA y para el cambio de plantilla | **CERRADO**: 10 roles de grupo nuevos + **I-25** (grupo ⟺ rol de grupo, y ningún escalar puede usarlos) |
| **A-10** | ¿Puede repetirse un rol dentro de un manifiesto? | **Ambiguo**: `boda-clasica@1.0.0` repite `sectionTitle` 8 veces (legítimo) y `rsvpNote` 2 veces (uno de ellos sobre un `boolean` de negocio, incorrecto). Una regla de "roles únicos" habría sido falsa | **CERRADO con matiz**: **I-26** solo sobre 17 **roles singleton** (persona o dato único del evento). El `rsvp.childrenAllowed` mal etiquetado pasa a `rsvpChildrenAllowed` |
| **A-11** | Manifiesto que declara `locales:["es-MX","en-US"]` con etiquetas solo en `es-MX` | **ROTO**: 0 violaciones; `compose` caería a `es-MX` en silencio para un cliente `en-US` | **CERRADO**: **I-27** |
| **A-12** | `defaults.json` con valor para un bloque `source:"business"` | **ROTO**: 0 violaciones; contenido muerto que R4 ignora siempre (misma clase de fallo que H-12) | **CERRADO**: **I-28** |
| **A-13** | ¿Compila el paquete de esquema? | **ROTO**: `manifest.ts:3` importaba `BlockValue` de `common.ts` (está en `blocks.ts`) → `TS2305`; y `invariants.ts:109` → `TS2352`. El `README.md` afirmaba haberlo validado ejecutándolo | **CERRADO**: `tsc --noEmit --strict` en 0 errores |
| **A-14** | ¿Validan los ejemplos contra su propio esquema? | **ROTO**: `defaults.json`, `documento.json` y `compuesto.json` de ambos pares fallaban — 17 ULID de demostración inválidos (`01J8DEMO…` usa `O`, fuera del alfabeto Crockford; 12 de ellos con 27 caracteres) y una clave `_comentario` en la raíz contra `additionalProperties:false` | **CERRADO**: ULIDs reescritos, comentarios movidos a `NOTAS.md`. Los 10 archivos pasan Zod **y** ajv |
| **A-15** | ¿Es `compuesto.json` la salida real de `compose` sobre sus propias entradas? | **ROTO**: 8 divergencias (5 etiquetas acortadas a mano, 3 URLs de asset inventadas). El golden file probaba la mano, no el código | **CERRADO**: se escribió `esquema/compose.ts` y **ambos** `compuesto.json` se regeneraron con él; verificado que los reproduce byte a byte |
| **A-16** | Idempotencia de `compose` (R9): dos llamadas con las mismas entradas | No verificable (no había implementación) | **VERDE** en los dos pares: `canonicalJson` idéntico |
| **A-17** | ¿Dónde entra una sección del manifiesto que el documento no menciona? | **ROTO**: R1 no lo decía; anexar al final coloca `family` de `xv-jardin` **después del pie de página** | **CERRADO**: R1c, inserción anclada a la posición relativa del manifiesto |
| **A-18** | `dateTimeRange` que cruza la medianoche (`2026-11-14T19:30` → `2026-11-15T01:00`) | Sin definición de formato | **CERRADO**: `formatRange` distingue mismo día (`"…, 7:30 pm – 8:30 pm"`) de días distintos (`"14 de noviembre de 2026, 7:30 pm – 15 de noviembre de 2026, 1:00 am"`). Ejercitado en el golden file de `xv-jardin` |
| **A-19** | ¿Puede `compose` resolver un `assetId` con la firma publicada? | **ROTO**: no recibía nada con lo que hacerlo, y `ResolvedValue.image` exige `url`. La función era inimplementable | **CERRADO**: parámetro `assets: AssetIndex` |
| **A-20** | ¿Emite `z.toJSONSchema` los `$defs` que `01 §8` prometía? | **ROTO**: 0 `$defs` y 0 `$ref` en los 10 archivos; el catálogo de bloques repetido en 5 de ellos (469 KB). Y al arreglarlo con `z.registry()`, Zod escribe un `$id` inválido dentro de cada definición y **ajv rechaza el bundle entero** | **CERRADO**: bundle único de 15 `$defs` y 42 `$ref` (217 KB), con borrado explícito del `$id` |

### B. Ataques que no rompieron nada

Colisión de `blockId` (I-13), de `sectionKey` (I-14), de `itemId` (I-03) y de `itemBlockId` dentro de un
grupo (I-13); contenido del cliente más largo o más corto que el rango del spec (I-04); `end < start`
(I-01); sección `required` oculta (I-17); escritura sobre un bloque de negocio (I-21); `itemBlock` con
`source ≠ "user"` (I-22); `optionId` fuera de `spec.options` (I-02).

### C. Recuento

| Severidad | Nuevas en 1R | Cerradas | Abiertas |
|---|---|---|---|
| Alta | 11 | 11 | 0 |
| Media | 14 | 14 | 0 |
| Baja | 3 | 0 (aceptadas y documentadas) | 0 |

**Cero objeciones de severidad alta abiertas.** La limitación de `z.record` con `"__proto__"` (A-03) queda
como **riesgo residual documentado**, mitigado por I-29 pero no eliminable desde el esquema.
