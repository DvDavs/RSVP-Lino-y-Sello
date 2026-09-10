// app/(chrome)/admin/loading.tsx — límite de Suspense de Next mientras navega hasta `/admin`
// (`ui-pantalla §2`/§7: «cualquier espera > 400 ms muestra skeleton, nunca pantalla vacía»). Pinta
// la FORMA de la pantalla que va a aparecer: cabecera, pestañas, la fila de métricas del resumen y
// una tabla — no un texto suelto. Server Component, sin datos: cada panel trae el suyo propio en
// cuanto `ConsolaAdmin` monta (comentario de cabecera de esa pieza).
import { Skeleton } from "@invitaciones/ui/componentes/Skeleton.tsx";
import { textosAdmin } from "@/lib/admin/textos";

export default function CargandoAdmin() {
  const etiqueta = textosAdmin.comun.cargando;
  return (
    <main className="mx-auto flex w-full max-w-ui-page flex-col gap-6 px-6 py-8" aria-busy="true">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-md text-ui-ink-muted">
          {etiqueta}
        </p>
      </div>
      <Skeleton variante="bloque" alto={40} ancho="min(28rem, 100%)" etiqueta={etiqueta} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((indice) => (
          <Skeleton key={indice} variante="bloque" alto={84} etiqueta={etiqueta} />
        ))}
      </div>
      <Skeleton variante="bloque" alto={280} etiqueta={etiqueta} />
    </main>
  );
}
