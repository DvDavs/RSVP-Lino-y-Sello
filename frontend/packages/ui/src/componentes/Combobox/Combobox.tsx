// packages/ui/src/componentes/Combobox/Combobox.tsx — selector con búsqueda para listas largas
// (`11 §5`, fila Combobox). Patrón ARIA "combobox con listbox" de referencia (campo de texto +
// panel flotante, el foco nunca sale del campo): `role="combobox"`, `aria-expanded`,
// `aria-controls`, `aria-activedescendant`, `aria-autocomplete="list"` en el input; `role="listbox"`
// y `role="option"` en el panel.
//
// Sin Radix Popover: el patrón exige que el foco se quede siempre en el campo, y `Popover.Content`
// atrapa y mueve el foco al abrir salvo que se lo prevenga a mano — un `<div>` posicionado de forma
// absoluta bajo un contenedor `position: relative` (la solución que documenta el propio patrón WAI-
// ARIA) es más simple y no depende de anclaje ni de gestión de foco ajena. Ver `preguntas-abiertas.md`.
"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { IconoBuscar } from "@invitaciones/icons";
import { cn } from "../../utilidades/cn.ts";
import { useFoco } from "../../utilidades/foco.ts";
import { sombraControl } from "../../utilidades/controlSombra.ts";

const ALTO_CONTROL = 46;
const ALTO_OPCION = 44;

