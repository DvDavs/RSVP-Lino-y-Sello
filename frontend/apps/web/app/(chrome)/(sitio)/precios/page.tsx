// app/(chrome)/(sitio)/precios/page.tsx — MARCADOR de la página de planes y precios.
// Dueña: sesión E4 (pagos con Stripe). Se sustituye entera (ver `README.md` de esta carpeta).
import type { Metadata } from "next";
import { Marcador } from "@/lib/panel/Marcador";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.panel.secciones.precios.titulo,
  description: es_MX.panel.secciones.precios.texto,
  // Mientras no haya precios que publicar, fuera de los buscadores: una página indexada que dice
  // «todavía no los publicamos» es peor que ninguna. E4 quita esta línea cuando ponga los planes
  // reales — `/precios` SÍ debe indexarse el día que venda.
  robots: { index: false, follow: false },
};

export default function MarcadorPrecios() {
  return (
    <Marcador
      contenedor="div"
      titulo={es_MX.panel.secciones.precios.titulo}
      texto={es_MX.panel.secciones.precios.texto}
      accion={{ href: "/ayuda#planes", etiqueta: es_MX.panel.marcador.verLaAyuda }}
    />
  );
}
