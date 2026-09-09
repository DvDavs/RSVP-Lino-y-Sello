// components/precios/CargaDePlanes.tsx — estado de carga de `/precios`: tres `Skeleton` con la
// altura de las tarjetas reales (wireframe `12-producto-completo.md` §4: «tres Skeleton con la
// altura exacta de las tarjetas»). Server-safe (`Skeleton` no lleva `"use client"`): se reutiliza
// tal cual desde `loading.tsx` (frontera de Next) y desde el estado interno de `PantallaPrecios`
// mientras `obtenerCatalogo()` responde.
import { Skeleton } from "@invitaciones/ui/componentes/Skeleton.tsx";
import { es_MX } from "@/lib/i18n";

/** Alto medido de una `TarjetaPlan` con tres líneas de `incluye` (nombre + precio + lista + botón). */
const ALTO_TARJETA = 420;

export function CargaDePlanes() {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {[0, 1, 2].map((indice) => (
        <Skeleton key={indice} alto={ALTO_TARJETA} etiqueta={es_MX.comun.cargando} className="rounded-ui-card" />
      ))}
    </div>
  );
}
