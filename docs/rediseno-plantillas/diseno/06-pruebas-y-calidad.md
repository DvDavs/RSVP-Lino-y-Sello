# 06 — Estrategia de pruebas y calidad

Autor: fase 1, rol `1-pruebas`. Estado: propuesto para aceptación (ADR-024…026).
Evidencia: `handoffs/0-resumen-auditoria-pruebas.md`, `contratos.md` §7 (entorno verificado), `handoffs/0-build-jdk.md`, `01-dominio-y-esquema.md` §8 (Zod/JSON Schema), `02-persistencia-y-catalogo.md`, `03-api.md`, `04-frontend-y-editor.md`.

---

## 1. Pirámide de pruebas por capa

```
                    e2e (Playwright)              pocas, caras, flujo completo
                 ───────────────────
              contrato (esquema + API)          medianas, una por regla/código
           ───────────────────────────
        unitarias (composición, migración,     muchas, baratas, el núcleo real
        invariantes, reductor de operaciones)
```

| Capa | Qué cubre | Herramienta | Ubicación |
|---|---|---|---|
| Unitaria backend | `compose()`, `migrate()`, `TemplateRegistrar`, `Invariants.kt`, reductor de operaciones Kotlin | JUnit5 + MockK (preferido sobre Mockito para Kotlin idiomático; `mockito-kotlin:5.1.0` ya está declarado como alternativa si MockK no se agrega) | `src/test/kotlin/mx/evolutiondev/invitaciones/modules/templates2/**` |
| Unitaria frontend | Componentes de `packages/sections`, reductor de operaciones TS, `invariants.ts` | Vitest + Testing Library | `frontend/packages/*/src/**/*.test.ts(x)` |
| Contrato de esquema | Cada schema exportado de `packages/schema` valida sus casos positivos/negativos; el `.schema.json` generado coincide con el commiteado | Vitest (TS) + JUnit5 con `com.networknt:json-schema-validator` (Kotlin), misma tabla de casos JSON | `frontend/packages/schema/src/**/*.contract.test.ts`, `src/test/kotlin/.../schema/*ContractTest.kt` |
| Contrato de API | Cada ruta de `03-api.md` §2, cada código `TPL_*` de §5 | JUnit5 + `MockMvc`/`WebTestClient` contra Postgres real (§6) | `src/test/kotlin/.../templates2/api/**` |
| Golden files | Composición determinista (R1-R9) sobre los ejemplos de boda/XV y sobre las 8 plantillas migradas | JUnit5 (Kotlin) + Vitest (TS), misma entrada/salida | `src/test/resources/golden/**`, `frontend/packages/schema/golden/**` (mismos archivos, symlink o copia — ver §4) |
| Accesibilidad | Render público de los 2 ejemplos + editor | `@axe-core/playwright` | `frontend/apps/web/e2e/a11y.spec.ts` |
| e2e | "Elegir plantilla → editar → publicar → ver como invitado" (flujo A de `04 §2.1`) + deshacer + ocultar sección | Playwright (Chromium preinstalado en este entorno, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, `contratos.md` §7) | `frontend/apps/web/e2e/*.spec.ts` |

## 2. Umbrales de cobertura (ADR-024)

| Ámbito | Umbral | Motivo |
|---|---|---|
| `templates2.composition` + `templates2.migration` (Kotlin) | ≥ 85% líneas | núcleo de lógica entrelazada — donde vive el riesgo real (mismo principio que llevó a los 2743 líneas sin pruebas hoy, H-19) |
| `templates2` completo (Kotlin) | ≥ 80% líneas | resto del módulo (persistencia, API) |
| `packages/schema` (TS) | 100% de esquemas exportados con ≥ 1 caso positivo + 1 negativo | esquema es el contrato compartido; un esquema sin prueba es exactamente el defecto de origen (P1) |
| `packages/sections` (TS) | ≥ 70% líneas | componentes de presentación, menor riesgo lógico que el motor |
| e2e | flujo principal de `04 §2.1` en verde + deshacer + ocultar/reordenar sección | criterio de terminado explícito del prompt maestro §9.4 |
| a11y | cero violaciones `axe` críticas/serias en render público de boda-clasica y xv-jardin | `04 §6` |

CI (§7) falla el build si cualquier umbral no se cumple. Ningún PR de fase 2+ que toque `templates2` o `frontend/` se acepta sin que estos umbrales pasen (control de calidad del orquestador, prompt maestro §8).

## 3. Golden files (P5, P9)

Cada golden file es una carpeta `<slug>-<version>/` con `template.json`, `defaults.json`, `theme.json`, `documento.json`, `compuesto.json` — exactamente la forma ya usada en `diseno/ejemplos/` (`01 §7`). La prueba de golden file:

```kotlin
@Test fun `compose(boda-clasica) coincide con el golden file`() {
    val pkg = loadGolden("boda-clasica-1.0.0")
    val result = Composer.compose(pkg.manifest, pkg.documento, FIXED_BUSINESS_SNAPSHOT, "es-MX")
    assertJsonEquals(pkg.compuesto, result.composed)   // comparación canónica (R9), no por igualdad de objeto
    assertJsonEquals(pkg.reporte, result.report)
}
```
```typescript
test("compose(boda-clasica) coincide con el golden file", () => {
  const pkg = loadGolden("boda-clasica-1.0.0");
  const result = compose(pkg.manifest, pkg.documento, FIXED_BUSINESS_SNAPSHOT, "es-MX");
  expect(canonicalize(result.composed)).toEqual(canonicalize(pkg.compuesto));
});
```
`FIXED_BUSINESS_SNAPSHOT` es literal (fecha, hashtag, etc. fijos, sin reloj — mismo principio de determinismo de R6/ADR-007), documentado en el comentario `_comentario` de cada `compuesto.json` (ya presente en los dos ejemplos de fase 1). Añadir un golden file nuevo (una de las 8 plantillas migradas, fase 4) es copiar la carpeta y ejecutar la misma prueba parametrizada — sin código nuevo por plantilla.

