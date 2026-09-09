---
name: pruebas-producto
description: Levantar y probar el producto completo (backend + Postgres efímero + frontend) y escribir o correr e2e nuevos. Cárgala antes de arrancar el entorno, antes de escribir cualquier spec de Playwright, o cuando el encargo pida correr la suite completa.
---

# pruebas-producto

## 1. Comando único de arranque
Verificado contra `scripts/dev-backend.sh`, `scripts/seed-demo.sh` y `frontend/apps/web/package.json`
(`handoffs/3c-para-siguiente.md §1`):
```bash
scripts/dev-backend.sh start && scripts/seed-demo.sh   # backend :6003 + Postgres efímero + siembra
cd frontend && pnpm install --frozen-lockfile
NEXT_PUBLIC_E2E_HOOKS=1 pnpm run build && PORT=3000 pnpm --filter web run start
```
- `scripts/dev-backend.sh start` es idempotente: si el backend ya responde, no hace nada. `status`
  da 0 si responde; `stop` para backend y clúster; `env` imprime las variables para `eval $(…)`.
- `scripts/dev-backend.sh` delega en `scripts/pg-ephemeral.sh` para el Postgres efímero (sin
  Docker); `initdb` no corre como root, así que el script delega en el usuario del sistema
  `postgres` si hace falta.
- `scripts/seed-demo.sh` es idempotente (registro de plantillas por `package_hash`, assets por
  `sha256`, lotes por `clientBatchId`, publicación por `contentHash`): puede correr tantas veces
  como haga falta sobre el mismo clúster.
- Si solo necesitas Playwright contra el backend real, no hace falta el `next start` manual: el
  `webServer` de `playwright.config.ts` hace `pnpm run build && pnpm run start` él solo con
  `NEXT_PUBLIC_E2E_HOOKS: "1"` ya puesto — arranca con `pnpm --filter web exec playwright test`
  directamente tras el primer bloque (backend + siembra).

## 2. Trampas del entorno (verificadas, no supuestas)
- **Sin Docker**: todo Postgres es el clúster efímero de `pg-ephemeral.sh`. Nunca intentes
  `docker run postgres` ni Testcontainers.
- **`pnpm run build` (turbo) tiene que correr antes de servir nada**: el `build` de
  `@invitaciones/ui` (`packages/ui/scripts/copiar-fuentes-publicas.ts`) copia los `.woff2` a
  `apps/web/public/fonts/` (ignorados por git). Sin ese paso el chrome cae a la fuente de reserva y
  las capturas de la galería fallan en cascada. `apps/web/package.json` ya invoca ese script en sus
  propios `dev`/`build`, pero si construyes un paquete aislado (`pnpm --filter @invitaciones/ui run
  build`) confírmalo con `ls frontend/apps/web/public/fonts/`.
- **Nunca `./gradlew clean` con la demostración viva**: borra `build/`, que es el almacén local de
  assets (`TEMPLATES2_ASSETS_LOCAL_DIR`, modo `local` por defecto en este entorno porque no hay
  bucket S3 utilizable). Si necesitas limpiar Kotlin, para el backend primero
  (`scripts/dev-backend.sh stop`).
- **`pkill -f "next start"` mata el propio shell** si tu propio proceso coincide con ese patrón
  (ocurre cuando arrancaste `next start` en primer plano en la misma sesión). Mata por PID
  (`kill <pid>`) o por puerto (`fuser -k <puerto>/tcp`).
- **Puerto de Playwright configurable** (`PW_PORT`, por defecto 3000) porque `reuseExistingServer`
  da por bueno CUALQUIER servidor que ya escuche ahí — incluido el de otra sesión sobre otro árbol —
  y entonces mides un build que no es el tuyo. Si sospechas que hay un servidor viejo, para todo y
  vuelve a arrancar, no asumas que el que responde es el tuyo.
- **Chromium ya preinstalado** en `/opt/pw-browsers` (revisión 1194): nunca `playwright install`, el
  proxy no lo necesita y las dos configs (`playwright.config.ts`, `playwright.design.config.ts`) ya
  detectan esa ruta con `existsSync` y caen a lo que instale CI si no existe.
