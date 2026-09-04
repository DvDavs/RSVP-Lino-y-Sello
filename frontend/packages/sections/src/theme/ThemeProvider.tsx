// packages/sections/src/theme/ThemeProvider.tsx — ResolvedTheme → custom properties `--inv-*`
// (04 §5.4). Escribe en el elemento RAÍZ DEL ÁRBOL DE SECCIONES, nunca en `:root`/`html` (así
// pueden convivir dos documentos, p. ej. panel de comparación de temas).
//
// CSP del lienzo (handoffs/3-0b.md §1, medido): "la CSP NO habilita atributos `style=`... Un
// `style={{…}}` renderizado en servidor DENTRO del lienzo = violación". Dos mecanismos, los DOS,
// no uno solo:
//   1. `<style nonce>` (SSR-seguro, sin parpadeo de tema en el primer pintado — importa para el
//      presupuesto de LCP de `/i/[publicToken]`, 04 §16.1). El contenido son solo hex ya validados
//      por regex antes de interpolarlos (defensa en profundidad: contenido de plantilla, no de
//      cliente, pero nunca se confía a ciegas — mismo criterio que RichTextBlock).
//   2. CSSOM (`el.style.setProperty`) en un `useEffect` sobre el propio wrapper, permitida por la
//      CSP sin nonce. Reafirma los MISMOS valores (misma especificidad ganadora, sin diferencia
//      visual) y es lo que hace que la prueba U-06 pueda leer los valores de forma determinista
//      sin depender de que jsdom resuelva la cascada de un `<style>` (jsdom no simula layout ni
//      cascada CSS completa; `element.style.getPropertyValue()` sí es 100% fiable en jsdom).
import { useEffect, useId, useRef, type ReactNode } from "react";
import type { ResolvedTheme } from "../schema-types.ts";
import { fontFamilyCss } from "./fonts.ts";

export interface ThemeProviderProps {
  readonly theme: ResolvedTheme;
  /** Nonce de CSP por petición — obligatorio dentro del lienzo aislado, opcional fuera de él. */
  readonly nonce?: string;
  readonly children: ReactNode;
}

const COLOR_TOKEN_KEYS = [
  ["bg", "--inv-color-bg"],
  ["surface", "--inv-color-surface"],
  ["ink", "--inv-color-ink"],
  ["accent", "--inv-color-accent"],
  ["accentInk", "--inv-color-accent-ink"],
  ["muted", "--inv-color-muted"],
] as const;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function scopedThemeCss(scopeClass: string, declarations: ReadonlyArray<readonly [string, string]>): string {
  const body = declarations.map(([name, value]) => `${name}:${value};`).join("");
  return `.${scopeClass}{${body}}`;
}

function buildDeclarations(theme: ResolvedTheme): Array<readonly [string, string]> {
  const decls: Array<readonly [string, string]> = [];
  for (const [key, cssVar] of COLOR_TOKEN_KEYS) {
    const value = theme.tokens[key];
    // Defensa en profundidad: `HexColor` (packages/schema/src/common.ts:63) ya exige `#rrggbb`,
    // pero un color inválido en un `<style>` interpolado a mano es la clase de fallo que se
    // evita comprobando otra vez aquí — un valor fuera de forma se OMITE (cae al de reserva de
    // tokens.css) en vez de inyectarse tal cual.
    if (typeof value === "string" && HEX_COLOR.test(value)) {
      decls.push([cssVar, value]);
    }
  }
  decls.push(["--inv-font-heading", fontFamilyCss(theme.fonts.heading.family, "heading")]);
  decls.push(["--inv-font-body", fontFamilyCss(theme.fonts.body.family, "body")]);
  return decls;
}

export function ThemeProvider({ theme, nonce, children }: ThemeProviderProps) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const scopeClass = `inv-theme-${reactId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const declarations = buildDeclarations(theme);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    for (const [cssVar, value] of declarations) {
      el.style.setProperty(cssVar, value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.paletteId, theme.fontSetId, JSON.stringify(theme.tokens)]);

  return (
    <>
      <style nonce={nonce}>{scopedThemeCss(scopeClass, declarations)}</style>
      <div ref={rootRef} className={scopeClass} data-theme-palette={theme.paletteId}>
        {children}
      </div>
    </>
  );
}
