"use client";

// app/(public)/r/[token]/error.tsx — frontera de error de Next para esta ruta. Como `page.tsx` no
// hace ningún `fetch` propio (todo el estado personal vive en `PantallaInvitado`, que ya tiene sus
// propios estados "no-resuelve"/"límite"/"error" resueltos con `useState`, nunca lanzando), esta
// frontera solo se activa ante un fallo de RENDER de verdad (una excepción de React), no ante un
// fallo de red del invitado — ese ya lo cubre la propia isla sin recargar la página entera.
//
// Mismo patrón que `../../i/[publicToken]/error.tsx`: textos propios en `./textos.ts`, nunca
// `lib/i18n.ts` (arrastraría el chrome entero al JS de la ruta que más gente abre).
import { textosInvitado } from "./textos";
import estilos from "./pagina.module.css";

export default function ErrorInvitado({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={estilos.aviso} role="alert">
      <div className={estilos.avisoContenido}>
        <h1 className={estilos.avisoTitulo}>{textosInvitado.error.titulo}</h1>
        <hr className={estilos.filete} />
        <p className={estilos.avisoCuerpo}>{textosInvitado.error.cuerpo}</p>
        <button type="button" className={estilos.accion} onClick={reset}>
          {textosInvitado.reintentar}
        </button>
      </div>
    </main>
  );
}
