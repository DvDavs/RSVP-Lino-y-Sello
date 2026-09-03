# 04 — Arquitectura del frontend y del editor

Autor original: fase 1, rol `1-frontend` (ADR-017…019, ADR-031).
**Revisión independiente y profundización: ronda 1R, rol `1R-frontend` (2026-09-03).** Estado: propuesto para aceptación (ADR-017…019, ADR-031 vigentes + ADR-1R-F-01…09 propuestas al final de `memoria/decisiones.md`).
Evidencia: `handoffs/0-resumen-auditoria-frontend.md`, `handoffs/1-aura-lecciones.md`, `docs/analisis-plantillas/anexos/aura-build-analisis-frontend-2026-09-03.md` (§1, §3, §8, "Stack tecnológico detectado"), `docs/analisis-plantillas/investigacion-editor-y-tecnologias.md` §2.4/§3/§4, `01-dominio-y-esquema.md` (esquema y reglas R1-R9), `03-api.md` (contratos HTTP), `06-pruebas-y-calidad.md` (umbrales), `esquema/{common,blocks,manifest,document,operations,composed}.ts`.

**Convención de evidencia usada en todo el documento:** `[V]` verificado en esta sesión (archivo del repo leído, o salida real de `npm view`); `[I]` inferido de la especificación web / del comportamiento documentado de una biblioteca, sin ejecución que lo confirme aquí; `[ND]` no determinable con la información disponible (queda en §22 y en `preguntas-abiertas.md`).

**Corrección de precedente (obligatoria, `handoffs/1-aura-lecciones.md`, "Para los verificadores adversariales"):** aura.build **no** es precedente de *stack*. El anexo primario confirma React 18.3.1 + React Router 6.30.3 + Vite, **no Next.js** [V: anexo, tabla "Stack tecnológico detectado"]. De aura.build se adopta únicamente el *patrón* de preview aislado por `postMessage` (anexo §3) y el de publicación como artefactos precompilados (anexo §8). Ninguna afirmación de este documento se apoya en aura.build para justificar Next.js; Next.js viene de `investigacion-editor-y-tecnologias.md` §4.1/§4.4 y del prompt maestro §7.

---

## 1. Alcance de este documento

Este documento debe permitir que un agente de fase 3 implemente el frontend **sin volver a diseñar nada**: árbol de archivos, `package.json` por paquete, contratos de componente, protocolo de mensajes, forma del store, pseudocódigo de undo y autoguardado, wireframes, flujos con sus estados de error y carga, presupuestos con su forma de medición, y escenarios de prueba nombrados.

Fuera de alcance: RSVP, invitados, notificaciones, auth, pagos y el panel de administración (prompt maestro §1). El módulo de RSVP se integra en el render público como **isla** aislada (§15.6), no se rediseña aquí.

---

## 2. Estructura exacta del monorepo `frontend/` (ADR-017)

`contratos.md` §1 fija tres paquetes: `packages/schema`, `packages/sections`, `apps/web`. Este documento no añade paquetes nuevos (hacerlo contradiría el contrato vigente); la capa de tokens de invitación vive **dentro** de `packages/sections` (§5.4).

```
frontend/
├── package.json                     # raíz privada; workspaces vía pnpm-workspace.yaml
├── pnpm-workspace.yaml              # packages: ["packages/*", "apps/*"]
├── pnpm-lock.yaml                   # commiteado; CI usa --frozen-lockfile (06 §7)
├── turbo.json                       # pipeline: build, test, lint, typecheck, schema:emit
├── tsconfig.base.json               # "strict": true, "noUncheckedIndexedAccess": true, moduleResolution "bundler"
├── .npmrc                           # engine-strict=true; node-linker=isolated (por defecto de pnpm)
├── eslint.config.mjs                # flat config raíz (ESLint 10); reglas duras de §19 y de ADR-005
│
├── packages/
│   ├── schema/
│   │   ├── package.json             # name "@invitaciones/schema", type "module", exports "." y "./canvas"
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── common.ts            # copia literal de diseno/esquema/common.ts (fase 3 la mueve, no la reescribe)
│   │   │   ├── blocks.ts            #   idem diseno/esquema/blocks.ts
│   │   │   ├── manifest.ts          #   idem diseno/esquema/manifest.ts
│   │   │   ├── document.ts          #   idem diseno/esquema/document.ts
│   │   │   ├── operations.ts        #   idem diseno/esquema/operations.ts
│   │   │   ├── composed.ts          #   idem diseno/esquema/composed.ts
│   │   │   ├── invariants.ts        #   idem diseno/esquema/invariants.ts (I-01…I-23)
│   │   │   ├── canvas-protocol.ts   # NUEVO (§9): mensajes padre↔lienzo. Entrypoint separado "./canvas"
│   │   │   └── index.ts             # reexporta todo MENOS canvas-protocol
│   │   ├── scripts/
│   │   │   └── emit-json-schema.ts  # ADR-004; recorre SOLO el registro de index.ts, nunca ./canvas
│   │   ├── golden/
│   │   │   ├── invariants/I-01..I-23.json      # tabla de casos compartida con Kotlin (06 §4)
│   │   │   └── <slug>-<version>/{template,defaults,theme,documento,compuesto}.json
│   │   └── generated/
│   │       ├── templates2.schema.json          # commiteado; CI compara con git diff --exit-code (ADR-004)
│   │       └── section-variants.json           # NUEVO (§5.2): variantes que sabe pintar cada tipo de sección
│   │
│   └── sections/
│       ├── package.json             # name "@invitaciones/sections"; SIN dependencia de tailwindcss (§19)
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts                         # exporta sectionRegistry, SectionsRoot, tipos públicos
│       │   ├── registry.ts                      # sectionRegistry (§5.2) — la única tabla de despacho
│       │   ├── SectionsRoot.tsx                 # recorre composed.sections y despacha por registry
│       │   ├── theme/
│       │   │   ├── ThemeProvider.tsx            # ResolvedTheme → custom properties --inv-*
│       │   │   ├── tokens.css                   # nombres y valores de reserva de --inv-*
│       │   │   ├── fonts.ts                     # allowlist de familias `source:"google"` (§5.5)
│       │   │   └── contrast.ts                  # ratio WCAG 2.x; usado por la prueba de §17.1
│       │   ├── canvas/
│       │   │   ├── CanvasContext.tsx            # modo "canvas": selección, overlays, medición
│       │   │   └── SelectionOverlay.tsx         # marco + etiqueta del bloque activo (solo modo canvas)
│       │   ├── sections/
│       │   │   ├── CoverSection.tsx             ├── CelebrantSection.tsx
│       │   │   ├── EventSection.tsx             ├── GallerySection.tsx
│       │   │   ├── GiftTableSection.tsx         ├── SuggestionsSection.tsx
│       │   │   ├── AmenitiesSection.tsx         ├── RsvpSection.tsx
│       │   │   ├── FamilySection.tsx            ├── StorySection.tsx
│       │   │   ├── DressCodeSection.tsx         └── FooterSection.tsx
│       │   ├── blocks/
│       │   │   ├── TextBlock.tsx                ├── RichTextBlock.tsx
│       │   │   ├── ListTextBlock.tsx            ├── ImageBlock.tsx
│       │   │   ├── AudioBlock.tsx               ├── DateBlock.tsx
│       │   │   ├── TimeBlock.tsx                ├── DateTimeRangeBlock.tsx
│       │   │   ├── LinkBlock.tsx                ├── LocationBlock.tsx
│       │   │   ├── ChoiceBlock.tsx              ├── BooleanBlock.tsx
│       │   │   ├── PersonBlock.tsx              └── GroupBlock.tsx
│       │   └── styles/                          # un .module.css por sección; solo var(--inv-*)
│       └── test/                                # *.test.tsx (Vitest + Testing Library)
│
└── apps/
    └── web/
        ├── package.json             # name "web" (06 §7 usa `pnpm --filter web`)
        ├── next.config.ts           # headers() de §8.4, images.remotePatterns, no `crossOrigin`
        ├── postcss.config.mjs       # @tailwindcss/postcss — SOLO para el chrome (§19)
        ├── playwright.config.ts     # PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers (contratos.md §7)
        ├── vitest.config.ts
        ├── app/
        │   ├── layout.tsx                          # <html lang="es-MX">; sin CSS de sección
        │   ├── globals.css                         # @import "tailwindcss"  ← chrome únicamente
        │   ├── editor/
        │   │   ├── page.tsx                        # catálogo de plantillas (§7.1)
        │   │   └── [invitationId]/
        │   │       ├── layout.tsx                  # carga documento + provider del store
        │   │       ├── page.tsx                    # chrome de dos paneles (§6)
        │   │       ├── loading.tsx  ├── error.tsx  ├── not-found.tsx
        │   │       └── canvas/
        │   │           ├── layout.tsx              # layout MÍNIMO: sin globals.css del chrome
        │   │           └── page.tsx                # documento del iframe (§8)
        │   ├── preview/[invitationId]/page.tsx     # previsualización autenticada sin chrome (§15.5)
        │   ├── i/[publicToken]/
        │   │   ├── page.tsx                        # render público (§15)
        │   │   ├── opengraph-image.tsx             # imagen de vista previa para WhatsApp (§15.4)
        │   │   └── not-found.tsx
        │   └── api/
        │       └── revalidate/route.ts             # webhook de publicación (§15.2)
        ├── components/                             # chrome del editor (shadcn/ui + Tailwind)
        │   ├── editor/{SectionList,SectionRow,BlockForm,ThemePicker,PhotoManager,PublishDialog,
        │   │           SaveIndicator,UndoRedoBar,ViewportToggle,CanvasFrame,ConflictDialog}.tsx
        │   ├── fields/{TextField,RichTextField,ListTextField,ImageField,AudioField,DateField,
        │   │           TimeField,DateTimeRangeField,LinkField,LocationField,ChoiceField,
        │   │           BooleanField,PersonField,GroupField}.tsx
        │   └── ui/                                 # shadcn/ui copiado al repo (Button, Dialog, Switch…)
        ├── lib/
        │   ├── api-client.ts        # fetch tipado contra 03-api.md; único lugar con el token
        │   ├── store.ts             # Zustand + Immer (§10)
        │   ├── undo.ts              # pila de undo por operaciones (§11)
        │   ├── autosave.ts          # cola, debounce+maxWait, reintentos, 409 (§12)
        │   ├── canvas-bridge.ts     # lado padre del protocolo (§9)
        │   ├── canvas-client.ts     # lado iframe del protocolo (§9)
        │   ├── tab-lock.ts          # BroadcastChannel: una pestaña editora por invitación (§12.6)
        │   ├── crop.ts              # recorte con react-image-crop → WebP (§13)
        │   └── i18n.ts              # cadenas es-MX (sin biblioteca; objeto tipado)
        ├── e2e/
        │   ├── flujo-principal.spec.ts  ├── deshacer.spec.ts  ├── secciones.spec.ts
        │   ├── conflicto.spec.ts        ├── a11y.spec.ts      └── presupuesto.spec.ts
        └── scripts/
            └── check-budget.mjs     # presupuesto de JS de §16.2 (falla el job frontend)
```

### 2.1 `package.json` de cada paquete (versiones verificadas el 2026-09-03, §21)

```jsonc
// frontend/package.json
{
  "name": "invitaciones-frontend", "private": true, "type": "module",
  "packageManager": "pnpm@11.25.0",
  "engines": { "node": ">=22.22" },
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "schema:emit": "pnpm --filter @invitaciones/schema schema:emit",
    "e2e": "pnpm --filter web exec playwright test",
    "budget": "pnpm --filter web run budget"
  },
  "devDependencies": {
    "turbo": "2.10.12",
    "typescript": "5.9.3",
    "eslint": "10.9.1",
    "typescript-eslint": "8.69.0",
    "@types/node": "26.4.1"
  }
}
```

```jsonc
// frontend/packages/schema/package.json
{
  "name": "@invitaciones/schema", "version": "0.0.0", "private": true, "type": "module",
  "exports": {
    ".":        { "types": "./src/index.ts",           "default": "./src/index.ts" },
    "./canvas": { "types": "./src/canvas-protocol.ts", "default": "./src/canvas-protocol.ts" }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json --noEmit",
    "schema:emit": "node --experimental-strip-types scripts/emit-json-schema.ts",
    "test": "vitest run --coverage",
    "lint": "eslint src",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": { "zod": "4.5.4" },
  "devDependencies": { "vitest": "5.0.0", "@vitest/coverage-v8": "5.0.0", "typescript": "5.9.3" }
}
```
`zod@4.5.4` es dependencia **exacta** (sin `^`): el `.schema.json` generado se compara byte a byte contra el commiteado (ADR-004, `06 §7`); un bump de parche de Zod que cambie el emisor rompería CI sin que nadie lo pidiera. Mismo criterio para todas las versiones de este documento: se fijan exactas y se suben por PR explícito.

```jsonc
// frontend/packages/sections/package.json
{
  "name": "@invitaciones/sections", "version": "0.0.0", "private": true, "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "build": "tsc --noEmit", "test": "vitest run --coverage",
               "lint": "eslint src", "typecheck": "tsc --noEmit" },
  "dependencies": { "@invitaciones/schema": "workspace:*" },
  "peerDependencies": { "react": "19.2.8", "react-dom": "19.2.8" },
  "devDependencies": {
    "react": "19.2.8", "react-dom": "19.2.8",
    "@types/react": "19.2.18", "@types/react-dom": "19.2.7",
    "vitest": "5.0.0", "@vitest/coverage-v8": "5.0.0",
    "@vitejs/plugin-react": "6.1.1", "@testing-library/react": "16.3.3",
    "@testing-library/user-event": "14.6.7", "jsdom": "30.0.1",
    "jest-axe": "11.0.0", "typescript": "5.9.3"
  }
}
```
**`tailwindcss` NO aparece aquí, y es deliberado** (§19): las secciones no pueden usar utilidades del chrome ni por accidente, porque el paquete no las tiene.

```jsonc
// frontend/apps/web/package.json
{
  "name": "web", "version": "0.0.0", "private": true, "type": "module",
  "scripts": {
    "dev": "next dev", "build": "next build", "start": "next start",
    "test": "vitest run --coverage", "lint": "next lint && eslint .",
    "typecheck": "tsc --noEmit",
    "budget": "node scripts/check-budget.mjs",
    "e2e": "playwright test", "lhci": "lhci autorun"
  },
  "dependencies": {
    "@invitaciones/schema": "workspace:*",
    "@invitaciones/sections": "workspace:*",
    "next": "16.3.4", "react": "19.2.8", "react-dom": "19.2.8",
    "zustand": "5.0.15", "immer": "11.1.18",
    "react-hook-form": "7.87.0", "@hookform/resolvers": "5.9.1",
    "@dnd-kit/core": "6.3.1", "@dnd-kit/sortable": "10.0.0", "@dnd-kit/accessibility": "3.1.1",
    "react-image-crop": "11.1.2",
    "class-variance-authority": "0.7.1", "tailwind-merge": "3.6.0", "lucide-react": "1.40.0",
    "@radix-ui/react-dialog": "1.1.23"
  },
  "devDependencies": {
    "tailwindcss": "4.3.3", "@tailwindcss/postcss": "4.3.3",
    "typescript": "5.9.3", "@types/react": "19.2.18", "@types/react-dom": "19.2.7",
    "vitest": "5.0.0", "@vitest/coverage-v8": "5.0.0", "@vitejs/plugin-react": "6.1.1",
    "@testing-library/react": "16.3.3", "@testing-library/user-event": "14.6.7", "jsdom": "30.0.1",
    "@playwright/test": "1.62.1", "@axe-core/playwright": "4.13.0",
    "@next/bundle-analyzer": "16.3.4", "@lhci/cli": "0.15.1"
  }
}
```
Los demás componentes de shadcn/ui se copian al repo bajo `components/ui/` y arrastran su propio `@radix-ui/react-*`; solo se listan los que se usan. `shadcn` (CLI) se ejecuta con `pnpm dlx`, no se declara como dependencia.

`turbo.json` mínimo:
```jsonc
{ "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": [".next/**", "!.next/cache/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "test":      { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "lint":      {},
    "schema:emit": { "outputs": ["generated/**"] } } }
```

---

## 3. `packages/schema`: qué reexporta y qué no

- **Reexporta tal cual** los seis módulos de `diseno/esquema/` más `invariants.ts`. Fase 3 los **mueve**, no los reescribe: cualquier divergencia entre `diseno/esquema/*.ts` y `packages/schema/src/*.ts` es un fallo de contrato (P1).
- **`emit-json-schema.ts` no debe recorrer `canvas-protocol.ts`.** El protocolo del lienzo es superficie de la app, no contrato con Kotlin; incluirlo en `templates2.schema.json` obligaría al validador Kotlin a conocer mensajes de UI. Por eso vive en un *entrypoint* separado (`@invitaciones/schema/canvas`) y `index.ts` no lo reexporta.
- La regla de lint de ADR-005 (`no-restricted-syntax` sobre `.refine`/`.superRefine`/`.transform`) aplica a **todo** `src/**`, incluido `canvas-protocol.ts`. El protocolo no necesita refinamientos.
- `generated/section-variants.json` (§5.2) se emite desde `packages/sections` y se **commitea**; `POST /master/templates2/versions` debería validar contra él (ADR-1R-F-08, propuesta — hoy nada impide registrar una plantilla que declare una variante que ningún componente sabe pintar).

---

## 4. Modelo de interacción del editor (P7)

El editor **no** es WYSIWYG por edición directa del DOM (anti-patrón confirmado en aura.build: "DOM + clases Tailwind como documento editable", `handoffs/1-aura-lecciones.md`). Es un editor de **dos paneles sincronizados**:

