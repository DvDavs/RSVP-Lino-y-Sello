# 5-0 cimientos → E2, E3, E4, E5 y E6 · lo que hay y dónde escribe cada quien

Sesión E1 de la fase 5. Rama `claude/fase-5-cimientos-adenda-u150eq`, desde `origin/claude/fase-5-producto`.
**Tu rama nace del commit de cimientos**, no de antes.

## 1. Lo primero que tienes que leer, en este orden
1. `diseno/12-producto-completo.md` **§0** — las decisiones ya tomadas. No se reabren.
2. La parte de ese documento que te toca: **E2** → A2.2, A2.3, A4, B3.1, B3.2 · **E3** → A2.1, A6,
   B3.7–B3.9 · **E4** → A2.4, A5, B3.3–B3.5, B4 · **E5** → A2.5, A3, B3.6.
3. El `README.md` de **tu** carpeta de ruta: dice qué pantalla va ahí, qué endpoint consume y qué
   ficheros puedes y no puedes tocar.
4. El skill que aplique (`ui-pantalla`, `ui-formulario`, `ui-componente`, `ui-flujo-asistente`,
   `ui-icono`) y **siempre** `pruebas-producto`.

## 2. Territorio: dónde escribe cada sesión

| | Frontend | Backend | Siembra | Navegación |
|---|---|---|---|---|
| **E2** invitados, RSVP, compartir | `app/(chrome)/editor/[invitationId]/invitados/**`, `app/(public)/r/[token]/**` | `modules/product/guests/**` | `scripts/seed/invitados.sh` | `lib/panel/nav.invitados.ts`, `nav.compartir.ts` |
| **E3** cuenta, marca, legal | `app/(chrome)/perfil/**`, `app/(chrome)/(sitio)/{contacto,legal}/**`, `lib/contacto.ts`, `lib/env.ts`, `robots.ts`/`sitemap.ts` (los crea) | `modules/product/account/**` | `scripts/seed/cuenta.sh` | — |
| **E4** pagos | `app/(chrome)/(sitio)/{precios,pago}/**`, `app/(chrome)/editor/[invitationId]/plan/**` | `modules/product/payments/**` | `scripts/seed/plan.sh` | `lib/panel/nav.plan.ts` |
| **E5** admin | `app/(chrome)/admin/**` | `modules/product/admin/**` | `scripts/seed/admin.sh` | — (`/admin` no va en la barra de la clienta) |

**Compartido que NADIE edita**: `lib/panel/nav.ts`, `lib/panel/tipos.ts`, `lib/panel/Marcador.tsx`,
`scripts/seed/comun.sh`, `scripts/seed-demo.sh`, `application.yml` (ya tiene su bloque `producto.*`).
**Solo se añade al final, nunca se reescribe**: `decisiones.md`, `preguntas-abiertas.md`, `tablero.md`.
**Solo E6**: `contratos.md` y `00-INDICE.md`.

## 3. Lo que NADIE de la fase 5 toca
- `.github/workflows/**`, `e2e/preparar.ts`, `e2e/a11y-publico.spec.ts`, `e2e/editor-3c-evidencia.spec.ts` — los cierra la sesión del CI.
- `public/imagenes/**`, `components/asistente/tipos-de-evento.ts`, `imagenes-pendientes.md` — rama de las imágenes.
- `frontend/templates/**`, `packages/template-kit/**`, `packages/migration-legacy/**`, metadatos de `packages/sections` — fase 4.
- `modules/user/invitations`, `modules/master/templates`, `MongoDataInitializer` — **prohibidos**, se retiran en la fase 7 (`ADR-5-0C-01`).

## 4. Para E6, la sesión de integración: las tres ramas que hay que mergear
1. **CI verde: `claude/ci-github-actions-jobs-9qyd9z`**, head `c4326e5`, corrida 34054050395.
   **NO es `claude/ci-github-actions`**, que solo tiene el prompt. Ahí se está cerrando además
   I-CI-01 y añadiendo `claude/fase-5-producto` a los disparadores.