- **Cuentas de la demostración NUNCA en paralelo**: dos logins concurrentes de la MISMA cuenta
  (`POST /auth/token`) disparan un 500 en el módulo `auth` antiguo (`RefreshTokenService.kt:20`,
  ajeno, no se toca). Por eso `playwright.config.ts` tiene un `globalSetup`
  (`e2e/global-setup.ts`) que autentica la cuenta de demostración UNA sola vez antes de que arranque
  ningún worker, y `jwtDemo()` de `preparar.ts` lee ese token cacheado. Si tu spec necesita una
  cuenta propia (no la de demostración), créala con `cuentaNueva()` (§4) — nunca hagas tu propio
  `POST /auth/token` sobre la cuenta demo dentro de una prueba.

## 3. e2e por rol y cómo se obtiene la sesión de cada uno
- **Cliente** (rol `USER`, dueño de una invitación): `jwtDemo()` de `e2e/preparar.ts` da el token
  cacheado de la cuenta de demostración (`demo.boda@example.com`) — úsalo para pruebas que leen o
  comparten estado con la demo sin escribir en su invitación. Para cualquier prueba que **escriba**,
  usa una invitación propia (§4): el token de demo sigue sirviendo, solo cambia el `invitationId`.
  Si necesitas una cartera de invitaciones entera y conocida (nada mezclado con lo que otra prueba
  en paralelo le haga a la cuenta demo), usa `cuentaNueva()`, que da cuenta, token y `customerId`
  nuevos por la ruta real (`POST /auth/signup` + `POST /auth/token`).
- **Invitado** (sin cuenta, visita el enlace público): no hay sesión que crear — `page.goto`
  directo a `/i/[publicToken]` sin `sesionDemo()`. El `publicToken` sale de publicar una invitación
  propia de la prueba (`aplicarOperaciones`/`:publish` sobre la invitación de §4), nunca de leer el
  de la invitación sembrada a mano.
- **MASTER/ADMIN**: el rol vive en la columna `customer.role` (`USER`/`ADMIN`/`MASTER`, constraint
  `V1__initial_schema.sql:81`) y se resuelve **en cada petición** desde esa fila
  (`JwtTokenFilter.kt:47`, `customerRepository.findByIdEvenIfDisabled`) — el JWT solo lleva el id de
  cliente, no el rol como claim fijo. Para una sesión MASTER/ADMIN de prueba: crea una cuenta con
  `cuentaNueva()` (rol `USER` por defecto) y elévala por SQL con la misma utilidad `sql()` de
  `preparar.ts`:
  ```ts
  const { token, customerId } = await cuentaNueva();
  sql(`UPDATE customer SET role = 'MASTER' WHERE id = ${customerId};`);
  // el MISMO token ya sirve: el rol se lee de la fila en cada request, no del JWT.
  ```
  Nunca reutilices los correos `MASTER`/`ADMIN` sembrados por `V2__add_initial_data_and_customer_fields.sql`
  (`moises@evolutiondev.mx`, etc.): son cuentas reales de producción, no de prueba.

## 4. REGLA DURA DE LA FASE 5 — cada spec crea sus propios datos
**Cada spec e2e nuevo crea su propia invitación —y su propio usuario si hace falta— y nunca usa la
invitación sembrada compartida (`invitacionSembrada()` de `preparar.ts`); `fullyParallel` con 4
workers tiene que pasar.** Es la lección de la issue **I-CI-01**: dos specs (`editor-3c-evidencia.spec.ts`
y `a11y-publico.spec.ts`) se pisaban la invitación compartida y el job `e2e` del CI solo pasaba con
`--workers=1`; una sesión aparte la está cerrando en `claude/ci-github-actions-jobs-9qyd9z` —
**no toques esos dos ficheros ni `e2e/preparar.ts`** (área prohibida de este skill, ver tu brief).

