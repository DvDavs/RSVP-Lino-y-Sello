// components/invitados/TarjetasInvitados.tsx — la lista en móvil (< `ed`, 900 px): la tabla no existe
// (wireframe §B3.2). Cada invitado es una tarjeta apilada; compartir vive en un `Sheet` propio, una
// acción a la vez, pulgar abajo.
import { useState } from "react";
import { Badge, Button, Card, Sheet, Skeleton } from "@invitaciones/ui";
import type { EventRules, GuestItem } from "@/lib/invitados/api";
import { textosInvitados as t } from "@/lib/invitados/textos";
import { BotonesCompartir, BotonesEnlace } from "./AccionesInvitado";
import { FormularioInvitado } from "./FormularioInvitado";
import { etiquetaEstado, nombreVisible, tonoEstado } from "./utilidades";

/** Mismo alto para la tarjeta real y su esqueleto (`ui-pantalla` §7: sin salto de maquetación). */
export const ALTO_TARJETA_MOVIL = 168;

function SheetCompartir({ invitationId, invitado }: { readonly invitationId: number; readonly invitado: GuestItem }) {
  const [abierto, setAbierto] = useState(false);
  const nombre = nombreVisible(invitado.fullName);
  return (
    <Sheet
      open={abierto}
      onOpenChange={setAbierto}
      trigger={
        // El nombre del invitado va en el nombre accesible: en la lista de móvil no hay fila de
        // tabla que dé contexto, y «Compartir, botón» repetido veinticinco veces no dice con quién.
        <Button variant="secundario" size="md" className="flex-1" aria-label={t.compartir.tituloDialogo(nombre)}>
          {t.acciones.compartir}
        </Button>
      }
      title={t.compartir.tituloDialogo(nombre)}
      description={t.compartir.descripcionDialogo}
    >
      <div className="grid gap-4">
        <BotonesEnlace invitationId={invitationId} guest={invitado} disposicion="apilado" />
        <BotonesCompartir invitationId={invitationId} guest={invitado} disposicion="apilado" />
      </div>
    </Sheet>
  );
}

export interface TarjetasInvitadosProps {
  readonly invitationId: number;
  readonly rules: EventRules;
  readonly invitados: readonly GuestItem[];
  readonly onCambiado: (guest: GuestItem) => void;
  readonly onEliminado: (guestId: number) => void;
}

export function TarjetasInvitados({ invitationId, rules, invitados, onCambiado, onEliminado }: TarjetasInvitadosProps) {
  return (
    <ul className="grid gap-3 ed:hidden">
      {invitados.map((invitado) => (
        <li key={invitado.id} style={{ minHeight: ALTO_TARJETA_MOVIL }}>
          <Card variant="plana" className="flex h-full flex-col gap-3">
            <div>
              {/* `h2`, no `h3`: el único encabezado por encima es el `h1` de la pantalla, y saltarse
                  el nivel es una violación de `heading-order` de axe (`ui-pantalla` §9). */}
              <h2 className="heading-sm text-ui-ink">{nombreVisible(invitado.fullName)}</h2>
              <p className="text-sm text-ui-ink-muted">
                {t.tabla.pases(invitado.adults, invitado.children, invitado.young)}
              </p>
            </div>
            <Badge tone={tonoEstado(invitado.status)} className="w-fit">
              {etiquetaEstado(invitado.status)}
            </Badge>
            <div className="mt-auto flex gap-2">
              <SheetCompartir invitationId={invitationId} invitado={invitado} />
              <FormularioInvitado
                invitationId={invitationId}
                rules={rules}
                guest={invitado}
                onGuardado={onCambiado}
                onEliminado={onEliminado}
                trigger={
                  <Button
                    variant="terciario"
                    size="md"
                    className="flex-1"
                    aria-label={t.tabla.editarA(nombreVisible(invitado.fullName))}
                  >
                    {t.acciones.editar}
                  </Button>
                }
              />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function EsqueletoTarjetasInvitados({ tarjetas = 6 }: { readonly tarjetas?: number }) {
  return (
    <ul className="grid gap-3 ed:hidden">
      {Array.from({ length: tarjetas }, (_, indice) => (
        <li key={indice} style={{ minHeight: ALTO_TARJETA_MOVIL }} className="rounded-ui-card bg-ui-surface-raised p-6 shadow-ui-1">
          <Skeleton variante="bloque" alto={112} etiqueta={indice === 0 ? t.cargando : ""} />
        </li>
      ))}
    </ul>
  );
}