2. **Imágenes: `claude/decisiones-dueno`** — las 9 imágenes (portada + 8 tipos de evento) integradas
   sin pruebas ejecutadas. Al mergear, corre `pnpm --filter web test`: **arregla el rojo de
   `components/sitio/portada.test.tsx`**, que existe desde `bfdcbaa` y no es de ninguna sesión de la fase 5.
3. **Fase 4: `claude/fase-4-kit-de-autor`** — 12 paquetes de plantilla, `template-kit`,
   `migration-legacy` y metadatos de `packages/sections`.

Merge en ese orden, con `--no-ff`, conservando ambas partes en los conflictos de memoria, y suite
completa tras cada uno.

## 5. Regla dura de toda la fase 5 (ADR-5-E1-03)
**Cada spec e2e nuevo crea su propia invitación, y su propio usuario si hace falta. Ninguno usa la
invitación sembrada compartida. `fullyParallel` con 4 workers tiene que pasar.** Un spec que solo
pase con `--workers=1` no se integra. Es la lección de I-CI-01.
El patrón está en el skill `pruebas-producto §4`; para roles e invitados, `scripts/seed/<area>.sh`
(README en `scripts/seed/README.md`). Verificado: 4 corridas simultáneas → 4 invitaciones distintas.

## 6. Lo que ya funciona y puedes dar por hecho
- **9 rutas** con marcador y README, en su grupo correcto y con el `noindex` que les toca.
- **Registro de navegación** compuesto por área, con orden determinista y prueba que cae si dos
  áreas chocan de id.
- **`lib/env.ts`**: catálogo del frontend. Reutiliza `NEXT_PUBLIC_SITE_URL` y `lib/contacto.ts`; no
  inventes variables nuevas de origen ni de contacto.
- **`modules/product/{account,guests,payments,admin}`** con salud y prueba por subpaquete (12/12).
  Responden `401` sin token: `SecurityConfig` cierra por defecto.
- **`application.yml`** con el bloque `producto.*` y placeholders `${VAR:}` para Stripe, correo y
  contacto. Ni un valor en claro. `FRONTEND_URL` se reutiliza para las URLs de retorno y los correos.
- **Variables nuevas**: frontend `NEXT_PUBLIC_SOPORTE_CORREO`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`;
  backend `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MONEDA`, `MAIL_FROM`,
  `MAIL_FROM_NOMBRE`, `MAIL_RESPONDER_A`, `CONTACTO_CORREO`, `CONTACTO_WHATSAPP`, `SOPORTE_CORREO`.

## 7. Tres cosas que te van a morder (verificadas contra el backend real)
1. **Una clienta NO puede dar de alta a sus propios invitados.** `403` con token de USER:
   `/admin/**` es de ADMIN y MASTER (`SecurityConfig.kt:42`) y la gemela para USER está en el módulo
   prohibido. **E2** construye esa superficie en `modules/product/guests`.
2. **El teléfono del registro es `+52` + 10 dígitos** (`Patterns.kt:56`), y el mensaje de error omite
   el prefijo. Es único por cuenta y lo dice, que es un oráculo de enumeración. **E3** lo arregla.
3. **La puerta de publicación tiene una consecuencia sin implementar**: si editar es gratis, la
   invitación tiene que poder nacer sin pagar, y hoy la única alta es `POST /admin/invitations/create`
   con rol ADMIN. Sin una alta para USER, «editar gratis» no existe. Ciérralo antes de construir sobre ello.

## 8. Estado medido en el commit de cimientos
`typecheck` 6/6 · `web test` **598 pasan** (566 antes) · `build` con las 9 rutas · Kotlin
`*product*` **12/12** · los 4 sembradores en 0.
**Rojo conocido y ajeno:** `components/sitio/portada.test.tsx`, desde `bfdcbaa`. Lo cierra E6 con el
merge de las imágenes.
