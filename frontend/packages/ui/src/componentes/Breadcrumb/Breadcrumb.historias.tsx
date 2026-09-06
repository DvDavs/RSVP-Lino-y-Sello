import type { Historia } from "../../historias/tipos.ts";
import { Breadcrumb } from "./Breadcrumb.tsx";

export const historias: Historia = {
  slug: "breadcrumb",
  nombre: "Breadcrumb",
  familia: "navegacion",
  descripcion:
    "Ruta de navegación, solo en escritorio. El último tramo es texto con aria-current=page; en móvil lo sustituye el Stepper o un botón «Atrás».",
  variantes: [
    {
      nombre: "Ruta de tres tramos",
      ancho: "completo",
      render: () => (
        <Breadcrumb
          items={[
            { label: "Mis invitaciones", href: "/mis-invitaciones" },
            { label: "Boda de Mariana y Rodrigo", href: "/mis-invitaciones/1" },
            { label: "Plantilla" },
          ]}
          className="!block"
        />
      ),
      nota: "`className=\"!block\"` es solo para verla en la galería: fuera de /design, el componente se oculta bajo el punto de corte de escritorio por sí solo.",
    },
  ],
};
