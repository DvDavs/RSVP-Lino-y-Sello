// app/(chrome)/admin/page.tsx — la consola de administración (MASTER/ADMIN), sustituye el marcador
// del andamio 5-0d entero (ver `README.md` de esta carpeta y `12-producto-completo.md §B3.6`).
//
// Server Component: no lee nada por sí mismo (`lib/admin/cliente.ts` lee el token de
// `sessionStorage`, así que toda la carga de datos vive del lado del cliente, en `ConsolaAdmin` y
// sus paneles — comentario de cabecera de `ConsolaAdmin.tsx`). Esta página solo fija los metadatos y
// monta el armazón.
import type { Metadata } from "next";
import { es_MX } from "@/lib/i18n";
import { textosAdmin } from "@/lib/admin/textos";
import { ConsolaAdmin } from "./_componentes/ConsolaAdmin.tsx";

export const metadata: Metadata = {
  title: { absolute: `${es_MX.comun.marca} · ${textosAdmin.pagina.titulo}` },
  description: "Clientas, invitaciones, pagos y plantillas registradas del equipo.",
  // Permanente: una consola de administración no se indexa nunca (README de esta carpeta).
  robots: { index: false, follow: false },
};

export default function PaginaAdmin() {
  return <ConsolaAdmin />;
}