- **Lienzo** (centro/derecha): el `ComposedDocument` renderizado exactamente como lo verá el invitado, dentro de un `<iframe>` aislado (§8). Permite **seleccionar** (clic en un bloque), **navegar** (scroll) y ver el resultado en vivo. No permite editar texto sobre el lienzo.
- **Panel lateral** (izquierda): lista de secciones (mostrar/ocultar, reordenar, cambiar variante) y, con un bloque seleccionado, un formulario `react-hook-form` + resolver Zod del `BlockSpec` correspondiente, con campos curados.

**Por qué no hay edición en línea sobre el lienzo (corrección de la justificación original).** El borrador anterior lo atribuía al aislamiento del iframe. **Es falso**: un `contenteditable` dentro del iframe funcionaría igual, porque el JS que lo maneja se ejecuta *dentro* del propio iframe y solo enviaría el texto al padre por `postMessage` [I]. El motivo real es P7 y P1: la validación por `BlockSpec` (longitudes, patrón, `multiline`, opciones de `choice`, marcas cerradas de `richText`) es visible y explicable en un formulario, y silenciosa o imposible en un `contenteditable`; además `richText` solo admite `bold`/`italic`/`href` (`esquema/blocks.ts`, `RichSpan.marks`) y un `contenteditable` invita a pegar HTML arbitrario que habría que sanear en el borde. **Divergencia registrada:** `investigacion-editor-y-tecnologias.md` §3.1 fila 2 promete "clic directo sobre el texto → se edita ahí mismo"; este diseño lo sustituye por "clic sobre el texto → el panel abre ese campo con el foco puesto", que conserva la sensación de inmediatez sin abrir la superficie. Ver §22 y `handoffs/1R-frontend.md` ("contradicciones a dirimir", C-4).

---

## 5. `packages/sections`: registro, contratos y tokens

### 5.1 Principio

`packages/sections` es el corazón de "un editor simple sin CSS": el cliente nunca toca estos componentes, solo el formulario del panel. Los mismos componentes renderizan `/editor/[id]/canvas` (dentro del iframe), `/preview/[id]` y `/i/[publicToken]` — así "lo que ves en el editor es lo que ve el invitado" sin dos implementaciones.

### 5.2 `sectionRegistry`: forma exacta

```ts
// packages/sections/src/registry.ts
import type { ComposedSection, ComposedBlock, ComposedGroup } from "@invitaciones/schema";
import type { SectionType, BlockRole } from "@invitaciones/schema";

/** Modo de render. Determina si se montan overlays y listeners; nada visual cambia. */
export type RenderMode = "canvas" | "public";

/** Referencia estable a un bloque: los grupos necesitan (blockId, itemId, itemBlockId). */
export interface BlockRef {
  readonly sectionKey: string;
  readonly blockId: string;      // id del bloque o del grupo
  readonly itemId?: string;      // ULID del ítem, si el bloque vive dentro de un grupo
  readonly itemBlockId?: string; // id relativo del bloque dentro del ítem
}

export interface SectionComponentProps {
  /** La sección ya compuesta. NUNCA recibe el documento crudo ni el manifiesto. */
  readonly section: ComposedSection;
  /** Variante efectiva. Si no está en `supportedVariants`, el componente pinta `defaultVariant` y avisa. */
  readonly variant: string;
  readonly mode: RenderMode;
  /** Solo en mode="canvas": el bloque resaltado por el panel. */
  readonly selected?: BlockRef | null;
  /** Solo en mode="canvas": el componente lo invoca al hacer clic en una zona editable. */
  readonly onActivate?: (ref: BlockRef) => void;
  /** Bloques cuyo valor está pendiente de confirmación del servidor (§12.4): se pintan con aria-busy. */
  readonly pending?: ReadonlySet<string>;
}

export interface SectionEntry {
  readonly component: React.FC<SectionComponentProps>;
  /** Catálogo CERRADO de variantes que este componente sabe pintar. */
  readonly supportedVariants: readonly string[];
  readonly defaultVariant: string;
  /** Roles que el componente coloca en un hueco propio. Un rol ausente NO se renderiza (R5). */
  readonly roles: readonly BlockRole[];
  /** Etiqueta es-MX de cada variante para el selector del panel (§6.3). */
  readonly variantLabels: Readonly<Record<string, string>>;
}

export const sectionRegistry: Readonly<Record<SectionType, SectionEntry>> = { /* 12 entradas */ };
```

Reglas del registro, todas comprobables en prueba:
1. Las claves son exactamente los 12 valores de `SectionType` (`esquema/manifest.ts`). Falta una → error de tipo en compilación (el `Record<SectionType, …>` lo fuerza) [V].
2. `defaultVariant ∈ supportedVariants`.
3. `roles ⊆ BlockRole` (`esquema/blocks.ts`).
4. `pnpm --filter @invitaciones/sections run emit:variants` escribe `packages/schema/generated/section-variants.json` con `{ [sectionType]: string[] }`; CI compara con `git diff --exit-code`, mismo mecanismo que ADR-004.
5. Prueba `registry.contract.test.ts`: por cada golden `template.json`, toda `SectionSpec.variants` debe estar contenida en `supportedVariants` del tipo correspondiente; si no, falla. Cierra el hueco "la plantilla declara una variante que nadie pinta".

**Despacho de bloques.** `SectionsRoot` no despacha bloques: cada componente de sección coloca sus huecos por **rol** (`roles`) y delega el pintado en el componente de bloque correspondiente a `block.type`. Un bloque presente en `composed` cuyo rol la sección no contempla **no se pinta** y produce un aviso `RENDER_WARNING` en modo `canvas` (§9) — nunca se inventa un hueco (R5, `01 §5.2`).

### 5.3 Contrato de cada componente de bloque

```ts
export interface BlockComponentProps<T extends ComposedBlock = ComposedBlock> {
  readonly block: T;                 // incluye value (puede ser null), provenance, label, role
  readonly mode: RenderMode;
  readonly onActivate?: (ref: BlockRef) => void;
  readonly ref_: BlockRef;           // identidad para el mensaje BLOCK_CLICKED
  readonly pending?: boolean;
}
```
Invariantes de implementación, verificables por prueba de componente:
- `value === null` ⇒ el bloque **no** renderiza nada (ni un hueco vacío, ni "—"): R2/R5.
- `mode === "public"` ⇒ cero `onClick`, cero `useEffect` de selección, cero `data-block-*`. Se comprueba con una prueba de instantánea del HTML en ambos modos (§20.1, escenario U-07).
- `ImageBlock` exige `alt`; si `block.role === "decorative"`, renderiza `alt="" aria-hidden="true"` (§17.4).
- `RichTextBlock` mapea `RichDoc` → `<p>/<strong>/<em>/<a>` **elemento a elemento**. Prohibido `dangerouslySetInnerHTML` y prohibido serializar a cadena HTML (§17.6). Regla de lint dura, §19.3.

### 5.4 Tokens de invitación

`ThemeProvider` recibe `ComposedDocument.theme` (`ResolvedTheme`: `tokens` hex + `fonts`) y escribe **custom properties con prefijo `--inv-`** en el elemento raíz del árbol de secciones:

| Custom property | Origen | Notas |
|---|---|---|
| `--inv-color-bg`, `--inv-color-surface`, `--inv-color-ink`, `--inv-color-accent`, `--inv-color-accent-ink`, `--inv-color-muted` | `ResolvedTheme.tokens` (6 claves fijas, `esquema/manifest.ts` `Palette.tokens`) [V] | Únicos colores permitidos en `packages/sections` |
| `--inv-font-heading`, `--inv-font-body` | `ResolvedTheme.fonts.*.family` + pila de reserva | §5.5 |
| `--inv-space-1..8`, `--inv-radius-sm/md/lg`, `--inv-measure` | `tokens.css`, valores fijos del sistema de secciones | No provienen del documento (P3): el documento no lleva tamaños |

Ninguna hoja de estilo de `packages/sections` puede referirse a un color literal ni a una variable que no empiece por `--inv-`. Regla de lint + prueba de grep en CI (§19.2).

### 5.5 Tipografías autoalojadas (hueco grave del borrador anterior: no se decía nada)

`FontFace.source` es `"google" | "bundled"` [V: `esquema/manifest.ts`]. El brief exige **tipografías autoalojadas**. Resolución sin tocar el esquema:

- **`source: "bundled"` — camino primario.** La familia viaja como asset del paquete de plantilla (`AssetEntry.contentType` ya admite `font/woff2` [V: `esquema/manifest.ts`]). `compose()` resuelve el asset a una URL de CDN; `ThemeProvider` inyecta `@font-face` en tiempo de ejecución con esa URL, `font-display: swap` y `unicode-range` latino. Ventaja decisiva: **añadir una plantilla con una tipografía nueva no obliga a desplegar el frontend** (espíritu de P4).
- **`source: "google"` — camino restringido.** La familia debe estar en la *allowlist* estática `packages/sections/src/theme/fonts.ts`, cargada con `next/font/google` en tiempo de compilación, que **descarga y autoaloja** los archivos bajo `/_next/static/media` sin ninguna petición a Google en tiempo de ejecución [I: comportamiento documentado de `next/font`]. `next/font/google` exige argumentos literales, así que **una familia fuera de la allowlist no puede cargarse dinámicamente**: registrar una plantilla que la declare debe fallar (validación contra `generated/font-allowlist.json`, mismo patrón que §5.2). Todas las familias de la allowlist se declaran con `preload: false`; el `<link rel="preload" as="font" crossorigin>` de la pareja realmente elegida se emite en `generateMetadata` de la ruta pública (§15.4), para no precargar 8 familias en cada invitación.
- **En el lienzo aislado ambos caminos exigen CORS** (§8.4): un documento de origen opaco pide las fuentes en modo CORS y el servidor debe responder `Access-Control-Allow-Origin: *`.
- Subconjunto: `latin` + `latin-ext` (es-MX). Sin subconjunto, `Cormorant Garamond` + `Inter` con 4 pesos rondan 300-400 KB y comprometen el presupuesto de §16.

---

## 6. `apps/web`: rutas y qué renderiza cada una

| Ruta | Render | Auth | Qué renderiza | Caché |
|---|---|---|---|---|
| `/editor` | Cliente + RSC | sí | Catálogo de plantillas filtrado por `eventKind` y `minPlanTier` (§7.1) | `no-store` |
| `/editor/[invitationId]` | Cliente (chrome) | sí | Dos paneles; el lienzo es un `<iframe>` a la ruta de abajo (§8). Carga inicial vía `GET .../document` (`03 §3.2`) | `no-store` |
| `/editor/[invitationId]/canvas` | Cliente, **sin datos propios** | ninguna útil | Documento del iframe. **No hace fetch de nada**: espera el `ComposedDocument` por `postMessage` (§9). Monta `CanvasContext` + `SectionsRoot mode="canvas"` | estático |
| `/preview/[invitationId]` | RSC | sí | `compose()` actual (documento de trabajo) sin chrome ni overlays: "ver como quedará antes de publicar". `mode="public"` | `no-store`, `noindex` |
| `/i/[publicToken]` | RSC + ISR | ninguna | Release activo (`GET /public/i/{token}/render`, `03 §7`). `mode="public"`, cero JS de edición | ISR + `revalidateTag` (§15.2), `noindex` |
| `/api/revalidate` | Route handler | secreto compartido | Webhook que el backend llama al publicar (§15.2) | — |

**`/editor/[invitationId]/canvas` no lleva `[publicToken]` ni consulta la API**: es la aplicación de la lección 4 de aura.build (`handoffs/1-aura-lecciones.md`: el preview nunca recibe credenciales) y de ADR-018. Su HTML es idéntico para toda invitación, así que puede servirse estático y cachearse indefinidamente.

### 6.1 Wireframe — catálogo de plantillas (`/editor`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Invitaciones ▸ Boda de Ana y Luis            [ ? Ayuda ]   [ Mi cuenta ▾ ]   │
├──────────────────────────────────────────────────────────────────────────────┤
│  Elige una plantilla                                                          │
│  Filtros:  [ Todas ▾ ]  [ Incluidas en mi plan ▾ ]              12 resultados │
│                                                                               │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐      │
│  │               │ │               │ │               │ │               │      │
│  │  previewImage │ │  previewImage │ │  previewImage │ │  previewImage │      │
│  │               │ │               │ │               │ │   🔒 Plan 2   │      │
│  ├───────────────┤ ├───────────────┤ ├───────────────┤ ├───────────────┤      │
│  │ Boda clásica  │ │ Jardín        │ │ Minimal       │ │ Art déco      │      │
│  │ [Elegir]      │ │ [Elegir]      │ │ [Elegir]      │ │ [Mejorar plan]│      │
│  └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘      │
└──────────────────────────────────────────────────────────────────────────────┘
```
Cada tarjeta es un `<article>` con `<h3>` y un solo control primario. La tarjeta bloqueada por plan **no** es un botón deshabilitado sin explicación: dice por qué (`403 TPL_PLAN_TIER_INSUFFICIENT`, `03 §10`).

### 6.2 Wireframe — editor, dos paneles (`/editor/[invitationId]`)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ← Invitaciones │ Boda de Ana y Luis        ↶ ↷ │ ✓ Guardado 12:41 │ 📱 🖥 │ [Publicar]│ ← chrome
├───────────────────────────────┬──────────────────────────────────────────────────────┤
│ SECCIONES                     │ ┌────────────────────────────────────────────────┐   │
│ ⠿ ▣ Portada            [ ●] ⋮ │ │  (iframe sandbox="allow-scripts")              │   │
│ ⠿ ▣ Los novios         [ ●] ⋮ │ │  ┌──────────────────────────────────────────┐  │   │
│ ⠿ ▣ Nuestra historia   [○ ] ⋮ │ │  │        Ana  &  Luis                      │  │   │
│ ⠿ ▣ Ceremonia          [ ●] ⋮ │ │  │        12 de diciembre de 2026           │  │   │
│ ⠿ ▣ Galería            [ ●] ⋮ │ │  │ ╔══════════════════════════════════════╗ │  │   │
│ ⠿ ▣ Mesa de regalos    [ ●] ⋮ │ │  │ ║  (bloque seleccionado: coverTitle)   ║ │  │   │
│ ⠿ ▣ Confirmación       [ ●] ⋮ │ │  │ ╚══════════════════════════════════════╝ │  │   │
│ … 5 más                       │ │  │        [ Confirmar asistencia ]          │  │   │
│                               │ │  └──────────────────────────────────────────┘  │   │
│ ─────────────────────────────  │ │             ▲ 390 px (vista móvil)             │   │
│ APARIENCIA                    │ └────────────────────────────────────────────────┘   │
│ Paleta   ⬤⬤⬤ Rosa empolvado   │                                                      │
│ Tipografía  Aa  Serif elegante│                                                      │
└───────────────────────────────┴──────────────────────────────────────────────────────┘
   ⠿ = asa de arrastre (con alternativa de teclado y de un solo puntero, §14)
   [●]/[○] = interruptor mostrar/ocultar · ⋮ = menú (Subir, Bajar, Cambiar diseño)
```

### 6.3 Wireframe — panel de sección / bloque seleccionado

```
┌───────────────────────────────┐
│ ‹ Volver a secciones          │
│ PORTADA                       │
│ ┌───────────────────────────┐ │
│ │ Diseño de la sección      │ │   ← `setSectionVariant`; miniaturas esquemáticas SVG,
│ │ [▤ Foto grande]  [▥ Marco]│ │      no fotos: el manifiesto no declara imagen por
│ └───────────────────────────┘ │      variante (§22, hueco H-F-06)
│                               │
│ Título                        │
│ ┌───────────────────────────┐ │
│ │ Ana & Luis                │ │   ← TextField, maxLength del BlockSpec
│ └───────────────────────────┘ │      contador "9/40" visible al 80 %
│ ⚠ contenido de ejemplo        │      ← badge si provenance === "default"
│                               │
│ Foto de portada               │
│ ┌───────────────────────────┐ │
│ │  [miniatura]  Cambiar     │ │
│ │               Recortar    │ │   ← §13
│ │  Texto alternativo *      │ │   ← obligatorio salvo role="decorative"
│ │  [ Ana y Luis abrazados ] │ │
│ └───────────────────────────┘ │
│                               │
│ Fecha  [12/12/2026] 🔒        │   ← source:"business" ⇒ solo lectura + enlace
│  Se toma de los datos de tu       "editar en los datos de la invitación"
│  invitación. [Editar allí]    │
└───────────────────────────────┘
```

### 6.4 Wireframe — gestor de fotos (grupo `gallery`)

```
┌──────────────────────────────────────────────────────────────┐
│ GALERÍA — 6 de 12 fotos                       [ + Agregar ]  │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                    │
│ │ ⠿1 │ │ ⠿2 │ │ ⠿3 │ │ ⠿4 │ │ ⠿5 │ │ ⠿6 │  ← dnd-kit sortable │
│ │ ⋮  │ │ ⋮  │ │ ⋮  │ │ ⋮  │ │ ⋮  │ │ ⋮  │     (§14)          │
│ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                    │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │  Arrastra fotos aquí o [ selecciona archivos ]           │ │  ← zona de soltar
│ │  JPG, PNG o WebP · hasta 8 MB · máximo 12 fotos          │ │     EN EL PANEL,
│ └──────────────────────────────────────────────────────────┘ │     nunca en el lienzo
│ Subiendo 2 de 3  ▓▓▓▓▓▓▓░░░  67 %          [ Cancelar ]      │     (§8.7)
└──────────────────────────────────────────────────────────────┘
```

