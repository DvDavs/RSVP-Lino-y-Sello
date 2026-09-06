"use client";

// components/asistente/MisInvitaciones.tsx — la lista de invitaciones de la clienta, que vive en el
// paso 1 del asistente. No es decoración: en este producto una invitación NACE DE UNA COMPRA
// (ADR-2-4-02, `templates2` no crea invitaciones), así que el asistente aplica la plantilla a una
// invitación que ya existe y la clienta tiene que ver cuál. Sin invitaciones, el estado vacío
// explica de dónde salen y lleva a los planes en vez de pintar un botón que no puede funcionar.
//
// 3C-UX G-06 (la mitad que vive aquí): al cerrar el panel de publicar, el enlace público no estaba
// en ninguna pantalla y había que volver a publicar para recuperarlo. Cada fila dice ahora el tipo
// de evento y el estado real —«En edición» o «Publicada»— y, si está publicada, enseña el enlace
// con «Copiar» y «Ver como invitada». El estado sale de `activeRelease` de `GET …/document`, la
// misma fuente que mira el diálogo de publicar, no del `status` del módulo antiguo.
import { useState } from "react";
import { Badge, Button, EmptyState } from "@invitaciones/ui";
import { IconoEventoFecha } from "@invitaciones/icons";
import Link from "next/link";
import { es_MX } from "@/lib/i18n";
import { enlacePublico } from "@/lib/enlace-publico.ts";
import type { FilaInvitacion } from "./invitaciones.ts";
import { nombreDeTipo } from "./tipos-de-evento.ts";

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
          <FilaDeInvitacion key={inv.id} inv={inv} />
        ))}
      </ul>
    </section>
  );
}

function FilaDeInvitacion({ inv }: { readonly inv: FilaInvitacion }) {
  const enlace = inv.publicada && inv.publicToken !== null ? enlacePublico(inv.publicToken, inv.publicUrl) : null;

  return (
    <li className="flex flex-col gap-3 rounded-ui-control border border-ui-divider bg-ui-surface-raised p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-md font-semibold text-ui-ink">{inv.nombre ?? inv.event}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-sm text-ui-ink-muted">
            <IconoEventoFecha size={16} className="shrink-0" />
            {inv.date ? es_MX.editor.catalogo.fechaDeLaInvitacion(fechaLegible(inv.date)) : es_MX.editor.catalogo.sinFecha}
            <span>· {nombreDeTipo(inv.eventKind)}</span>
            <span>· {es_MX.editor.catalogo.numero(inv.id)}</span>
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {inv.estado === "con-plantilla" ? <EstadoDePublicacion publicada={inv.publicada} /> : null}
          {inv.estado === "sin-acceso" ? (
            <span className="text-sm text-ui-ink-muted">{es_MX.editor.catalogo.sinAcceso}</span>
          ) : (
            <Button variant="secundario" size="sm" asChild>
              <Link href={`/editor/${inv.id}`}>
                {inv.estado === "con-plantilla" ? es_MX.editor.catalogo.seguirEditando : es_MX.editor.catalogo.empezar}
              </Link>
            </Button>
          )}
        </span>
      </div>
      {enlace ? <EnlaceDeInvitadas enlace={enlace} idInvitacion={inv.id} /> : null}
    </li>
  );
}

function EstadoDePublicacion({ publicada }: { readonly publicada: boolean }) {
  return (
    <Badge tone={publicada ? "success" : "neutro"}>
      {publicada ? es_MX.editor.catalogo.estadoPublicada : es_MX.editor.catalogo.estadoEnEdicion}
    </Badge>
  );
}

/**
 * El enlace tal cual, seleccionable, con «Copiar» y «Ver como invitada». Se enseña el texto y no
 * solo un botón: si el portapapeles falla (permiso denegado, contexto no seguro), la clienta lo
 * puede seleccionar a mano, y el aviso se lo dice en vez de dejarla creyendo que copió algo.
 */
function EnlaceDeInvitadas({ enlace, idInvitacion }: { readonly enlace: string; readonly idInvitacion: number }) {
  const [copia, setCopia] = useState<"inicial" | "hecha" | "fallida">("inicial");
  const idEtiqueta = `enlace-invitacion-${idInvitacion}`;

  async function copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopia("hecha");
    } catch {
      setCopia("fallida");
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-ui-divider pt-3">
      <span id={idEtiqueta} className="label-sm text-ui-ink-muted">
        {es_MX.editor.catalogo.enlaceDeInvitadas}
      </span>
      {/* El enlace ocupa su propia línea: a 390 px, compartiendo fila con los dos botones, se
          quedaba en «htt…» y un enlace que no se puede leer tampoco se puede dictar por teléfono. */}
      <code className="block truncate rounded-ui-control bg-ui-surface-alt px-2.5 py-1.5 text-sm text-ui-ink">
        {enlace}
      </code>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secundario" size="sm" aria-describedby={idEtiqueta} onClick={() => void copiar()}>
          {es_MX.editor.catalogo.copiarEnlace}
        </Button>
        <Button variant="terciario" size="sm" asChild>
          <a href={enlace} target="_blank" rel="noreferrer">
            {es_MX.editor.catalogo.verComoInvitada}
          </a>
        </Button>
      </div>
      <p role="status" className="text-sm text-ui-ink-muted empty:hidden">
        {copia === "hecha"
          ? es_MX.editor.catalogo.enlaceCopiado
          : copia === "fallida"
            ? es_MX.editor.catalogo.enlaceNoCopiado
            : ""}
      </p>
    </div>
  );
}
