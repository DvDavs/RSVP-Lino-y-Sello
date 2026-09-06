# 3c-5 (PARCIAL) — web pública y acceso · worktree `wt-3c/b3-5`, rama `wt/b3-5`

Corte por presupuesto de contexto, no por bloqueo. **Todo compila y lo escrito está en verde.**
Detalle: `handoffs/3c-5.md` (API completa) · `bitacora/3c-5.md` · `ADR-3C-5-01`/`-02` ·
`preguntas-abiertas.md § 3C-5` (P-3C-5-1..9). Sin commits, sin procesos vivos, `evidencia/fase-3/` intacta.

## 1. TERMINADO y verificado
Portada `/` (antes 404 en inglés): héroe `Rays` + foto máscara `seal` (placeholder
`imageId="landing-hero"`), 3 pasos, 7 tipos → `/editor?tipo=<slug>`, testimonios marcados «Ejemplo»,
planes sin precios inventados, cierre `Stripes`, cabecera y pie · `/acceso` con pestañas Entrar /
Crear cuenta (3 pasos, `WizardProgress`) y recuperación con la frase de N-01 · `/ayuda` con buscador,
acordeón `<details>` y `EmptyState` · 404 real (`app/not-found.tsx`) y error en `/acceso` y `/ayuda`.

- `test`: **57 ficheros, 435/435** (eran 388); `components/sitio` **87,62 % líneas · 80,64 % ramas · 94,64 % funciones**. `typecheck` y `lint` limpios (1 aviso ajeno, `e2e/flujo-principal.spec.ts:94`).
- `build` verde (39 páginas). `check-budget.mjs` **código 0**: `/` **148,1 KB** gz (límite 150; JS propio 20,5) · `/i/[publicToken]` 146,0 · `/editor/[invitationId]` **374,6** (era 421,7).
- Galería `/design`: **279/279**, sin regenerar ni una referencia. 10 capturas en `evidencia/fase-3c/bloque-3/3c-5/` (390 y 1440).

## 2. A MEDIAS / SIN EMPEZAR
1. **e2e con backend: NO ejecutados** (el de 6105 se paró al cortar). Escritos y compilando: `e2e/landing.spec.ts` (nuevo, 6 pruebas) y `e2e/a11y-pantallas-nuevas.spec.ts` (1 línea cambiada —`h1` de `/ayuda`— + 1 prueba nueva). `e2e/clienta-sin-sesion.spec.ts` **sin tocar**. → 3C-8.
2. **LCP de `/`: NO medido.** `scripts/measure-lcp.sh --url http://127.0.0.1:<p>/ --port <p>`.
3. **Capa de compatibilidad 3C-1b: NO se retira.** La usan **33 ficheros, 235 apariciones** (3C-6, 3C-7 y la galería); lista con cuentas en `handoffs/3c-5.md` §6. Mi área: **0**.
4. Registro y recuperación no probados contra el backend real (sí simulado: 11 casos).

## 3. Decisiones
- **Grupo nuevo `app/(chrome)/(sitio)/`** con `layout.tsx` → `<MarcoSitio>`; `/acceso` y `/ayuda`
  movidas ahí (mismas URL). La cabecera **no** va en `app/(chrome)/layout.tsx`, que envuelve también
  `/editor` (ya tiene cabecera) y `/design` (279 capturas). `ADR-3C-5-01`.
- **`app/(chrome)/layout.tsx`**: `data-theme="light"`, `robots: index`, y `RUTAS_PRECARGA` por
  **subruta** (`@invitaciones/ui/fonts/preload.ts`) — ese import del barril metía los 25 componentes
  cliente en TODAS las rutas del chrome (93,0 → 20,5 KB propios en `/`). Por eso
  `packages/ui/package.json` gana 3 subrutas ADITIVAS (`./componentes/*`, `./ilustraciones/*`,
  `./fonts/preload.ts`): **nunca importes del barril en una ruta con presupuesto**. `ADR-3C-5-02`.
- `next.config.ts`: `optimizePackageImports` (medido: cero efecto, documentado) ·
  `check-budget.mjs`: `/` entra con techo 150 KB · `playwright.config.ts`: solo un comentario ·
  `vitest.config.ts`: `components/sitio/**` en cobertura · **`globals.css` NO se tocó**.
- **`app/not-found.tsx` (nuevo)**: `app/(chrome)/not-found.tsx` solo cubre `notFound()` del grupo;
  una URL sin ruta caía en la pantalla de fábrica de Next. Pinta su propio `<html>`/`<body>`.
- **i18n** (~96 claves, cero cadenas en JSX): `sitio.*` completo · `acceso.{pestanas,pestanaEntrar,
  pestanaCrearCuenta,olvide,recuperar.*,registro.*}` · `ayuda.{buscar,buscarAyuda,resultados,
  sinResultados.*,contacto.*}` y `ayuda.titulo` → «¿En qué te ayudamos?» (`11 §7`) ·
  `errores.{noExiste,algoSalioMal}` · `comun.{marca,entrar,crearCuenta,irAlInicio,ejemplo}`.
- **`lib/api-client.ts`**: DOS funciones AÑADIDAS, ninguna cambiada — `authSignup`,
  `authRequestPasswordReset` (extremos que el backend ya servía). P8 intacto. Ver P-3C-5-4.
- **`components/sitio/` (21 ficheros)**: servidor `MarcoSitio`, `CabeceraSitio`, `PieSitio(anio?)`,
  `Seccion({id,titulo,eyebrow?,intro?,fondo?})`, `Hero`, `PasosComoFunciona`, `TiposDeEvento`
  (+`TIPOS_DE_EVENTO`), `Testimonios`, `Planes`, `CtaFinal`, `EstadoDePagina`; cliente
  `AsistenteAcceso`, `BuscadorAyuda`, `PantallaError({digest?,onReintentar})`; puros
  `traducir-errores.ts`, `dudas-ayuda.ts`.
- **Trampa del entorno**: `apps/web/public/fonts/*.woff2` NO está en git — lo copia el `build` de
  `packages/ui`. Con `pnpm --filter web run build` a secas el chrome cae en el respaldo del sistema
  en silencio y las 279 capturas fallan por reflow. Y `playwright … | tail -n` devuelve el código de
  salida de `tail`, no el de Playwright (me dio un falso verde).

## 4. Verificación
```
cd frontend && pnpm --filter @invitaciones/ui run build        # PRIMERO (fuentes)
pnpm --filter web run typecheck && pnpm --filter web run lint && pnpm --filter web run test
pnpm --filter web run build && (cd apps/web && node scripts/check-budget.mjs)
cd apps/web && PW_DESIGN_PORT=3145 pnpm exec playwright test --config=playwright.design.config.ts \
  --project=design > /tmp/design.txt 2>&1; echo $?             # 279/279, SIN tubería
node scripts/capturas-sitio.mjs --port 3105                    # con `next start` en 3105
```
