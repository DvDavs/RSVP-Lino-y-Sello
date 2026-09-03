# Bitácora — 1R-dominio (revisión independiente del bloque de dominio y esquema)

Fecha: 2026-09-03 · Rama: `claude/agent-network-invitation-41nx5y` · Sin commits (por brief).
Alcance: `diseno/01-dominio-y-esquema.md`, `diseno/esquema/*.ts`, `diseno/ejemplos/**`, apéndice en
`diseno/08-verificacion-adversarial-esquema.md`.

## 1. Qué hice

1. **Verificación ejecutable** del esquema (no lectura): compilación estricta, emisión de JSON Schema,
   validación de los 10 archivos de ejemplo contra **Zod** y contra **ajv 2020-12 + ajv-formats**, y
   ejecución de las invariantes sobre los ejemplos. Salida literal en §3.
2. **Implementación de referencia de `compose`** (`diseno/esquema/compose.ts`), porque era la única forma
   honesta de (a) generar el `compuesto.json` que faltaba en `xv-jardin-1.0.0`, (b) comprobar R1–R9 y
   (c) comprobar que el golden file existente era realmente la salida de una composición. **No lo era.**
3. **20 ataques adversariales** (A-01…A-20 del apéndice de `08`), cada uno como caso ejecutable.
4. **Tabla de cobertura** del contenido antiguo (`01 §10`), enumerando con `jq` las claves reales de los
   9 pares `default_visual_*.json` / `default_content_*.json`.
5. **Profundización a grado de implementación** de `01`: firmas exactas TS+Kotlin de `compose`, `migrate`,
   `switchTemplate`, `applyOperation` y `validateInvariants` con tipos de error/resultado (sin excepciones
   sin tipar); pseudocódigo del merge por id; `canonicalJson` y `contentHash`; algoritmo exacto de
   `package_hash`; árbol exacto del paquete; catálogo completo de los 14 bloques y de las 12 secciones.

## 2. Evidencia de los hallazgos principales (archivo:línea antes de corregir)

| Hallazgo | Evidencia |
|---|---|
| El paquete no compilaba | `esquema/manifest.ts:3` importaba `BlockValue` de `./common.ts` (está en `blocks.ts`) → `TS2305`; `esquema/invariants.ts:109` → `TS2352` |
| `format:"uri"` acepta `javascript:` | `esquema/composed.ts:14,24,32,34,35,39,40` — `z.string().url()` ×9 |
| Roles del documento ≠ roles del esquema | `01 §3.3` (31 roles) vs `esquema/blocks.ts:151-179` (70). 7 del documento no existían |
| Grupos con rol de escalar | `ejemplos/boda-clasica-1.0.0/template.json` — 8 grupos; p. ej. `event.cards` con `role:"eventTitle"`, igual que su propio `event.cards.title` |
| ULIDs de demostración inválidos | 17 ids `01J8DEMO…` en `ejemplos/*/defaults.json` y `compuesto.json`: `O` no está en Crockford base32; 12 con 27 caracteres |
| `_comentario` en la raíz de 3 golden files | `ejemplos/boda-clasica-1.0.0/{documento,compuesto}.json`, `ejemplos/xv-jardin-1.0.0/documento.json` |
| `compuesto.json` no era salida de `compose` | 8 divergencias contra `compose(template, documento, defaults, theme)`: 5 etiquetas acortadas a mano + 3 URLs de asset inventadas |
| `compose` inimplementable | `01 §5.1` — sin parámetro de assets, pero `composed.ts:34` exige `url` |
| `contentHash` sin definición | Usado en `01 §5.2 R9`, `02 §2.6` y `03 §4`; no definido en ningún documento |
| `package_hash` incompleto | `01 §2.1` — no incluía `theme.json`, `defaults.json` ni migraciones |
| `01 §6.3` citado y ausente | `esquema/blocks.ts:149` cita "01 §6.3"; §6 no tenía subsecciones |
| `z.record` descarta `"__proto__"` en silencio | Medido: `success:true`, objeto vacío. ajv sobre el mismo JSON Schema lo rechaza |
| `$defs` prometidos y no emitidos | `01 §8` los prometía; los 10 archivos salían con 0 `$ref` |
| 9 pares en disco, 8 sembrados | `MongoDataInitializer.kt:36` y `:50` (`boda_premium_2` comentado), vía `fases/J-inventario-json.md` §2 |

