// packages/ui/src/componentes/EmptyState.historias.tsx — historia de la galería `/design/componentes`
// (`11 §5` fila «EmptyState»). Sin `estados` propios (la tabla los deja en «—»): la ilustración y la
// presencia u opción de una acción son las variantes que documentar.
//
// Convención de registro (contrato de integración F1+F2, ver `historias/registro.ts`): cada fichero
// `*.historias.tsx` exporta `historias: readonly Historia[]` — un array, aunque tenga una sola
// entrada — para que `registro.ts` los combine todos con el mismo import shape sea cual sea el
// número de historias que aporte cada componente. La descripción de aquí debe coincidir con la de
// `historias/metadatos.ts` (lo comprueba `historias/metadatos.test.ts`).
import { EmptyState } from "./EmptyState.tsx";
import type { Historia } from "../historias/tipos.ts";

export const historias: readonly Historia[] = [
  {
    slug: "empty-state",
    nombre: "EmptyState",
    familia: "estados",
    descripcion:
      "Ilustración del sistema (§4.3) + título display-sm + una frase + una sola acción. Nunca dos botones primarios en un estado vacío.",
    variantes: [
      {
        nombre: "Sin invitaciones",
        nota: "Catálogo del asistente sin invitaciones creadas (11 §7).",
        render: () => (
          <EmptyState
            ilustracion="sin-invitaciones"
            titulo="Todavía no tienes invitaciones"
            texto="Elige un tipo de evento y arma tu primera invitación en minutos."
            accion={{ etiqueta: "Ver planes", href: "#" }}
          />
        ),
      },
      {
        nombre: "Sin fotos",
        nota: "Gestor de fotos del panel de bloque, antes de subir la primera.",
        render: () => (
          <EmptyState
            ilustracion="sin-fotos"
            titulo="Todavía no hay fotos"
            texto="Agrega tus primeras fotos para que se vean en la galería de la invitación."
            accion={{ etiqueta: "Agregar fotos", href: "#" }}
          />
        ),
      },
      {
        nombre: "Error genérico",
        nota: "Acción por botón (onSelect), no por enlace: reintenta sin navegar.",
        render: () => (
          <EmptyState
            ilustracion="error-generico"
            titulo="Algo salió mal"
            texto="Inténtalo de nuevo en un momento. Si sigue sin funcionar, escríbenos."
            accion={{ etiqueta: "Reintentar", onSelect: () => {} }}
          />
        ),
      },
      {
        nombre: "Sin acción",
        nota: "Un estado vacío informativo puede no ofrecer ninguna acción (11 §5: la acción es opcional).",
        render: () => (
          <EmptyState
            ilustracion="sin-invitaciones"
            titulo="Nadie ha confirmado todavía"
            texto="Comparte el enlace de tu invitación para ver aquí las confirmaciones."
          />
        ),
      },
    ],
  },
];