export interface OpcionCombobox {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface PropsCombobox {
  readonly opciones: readonly OpcionCombobox[];
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly placeholder?: string;
  readonly id?: string;
  readonly disabled?: boolean;
  readonly invalido?: boolean;
  readonly className?: string;
  readonly textoSinResultados?: (consulta: string) => string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean;
  readonly "aria-label"?: string;
  readonly "aria-labelledby"?: string;
}

function etiquetaDe(opciones: readonly OpcionCombobox[], value: string | undefined): string {
  return opciones.find((opcion) => opcion.value === value)?.label ?? "";
}

export function Combobox({
  opciones,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  id,
  disabled,
  invalido,
  className,
  textoSinResultados,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalidProp,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: PropsCombobox) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;
  const idListbox = `${idCampo}-listbox`;
  const contenedorRef = useRef<HTMLDivElement>(null);

  const [valorInterno, setValorInterno] = useState(defaultValue);
  const valorActual = value ?? valorInterno;
  const [consulta, setConsulta] = useState(() => etiquetaDe(opciones, valorActual));
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(-1);
  const { enFoco, onFocus: manejarFoco, onBlur: manejarDesenfoqueFoco } = useFoco<HTMLInputElement>();
  const esInvalido = invalido ?? ariaInvalidProp;

  const filtradas = useMemo(() => {
    const q = consulta.trim().toLowerCase();
    if (!q) return opciones;
    return opciones.filter((opcion) => opcion.label.toLowerCase().includes(q));
  }, [opciones, consulta]);

  function idOpcion(indice: number): string {
    return `${idListbox}-opcion-${indice}`;
  }

  function seleccionar(opcion: OpcionCombobox) {
    if (opcion.disabled) return;
    setValorInterno(opcion.value);
    setConsulta(opcion.label);
    onValueChange?.(opcion.value);
    setAbierto(false);
    setResaltado(-1);
  }

  function abrir() {
    if (disabled) return;
    setAbierto(true);
    setResaltado(filtradas.findIndex((opcion) => opcion.value === valorActual));
  }

  function cerrarYRevertir() {
    setAbierto(false);
    setResaltado(-1);
    setConsulta(etiquetaDe(opciones, valorActual));
  }

  function moverResaltado(delta: number) {
    if (filtradas.length === 0) return;
    setResaltado((actual) => {
      const siguiente = actual + delta;
      return Math.min(Math.max(siguiente, 0), filtradas.length - 1);
    });
  }

  function alPresionarTecla(evento: KeyboardEvent<HTMLInputElement>) {
    switch (evento.key) {
      case "ArrowDown":
        evento.preventDefault();
        if (!abierto) abrir();
        else moverResaltado(1);
        break;
      case "ArrowUp":
        evento.preventDefault();
        if (!abierto) abrir();
        else moverResaltado(-1);
        break;
      case "Home":
        if (abierto) {
          evento.preventDefault();
          setResaltado(0);
        }
        break;
      case "End":
        if (abierto) {
          evento.preventDefault();
          setResaltado(filtradas.length - 1);
        }
        break;
      case "Enter":
        if (abierto && resaltado >= 0 && filtradas[resaltado]) {
          evento.preventDefault();
          seleccionar(filtradas[resaltado]);
        }
        break;
      case "Escape":
        if (abierto) {
          evento.preventDefault();
          cerrarYRevertir();
        }
        break;
      default:
        break;
    }
  }

  const activeDescendant = abierto && resaltado >= 0 ? idOpcion(resaltado) : undefined;
  const textoVacio = textoSinResultados ?? ((q: string) => `Sin resultados para «${q}».`);

  return (
    <div ref={contenedorRef} className="relative">
      <div
        className={cn(
          "flex items-center gap-2 rounded-ui-control bg-ui-surface-raised px-[14px] text-ui-ink transition-[box-shadow] duration-[var(--ui-dur-1)] ease-ui-out",
          disabled && "cursor-not-allowed bg-ui-surface-alt text-ui-ink-muted",
          className,
        )}
        style={{ height: ALTO_CONTROL, boxShadow: sombraControl({ enFoco, invalido: esInvalido, deshabilitado: disabled }) }}
      >
        <IconoBuscar size={16} aria-hidden className="shrink-0 text-ui-ink-muted" />
        <input
          id={idCampo}
          role="combobox"
          type="text"
          autoComplete="off"
          disabled={disabled}
          aria-expanded={abierto}
          aria-controls={abierto ? idListbox : undefined}
          aria-autocomplete="list"
          aria-activedescendant={activeDescendant}
          aria-invalid={esInvalido || undefined}
          aria-describedby={describedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          placeholder={placeholder}
          value={consulta}
          className="w-full min-w-0 bg-transparent text-base text-ui-ink placeholder:text-ui-ink-placeholder outline-none disabled:cursor-not-allowed"
          data-foco={enFoco ? "true" : "false"}
          onFocus={(evento) => {
            manejarFoco(evento);
            abrir();
          }}
          onBlur={(evento) => {
            manejarDesenfoqueFoco(evento);
            cerrarYRevertir();
          }}
          onChange={(evento) => {
            setConsulta(evento.target.value);
            if (!abierto) setAbierto(true);
            setResaltado(0);
          }}
          onKeyDown={alPresionarTecla}
        />
      </div>
      {abierto ? (
        <div
          id={idListbox}
          role="listbox"
          className="absolute left-0 right-0 z-[var(--ui-z-hoja)] mt-1.5 max-h-[320px] overflow-auto rounded-ui-card bg-ui-surface-raised p-1.5 shadow-ui-2"
          // El clic en una opción dispara `mousedown`; sin `onMouseDown` con `preventDefault`, ese
          // clic quitaría antes el foco del input (blur) y `cerrarYRevertir` cerraría el panel
          // antes de que el `click` llegue a seleccionar la opción.
          onMouseDown={(evento) => evento.preventDefault()}
        >
          {filtradas.length === 0 ? (
            <p className="px-3 py-2 text-[14px] text-ui-ink-muted">{textoVacio(consulta)}</p>
          ) : (
            filtradas.map((opcion, indice) => (
              <div
                key={opcion.value}
                id={idOpcion(indice)}
                role="option"
                aria-selected={opcion.value === valorActual}
                aria-disabled={opcion.disabled || undefined}
                className={cn(
                  "flex cursor-pointer select-none items-center rounded-[10px] px-3 text-[15px] text-ui-ink",
                  indice === resaltado && "bg-ui-primary-soft text-ui-on-primary-soft",
                  opcion.disabled && "cursor-not-allowed text-ui-ink-muted opacity-70",
                )}
                style={{ height: ALTO_OPCION }}
                onMouseEnter={() => setResaltado(indice)}
                onClick={() => seleccionar(opcion)}
              >
                {opcion.label}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
