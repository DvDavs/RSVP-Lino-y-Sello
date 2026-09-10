// app/(chrome)/admin/_componentes/EtiquetaDeEstado.tsx — la píldora de estado de la consola
// (`12-producto-completo.md §B3.6`): estado de la invitación (publicada / en edición /
// deshabilitada) y estado del pago (pagado / pendiente / devuelto), sobre el `Badge` del sistema.
//
// El color nunca es el único portador del significado: `Badge` ya exige texto SIEMPRE visible
// (`packages/ui/src/componentes/Badge/Badge.tsx`, «texto SIEMPRE presente»). Este componente solo
// fija, por familia y por estado, qué `tone` de la pareja AA le corresponde — el TEXTO en sí llega
// por `texto` (nunca literal en el JSX: lo escribe `lib/admin/textos.ts` y la pantalla lo pasa).
//
// `familia`/`estado` son una unión discriminada: no se puede pasar un estado de pago con
// `familia="invitacion"` (ni al revés) — el tipo lo impide en compilación, no en revisión.
// Presentacional (`Badge` no recibe foco, no se pulsa): sin estados de interacción, Server Component.
import type { JSX } from "react";
import { Badge, type TonoBadge } from "@invitaciones/ui/componentes/Badge/index.ts";

export type EstadoInvitacionAdmin = "publicada" | "en-edicion" | "deshabilitada";
export type EstadoPagoAdmin = "pagado" | "pendiente" | "devuelto";

const TONO_POR_ESTADO_INVITACION: Record<EstadoInvitacionAdmin, TonoBadge> = {
  publicada: "success",
  "en-edicion": "info",
  deshabilitada: "neutro",
};

const TONO_POR_ESTADO_PAGO: Record<EstadoPagoAdmin, TonoBadge> = {
  pagado: "success",
  pendiente: "warning",
  devuelto: "danger",
};

export type EtiquetaDeEstadoProps =
  | {
      readonly familia: "invitacion";
      readonly estado: EstadoInvitacionAdmin;
      readonly texto: string;
      readonly className?: string;
    }
  | {
      readonly familia: "pago";
      readonly estado: EstadoPagoAdmin;
      readonly texto: string;
      readonly className?: string;
    };

export function EtiquetaDeEstado(props: EtiquetaDeEstadoProps): JSX.Element {
  const tono = props.familia === "invitacion" ? TONO_POR_ESTADO_INVITACION[props.estado] : TONO_POR_ESTADO_PAGO[props.estado];
  return (
    <Badge tone={tono} className={props.className}>
      {props.texto}
    </Badge>
  );
}
