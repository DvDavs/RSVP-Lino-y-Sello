import type { Historia } from "../../historias/tipos.ts";
import { Badge } from "./Badge.tsx";

export const historias: Historia = {
  slug: "badge",
  nombre: "Badge",
  familia: "superficies",
  descripcion: "Insignia de 22 px, mono 11 en mayúsculas. El texto va siempre: nunca solo un punto de color.",
  variantes: [
    {
      nombre: "Por estado",
      render: () => (
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutro">Ejemplo</Badge>
          <Badge tone="primary">Nuevo</Badge>
          <Badge tone="success">Confirmado</Badge>
          <Badge tone="warning">Texto de ejemplo</Badge>
          <Badge tone="danger">Falta el lugar</Badge>
          <Badge tone="info">Enlace copiado</Badge>
          <Badge tone="accent">Plan 2</Badge>
        </div>
      ),
    },
  ],
};
