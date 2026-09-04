import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/**
 * `04 §2`: layout de `/editor/[invitationId]` — "carga documento + provider del store". ESQUELETO:
 * aquí solo se valida la forma del parámetro de ruta (server component, sin auth de por medio). La
 * carga real del documento (`GET .../document`, ruta 3) y el `StoreProvider` de Zustand (`04 §10`)
 * son del bloque 3-4: el token vive en `sessionStorage` (P8) y por eso la carga autenticada ocurre
 * en el cliente (ver `page.tsx` de esta misma carpeta), no aquí.
 */
export default async function InvitationLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ invitationId: string }>;
}) {
  const { invitationId } = await params;
  if (!/^\d+$/.test(invitationId)) {
    notFound();
  }
  return children;
}
