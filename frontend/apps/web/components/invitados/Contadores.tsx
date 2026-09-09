// components/invitados/Contadores.tsx — los cuatro contadores en vivo del wireframe (§B3.2), con la
// forma `ColorShadow` bajo la fila UNA sola vez (`11 §3.4` regla 8: una sombra de color por vista).
import { ColorShadow } from "@invitaciones/ui/shapes";
import type { GuestSummary } from "@/lib/invitados/api";
import { textosInvitados as t } from "@/lib/invitados/textos";

interface Contador {
  readonly etiqueta: string;
  readonly valor: string;
}

export function Contadores({ resumen }: { readonly resumen: GuestSummary }) {
  const contadores: readonly Contador[] = [
    { etiqueta: t.contadores.confirmados, valor: String(resumen.guests.confirmed) },
    { etiqueta: t.contadores.pendientes, valor: String(resumen.guests.pending) },
    { etiqueta: t.contadores.noAsisten, valor: String(resumen.guests.declined) },
    {
      etiqueta: t.contadores.lugares,
      valor: t.contadores.lugaresDe(resumen.seats.totalConfirmed, resumen.seats.totalInvited),
    },
  ];

  return (
    <ColorShadow tone="support-2" radius="lg" className="w-fit max-w-full">
      <dl className="grid grid-cols-2 gap-x-8 gap-y-5 rounded-ui-card bg-ui-surface-raised p-5 sm:grid-cols-4">
        {contadores.map((contador) => (
          <div key={contador.etiqueta}>
            <dt className="label-sm text-ui-ink-muted">{contador.etiqueta}</dt>
            <dd className="display-sm text-ui-ink">{contador.valor}</dd>
          </div>
        ))}
      </dl>
    </ColorShadow>
  );
}
