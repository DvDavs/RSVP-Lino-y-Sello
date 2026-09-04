# Fase 3 — estado real al pausar (2026-09-04)

**La fase 3 NO está cerrada.** Se pausó por límite de uso, no por fallo. Este archivo es lo
único que hay que leer para retomarla, más `contratos.md` y `handoffs/2-para-fase-3.md`.

Rama: `claude/fase-3-frontend-orchestration-yuh8sx`, último commit integrado `d46c163`.

## 1. Qué está HECHO, integrado y verde
- **Bloque 0 completo.** El backend arranca por primera vez en el proyecto
  (`V40__add_invitation_guest_graduates_name.sql`, ADR-3-0a-01) y las **19 rutas responden
  sobre Tomcat real, 19/19** (`scripts/smoke.sh`). Un comando levanta todo:
  `scripts/dev-backend.sh start`. Adaptador de assets local (ADR-3-0a-02) porque S3 no está
  disponible aquí.
- **Compuerta A1-A8: VIABLE, 8/8 medidos** (ADR-3-0b-01). El lienzo va en `<iframe
  sandbox="allow-scripts">` de origen opaco; la contingencia del dominio dedicado **no** se
  activa. Configuración exacta y copiable en `handoffs/3-0b.md §1`. Protocolo del lienzo en
  `packages/schema/src/canvas-protocol.ts` (+47 pruebas).
- **`apps/web`** (3-1): Next 16, tres layouts raíz, las 6 rutas, `lib/api-client.ts` con las
  19 rutas tipadas, `/api/revalidate` con el cuerpo exacto de ADR-2-6-01. Arte del chrome
  aplicado desde `diseno/arte-chrome.md`.
- **`packages/sections` cimiento** (3-2a): tokens, `ThemeProvider` (`<style nonce>` + CSSOM,
  nunca `style={{}}`), los 14 componentes de bloque, el registro con sus 12 entradas ya
  verificadas contra las plantillas reales, modo lienzo y guardas de lint.
- **Arte de plantillas** (3-2d): 28 imágenes generadas (SVG → resvg → sharp → WebP), 1,2 MB.
  **Las 5 paletas cumplen ahora AA**; `build-packages.mjs` aborta si alguna baja del umbral.
  Invitación de demostración **publicada de verdad**: `/i/pub_VRB3B3FFSS79PJ37BMZPB2WE7X`,
  12 secciones y 13 imágenes resueltas. Se resiembra con `scripts/seed-demo.sh`.

**Verificado al pausar:** `./gradlew check` exit 0 (1 186 pruebas Kotlin) y **743 pruebas TS**
(505 `schema` + 186 `sections` + 52 `web`), 0 fallos.

## 2. Qué está A MEDIAS (rescatado, NO integrado)
Los 12 componentes de sección. Dos agentes fueron detenidos en marcha y su trabajo está
preservado en ramas remotas. **No se han integrado porque la suite no se ha verificado sobre
ellos**; integrarlos a ciegas rompería la rama.

| rama | qué trae | estado al parar |
|---|---|---|
| `claude/fase-3-wip-3-2b` | portada, celebrantes, evento, galería, historia, vestimenta | sin commits propios; el WIP rescata 19 archivos sueltos. Estaba regenerando capturas |
| `claude/fase-3-wip-3-2c` | mesa de regalos, sugerencias, amenidades, RSVP, familia, pie | 6 secciones **commiteadas**; el WIP rescata 9 archivos. Estaba acabando `FooterSection` |

Para retomar: revisar cada rama, correr `pnpm --filter @invitaciones/sections test`, terminar
lo que falte, y solo entonces `git merge --no-ff`. El contrato que deben cumplir está en
`handoffs/3-2a.md`. Faltan las **24 capturas** de secciones (12 tipos × móvil y escritorio).

## 3. Qué NO se ha empezado
**El bloque 2 entero** (editor) y el cierre:
- **3-4 núcleo del editor** (Opus): store Zustand, undo/redo por operaciones, autoguardado con
  `baseRevision`/`clientBatchId`, conflicto de tres opciones, `BroadcastChannel`, lienzo con
  el protocolo v1, `:choose-template` como primer paso. `04 §9-§12`.
- **3-5 paneles y flujos** (Sonnet + revisor Opus): panel de contenido, paleta/tipografía,
  reordenar con dnd-kit accesible, imágenes con recorte y punto focal, publicar. `04 §13, §14`.
- **3-6 e2e y calidad** (Sonnet + revisor Opus): Playwright E-01…E-12, axe, LHCI. `04 §20`.
- **Cierre**: revisión de UX sin instrucciones, revisión de calidad visual, revisión
  adversarial global, `contratos.md §12`, `handoffs/3-para-fase-4.md`.

## 4. Los dos problemas ABIERTOS que necesitan decisión del dueño
1. **Presupuesto de JS incumplido.** `/i/[publicToken]` mide **165,9 KB gz** contra un tope de
   **150 KB** (`contratos §8`). Diagnosticado como **runtime base de Next 16 sin código
   propio**. 3-1 lo escaló en vez de subir el umbral, que es lo correcto, pero deja un
   criterio de aceptación sin cumplir. Salidas posibles: reducir a cero componentes de
   cliente en el render público, cambiar de estrategia de render, o subir el presupuesto por
   ADR. **No decidido.**
2. **Una plantilla no puede referenciar sus propias imágenes de demostración.** Confirmado
   ejecutándolo (3-2d): `AssetEntry` (`manifest.ts:45-50`) no tiene campo de id y
   `TemplateRegistrationService.kt:104` acuña `"as_" + ulid.next()` en el registro, así que
   `cover.image` sale `provenance:"empty"`, `missingRequired:["cover.image"]` y
   `canPublish:false`. Peor: `rsvp.background` es `fixed`, o sea **inalcanzable por cualquier
   vía** (`422 TPL_BLOCK_NOT_EDITABLE`). Parche mínimo propuesto (~11 líneas, alias en el
   `AssetIndex`, sin tocar la base de datos) en `bitacora/3-2d.md §5.4`. **Toca área
   prohibida**: exige decisión del dueño, ADR y revisor Opus.

## 5. Correcciones del dueño ya aplicadas
`bitacora/3-correcciones-dueno.md` — C-01: referencia visual `gigsalad.com`, medida por un
agente local del dueño y recogida en `diseno/arte-chrome.md`. Se adopta en el **chrome** y no
en la invitación. Cinco objeciones del orquestador, la mayor: **Garnett es comercial** y se
sustituyó por tipografías de licencia abierta vía npm (Google Fonts está bloqueado por el
proxy de este entorno).

## 6. Avisos de entorno
Sin Docker · Postgres efímero, y `dev-backend.sh stop` **borra el clúster y las plantillas
registradas** · Chromium preinstalado revisión 1194 con `@playwright/test` 1.62.1 esperando la
1234, hace falta `executablePath` · **sin acceso a bancos de imágenes ni a Google Fonts**
(proxy) · npm sí llega.
