# 04 — Arquitectura del frontend y del editor

Autor: fase 1, rol `1-frontend`. Estado: propuesto para aceptación (ADR-017…019).
Evidencia: `handoffs/0-resumen-auditoria-frontend.md`, `handoffs/1-aura-lecciones.md`, `docs/analisis-plantillas/anexos/aura-build-analisis-frontend-2026-09-03.md`, `01-dominio-y-esquema.md` (esquema), `03-api.md` (contratos HTTP).

---

## 1. Estructura del monorepo (ADR-017)

```
frontend/
├── package.json                    # workspaces: packages/*, apps/*
├── pnpm-workspace.yaml
├── turbo.json
├── packages/
│   ├── schema/                     # copiado de diseno/esquema/*.ts (fase 3), Zod 4 fuente única
│   │   ├── src/{common,blocks,manifest,document,operations,composed,invariants}.ts
│   │   └── scripts/emit-json-schema.ts
│   └── sections/                   # componentes de sección + bloque, mismo código en editor y público
│       ├── src/sections/{Cover,Celebrant,Event,Gallery,GiftTable,Suggestions,Amenities,Rsvp,Family,Story,DressCode,Footer}.tsx
│       ├── src/blocks/{TextBlock,RichTextBlock,ListTextBlock,ImageBlock,AudioBlock,DateBlock,TimeBlock,DateTimeRangeBlock,LinkBlock,LocationBlock,ChoiceBlock,BooleanBlock,PersonBlock,GroupBlock}.tsx
│       ├── src/theme/ThemeProvider.tsx      # aplica tokens de `ResolvedTheme` como CSS custom properties
│       └── src/canvas/CanvasContext.tsx      # contexto opcional de selección/edición (§3)
└── apps/
    └── web/                         # Next.js App Router — UNA sola app (ADR-017)
        ├── app/editor/[invitationId]/page.tsx      # chrome del editor (autenticado)
        ├── app/editor/[invitationId]/canvas/page.tsx  # lienzo servido DENTRO del iframe (§3)
        ├── app/i/[publicToken]/page.tsx             # render público (SSR/ISR, sin JS de edición)
        └── lib/{api-client.ts, store.ts, undo.ts}    # ADR-019
```

`packages/sections` es el corazón de "un editor simple sin CSS": el cliente nunca ve ni toca estas componentes directamente, solo el formulario del panel lateral (§3). Los mismos componentes renderizan `/editor/.../canvas` (dentro del iframe) y `/i/[publicToken]` (público) — garantiza que "lo que ves en el editor es lo que ve el invitado" sin mantener dos implementaciones.

## 2. Modelo de interacción del editor (P7)

El editor **no es WYSIWYG por edición directa del DOM** (anti-patrón confirmado en aura.build, `handoffs/1-aura-lecciones.md`, "DOM + clases Tailwind como documento editable"). Es un editor de **dos paneles sincronizados**:

- **Lienzo** (centro/derecha): el `ComposedDocument` renderizado tal cual se vería públicamente, dentro de un `<iframe>` aislado (§3). Solo permite *seleccionar* (clic en un bloque) y ver en vivo el resultado de una edición hecha en el panel — nunca editar texto directamente sobre el iframe.
- **Panel lateral** (izquierda): lista de secciones (mostrar/ocultar con un switch, reordenar con `dnd-kit`, cambiar `variant` con un selector de miniaturas) y, cuando hay un bloque seleccionado, un formulario (`react-hook-form` + resolver Zod del `BlockSpec` correspondiente) con los campos curados: texto plano/enriquecido con límites visibles, selector de imagen con recorte básico, selector de paleta/tipografía (grid de swatches, nunca un color picker libre — P7), fecha/hora con date picker, `choice` como radio/select de las `options` declaradas.

### 2.1 Flujos de usuario (texto)

