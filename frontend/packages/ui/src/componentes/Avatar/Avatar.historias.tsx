import type { Historia } from "../../historias/tipos.ts";
import { Avatar } from "./Avatar.tsx";

export const historias: Historia = {
  slug: "avatar",
  nombre: "Avatar",
  familia: "superficies",
  descripcion: "Retrato de 44 px (36 en listas). Iniciales por defecto; foto con máscara circular si existe.",
  variantes: [
    {
      nombre: "Iniciales y foto",
      render: () => (
        <div className="flex items-center gap-3">
          <Avatar nombre="Mariana Rodríguez" />
          <Avatar nombre="Rodrigo Vega" size="sm" />
          <Avatar nombre="Con estado" estado="activo" />
        </div>
      ),
    },
  ],
};
