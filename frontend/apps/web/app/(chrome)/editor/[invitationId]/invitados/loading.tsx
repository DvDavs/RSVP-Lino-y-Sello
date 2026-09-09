// app/(chrome)/editor/[invitationId]/invitados/loading.tsx — frontera de Suspense de Next para la
// navegación A esta ruta (el `page.tsx` no busca datos por sí mismo, así que esto solo se ve un
// instante). El estado de CARGA de verdad —seis filas de esqueleto— lo pinta `PantallaInvitados` en
// el cliente mientras trae el resumen y la lista (`ui-pantalla` §7).
import { es_MX } from "@/lib/i18n";

export default function CargandoInvitados() {
  return (
    <p role="status" aria-live="polite" className="mx-auto w-full max-w-ui-page px-5 py-10 text-md text-ui-ink-muted sm:px-8">
      {es_MX.comun.cargando}
    </p>
  );
}
