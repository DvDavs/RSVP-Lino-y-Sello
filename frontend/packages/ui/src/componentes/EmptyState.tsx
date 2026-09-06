// packages/ui/src/componentes/EmptyState.tsx — estado vacío del producto (`11 §5`, fila
// «EmptyState»): ilustración del sistema (`§4.3`) + título `display-sm` + frase + una sola acción.
//
// Server-safe a propósito (sin `"use client"`, sin hooks): las ilustraciones (`Ilustracion`) ya lo
// son (ADR-3C-4-01) y este componente solo las compone con texto. El `id` del título sale de
// `idEstable` (mismo mecanismo que `shapes/base.ts`: hash determinista de los parámetros, igual en
// servidor y cliente) en vez de `useId()`, que Server Components no pueden usar.
import type { JSX, ReactNode } from "react";
import { Ilustracion, type NombreIlustracion } from "../ilustraciones/index.ts";
import { idEstable } from "../shapes/base.ts";

export interface EmptyStateAccion {
  /** Texto del botón/enlace. Verbo concreto: «Ver planes», «Compartir el enlace» (`11 §7`). */
  readonly etiqueta: string;
  /** Navegación. Con `href` se pinta un enlace; sin él, un botón que dispara `onSelect`. */
  readonly href?: string;
  readonly onSelect?: () => void;
}

export interface EmptyStateProps {
  /** Nombre del catálogo de `11 §4.3` (`sin-invitaciones`, `sin-fotos`, `error-generico`…). */
  readonly ilustracion: NombreIlustracion;
  readonly titulo: string;
  readonly texto: string;
  /** Una sola acción (`11 §5`): nunca dos botones primarios en un estado vacío. */
  readonly accion?: EmptyStateAccion;
  readonly className?: string;
}

function clases(...partes: readonly (string | false | undefined)[]): string {
  return partes.filter(Boolean).join(" ");
}

export function EmptyState({ ilustracion, titulo, texto, accion, className }: EmptyStateProps): JSX.Element {
  const idTitulo = idEstable("estado-vacio", ilustracion, titulo);
  let nodoAccion: ReactNode = null;
  if (accion) {
    nodoAccion = accion.href ? (
      <a className="ui-estado-vacio__accion" href={accion.href}>
        {accion.etiqueta}
      </a>
    ) : (
      <button type="button" className="ui-estado-vacio__accion" onClick={accion.onSelect}>
        {accion.etiqueta}
      </button>
    );
  }

  return (
    <section aria-labelledby={idTitulo} className={clases("ui-estado-vacio", className)}>
      <Ilustracion nombre={ilustracion} size={120} className="ui-estado-vacio__ilustracion" />
      <h2 id={idTitulo} className="ui-estado-vacio__titulo">
        {titulo}
      </h2>
      <p className="ui-estado-vacio__texto">{texto}</p>
      {nodoAccion}
    </section>
  );
}
