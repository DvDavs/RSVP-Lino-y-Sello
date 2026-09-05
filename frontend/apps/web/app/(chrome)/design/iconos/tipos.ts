// app/(chrome)/design/iconos/tipos.ts — contrato compartido entre `mitad-a.tsx` y `mitad-b.tsx`
// (brief 3C-3 §"Reparto": cada mitad añade su parte del índice de la galería en un fichero propio
// para no chocar en el merge; este tipo evita que cada mitad tenga que redeclararlo).
import type { IconName } from "@invitaciones/icons";

export interface EntradaGaleria {
  /** Nombre kebab-case del icono (inventario canónico, doc 11 §4.2). */
  nombre: IconName;
}