## 3. Salida literal de la verificación ejecutable

Reproducible con `run-all.sh` en el scratchpad (`pnpm add zod@4.5.4 typescript@5.9.3 tsx ajv ajv-formats
@types/node`, `tsconfig` con `strict`, `module: nodenext`, `allowImportingTsExtensions`). **`zod@4.5.4`
existe en el registro**, no hizo falta desviarse de la versión de `contratos.md`.

```
### 0. entorno
node v22.22.2 · pnpm 10.33.0 · tsc Version 5.9.3 · zod 4.5.4 · ajv 8.20.0 · ajv-formats 3.0.1

### 1. npx tsc --noEmit --strict -p tsconfig.json
(sin salida = 0 errores)  EXIT=0

### 2. npx tsx src/emit-json-schema.ts json-schema
wrote json-schema/templates2.schema.json (15 definiciones)
wrote json-schema/template-manifest.schema.json -> #/$defs/TemplateManifest
wrote json-schema/theme.schema.json -> #/$defs/Theme
wrote json-schema/defaults.schema.json -> #/$defs/Defaults
wrote json-schema/migration-plan.schema.json -> #/$defs/MigrationPlan
wrote json-schema/invitation-document.schema.json -> #/$defs/InvitationDocument
wrote json-schema/operation-batch.schema.json -> #/$defs/OperationBatch
wrote json-schema/edit-proposal.schema.json -> #/$defs/EditProposal
wrote json-schema/composed-document.schema.json -> #/$defs/ComposedDocument
wrote json-schema/business-snapshot.schema.json -> #/$defs/BusinessSnapshot
wrote json-schema/composition-report.schema.json -> #/$defs/CompositionReport

### 3. npx tsx src/verify.ts   (Zod + ajv 2020-12 con ajv-formats, vía el bundle)
PASS  ejemplos/boda-clasica-1.0.0/template.json    zod=OK  ajv=OK 
PASS  ejemplos/boda-clasica-1.0.0/theme.json       zod=OK  ajv=OK 
PASS  ejemplos/boda-clasica-1.0.0/defaults.json    zod=OK  ajv=OK 
PASS  ejemplos/boda-clasica-1.0.0/documento.json   zod=OK  ajv=OK 
PASS  ejemplos/boda-clasica-1.0.0/compuesto.json   zod=OK  ajv=OK 
PASS  ejemplos/xv-jardin-1.0.0/template.json       zod=OK  ajv=OK 
PASS  ejemplos/xv-jardin-1.0.0/theme.json          zod=OK  ajv=OK 
PASS  ejemplos/xv-jardin-1.0.0/defaults.json       zod=OK  ajv=OK 
PASS  ejemplos/xv-jardin-1.0.0/documento.json      zod=OK  ajv=OK 
PASS  ejemplos/xv-jardin-1.0.0/compuesto.json      zod=OK  ajv=OK 

TODO VERDE

### 4. npx tsx src/inv.ts   (invariantes I-01…I-29 sobre los ejemplos)
ejemplos/boda-clasica-1.0.0  validateManifest -> 0 violacion(es)
ejemplos/boda-clasica-1.0.0  validateDocument -> 0 violacion(es)
ejemplos/xv-jardin-1.0.0  validateManifest -> 0 violacion(es)
ejemplos/xv-jardin-1.0.0  validateDocument -> 0 violacion(es)

### 5. npx tsx src/gen.ts   (compose de referencia: R9 + reproducción de los golden files)
[boda-clasica-1.0.0] R9 idempotencia: OK (bytes idénticos)
[boda-clasica-1.0.0] ComposedDocument valida contra Zod: true
[boda-clasica-1.0.0] report = {"missingRequired":[],"stillDefault":[],"orphanContent":[],"orphanSections":[],"invalidValues":[],"themeFallback":null}
[boda-clasica-1.0.0] reproduce compuesto.json existente: SÍ (idéntico)
[xv-jardin-1.0.0] R9 idempotencia: OK (bytes idénticos)
[xv-jardin-1.0.0] ComposedDocument valida contra Zod: true
[xv-jardin-1.0.0] report = {"missingRequired":[],"stillDefault":[],"orphanContent":[],"orphanSections":[],"invalidValues":[],"themeFallback":null}
[xv-jardin-1.0.0] reproduce compuesto.json existente: SÍ (idéntico)

### 6. npx tsx src/attack2.ts   (los 12 ataques de la ronda 1R, tras las correcciones)
CERRADO A-01a    ajv RECHAZA href="javascript:alert(1)" en ComposedDocument
CERRADO A-01b    ajv RECHAZA href="data:…"
CERRADO A-01c    Zod RECHAZA href="javascript:…"
CERRADO A-01d    ajv ACEPTA una URL https legítima (no hay falso positivo)
CERRADO A-02     richText de 1500 chars viola I-16 con maxLength=5
CERRADO A-03pre  (control) JSON.parse SÍ crea "__proto__" como propiedad propia
CERRADO A-03     z.record SIGUE aceptando (y descartando en silencio) "__proto__" — limitación de zod@4.5.4, no se puede cerrar con esquema
CERRADO A-03d    I-29 sobre el JSON crudo detecta 2 clave(s) reservada(s): $.attic.boda-clasica@1.0.0.__proto__, $.attic.boda-clasica@1.0.0.constructor
CERRADO A-03e    I-29 no da falsos positivos sobre el documento legítimo
CERRADO A-03b    attic RECHAZA "Boda_Clasica@01.0.0" (slug/semver inválidos)
CERRADO A-03c    attic ACEPTA una entrada legítima
CERRADO A-04     I-24 rechaza un reorderSections que no es permutación
CERRADO A-04b    I-24 acepta una permutación real
CERRADO A-05     setTheme vacío SIGUE siendo válido (no-op; se documenta, no se rompe)
CERRADO A-07     los 42 roles de boda-clasica están en el catálogo (parseo estricto)
CERRADO A-09     I-25 rechaza un grupo con rol escalar
CERRADO A-10     I-26 rechaza un rol singleton duplicado
CERRADO A-10b    boda-clasica@1.0.0 sigue en 0 violaciones (sectionTitle ×8 es legítimo)
CERRADO A-11     I-27 rechaza un manifiesto que declara un locale sin etiquetas
CERRADO A-12     I-28 rechaza un default para un bloque de negocio
```

