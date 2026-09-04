import localFont from "next/font/local";
import { headers } from "next/headers";
import type { ReactNode } from "react";
// Valores de RESERVA de todas las custom properties `--inv-*` (04 §5.4). `packages/sections` NO se
// autoimporta esta hoja: la carga `apps/web` UNA sola vez por documento, y este es el documento del
// lienzo. Llega como `<link rel=stylesheet>` del propio origen, que `style-src {APP}` permite.
//
// Ruta RELATIVA a propósito: el `exports` de `packages/sections/package.json` solo publica `"."`, y
// añadirle `"./theme/tokens.css"` exigiría tocar ese paquete — prohibido para este bloque (contrato
// ya integrado y probado). Registrado en `preguntas-abiertas.md` como higiene pendiente.
import "../../../../packages/sections/src/theme/tokens.css";

/**
 * Layout raíz del LIENZO — documento independiente del chrome (04 §19, `handoffs/3-0b.md` §1: "dos
 * layouts raíz por grupos de rutas"). No importa `globals.css`, no monta providers del chrome, no
 * toca `localStorage` ni la API (`lib/api-client.ts` está prohibido aquí por `eslint.config.mjs`).
 *
 * Tipografía autoalojada con `next/font/local`, `preload:false` (04 §5.5, medido en 3-0b). La
 * familia real de cada plantilla la fija `ThemeProvider` con `--inv-font-heading`/`--inv-font-body`
 * a partir del `ResolvedTheme` que viaja en el `RENDER`; `plantilla-serif.woff2` (Fraunces, OFL) es
 * la reserva local del documento.
 */
const tipografiaLienzo = localFont({
  src: "../../fonts/plantilla-serif.woff2",
  display: "swap",
  preload: false,
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const dynamic = "force-dynamic"; // el nonce de la CSP (proxy.ts) es por petición

export default async function LienzoLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    // `data-nonce`: el `<style nonce>` que emite `ThemeProvider` de `@invitaciones/sections` lo
    // monta un componente de CLIENTE, que no puede llamar a `headers()`. Se publica aquí para que la
    // página lo lea del DOM. No es una fuga: Next ya pone el mismo nonce en los once `<script
    // nonce>` del documento, legibles igual, y dentro del lienzo no hay ningún secreto (C4/P8).
    <html lang="es-MX" data-nonce={nonce} data-font-family={tipografiaLienzo.style.fontFamily}>
      <head>
        {/*
          La CSP del lienzo NO admite `style=` en línea (`style-src` sin `'unsafe-inline'`, medido en
          3-0b: un `style={{…}}` renderizado en servidor es violación). TODO el CSS propio de este
          documento va aquí, en un único `<style nonce>` — nunca en un atributo `style`.

          `.lienzo-raiz[data-viewport="mobile"]` es el flujo D (04 §7.4): el iframe ajusta su propia
          raíz a 390 px y el padre además cambia el ancho del elemento. Las secciones son responsive
          por CSS (`clamp()`, `grid`) sin breakpoints expuestos al cliente.
        */}
        <style nonce={nonce}>{`
          html, body { margin: 0; padding: 0; background: var(--inv-color-bg, #fff); }
          .lienzo-main { padding: 2rem 1rem; font-family: system-ui, sans-serif; color: #4b4640; text-align: center; }
          .lienzo-error { margin: 0; padding: 1rem; font-family: system-ui, sans-serif; color: #7a2f2f; background: #fdf2f2; }
          .lienzo-raiz { width: 100%; margin: 0 auto; transition: max-width 180ms ease; }
          .lienzo-raiz[data-viewport="mobile"] { max-width: 390px; box-shadow: 0 0 0 1px rgba(0,0,0,0.06); }
          @media (prefers-reduced-motion: reduce) { .lienzo-raiz { transition: none; } }
        `}</style>
      </head>
      <body className={tipografiaLienzo.className}>
        {/*
          Enganche de `securitypolicyviolation` y cola de mensajes ANTES de que React hidrate
          (`handoffs/3-0b.md` §1, "Saludo"): el `HELLO` del padre puede llegar en `iframe.onload`,
          que ocurre antes del montaje. Solo ACUMULA — `classifyInbound` (Zod) valida en
          `lib/canvas-client.ts` (P1). `nonce` porque la CSP no admite `'unsafe-inline'`.
        */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "window.__cspViolations=[];document.addEventListener('securitypolicyviolation'," +
              "function(e){window.__cspViolations.push({directive:e.violatedDirective," +
              "blockedURI:e.blockedURI,sourceFile:e.sourceFile,lineNumber:e.lineNumber});});" +
              "window.__pendientes=[];window.__bufferMensajes=function(e){window.__pendientes.push(e);};" +
              "window.addEventListener('message',window.__bufferMensajes);",
          }}
        />
        {children}
      </body>
    </html>
  );
}
