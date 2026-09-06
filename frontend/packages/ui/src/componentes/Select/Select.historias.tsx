// packages/ui/src/componentes/Select/Select.historias.tsx
import type { Historia } from "../../historias/tipos.ts";
import { ALTO_OPCION_SELECT, CLASES_OPCION_SELECT, CLASES_PANEL_SELECT, Select } from "./Select.tsx";
import { Field } from "../Field/Field.tsx";
import { IconoChevronAbajo } from "@invitaciones/icons";

const TIPOS_EVENTO = [
  { value: "boda", label: "Boda" },
  { value: "xv", label: "XV años" },
  { value: "bautizo", label: "Bautizo" },
  { value: "comunion", label: "Primera comunión" },
  { value: "corporativo", label: "Corporativo", disabled: true, motivo: "Requiere el plan 2" },
] as const;

/**
 * Maqueta ESTÁTICA del panel abierto, con las clases que exporta `Select.tsx` (y que
 * `Select.test.tsx` verifica sobre el panel real, para que no puedan desviarse).
 *
 * No es un `Select` abierto de verdad a propósito: Radix Select, abierto, marca el resto de la
 * página `aria-hidden` y le pone `pointer-events: none` sin forma de desactivarlo, así que una
 * ficha con el panel abierto de forma permanente rompía `axe` («aria-hidden-focus») y dejaba la
 * galería sin conmutador de tema. Aquí es un `listbox` estático correcto: nombre accesible, filas
 * `option` con `aria-selected`, la deshabilitada con `aria-disabled` y su motivo.
 */
function PanelAbierto() {
  return (
    <div className="grid w-full gap-2">
      <div className="flex h-11 w-full items-center gap-2 rounded-ui-control bg-ui-surface-raised px-[14px] text-base text-ui-ink shadow-[inset_0_0_0_1px_var(--ui-border)]">
        <span className="flex-1 truncate">Boda</span>
        <IconoChevronAbajo size={18} aria-hidden className="text-ui-ink-muted" />
      </div>
      <div role="listbox" aria-label="Tipo de evento (maqueta del panel abierto)" className={CLASES_PANEL_SELECT}>
        {TIPOS_EVENTO.map((opcion, indice) => (
          <div
            key={opcion.value}
            role="option"
            aria-selected={opcion.value === "boda"}
            aria-disabled={"disabled" in opcion && opcion.disabled ? true : undefined}
            data-highlighted={indice === 1 ? "" : undefined}
            data-disabled={"disabled" in opcion && opcion.disabled ? "" : undefined}
            className={CLASES_OPCION_SELECT}
            style={{ height: ALTO_OPCION_SELECT }}
          >
            <span className="min-w-0 flex-1 truncate">{opcion.label}</span>
            {"motivo" in opcion && opcion.motivo ? (
              <span className="ml-auto shrink-0 whitespace-nowrap text-[13px] text-ui-ink-muted">{opcion.motivo}</span>
            ) : null}
            {opcion.value === "boda" ? (
              <span className="ml-auto text-ui-primary">
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12.5 L10 17 L19 7.5" />
                </svg>
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export const historias: readonly Historia[] = [
  {
    slug: "select",
    nombre: "Select",
    familia: "formularios",
    descripcion: "Selector propio para listas de hasta 5 opciones fijas; Radix Select por debajo.",
    variantes: [
      {
        nombre: "Con Field",
        render: () => (
          <Field label="Tipo de evento">
            <Select opciones={[...TIPOS_EVENTO]} placeholder="Elige un tipo" />
          </Field>
        ),
      },
      { nombre: "Con valor", render: () => <Select aria-label="Tipo de evento" opciones={[...TIPOS_EVENTO]} defaultValue="boda" /> },
      {
        nombre: "Panel abierto",
        render: () => <PanelAbierto />,
        nota: "Maqueta estática: el panel real es una capa modal y no puede quedarse abierto en la galería (ver Select.tsx).",
      },
    ],
    estados: [
      { nombre: "Deshabilitado", render: () => <Select aria-label="Tipo de evento" opciones={[...TIPOS_EVENTO]} disabled /> },
    ],
  },
];
