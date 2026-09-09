// app/(chrome)/(sitio)/contacto/page.tsx — MARCADOR de la página de contacto.
// Dueña: sesión E3 (cuenta, marca y legal). Se sustituye entera (ver `README.md` de esta carpeta).
import type { Metadata } from "next";
import { Marcador } from "@/lib/panel/Marcador";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.panel.secciones.contacto.titulo,
  description: es_MX.panel.secciones.contacto.texto,
  // Temporal, igual que en `/precios`: `/contacto` es una página pública que SÍ debe indexarse
  // cuando exista de verdad. E3 quita esta línea.
  robots: { index: false, follow: false },
};

export default function MarcadorContacto() {
  return (
    <Marcador
      contenedor="div"
      titulo={es_MX.panel.secciones.contacto.titulo}
      texto={es_MX.panel.secciones.contacto.texto}
      accion={{ href: "/ayuda", etiqueta: es_MX.panel.marcador.verLaAyuda }}
    />
  );
}
