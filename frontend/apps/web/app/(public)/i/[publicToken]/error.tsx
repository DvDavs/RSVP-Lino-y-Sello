"use client";

import { es_MX } from "@/lib/i18n";
import estilos from "./pagina.module.css";

/**
 * `04 §2`: `error.tsx` de `/i/[publicToken]` — cualquier fallo que NO sea el `404` ni el `403`
 * clasificados en `page.tsx` (red caída, `500 TPL_INTERNAL`, backend inalcanzable).
 *
 * Es el único componente cliente de la ruta además de `RenderInvitacion`, y solo se descarga cuando
 * de verdad hay un error: Next lo carga como frontera de error, no en la primera carga feliz.
 */
export default function ErrorInvitacionPublica({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={estilos.aviso} role="alert">
      <h1 className={estilos.avisoTitulo}>{es_MX.publico.error.titulo}</h1>
      <hr className={estilos.filete} />
      <p className={estilos.avisoCuerpo}>{es_MX.publico.error.cuerpo}</p>
      <button type="button" className={estilos.accion} onClick={reset}>
        {es_MX.comun.reintentar}
      </button>
    </main>
  );
}
