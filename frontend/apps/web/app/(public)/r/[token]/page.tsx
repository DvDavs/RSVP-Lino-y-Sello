// app/(public)/r/[token]/page.tsx — MARCADOR del ENLACE PERSONAL DEL INVITADO.
// Dueña: sesión E2 (invitados, RSVP y compartir). Se sustituye entera (ver `README.md`).
//
// El marcador es DELIBERADAMENTE CIEGO: no mira el token, no consulta al backend y responde lo mismo
// para un token válido, uno caducado y uno inventado. Un marcador que distinguiera esos casos sería
// ya un oráculo de enumeración de invitados, justo lo que E2 tiene que evitar cuando ponga la
// pantalla real.
import type { Metadata } from "next";
import { textosInvitado } from "./textos";
import estilos from "./pagina.module.css";

export const metadata: Metadata = {
  title: textosInvitado.titulo,
  // El layout de `(public)` ya declara `noindex`, y `next.config.ts` añade `X-Robots-Tag`. Se repite
  // aquí a propósito: es la tercera capa, y la única que sobrevive si alguien cambia el layout.
  robots: { index: false, follow: false },
};

export default function MarcadorInvitado() {
  return (
    <main className={estilos.aviso}>
      <h1 className={estilos.titulo}>{textosInvitado.marcador.encabezado}</h1>
      <hr className={estilos.filete} />
      <p className={estilos.cuerpo}>{textosInvitado.marcador.cuerpo}</p>
    </main>
  );
}
