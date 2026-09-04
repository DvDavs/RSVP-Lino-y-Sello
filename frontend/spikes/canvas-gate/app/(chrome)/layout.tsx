import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Compuerta A1-A8 · lienzo aislado",
  // Un favicon vacío: sin él Chromium pide /favicon.ico y ensucia la evidencia con un 404 ajeno.
  icons: { icon: "data:;base64,iVBORw0KGgo=" },
};

/** Layout raíz del CHROME del editor. El lienzo tiene el suyo, independiente (`04 §19`). */
export default function ChromeLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
