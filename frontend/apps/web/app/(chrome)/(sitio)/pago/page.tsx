// app/(chrome)/(sitio)/pago/page.tsx — MARCADOR de la página de vuelta de Stripe Checkout.
// Dueña: sesión E4 (pagos con Stripe). Se sustituye entera (ver `README.md` de esta carpeta).
import type { Metadata } from "next";
import { Marcador } from "@/lib/panel/Marcador";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.panel.secciones.pago.titulo,
  // Una página de vuelta de pago NUNCA se indexa: lleva identificadores de sesión de compra en la
  // URL y no tiene sentido fuera del flujo. Esta línea se queda cuando E4 ponga la pantalla real.
  robots: { index: false, follow: false },
};

export default function MarcadorPago() {
  return (
    <Marcador
      contenedor="div"
      titulo={es_MX.panel.secciones.pago.titulo}
      texto={es_MX.panel.secciones.pago.texto}
      accion={{ href: "/editor", etiqueta: es_MX.panel.marcador.verMisInvitaciones }}
    />
  );
}
