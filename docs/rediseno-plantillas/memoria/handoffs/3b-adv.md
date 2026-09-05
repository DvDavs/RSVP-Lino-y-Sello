# 3B-ADV → orquestador — VEREDICTO: **NO CERRABLE**. Sólo las ALTAS

Las **cinco altas de `3-adv.md` están cerradas** (cuatro del todo, `H-ADV-05` a medias) y lo verifiqué
ejecutando, no leyendo. Lo que impide cerrar la fase son **dos altas nuevas**, ninguna de ellas
introducida por la 3-B pero las dos alcanzables desde lo que la fase 3 publicó. Detalle y cifras en
`bitacora/3b-adv.md`. **2 altas nuevas · 6 medias · 3 bajas.** Árbol revisado: `037d4fe`, dejado limpio
(`git status` vacío).

| # | Objeción (una frase) | Evidencia medida | Remedio | Dueño |
|---|---|---|---|---|
| **N-01** | **`POST /auth/request-password-reset` devuelve el `resetToken` en el cuerpo de la respuesta, sin autenticar**: dos peticiones y cualquier cuenta es tuya, incluida una MASTER. La 3-B cerró un canal lateral de temporización de 22× en el mismo controlador y dejó abierta la puerta de al lado. | `POST /auth/request-password-reset {"email":"adv3b.v2@…"}` → `200` con `resetToken` (171 chars) · `POST /auth/reset-password {resetToken,newPassword}` → `200 "La contraseña se actualizo correctamente"` · `POST /auth/token` con la contraseña **del atacante** → `200`; con la de la víctima → `401`. Recorrido completo sobre una cuenta creada por mí. Y con `demo.master@example.com` la misma llamada entrega un token válido de 171 chars (rol MASTER). `ResetPasswordService.kt:52-54` mete `resetToken` en `RecoveryPasswordSentResponse`. Sin límite de intentos: `AuthThrottleService` sólo cubre `/auth/token`. | Quitar `resetToken` de la respuesta (que viaje **sólo** por correo), responder `200` genérico exista o no la cuenta, y meter `/auth/request-password-reset` y `/auth/signup` bajo el mismo limitador que `/auth/token`. | el mismo dueño que I-02 (módulo `auth`); hoy sigue sin asignar |
| **N-02** | **El origen del sitio y la CSP del lienzo se hornean en el `build`**: servir el mismo artefacto desde otro origen mata la vista previa del editor **en silencio** y reparte enlaces muertos a los invitados — que es U-6 otra vez, por otra puerta. | A/B sobre el MISMO `build` (horneado con `NEXT_PUBLIC_EDITOR_ORIGIN=…:3050`): servido en `:3050` → `frames /canvas=1`, `lienzo pintado=true`; servido en `:3000` → `frames /canvas=0`, `lienzo pintado=false`, consola: `Refused to frame … because an ancestor violates … frame-ancestors`. Cabecera servida en `:3000`: `frame-ancestors http://127.0.0.1:3050`. En el mismo arranque, «Copiar enlace» y el texto de WhatsApp entregaron `http://127.0.0.1:3050/i/pub_91BJ…` mientras la clienta navegaba en `:3000`. Ninguna compuerta lo ve: Playwright y LHCI **reconstruyen** con el origen que después sirven. | Leer el origen en tiempo de petición para la CSP (variable de servidor, no `NEXT_PUBLIC_*`), poner `window.location.origin` **antes** de `NEXT_PUBLIC_SITE_URL` en `origenPublico()` (`lib/enlace-publico.ts:47`), y una aserción de arranque que compare el origen horneado con el que se escucha. | dueño del lienzo / `apps/web` |

**Las cinco altas originales — CERRADAS, con la salida que lo demuestra**

- **H-ADV-01 ✅** `POST …/document/operations` con `marks:["bold"]`, `["italic"]`, `["bold","italic"]`,
  `marks:[]` y `href` → **`200 applied=true`**, `revision 7→8`, y el `composed` devuelve las marcas
  intactas. Compuerta viva y no vacua: al quitar el caso 14 de `golden/operations/setBlock.cases.json`
  → `OperationReducerGoldenTest … FAILED (:124)`; al cambiar `["bold"]`→`["italic"]` **sólo en la
  operación** → 2 FAILED con `falta marks:["bold"] en el documento codificado`, que es una aserción
  sobre la salida de `GoldenComposition.encode` → `DomainJson.encode`. El golden **sí** pasa por el
  codificador.
