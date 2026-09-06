// packages/ui/src/componentes/Button/Button.historias.tsx — historias para `/design/componentes`.
import type { Historia } from "../../historias/tipos.ts";
import { Button } from "./Button.tsx";

export const historias: readonly Historia[] = [
  {
    slug: "button",
    nombre: "Button",
    familia: "formularios",
    descripcion:
      "Botón píldora con seis variantes, tres tamaños y estado de carga con aria-busy y texto visible.",
    variantes: [
      { nombre: "Primario", render: () => <Button>Publicar</Button> },
      { nombre: "Secundario", render: () => <Button variant="secundario">Ver como invitado</Button> },
      { nombre: "Terciario", render: () => <Button variant="terciario">Cancelar</Button> },
      {
        nombre: "Icono",
        render: () => (
          <Button variant="icono" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M6 6 L18 18 M18 6 L6 18" />
            </svg>
          </Button>
        ),
      },
      { nombre: "Peligro", render: () => <Button variant="peligro">Despublicar</Button> },
      { nombre: "Acento", render: () => <Button variant="acento">Mejorar plan</Button> },
      {
        nombre: "Tamaños",
        render: () => (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Button size="sm">Guardar</Button>
            <Button size="md">Guardar</Button>
            <Button size="lg">Empezar mi invitación</Button>
          </div>
        ),
        nota: "36 · 44 · 52 px de alto.",
      },
      {
        nombre: "Como enlace (asChild)",
        render: () => (
          <Button asChild>
            <a href="#empezar">Empezar mi invitación</a>
          </Button>
        ),
        nota: "Radix Slot: el <a> recibe el aspecto del botón, sin envolver.",
      },
    ],
    estados: [
      { nombre: "Reposo", render: () => <Button>Publicar</Button> },
      { nombre: "Cargando", render: () => <Button loading loadingText="Publicando…">Publicar</Button>, nota: "aria-busy + texto visible." },
      { nombre: "Deshabilitado", render: () => <Button disabled>Publicar</Button> },
    ],
  },
];