### 6.5 Wireframe — diálogo de publicación

```
┌──────────────────────────────────────────────────────────────┐
│  Publicar invitación                                    [✕]  │
├──────────────────────────────────────────────────────────────┤
│  Antes de publicar revisamos tu invitación:                  │
│                                                              │
│  ✗  Falta el nombre del lugar de la ceremonia                │
│         → [ Completar ]      (bloquea: required + missing)   │
│  ✗  "Nuestra historia" sigue con el texto de ejemplo         │
│         → [ Editar ]         (bloquea: required + default)   │
│  ⚠  "Mesa de regalos" usa el texto de ejemplo                │
│         → opcional, no bloquea                               │
│                                                              │
│  ────────────────────────────────────────────────────────    │
│  [ Cancelar ]                              [ Publicar ]      │ ← deshabilitado
└──────────────────────────────────────────────────────────────┘    mientras haya ✗

Tras publicar:
┌──────────────────────────────────────────────────────────────┐
│  ✅ Tu invitación está en vivo                                │
│  https://invitaciones.mx/i/01J8ZC…            [ Copiar ]      │
│  [ Ver como invitado ↗ ]        [ Compartir por WhatsApp ↗ ]  │
│  Publicada el 3 de septiembre, 12:44                          │
└──────────────────────────────────────────────────────────────┘
```

### 6.6 Wireframe — vista de invitado (`/i/[publicToken]`)

```
┌──────────────────┐   Documento HTML puro (RSC). Sin chrome, sin overlays,
│                  │   sin listeners de postMessage, sin store.
│   [foto portada] │   <html lang="es-MX"> · <meta name="robots" content="noindex">
│                  │   Orden de secciones = composed.sections (ya ordenado, R1)
│    Ana & Luis    │   Cada sección: <section aria-labelledby="s-<key>">
│  12·12·2026      │   Encabezados por nivel semántico, no por tamaño (§17.3)
│  [Confirmar]  ⌄  │
├──────────────────┤   Único JS de cliente: la isla de RSVP (§15.6), cargada con
│  Los novios      │   next/dynamic; el resto es HTML+CSS.
│  …               │
└──────────────────┘
```

---

## 7. Flujos completos, con estados de carga y de error

### 7.1 Flujo A — elegir plantilla → editar textos y fotos → cambiar paleta → ocultar sección → publicar → abrir como invitado

| # | Acción del cliente | Llamada | Estado de carga | Estados de error y qué ve el cliente |
|---|---|---|---|---|
| 1 | Entra a `/editor` | `GET /public/templates2/catalog` (catálogo; ruta del backend, `03 §2` no la lista → §22 hueco H-F-01) | Rejilla de 8 tarjetas *skeleton* | Red caída → "No pudimos cargar las plantillas" + [Reintentar]. 401 → redirección a login |
| 2 | Pulsa "Elegir" | `POST …/document:choose-template` | Botón en estado `aria-busy`, resto de tarjetas inertes | `403 TPL_PLAN_TIER_INSUFFICIENT` → diálogo "Esta plantilla es del plan Premium"; `404 TPL_TEMPLATE_VERSION_NOT_FOUND` → "Esta plantilla ya no está disponible", se recarga el catálogo; `409 TPL_MIGRATION_PLAN_MISSING` → "No podemos cambiar a esta versión ahora mismo" + reporte al soporte |
| 3 | Llega a `/editor/{id}` | `GET …/document` | Chrome con esqueleto del panel + lienzo en blanco con "Preparando tu invitación…" | `404 TPL_DOCUMENT_NOT_STARTED` → vuelve a `/editor`; `403 TPL_FORBIDDEN` → página "No tienes acceso a esta invitación" |
| 4 | El lienzo carga | `RENDER` por el puente (§9) | Lienzo con `aria-busy="true"` hasta el primer `RENDER` pintado | `READY` no llega en 5 s → recarga automática una vez; segundo fallo → "No pudimos mostrar la vista previa" + [Reintentar] + enlace a `/preview/{id}` como salida (§8.8) |
| 5 | Clic en el título de portada | `BLOCK_CLICKED` → el panel abre `TextField` con foco | ninguno (todo local) | Bloque no editable (`editable:false` o `source:"business"`) → el panel lo muestra en solo lectura con la explicación de dónde se cambia |
| 6 | Escribe | `setBlock` local; `POST …/operations` al vencer debounce (§12) | Indicador "Guardando…" → "Guardado 12:41" | ver §12.5 (tabla completa de errores de guardado) |
| 7 | Sube una foto | `POST …/assets` → `setBlock` con `assetId` | Barra de progreso por archivo; miniatura optimista con `URL.createObjectURL` | `413 TPL_ASSET_TOO_LARGE` → "Esta foto pesa más de 8 MB, elige otra o recórtala"; `415` → "Formato no admitido"; `409 TPL_ASSET_QUOTA_EXCEEDED` → "Has alcanzado el límite de 200 fotos" |
| 8 | Cambia la paleta | `PREVIEW_THEME` al pasar el ratón (sin escribir nada); `setTheme` al confirmar | El lienzo cambia al instante | `422 TPL_OPERATION_INVALID` (id de paleta inexistente en la versión) → se revierte la selección y se muestra "Esa combinación ya no existe en esta plantilla" |
| 9 | Oculta "Nuestra historia" | `setSectionVisible false` | Interruptor optimista; la sección se atenúa en el lienzo | Sección `required:true` → el interruptor no existe (no se pinta deshabilitado sin explicación: la fila dice "siempre visible") |
| 10 | Pulsa "Publicar" | `GET …/release/preflight` | Diálogo con esqueleto de lista | Fallo de red → "No pudimos revisar tu invitación", sin publicar |
| 11 | Confirma | `POST …/release` | Botón `aria-busy`; el diálogo no se puede cerrar | `422 TPL_PUBLISH_BLOCKED_MISSING_REQUIRED` / `TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT` → el diálogo vuelve al paso 10 con la lista actualizada (el preflight puede haber quedado obsoleto) |
| 12 | "Ver como invitado" | abre `/i/{publicToken}` en pestaña nueva | — | `404` (release recién publicado aún no propagado) → la ruta reintenta una vez tras 1 s con `GET /public/i/{token}/exists` (`03 §2`) antes de mostrar 404 |

### 7.2 Flujo B — deshacer

Ctrl+Z (o el botón `↶`) revierte la **última entrada de la pila** (§11), no la última operación de red. El lienzo se actualiza al instante. Si la entrada ya se envió al servidor, la operación inversa viaja en el siguiente lote; si aún estaba en el borrador, se cancela sin generar tráfico (§11.3). El servidor nunca conoce el concepto "deshacer": solo recibe operaciones nuevas (ADR-014).

Si el foco está **dentro del lienzo**, el atajo lo captura el documento del iframe y lo reenvía como `KEY_COMMAND` (§9.4). Sin este mensaje, Ctrl+Z deja de funcionar en cuanto el cliente hace clic en la vista previa [I: los eventos de teclado no cruzan la frontera de documento] — es el fallo que el borrador anterior no contemplaba (objeción O-05).

### 7.3 Flujo C — cambiar de plantilla a mitad de edición

Confirmación explícita ("tu contenido actual se guardará, pero tendrás que revisarlo en la plantilla nueva") → `POST …/document:choose-template` → el `content` actual pasa a `attic` (ADR-006). El panel muestra un banner con enlace a un visor de solo lectura del `attic`. No hay recuperación automática campo a campo entre plantillas distintas: los roles pueden no coincidir 1:1 y forzarlo reintroduciría el emparejamiento implícito de H-01/H-02. A partir de la quinta entrada de `attic`, el banner sugiere archivar (mitigación de E-05; ADR-006 intacta: nada se borra sin acción del cliente).

**Efecto sobre las pilas de undo/redo:** un cambio de plantilla **vacía ambas pilas** y lo dice ("no se puede deshacer el cambio de plantilla"). Motivo: las operaciones inversas apuntan a `blockId` que la plantilla nueva no declara; aplicarlas daría `422 TPL_BLOCK_UNKNOWN` en bloque (`03 §5`). El borrador anterior no lo decía (objeción O-06).

### 7.4 Flujo D — vista móvil / escritorio

Un conmutador cambia el ancho del `<iframe>` (390 px / 100 %) con `SET_VIEWPORT`. Las secciones son responsive por CSS (`clamp()`, `grid`), sin breakpoints expuestos al cliente (anti-patrón confirmado de aura.build). El conmutador es un `radiogroup` de dos opciones, no un `checkbox` sin nombre.

### 7.5 Flujo E — recuperación de sesión

Al abrir `/editor/{id}`, si `localStorage["tpl:pending:{id}"]` contiene operaciones sin confirmar de una sesión anterior (§12.7), el chrome muestra: "Tenías cambios sin guardar del 3 de septiembre a las 12:39. [Aplicarlos] [Descartarlos]". Aplicarlos = encolarlos con `baseRevision` **actual**, no la vieja, y con `clientBatchId` nuevo; el servidor los valida como cualquier lote y puede rechazarlos (`422`), en cuyo caso se descartan con explicación por operación.

---

## 8. El lienzo aislado: ataque, condiciones y plan de contingencia (ADR-018 / ADR-031)

Esta es la decisión más frágil del diseño y el borrador anterior la despachaba en un párrafo. Aquí se ataca en serio.

### 8.1 Qué implica exactamente `sandbox="allow-scripts"` sin `allow-same-origin`

El documento del iframe queda en un **origen opaco** ("null"). Consecuencias, todas relevantes [I, especificación HTML; ninguna verificada por ejecución en esta sesión]:

| Capacidad | ¿Funciona? | Consecuencia para este diseño |
|---|---|---|
| `document.cookie`, `localStorage`, `sessionStorage`, IndexedDB, Cache API, Service Worker | **No** (lanzan `SecurityError` o no existen) | Irrelevante: el lienzo no persiste nada. **Pero**: cualquier biblioteca que toque `localStorage` al inicializarse rompe el lienzo. Regla: `apps/web/app/editor/[id]/canvas/**` no importa nada del chrome (§19.4) |
| El padre lee `iframe.contentDocument` | **No** | Es el objetivo. Toda medición la hace el propio iframe y la reporta (`CANVAS_RESIZED`, `SECTION_IN_VIEW`) |
| `postMessage` en ambos sentidos | **Sí** | Canal único (§9) |
| `<img src>` a un CDN | **Sí** | Las imágenes de S3/CDN cargan. `<img>` no es una petición en modo CORS mientras no lleve `crossorigin` |
| `@font-face` / `next/font` | **Solo con CORS** | Las peticiones de fuente son siempre en modo CORS; con origen opaco el `Origin` es `null` y el servidor debe responder `Access-Control-Allow-Origin: *`. **Sin esto el lienzo pinta con la fuente de reserva y miente sobre lo que verá el invitado** |
| `fetch`/XHR al propio host | **Solo con CORS** | Por eso la ruta del lienzo **no hace ninguna petición de datos** (§6): recibe todo por mensaje |
| Navegación por `<a href>` | **No** (falta `allow-top-navigation`, y el propio marco no navega sin `allow-popups`) | Deseable: en el lienzo los enlaces no deben navegar. Aun así se interceptan con `preventDefault` para no dejar un clic muerto sin explicación |
| Envío de formularios | **No** (falta `allow-forms`) | El formulario de RSVP no se monta en modo `canvas`: `RsvpSection` con `mode="canvas"` pinta el bloque con los controles **inertes** |
| `alert`/`confirm` | **No** (falta `allow-modals`) | Ningún componente de sección debe usarlos (regla de lint, §19.3) |
| CSP `'self'` dentro del iframe | **No coincide con nada** | Trampa real: la CSP del documento del lienzo debe usar **hosts explícitos y `nonce`**, nunca `'self'` (§8.4) |
| HMR de Next en desarrollo | **No** (WebSocket con `Origin: null`) | Coste aceptado de desarrollo: el lienzo no recarga en caliente. Se trabaja abriendo `/editor/{id}/canvas` en su propia pestaña, donde sí es un documento de primer nivel con origen real |

**Veredicto: el aislamiento es practicable**, porque nada de lo que el lienzo necesita depende de su origen: no persiste, no autentica, no llama a la API, no navega, no envía formularios. Lo único que sí depende del origen —las tipografías— se resuelve con una cabecera. Pero es practicable **solo si se cumplen las cinco condiciones de §8.4**; sin ellas el lienzo falla de forma silenciosa (fuentes de reserva) o total (CSP que bloquea sus propios chunks).

### 8.2 Lo que el borrador anterior afirmaba y es incorrecto

> «`origin` del mensaje se valida en ambos lados (`event.origin === window.location.origin`, misma app, mismo dominio…)»

**Falso y funcionalmente roto** [I, especificación HTML]: los mensajes que salen de un iframe de origen opaco llegan al padre con `event.origin === "null"`, que nunca será igual a `window.location.origin` del padre. Con esa comprobación **el padre descartaría todos los mensajes del lienzo** y el editor quedaría muerto en cuanto se implementara. Corrección aplicada en §9.2: el **padre** valida por identidad (`event.source === iframeEl.contentWindow`) y por *nonce* de canal, y en cuanto hay `MessagePort` deja de escuchar `window`; el **hijo** sí valida `event.origin` contra el origen real del padre (que no es opaco). Objeción O-01, severidad **alta**.

### 8.3 Click-to-select, edición, scroll y medición: cómo funcionan sin acceso al DOM

- **Click-to-select** [I]: el manejador vive *dentro* del iframe (`CanvasContext` pasa `onActivate` a cada componente de sección). Al hacer clic, el iframe envía `BLOCK_CLICKED {ref}`. El padre no necesita tocar el DOM del hijo. **Funciona.**
- **Resaltado desde el panel**: `SELECT_BLOCK {ref}` → el hijo aplica `SelectionOverlay` y hace `scrollIntoView({block:"center"})`. **Funciona.**
- **Edición en línea**: no existe por decisión de producto (§4), no por el aislamiento. Si algún día se quisiera, sería un `contenteditable` **dentro** del iframe que envía `INLINE_COMMIT {ref, value}`; el aislamiento no lo impide.
- **Scroll-sync**: `IntersectionObserver` dentro del iframe → `SECTION_IN_VIEW {sectionKey}`. Sentido inverso: `SCROLL_TO_SECTION`. **Funciona.**
- **Medir alturas**: el padre **no puede**. El hijo monta un `ResizeObserver` sobre `document.documentElement` y envía `CANVAS_RESIZED {height}` (con `throttle` de 100 ms); el padre ajusta el `<iframe>` o mantiene alto fijo con scroll interno. Mensaje **ausente** en el borrador: objeción O-02, severidad media.
- **Captura de miniatura**: **no es posible** desde el padre, y dentro del iframe `html2canvas` + `canvas.toDataURL()` fallaría por *tainting* con las imágenes del CDN salvo que se sirvan con CORS y se marquen `crossorigin="anonymous"` [I]. **Decisión: no se genera miniatura de la invitación en el cliente.** La tarjeta del catálogo usa `previewImage` del manifiesto (ya existe, `esquema/manifest.ts`) y la imagen de vista previa social se genera en el servidor con `opengraph-image.tsx` (§15.4), que no depende del lienzo. Registrado en `preguntas-abiertas.md`.

### 8.4 Las cinco condiciones (obligatorias) y la configuración exacta

**C1 — CORS para las fuentes.** `next.config.ts`:
```ts
async headers() {
  return [
    { source: "/_next/static/media/:path*",              // next/font autoalojado
      headers: [{ key: "Access-Control-Allow-Origin", value: "*" },
                { key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    { source: "/fonts/:path*",
      headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
    { source: "/i/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },   // §15.4
  ];
}
```
Y el bucket `ASSETS` de S3 debe llevar una regla CORS `AllowedOrigins: ["*"], AllowedMethods: ["GET"], AllowedHeaders: ["*"]` para las fuentes `source:"bundled"` (§5.5). **Tarea de infraestructura de fase 2/4, no del frontend** — registrada en el handoff.

**C2 — CSP sin `'self'` en la ruta del lienzo.** Cabecera aplicada solo a `/editor/:id/canvas`:
```
Content-Security-Policy:
  default-src 'none';
  script-src  https://APP_ORIGIN 'nonce-{n}';
  style-src   https://APP_ORIGIN 'nonce-{n}';
  font-src    https://APP_ORIGIN https://CDN_ORIGIN;
  img-src     https://APP_ORIGIN https://CDN_ORIGIN data:;
  connect-src 'none';
  frame-ancestors https://APP_ORIGIN;
  base-uri 'none'; form-action 'none';
```
`APP_ORIGIN` y `CDN_ORIGIN` salen de variables de entorno; **nunca `'self'`**, que en un origen opaco no coincide con nada [I]. `connect-src 'none'` es la garantía mecánica de que el lienzo no llama a la API: si alguien introduce un `fetch`, falla en desarrollo y en CI, no en producción.

**C3 — El lienzo es una hoja sin navegación ni datos.** Sin `<Link>`, sin `useRouter`, sin `fetch`, sin `next/font` con `preload:true` en esa ruta, y `next.config.ts` **sin** la opción `crossOrigin` (que haría que Next marcara sus propios `<script>` como CORS y entonces sí necesitarían cabecera).

**C4 — El padre habla siempre con `targetOrigin: "*"`.** No hay alternativa: un origen opaco no es direccionable. Es aceptable porque el mensaje no lleva secretos (solo el `ComposedDocument`, cuyas URLs ya son públicas) y porque tras el saludo el tráfico pasa a un `MessagePort` punto a punto (§9.2). **Restricción dura:** ningún mensaje al lienzo puede llevar jamás el token de sesión, `invitationId` sensible ni `BusinessSnapshot` sin resolver.

