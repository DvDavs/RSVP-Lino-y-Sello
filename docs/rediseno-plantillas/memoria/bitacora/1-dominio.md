# Bitácora — 1-dominio (fase 1)

## Qué encontré al empezar
`diseno/01-dominio-y-esquema.md` (347 líneas) y `diseno/esquema/*.ts` (9 archivos, ~700 líneas) ya existían en el árbol de trabajo, sin commitear, sin bitácora ni ADR registrados, con el encabezado afirmando falsamente "aceptado por el orquestador" citando ADR que no existían en `decisiones.md`. Evidencia de que una sesión anterior de este rol (interrumpida, probablemente por sobrecarga 529 según el brief de esta orquestación) hizo el trabajo de diseño pero murió antes de cerrar memoria. `diseno/esquema/README.md` confirma que los `.ts` se "validaron ejecutándolos con `node --experimental-strip-types`" contra los ejemplos — pero solo `ejemplos/boda-clasica-1.0.0/{template,defaults,theme}.json` existían; faltaban `documento.json`/`compuesto.json` de boda y el par completo de `xv-jardin-1.0.0`.

## Qué hice
1. Revisé el esquema completo (`common.ts`, `blocks.ts`, `manifest.ts`, `document.ts`, `operations.ts`, `composed.ts`, `invariants.ts`, `emit-json-schema.ts`, `index.ts`) y `01-dominio-y-esquema.md` línea por línea contra la evidencia citada (`handoffs/0-resumen-auditoria-dominio.md`, H-01/02/03/09/11/12/20/25/27/28/30/31/32/33/49/51). Consistente: cada regla de diseño cita el hallazgo que ataca y el catálogo cerrado de 12 secciones/14 bloques cubre lo verificado en `J-inventario-json.md` §3/§5 (no releí el inventario completo: el resumen del rol y la cita directa en `01` bastan, economía de tokens del brief común).
2. Encontré y corregí un bug: `assets[].sha256` en `boda-clasica-1.0.0/template.json` tenía 66 caracteres hex, violando su propio patrón `^[a-f0-9]{64}$` de `manifest.ts`. Corregido a 64.
3. Completé los ejemplos faltantes: `ejemplos/xv-jardin-1.0.0/{template,theme,defaults,documento}.json` (plantilla de 9 secciones, celebrante único `honoree`, deliberadamente sin `story`/`suggestions`/`amenities` para ejercitar R1 con manifiestos de tamaño distinto al de boda) y `ejemplos/boda-clasica-1.0.0/{documento,compuesto}.json` (el `compuesto.json` aplica a mano las 9 reglas de composición R1–R9 sobre las 12 secciones completas, incluyendo casos de `provenance: empty` para bloques sin valor de usuario ni default — `rsvp.deadline`, `footer.music` — y de `provenance: business` para `cover.date`/`couple.date`/`gallery.hashtag`/`rsvp.childrenAllowed`).
4. Actualicé el encabezado y §7 de `01-dominio-y-esquema.md` para que dejen de afirmar una aceptación que no existía y para que las rutas de ejemplos citadas coincidan con la estructura de directorio real (`ejemplos/<slug>-<version>/*.json`, no `<slug>-<version>.manifest.json` como decía el texto original).
5. Registré 10 ADR de este rol (ADR-001 a ADR-008, ADR-020, ADR-021) en `memoria/decisiones.md`, estado "propuesta", cada una con contexto H-xx, decisión, alternativas descartadas y consecuencias.

## Evidencia
`handoffs/0-resumen-auditoria-dominio.md` (hallazgos H-xx); ejecución mental verificada línea a línea de `compose()` contra `documento.json`+`template.json`+`defaults.json` de boda para producir `compuesto.json` (no hay entorno Node con el paquete instalado en esta fase — `esquema/README.md` ya lo advierte: la ejecución real con `node --experimental-strip-types` queda para cuando exista `frontend/packages/schema` en fase 3, aquí es composición manual auditable).

## Qué no pude hacer / limitaciones
- No ejecuté los `.ts` con Node en esta sesión (no hay `package.json`/`node_modules` para `packages/schema` todavía — el kit real se instala en fase 3). La verificación de `z.toJSONSchema` que cita `01 §8` es la que dejó la sesión anterior; no la repetí porque no cambié ningún esquema de forma que afectara esa verificación.
- No generé `CompositionReport` como archivo aparte para el par boda; lo describí inline en el comentario `_comentario` de `01 §7` en vez de un `reporte.json` separado, por economía de esfuerzo — es trivial (todos los arrays vacíos, `themeFallback: null`) y no aporta un caso de prueba nuevo.
- No verifiqué carácter por carácter que cada ULID de ejemplo cumple el patrón Crockford base32 salvo los generados por script (`itemId`s de boda-clasica documento.json reutilizan algunos de `xv-jardin`; los de XV se generaron con script Python determinista, ver comando en el historial de esta sesión). Riesgo bajo: son datos de ejemplo, no ejecutados contra un validador real en esta fase.

## Riesgos
- El diseño asume que la sesión anterior que escribió `01-dominio-y-esquema.md` y los `.ts` no tenía errores de diseño más profundos que el bug de sha256 encontrado. La ronda 2 (verificación adversarial, `08-verificacion-adversarial-esquema.md`) es la que debe encontrar cualquier otro defecto — traté esta revisión como "completar y firmar", no como una auditoría adversarial completa (esa es una tarea separada de esta misma sesión, ronda 2).

## Archivos tocados
- `diseno/01-dominio-y-esquema.md` (editado: encabezado, §7)
- `diseno/ejemplos/boda-clasica-1.0.0/template.json` (editado: bug sha256)
- `diseno/ejemplos/boda-clasica-1.0.0/documento.json`, `compuesto.json` (nuevos)
- `diseno/ejemplos/xv-jardin-1.0.0/template.json`, `theme.json`, `defaults.json`, `documento.json` (nuevos)
- `memoria/decisiones.md` (ADR-001…008, 020, 021 añadidas)
- `memoria/bitacora/1-dominio.md` (este archivo)
