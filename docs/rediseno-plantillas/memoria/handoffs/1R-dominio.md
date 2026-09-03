# Handoff — 1R-dominio → orquestador (consolidación de `contratos.md` antes de la fase 2)

Entregables: `diseno/01-dominio-y-esquema.md` (347 → 1131 líneas), `diseno/esquema/*.ts` (+`compose.ts`),
`diseno/ejemplos/**` (+`xv-jardin-1.0.0/compuesto.json`, +`NOTAS.md`), apéndice en `diseno/08-*.md`,
`memoria/bitacora/1R-dominio.md` (salida literal), ADR-1R-D-01…09 (propuestas), 7 preguntas abiertas.
Verificación **ejecutada**: `tsc --strict` 0 errores · 10/10 ejemplos válidos contra Zod **y** ajv 2020-12 ·
`compose` reproduce ambos golden files byte a byte y es idempotente · 20 ataques, 0 altas abiertas.

## A. Cambios de contrato que hay que volcar a `contratos.md`

1. **§3 — invariantes: 23 → 29.** Nuevas: `I-24_REORDER_NOT_A_PERMUTATION`, `I-25_GROUP_ROLE_MISMATCH`, `I-26_SINGLETON_ROLE_DUPLICATE`, `I-27_LOCALIZED_TEXT_MISSING_LOCALE`, `I-28_DEFAULT_FOR_BUSINESS_BLOCK`, `I-29_RESERVED_OBJECT_KEY`; I-16 se extiende a `richText`. **I-29 corre sobre el JSON crudo, antes de `parse`** (`z.record` descarta `"__proto__"` en silencio; ajv lo rechaza → TS y Kotlin discrepaban). Afecta a `02 §7` (`InvariantCode.kt`), `04` (`golden/invariants/`), `06 §4` ("las 23 invariantes").
2. **§3 — roles.** +10 de grupo, +10 escalares, 17 singleton declarados. Fuente normativa: `esquema/blocks.ts`, **no** `01 §3.3` (nombraba 7 roles inexistentes). ADR-1R-D-04.
3. **§3 — firma de `compose`**: `compose(pkg, doc, business, **assets: AssetIndex**, locale)`. Sin ese parámetro era inimplementable (`ResolvedValue.image` exige `url`). ADR-1R-D-01.
4. **§3 — `canonicalJson` + `contentHash`** definidos por primera vez (`01 §5.5`). ADR-1R-D-02.
5. **§5 — `package_hash`** cubre el paquete entero (manifiesto + theme + defaults + migraciones + assets), con los `.json` canonicalizados. La fórmula anterior colisionaba y el registro idempotente descartaba el segundo paquete en silencio. ADR-1R-D-03.
6. **§3/§5 — JSON Schema**: bundle único `templates2.schema.json` (15 `$defs`, 42 `$ref`, 217 KB) + 10 punteros, en vez de 10 archivos autocontenidos (469 KB). ADR-1R-D-08.
7. **§3 — R1c**: una sección ausente de `doc.structure` se inserta en su posición relativa del manifiesto, no al final. ADR-1R-D-06.
8. **§3/§4 — `switchTemplate`** definido (`01 §6.4`): transporte solo por rol singleton, grupos siempre al `attic`. Es lo que ejecuta `:choose-template` al cambiar de plantilla. ADR-1R-D-07.
9. **§3 — NO existen** `StructureEntry.order`, `SectionSpec.hideable`/`.defaultOrder`, `BlockSpec.defaultRef` ni `TemplateManifest.theme`; `source` es enum de 3 (`user|business|fixed`) con `businessField` aparte, nunca `"business:<campo>"`. Cuatro bloques `jsonc` de `01` decían lo contrario.
10. **§3 — golden files generados, nunca a mano** (ADR-1R-D-09). `esquema/compose.ts` entra en la superficie pública de `@invitaciones/schema`.
11. **§6/§7 — TypeScript**: verificado con **5.9.3**, no con 7.x (`pnpm add typescript` trae 7.0.2 y produce errores que 5.x no reproduce). Coincide con `ADR-1R-F-01` del bloque de frontend.

## B. Contradicciones a dirimir (no las resuelvo)

- **CD-01 · `package_hash`.** `01 §2.1` (mío): `"sha256:" + 64 hex` sobre **todos** los archivos del paquete.
  `02:71,82` : `CHAR(64)` + `CHECK ~ '^[0-9a-f]{64}$'`; `02:450` (`PackageHasher.kt`): fórmula antigua
  (`canonical(manifest) ‖ sha256 de assets`), que **colisiona** si solo cambian `defaults.json`/`theme.json`.
- **CD-02 · `content_hash`.** `01 §5.5` (mío): `"sha256:" + hex` sobre `{composed, report}`.
  `02:233,238` : `CHAR(64)` + `CHECK`; `02:465` y `03:282`: `sha256(canonical(composed))`, sin el informe.
  Si el informe no entra, un cambio en `stillDefault` no invalida el `ETag` (`03:323`).
- **CD-03 · colisión de numeración `I-24`.** `04` propone `I-24_PALETTE_CONTRAST_BELOW_AA` (ADR-1R-F-06);
  `01`/`invariants.ts` ya usan `I-24_REORDER_NOT_A_PERMUTATION`, implementada y probada. **Propongo que la
  de contraste pase a `I-30`**, pero la decisión es del orquestador.
- **CD-04 · código de error al escribir un bloque no editable.** `03:388,504`: `TPL_BUSINESS_BLOCK_WRITE`.
  `01 §6.5` (mío): `TPL_BLOCK_NOT_EDITABLE` con campo `source: "business" | "fixed"` (I-21 también viola con
  `fixed`, y el nombre actual solo nombra el caso de negocio).
- **CD-05 · carga del JSON Schema en Kotlin.** `02:444,606,613` carga "los 10 `*.schema.json`" y verifica su `$id`. Con el bundle los 10 punteros siguen existiendo con su `$id`, pero `JsonSchemaRegistry` debe además cargar `templates2.schema.json` y resolver `$ref` entre archivos. `04:55` ya lo nombra: `02` es el desalineado.
- **CD-06 · firma de `compose` sin `assets`.** `05:370` y `07:310` la citan como
  `compose(pkg, doc, business, locale)`.
- **CD-07 · punteros a líneas de `invariants.ts` obsoletos**: `02:339` (`:25-61`), `02:447` (`:9-17`), `03:173` (`:86`).

## C. Riesgo residual documentado

`z.record` acepta y **descarta en silencio** la clave `"__proto__"` (limitación de `zod@4.5.4`, no cerrable
desde el esquema). Mitigado por I-29 **solo si alguien la llama** sobre el JSON crudo antes de `parse`.
Debe ser prueba de contrato obligatoria en `06 §5`, no una convención.

## D. Lo que sigue sin verificar

`migrate`, `switchTemplate` y `applyOperation` tienen firma exacta, tipos de error y pseudocódigo, pero
**no hay implementación ni ejecución**. Nada se probó contra Kotlin (sin JDK 17 en esta sesión): que
`com.networknt:json-schema-validator` acepte el bundle con `$defs` es **inferido** de que ajv lo acepta.