### Notas sobre el entorno

- `pnpm add typescript` instala **TypeScript 7.0.2**, cuyo `tsc --version` responde `Version 6.0.2`. Con esa
  versión aparecían errores adicionales que no reproduce 5.x. La verificación canónica se hizo con
  **`typescript@5.9.3`**. `contratos.md` §7 dice "TypeScript 7.x … validar compatibilidad del pipeline
  Zod → JSON Schema en fase 1": **no queda validado con TS 7**, solo con 5.9.3 (ver §5).
- `z.toJSONSchema({A, B})` (modo multi-esquema por objeto literal) **lanza** `TypeError: Cannot read
  properties of undefined (reading 'def')` en 4.5.4. La forma que funciona es `z.toJSONSchema(registry)`,
  que devuelve `{ schemas: { … } }`.

## 4. Qué cambié (rutas)

- `diseno/01-dominio-y-esquema.md`: 347 → ~1130 líneas. §2.1 (árbol exacto + `package_hash`), §2.2/§2.3/§2.4
  (alineadas con el esquema), §3.1 (variantes y bloques por sección), §3.2 (catálogo de 14 bloques
  completo), §3.3 (roles), §4 (sin `order`), §5.1 (firmas TS+Kotlin), §5.2 (R1c, R3, R9), **§5.3
  pseudocódigo del merge**, **§5.4 direccionamiento**, **§5.5 `canonicalJson`/`contentHash`**, §6.1-§6.5
  (migración, **§6.4 cambio de plantilla**, **§6.5 `applyOperation`/`validateInvariants`**), §7, §8
  (pérdidas medidas + bundle), **§10 cobertura**, **§11 revisión 1R**.
