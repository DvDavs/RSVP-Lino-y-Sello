// app/(chrome)/perfil/page.tsx — MARCADOR de la pantalla de cuenta de la clienta.
// Dueña: sesión E3 (cuenta, marca y legal). Se sustituye entera (ver `README.md` de esta carpeta).
import type { Metadata } from "next";
import { Marcador } from "@/lib/panel/Marcador";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.panel.secciones.perfil.titulo,
  // Permanente: es una pantalla de la cuenta, detrás de sesión.
  robots: { index: false, follow: false },
};

export default function MarcadorPerfil() {
  return (
    <Marcador
      titulo={es_MX.panel.secciones.perfil.titulo}
      texto={es_MX.panel.secciones.perfil.texto}
      accion={{ href: "/editor", etiqueta: es_MX.panel.marcador.verMisInvitaciones }}
    />
  );
}