**C5 — Sin HMR en el lienzo durante el desarrollo.** Documentado como coste, no como error a "arreglar" añadiendo `allow-same-origin` en desarrollo: un lienzo que en desarrollo corre con otra política que en producción es exactamente el tipo de divergencia que produce fallos solo en producción.

### 8.5 Prueba de aceptación del aislamiento (compuerta de fase 3)

Antes de escribir el editor, fase 3 ejecuta un *spike* de ≤ 1 día con esta lista de comprobación, **automatizada en `e2e/canvas-isolation.spec.ts`**:

| # | Comprobación | Criterio de aprobación |
|---|---|---|
| A1 | El iframe carga y envía `READY` | < 2 s en Chromium local |
| A2 | La fuente de la plantilla se aplica dentro del iframe | `getComputedStyle(h1).fontFamily` contiene la familia esperada, y `document.fonts.check()` es `true` |
| A3 | Las imágenes del CDN se pintan | `naturalWidth > 0` para la portada |
| A4 | La CSP no bloquea nada | Cero entradas `securitypolicyviolation` durante el arranque |
| A5 | Ciclo completo `RENDER` → `BLOCK_CLICKED` | El padre recibe el `ref` correcto |
| A6 | `CANVAS_RESIZED` reporta un alto > 0 | — |
| A7 | Ctrl+Z con el foco dentro del lienzo llega al padre | `KEY_COMMAND` recibido |
| A8 | Ningún `fetch` sale del lienzo | `connect-src 'none'` sin violaciones y cero peticiones en el trazado de red del iframe |

**Si A2 o A4 fallan y no se corrigen con C1/C2**, se aplica el plan de contingencia de §8.6 **sin volver a diseñar**: la decisión ya está tomada aquí.

### 8.6 Plan de contingencia, ordenado (ADR-1R-F-02, propuesta)

1. **Origen dedicado para el lienzo** (`https://lienzo.<dominio>`), con `sandbox="allow-scripts allow-same-origin"`. **No reintroduce el hallazgo S-03**: la combinación peligrosa es `allow-scripts + allow-same-origin` cuando el iframe es *del mismo origen que el embebedor*, porque entonces el marco puede alcanzar `parent.document` y quitarse el propio atributo `sandbox`. Con un origen distinto, `allow-same-origin` le devuelve **su** origen, no el del editor: sigue sin poder tocar al padre, y recupera fuentes, `'self'` en CSP y todo el tiempo de ejecución de Next. Es el patrón de dominio-caja-de-arena de uso común en la industria [I]. Coste: un nombre DNS y un certificado más, y `frame-ancestors https://APP_ORIGIN` para que solo el editor pueda embeberlo.
2. **Mismo origen con CSP estricta y sin `sandbox`**, aceptando que el aislamiento es solo de *árbol de render* (el lienzo podría, en teoría, alcanzar al padre). Se documentaría como regresión de seguridad frente a ADR-031.
3. **Shadow DOM en lugar de iframe: descartado.** No aísla: las custom properties heredan a través de la frontera de sombra, `@font-face` es de documento (no encapsulable), un error de render de una sección tumba el árbol React del editor entero, y no impide que el CSS global del chrome afecte a los elementos hospedados vía herencia. Resuelve el problema equivocado (colisión de nombres de clase) y no el que importa aquí (aislamiento de fallos y de estilos heredados).

La opción 1 es la contingencia recomendada. **No** se recomienda "restaurar `allow-same-origin` en el mismo origen", que es exactamente lo que ADR-031 prohíbe.

### 8.7 Lo que el lienzo NO hace en v1 (restricciones explícitas para fase 3)

- No recibe archivos soltados sobre él. La zona de soltar fotos vive en el panel (§6.4). Motivo: transferir un `File` por `postMessage` es posible [I] pero añade un camino de subida paralelo con su propia validación; no compensa en v1.
- No arrastra secciones. `dnd-kit` funciona solo dentro del panel (un arrastre que cruza documentos no es posible con esta arquitectura [I]).
- No monta el formulario de RSVP funcional (§8.1, sin `allow-forms`).
- No reproduce audio automáticamente (`backgroundMusic` se pinta como control, silenciado, y en modo `canvas` está inerte).

### 8.8 Degradación

Si el lienzo no arranca tras dos intentos, el editor **sigue siendo usable**: el panel funciona íntegro (es donde se edita de verdad) y se ofrece `/preview/{invitationId}` en pestaña nueva como vista previa alternativa (ruta server-side, sin iframe, sin protocolo). Es la razón de que esa ruta exista.

---

## 9. Protocolo `postMessage` v1 (contrato completo, definido con Zod)

### 9.1 Sobre y versionado

```ts
// packages/schema/src/canvas-protocol.ts — NO se exporta desde index.ts (§3)
import { z } from "zod";
import { BlockId, SectionKey, Ident, Ulid } from "./common.ts";
import { ComposedDocument, ResolvedValue } from "./composed.ts";

export const CANVAS_PROTOCOL_VERSION = 1 as const;

export const BlockRef = z.strictObject({
  sectionKey: SectionKey,
  blockId: BlockId,
  itemId: Ulid.optional(),
  itemBlockId: BlockId.optional(),
});

/** Sobre común. `seq` es monótono POR DIRECCIÓN; `id`/`replyTo` solo en pares petición-respuesta. */
const envelope = {
  p: z.literal("inv-canvas"),        // marca de protocolo: descarta ruido de extensiones y de otros iframes
  v: z.literal(CANVAS_PROTOCOL_VERSION),
  seq: z.number().int().min(0),
  id: z.string().max(64).optional(),
  replyTo: z.string().max(64).optional(),
};
```

### 9.2 Saludo, canal y validación de origen

```
Padre                                                     Lienzo (origen opaco)
──────                                                    ─────────────────────
1. crea <iframe src="/editor/{id}/canvas"
        sandbox="allow-scripts" referrerpolicy="no-referrer">
2. onload → const ch = new MessageChannel()
   frame.contentWindow.postMessage(
      {p,v,seq:0,t:"HELLO",nonce}, "*", [ch.port2])   ──────►  window.onmessage:
                                                               · event.origin === EXPECTED_PARENT_ORIGIN ?  (sí: el
                                                                 padre NO es opaco, su origen es comprobable)
                                                               · event.data.p === "inv-canvas" && v === 1 ?
                                                               · event.ports[0] existe ?
                                                               → guarda el puerto, deja de escuchar `window`
3. escucha SOLO ch.port1                              ◄──────  port.postMessage({t:"READY", protocolVersion:1,
   (el puerto es punto a punto: no hay `origin`                  buildId, nonce})
    que validar, y ningún tercero puede escribirlo)
4. valida nonce y protocolVersion; si difiere →
   estado "vista previa incompatible, recarga la página"
5. vacía la cola de mensajes acumulados antes del READY
```
Puntos que el borrador anterior no cubría (objeción O-01, alta; O-03, media):
- **Validación en el padre**: por `nonce` + por puerto dedicado, **no** por `event.origin` (§8.2).
- **Validación en el hijo**: `event.origin === process.env.NEXT_PUBLIC_EDITOR_ORIGIN`. Aquí sí es válida y es la comprobación importante, porque impide que otra página embeba el lienzo y le inyecte contenido (reforzado con `frame-ancestors`).
- **Mensajes perdidos**: todo `RENDER`/`PATCH` emitido antes del `READY` se **encola** en el padre (máx. 1 `RENDER` — solo importa el último — y todos los `PATCH` posteriores a él, que se colapsan contra ese `RENDER`). Nunca se descartan en silencio.
- **Tiempos de espera**: `READY` en 5 s; petición-respuesta (`PING`) en 3 s. Al primer vencimiento el padre recarga el iframe una vez con `?r=2`; al segundo pasa a estado de error (§8.8).
- **Orden**: `MessagePort` conserva el orden [I]; `seq` permite detectar y descartar duplicados tras una reconexión (se ignora todo `seq` ≤ al último procesado en esa dirección).
- **Reintentos**: el protocolo **no** reintenta mensajes de datos. Si el lienzo se recarga, envía `READY` de nuevo y el padre reenvía un `RENDER` completo — reconstrucción por estado, no por reproducción de eventos.

### 9.3 Mensajes padre → lienzo

| `t` | Payload (Zod) | Espera respuesta | Uso |
|---|---|---|---|
| `HELLO` | `{ nonce: z.string().length(32) }` | `READY` | Único mensaje enviado por `window.postMessage`; transfiere `port2` |
| `RENDER` | `{ composed: ComposedDocument, revision: z.number().int() }` | no | Estado completo. Se envía al arrancar, tras cada respuesta del servidor y tras cualquier operación estructural (`reorderSections`, `setSectionVisible`, `setSectionVariant`, `setTheme`, `addItem`, `removeItem`, `moveItem`) |
| `PATCH` | `{ entries: z.array(z.strictObject({ ref: BlockRef, value: ResolvedValue.nullable(), provenance: z.enum(["user","default","business","fixed","empty"]), pending: z.boolean() })).min(1).max(50) }` | no | Delta para ediciones escalares optimistas. Evita reenviar 100-200 KB de `ComposedDocument` en cada tecla (objeción O-04, media) |
| `SELECT_BLOCK` | `{ ref: BlockRef.nullable() }` | no | Resalta y desplaza al bloque activo del panel |
| `SCROLL_TO_SECTION` | `{ sectionKey: SectionKey }` | no | Al pulsar una fila de la lista de secciones |
| `SET_VIEWPORT` | `{ width: z.enum(["mobile","desktop"]) }` | no | Flujo D. El iframe ajusta su propia raíz; el padre además cambia el ancho del elemento |
| `PREVIEW_THEME` | `{ paletteId: Ident.nullable(), fontSetId: Ident.nullable() }` | no | Vista previa efímera al pasar el ratón por un *swatch*; `null` restaura. **No** genera operación ni entra en el undo |
| `PING` | `{}` | `PONG` | Diagnóstico y detección de lienzo colgado |

### 9.4 Mensajes lienzo → padre

| `t` | Payload | Uso |
|---|---|---|
| `READY` | `{ protocolVersion: z.literal(1), buildId: z.string().max(64), nonce: z.string().length(32) }` | Fin del saludo |
| `BLOCK_CLICKED` | `{ ref: BlockRef }` | Abre el campo en el panel con el foco puesto (flujo A.5) |
| `SECTION_IN_VIEW` | `{ sectionKey: SectionKey }` | Sincroniza el resaltado de la lista al hacer scroll |
| `CANVAS_RESIZED` | `{ height: z.number().int().min(0).max(200000) }` | Medición que el padre no puede hacer (§8.3) |
| `KEY_COMMAND` | `{ command: z.enum(["undo","redo","save","escape"]) }` | Atajos capturados con el foco dentro del lienzo (§7.2) |
| `RENDER_ERROR` | `{ sectionKey: SectionKey.optional(), message: z.string().max(500), digest: z.string().max(64).optional() }` | Una sección lanzó dentro de su `ErrorBoundary`. El padre muestra "No pudimos mostrar la sección X" **sin** tumbar el editor — es el aislamiento de fallos que justifica ADR-018 |
| `RENDER_WARNING` | `{ code: z.enum(["unknown-variant","unmapped-role","missing-font"]), detail: z.string().max(200) }` | Incidencias no fatales; el chrome las agrupa en un aviso discreto y las registra |
| `PONG` | `{ replyTo }` | — |

### 9.5 Discriminación y validación

```ts
export const CanvasInbound  = z.discriminatedUnion("t", [ /* los 8 de §9.3 */ ]);
export const CanvasOutbound = z.discriminatedUnion("t", [ /* los 8 de §9.4 */ ]);
```
Ambos extremos hacen `safeParse` de **todo** mensaje recibido. Un mensaje que no valida se **descarta y se registra** (nunca se procesa parcialmente, P1). Un mensaje con `v !== 1` pone el lienzo en estado "incompatible" en vez de intentar interpretarlo: el `buildId` del `READY` permite detectar que el padre quedó con un despliegue viejo tras una liberación y pedir recarga.

---

## 10. Store Zustand: estado, selectores y acciones (ADR-019)

### 10.1 Forma del estado

```ts
// apps/web/lib/store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { InvitationDocument, ComposedDocument, CompositionReport, Operation } from "@invitaciones/schema";

type SaveState = "idle" | "dirty" | "saving" | "retrying" | "offline" | "conflict" | "error";

interface PendingBatch { clientBatchId: string; ops: Operation[]; attempt: number; queuedAt: number; }

interface UndoEntry {
  label: string;                 // "Cambiar el título de la portada" (es-MX, para el botón y el lector)
  at: number;
  apply: Operation[];            // lo que hizo el usuario (para rehacer)
  revert: Operation[];           // lo que lo deshace
  coalesceKey?: string;          // p. ej. "setBlock:cover.title"
  /** Valores previos completos de lo que se borró (removeItem): permiten reconstruir sin depender del servidor. */
  restored?: Record<string, unknown>;
}

interface EditorState {
  // identidad y carga
  invitationId: number;
  templateVersion: { slug: string; version: string } | null;
  loadState: "loading" | "ready" | "error" | "forbidden" | "not-started";

  // documento
  document: InvitationDocument | null;
  revision: number;
  composed: ComposedDocument | null;
  report: CompositionReport | null;

  // interfaz
  selection: { sectionKey: string; blockId: string; itemId?: string; itemBlockId?: string } | null;
  panel: "sections" | "block" | "theme" | "photos" | "attic";
  viewport: "mobile" | "desktop";
  pendingBlocks: Set<string>;    // claves "blockId" / "blockId#itemId#itemBlockId" con valor sin confirmar

  // guardado
  draft: Operation[];            // dentro de la ventana de debounce, aún sin encolar
  queue: PendingBatch[];         // lotes listos para enviar, FIFO
  inFlight: PendingBatch | null; // como máximo UNO (§12.2)
  saveState: SaveState; lastSavedAt: number | null; lastError: string | null;

  // undo
  undo: UndoEntry[];             // tope 100 entradas
  redo: UndoEntry[];

  // lienzo
  canvas: { status: "idle" | "loading" | "ready" | "error"; height: number; buildId: string | null };
  // pestañas
  tabRole: "editor" | "readonly"; // §12.6
}
```

### 10.2 Selectores (memoizados con `useShallow`)

| Selector | Devuelve | Consumidor |
|---|---|---|
| `selectSectionRows` | `{key, title, visible, variant, required, order}[]` derivado de `composed.sections` | `SectionList` |
| `selectActiveBlock` | `ComposedBlock \| ComposedGroup \| null` según `selection` | `BlockForm` |
| `selectBlockSpec` | `BlockSpec` del manifiesto para el bloque activo | resolver de `react-hook-form` |
| `selectIsDefault(blockId)` | `report.stillDefault.includes(blockId)` | insignia "contenido de ejemplo" |
| `selectCanPublish` | `report.missingRequired.length === 0 && stillDefault∩required === ∅` | botón Publicar (aviso local; la verdad la da el preflight del servidor) |
| `selectSaveLabel` | cadena es-MX del indicador | `SaveIndicator` |
| `selectUndoLabel` / `selectRedoLabel` | `undo.at(-1)?.label` | tooltip y `aria-label` de `↶`/`↷` |
| `selectGroupItems(groupId)` | `ComposedItem[]` | `GroupField`, `PhotoManager` |

El manifiesto (`TemplateManifest`) se guarda **fuera** del store, en un contexto de solo lectura (`TemplateContext`): es inmutable durante toda la sesión y meterlo en el store haría que Immer lo recorriera en cada actualización sin ninguna ganancia.

### 10.3 Acciones = las diez operaciones de `esquema/operations.ts`, una por una

Todas siguen el mismo esqueleto: **(1)** validar contra el `BlockSpec`/manifiesto con el mismo `invariants.ts` que usará el servidor; **(2)** parche optimista sobre `composed`; **(3)** empujar la entrada de undo; **(4)** encolar la operación; **(5)** programar el autoguardado.

