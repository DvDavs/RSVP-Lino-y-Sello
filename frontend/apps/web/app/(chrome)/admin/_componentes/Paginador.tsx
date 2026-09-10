// app/(chrome)/admin/_componentes/Paginador.tsx — paginación mínima de las tablas con página
// (Clientas, Invitaciones, Pagos: las tres devuelven `{ total, pagina, tamano, elementos }`,
// `lib/admin/tipos.ts`). `Plantillas` no la usa: `ListaPlantillas` no trae paginación (contrato §7).
//
// Sin componente de paginación en `packages/ui` (comprobado, no existe ninguno): dos `Button`
// terciarios del sistema («Anterior»/«Siguiente») más el indicador de página, nada de flechas
// sueltas sin nombre accesible. Se oculta a sí mismo con una sola página (nada que paginar).
//
// No lleva "use client" propio: solo se monta dentro de paneles que ya lo son (`PanelClientas`,
// `PanelInvitaciones`, `PanelPagos`), mismo patrón que `Tabla.tsx`/`BloqueConError.tsx`.
import type { JSX } from "react";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { textosAdmin } from "@/lib/admin/textos";

export interface PaginadorProps {
  /** Página actual, base 0 (igual que `PaginaClientas.pagina`, contrato §2/§3/§5). */
  readonly pagina: number;
  readonly tamano: number;
  readonly total: number;
  readonly onCambiar: (pagina: number) => void;
  readonly className?: string;
}

export function Paginador({ pagina, tamano, total, onCambiar, className }: PaginadorProps): JSX.Element | null {
  const totalPaginas = Math.max(1, Math.ceil(total / Math.max(1, tamano)));
  if (totalPaginas <= 1) return null;

  const textos = textosAdmin.comun.paginador;

  return (
    <nav aria-label={textos.etiqueta} className={className ?? "flex items-center justify-between gap-3 pt-1"}>
      <Button variant="terciario" size="sm" onClick={() => onCambiar(pagina - 1)} disabled={pagina <= 0}>
        {textos.anterior}
      </Button>
      <p className="text-sm text-ui-ink-muted" aria-live="polite">
        {textos.paginaDe(pagina + 1, totalPaginas)}
      </p>
      <Button variant="terciario" size="sm" onClick={() => onCambiar(pagina + 1)} disabled={pagina + 1 >= totalPaginas}>
        {textos.siguiente}
      </Button>
    </nav>
  );
}
