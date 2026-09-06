"use client";

// components/asistente/MisInvitaciones.tsx — la lista de invitaciones de la clienta, que vive en el
// paso 1 del asistente. No es decoración: en este producto una invitación NACE DE UNA COMPRA
// (ADR-2-4-02, `templates2` no crea invitaciones), así que el asistente aplica la plantilla a una
// invitación que ya existe y la clienta tiene que ver cuál. Sin invitaciones, el estado vacío
// explica de dónde salen y lleva a los planes en vez de pintar un botón que no puede funcionar.
import { Button, EmptyState } from "@invitaciones/ui";
import { IconoEventoFecha } from "@invitaciones/icons";
import Link from "next/link";
import { es_MX } from "@/lib/i18n";
import type { FilaInvitacion } from "./invitaciones.ts";

const AYUDA_PLANES = "/ayuda#planes";

export interface MisInvitacionesProps {
  readonly invitaciones: readonly FilaInvitacion[];
  readonly idTitulo: string;
}

/** Fecha `YYYY-MM-DD` de negocio → texto es-MX; si viene vacía o rara, se devuelve tal cual. */
export function fechaLegible(iso: string | null | undefined): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!partes) return iso ?? "";
  const fecha = new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
  return fecha.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export function MisInvitaciones({ invitaciones, idTitulo }: MisInvitacionesProps) {
  if (invitaciones.length === 0) {
    return (
      <EmptyState
        ilustracion="sin-invitaciones"
        titulo={es_MX.asistente.sinInvitaciones.titulo}
        texto={es_MX.asistente.sinInvitaciones.texto}
        accion={{ etiqueta: es_MX.asistente.sinInvitaciones.accion, href: AYUDA_PLANES }}
      />
    );
  }

  return (
    <section aria-labelledby={idTitulo} className="flex flex-col gap-3">
      <h2 id={idTitulo} className="heading-sm text-ui-ink">
        {es_MX.editor.catalogo.misInvitaciones}
      </h2>
      <ul className="flex flex-col gap-2">
        {invitaciones.map((inv) => (
          <li
            key={inv.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-ui-control border border-ui-divider bg-ui-surface-raised p-3.5"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-md font-semibold text-ui-ink">{inv.nombre ?? inv.event}</span>
              <span className="flex flex-wrap items-center gap-1.5 text-sm text-ui-ink-muted">
                <IconoEventoFecha size={16} className="shrink-0" />
                {inv.date ? es_MX.editor.catalogo.fechaDeLaInvitacion(fechaLegible(inv.date)) : es_MX.editor.catalogo.sinFecha}
                <span>· {es_MX.editor.catalogo.numero(inv.id)}</span>
              </span>
            </span>
            {inv.estado === "sin-acceso" ? (
              <span className="text-sm text-ui-ink-muted">{es_MX.editor.catalogo.sinAcceso}</span>
            ) : (
              <Button variant="secundario" size="sm" asChild>
                <Link href={`/editor/${inv.id}`}>
                  {inv.estado === "con-plantilla" ? es_MX.editor.catalogo.seguirEditando : es_MX.editor.catalogo.empezar}
                </Link>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
