// components/pago/CargaPago.tsx — el instante en que Next resuelve el segmento `/pago`, antes de
// que `PantallaPago` (cliente) sepa siquiera si hay una invitación que consultar. Reutilizado por
// `loading.tsx` (frontera de Next) y por el estado interno "cargando" de `PantallaPago` mientras
// resuelve la primera llamada a `obtenerPlanDeInvitacion`. Server-safe: `ProgressRing` no lleva
// `"use client"`.
import { ProgressRing } from "@invitaciones/ui/componentes/ProgressRing/index.ts";
import { es_MX } from "@/lib/i18n";

export function CargaPago() {
  return (
    <div className="mx-auto flex w-full max-w-ui-page flex-col items-center gap-4 px-5 py-20 text-center sm:px-8">
      <ProgressRing indeterminate label={es_MX.comun.cargando} size={72} />
    </div>
  );
}