**Flujo A — Elegir plantilla → editar → publicar → ver como invitado.**
1. El cliente entra a `/editor` sin invitación aún compuesta → catálogo de plantillas filtrado por `eventKind` de su invitación y `minPlanTier` de su plan (miniaturas = `previewImage` del manifiesto). Elige una → `POST .../document:choose-template` → redirige a `/editor/{invitationId}`.
2. El lienzo carga con `defaults.json` ya resuelto (todo en `provenance: default/fixed/business`, `03 §3.2`). El panel lateral resalta con un badge "contenido de ejemplo" cada bloque en `default` (misma señal visual que usa `report.stillDefault`).
3. El cliente hace clic en un bloque del lienzo (p. ej. el título de portada) → el panel abre el campo correspondiente, foco automático. Escribe → autoguardado debounced 2s (ADR-019) → el lienzo se actualiza optimistamente de inmediato (sin esperar la red).
4. Repite para fotos (arrastra o selecciona archivo → sube vía `POST .../assets` → `setBlock` con el `assetId` devuelto), paleta (grid de swatches del `theme.json` de la plantilla → `setTheme`), secciones (oculta "Nuestra historia" con un switch → `setSectionVisible`).
5. Antes de publicar, un banner de preflight (`GET .../release/preflight`) lista cualquier bloque obligatorio que siga en contenido de ejemplo — el cliente lo edita o confirma explícitamente "publicar con este placeholder" solo si el bloque NO es obligatorio (los obligatorios bloquean, `03 §6`).
6. "Publicar" → `POST .../release` → modal con el enlace público (`/i/{publicToken}`) y botón "Ver como invitado", que abre esa URL en una pestaña nueva — SSR puro, sin chrome de editor.

**Flujo B — Deshacer.** Ctrl+Z (o botón) revierte la última operación aplicada localmente (pila de ADR-019) y actualiza el lienzo al instante; el autoguardado siguiente envía la operación inversa como parte del próximo lote — el servidor nunca ve "deshacer" como concepto, solo operaciones nuevas (mismo reductor, ADR-014).

**Flujo C — Cambiar de plantilla a mitad de edición.** El cliente vuelve al catálogo y elige otra plantilla → confirmación explícita ("tu contenido actual se guardará, pero tendrás que revisarlo en la plantilla nueva") → `POST .../document:choose-template` mueve todo el `content` actual a `attic` (ADR-006/023) y arranca contenido nuevo desde los defaults de la plantilla elegida. El panel muestra un banner "tenías contenido de una plantilla anterior, revísalo aquí" con un enlace a un visor de solo lectura del `attic` (no hay recuperación automática campo a campo entre plantillas distintas — los roles pueden no coincidir 1:1, y forzarlo reintroduciría el emparejamiento implícito que causó H-01/H-02). Mitigación del hallazgo adversarial E-05 (`attic` sin retención, crecimiento no acotado si el cliente cambia de plantilla muchas veces): a partir de la quinta entrada en `attic`, el banner añade "tu historial de plantillas anteriores está creciendo, ¿quieres archivarlo?" — sin borrado automático (ADR-006 se mantiene intacto: nunca se borra sin acción explícita del cliente).

**Flujo D — Vista móvil/escritorio.** Un toggle en el chrome cambia el ancho del `<iframe>` (390px / 100%) vía mensaje `SET_VIEWPORT` (§3); las secciones de `packages/sections` son responsive por CSS (`clamp()`/`grid`), sin lógica de breakpoints expuesta al usuario (mata el anti-patrón "breakpoints manuales" de aura.build).

## 3. Lienzo como iframe aislado con `postMessage` tipado (ADR-018)

`app/editor/[invitationId]/canvas/page.tsx` es una ruta Next.js aparte, sin el chrome del editor, que solo renderiza `<CanvasApp/>` (de `packages/sections`) dentro de un `CanvasContext` que agrega overlays de selección. El chrome (`app/editor/[invitationId]/page.tsx`) la incrusta en un `<iframe src="/editor/{id}/canvas" sandbox="allow-scripts">` — **sin** `allow-same-origin` (ADR-031, cierra el hallazgo adversarial S-03: combinar `allow-scripts` con `allow-same-origin` es un patrón conocido de sandbox-bypass, y el diseño ya se comunica exclusivamente por `postMessage` — §3 tabla de mensajes — sin necesitar acceso DOM cross-frame, así que `allow-same-origin` no aportaba nada funcional y sí debilitaba la contención ante una futura vulnerabilidad de renderizado, p. ej. en `richText`, §6). Si algún mecanismo interno de Next.js dentro del iframe resultara depender de same-origin, es señal de que la arquitectura de canvas necesita revisarse en fase 3, no de restaurar el flag débilmente. Mensajes tipados (`packages/schema` los exporta junto al resto, no son parte de `InvitationDocument` sino de la superficie de la app):

