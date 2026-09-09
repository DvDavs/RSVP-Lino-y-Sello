// components/plan/PlanPagado.tsx — estado «con pago» de `/editor/[invitationId]/plan` (wireframe
// `12-producto-completo.md` §3): tarjeta con el nombre del plan, insignia de éxito, fecha e importe
// (SIEMPRE del backend), lo que incluye, y la salida al editor. `plan: null` es una invitación
// marcada pagada a mano (ADMIN o siembra, `handoffs/5-4-contrato-pagos.md` §2.2): sin importe que
// mostrar, se dice la verdad («Plan activo») en vez de inventar un nombre o un precio.
import Link from "next/link";
import { Badge } from "@invitaciones/ui/componentes/Badge/index.ts";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { Card } from "@invitaciones/ui/componentes/Card/index.ts";
import { IconoExito } from "@invitaciones/icons";
import { es_MX } from "@/lib/i18n";
import { formatearImporte } from "@/lib/pagos/dinero";
import type { PlanDeInvitacion } from "@/lib/pagos/tipos";
import { fechaLarga } from "./formato.ts";

export interface PropsPlanPagado {
  readonly invitationId: number;
  readonly plan: PlanDeInvitacion;
}

export function PlanPagado({ invitationId, plan }: PropsPlanPagado) {
  const t = es_MX.panel.plan.pagado;

  return (
    <section data-testid="plan-con-pago" aria-labelledby="plan-con-pago-titulo">
      <Card variant="elevada" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="plan-con-pago-titulo" className="heading-lg text-ui-ink">
            {plan.plan ? `Plan ${plan.plan.nombre}` : t.planActivo}
          </h2>
          <Badge tone="success">
            <IconoExito size={14} tone="mono" className="mr-1 inline-block align-[-2px]" />
            {t.badgePagado}
          </Badge>
        </div>

        {plan.plan && plan.pagadoEn ? (
          <p className="text-md text-ui-ink-muted">{t.pagadoEl(fechaLarga(plan.pagadoEn), formatearImporte(plan.plan.precioCentavos, plan.plan.moneda))}</p>
        ) : (
          <p className="text-md text-ui-ink-muted">{t.sinDatosDePlan}</p>
        )}

        {plan.plan && plan.plan.incluye.length > 0 ? (
          <ul className="flex flex-col gap-1.5 border-t border-ui-divider pt-4 text-sm text-ui-ink">
            {plan.plan.incluye.map((linea) => (
              <li key={linea} className="flex items-start gap-2">
                <IconoExito size={16} tone="mono" className="mt-0.5 shrink-0 text-ui-success" />
                <span>{linea}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-2 flex flex-wrap gap-3">
          <Button asChild size="md" data-testid="plan-ir-al-editor">
            <Link href={`/editor/${invitationId}`}>{t.irAMiInvitacion}</Link>
          </Button>
          {plan.pagos[0]?.comprobanteUrl ? (
            <Button asChild variant="secundario" size="md" data-testid="plan-ver-comprobante">
              <a href={plan.pagos[0].comprobanteUrl} target="_blank" rel="noreferrer">
                {t.verComprobante}
              </a>
            </Button>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