| Acción del store | `Operation` emitida | Parche optimista sobre `composed` | Inversa (`revert`) | Notas |
|---|---|---|---|---|
| `setBlock(blockId, value)` | `{op:"setBlock", blockId, value}` | sustituye `value` del `ComposedBlock` y pone `provenance:"user"`; quita `blockId` de `report.stillDefault` | si había valor de usuario previo: `setBlock` con ese valor; **si no lo había** (`provenance` era `default`/`empty`): `clearBlock` | La inversa **jamás** es `setBlock(valorPorDefecto)`: eso convertiría un contenido de demostración en contenido de usuario y desactivaría el bloqueo de publicación de `03 §6` (objeción O-08, **alta**) |
| `clearBlock(blockId)` | `{op:"clearBlock", blockId}` | recompone localmente el escalón siguiente: si hay `defaults[blockId]`, ese valor con `provenance:"default"`; si no, `value:null`, `provenance:"empty"` | `setBlock` con el valor previo del usuario | El `defaults` está en `TemplateContext`, así que el escalón se resuelve sin red (R2) |
| `addItem(groupId, values, index?)` | `{op:"addItem", groupId, tempId, values, index?}` | inserta un `ComposedItem` con `itemId = tempId` | `removeItem(groupId, tempId)`, reescrito a ULID al llegar `idMap` (§12.3) | `tempId` = `"tmp:" + crypto.randomUUID().replace(/-/g,"")` (cumple `TempId` de `common.ts`) |
| `removeItem(groupId, itemId)` | `{op:"removeItem", groupId, itemId}` | quita el ítem | `addItem(groupId, valoresGuardados, índiceGuardado)` con **`tempId` nuevo** | **Limitación declarada:** deshacer un borrado restaura los valores pero **no el `itemId`**, porque el ULID lo asigna el servidor (ADR-015). Consecuencia visible: ninguna (el `itemId` no se muestra); consecuencia interna: una propuesta de IA o una entrada de `attic` que citara el id viejo deja de resolver. Objeción O-09, media, aceptada como limitación |
| `moveItem(groupId, itemId, toIndex)` | `{op:"moveItem", …}` | reordena | `moveItem` al índice anterior | Coalesce por `moveItem:{groupId}:{itemId}` durante 1 s (arrastre continuo) |
| `setItemBlock(groupId, itemId, blockId, value)` | `{op:"setItemBlock", …}` | igual que `setBlock`, dentro del ítem | mismo criterio que `setBlock` (valor previo o `clearBlock` conceptual — **el catálogo no tiene `clearItemBlock`**, así que si no había valor previo la inversa es `setItemBlock` con el valor de `defaults` del `itemBlock`, y si tampoco existe, se marca la entrada como **no deshacible** y el botón `↶` lo dice) | Hueco real del catálogo de operaciones: ver `handoffs/1R-frontend.md` C-1 |
| `setSectionVisible(sectionKey, visible)` | `{op:"setSectionVisible", …}` | conmuta `visible` | valor anterior | Bloqueado en cliente si `SectionSpec.required` |
| `setSectionVariant(sectionKey, variant)` | `{op:"setSectionVariant", …}` | cambia `variant` | variante anterior | Solo variantes ∈ `supportedVariants` del registro (§5.2) |
| `reorderSections(order)` | `{op:"reorderSections", order}` | reordena `composed.sections` | orden anterior completo | Una sola entrada de undo por arrastre, no por paso intermedio |
| `setTheme({paletteId?, fontSetId?})` | `{op:"setTheme", …}` | sustituye `composed.theme` resolviendo desde `theme.json` del `TemplateContext` | par anterior | Es la única operación que puede cambiar dos campos a la vez; la inversa envía ambos |

Acciones de interfaz (no producen operación): `select(ref)`, `openPanel(p)`, `setViewport(v)`, `previewTheme(ids)`, `dismissWarning(id)`, `enterReadonly()`.
Acciones de ciclo de vida: `load()`, `applyServerState({revision, composed, report, idMap})`, `flushNow()`, `resolveConflict(mode)`, `restoreRecovered(ops)`.

---

## 11. Undo / redo: pila de operaciones (pseudocódigo)

### 11.1 Principio

La pila guarda **operaciones inversas**, nunca instantáneas del documento (ADR-019). Una instantánea de un documento con 12 secciones y 200 bloques pesa decenas de KB; 100 pasos de undo serían megabytes en memoria, y además impedirían enviar el undo como operación al servidor.

### 11.2 Coalescencia: qué es "una acción" para el usuario

Una entrada nueva **se abre** cuando ocurre cualquiera de estas cosas; en caso contrario la operación se **fusiona** con la entrada superior de la pila:

1. Cambia el `coalesceKey` (bloque distinto, o tipo de operación distinto).
2. Pasan más de **1500 ms** sin actividad sobre el mismo `coalesceKey`.
3. El campo pierde el foco (`blur`), o el cliente pulsa Enter/Tab.
4. La operación no es de texto (`setSectionVisible`, `reorderSections`, `setTheme`, `addItem`, `removeItem`… nunca se fusionan).

Nótese que la coalescencia **no** está atada al temporizador de autoguardado: si lo estuviera, escribir en un campo, saltar a otro y seguir escribiendo dentro de la misma ventana de 2 s produciría un solo paso de undo que revierte dos campos a la vez (defecto del borrador anterior; objeción O-07, media).

```ts
function pushUndo(entry: UndoEntry) {
  const top = state.undo.at(-1);
  const fusionable = top && entry.coalesceKey && top.coalesceKey === entry.coalesceKey
                     && entry.at - top.at < 1500 && !state.coalesceBarrier;
  if (fusionable) {
    top.apply = [...top.apply, ...entry.apply];   // se envía todo; setBlock es idempotente por clave
    top.at = entry.at;
    // top.revert NO se toca: el revert válido es el de la entrada MÁS ANTIGUA de la ráfaga, el que
    // devuelve al estado anterior a empezar a escribir. Sustituirlo por el de `entry` deshace solo
    // el último carácter — es el error clásico de esta estructura y hay una prueba para él (U-10).
  } else {
    state.undo.push(entry);
    if (state.undo.length > 100) state.undo.shift();   // ventana acotada, memoria acotada
  }
  state.redo = [];                                     // toda edición nueva invalida el rehacer
  state.coalesceBarrier = false;
}
```

### 11.3 `undo()` — incluye el caso "aún no se ha enviado"

```ts
function undo() {
  const entry = state.undo.pop();
  if (!entry) return;                                   // botón deshabilitado, nunca error

  // Caso 1: las operaciones de la entrada siguen en `draft` (no encoladas ni enviadas).
  // Se cancelan localmente: no hay que mandar la inversa, ahorra una revisión al servidor.
  const cancelled = removeFromDraft(state.draft, entry.apply);
  if (cancelled.every(Boolean)) {
    applyLocally(entry.revert);                         // parche optimista de vuelta
    state.redo.push(entry);
    sendToCanvas(entry.revert);                         // PATCH o RENDER según la operación
    state.coalesceBarrier = true;
    return;
  }

  // Caso 2: ya están encoladas o enviadas ⇒ la inversa viaja como operaciones NUEVAS.
  applyLocally(entry.revert);
  enqueue(entry.revert);                                // entra en `draft` y dispara el autoguardado
  state.redo.push(entry);
  sendToCanvas(entry.revert);
  state.coalesceBarrier = true;
}

function redo() {
  const entry = state.redo.pop();
  if (!entry) return;
  applyLocally(entry.apply);
  enqueue(entry.apply);
  state.undo.push(entry);
  sendToCanvas(entry.apply);
  state.coalesceBarrier = true;
}
```

### 11.4 Undo después de que el servidor responde

La respuesta del servidor (`{revision, idMap, composed, report}`) **reemplaza** `composed`/`report`/`revision` con la versión autoritativa (§12.4) pero **no toca las pilas**, salvo la reescritura de `tempId → ULID` (§12.3). Deshacer una operación ya confirmada es legítimo y frecuente: produce operaciones nuevas contra la revisión actual. Lo que sí se vacía por completo:

- **Cambio de plantilla** (`:choose-template`): `undo = redo = []` (§7.3).
- **`restore` desde el historial de servidor** (`03 §4`): `undo = redo = []`, porque el documento puede haber cambiado de forma masiva y las inversas ya no aplican.
- **Conflicto resuelto con "descartar mis cambios"** (§12.5): `undo = redo = []`.
- **`422 TPL_OPERATION_INVALID`**: se revierte localmente el lote rechazado y se eliminan de la pila las entradas que lo contenían (§12.5), porque su inversa ya no corresponde a nada.

---

## 12. Autoguardado, conflictos, red y cierre de pestaña

### 12.1 Parámetros

| Parámetro | Valor | Motivo |
|---|---|---|
| Debounce de teclado | 2000 ms | ADR-019. (`investigacion` §3.1 fila 8 sugería ~800 ms; se mantiene el valor de la ADR aceptada, más conservador en tráfico) |
| `maxWait` | 10 000 ms | **Falta en el borrador anterior**: sin él, escribir sin pausa 60 s no guarda nada en 60 s (objeción O-10, media) |
| Disparo inmediato (sin debounce) | operaciones no textuales: `setSectionVisible`, `setSectionVariant`, `reorderSections`, `setTheme`, `addItem`, `removeItem`, `moveItem`, y `setBlock` de imagen/audio/fecha/hora/booleano/elección | son acciones discretas: esperar 2 s solo hace parecer que la app no responde |
| Tamaño de lote | ≤ 50 operaciones (límite de `OperationBatch`) | `esquema/operations.ts` |
| Peticiones simultáneas | **exactamente 1** | `baseRevision` es un contador: dos lotes en vuelo garantizan que el segundo choca contra sí mismo |
| Reintentos | 3, con espera 1 s / 4 s / 10 s + *jitter* ±20 % | — |
| Persistencia local | `localStorage["tpl:pending:{invitationId}"]` | §12.7 |

### 12.2 Bucle de guardado (pseudocódigo)

```ts
// apps/web/lib/autosave.ts
let debounceTimer: Timer | null = null;
let maxWaitDeadline: number | null = null;

function enqueue(ops: Operation[], immediate = false) {
  state.draft.push(...ops);
  state.saveState = "dirty";
  persistLocally();                                  // §12.7, síncrono y barato
  if (immediate) return flushDraft();
  if (maxWaitDeadline === null) maxWaitDeadline = Date.now() + 10_000;
  clearTimeout(debounceTimer);
  const wait = Math.min(2000, maxWaitDeadline - Date.now());
  debounceTimer = setTimeout(flushDraft, Math.max(0, wait));
}

function flushDraft() {
  clearTimeout(debounceTimer); debounceTimer = null; maxWaitDeadline = null;
  while (state.draft.length > 0) {                   // trocea: NUNCA se envía un lote > 50
    const ops = state.draft.splice(0, 50);
    state.queue.push({ clientBatchId: newBatchId(), ops, attempt: 0, queuedAt: Date.now() });
  }
  pump();
}

async function pump() {
  if (state.inFlight || state.queue.length === 0) return;
  if (state.saveState === "conflict") return;        // bloqueado hasta que el usuario decida (§12.5)
  const batch = state.queue[0];
  state.inFlight = batch;
  state.saveState = batch.attempt === 0 ? "saving" : "retrying";
  try {
    const res = await api.postOperations(invitationId, {
      baseRevision: state.revision, clientBatchId: batch.clientBatchId, operations: batch.ops,
    });
    state.queue.shift(); state.inFlight = null;
    applyServerState(res);                           // §12.4
    state.saveState = state.queue.length || state.draft.length ? "dirty" : "idle";
    state.lastSavedAt = Date.now();
    persistLocally();
    pump();                                          // sigue con el resto de la cola
  } catch (e) {
    state.inFlight = null;
    await handleSaveError(e, batch);
  }
}
```

### 12.3 Reescritura de `tempId → ULID` (hueco grave del borrador anterior)

`03 §3.3` devuelve `idMap: {"tmp:abc": "01J8…"}`; el borrador de `04` nunca lo mencionaba. Sin esta reescritura, todo lo que quedó apuntando al `tempId` deja de resolver: las entradas de undo de un `addItem`, las operaciones aún en `draft` sobre ese ítem, y la selección de la interfaz. Objeción O-11, **alta**.

```ts
function applyIdMap(idMap: Record<string, string>) {
  if (Object.keys(idMap).length === 0) return;
  const swap = (id?: string) => (id && idMap[id]) ? idMap[id] : id;
  for (const op of [...state.draft, ...state.queue.flatMap(b => b.ops)]) {
    if ("itemId" in op) op.itemId = swap(op.itemId);
    if (op.op === "addItem" && idMap[op.tempId]) { /* ya aplicado; se deja el tempId, es idempotente por clientBatchId */ }
  }
  for (const e of [...state.undo, ...state.redo])
    for (const op of [...e.apply, ...e.revert]) if ("itemId" in op) op.itemId = swap(op.itemId);
  if (state.selection?.itemId) state.selection.itemId = swap(state.selection.itemId);
  for (const key of [...state.pendingBlocks]) { /* misma sustitución sobre la clave compuesta */ }
}
```

### 12.4 Reconciliación con la respuesta del servidor

`applyServerState({revision, idMap, composed, report})`:
1. `applyIdMap(idMap)`.
2. `state.revision = revision`.
3. **`composed` y `report` del servidor sustituyen a los locales** (son la verdad: incluyen fechas formateadas, `provenance`, `stillDefault` reales).
4. **Se reaplican encima los parches optimistas de lo que sigue pendiente** (`draft` + `queue`), para que el cliente no vea "saltar hacia atrás" el texto que acaba de escribir y aún no se ha enviado.
5. `pendingBlocks` se recalcula desde `draft`+`queue`; los bloques que ya no están pendientes pierden el `aria-busy`.
6. Se envía `RENDER` completo al lienzo.

**Bloques cuya representación no se puede calcular en el cliente.** `ResolvedValue` de `date`/`time`/`dateTimeRange` lleva un campo `formatted` que produce `formatDate(value, formatId, locale)` **en el servidor** (R6, `01 §5.2`); duplicar ese formateador en TypeScript reintroduciría exactamente la clase de defecto de H-27 (dos formateadores que divergen). Decisión: para esos tres tipos **no se parchea `formatted`**; el bloque entra en `pendingBlocks`, el lienzo lo pinta con el valor anterior y `aria-busy="true"` hasta que llega la respuesta (≤ 2 s). Objeción O-12, media.

### 12.5 Errores de guardado: tabla completa

| Situación | Detección | Qué hace el cliente | Qué ve el usuario |
|---|---|---|---|
| Red caída / `TypeError: Failed to fetch` | excepción de `fetch` | reintenta 3 veces (1 s/4 s/10 s); si sigue fallando, deja la cola intacta y se reengancha a `window.online` | "Sin conexión — tus cambios se guardarán cuando vuelva" (persistente, no *toast*) |
| `5xx` | status | igual que el anterior | "No pudimos guardar — reintentando…" |
| `409 TPL_REVISION_CONFLICT` | status + código | §12.6 | diálogo modal de conflicto |
| `422 TPL_OPERATION_INVALID` | código | descarta ese lote (nunca se reintenta, sería un bucle), revierte localmente sus operaciones, purga las entradas de undo que lo contenían, recarga `GET .../document` | "No pudimos aplicar un cambio: {detalle}. Hemos vuelto al último estado guardado" |
| `422 TPL_ASSET_NOT_OWNED` | código | igual que el anterior, más "esta foto ya no está disponible" | — |
| `422 TPL_BLOCK_UNKNOWN` | código | señal casi segura de que la versión de plantilla cambió bajo los pies: recarga completa del documento | "Tu plantilla se actualizó; recargamos tu invitación" |
| `403 TPL_FORBIDDEN` | status | detiene el autoguardado, pasa a solo lectura | "Ya no tienes acceso a esta invitación" |
| `401` | status | refresco de sesión y un reintento; si falla, redirección a login **conservando** `localStorage` de pendientes | — |
| `413` (body > 768 KiB, ADR-032) | status | trocea el lote a la mitad y reintenta una vez; si un lote de **una sola** operación excede, la descarta y avisa | "Ese texto es demasiado largo para guardarlo" |

Regla transversal: **el editor nunca se bloquea por un fallo de guardado**. El cliente puede seguir escribiendo; lo que cambia es el indicador y la insistencia del reintento.

### 12.6 Conflicto por `baseRevision`: qué ve el usuario (ausente por completo del borrador; objeción O-13, **alta**)

Prevención primero, resolución después.

**(a) Prevención — un solo editor por navegador.** `apps/web/lib/tab-lock.ts` usa `BroadcastChannel("tpl-editor:" + invitationId)`: al montar, la pestaña anuncia `CLAIM`; si otra responde `HELD` en 300 ms, la nueva entra en modo `tabRole:"readonly"` con el aviso "Esta invitación ya está abierta en otra pestaña. [Editar aquí de todas formas]" (que envía `TAKEOVER` y degrada a la otra). Esto elimina el caso más común del conflicto sin ninguna infraestructura de servidor.

**(b) Resolución — diálogo explícito, sin rebase automático.** `contratos.md` §2 fija "sin colaboración en tiempo real"; un rebase silencioso es una forma encubierta de fusión y puede perder escrituras sin que nadie lo note. Al recibir `409 {currentRevision, currentDocument}`:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Esta invitación cambió en otro lugar                                │
│                                                                      │
│  Alguien (o tú, en otro dispositivo) guardó cambios mientras editabas.│
│  Tienes 7 cambios sin guardar.                                       │
│                                                                      │
│  ○ Traer la versión nueva y perder mis 7 cambios     ← opción por     │
│  ○ Intentar aplicar mis 7 cambios sobre la versión nueva   defecto    │
│      (revisaremos uno por uno; los que ya no apliquen se descartarán) │
│  ○ Ver mis cambios antes de decidir                                   │
│                                                       [ Continuar ]  │
└──────────────────────────────────────────────────────────────────────┘
```
- **Opción 1 (por defecto, conservadora):** `state.queue = []; state.draft = []; undo = redo = []`; recarga con `GET .../document`.
- **Opción 2 (rebase asistido):** se adopta `currentDocument`/`currentRevision`; se recorren las operaciones pendientes en orden y se **revalida cada una** contra el manifiesto y el documento nuevo (mismo `invariants.ts`); las que siguen siendo aplicables se reenvían como lote nuevo con `baseRevision` fresca; las que no (bloque eliminado, ítem borrado por el otro editor, sección oculta) se **listan al usuario** antes de enviar nada. Nunca se aplica un rebase sin mostrar la lista.
- **Opción 3:** abre un panel de solo lectura con la lista de cambios pendientes en lenguaje natural (`UndoEntry.label`) y vuelve al diálogo.

Mientras el diálogo está abierto, `saveState = "conflict"` y `pump()` no envía nada; la edición del panel queda deshabilitada para no agrandar la cola.

### 12.7 Offline, persistencia local y cierre de pestaña

```ts
function persistLocally() {                     // llamado en cada enqueue y en cada respuesta
  try {
    localStorage.setItem("tpl:pending:" + invitationId, JSON.stringify({
      revision: state.revision, draft: state.draft,
      queue: state.queue.map(b => ({ clientBatchId: b.clientBatchId, ops: b.ops })),
      at: Date.now(), templateVersion: state.templateVersion,
    }));
  } catch { /* cuota llena o modo privado: se ignora, no es la fuente de verdad */ }
}

