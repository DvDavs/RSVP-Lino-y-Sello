// components/invitados/TablaInvitados.tsx — tabla de escritorio (`ed:` en adelante, 900 px). En
// móvil no existe (wireframe §B3.2): la pantalla usa `TarjetasInvitados` en su lugar.
//
// El corte es `ed:` y no `md:` porque `ed` (`--breakpoint-ed: 900px`, `(chrome)/globals.css:112`) es
// EL punto de corte del editor, medido en ADR-3-8-01, y es el que ya usan las demás pantallas del
// editor (`editor/[invitationId]/page.tsx`, `loading.tsx`, `PublishDialog.tsx`). Con `md:` (768 px)
// la tabla, que necesita 760 px de ancho mínimo más las canaletas, aparecía a un ancho en el que ya
// no cabe y se pintaba con barra horizontal propia.
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
    <div className="hidden overflow-x-auto rounded-ui-card bg-ui-surface-raised shadow-ui-1 ed:block">
      <table className="w-full min-w-[760px] border-collapse text-left">
        {/* Nombre accesible de la tabla: sin esto, un lector de pantalla anuncia «tabla, 5 columnas»
            y nada más (`ui-pantalla`, lista de verificación). Visible solo para tecnología de apoyo:
            el título de la pantalla ya lo dice en pantalla. */}
        <caption className="sr-only">{t.tabla.leyenda}</caption>
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
                    // El disparador dice lo que hace, no solo a quién: un lector de pantalla oía
                    // «María Fernanda Cruz, botón» sin saber que abre la edición (y que ahí vive el
                    // borrado). El anillo de foco es el del sistema (`--ui-focus`), no el del
                    // navegador, que aquí no se veía.
                    <button
                      type="button"
                      aria-label={t.tabla.editarA(nombreVisible(invitado.fullName))}
                      className="rounded-ui-control px-1 py-2 text-left heading-sm text-ui-ink outline-none hover:text-ui-link hover:underline focus-visible:shadow-[0_0_0_2px_var(--ui-surface-raised),0_0_0_5px_var(--ui-focus)]"
                    >
                      {nombreVisible(invitado.fullName)}
                    </button>
                  }
                />
              </td>
              <td className="px-4 py-3 align-middle">
                <p className="text-sm text-ui-ink">{t.tabla.pases(invitado.adults, invitado.children, invitado.young)}</p>
                {invitado.status === "CONFIRMED" ? (
                  <p className="text-sm text-ui-ink-muted">
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
    <div className="hidden overflow-hidden rounded-ui-card bg-ui-surface-raised shadow-ui-1 ed:block">
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
