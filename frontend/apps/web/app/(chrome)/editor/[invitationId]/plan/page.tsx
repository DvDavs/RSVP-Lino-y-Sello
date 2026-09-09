// app/(chrome)/editor/[invitationId]/plan/page.tsx — MARCADOR de la sección «Plan».
// Dueña: sesión E4. Se sustituye entera (ver `README.md` de esta carpeta).
import type { Metadata } from "next";
import { Marcador } from "@/lib/panel/Marcador";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.panel.secciones.plan.titulo,
  robots: { index: false, follow: false },
};

export default async function MarcadorPlan({ params }: { params: Promise<{ invitationId: string }> }) {
  const { invitationId } = await params;
  return (
    <Marcador
      titulo={es_MX.panel.secciones.plan.titulo}
      texto={es_MX.panel.secciones.plan.texto}
      accion={{ href: `/editor/${encodeURIComponent(invitationId)}`, etiqueta: es_MX.panel.marcador.volverAlEditor }}
    />
  );
}