window.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden") return;
  const payload = buildBatchFromDraft();                  // colapsa draft en un lote
  if (!payload) return;
  const bytes = new Blob([JSON.stringify(payload)]).size;
  if (bytes < 60_000) {
    fetch(url, { method: "POST", keepalive: true, headers, body: JSON.stringify(payload) });
    // keepalive sobrevive al cierre de la pestaña y SÍ admite cabeceras (a diferencia de sendBeacon,
    // que no permite Authorization) [I]. Límite de la especificación: 64 KiB por petición keepalive.
  } else {
    flushDraft();                                          // intento normal; puede no terminar
  }
});

window.addEventListener("beforeunload", (e) => {
  if (state.draft.length === 0 && state.queue.length === 0 && !state.inFlight) return;
  e.preventDefault(); e.returnValue = "";                  // el navegador muestra su propio aviso
});
```
Al volver a abrir el editor, §7.5 ofrece recuperar lo que quedó en `localStorage`. La clave se borra en cuanto la cola queda vacía y confirmada. **Nota de alcance:** el `localStorage` vive en el documento del chrome (origen real); el lienzo no tiene acceso a él ni lo necesita (§8.1).

### 12.8 Edición sin conexión

No hay modo offline real: sin red no se pueden subir fotos ni resolver `assetId`, y el `compose()` autoritativo es del servidor. Lo que sí se garantiza: **las ediciones de texto y de estructura no se pierden** (cola + `localStorage` + reenganche a `window.online`), el editor sigue respondiendo, y el indicador dice la verdad en todo momento. La ausencia de un modo offline completo es deliberada y está registrada en `preguntas-abiertas.md`.

---

## 13. Imágenes: subida, recorte y punto focal

### 13.1 Biblioteca elegida: `react-image-crop@11.1.2`

| Candidata | Versión [V] | Licencia [V] | Tamaño empaquetado [V] | Dependencias [V] | Veredicto |
|---|---|---|---|---|---|
| **`react-image-crop`** | **11.1.2** | **ISC** | **115 367 B** | **ninguna** | **Elegida.** Solo produce el rectángulo de recorte; el pintado lo hace nuestro `<canvas>`. Sin dependencias, sin CSS-in-JS, `peer react >=16.13.1` (compatible con React 19) |
| `react-easy-crop` | 6.2.3 | MIT | 281 101 B | `normalize-wheel` | Más grande y con una dependencia transitiva, para la misma funcionalidad |
| `cropperjs` | 2.2.0 | MIT | — | — | API imperativa sobre componentes web; peor encaje con React 19 y con SSR |

Se carga con `next/dynamic(() => import("react-image-crop"), { ssr: false })` **solo** dentro del panel del editor: nunca entra en el paquete de `/i/[publicToken]` (§16).

### 13.2 Recorte y subida

```
1. El cliente elige un archivo (input o zona de soltar del panel).
2. Validación local: tipo ∈ {image/jpeg, image/png, image/webp}; tamaño ≤ ImageSpec.constraints.maxBytes
   del BlockSpec (por defecto 8 MiB, esquema/blocks.ts) — se avisa ANTES de subir 8 MB por la red.
3. Si ImageSpec.constraints.aspect !== "free", se abre el recorte con esa proporción fija
   (square 1:1, portrait 3:4, landscape 4:3, wide 16:9).
4. react-image-crop devuelve {x,y,width,height} en %. Se pinta en un <canvas> del tamaño destino
   (lado mayor ≤ 2000 px) y se exporta con canvas.toBlob("image/webp", 0.9).
