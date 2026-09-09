// components/sitio/AvisoBorrador.tsx — el aviso de que un documento de `/legal` es un BORRADOR.
//
// Regla que no se puede saltar (`README.md` de `/legal`): «cada documento lleva su aviso visible de
// que no ha pasado por abogado y la fecha de la última revisión. No se publica texto legal
// presentado como definitivo sin que el dueño lo haya validado.» Un componente único para el índice,
// el aviso de privacidad y los términos: así la fecha y el texto no pueden divergir entre los tres.
import { es_MX } from "@/lib/i18n";

export function AvisoBorrador({ className }: { readonly className?: string }) {
  return (
    <p role="note" className={`text-sm font-semibold text-ui-warning-text ${className ?? ""}`}>
      {es_MX.legal.avisoBorrador(es_MX.legal.fechaUltimaRevision)}
    </p>
  );
}
