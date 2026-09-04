import { headers } from "next/headers";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { cssDelLienzo } from "./canvas/estilos";

/**
 * Layout raíz del LIENZO. Documento independiente del chrome del editor (`04 §2`, `§19.4`):
 * no importa `globals.css`, no monta providers del chrome, no toca `localStorage` ni la API.
 *
 * La tipografía es **autoalojada** con `next/font/local` (ADR-1R-F-07) y `preload: false` (C3).
 * `next/font` la sirve desde `/_next/static/media/**`, que `next.config.ts` publica con
 * `Access-Control-Allow-Origin: *` (C1) — sin esa cabecera, en origen opaco, no carga.
 */
const plantillaSerif = localFont({
  src: "../../fonts/plantilla-serif.woff2",
  display: "swap",
  preload: false,
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const dynamic = "force-dynamic"; // el nonce de la CSP es por petición

export default async function LienzoLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <html lang="es-MX" data-font-family={plantillaSerif.style.fontFamily}>
      <body className={plantillaSerif.className}>
        {/*
          Enganche de `securitypolicyviolation` lo más pronto posible: A4 solo significa algo si el
          oyente está puesto ANTES de que se cargue el primer chunk. Lleva `nonce` porque la CSP del
          lienzo no admite `'unsafe-inline'`.
        */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "window.__cspViolations=[];document.addEventListener('securitypolicyviolation'," +
              "function(e){window.__cspViolations.push({directive:e.violatedDirective," +
              "blockedURI:e.blockedURI,sourceFile:e.sourceFile,lineNumber:e.lineNumber});});" +
              // El padre envía el HELLO en `iframe.onload`, que ocurre ANTES de que React hidrate:
              // sin este buffer el saludo se pierde y el lienzo nunca envía READY (medido en este
              // spike). Aquí solo se ACUMULA — la validación con Zod la hace el componente (P1).
              "window.__pendientes=[];window.__bufferMensajes=function(e){window.__pendientes.push(e);};" +
              "window.addEventListener('message',window.__bufferMensajes);",
          }}
        />
        {/*
          Todo el CSS del lienzo va en un <style nonce>. NO se usa el atributo `style=` en el HTML
          servido: `style-src <host> 'nonce-…'` NO habilita atributos `style` en línea y cada uno
          produciría una violación de CSP (medido en este spike, control `?probe=inline-style`).
        */}
        <style nonce={nonce} dangerouslySetInnerHTML={{ __html: cssDelLienzo }} />
        {children}
      </body>
    </html>
  );
}
