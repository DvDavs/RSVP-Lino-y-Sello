# Bitácora 3c-ux-c — correcciones del sitio: contacto para contratar y mensaje de contraseña

Fase 3-C, cierre. Worktree `/home/user/wt-3c/ux-c`, rama `wt/ux-c`. Fecha: 2026-09-06.
**Sin commits ni push** (los hace el orquestador). Notación: `[V]` verificado ejecutándolo. Este
agente es el RELEVO: el trabajo (18 ficheros) lo dejó hecho el agente anterior; lo que sigue es
verificación y cierre de memoria.

---

## 0. Resultado en una línea

Cierra G-01 (`bitacora/3c-ux.md`, `handoffs/3c-ux.md §4.1`) — "no hay forma de comprar" — con un
canal de contacto real y configurable (`ContactoParaContratar`, dos variables de entorno) puesto en
los dos sitios donde el anillo se cerraba (`/ayuda` y «Elige tu plan»), y corrige que una contraseña
que no cumple la política de registro respondiera «Algo salió mal» en vez del mensaje del servidor
(M-12 de `handoffs/3c-ux.md §3`). **Compuertas en verde con salida real**: `test` **536/536** ·
`typecheck` **0 errores** · `build` verde · `check-budget` dentro de presupuesto (`/` **148,2 KB**
gz de 150) · e2e **14/14** (`landing.spec.ts`, `a11y-pantallas-nuevas.spec.ts`,
`clienta-sin-sesion.spec.ts`) contra backend propio.

---

## 1. Qué cambió

### 1.1 Contacto para contratar (G-01)

- **`lib/contacto.ts`** (nuevo): único sitio que decide si el producto sabe cómo se contrata. Lee
  dos variables de entorno, ambas opcionales:
  - `NEXT_PUBLIC_CONTACTO_WHATSAPP` — número en E.164 (p. ej. `+5215512345678`); se normaliza, se
    valida contra el patrón E.164 (`[1-9]\d{7,14}`) y se formatea de vuelta para lectura humana
    (`+521 55 1234 5678`); el enlace es `wa.me/<dígitos>` con el mensaje ya escrito en es-MX.
  - `NEXT_PUBLIC_CONTACTO_CORREO` — dirección de correo; enlace `mailto:` con asunto ya escrito.
  - Si ninguna está configurada, `configurado: false` y la interfaz muestra la frase honesta («el
    contacto se publicará aquí en cuanto exista»), **nunca** un botón muerto ni un número inventado.
- **`components/sitio/ContactoParaContratar.tsx`** (nuevo): el componente que pinta esos canales.
  Insertado en:
  - **`components/sitio/Planes.tsx`** — la acción principal del bloque «Elige tu plan» pasa a ser
    el contacto real; «Entrar a mi cuenta» baja a salida secundaria (es el atajo de quien YA
    compró, no la única puerta).
  - **`app/(chrome)/(sitio)/ayuda/page.tsx`** — el final del circuito que `MisInvitaciones.tsx`
    señala con `/ayuda#planes` a quien no tiene ninguna invitación.
- **`components/sitio/dudas-ayuda.ts`**: la duda con `id: "planes"` (el ancla real de
  `/ayuda#planes`) pasa a ser «¿Cuánto cuesta y cómo contrato un plan?» — antes era «Una plantilla
  dice que necesita otro plan» (renombrada a `id: "cambiar-plan"`, mismo contenido). Dice sin
  rodeos que los precios no están publicados, que los planes se contratan con el equipo (no en
  línea) y que el pago en línea todavía no existe.
- **`components/sitio/BuscadorAyuda.tsx`**: ajustado para el nuevo `id` de la duda de planes.

### 1.2 Mensaje de contraseña (M-12)

- **`components/sitio/traducir-errores.ts`**: `AuthRequest` valida correo y contraseña con las
  mismas anotaciones que el alta (`@Email` + `@StrongPassword`), así que una contraseña que no
  cumple la política nunca llega a compararse: el backend responde `400` de validación, no `401` de
  credenciales, y la pantalla de «Entrar» enseñaba «Algo salió mal». Ahora un `400` con `password` o
  `email` en el cuerpo se traduce a `es_MX.acceso.credencialesInvalidas` (la política NO se repite
  en «Entrar»: eso es lo que cerró UX-N-03, `bitacora/3b-adv.md §8.1`; su sitio es «Crear cuenta»).
  En «Crear cuenta», el mensaje de contraseña ahora es **el que manda el servidor**
  (`UserRequest.password` con `@StrongPassword`, única definición viva de la regla), pasado por
  `soloTexto()` — descarta trazas, marcado y URLs; longitud 3–200 — con la frase propia solo de
  respaldo. Los otros tres campos (correo, nombre, apellidos) conservan su frase propia: los
  mensajes del backend antiguo para esos campos están mal escritos y no describen una regla
  cumplible.
