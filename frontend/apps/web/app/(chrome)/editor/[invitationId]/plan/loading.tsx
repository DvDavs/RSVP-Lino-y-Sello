// app/(chrome)/editor/[invitationId]/plan/loading.tsx — frontera de Next para la transición de
// ruta. La carga de los DATOS (plan + catálogo) es interna a `PantallaPlan` (client component, P8):
// esto solo cubre el instante en que Next resuelve el segmento de servidor antes de montarla.
import { Skeleton } from "@invitaciones/ui/componentes/Skeleton.tsx";
import { es_MX } from "@/lib/i18n";

export default function CargandoPlan() {
  return (
    <div className="mx-auto w-full max-w-ui-page px-4 py-10 sm:px-8">
      <Skeleton variante="bloque" alto={260} etiqueta={es_MX.panel.plan.cargando} className="rounded-ui-card" />
      <div className="mt-6">
        <Skeleton variante="texto" lineas={2} etiqueta={es_MX.panel.plan.cargando} />
      </div>
    </div>
  );
}
