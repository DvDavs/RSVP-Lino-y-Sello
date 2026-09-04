import type { ReactNode } from "react";

/**
 * Red de seguridad de Next.js: con TRES layouts raíz por grupos de rutas ((chrome), (canvas),
 * (public)) y sin un `app/layout.tsx` de nivel superior, una URL que no caiga en ninguno de los tres
 * (`app/not-found.tsx`) no tendría ningún `<html>` que renderizar. Este layout NO se usa para
 * ninguna ruta real del producto (todas viven dentro de un grupo) — solo envuelve el 404 genérico.
 * No importa `globals.css`: sería el chrome filtrándose a un documento que no es del chrome (P3).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
