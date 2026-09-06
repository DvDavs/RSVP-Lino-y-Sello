import type { Historia } from "../../historias/tipos.ts";
import { Card } from "./Card.tsx";

export const historias: Historia = {
  slug: "card",
  nombre: "Card",
  familia: "superficies",
  descripcion:
    "Tarjeta con cuatro variantes: plana (borde, listas y filas), elevada (diálogos y menús), sombra de color (la destacada, una por vista) y tinta (banda de apoyo). Sin hover de elevación en rejillas.",
  variantes: [
    {
      nombre: "Plana",
      render: () => (
        <Card variant="plana">
          <b className="heading-sm">Plana</b>
          <p className="text-sm text-ui-ink-muted">Listas y filas. Borde de 1,5 px, sin sombra.</p>
        </Card>
      ),
      nota: "Uso por defecto en rejillas de plantillas o filas de sección.",
    },
    {
      nombre: "Elevada",
      render: () => (
        <Card variant="elevada">
          <b className="heading-sm">Elevada</b>
          <p className="text-sm text-ui-ink-muted">Diálogos, menús y tarjetas sobre color.</p>
        </Card>
      ),
    },
    {
      nombre: "Sombra de color",
      render: () => (
        <Card variant="color" tone="support-2">
          <b className="heading-sm">Sombra de color</b>
          <p className="text-sm text-ui-ink-muted">La destacada. Una por vista.</p>
        </Card>
      ),
      nota: "Envuelve el contenido en ColorShadow (shapes). Nunca combinar con shadow-ui-1/2 en el mismo bloque.",
    },
    {
      nombre: "Tinta",
      render: () => (
        <Card variant="tinta" tone="support-2">
          <b className="heading-sm">Tinta</b>
          <p className="text-sm">Banda de apoyo: -deep sobre -soft.</p>
        </Card>
      ),
    },
  ],
};
