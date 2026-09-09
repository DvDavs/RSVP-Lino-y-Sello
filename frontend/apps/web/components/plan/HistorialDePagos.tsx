// components/plan/HistorialDePagos.tsx — «Pagos de esta invitación» (wireframe
// `12-producto-completo.md` §3): el historial se pinta SIEMPRE que hay datos de la invitación, con
// pago o sin él (una invitación sin pagar puede tener intentos `FALLIDO`/`CADUCADO` detrás).
import { Badge } from "@invitaciones/ui/componentes/Badge/index.ts";
import type { TonoBadge } from "@invitaciones/ui/componentes/Badge/index.ts";
import { es_MX } from "@/lib/i18n";
import { formatearImporte } from "@/lib/pagos/dinero";
import type { EstadoDePago, Pago } from "@/lib/pagos/tipos";
import { fechaCorta } from "./formato.ts";

const TONO_POR_ESTADO: Record<EstadoDePago, TonoBadge> = {
  PAGADO: "success",
  PENDIENTE: "neutro",
  FALLIDO: "warning",
  CADUCADO: "warning",
  REEMBOLSADO: "warning",
};

export interface PropsHistorialDePagos {
  readonly pagos: readonly Pago[];
}

export function HistorialDePagos({ pagos }: PropsHistorialDePagos) {
  const t = es_MX.panel.plan.historial;

  return (
    <section aria-labelledby="plan-historial-titulo" data-testid="plan-historial">
      <h2 id="plan-historial-titulo" className="heading-md text-ui-ink">
        {t.titulo}
      </h2>

      {pagos.length === 0 ? (
        <p className="text-md mt-3 text-ui-ink-muted" data-testid="plan-historial-vacio">
          {t.vacio}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <caption className="sr-only">{t.titulo}</caption>
            <thead>
              <tr className="border-b border-ui-divider text-left text-ui-ink-muted">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  {t.fecha}
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  {t.plan}
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  {t.importe}
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  {t.estado}
                </th>
                <th scope="col" className="py-2 font-semibold">
                  {t.comprobante}
                </th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((pago) => (
                <tr key={pago.id} data-testid={`plan-historial-fila-${pago.id}`} className="border-b border-ui-divider last:border-0">
                  <td className="py-2.5 pr-4 text-ui-ink">{fechaCorta(pago.creadoEn)}</td>
                  <td className="py-2.5 pr-4 text-ui-ink">{pago.planNombre}</td>
                  <td className="py-2.5 pr-4 text-ui-ink">{formatearImporte(pago.importeCentavos, pago.moneda)}</td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={TONO_POR_ESTADO[pago.estado]}>{t.estados[pago.estado]}</Badge>
                  </td>
                  <td className="py-2.5">
                    {pago.comprobanteUrl ? (
                      <a
                        href={pago.comprobanteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-ui-link hover:underline"
                      >
                        {t.comprobante}
                      </a>
                    ) : (
                      <span className="text-ui-ink-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
