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
);