- **`components/sitio/AsistenteAcceso.tsx`**: el error de registro deja de ser una cadena suelta al
  pie del formulario; lleva el `campo` (`CampoRegistro`) al que pertenece y el `Field` de ese campo
  lo pinta con `aria-invalid`/`aria-describedby` en vez de un párrafo genérico.

### 1.3 Capturas de evidencia

`docs/rediseno-plantillas/evidencia/fase-3c/cierre/ux-fix/` — 11 PNG (`c-planes-*`,
`c-ayuda-planes-*` con y sin contacto configurado, `c-acceso-contrasena-*`,
`c-acceso-entrar-contrasena-390.png`) en 390 y 1440 px, ya generadas por el agente anterior; no hizo
falta regenerarlas. Borrados los dos scripts temporales que las generaron
(`frontend/apps/web/capturas-entrar-tmp.mjs`, `capturas-uxc-tmp.mjs`) — no aportan nada fuera de la
corrida que ya dejaron hecha.

---

## 2. Verificación (este agente)

| Compuerta | Resultado |
|---|---|
| `pnpm --filter web run test` | **536/536** (65 archivos), cobertura 77,5 % sentencias |
| `pnpm --filter web run typecheck` | **0 errores** |
| `pnpm run build` (desde `frontend/`) | verde, `next build` con Turbopack |
| `node apps/web/scripts/check-budget.mjs` | dentro de presupuesto: `/` **148,2 KB** gz (límite 150), `/i/[publicToken]` 142,0 KB, `/editor/[invitationId]` 418,3 KB (límite 600) |
| e2e `landing.spec.ts` + `a11y-pantallas-nuevas.spec.ts` + `clienta-sin-sesion.spec.ts` | **14/14** en verde, backend propio `127.0.0.1:6115` / `invitaciones_uxc` |

**Trampa encontrada**: `scripts/seed-demo.sh` no lee `TPL_DEV_PORT` — lee `TPL_DEV_BASE`
(por defecto `http://127.0.0.1:6003`). Con `TPL_DEV_PORT=6115` a secas apunta al puerto viejo y
falla con «el backend no responde». Hace falta `TPL_DEV_BASE=http://127.0.0.1:6115` explícito.

**Trampa encontrada (2)**: los tres e2e también necesitan `TPL_TEST_STATE_DIR=/tmp/pg-uxc` en el
propio comando `playwright test` (no solo al arrancar el backend) — `e2e/preparar.ts:19` lee esa
variable para encontrar el `state.env` del clúster efímero y hace `psql` directo contra Postgres
para sembrar datos que no tienen ruta HTTP. Sin ella, caía al valor por defecto
(`/tmp/templates2-pg`, inexistente en esta corrida) y dos specs fallaban con `ENOENT`. Con la
variable puesta, las mismas dos pasan sin tocar código.

El `webServer` de Playwright reescribió las 8 capturas de `evidencia/fase-3/ux-corregido/` (efecto
colateral conocido de correr los e2e contra un build real) — revertidas con `git checkout --`.

Backend, clúster Postgres y `next start` de Playwright parados por PID
(`scripts/dev-backend.sh stop` con las mismas variables); sin `pkill -f`. Verificado sin procesos
en 3115/6115 tras el `stop`.

---

## 3. Lo que sigue sin decidir (dueño del producto)

El código ya no inventa un teléfono ni un correo — mientras las dos variables de entorno no estén
configuradas en el entorno real, el sitio dice la verdad honesta en vez de mentir con un contacto
falso o mandar a un anillo cerrado. Pero **el WhatsApp y el correo reales, y si el producto quiere
compra en línea en vez de (o además de) venta asistida, siguen sin decidirse** — pregunta
registrada en `preguntas-abiertas.md § Fase 3-C · UX-C`.
