# Fase 3 — estado real (2026-09-05)

**La fase 3 NO está cerrada.** La revisión adversarial global la declaró **NO CERRABLE** y
quedan objeciones altas abiertas. La sesión se agotó (límite de uso) con dos agentes en su
pasada final de verificación. Este archivo es lo único que hay que leer para retomarla, más
`contratos.md`.

Rama: `claude/fase-3-frontend-orchestration-yuh8sx`, último commit integrado `f7efa03`.

## 1. Estado medido por el orquestador, no reportado
| | |
|---|---|
| `pnpm -r test` | **1 290** (505 esquema · 439 secciones · 346 web) |
| `pnpm -r typecheck` / `lint` / `build` | **limpios los tres** |
| presupuesto JS de `/i/[publicToken]` | **dentro de 150 KB** |
| `./gradlew check` | exit 0 · **1 195** pruebas Kotlin |
| LCP mediana | ~2 060 ms (objetivo < 2 500) |
| `axe` | 0 violaciones AA — **pero ver H-ADV-02** |
| `scripts/smoke.sh` | **10/19** — ver H-ADV-04 |

## 2. Lo que está hecho e integrado
Bloque 0 (backend arrancando por primera vez, `V40`; compuerta A1-A8 **viable 8/8**;
protocolo del lienzo) · Bloque 1 (`apps/web` con las 19 rutas tipadas; `packages/sections`
con los 12 tipos de sección y 14 de bloque; arte de las dos plantillas, 28 imágenes, ahora
**un juego por paleta**) · Bloque 2 (store con las 11 operaciones, undo con inversas
correctas, autoguardado, lienzo, paneles y flujos, e2e E-01…E-12) · Cierre parcial
(revisión de UX: 8 fricciones altas, 6 corregidas; revisión de calidad visual: 6 objeciones
altas, **las 6 corregidas**; revisión adversarial: 5 altas, **0 corregidas**).

## 3. LO QUE FALTA — por orden
### 3.1 Las cinco altas de la revisión adversarial (`handoffs/3-adv.md`)
- **H-ADV-01 · negrita/cursiva devuelven `500`.** `DomainJson.kt:291` hace
  `o.set<ArrayNode>("marks", arr)`; `ObjectNode.set()` devuelve `this` y Kotlin mete un
  `CHECKCAST`. Arreglo: `o.set<ObjectNode>(…)` o cerrar el lambda con `Unit`. **Y** añadir un
  golden de *documento* con `marks` + un caso de reductor: hoy `marks` solo vive en un fichero
  de casos de esquema que **nunca pasa por `encode`**, y por eso 2 390 pruebas no lo ven.
  Es la **segunda excepción autorizada** sobre `templates2` (defecto demostrado + ADR).
- **H-ADV-02 · WCAG con `axe` en verde.** Debería estar resuelta por el merge de 3-9
  (A2/A3): **verificar** midiendo el ratio del `<h2>` del RSVP y la familia de los 12 títulos.
- **H-ADV-03 · la compuerta de la CSP no puede ponerse en roja**: su única aserción sobre
  `script-src` es un `console.warn`. Con ella verde, **el criterio A4 no se cumple en
  `apps/web`** (se midió sobre el spike). Afirmar con `expect`, sabotear para probar el rojo, y
  cerrar el `eval` de Zod (`jitless` no surte efecto aquí; sospecha: segunda copia de `zod`).
  **No aflojar la CSP.**
- **H-ADV-04 · `smoke.sh` mide 10/19**: sube `.png` y el arte pasó a WebP. Corrigiendo la
  extensión llega a 17/19; falta subir los **tres** assets en la ruta 17 y hacer la 19
  independiente del orden. Regenerar `evidencia/fase-3/bloque-0/smoke.txt` y corregir la tabla
  de `handoffs/3-0a.md §2`.
- **H-ADV-05 · `/acceso` sin límite de intentos y con oráculo de temporización de 22×**
  (4 ms si el correo no existe, 90 ms si existe). Vive en el módulo `auth` heredado:
  **necesita dueño y decisión del dueño del producto.**

### 3.2 Trabajo rescatado, sin integrar
- `claude/fase-3-wip-3-10` — H-ADV-01/03/04, **sin commits propios**; el WIP rescata 15
  archivos sueltos.
- `claude/fase-3-wip-3-9` — ya integrado en la rama principal; su rama conserva 88 archivos
  sueltos (recapturas a medias) por si hicieran falta.

### 3.3 Dos fricciones de UX a medias
- **U-3**: **ninguna ruta de cliente escribe `invitation.date`**, solo la de administración.
  La clienta no puede cambiar la fecha de su boda. Hueco de backend fuera del alcance.
- **U-5**: el editor ya invalida y espera, pero **el webhook del backend sigue desactivado**
  (faltan `templates2.revalidate.url`/`.token` en `application.yml`, área prohibida).

### 3.4 Cierre formal, sin empezar
Aceptar o rechazar las ADR de la fase (todas en *propuesta*), añadir `contratos.md §12`,
actualizar `tablero.md` y `00-INDICE.md`, y escribir `handoffs/3-para-fase-4.md`.

## 4. Correcciones del dueño aplicadas
`bitacora/3-correcciones-dueno.md` — C-01: referencia visual `gigsalad.com`, medida por un
agente local del dueño (`diseno/arte-chrome.md`), adoptada en el **chrome** y no en la
invitación. Objeción mayor del orquestador: **Garnett es comercial**; sustituida por
tipografías de licencia abierta vía npm.

## 5. Avisos de entorno
Sin Docker · Postgres efímero, y `dev-backend.sh stop` **borra el clúster y las plantillas** ·
Chromium revisión 1194 con `@playwright/test` 1.62.1 → hace falta `executablePath` · **sin
acceso a bancos de imágenes ni a Google Fonts** (proxy); npm sí llega · los **logins
simultáneos** fallan con 500 (`RefreshTokenService.kt:20`, ajeno): autenticar una sola vez ·
**comprobar que el puerto 3000 es propio** antes de medir: si lo ocupa otra sesión, LHCI mide
una aplicación ajena.
