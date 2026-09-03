# 07 — Punto de extensión para edición asistida por IA (contrato, sin implementar)

Autor: fase 1, rol `1-ia`. Estado: propuesto para aceptación (ADR-027).
Evidencia: `handoffs/0-resumen-auditoria-ia.md`, `handoffs/1-aura-lecciones.md`, `01-dominio-y-esquema.md` (esquema, `esquema/operations.ts`), `03-api.md` §3.3 (reductor humano, para contraste).

---

## 1. Qué NO se construye en esta fase

Ninguna llamada a un proveedor de IA, ningún endpoint HTTP nuevo, ninguna UI. Este documento fija el **contrato de datos y el pipeline de aplicación** para que, cuando se implemente (fase futura, fuera de este rediseño), no haya que rediseñar el esquema ni reabrir riesgos de seguridad ya resueltos para el editor humano.

## 2. `EditProposal`: la única forma en que la IA toca el documento

```typescript
// esquema/operations.ts (ya definido en 01, reproducido aquí por referencia)
export const EditProposal = z.strictObject({
  sectionKey: SectionKey,           // UNA sección por propuesta — nunca el documento completo (patrón Canva, no v0/Bolt)
  rationale: z.string().max(400),   // explicación en prosa, mostrada al cliente junto al diff
  operations: z.array(Operation).min(1).max(10),
});
```
El modelo **nunca** devuelve HTML, CSS, JSON libre ni un documento completo — devuelve `Operation`s del mismo catálogo cerrado que usa el editor humano (`03-api.md` §3.3, `esquema/operations.ts`). Es el patrón de Canva Magic Design (investigación §6), explícitamente **no** el de aura.build/v0/Bolt/Lovable (código libre, no validable ni versionable, `handoffs/0-resumen-auditoria-ia.md`).

## 3. Pipeline de aplicación (mismo reductor, distinta política de fallo que el editor humano)

```
1. VALIDAR   — cada Operation de la propuesta se valida contra el manifiesto de la
               versión de plantilla VIGENTE en ese momento (mismo validateValueAgainstSpec
               de invariants.ts que usa el editor humano y la API, 03 §3.3/§5).
2. DRY-RUN   — se simula el resultado completo (aplicar todas las Operations válidas sobre
               una copia del documento) SIN persistir, produciendo un composed/report de vista previa.
3. APLICAR   — solo las Operations que sobrevivieron el paso 1 se aplican de verdad, como un
               OperationBatch normal (03 §3.3) — MISMA ruta de escritura que el editor humano,
               MISMO revision/baseRevision optimista, MISMO snapshot (02 §2.5).
4. REPARAR   — una Operation inválida individual tiene UN reintento acotado (pedir al modelo
               una corrección solo de esa operación, con el error de validación como contexto)
               antes de descartarla en solitario.
5. DESCARTAR-Y-CONTINUAR — si la reparación también falla, esa Operation se descarta y se
               registra en el rationale de vuelta al cliente ("no pude aplicar: cambiar el
               tipo de letra — la plantilla no lo permite"); el RESTO del lote se aplica igual.
               Nunca se aborta la propuesta completa por una operación inválida.
6. DIFF      — el resultado del dry-run (paso 2) se muestra al cliente ANTES de aplicar; el
               cliente confirma o descarta la propuesta completa. Nunca se autoaplica.
```
Pasos 1, 4 y 5 son la lección directa de `handoffs/1-aura-lecciones.md` #1 y #5 (patch engine con validación previa + dry-run + reparación; descartar-y-continuar, no fallar-todo). El paso 3 es lo que garantiza que una operación de IA queda deshecha, versionada y auditada exactamente igual que una humana (P7) — no hay una segunda ruta de escritura paralela.

## 4. Seguridad (P8, mismos principios que `03-api.md` §1/ADR-015)

- La IA nunca recibe ni produce un `invitationId`, `documentId` ni ningún id de otra invitación — la sesión de IA está acotada a la invitación ya autorizada por la petición HTTP que la invoque (misma verificación `HierarchyValidationService` que cualquier otra ruta de `/editor/**`).
- La IA nunca inventa un `blockId` nuevo: solo referencia `blockId`s ya declarados en el manifiesto vigente (paso 1 los rechaza si no).
- `itemId` de un `addItem` propuesto por la IA es un `tempId` (`esquema/common.ts`), igual que el editor humano — el servidor asigna el ULID definitivo (nunca la IA).
- Todo `assetId` que una propuesta de IA intente escribir pasa por la MISMA verificación de propiedad que el editor humano (`03-api.md` §3.3, ADR-030, cierra S-01): pertenece a `tpl_asset` de esta invitación o de la plantilla vigente, o se rechaza esa operación individual en el paso 1 del pipeline (§3) — la IA nunca podría, ni siquiera por error de un proveedor externo, hacer que el documento referencie el asset de otro cliente.
- Bloques con `aiEditable: false` (`01 §2.4`, `SpecBase`) se rechazan en el paso 1 aunque la operación sea sintácticamente válida — esto es lo que impide que la IA toque, por ejemplo, `cover.buttonLabel` (`source: fixed`) o cualquier campo que el autor de la plantilla marcó como fuera de su alcance.

## 5. Alcance recomendado (no vinculante para esta fase, orienta la fase de implementación)

De la investigación (§6, resumen del rol): mayor valor/menor riesgo es redactar prosa (historia, mensajes de texto largo — tipos `richText`/`text` de constraints generosas); menor valor/mayor riesgo es "maquetar" (cambiar estructura/variantes) — las plantillas ya están bien maquetadas por su autor, y darle a la IA control sobre estructura visual reintroduce exactamente el tipo de decisión de presentación que P3 saca del backend. Cuando se implemente, empezar por operaciones `setBlock`/`setItemBlock` sobre bloques de texto largo, antes que `setSectionVariant`/`reorderSections`.

## 6. Lo que no pude determinar

Qué proveedor de IA se usará (Vercel AI SDK es la recomendación de `contratos.md` §2, sin versión ni proveedor fijado — decisión de la fase de implementación real, fuera de esta fase de diseño). Streaming SSE para tareas largas (`handoffs/1-aura-lecciones.md` #7) no se diseña aquí: el pipeline de §3 asume una propuesta síncrona de ≤ 10 operaciones; si "mejorar con IA" crece a tareas multi-paso, es una ADR nueva, no una extensión silenciosa de este contrato.
