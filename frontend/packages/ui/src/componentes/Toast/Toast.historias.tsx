"use client";

import type { Historia } from "../../historias/tipos.ts";
import { Toaster, toast } from "./Toast.tsx";

export const historias: Historia = {
  slug: "toast",
  nombre: "Toast",
  familia: "superficies",
  descripcion:
    "Aviso informativo que aparece arriba centrado y desaparece solo (4 s por defecto). Región role=status/aria-live=polite, cola con tope de 2 y botón de cerrar siempre presente. Un error que exige una decisión de la persona NO es un toast: usa Dialog/Sheet o un banner.",
  variantes: [
    {
      nombre: "Informativo, éxito y error",
      render: () => (
        <div className="grid gap-3">
          <Toaster />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-ui-pill bg-ui-surface-alt px-3 py-2 text-sm"
              onClick={() => toast({ titulo: "Enlace copiado.", descripcion: "Ya puedes pegarlo en WhatsApp.", variante: "exito" })}
            >
              Mostrar éxito
            </button>
            <button
              type="button"
              className="rounded-ui-pill bg-ui-surface-alt px-3 py-2 text-sm"
              onClick={() => toast({ descripcion: "Estamos actualizando el enlace de tus invitados…", variante: "info" })}
            >
              Mostrar informativo
            </button>
            <button
              type="button"
              className="rounded-ui-pill bg-ui-surface-alt px-3 py-2 text-sm"
              onClick={() => toast({ titulo: "Algo salió mal.", descripcion: "Inténtalo de nuevo. Código: TPL_ERR", variante: "error" })}
            >
              Mostrar error
            </button>
          </div>
        </div>
      ),
      nota: "Un solo `Toaster` montado una vez; los tres botones llaman a `toast()` desde fuera.",
    },
  ],
};