- `diseno/esquema/`: `manifest.ts` (import), `invariants.ts` (I-24…I-29, richText en I-16, iteración
  ordenada), `composed.ts` (`HttpUrl`, `RichDoc`, `BlockKind`), `document.ts` (`AtticKey`, clave `BlockId`),
  `blocks.ts` (10 roles de grupo, 17 singleton, 10 roles nuevos), `emit-json-schema.ts` (bundle `$defs`),
  `index.ts`, `README.md`, **`compose.ts` (nuevo)**.
- `diseno/ejemplos/`: ULIDs corregidos, `NOTAS.md` en ambas carpetas, roles de grupo en los dos
  `template.json`, `boda-clasica-1.0.0/compuesto.json` regenerado, **`xv-jardin-1.0.0/compuesto.json`
  creado**.
- `diseno/08-verificacion-adversarial-esquema.md`: apéndice 1R (solo añadido al final).

## 5. Qué NO pude hacer

- **Nada se probó contra Kotlin.** No hay JDK 17 (`contratos.md` §7) y no compilé una línea de Kotlin. Que
  `com.networknt:json-schema-validator` acepte el bundle con `$defs` es **inferido** de que ajv lo acepta.
- **`migrate`, `switchTemplate` y `applyOperation` no están implementados.** Tienen firma exacta, tipos de
  error y pseudocódigo, pero su comportamiento **no está verificado ejecutándolo**. Solo `compose` lo está.
- **No validé el pipeline con TypeScript 7.x**, que es lo que `contratos.md` §7 pedía dejar cerrado en fase 1.
- **No leí `02`…`07` en profundidad**, solo lo necesario para citar. Las contradicciones que detecté con
  otros bloques están en `handoffs/1R-dominio.md` como "contradicciones a dirimir", sin resolver (por brief).
- El contenido real de las plantillas 11, 12, 14, 16 y 17 sigue sin ser reproducible desde el repositorio.

## 6. Riesgos

1. **Alto — el contrato cambió bajo los demás bloques.** Los 10 roles de grupo, los 10 roles nuevos, las 6
   invariantes nuevas (I-24…I-29), el parámetro `assets` de `compose`, el bundle de JSON Schema y el
   `package_hash` nuevo afectan a `02` (DDL de `package_hash`), `03` (rutas de carga del esquema, errores
   `TPL_*`), `06` (tabla de casos de invariantes: 23 → 29) y `07` (direccionamiento por rol de la IA). El
   orquestador tiene que volcarlos a `contratos.md` **antes** de abrir la fase 2.
2. **Medio — `z.record` y `"__proto__"`.** Mitigado por I-29, pero I-29 hay que **acordarse** de llamarlo
   sobre el JSON crudo antes de `parse`. Si un agente de fase 2 solo llama a `InvitationDocument.parse`,
   el agujero vuelve. Debería ser una prueba de contrato obligatoria (`06 §5`).
3. **Medio — `compose.ts` es una implementación de referencia en TypeScript, no la de producción.** La de
   Kotlin puede divergir en el formateo de dobles y de fechas. La prueba de golden file compartida es la
   única defensa y aún no existe.
4. **Bajo — `switchTemplate` transporta solo 17 roles singleton.** Es deliberadamente conservador; si el
   dueño espera que "cambiar de plantilla conserve el itinerario", el diseño no lo hace (ver
   `preguntas-abiertas.md`).
