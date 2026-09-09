// components/invitados/TablaInvitados.tsx — tabla de escritorio (`md:` en adelante). En móvil no
// existe (wireframe §B3.2): la pantalla usa `TarjetasInvitados` en su lugar.
import { Badge, Skeleton } from "@invitaciones/ui";
import type { EventRules, GuestItem } from "@/lib/invitados/api";
import { textosInvitados as t } from "@/lib/invitados/textos";
import { BotonesCompartir, BotonesEnlace } from "./AccionesInvitado";
import { FormularioInvitado } from "./FormularioInvitado";
import { etiquetaEstado, formatoRelativo, nombreVisible, tonoEstado } from "./utilidades";

/** Alto de fila fijo: la CARGA usa el mismo valor para que no haya salto de maquetación al llegar
 *  el dato real (`ui-pantalla` §7, `CARGA`). */
export const ALTO_FILA_TABLA = 76;

export interface TablaInvitadosProps {
  readonly invitationId: number;
  readonly rules: EventRules;
  readonly invitados: readonly GuestItem[];
  readonly onCambiado: (guest: GuestItem) => void;
  readonly onEliminado: (guestId: number) => void;
}

export function TablaInvitados({ invitationId, rules, invitados, onCambiado, onEliminado }: TablaInvitadosProps) {
  return (
    <div className="hidden overflow-x-auto rounded-ui-card bg-ui-surface-raised shadow-ui-1 md:block">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead>
          <tr className="border-b border-ui-divider">
            <th scope="col" className="label-sm px-4 py-3 text-ui-ink-muted">{t.tabla.columnaNombre}</th>
            <th scope="col" className="label-sm px-4 py-3 text-ui-ink-muted">{t.tabla.columnaPases}</th>
            <th scope="col" className="label-sm px-4 py-3 text-ui-ink-muted">{t.tabla.columnaEstado}</th>
            <th scope="col" className="label-sm px-4 py-3 text-ui-ink-muted">{t.tabla.columnaEnlace}</th>
            <th scope="col" className="label-sm px-4 py-3 text-ui-ink-muted">{t.tabla.columnaCompartir}</th>
          </tr>
        </thead>
        <tbody>
          {invitados.map((invitado) => (
            <tr key={invitado.id} className="border-b border-ui-divider last:border-0" style={{ height: ALTO_FILA_TABLA }}>
              <td className="px-4 py-3 align-middle">
                <FormularioInvitado
                  invitationId={invitationId}
                  rules={rules}
                  guest={invitado}
                  onGuardado={onCambiado}
                  onEliminado={onEliminado}
                  trigger={
                    <button type="button" className="rounded-ui-control text-left text-[15px] font-semibold text-ui-ink hover:text-ui-link hover:underline">
                      {nombreVisible(invitado.fullName)}
                    </button>
                  }
                />
              </td>
              <td className="px-4 py-3 align-middle">
                <p className="text-sm text-ui-ink">{t.tabla.pases(invitado.adults, invitado.children, invitado.young)}</p>
                {invitado.status === "CONFIRMED" ? (
                  <p className="text-[12.5px] text-ui-ink-muted">
                    {t.tabla.usaPases(invitado.adultsConfirmed, invitado.childrenConfirmed, invitado.youngConfirmed)}
                    {invitado.updatedAt ? ` · ${formatoRelativo(invitado.updatedAt)}` : ""}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3 align-middle">
                <Badge tone={tonoEstado(invitado.status)}>{etiquetaEstado(invitado.status)}</Badge>
              </td>
              <td className="px-4 py-3 align-middle">
                <BotonesEnlace invitationId={invitationId} guest={invitado} />
              </td>
              <td className="px-4 py-3 align-middle">
                <BotonesCompartir invitationId={invitationId} guest={invitado} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EsqueletoTablaInvitados({ filas = 6 }: { readonly filas?: number }) {
  return (
    <div className="hidden overflow-hidden rounded-ui-card bg-ui-surface-raised shadow-ui-1 md:block">
      {Array.from({ length: filas }, (_, indice) => (
        <div
          key={indice}
          className="flex items-center border-b border-ui-divider px-4 last:border-0"
          style={{ height: ALTO_FILA_TABLA }}
        >
          <Skeleton variante="bloque" alto={16} etiqueta={indice === 0 ? t.cargando : ""} />
        </div>
      ))}
    </div>
  );
}
