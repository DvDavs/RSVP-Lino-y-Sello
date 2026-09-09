// app/(chrome)/admin/page.tsx — MARCADOR del panel de administración.
// Dueña: sesión E5 (admin). Se sustituye entera (ver `README.md` de esta carpeta).
//
// NO comprueba rol, y no lo necesita: no lee nada, no llama al backend y no enseña ni un dato de
// ninguna cuenta. La comprobación de rol la añade E5 CON la pantalla real, en el mismo commit; la
// autorización de verdad vive en el backend (`modules/product/admin` + `modules/admin/**`), que es
// quien tiene que negar, no esta página.
import type { Metadata } from "next";
import { Marcador } from "@/lib/panel/Marcador";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.panel.secciones.admin.titulo,
  // Permanente: una consola de administración no se indexa nunca.
  robots: { index: false, follow: false },
};

export default function MarcadorAdmin() {
  return (
    <Marcador
      titulo={es_MX.panel.secciones.admin.titulo}
      texto={es_MX.panel.secciones.admin.texto}
      accion={{ href: "/editor", etiqueta: es_MX.panel.marcador.verMisInvitaciones }}
    />
  );
}