Golden files de **migración de versión**: por cada `MigrationPlan` registrado (`01 §6`), un par `<documento-v1>.json` + `<documento-v2-esperado>.json`; la prueba corre `migrate()` y compara.

## 4. Tabla de casos de invariantes compartida (ADR-005)

`frontend/packages/schema/golden/invariants/*.json`: un archivo por invariante `I-01`…`I-21` (`esquema/invariants.ts`), cada uno una lista `{input, expectedViolations}`. Una sola prueba parametrizada en TS y otra en Kotlin recorren el mismo archivo:

```jsonc
// golden/invariants/I-01-range-end-before-start.json
[
  { "input": { "kind": "dateTimeRange", "start": "2026-12-12T16:00", "end": "2026-12-12T15:00" }, "expectedViolations": ["I-01_RANGE_END_BEFORE_START"] },
  { "input": { "kind": "dateTimeRange", "start": "2026-12-12T16:00" }, "expectedViolations": [] }
]
```
Si `invariants.ts` e `Invariants.kt` divergen en el resultado para el mismo caso, la prueba falla en el lado que se ejecute — CI corre ambos lados sobre el mismo commit, así que una divergencia siempre se detecta antes de mergear (mata H-35 de raíz para las invariantes, complementando el JSON Schema commiteado de `01 §8` que ya cubre lo representable).

## 5. Lint de esquema (regla dura de ADR-005)

Regla ESLint personalizada (`packages/schema/.eslintrc`, `no-restricted-syntax` sobre llamadas a `.refine`/`.superRefine`/`.transform` dentro de `src/**/*.ts`) — falla el build de `packages/schema` si alguien reintroduce un refinamiento no exportable. Complementa (no reemplaza) la prueba de CI que compara `git diff --exit-code` sobre el `.schema.json` generado (ADR-004).

## 6. Postgres en pruebas sin Docker (ADR-025)

Verificado por el orquestador raíz (`contratos.md` §7): Docker no disponible en este entorno, Postgres 16 instalado localmente. Script de arranque para la suite de integración (`src/test/kotlin/.../templates2/IntegrationTestBase.kt`, `@BeforeAll` a nivel de módulo):

```bash
#!/usr/bin/env bash
set -euo pipefail
PGDATA=$(mktemp -d)
/usr/lib/postgresql/16/bin/initdb -D "$PGDATA" -U postgres --auth=trust > /dev/null
/usr/lib/postgresql/16/bin/pg_ctl -D "$PGDATA" -o "-p 5433 -k $PGDATA" -l "$PGDATA/log" start
/usr/lib/postgresql/16/bin/createdb -h localhost -p 5433 -U postgres templates2_test
# JDBC url que usa la suite: jdbc:postgresql://localhost:5433/templates2_test
# Flyway aplica V29-V36 (más las que agregue fase 2) contra este clúster antes del primer test.
```
Apagado simétrico en `@AfterAll` (`pg_ctl stop`, borrar `$PGDATA`). H2 en modo Postgres queda **descartado** para estas pruebas: no soporta los operadores JSONB (`@>`, `->>`) que las consultas de catálogo (`02 §2.2`, filtro por `eventKinds`/capacidades) necesitan probar de verdad. Si el runner de CI (§7) sí tiene Docker disponible, puede preferir Testcontainers con el mismo esquema de migraciones sin duplicar pruebas — decisión de fase 2, documentada como alternativa condicional, no como el camino primario (que es el script anterior, garantizado en cualquier entorno con Postgres local).

## 7. CI (ADR-026, GitHub Actions)

No existe `.github/workflows` hoy (`handoffs/0-inventario.md` §5). Diseño del workflow (implementación real en fase 2):

```yaml
# .github/workflows/templates2-ci.yml (fase 2 lo crea)
name: templates2-ci
on: [pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '21' }   # toolchain 21, ADR de 0-build-jdk.md
      - name: Instalar Postgres 16 local
        run: sudo apt-get install -y postgresql-16
      - run: ./gradlew test jacocoTestReport
      - run: ./gradlew jacocoTestCoverageVerification   # aplica los umbrales de §2
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @invitaciones/schema schema:emit && git diff --exit-code   # ADR-004
      - run: pnpm -r test -- --coverage
      - run: pnpm -r lint   # incluye la regla de ADR-005 (§5)
  e2e:
    needs: [backend, frontend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm --filter web build && pnpm --filter web start &
      - run: pnpm --filter web exec playwright test
      - run: pnpm --filter web exec playwright test e2e/a11y.spec.ts
```
Los tres jobs son obligatorios antes de mergear a `claude/agent-network-invitation-41nx5y` (ADR-026). `backend` y `frontend` corren en paralelo; `e2e` espera a ambos.

## 8. Lo que no pude determinar

- Si el runner real de GitHub Actions de este repositorio tiene Docker disponible (permitiría Testcontainers como alternativa a §6) — no verificable desde esta sesión local. El diseño no depende de la respuesta: el script de `pg_ctl` funciona en cualquier caso.
- Cobertura de líneas real actual del repo (0%, H-19) no cambia el umbral objetivo, pero sí implica que fase 2 empieza literalmente desde cero — coherente con el resto del diseño, no es una limitación de esta fase.
