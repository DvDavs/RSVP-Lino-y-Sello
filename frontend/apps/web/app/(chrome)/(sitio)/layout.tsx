// app/(chrome)/(sitio)/layout.tsx — el shell de la WEB PÚBLICA: cabecera y pie compartidos por `/`,
// `/acceso` y `/ayuda`.
//
// POR QUÉ UN GRUPO PROPIO Y NO EL LAYOUT DE `(chrome)`. La cabecera del sitio no puede vivir en
// `app/(chrome)/layout.tsx` porque ese layout también envuelve `/editor/**` —que ya tiene su propia
// cabecera, con estado de guardado y botón de publicar (de otro dueño)— y `/design/**`, la galería
// del sistema, cuya regresión visual son 279 capturas que esta tarea NO puede mover. Un grupo de
// rutas no cambia ninguna URL y deja la cabecera exactamente donde tiene que estar.
//
// `not-found.tsx` y `error.tsx` viven fuera de este grupo (Next los quiere en la raíz del grupo con
// layout raíz) y montan el mismo shell a mano con `<MarcoSitio>`.
import type { ReactNode } from "react";
import { MarcoSitio } from "@/components/sitio/MarcoSitio";

export default function LayoutSitio({ children }: { readonly children: ReactNode }) {
  return <MarcoSitio>{children}</MarcoSitio>;
}
