// app/(chrome)/editor/[invitationId]/invitados/page.tsx — MARCADOR de la sección «Invitados».
// Dueña: sesión E2. Se sustituye entera (ver `README.md` de esta carpeta).
import type { Metadata } from "next";
import { Marcador } from "@/lib/panel/Marcador";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.panel.secciones.invitados.titulo,
  // Mientras sea un marcador, fuera de los buscadores: nadie debe llegar aquí desde Google a leer
  // que algo no está. E2 lo cambia (o lo deja) cuando ponga la pantalla real, que además vive
  // detrás de sesión.
  robots: { index: false, follow: false },
};

export default async function MarcadorInvitados({ params }: { params: Promise<{ invitationId: string }> }) {
  const { invitationId } = await params;
  return (
    <Marcador
      titulo={es_MX.panel.secciones.invitados.titulo}
      texto={es_MX.panel.secciones.invitados.texto}
      accion={{ href: `/editor/${encodeURIComponent(invitationId)}`, etiqueta: es_MX.panel.marcador.volverAlEditor }}
    />
  );
}
