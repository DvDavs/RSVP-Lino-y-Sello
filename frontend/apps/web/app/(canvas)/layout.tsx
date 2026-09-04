import localFont from "next/font/local";
import { headers } from "next/headers";
import type { ReactNode } from "react";

/**
 * Layout raíz del LIENZO — documento independiente del chrome (04 §19, `handoffs/3-0b.md` §1: "dos
 * layouts raíz por grupos de rutas"). No importa `globals.css`, no monta providers del chrome, no
 * toca `localStorage` ni la API (`lib/api-client.ts` está prohibido aquí por `eslint.config.mjs`).
 *
 * Tipografía autoalojada con `next/font/local`, `preload:false` (04 §5.5, medido en 3-0b): la
 * familia real de cada plantilla es del bloque 3-4/4; `plantilla-serif.woff2` aquí es Fraunces
 * (OFL, `fonts/Fraunces-OFL.txt`) solo para probar el MECANISMO — próximo al de `spikes/canvas-gate`.
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
    <html lang="es-MX" data-font-family={tipografiaLienzo.style.fontFamily}>
      <head>
        {/*
          La CSP del lienzo NO admite `style=` en línea (`style-src` sin `'unsafe-inline'`, medido en
          3-0b: un `style={{…}}` renderizado en servidor es violación). TODO el CSS del documento va
          aquí, en un único `<style nonce>` — nunca en un atributo `style` de un elemento.
        */}
        <style nonce={nonce}>{`
          body { margin: 0; }
          .lienzo-main { padding: 1rem; font-family: inherit; }
        `}</style>
      </head>
      <body className={tipografiaLienzo.className}>
        {/*
          Enganche de `securitypolicyviolation` y cola de mensajes ANTES de que React hidrate
          (`handoffs/3-0b.md` §1, "Saludo"): el `HELLO` del padre puede llegar en `iframe.onload`,
          que ocurre antes del montaje. Solo ACUMULA — `classifyInbound` (Zod) valida en el
          componente (P1). `nonce` porque la CSP no admite `'unsafe-inline'`.
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
