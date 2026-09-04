// app/(canvas)/editor/[invitationId]/canvas/page.tsx — envoltura de SERVIDOR del lienzo.
//
// Existe solo para leer el `nonce` que `proxy.ts` puso en la cabecera de la petición y pasárselo al
// componente de cliente. Es la única forma de que el `<style nonce>` del `ThemeProvider` salga ya
// firmado en el HTML del servidor: un componente de cliente no puede llamar a `headers()`, y leer
// el nonce del DOM en un `useEffect` llega después del primer pintado — el navegador rechaza ese
// `<style>` («Refused to apply inline style», medido) y React marca discrepancia de hidratación.
//
// La ruta es dinámica por construcción: el nonce cambia en cada petición.
import { headers } from "next/headers";
import { LienzoCliente } from "./LienzoCliente.tsx";

export const dynamic = "force-dynamic";

export default async function PaginaLienzo() {
  const nonce = (await headers()).get("x-nonce") ?? "";
  return <LienzoCliente nonce={nonce} />;
}
