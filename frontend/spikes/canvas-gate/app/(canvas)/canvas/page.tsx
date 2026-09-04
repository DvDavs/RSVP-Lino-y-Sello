import CanvasApp from "./CanvasApp";

/**
 * Ruta del lienzo (`/canvas`). En `apps/web` será `/editor/[invitationId]/canvas` (`04 §2`).
 *
 * C3 — hoja sin navegación ni datos: **sin `<Link>`, sin `useRouter`, sin `fetch`**. Todo el
 * contenido entra por `RENDER` (`postMessage`), nunca por la API. Es Server Component y no consulta
 * nada: lo único dinámico es el `nonce` de la CSP, que pone el middleware.
 *
 * `?probe=` activa los CONTROLES NEGATIVOS del spike (no existen en producción):
 *  - `inline-style` sirve un atributo `style=` en el HTML → debe producir una violación de CSP,
 *    lo que demuestra que el contador de A4 no está siempre a cero por casualidad.
 *  - `fetch` intenta una petición de red → debe bloquearla `connect-src 'none'` (control de A8).
 */
export default async function CanvasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const probe = (await searchParams).probe;
  return (
    <>
      {probe === "inline-style" ? (
        // eslint-disable-next-line react/forbid-dom-props
        <div id="probe-inline-style" style={{ color: "#c00000" }}>
          control: atributo style en línea
        </div>
      ) : null}
      <CanvasApp probeFetch={probe === "fetch"} />
    </>
  );
}