| Dirección | Tipo | Payload | Uso |
|---|---|---|---|
| padre→iframe | `CANVAS_READY_ACK` | — | responde al primer `READY` del iframe |
| padre→iframe | `RENDER` | `{composed: ComposedDocument}` | cada vez que cambia el estado local (optimista o confirmado por el servidor) |
| padre→iframe | `HIGHLIGHT_BLOCK` | `{blockId, itemId?}` | resalta el bloque activo del panel, aunque el clic haya iniciado en el panel, no en el lienzo |
| padre→iframe | `SET_VIEWPORT` | `{width: "mobile" \| "desktop"}` | flujo D |
| iframe→padre | `READY` | — | primer mensaje, dispara `CANVAS_READY_ACK` + primer `RENDER` |
| iframe→padre | `BLOCK_CLICKED` | `{blockId, sectionKey, itemId?}` | abre el campo correspondiente en el panel (flujo A.3) |
| iframe→padre | `SECTION_IN_VIEW` | `{sectionKey}` | sincroniza qué sección resalta la lista del panel al hacer scroll dentro del lienzo |

El iframe **nunca** recibe el token de autenticación, ni llama a `03-api.md` directamente, ni recibe nada de `BusinessSnapshot` sin resolver — solo el `ComposedDocument` ya compuesto por el padre (que sí llamó a la API). Esto es exactamente la lección de aura.build (`handoffs/1-aura-lecciones.md` #2): preview aislado, comunicado por mensajes tipados, nunca por acceso directo al estado del otro proceso. `origin` del mensaje se valida en ambos lados (`event.origin === window.location.origin`, misma app, mismo dominio, solo aislamiento de árbol de render — no es un iframe de terceros).

## 4. Estado, undo y autoguardado (ADR-019)

Store Zustand (`apps/web/lib/store.ts`) con slices `{document, composed, report, revision, selection, pendingOps, undoStack, redoStack}`. Cada acción del panel (`setBlock`, `toggleSection`, etc.) hace tres cosas en el mismo tick: (a) aplica un parche optimista a `composed` en memoria (splice directo del nuevo valor resuelto, sin recomponer todo — solo válido para escalares; una `Operation` que afecta estructura/tema sí recompone localmente la sección afectada con los datos ya cargados), (b) empuja la `Operation` a `pendingOps` y su inversa a `undoStack`, (c) programa el autoguardado (debounce 2s, cancela y reprograma con cada tecla dentro de un mismo campo de texto — el debounce es lo que convierte "cada carácter" en "una acción" para el undo semántico). Al vencer el debounce, `pendingOps` se envía como un `OperationBatch` (`03 §3.3`); la respuesta reemplaza `composed`/`report`/`revision` con la versión autoritativa del servidor (reconcilia cualquier diferencia entre el parche optimista y la resolución real, p. ej. un `stillDefault` que cambió).

Un fallo de red reintenta con backoff exponencial (máx. 3 intentos) manteniendo `pendingOps`; si los 3 fallan, el chrome muestra "sin guardar — reintentando" y seguirá intentando en segundo plano sin bloquear la edición (el cliente puede seguir escribiendo; los lotes se acumulan hasta 50 operaciones, límite del esquema, momento en el que se fuerza un intento síncrono con feedback visible).

## 5. Render público

`app/i/[publicToken]/page.tsx` es un React Server Component: `fetch('.../public/i/{token}/render', {next: {revalidate: 300}})` (ISR, coincide con el `Cache-Control` de `03 §7`), pasa `composed`+`theme` a `packages/sections` SIN `CanvasContext` (sin overlays de selección, sin listeners de `postMessage`). Cero JavaScript de edición llega al invitado; el único JS del lado cliente en esta ruta es el existente del módulo de RSVP (fuera de alcance, se integra como isla de hidratación aparte si ya lo requiere).

## 6. Accesibilidad

Cada componente de `packages/sections` usa landmarks semánticos (`<section aria-labelledby>`, encabezados jerárquicos por nivel de sección, no por tamaño visual), `alt` obligatorio en todo `ImageBlock` (el `BlockSpec` de tipo `image` ya exige `alt` no vacío en `content`, `01 §3.2` — el editor no permite guardar una imagen sin texto alternativo salvo que el bloque sea puramente decorativo, `role: "decorative"`, en cuyo caso se renderiza con `alt=""` y `aria-hidden`). El *chrome* del editor (shadcn/ui) hereda su accesibilidad de Radix; estados de foco visibles en todo control interactivo. Contraste de paletas: el kit de autor de fase 4 valida `ink`/`bg` y `accentInk`/`accent` ≥ 4.5:1 (WCAG AA) antes de aceptar un `theme.json` — **requisito que este diseño deja anotado para el kit, no lo implementa aquí** (fuera del alcance de fase 1). `axe-core` corre en CI contra el render público de los dos ejemplos (`06-pruebas-y-calidad.md` §3) y contra el editor.

**Restricción de implementación contra XSS vía `richText` (cierra el hallazgo adversarial S-07, baja severidad).** `RichTextBlock` (`packages/sections/src/blocks/RichTextBlock.tsx`) mapea los nodos de `RichDoc` (`esquema/blocks.ts`: `RichSpan`/`RichParagraph`/`RichDoc`, marcas cerradas `bold`/`italic`, sin HTML libre) a elementos React directamente (`<strong>`, `<em>`, `<a href>` con la misma validación `HttpUrl` del resto del esquema) — **nunca** serializar a una cadena HTML ni usar `dangerouslySetInnerHTML`. El esquema ya está diseñado para que esto sea natural (no hay ningún campo de tipo HTML libre en todo el catálogo de bloques, `01 §3.2`); esta frase lo deja como restricción explícita para que fase 3 no lo reintroduzca por comodidad al implementar el editor de texto enriquecido (`contratos.md` §2 menciona Tiptap como candidato — su salida a HTML, si se usa, debe convertirse a `RichDoc` en el borde, nunca persistirse ni renderizarse como HTML crudo).

## 7. Rendimiento objetivo (Core Web Vitals, render público, móvil)

| Métrica | Objetivo | Cómo |
|---|---|---|
| LCP | < 2.5 s | Imagen de portada con `priority`/`fetchpriority=high`, `next/image` con `sizes` responsive contra el CDN de assets, fuentes con `font-display: swap` |
| CLS | < 0.1 | Dimensiones reservadas (`aspect-ratio` del `ImageSpec.constraints.aspect`, ya declarado en el manifiesto — se traduce a CSS sin medir en runtime) |
| INP | < 200 ms | Render público sin JS de edición (§5); único JS es RSVP (fuera de alcance) |
| Payload HTML inicial | objetivo ≤ 150 KB gzip para una invitación de 12 secciones con 1 foto por bloque de imagen visible above-the-fold | Server Components, sin hidratar `packages/sections` completo si no hay interactividad (evaluar `"use client"` mínimo, solo en RSVP) |

El editor (`/editor/...`) no tiene presupuesto de Core Web Vitals estricto (es una herramienta interna autenticada, no una página de conversión pública) pero sí un objetivo de usabilidad: tiempo hasta interactivo del lienzo < 3 s con conexión de referencia 4G.

## 8. Lo que no pude determinar

- Si el editor debe soportar edición desde móvil del propio cliente (no solo vista previa móvil de la invitación) — el brief no lo especifica; **supuesto tomado**: el editor en sí se diseña desktop-first (formularios, drag-and-drop de secciones), la vista previa móvil es solo un modo de visualización del lienzo, no un modo de edición táctil optimizado. Registrado en `preguntas-abiertas.md`.
- Mecanismo exacto de recorte de imagen ("recorte básico" del objetivo 5 de la sección 1 del prompt maestro) — no hay evidencia de qué biblioteca usar; se deja como decisión de fase 3 (candidatas: `react-image-crop`, recorte nativo vía `<canvas>`), no bloquea el contrato de datos (`ImageValue.focal` ya captura el punto focal independientemente de la herramienta de recorte elegida).