El patrón concreto, ya en uso por `e2e/preparar-panel.ts` y `e2e/cambiar-fecha.spec.ts` — **léelos
antes de escribir tu spec**:
```ts
import { API_BASE, borrarInvitacion, jwtDemo, sesionDemo } from "./preparar.ts";
import { crearInvitacionPublicable } from "./preparar-panel.ts";

test("mi verbo nuevo", async ({ page }) => {
  const token = await jwtDemo();                              // o cuentaNueva() si necesitas rol/cuenta propia
  const invitationId = await crearInvitacionPublicable(token); // invitación NUEVA, propia de esta prueba
  try {
    await sesionDemo(page, token);
    await page.goto(`/editor/${invitationId}`);
    // … el cuerpo de la prueba, solo sobre `invitationId` ……
  } finally {
    borrarInvitacion(invitationId);                            // limpieza SIEMPRE, incluso si la prueba falla
  }
});
```
- `crearInvitacionPublicable(token)` (en `preparar-panel.ts`) crea la invitación por HTTP real
  (`:choose-template` + subir un asset + rellenar los cuatro bloques que bloquean `canPublish`) y
  devuelve un `invitationId` que nadie más toca.
- Si tu prueba necesita el documento vacío en vez de ya publicable, usa
  `invitacionSinDocumento(templateId, customerId)` de `preparar.ts` (SQL directo — es la única cosa
  que no tiene ruta HTTP, `uses_templates2` no se activa por API a propósito, ADR-2-4-02).
- Si tu prueba necesita el manifiesto real de `boda-clasica` montado (panel de contenido,
  `ThemePicker`), añade `await sembrarManifiesto(page, invitationId)` DESPUÉS de `page.goto` (usa el
  gancho `window.__seedManifestFixture` de `NEXT_PUBLIC_E2E_HOOKS=1`, igual que `__editorStore`).

### Cuando necesitas ROL o INVITADOS, no solo una invitación
Los ayudantes de TypeScript de arriba cubren la clienta y su invitación. Para lo que la fase 5 añade
—un MASTER, una clienta ajena, invitados con cupos, una invitación pagada frente a otra sin pagar—
usa la biblioteca de shell `scripts/seed/`, que se creó para esto (**ADR-5-E1-03**, README en
`scripts/seed/README.md`):

```bash
scripts/dev-backend.sh start
eval "$(scripts/seed/invitados.sh)"   # SEED_INVITADOS_TOKEN, _INVITACION, _TOTAL…
```

| Script | Dueña | Qué deja |
|---|---|---|
| `scripts/seed/invitados.sh` | E2 | clienta + invitación + tres invitados con cupos distintos |
| `scripts/seed/cuenta.sh` | E3 | clienta recién registrada y **sin** invitaciones |
| `scripts/seed/plan.sh` | E4 | dos invitaciones de la misma clienta: una sin pagar y otra pagada |
| `scripts/seed/admin.sh` | E5 | un MASTER y una clienta **ajena** con invitación, para probar ruta x rol |

**Edita solo el fichero de tu área. `comun.sh` no se toca**: es el único punto compartido y por eso
es el que no puede tener conflictos. Cada llamada crea correos, teléfonos e invitaciones nuevos;
verificado que cuatro corridas simultáneas producen cuatro invitaciones distintas.

Tres cosas del backend que te van a morder si no las sabes, y que ya están resueltas ahí dentro:
1. El **teléfono es único por cuenta** y su formato real es `+52` más diez dígitos
   (`Patterns.kt:56`); el mensaje de error dice «10 digitos numéricos» y **omite el prefijo**.
2. **Una clienta no puede dar de alta a sus propios invitados**: la única superficie está bajo
   `/admin/**`, reservada a ADMIN y MASTER (`SecurityConfig.kt:42`), y la gemela para USER vive en
   el módulo prohibido. Por eso la siembra usa un MASTER. Esa ruta la construye **E2** en
   `modules/product/guests`.
3. Una invitación con `children_allowed = false` **rechaza** invitados con niños.
- Si tu prueba necesita una cuenta entera propia (no solo una invitación), usa `cuentaNueva()` —
  cada llamada genera un correo distinto, así que dos pruebas en paralelo nunca comparten cuenta.
- Limpieza con `borrarInvitacion(id)` en un `finally` (o `test.afterEach`), siempre, incluso si la
  prueba falla a mitad — deja la base tan limpia como la encontró.
