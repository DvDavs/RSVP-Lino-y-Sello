// preview-app/Lienzo.tsx — la invitación y nada más. Es lo que fotografía `plantilla capturas`.
//
// Monta `SectionsRoot` en `mode="public"`, igual que `apps/web/app/(public)/_componentes/
// RenderInvitacion.tsx`: sin overlays, sin `data-block-*` y sin manejadores de activación
// (`04 §5.3 U-07`). El previsualizador NO es el editor.
//
// Si el paquete no pasa `check`, aquí NO se pinta una página en blanco: se enseña el diagnóstico con
// el MISMO formato de tres líneas de la línea de órdenes (`src/formato.ts`), que es contrato.
import { SectionsRoot } from "@invitaciones/sections";
import { useEstado } from "./estado.ts";
import { Diagnostico } from "./Diagnostico.tsx";
import "./lienzo.css";

export function Lienzo({ paleta, fuentes }: { readonly paleta: string | null; readonly fuentes: string | null }) {
  const estado = useEstado(paleta, fuentes);

  if (estado === null) return <p className="kit-cargando">Componiendo el paquete…</p>;
  if (!estado.ok || estado.composed === undefined) {
    return (
      <div className="kit-lienzo-roto" data-estado="error">
        <Diagnostico estado={estado} />
      </div>
    );
  }
  return <SectionsRoot composed={estado.composed} mode="public" />;
}