5. POST .../assets (multipart) → { assetId, previewUrl } (03 §3.4).
6. setBlock({kind:"image", assetId, alt, focal:{x:0.5,y:0.5}}); el parche optimista usa `previewUrl`.
7. El `alt` es obligatorio salvo role === "decorative" (§17.4): el formulario no deja guardar sin él.
```

### 13.3 Recorte destructivo: limitación declarada

`ImageValue` (`esquema/blocks.ts`) guarda `assetId`, `alt` y `focal` — **no guarda rectángulo de recorte** [V]. Por tanto el recorte es **destructivo**: se sube la imagen ya recortada y el original no queda en el servidor. Consecuencias: no se puede "volver a encuadrar" una foto pasada la sesión, y volver a recortar exige subir el archivo otra vez. La alternativa no destructiva exigiría o bien un campo `crop` en `ImageValue` o bien un `parent_asset_id` en `tpl_asset` — **ambos fuera del alcance de este bloque** (`esquema/**` y `02` son de solo lectura para 1R-frontend). Registrado en `preguntas-abiertas.md` y en el handoff. Mitigación de fase 3: el archivo original se conserva en memoria (`File`) mientras dure la sesión, de modo que reencuadrar es inmediato hasta que el cliente recarga.

`focal` sigue siendo útil y **no** es redundante con el recorte: gobierna el `object-position` cuando la misma foto se pinta en proporciones distintas entre variantes o entre móvil y escritorio.

---

## 14. Reordenar con `dnd-kit`, accesible de verdad

Piezas: `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/accessibility@3.1.1` [V].

### 14.1 Configuración

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),   // no secuestra el clic simple
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);

<DndContext sensors={sensors} collisionDetection={closestCenter}
            accessibility={{ screenReaderInstructions, announcements }}
            onDragEnd={({active, over}) => { if (over && active.id !== over.id) reorderSections(nuevoOrden); }}>
  <SortableContext items={keys} strategy={verticalListSortingStrategy}> … </SortableContext>
  <DragOverlay>{activo ? <SectionRowGhost … /> : null}</DragOverlay>
</DndContext>
```

### 14.2 Teclado

El asa (`⠿`) es un `<button type="button">` con los `listeners` del `useSortable`, **nunca** un `<div>` con `tabindex`. Secuencia: `Tab` hasta el asa → `Espacio`/`Enter` levanta → `↑`/`↓` mueve → `Espacio`/`Enter` suelta → `Esc` cancela y devuelve a la posición inicial. `dnd-kit` lo implementa de fábrica con `KeyboardSensor` [I].

### 14.3 Anuncios ARIA en es-MX (obligatorios, no opcionales)

```ts
const screenReaderInstructions = { draggable:
  "Para reordenar, pulsa la tecla Espacio sobre el asa. Con la lista levantada, usa las flechas " +
  "arriba y abajo para mover el elemento. Pulsa Espacio de nuevo para soltarlo, o Escape para cancelar." };

const announcements = {
  onDragStart:  ({active}) => `Has levantado ${nombre(active)}. Está en la posición ${pos(active)} de ${total}.`,
  onDragOver:   ({active, over}) => over ? `${nombre(active)} se movió a la posición ${pos(over)} de ${total}.` : "",
  onDragEnd:    ({active, over}) => over
      ? `${nombre(active)} quedó en la posición ${pos(over)} de ${total}.`
      : `Se soltó ${nombre(active)} y volvió a su posición original.`,
  onDragCancel: ({active}) => `Se canceló el movimiento. ${nombre(active)} volvió a la posición ${pos(active)}.`,
};
```
`@dnd-kit/accessibility` monta la región `aria-live="assertive"` que los emite [I].

### 14.4 Alternativa sin arrastre — requisito **AA** de WCAG 2.2 (ausente del borrador; objeción O-14, **alta**)

El criterio **2.5.7 Dragging Movements (AA en WCAG 2.2)** exige que toda función que use arrastre tenga una alternativa de un solo puntero. Un asa accesible por teclado **no** lo satisface: hay que cubrir al usuario de puntero que no puede arrastrar (temblor, ratón de cabeza, pantalla táctil pequeña). Por eso cada fila lleva un menú `⋮` con **"Subir" / "Bajar" / "Mover al principio" / "Mover al final"**, que emiten exactamente la misma operación `reorderSections`. Lo mismo en el gestor de fotos con `moveItem`.

También aplica **2.5.8 Target Size (Minimum, AA)**: asas, interruptores y botones `⋮` miden al menos 24×24 px CSS con separación equivalente.

---

## 15. Render público: SSG/ISR, invalidación y metadatos

### 15.1 Estrategia de render

`/i/[publicToken]/page.tsx` es un React Server Component:

```tsx
export const dynamicParams = true;                    // los tokens no se conocen en tiempo de build
export const revalidate = 300;                        // suelo, coincide con Cache-Control de 03 §7

async function getRelease(token: string) {
  const res = await fetch(`${API}/public/i/${token}/render`, {
    next: { revalidate: 300, tags: [`invitation:${token}`] },   // ← la etiqueta es la clave de §15.2
  });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error("render-failed");
  return (await res.json()).composed as ComposedDocument;
}
```
No se usa `generateStaticParams`: los `publicToken` son opacos y de alta entropía (`03 §7`) y no hay ningún catálogo público de ellos; enumerarlos en build sería, además, exactamente lo que `TPL_RELEASE_NOT_FOUND` evita. La primera visita genera y cachea; las siguientes se sirven del caché.

### 15.2 Revalidación **al publicar** (mecanismo concreto; el borrador solo decía `revalidate: 300`)

```ts
// apps/web/app/api/revalidate/route.ts
import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";

export async function POST(req: Request) {
  const enviado = req.headers.get("x-revalidate-token") ?? "";
  const esperado = process.env.REVALIDATE_SECRET!;
  if (enviado.length !== esperado.length ||
      !timingSafeEqual(Buffer.from(enviado), Buffer.from(esperado))) {
    return new Response(null, { status: 401 });         // comparación en tiempo constante
  }
  const { publicToken } = await req.json();
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(publicToken)) return new Response(null, { status: 400 });
  revalidateTag(`invitation:${publicToken}`);
  return Response.json({ revalidated: true, at: Date.now() });
}
```
- **Quién lo llama:** el backend, justo después de que `POST .../release` confirme la transacción (`03 §2`) — **tarea de fase 2**, registrada en el handoff como cambio de contrato para `contratos.md` §8. Se llama también cuando `business` cambia y deja el release `stale` (`01 §5.3`).
- **Si la llamada falla** (frontend caído, red), el peor caso es que el invitado vea la versión anterior durante ≤ 300 s: el `revalidate: 300` es la red de seguridad. El backend registra el fallo pero **no** revierte la publicación.
- **`public_token` no cambia nunca al publicar** [V: `02 §2.4`, `tpl_document.public_token` es estable]. Es un identificador del *enlace*, no del *release*: publicar de nuevo actualiza el contenido del mismo enlace, que es justo lo que el cliente espera después de haberlo repartido por WhatsApp. Consecuencia: **no hay forma de "despublicar" cambiando el token**; retirar una invitación exige desactivar el release (`is_active`), tras lo cual `GET …/render` responde `404 TPL_RELEASE_NOT_FOUND` y la página muestra "Esta invitación ya no está disponible". Registrado en `preguntas-abiertas.md`: no existe hoy ruta para desactivar un release.
- Como el `ETag` del backend es el `contentHash` (`03 §7`), la revalidación con etiqueta y la del CDN coinciden: no hay dos verdades de caché.

### 15.3 Cero JavaScript innecesario

- La página es RSC pura: `packages/sections` no lleva ni un `"use client"` en modo `public` (regla de lint, §19.3).
- `ThemeProvider` en modo público **no** es un componente cliente: emite un `<style>` con las custom properties y las `@font-face` calculadas en el servidor.
- El único cliente es la isla de RSVP (§15.6) y, cuando exista, un botón "Añadir al calendario" — ambos con `next/dynamic`.
- Nada de `next-themes`, nada de animaciones con JS: las transiciones son CSS y respetan `prefers-reduced-motion` (§17.5).

### 15.4 Metadatos, privacidad e indexación

```tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const composed = await getRelease((await params).publicToken);
  const portada = buscarBloquePorRol(composed, "coverImage");
  return {
    title: tituloDe(composed),                       // rol coverTitle
    description: subtituloDe(composed),
    robots: { index: false, follow: false },         // ← una invitación es privada; jamás se indexa
    openGraph: { type: "website", locale: "es_MX", title: …, images: portada ? [portada.url] : [] },
    other: { "theme-color": composed.theme.tokens.bg },
  };
}
```
`robots: noindex` + la cabecera `X-Robots-Tag` de §8.4 C1. **El borrador anterior no lo mencionaba** y una invitación indexada expone nombres, dirección y fecha del evento de un cliente: objeción O-15, **alta** (privacidad, no rendimiento). `opengraph-image.tsx` genera la tarjeta de WhatsApp desde el servidor (no requiere el lienzo, §8.3).

### 15.5 `/preview/[invitationId]`

RSC autenticado que compone el **documento de trabajo** (`GET .../document` → `composed`) y lo pinta con `mode="public"`, sin chrome ni overlays. Usos: "ver antes de publicar", salida de degradación del lienzo (§8.8) y objetivo estable para las pruebas e2e de render sin la complejidad del iframe. `no-store` y `noindex`.

### 15.6 RSVP como isla

`RsvpSection` en modo `public` renderiza en el servidor el texto y la fecha límite, y monta un `<RsvpIsland>` cliente cargado con `next/dynamic({ ssr: true })` solo si la sección está visible. El módulo de RSVP está **fuera de alcance** (prompt maestro §1): aquí solo se fija su frontera para que su JavaScript no contamine el presupuesto del resto ni se cargue en invitaciones que ocultan esa sección.

---

## 16. Presupuestos de rendimiento: valores, medición y qué hacer al excederlos

### 16.1 Presupuestos (render público, móvil)

| Métrica | Objetivo | Cómo se consigue |
|---|---|---|
| **LCP** | **< 2,5 s** en móvil emulado (Moto G Power, 4G lento del preajuste móvil de Lighthouse) | Portada con `priority`/`fetchpriority="high"`, `next/image` con `sizes`, `<link rel="preload">` solo de la pareja tipográfica elegida (§5.5), HTML servido desde caché ISR |
| **JS de primera carga** | **< 150 KB gz** para `/i/[publicToken]` | RSC puro; la isla de RSVP es el único cliente; `react-image-crop`, `dnd-kit`, `react-hook-form`, `zustand` y shadcn/ui **no pueden** aparecer en esta ruta |
| HTML inicial | ≤ 100 KB gz para 12 secciones | El `ComposedDocument` no viaja al cliente como JSON: se convierte en HTML en el servidor |
| CLS | < 0,1 | `aspect-ratio` derivado de `ImageSpec.constraints.aspect` (declarado en el manifiesto, sin medir en tiempo de ejecución); `size-adjust` en las fuentes de reserva |
| INP | < 200 ms | Sin JS de edición; la isla de RSVP se hidrata aparte |
| Editor `/editor/[id]` | interactivo < 3 s en 4G | Sin presupuesto de Core Web Vitals: es una herramienta autenticada, no una página de conversión |

### 16.2 Cómo se mide (dos compuertas, ambas en el job `frontend`/`e2e` de CI, ADR-026)

**(a) Presupuesto de JavaScript — determinista, sin variabilidad.** `apps/web/scripts/check-budget.mjs` lee `.next/app-build-manifest.json` tras `next build`, toma la lista de *chunks* de la entrada `/i/[publicToken]`, los comprime con `zlib.gzipSync` y suma:

```js
const LIMITES = { "/i/[publicToken]": 150 * 1024, "/editor/[invitationId]": 600 * 1024 };
// ... suma gzip de los ficheros de cada ruta; process.exit(1) con un informe si excede.
```
Se ejecuta con `pnpm --filter web run budget` como paso obligatorio. Complemento de diagnóstico (no compuerta): `ANALYZE=1 pnpm --filter web build` con `@next/bundle-analyzer@16.3.4` para ver **qué** creció.

**(b) LCP y el resto de Core Web Vitals — Lighthouse CI.** `@lhci/cli@0.15.1` con `lhci autorun` sobre la app construida y una invitación de siembra (la de `boda-clasica-1.0.0`), preajuste `mobile`, **3 corridas y mediana** para amortiguar el ruido:

```jsonc
// lighthouserc.json
{ "ci": { "collect": { "numberOfRuns": 3, "settings": { "preset": "desktop" } },
          "assert": { "assertions": {
            "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
            "cumulative-layout-shift":  ["error", { "maxNumericValue": 0.1 }],
            "total-blocking-time":      ["warn",  { "maxNumericValue": 200 }],
            "categories:accessibility": ["error", { "minScore": 1 }] } } } }
```
(El preajuste real es `mobile`; se deja explícito en el archivo de fase 3.)

**Qué se hace si se excede.** La compuerta (a) **rompe el PR**, no avisa: un presupuesto que solo avisa se ignora. Orden de actuación fijado de antemano, para que fase 3 no improvise: 1) comprobar si algo del chrome se coló en la ruta pública (causa nº 1, la detecta la regla de lint de §19.4); 2) mover la isla de RSVP a carga diferida por interacción; 3) reducir pesos tipográficos (de 4 a 2); 4) subconjunto de fuentes más estrecho; 5) si nada basta, **subir el presupuesto exige una ADR**, nunca un cambio silencioso de la constante.

La compuerta (b) es de tipo `error` para LCP y CLS; si el ruido del runner la vuelve inestable se sube `numberOfRuns`, no se baja el umbral.

---

## 17. Accesibilidad: WCAG 2.2 nivel AA

### 17.1 Contraste: quién calcula el ratio y cuándo (el borrador lo dejaba "para el kit de fase 4")

Tres puntos de comprobación, ninguno opcional:

| Momento | Quién | Qué comprueba | Qué pasa si falla |
|---|---|---|---|
| **Registro de la plantilla** (`POST /master/templates2/versions`) | validador Kotlin, como invariante nueva del catálogo | por cada `Palette`: `ink/bg ≥ 4.5`, `ink/surface ≥ 4.5`, `accentInk/accent ≥ 4.5`, `muted/bg ≥ 3.0` (texto secundario grande), `accent/bg ≥ 3.0` (componentes de interfaz, 1.4.11) | rechazo del registro con `422 TPL_MANIFEST_INVALID` |
| **CI del frontend** | `packages/sections/test/contrast.test.ts` sobre **todos** los `theme.json` de `golden/` | las mismas cinco parejas | falla el job `frontend` |
| **e2e** | `@axe-core/playwright@4.13.0` sobre el render público de las dos plantillas de ejemplo y sobre el editor | contraste real ya pintado + el resto de reglas | cero violaciones críticas o serias (ADR-024) |

El cálculo es el de WCAG 2.x: linealizar cada canal sRGB (`c ≤ 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4`), luminancia `0.2126R + 0.7152G + 0.0722B`, ratio `(L1+0.05)/(L2+0.05)`. Vive en `packages/sections/src/theme/contrast.ts` (≈ 20 líneas, sin dependencias) y la implementación Kotlin espejo comparte tabla de casos, igual que las invariantes (ADR-005).

**Bloqueo de alcance:** la invariante de registro exigiría añadir `I-24_PALETTE_CONTRAST_BELOW_AA` a `esquema/invariants.ts`, archivo **prohibido** para este rol. Se propone en ADR-1R-F-06 y se registra como contradicción a dirimir con el bloque 01. Mientras no se acepte, la única compuerta mecánica es la de CI del frontend, que ya cubre las plantillas del repositorio pero no una plantilla registrada en producción.

### 17.2 Foco y teclado

- Todo control interactivo tiene foco visible propio (`:focus-visible` con un anillo de 2 px y 2 px de separación), nunca `outline: none` sin sustituto. Regla de lint sobre CSS (§19.2).
- **2.4.11 Focus Not Obscured (Minimum), AA en WCAG 2.2**: la barra superior del chrome es `position: sticky`; al recorrer con `Tab` el elemento enfocado no puede quedar tapado por ella. Se garantiza con `scroll-padding-top` igual al alto de la barra en el contenedor de scroll del panel.
- Salto de foco: al recibir `BLOCK_CLICKED` del lienzo, el foco pasa al primer campo del formulario del panel y se anuncia la sección y el campo por la región `aria-live` del chrome. Sin este anuncio, el usuario de lector de pantalla no sabe que el panel cambió.
- Orden de tabulación: chrome → lista de secciones → panel de sección → lienzo (que es un único parada de tabulación; dentro, el propio iframe gobierna su orden). El `<iframe>` lleva `title="Vista previa de la invitación"` — sin él, el lector de pantalla lo anuncia como "marco" sin más.
- Atajos: `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+S` (fuerza guardado), `Esc` (cierra el panel de bloque). Todos con equivalente visible en la interfaz (nunca solo atajo). Cuando el foco está dentro del lienzo llegan por `KEY_COMMAND` (§9.4).
- **2.5.7 Dragging Movements** y **2.5.8 Target Size**: §14.4.

### 17.3 Estructura semántica del render público

- `<html lang="es-MX">` en `app/layout.tsx`; si `composed.locale` fuera otro, la ruta pública lo sobrescribe con `generateMetadata`.
- Un solo `<h1>` (el título de portada, rol `coverTitle`). Cada sección es `<section aria-labelledby="s-{key}">` con un `<h2>`; los subtítulos dentro de una sección son `<h3>`. **El nivel lo decide la posición en el documento, nunca el tamaño visual** — el tamaño lo da el token, no la etiqueta.
- Listas repetibles (`GroupBlock`) se pintan como `<ul>`/`<li>`, no como `<div>` sueltos.
- `<time datetime="…">` para fechas y horas, con el texto formateado como contenido.
- Enlaces con texto significativo: nunca "aquí" ni "ver más" sin contexto (`LinkValue.label`, si falta, cae al *host* del `href`).

### 17.4 Imágenes

`ImageSpec` exige `alt` en `content` (`esquema/blocks.ts`: `ImageValue.alt` es obligatorio [V]). El editor no deja guardar una imagen sin texto alternativo salvo que el bloque tenga `role: "decorative"`, en cuyo caso se pinta `alt="" aria-hidden="true"` y el campo desaparece del formulario. El mensaje de ayuda del campo es concreto ("Describe la foto para quien no puede verla, p. ej. 'Ana y Luis abrazados frente al mar'"), no "Texto alternativo (obligatorio)".

### 17.5 Movimiento

Toda transición o animación de `packages/sections` se envuelve en `@media (prefers-reduced-motion: reduce) { animation: none; transition: none; scroll-behavior: auto; }`. El `scrollIntoView({behavior:"smooth"})` del lienzo pasa a `"auto"` cuando la consulta de medio está activa. El audio de fondo (`backgroundMusic`) **nunca** se reproduce automáticamente: control explícito, silenciado por defecto (1.4.2 Audio Control).

### 17.6 Seguridad de `richText` (restricción heredada, se mantiene)

`RichTextBlock` mapea `RichDoc` a elementos React uno a uno (`<p>`, `<strong>`, `<em>`, `<a href>` con la misma validación `HttpUrl`). **Prohibido `dangerouslySetInnerHTML` y prohibido serializar a cadena HTML.** Si fase 3 usa Tiptap para el campo de edición, su salida HTML se convierte a `RichDoc` **en el borde** (en el `onChange` del campo), y jamás se persiste ni se renderiza HTML crudo. Regla de lint dura (§19.3).

### 17.7 Idioma y textos

Todas las cadenas de interfaz en es-MX viven en `apps/web/lib/i18n.ts` como un objeto tipado (sin biblioteca de i18n: hay un solo idioma de interfaz). Los textos de la invitación vienen del documento y su idioma lo declara `doc.meta.locale` (`I-23` exige que esté entre los `locales` de la plantilla [V]).

---

## 18. Componentes base accesibles del chrome

Todos salen de shadcn/ui (Radix) **copiados al repositorio**, con las cadenas traducidas a es-MX. Lo que fase 3 debe respetar:

| Componente | Rol/patrón ARIA | Teclado | Notas propias |
|---|---|---|---|
| `Button` | `button` | Enter/Espacio | Estado ocupado con `aria-busy`, nunca solo un *spinner* |
| `Switch` (mostrar/ocultar sección) | `switch` con `aria-checked` | Espacio | Etiqueta que nombra la sección: "Mostrar Nuestra historia" |
| `Dialog` (publicar, conflicto, confirmaciones) | `dialog` modal | Esc cierra (salvo el de conflicto y el de publicación en curso), foco atrapado, foco devuelto al abridor | `aria-labelledby` + `aria-describedby` obligatorios |
| `Tabs` (secciones / apariencia / fotos) | `tablist`/`tab`/`tabpanel` | ←/→, Home/End | Activación manual (no automática al enfocar) |
| `Select` / `RadioGroup` (variante, `choice`) | `radiogroup` para ≤ 5 opciones; `combobox` por encima | ↑/↓, escritura para saltar | El selector de variante es un `radiogroup` con miniaturas: cada opción tiene texto, no solo imagen |
| `Popover` (menú `⋮` de sección) | `menu`/`menuitem` | ↑/↓, Esc, Home/End | Contiene la alternativa sin arrastre de §14.4 |
| `Tooltip` | `tooltip` con `aria-describedby` | visible con foco, no solo con ratón | Nunca es el único portador de información |
| `Toast` (guardado, errores transitorios) | región `status` (`aria-live="polite"`) | — | Los errores que exigen decisión **no** son *toast*: son diálogo o banner persistente |
| `Progress` (subida de fotos) | `progressbar` con `aria-valuenow` | — | Con texto numérico visible |
| `SaveIndicator` | región `status` | — | Cambia de "Guardando…" a "Guardado 12:41"; nunca solo un icono |
| `Slider` (punto focal) | `slider` × 2 (x, y) con `aria-valuetext` en palabras ("centro", "arriba a la izquierda") | flechas, Home/End | Alternativa de teclado al arrastre del punto focal (2.5.7) |
| `CanvasFrame` | `<iframe title="Vista previa de la invitación">` | una sola parada de tabulación | Ver §17.2 |

---

## 19. Separación dura entre el *chrome* del editor y los tokens de la invitación

Prompt maestro §7: "shadcn/ui + Tailwind para el *chrome* del editor; las plantillas de invitación tienen su propio sistema de tokens". Aquí se convierte en cuatro mecanismos, no en una recomendación:

1. **Frontera de proceso.** El lienzo del editor es un documento distinto (§8): el CSS del chrome **no puede** alcanzarlo, ni por herencia ni por especificidad. Y en la ruta pública el chrome sencillamente no existe. Este es el argumento funcional más fuerte a favor de ADR-018, por encima del aislamiento de fallos.
2. **Frontera de dependencias.** `packages/sections/package.json` **no declara `tailwindcss`** (§2.1). Las secciones se estilan con CSS Modules y solo pueden usar `var(--inv-*)`. Comprobación en CI: `grep -REn "className=\"[^\"]*(bg-|text-|p-|m-|flex |grid )" packages/sections/src` debe salir vacío.
3. **Frontera de importaciones (ESLint).** En `eslint.config.mjs`:
   - `packages/sections/**`: `no-restricted-imports` sobre `@/components/**`, `next/*` (salvo `next/image`), `zustand`, `react-hook-form`, `@radix-ui/*`, `lucide-react`; `no-restricted-syntax` sobre `dangerouslySetInnerHTML`, `alert(`, `confirm(`, `localStorage`, `document.cookie`.
   - `apps/web/app/i/**` y `apps/web/app/preview/**`: prohibido importar de `apps/web/components/editor/**`, `lib/store`, `lib/undo`, `lib/autosave`, `lib/canvas-*`.
   - `apps/web/app/editor/[invitationId]/canvas/**`: prohibido importar `lib/api-client`, `lib/store` y `../../globals.css`; prohibido `fetch(`.
4. **Frontera de nombres.** Prefijo `--inv-` para los tokens de invitación; el chrome usa los tokens de Tailwind v4 (`--color-*`, `--spacing-*`). Colisión imposible por construcción, y un `grep` de `--inv-` fuera de `packages/sections` señala una fuga.

---

## 20. Estrategia de pruebas (P9), con escenarios nombrados

Coherente con `06-pruebas-y-calidad.md` §1-§2 (umbrales: `packages/sections` ≥ 70 % líneas; `packages/schema` 100 % de esquemas con caso positivo y negativo; e2e del flujo principal + deshacer + ocultar/reordenar; cero violaciones `axe` críticas o serias).

### 20.1 Pruebas de componente (Vitest 5.0.0 + Testing Library 16.3.3 + jsdom 30.0.1)

| Id | Escenario | Aserción principal |
|---|---|---|
| U-01 | `CoverSection` con `variant` no soportada | pinta `defaultVariant` y emite `RENDER_WARNING code:"unknown-variant"` |
| U-02 | Bloque con `value: null` | no renderiza ningún nodo para ese bloque (R2/R5) |
| U-03 | `ImageBlock` con `role:"decorative"` | `alt=""` y `aria-hidden="true"` |
| U-04 | `RichTextBlock` con marcas `bold`+`italic` y `href` | produce `<strong><em><a>`; **cero** `innerHTML` (se afirma sobre el HTML serializado) |
| U-05 | `GroupBlock` con 3 ítems | `<ul>` con 3 `<li>`, en el orden de `items` (R7) |
| U-06 | `ThemeProvider` con la paleta `olive` | las seis custom properties `--inv-color-*` con los valores del `theme.json` |
| U-07 | Misma sección en `mode:"public"` y `mode:"canvas"` | el HTML público **no** contiene `data-block-*` ni manejadores; la instantánea de texto es idéntica |
| U-08 | `contrast.ts` con las tres paletas de `boda-clasica` | las cinco parejas de §17.1 cumplen su umbral |
| U-09 | Reductor `setBlock` sobre un bloque en `default` | la inversa es `clearBlock`, no `setBlock(default)` (O-08) |
| U-10 | Coalescencia: teclear en A, saltar a B, teclear | dos entradas de undo, no una (O-07) |
| U-11 | `applyIdMap` con un `addItem` deshecho | la entrada de undo apunta al ULID, no al `tmp:` (O-11) |
| U-12 | `flushDraft` con 120 operaciones | tres lotes de 50/50/20, enviados en orden, uno en vuelo cada vez |
| U-13 | 409 con "descartar mis cambios" | cola, borrador y ambas pilas quedan vacías; `revision` es la del servidor |
| U-14 | 409 con "rebase asistido" | las operaciones sobre un bloque desaparecido se listan y no se envían |
| U-15 | `canvas-protocol`: mensaje con `v: 2` | `safeParse` falla y el puente pasa a estado "incompatible" |
| U-16 | `visibilitychange` con borrador pequeño | se emite un `fetch` con `keepalive: true` |
| U-17 | `BlockForm` de un `TextSpec` con `maxLength: 40` | impide guardar con 41 caracteres y anuncia el error con `aria-describedby` |
| U-18 | `SectionRow` con `required: true` | no existe el interruptor; la fila dice "siempre visible" |

### 20.2 Pruebas e2e (Playwright 1.62.1, Chromium de `/opt/pw-browsers`)

| Archivo | Escenario | Criterio |
|---|---|---|
| `flujo-principal.spec.ts` | **E-01** elegir plantilla → editar dos textos → subir y recortar una foto → cambiar paleta → ocultar una sección → publicar → abrir `/i/{token}` | el texto editado aparece en la página pública; la sección oculta no; **exigido por ADR-024** |
| `deshacer.spec.ts` | **E-02** escribir, deshacer, rehacer, recargar la página | tras recargar, el estado coincide con lo último confirmado |
| `secciones.spec.ts` | **E-03** reordenar con ratón; **E-04** reordenar **solo con teclado**; **E-05** reordenar con el menú `⋮` (sin arrastre) | los tres producen el mismo `reorderSections` y el mismo orden en el lienzo |
| `conflicto.spec.ts` | **E-06** dos contextos de navegador editan la misma invitación; el segundo recibe 409 | aparece el diálogo de §12.6 y ninguna de las dos ediciones se pierde en silencio |
| `canvas-isolation.spec.ts` | **E-07** la lista A1-A8 de §8.5 | compuerta de la arquitectura del lienzo |
| `a11y.spec.ts` | **E-08** `axe` sobre `/i/{token}` de las dos plantillas; **E-09** `axe` sobre `/editor/{id}`; **E-10** recorrido completo por teclado del editor sin trampas de foco | cero violaciones críticas o serias (ADR-024) |
| `presupuesto.spec.ts` | **E-11** `check-budget.mjs` + `lhci` sobre la invitación de siembra | §16.2 |
| `errores.spec.ts` | **E-12** red cortada a mitad de edición y restaurada | el indicador pasa por "sin conexión" y termina en "Guardado"; ninguna operación se pierde |

### 20.3 Datos de prueba

Los e2e siembran contra el backend real de CI usando los golden de `packages/schema/golden/` (las mismas carpetas `boda-clasica-1.0.0` y `xv-jardin-1.0.0` de `diseno/ejemplos/`). Sin *mocks* de la API en e2e: un e2e con la API simulada no habría detectado ninguno de los defectos de contrato que esta revisión encontró.

---

## 21. Versiones npm verificadas (`npm view <pkg> version`, 2026-09-03)

Salidas reales en `memoria/bitacora/1R-frontend.md`.

| Paquete | Última publicada [V] | Fijada aquí | Nota |
|---|---|---|---|
| next | 16.3.4 | 16.3.4 | `peerDependencies`: react `^18.2.0 \|\| ^19.0.0` [V] |
| react / react-dom | 19.2.8 | 19.2.8 | |
| **typescript** | **7.0.2** (`latest`, 2026-07-08) | **5.9.3** | **Cambio respecto a `0-inventario.md`**, ver §21.1 y ADR-1R-F-01 |
| zod | 4.5.4 | 4.5.4 | exacta (ADR-004) |
| zustand | 5.0.15 | 5.0.15 | |
| immer | 11.1.18 | 11.1.18 | |
| react-hook-form | 7.87.0 | 7.87.0 | |
| @hookform/resolvers | 5.9.1 | 5.9.1 | |
| @dnd-kit/core | 6.3.1 | 6.3.1 | |
| @dnd-kit/sortable | 10.0.0 | 10.0.0 | |
| @dnd-kit/accessibility | 3.1.1 | 3.1.1 | **añadido**: región `aria-live` de §14.3 |
| tailwindcss / @tailwindcss/postcss | 4.3.3 | 4.3.3 | solo en `apps/web` (§19) |
| vitest / @vitest/coverage-v8 | 5.0.0 | 5.0.0 | `peer` vite `^6.4 \|\| ^7 \|\| ^8` [V]; vite 8.2.2 disponible |
| @vitejs/plugin-react | 6.1.1 | 6.1.1 | |
| @testing-library/react | 16.3.3 | 16.3.3 | |
| @testing-library/user-event | 14.6.7 | 14.6.7 | |
| jsdom | 30.0.1 | 30.0.1 | |
| jest-axe | 11.0.0 | 11.0.0 | a11y en pruebas de componente |
| @playwright/test | 1.62.1 | 1.62.1 | `next` lo declara como peer opcional `^1.51.1` [V] |
| @axe-core/playwright / axe-core | 4.13.0 | 4.13.0 | |
| **react-image-crop** | **11.1.2** | 11.1.2 | **ISC**, 115 367 B, **cero dependencias** [V] — §13.1 |
| react-easy-crop | 6.2.3 | — | descartada (281 101 B, 1 dependencia) |
| cropperjs | 2.2.0 | — | descartada |
| @radix-ui/react-dialog | 1.1.23 | 1.1.23 | base de shadcn/ui |
| class-variance-authority | 0.7.1 | 0.7.1 | |
| tailwind-merge | 3.6.0 | 3.6.0 | |
| lucide-react | 1.40.0 | 1.40.0 | importar icono a icono (el paquete completo son 31,8 MB sin comprimir [V]) |
| turbo | 2.10.12 | 2.10.12 | |
| pnpm | 11.25.0 | 11.25.0 | `packageManager` |
| eslint | 10.9.1 | 10.9.1 | |
| typescript-eslint | 8.69.0 | 8.69.0 | **`peerDependencies.typescript: ">=4.8.4 <6.1.0"`** [V] |
| @next/bundle-analyzer | 16.3.4 | 16.3.4 | diagnóstico de §16.2 |
| @lhci/cli | 0.15.1 | 0.15.1 | compuerta de LCP |
| @types/react / @types/react-dom / @types/node | 19.2.18 / 19.2.7 / 26.4.1 | idem | `vitest` pide `@types/node ^22 \|\| >=24` [V] |
| @tiptap/react | 3.31.2 | **no se adopta en v1** | §22: `richText` con marcas `bold`/`italic` y enlaces no justifica 200 KB; se implementa con un editor propio mínimo sobre el `RichDoc` |
| zod-to-json-schema | 3.25.2 | **eliminada** | ADR-004 ya la retiró |
| zundo | 2.3.0 | **no se adopta** | ADR-019 (pila propia) |

### 21.1 TypeScript: por qué se fija 5.9.3 y no 7.0.2 (ADR-1R-F-01)

Evidencia del registro, obtenida en esta sesión:

```
$ npm view typescript dist-tags
{ latest: '7.0.2', rc: '7.0.1-rc', beta: '6.0.0-beta', next: '7.1.0-dev.20260903.1' }
$ npm view typescript time   → 7.0.2 publicado 2026-07-08; 6.0.3 el 2026-04-16; 5.9.3 el 2025-09-30
$ npm view typescript-eslint version peerDependencies
version = '8.69.0'
peerDependencies = { eslint: '^8.57.0 || ^9.0.0 || ^10.0.0', typescript: '>=4.8.4 <6.1.0' }
$ npm view next@16.3.4 dependencies   → no declara typescript
$ npm view vitest@5.0.0 peerDependencies → no declara typescript
```
Lectura: `next` y `vitest` no fijan un rango de TypeScript, así que **el conflicto no está en ellos**; está en la cadena de *lint* con información de tipos, que es obligatoria para este proyecto (ADR-005 exige una regla de lint sobre `packages/schema`, y `06 §5` la formaliza). `typescript-eslint@8.69.0`, la última publicada, **excluye explícitamente TypeScript ≥ 6.1**, y por tanto toda la línea 7.x [V]. Adoptar 7.0.2 dejaría el proyecto sin *linting* con tipos desde el primer commit, o forzaría a ignorar el aviso de versión no soportada de la herramienta — dos formas de empezar debiendo.

Decisión: **`typescript@5.9.3`** (última 5.x, publicada 2025-09-30 [V]), exacta y compartida por los tres paquetes. Se revisa cuando `typescript-eslint` publique soporte de 7.x. `6.0.3` entra en el rango soportado pero es una versión puente sin ventaja para nosotros; 5.9.3 es la opción conservadora.

---

## 22. Lo que no pude determinar (y el supuesto tomado)

| # | Asunto | Supuesto conservador tomado |
|---|---|---|
| H-F-01 | `03-api.md` §2 **no lista ninguna ruta de catálogo de plantillas para el cliente**, pero el flujo A la necesita (paso 1) | Se asume `GET /public/templates2/catalog?eventKind&planTier` devolviendo `{slug, version, name, previewImageUrl, minPlanTier}`. **Cambio de contrato pendiente**: bloque 03 |
| H-F-02 | Edición táctil real desde el móvil del cliente | Editor desktop-first; la vista móvil es solo visualización (supuesto heredado del borrador, se mantiene) |
| H-F-03 | Retención del archivo original tras el recorte | Recorte destructivo; original solo en memoria de sesión (§13.3) |
| H-F-04 | No existe ruta para **desactivar** un release (retirar una invitación publicada) | El enlace se retira desactivando `is_active`; falta el endpoint. Registrado |
| H-F-05 | Miniatura por invitación (para un futuro panel "mis invitaciones") | No se genera en el cliente (§8.3); si se necesita, se genera en el servidor |
| H-F-06 | `SectionSpec.variants` es `Ident[]` **sin imagen ni etiqueta por variante** [V], pero el editor promete "elegir entre miniaturas" | El selector usa etiquetas es-MX y diagramas SVG del registro de secciones (§5.2 `variantLabels`), no fotos |
| H-F-07 | Origen y certificado de un posible `lienzo.<dominio>` (contingencia §8.6) | No se solicita hoy; solo se activa si falla la compuerta de §8.5 |
| H-F-08 | Comportamiento exacto de `next/font` y de la CSP `'self'` dentro de un origen opaco | Marcado `[I]`; la compuerta A2/A4 de §8.5 lo verifica empíricamente antes de construir sobre ello |
| H-F-09 | Texto enriquecido: ¿Tiptap o editor propio? | Editor propio mínimo sobre `RichDoc` (negrita, cursiva, enlace) para no cargar 200 KB por dos marcas; se reevalúa si aparecen más marcas |

---

## 23. Revisión independiente (1R-frontend)

Ronda 1R, 2026-09-03. Revisión adversarial del documento producido por `1-frontend` (103 líneas) y profundización en sitio hasta grado de implementación. Objeciones de severidad **alta** y **media**; las bajas se corrigieron sin tabla.

### 23.1 Objeciones y su corrección

| Id | Sev. | Objeción y evidencia | Corrección aplicada | Estado |
|---|---|---|---|---|
| O-01 | **Alta** | El borrador validaba los mensajes del lienzo con `event.origin === window.location.origin`. Un iframe `sandbox="allow-scripts"` sin `allow-same-origin` tiene **origen opaco** y sus mensajes llegan con `origin === "null"` [I]: la comprobación **descartaría todos los mensajes** y el editor no funcionaría | §8.2 y §9.2: el padre valida por `event.source`/`MessagePort` + *nonce*; el hijo valida `event.origin` contra el origen real del padre; saludo con `MessageChannel` | Corregido |
| O-02 | Media | Sin mensaje para medir el alto del lienzo; el padre no puede leer `contentDocument` | `CANVAS_RESIZED` (§9.4) con `ResizeObserver` dentro del iframe | Corregido |
| O-03 | Media | Protocolo sin versión, sin `seq`, sin tiempos de espera, sin cola previa al `READY`, sin política de reintento | §9.1-§9.2: sobre versionado, `seq` monótono, 5 s/3 s, cola de mensajes previos, reconstrucción por estado | Corregido |
| O-04 | Media | `RENDER` con el `ComposedDocument` completo en cada tecla (≈100-200 KB por pulsación tras el debounce) | Mensaje `PATCH` delta para escalares; `RENDER` solo en cambios estructurales (§9.3) | Corregido |
| O-05 | **Alta** | Ctrl+Z deja de funcionar en cuanto el foco entra en el lienzo: los eventos de teclado no cruzan la frontera de documento [I] | `KEY_COMMAND` (§9.4, §7.2) | Corregido |
| O-06 | Media | No se decía qué pasa con las pilas de undo tras cambiar de plantilla o restaurar una revisión: las inversas apuntarían a `blockId` inexistentes → `422 TPL_BLOCK_UNKNOWN` en cascada | §11.4: vaciado explícito de las pilas en cuatro situaciones | Corregido |
| O-07 | Media | La coalescencia del undo estaba atada al debounce de 2 s: escribir en un campo, saltar a otro y seguir dentro de la misma ventana fusionaba dos campos en un solo paso de deshacer | §11.2: la coalescencia depende de `coalesceKey`, de 1500 ms de inactividad y del `blur`, no del temporizador de guardado | Corregido |
| O-08 | **Alta** | «la inversa de `setBlock` es `setBlock` con el valor previo»: si el bloque estaba en `provenance: default`, esa inversa **promueve el contenido de demostración a contenido de usuario**, quita el `blockId` de `report.stillDefault` y desactiva el bloqueo de publicación de `03 §6` — es decir, reabre H-03 desde el editor | §10.3: si no había valor de usuario, la inversa es `clearBlock`; prueba U-09 | Corregido |
| O-09 | Media | Deshacer un `removeItem` no puede restaurar el `itemId` (ULID del servidor, ADR-015) y el borrador no lo decía | §10.3: limitación declarada, valores restaurados con `tempId` nuevo | Documentado |
| O-10 | Media | Debounce que se reprograma con cada tecla, sin `maxWait`: escribir sin pausa deja de guardar indefinidamente | §12.1: `maxWait` de 10 s; disparo inmediato para operaciones no textuales | Corregido |
| O-11 | **Alta** | El `idMap` (`tmp:` → ULID) de `03 §3.3` no aparecía en `04`. Sin reescribirlo, las entradas de undo, las operaciones en cola y la selección quedan apuntando a ids que el servidor ya no reconoce | §12.3: `applyIdMap` sobre borrador, cola, ambas pilas y selección; prueba U-11 | Corregido |
| O-12 | Media | El parche optimista no podía calcular `ResolvedValue.formatted` de fecha/hora sin duplicar el formateador del servidor (riesgo de repetir H-27) | §12.4: esos tipos no se parchean; el bloque queda `aria-busy` hasta la respuesta | Corregido |
| O-13 | **Alta** | El conflicto `409 TPL_REVISION_CONFLICT` (`03 §3.3`) **no se trataba en ningún punto** del documento: no había ni interfaz ni política | §12.6: prevención con `BroadcastChannel` + diálogo de tres opciones, sin rebase automático; pruebas U-13, U-14, E-06 | Corregido |
| O-14 | **Alta** | El reordenamiento solo por arrastre incumple **WCAG 2.2 AA 2.5.7 Dragging Movements**, que el propio brief exige; el borrador no mencionaba ninguna alternativa de un solo puntero | §14.4: menú "Subir/Bajar/Al principio/Al final" con la misma operación; §14.3 anuncios en es-MX; prueba E-05 | Corregido |
| O-15 | **Alta** | La ruta pública no declaraba `noindex`: una invitación indexada expone nombre, dirección y fecha del evento de un cliente | §15.4: `robots: {index:false}` + cabecera `X-Robots-Tag` en `/i/**` | Corregido |
| O-16 | **Alta** | Las **tipografías** no se trataban en absoluto, siendo el único recurso del lienzo que sí depende del origen: en un iframe opaco las peticiones de fuente van en modo CORS y sin `Access-Control-Allow-Origin` la vista previa pinta con la fuente de reserva y **miente** sobre lo que verá el invitado | §5.5 (autoalojado por `bundled` o por `next/font` con lista blanca) + §8.4 C1 (cabeceras CORS) + comprobación A2 de §8.5 | Corregido |
| O-17 | **Alta** | La CSP del lienzo no estaba especificada, y `'self'` **no coincide con nada** en un origen opaco [I]: una CSP escrita del modo habitual bloquearía los propios *scripts* del lienzo | §8.4 C2: CSP con hosts explícitos y `nonce`, `connect-src 'none'`; comprobación A4 | Corregido |
| O-18 | Media | "Payload HTML inicial ≤ 150 KB gzip" mezclaba HTML y JS y no decía cómo se mide ni qué pasa al excederlo | §16: presupuestos separados (JS < 150 KB gz, HTML ≤ 100 KB gz), medición con `check-budget.mjs` + `@lhci/cli`, y el orden de actuación al excederlos | Corregido |
| O-19 | Media | El contraste se delegaba al kit de fase 4 sin decir quién calcula ni cuándo | §17.1: tres puntos de comprobación con la fórmula y las cinco parejas; ADR-1R-F-06 para la invariante de registro | Corregido / dependencia |
| O-20 | Media | La biblioteca de recorte quedaba "para fase 3" | §13.1: `react-image-crop@11.1.2`, ISC, 115 KB, cero dependencias [V], con las descartadas y su motivo | Corregido |
| O-21 | Media | Sin árbol de archivos real, sin `package.json`, sin forma del `sectionRegistry` ni contrato de componente: el documento no era implementable | §2, §2.1, §5.2, §5.3 | Corregido |
| O-22 | Media | La separación chrome/tokens era una recomendación en prosa | §19: cuatro mecanismos comprobables (proceso, dependencias, ESLint, prefijo) | Corregido |
| O-23 | Media | `revalidate: 300` sin ningún mecanismo de invalidación al publicar: el invitado podía ver la versión anterior hasta 5 minutos después de que el cliente publicara | §15.2: webhook `POST /api/revalidate` con secreto comparado en tiempo constante + `revalidateTag`; `revalidate: 300` queda como red de seguridad | Corregido |
| O-24 | Media | `TypeScript 7.0.2` en la tabla de `0-inventario.md` sin verificar la cadena de herramientas | §21.1: `typescript-eslint@8.69.0` declara `typescript: ">=4.8.4 <6.1.0"` [V] ⇒ se fija `5.9.3`; ADR-1R-F-01 | Corregido |
| O-25 | Baja→Media | El borrador justificaba la ausencia de edición en línea por el aislamiento del iframe, lo cual es falso | §4: la justificación real es P7/P1; divergencia con `investigacion` §3.1 registrada | Corregido |

Objeciones de severidad baja corregidas sin entrada propia: nombres de mensaje divergentes entre ADR-018 y la tabla del borrador (unificados en §9, con nota en ADR-1R-F-03); ausencia de `title` en el `<iframe>`; ausencia del estado de degradación cuando el lienzo no arranca (§8.8); ausencia de estados de carga y error en los flujos (§7.1); ausencia de wireframes (§6).

### 23.2 Versiones npm verificadas en esta revisión

Consulta real con `npm view <pkg> version` el **2026-09-03** (registro `registry.npmjs.org`, npm 10.9.7 / Node 22). Tabla completa en §21; resumen de lo que **cambia** respecto de `handoffs/0-inventario.md` §7:

| Paquete | `0-inventario.md` | Esta revisión | Motivo |
|---|---|---|---|
| typescript | 7.0.2 | **5.9.3** | `typescript-eslint@8.69.0` excluye ≥ 6.1 [V] — ADR-1R-F-01 |
| zundo | 2.3.0 (listada) | **no se usa** | ADR-019 (pila propia) |
| zod-to-json-schema | 3.25.2 (listada) | **eliminada** | ADR-004 |
| @tiptap/react | 3.31.2 (listada) | **no se adopta en v1** | §22 H-F-09 |
| @dnd-kit/accessibility | ausente | **3.1.1** | §14.3 |
| react-image-crop | ausente | **11.1.2** | §13.1 |
| @axe-core/playwright / axe-core | ausentes | **4.13.0** | §17.1 |
| jest-axe | ausente | **11.0.0** | §20.1 |
| @lhci/cli | ausente | **0.15.1** | §16.2 |
| @next/bundle-analyzer | ausente | **16.3.4** | §16.2 |
| eslint / typescript-eslint | ausentes | **10.9.1 / 8.69.0** | §19.3 |
| @vitejs/plugin-react, @testing-library/*, jsdom | ausentes | 6.1.1 / 16.3.3 / 14.6.7 / 30.0.1 | §20.1 |
| @radix-ui/react-dialog, class-variance-authority, tailwind-merge, lucide-react | ausentes | 1.1.23 / 0.7.1 / 3.6.0 / 1.40.0 | shadcn/ui |
| @types/react, @types/react-dom, @types/node | ausentes | 19.2.18 / 19.2.7 / 26.4.1 | §2.1 |

El resto de la tabla de `0-inventario.md` §7 se **confirmó sin cambios** (next 16.3.4, react/react-dom 19.2.8, zod 4.5.4, zustand 5.0.15, immer 11.1.18, react-hook-form 7.87.0, @hookform/resolvers 5.9.1, @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0, tailwindcss 4.3.3, @playwright/test 1.62.1, vitest 5.0.0, turbo 2.10.12, pnpm 11.25.0).

### 23.3 ADR propuestas por esta revisión

`ADR-1R-F-01` TypeScript 5.9.3 · `ADR-1R-F-02` compuerta de aislamiento del lienzo y contingencia de origen dedicado · `ADR-1R-F-03` protocolo `postMessage` v1 con `MessageChannel` · `ADR-1R-F-04` semántica de la pila de undo (inversa de `setBlock` sobre un `default` es `clearBlock`) · `ADR-1R-F-05` política de conflicto `baseRevision` sin rebase automático + bloqueo entre pestañas · `ADR-1R-F-06` validación de contraste en tres puntos e invariante `I-24` (depende del bloque 01) · `ADR-1R-F-07` tipografías autoalojadas y lista blanca de familias · `ADR-1R-F-08` `section-variants.json` emitido y validado en el registro de plantillas · `ADR-1R-F-09` invalidación de ISR al publicar por webhook con secreto.

Texto completo al final de `memoria/decisiones.md`, estado **propuesta**.
