// frontend/eslint.config.mjs — configuración plana raíz (ESLint 10), compartida por todos los
// paquetes del monorepo (`04-frontend-y-editor.md` §2, §19.3). Cada paquete corre `eslint <dir>`
// desde su propio `package.json`; este archivo es la única fuente de reglas.
//
// NOTA (bitácora 3-1): `frontend/packages/schema/**` es de solo lectura para este bloque
// (prohibido tocar su código y su `package.json`). Su script `lint` sigue siendo el placeholder
// que dejó la fase 2 ("lint: pendiente"); las reglas de ADR-005 (`no-restricted-syntax` sobre
// `.refine`/`.superRefine`/`.transform`/`.catch`/`z.any`) SÍ están declaradas aquí, alcanzables con
// `pnpm exec eslint packages/schema/src` desde `frontend/`, pero `turbo run lint` no las ejecuta
// contra `schema` hasta que ese paquete deje de ser de solo lectura y actualice su propio script.
// Registrado en `memoria/preguntas-abiertas.md`.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

const reglasEsquemaADR005 = {
  "no-restricted-syntax": [
    "error",
    {
      selector: "CallExpression[callee.property.name='refine']",
      message: "ADR-005: .refine() se descarta en silencio al emitir JSON Schema. Usa invariants.ts.",
    },
    {
      selector: "CallExpression[callee.property.name='superRefine']",
      message: "ADR-005: idem.",
    },
    {
      selector: "CallExpression[callee.property.name='transform']",
      message: "ADR-005: idem.",
    },
    {
      selector: "CallExpression[callee.property.name='catch']",
      message: "ADR-005: .catch() enmascara errores de validación.",
    },
    {
      selector: "CallExpression[callee.object.name='z'][callee.property.name='any']",
      message: "ADR-005/P1: z.any() acepta cualquier cosa y no genera esquema útil.",
    },
  ],
};

export default tseslint.config(
  { ignores: ["**/.next/**", "**/dist/**", "**/coverage/**", "**/node_modules/**", "**/playwright-report/**", "**/test-results/**", "**/generated/**", "**/json-schema/**", "**/spikes/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  { files: ["**/*.{js,mjs,cjs}"], languageOptions: { globals: { ...globals.node } } },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node, React: "readonly" } },
  },

  // ADR-005 — se aplica a todo src/** de esquema (04 §3, 06 §7), incluido canvas-protocol.ts.
  { files: ["packages/schema/src/**/*.ts"], rules: reglasEsquemaADR005 },

  // 04 §19.3 — frontera de importaciones: packages/sections no puede alcanzar el chrome.
  {
    files: ["packages/sections/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/components/*", "@/components/**"], message: "packages/sections no puede importar el chrome del editor (04 §19)." },
            { group: ["next/*"], message: "packages/sections solo puede usar next/image (04 §19)." },
            { group: ["zustand", "react-hook-form", "@radix-ui/*", "lucide-react"], message: "Dependencia del chrome prohibida en packages/sections (04 §19)." },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "Prohibido en packages/sections (04 §5.3 / §17.6)." },
        { selector: "CallExpression[callee.name='alert']", message: "Prohibido en packages/sections." },
        { selector: "CallExpression[callee.name='confirm']", message: "Prohibido en packages/sections." },
        { selector: "MemberExpression[object.name='localStorage']", message: "Prohibido en packages/sections (frontera chrome/tokens, 04 §19)." },
        { selector: "MemberExpression[object.name='document'][property.name='cookie']", message: "Prohibido en packages/sections." },
      ],
    },
  },
  {
    files: ["packages/sections/src/**/*.tsx"],
    ignores: ["packages/sections/src/**/*.next-import-allowed.tsx"],
  },
  // next/image es la única excepción permitida dentro de next/*; se resuelve permitiendo el import
  // explícito de "next/image" pese al patrón "next/*" de arriba mediante una regla más específica.
  {
    files: ["packages/sections/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [],
          patterns: [
            { group: ["next", "next/navigation", "next/link", "next/font/*", "next/dynamic", "next/head", "next/script", "next/server"], message: "packages/sections solo puede usar next/image (04 §19)." },
          ],
        },
      ],
    },
  },

  // 04 §19.3 — la ruta pública y la de preview no pueden alcanzar el chrome del editor.
  {
    files: ["apps/web/app/(public)/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["*/components/editor/*", "**/components/editor/**", "*/lib/store*", "*/lib/undo*", "*/lib/autosave*", "*/lib/canvas-*"], message: "04 §19.3: /i y /preview no importan el chrome del editor." },
          ],
        },
      ],
    },
  },

  // 04 §19.3 — el documento del iframe no hace fetch ni importa el cliente HTTP/estado del chrome.
  {
    files: ["apps/web/app/(canvas)/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["*/lib/api-client*", "*/lib/store*", "**/globals.css"], message: "04 §19.3: el lienzo no importa api-client, store ni el CSS del chrome." },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "CallExpression[callee.name='fetch']", message: "04 §19.3 / C4 (contratos §8): el lienzo no hace fetch (connect-src 'none')." },
      ],
    },
  },

  // e2e — política anti-flake (06 §8.2.2): prohibido esperar por tiempo fijo.
  {
    files: ["apps/web/e2e/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "CallExpression[callee.property.name='waitForTimeout']", message: "06 §8.2: prohibido esperar por tiempo fijo en e2e. Espera por estado observable." },
      ],
    },
  },

  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // 3-7 D2 — REGISTRO de los dos plugins de React. Sin esto, las directivas
  // `eslint-disable-next-line react/no-array-index-key` y `react-hooks/exhaustive-deps` de
  // `packages/sections/**` fallaban con "Definition for rule ... was not found" (6 ERRORES) y
  // tumbaban el job `frontend` del CI, que `e2e` necesita por `needs:`.
  //
  // Los plugins se registran para TODO `*.{ts,tsx}` (así cualquier directiva `react*/…` resuelve
  // donde se escriba), pero las dos reglas se ENCIENDEN solo en `packages/sections/src/**`, que es
  // el único árbol con esas directivas hoy (verificado con grep). Una directiva sobre una regla
  // apagada se vuelve a reportar como "unused disable directive", así que registrar sin encender no
  // habría bastado. Medido: encender `react/no-array-index-key` en todo el monorepo añade 5 errores
  // NUEVOS en `apps/web` (ConflictDialog, PublishDialog, ListTextField) y `exhaustive-deps` añade 8
  // avisos — reales, pero es un cambio de POLÍTICA sobre código que este bloque no revisa, no la
  // corrección del job roto. Queda en `preguntas-abiertas.md`.
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "19.2" } },
  },
  {
    files: ["packages/sections/src/**/*.{ts,tsx}"],
    rules: {
      "react/no-array-index-key": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },

  // 3-7 D2 — `no-console` en `packages/sections/**`. Las 14 directivas
  // `eslint-disable-next-line no-console` que ya estaban escritas sobre los `console.warn` de
  // variante desconocida daban 14 avisos de "directiva inútil" porque la regla nunca estuvo
  // encendida. Encenderla las vuelve útiles (0 errores nuevos: los 14 `console.` del paquete son
  // exactamente esos 14) y hace cumplir de verdad la frontera de 04 §19: el render de invitaciones
  // no escribe en la consola del invitado salvo el aviso deliberado del modo lienzo.
  {
    files: ["packages/sections/src/**/*.{ts,tsx}"],
    rules: { "no-console": "error" },
  },
);
