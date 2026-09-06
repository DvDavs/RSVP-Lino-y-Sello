"use client";

import { textosPublicos } from "./textos";
import estilos from "./pagina.module.css";

/**
 * `04 §2`: `error.tsx` de `/i/[publicToken]` — cualquier fallo que NO sea el `404` ni el `403`
 * clasificados en `page.tsx` (red caída, `500 TPL_INTERNAL`, backend inalcanzable).
 *
 * Es el único componente cliente de la ruta además de `RenderInvitacion`, y solo se descarga cuando
 * de verdad hay un error: Next lo carga como frontera de error, no en la primera carga feliz.
 *
 * 3C-8: usa `textosPublicos` (antes `es_MX` de `lib/i18n.ts`) — mismo texto, ver `./textos.ts`.
 */
export default function ErrorInvitacionPublica({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={estilos.aviso} role="alert">
      <h1 className={estilos.avisoTitulo}>{textosPublicos.error.titulo}</h1>
      <hr className={estilos.filete} />
      <p className={estilos.avisoCuerpo}>{textosPublicos.error.cuerpo}</p>
      <button type="button" className={estilos.accion} onClick={reset}>
        {textosPublicos.reintentar}
      </button>
    </main>
  );
}
