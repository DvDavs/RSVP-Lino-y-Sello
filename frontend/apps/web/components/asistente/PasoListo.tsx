"use client";

// components/asistente/PasoListo.tsx — paso 4 del asistente: la confirmación y el salto al editor
// (`11 §7`, «Abrir mi invitación»). No promete nada que no sea cierto: dice que el diseño ya está
// aplicado y que nada se ve en internet hasta publicar, que es exactamente lo que hace el producto.
import { Button, Card } from "@invitaciones/ui";
import { IconoExito } from "@invitaciones/icons";
import Link from "next/link";
import { es_MX } from "@/lib/i18n";

export interface PasoListoProps {
  readonly invitationId: number;
  readonly nombreDelTipo: string;
  readonly nombreDeLaPlantilla: string;
}

export function PasoListo({ invitationId, nombreDelTipo, nombreDeLaPlantilla }: PasoListoProps) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card variant="elevada">
        <div className="flex flex-col gap-3">
          <span className="grid size-11 place-items-center rounded-ui-pill bg-ui-success-soft text-ui-on-success-soft">
            <IconoExito size={24} />
          </span>
          <p className="heading-sm text-ui-ink">{es_MX.asistente.listo.resumen(nombreDelTipo, nombreDeLaPlantilla)}</p>
          <p className="text-md text-ui-ink-muted">{es_MX.asistente.listo.queSigue}</p>
        </div>
      </Card>
      <div className="flex flex-col items-start gap-2">
        <Button size="lg" asChild data-testid="asistente-abrir-editor">
          <Link href={`/editor/${invitationId}`}>{es_MX.asistente.listo.abrir}</Link>
        </Button>
        {/* ADR-5-0B-01: editar es gratis, el plan solo hace falta para publicar — el asistente no
            empuja a pagar antes de haber visto nada, solo deja la salida a mano. */}
        <Button size="md" variant="secundario" asChild data-testid="asistente-elegir-plan">
          <Link href={`/editor/${invitationId}/plan`}>{es_MX.panel.plan.elegirPlan}</Link>
        </Button>
        <p className="text-sm text-ui-ink-muted">{es_MX.asistente.listo.notaPlan}</p>
      </div>
    </div>
  );
}