- Si tu prueba de verdad necesita depender de la invitación sembrada compartida (rarísimo — casi
  nunca hace falta con el patrón de arriba disponible) y no hay forma de evitarlo, envuélvela en
  `conLockDeInvitacionSembrada()` de `preparar.ts` — un mutex real entre procesos con
  `fs.mkdirSync`/`EEXIST`. Es el último recurso, no el patrón por defecto: los specs nuevos de la
  fase 5 no deberían necesitarlo nunca.
- Verifica el aislamiento antes de dar tu spec por bueno:
  ```bash
  cd frontend && pnpm --filter web exec playwright test e2e/tu-spec.spec.ts --workers=4 --repeat-each=2
  ```
  Un fallo intermitente aquí (que no aparece con `--workers=1`) es exactamente la interferencia que
  I-CI-01 documentó — no lo silencies con un `retry`, arregla el aislamiento de datos.

## 5. Comandos de la suite completa
Cifras de referencia (**del cierre de la fase 3-C, HEAD `0f68f4d`** — la fase 5 añade módulos
nuevos, así que corre cada comando para el número de HOY antes de reportarlo, no repitas estas
cifras como si fueran el estado actual):

| comando | qué corre | cifra de referencia (fase 3-C) |
|---|---|---|
| `pnpm --filter web run test` | Vitest de `apps/web` | 567/567 |
| `pnpm -r run typecheck` (o `pnpm run typecheck` desde `frontend/`, que hace `turbo run typecheck`) | `tsc --noEmit` en cada paquete | 10/10 tareas turbo en verde |
| `pnpm --filter web exec playwright test` (config por defecto, backend real) | e2e del producto | 79/79 |
| `pnpm --filter web exec playwright test --config=playwright.design.config.ts --project=design` | galería `/design`, sin backend | 279/279 |
| `./gradlew check` | Kotlin: tests + `verifyJsonSchemaEmitted` (compuerta de deriva del esquema) + JaCoCo | 1 184–1 195 pruebas Kotlin (dos cierres distintos de fase 2/3; **desactualizado para fase 5**, vuelve a contar) |
| `scripts/smoke.sh` (con backend arriba) | 19 rutas HTTP reales de `handoffs/2-5.md` | 19/19 OK |
| `pnpm --filter web run budget` (`node scripts/check-budget.mjs`, tras `pnpm run build`) | presupuesto de JS por ruta | `/i/[publicToken]` ≤ 150 KB, `/editor/[id]` ≤ 600 KB |

Antes de correr `./gradlew check`, arranca el clúster con `source scripts/pg-ephemeral.sh start`
(exporta `TPL_TEST_JDBC_URL`/`TPL_TEST_DB_USER`/`TPL_TEST_DB_PASSWORD`) si no vas a reutilizar el
mismo clúster que `dev-backend.sh` ya levantó — dos clústeres independientes en la misma máquina
necesitan `TPL_TEST_STATE_DIR` distinto cada uno (ver cabecera de `pg-ephemeral.sh`).

## Lista de verificación
- [ ] Backend + Postgres efímero + siembra arriba antes de cualquier e2e (`scripts/dev-backend.sh status` da 0).
- [ ] `pnpm run build` corrido antes de servir el frontend (fuentes copiadas: `ls apps/web/public/fonts/`).
- [ ] Ningún spec nuevo usa `invitacionSembrada()`: cada uno crea su invitación (y su cuenta, si hace falta) y la borra al final.
- [ ] Sesión del rol correcto: `jwtDemo()`/`cuentaNueva()` para cliente, sin sesión para invitado, `cuentaNueva()` + `UPDATE customer SET role=...` para MASTER/ADMIN.
- [ ] Spec nuevo verificado con `--workers=4 --repeat-each=2` antes de darlo por bueno.
- [ ] No se tocó `e2e/preparar.ts`, `editor-3c-evidencia.spec.ts` ni `a11y-publico.spec.ts` (área de I-CI-01, sesión aparte).
- [ ] Cifras de la suite completa reportadas con el número de HOY, no las de la tabla de referencia.
