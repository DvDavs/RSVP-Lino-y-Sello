// app/(chrome)/(sitio)/legal/page.tsx — MARCADOR de los avisos legales.
// Dueña: sesión E3 (cuenta, marca y legal). Se sustituye entera (ver `README.md` de esta carpeta).
import type { Metadata } from "next";
import { Marcador } from "@/lib/panel/Marcador";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.panel.secciones.legal.titulo,
  description: es_MX.panel.secciones.legal.texto,
  // Temporal: los avisos legales SÍ se indexan cuando existan. E3 quita esta línea al publicarlos.
  robots: { index: false, follow: false },
};

export default function MarcadorLegal() {
  return (
    <Marcador
      contenedor="div"
      titulo={es_MX.panel.secciones.legal.titulo}
      texto={es_MX.panel.secciones.legal.texto}
      accion={{ href: "/ayuda", etiqueta: es_MX.panel.marcador.verLaAyuda }}
    />
  );
}
