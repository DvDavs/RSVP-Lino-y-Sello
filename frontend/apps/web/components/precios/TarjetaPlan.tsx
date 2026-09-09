// components/precios/TarjetaPlan.tsx — una tarjeta de plan de `/precios`. La recomendada lleva
// `ColorShadow` (vía `Card variant="color"`, ADR-3C-0-03) y botón primario; las otras dos, plana y
// botón secundario (wireframe `12-producto-completo.md` §4). Ningún precio se calcula aquí: es el
// que manda `formatearImporte` sobre `plan.precioCentavos`.
import Link from "next/link";
import { Badge } from "@invitaciones/ui/componentes/Badge/index.ts";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { Card } from "@invitaciones/ui/componentes/Card/index.ts";
import { IconoExito } from "@invitaciones/icons";
import { formatearImporte } from "@/lib/pagos/dinero";
import { es_MX } from "@/lib/i18n";
import type { Plan } from "@/lib/pagos/tipos";

export interface PropsTarjetaPlan {
  readonly plan: Plan;
  /** `catalogo.pagoEnLinea` (el backend tiene clave de Stripe) Y `pagoEnLineaDisponible()` (el
   *  frontend también la tiene): con cualquiera de las dos en `false`, nunca se abre un pago. */
  readonly pagoDisponible: boolean;
  /** `?inv=<id>` de la URL: viene de la puerta de publicación (ADR-5-0B-01). */
  readonly invitationId: string | null;
}

export function TarjetaPlan({ plan, pagoDisponible, invitationId }: PropsTarjetaPlan) {
  const conInvitacion = invitationId !== null;
  const destino = !pagoDisponible
    ? "#contacto"
    : conInvitacion
      ? `/editor/${invitationId}/plan?plan=${plan.codigo}`
      : `/acceso?volver=${encodeURIComponent("/editor")}`;
  const etiquetaBoton =
    pagoDisponible && !conInvitacion ? es_MX.sitio.precios.empezarGratis : es_MX.sitio.precios.elegir(plan.nombre);

  return (
    // `Card` no reenvía atributos que no conoce (no hace `{...resto}`, a propósito: es del sistema
    // de diseño, no un contenedor genérico) — el `data-testid` va en este envoltorio, que también
    // fija la altura para que las tres tarjetas de la rejilla midan lo mismo (`h-full`).
    <div data-testid={`precios-plan-${plan.codigo}`} className="h-full">
      <Card variant={plan.recomendado ? "color" : "elevada"} tone="accent" className="flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <p className="label-md uppercase text-ui-ink-muted">{plan.nombre}</p>
          {plan.recomendado ? <Badge tone="accent">{es_MX.sitio.precios.recomendado}</Badge> : null}
        </div>

        <div>
          <p className="display-lg text-ui-ink">{formatearImporte(plan.precioCentavos, plan.moneda)}</p>
          <p className="text-sm mt-1 text-ui-ink-muted">{es_MX.sitio.precios.pagoUnico}</p>
        </div>

        <ul className="flex flex-1 flex-col gap-2 border-t border-ui-divider pt-4">
          {plan.incluye.map((linea) => (
            <li key={linea} className="text-sm flex items-start gap-2 text-ui-ink">
              <IconoExito size={18} tone="mono" className="mt-0.5 shrink-0 text-ui-success" />
              <span>{linea}</span>
            </li>
          ))}
        </ul>

        <div>
          <Button
            asChild
            variant={plan.recomendado && pagoDisponible ? "primario" : "secundario"}
            size="md"
            className="w-full"
            data-testid={`precios-elegir-${plan.codigo}`}
          >
            <Link href={destino}>{etiquetaBoton}</Link>
          </Button>

          {!pagoDisponible ? (
            <p className="text-sm mt-3 text-ui-ink-muted">{es_MX.sitio.precios.pagoNoDisponible}</p>
          ) : !conInvitacion ? (
            <p className="text-sm mt-3 text-ui-ink-muted">{es_MX.sitio.precios.notaEmpezarGratis}</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