- **H-ADV-02 ✅** `<h2>` del RSVP: `#FFFFFF` sobre `#B05555` = **4,91:1** (umbral 3,0; antes 2,66).
  16 títulos medidos sobre la invitación publicada: **0 incumplen**; las 10 cabeceras visibles y sus
  `<span>` en `Cormorant Garamond` (los dos en `Inter` son `visuallyHidden`). Portada medida **por
  píxeles** (texto en `transparent`, muestreo del fondo real) en 3 variantes × 2 anchos: peor 9,43:1.
  **`axe` no basta, confirmado**: `violaciones=0` con `incomplete=[color-contrast, 7 nodos]`, y ningún
  e2e afirma sobre `incomplete`. Quien cubre esto es `contraste-plantillas.test.ts` (269 pruebas),
  **saboteada dos veces y roja las dos**.
- **H-ADV-03 ✅** `e2e/lienzo-csp.spec.ts` → **3 passed**. Saboteando el `import "./canvas-runtime.ts"`
  de `common.ts` y reconstruyendo → **2 failed** con
  `[{"directive":"script-src","blockedURI":"eval","sourceFile":"…/chunks/2mgnc4w91hfv2.js"}]`: se pone
  roja ante una violación REAL del bundle servido. `zod-jitless.contract.test.ts` 3 → 2 failed con el
  mismo sabotaje. `script-src` está afirmado por igualdad con la lista de toleradas vacía.
- **H-ADV-04 ✅** `scripts/smoke.sh` → **19/19 OK · 0 fallidas · exit 0**, **dos veces seguidas**. No es
  vacua: repetí la ruta 17 con un solo asset y sigue dando `422 TPL_PACKAGE_ASSET_MISMATCH` aunque el
  paquete ya estuviera registrado.
- **H-ADV-05 ⚠ a medias** El oráculo está cerrado: 12+12 muestras, mediana **118,2 ms** (inexistente)
  vs **129,0 ms** (existente) = **1,09×**, rangos totalmente solapados (antes 22× sin solape). El
  límite por cuenta funciona: 5 fallos → `429` en el 6.º, cuerpo y tiempo constantes. **Pero** el
  límite por IP se salta rotando `X-Forwarded-For` (25 intentos → 25 `401`, ningún `429`; sin rotar,
  `429` en el 21.º), y 5 fallos dejan a la dueña legítima fuera 15 min (medido: contraseña **buena** →
  `429`). Sigue habiendo cuentas enumerables por `/auth/signup` (`400` vs `200`).

**Lo que NO hace falta volver a comprobar** (todo ejecutado; cifras en la bitácora):
las cinco altas de arriba · **I-06 por HTTP**: sin sesión `401`, otro dueño `403 TPL_FORBIDDEN`,
invitación ajena `403`, inexistente `403` (no filtra cuáles existen), inyección SQL en `date` → `422`,
clave desconocida → `400`, y **sólo la columna `date` cambia** (diff `row_to_json` de `invitation`
antes/después: `{"date": …}` y nada más) · **I-09 por HTTP en una invitación distinta**: `cover.image`
pasa de `empty` a `provenance:"default"` y `rsvp.background` (`fixed`) por fin resuelve, sin ver assets
de otra invitación (el alias se casa por `sha256` **sólo** entre filas de la versión de plantilla, y
entra con `putIfAbsent` **después** de los `public_id` reales) · **I-07/U-5**: log del backend
`caché del render público invalidada para la invitación 3 (published)`, y el invitado ve la versión
nueva a **t+0** · **recorrido de UX**: U-1, U-2, U-3, U-4, U-5, U-7 y U-8 **cerradas** (U-8: desborde
horizontal **0 px**, era 182; «Publicar» visible en `x=283` de 390), U-6 cerrada en código pero ver
N-02 · sin pruebas omitidas: **0** `@Disabled`/`@Ignore` en Kotlin, **0** `.only`, y los dos `test.skip`
de `apps/web/e2e` son guardas condicionales sobre datos sembrados.
