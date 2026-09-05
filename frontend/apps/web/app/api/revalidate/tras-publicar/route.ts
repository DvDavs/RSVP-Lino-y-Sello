// app/api/revalidate/tras-publicar/route.ts — QUE LA INVALIDACIÓN OCURRA DE VERDAD (U-5).
//
// El defecto medido: la clienta publicó «Paulina & Emilio», el diálogo le juró «✅ Tu invitación ya
// se puede ver en internet», y a t+0/2/5/10 s el enlace seguía sirviendo «Mariana & Rodrigo».
// Cinco minutos (`s-maxage=300`) enseñando la versión anterior a los primeros invitados.
// Causa: `/i/[publicToken]` es ISR con `next.tags: ["invitation:<token>"]`, y el gancho que purga
// esa etiqueta —`POST /api/revalidate`, ADR-1R-F-09/ADR-2-6-01— **nadie lo llamaba**: cero
// peticiones en todo el registro. El `RevalidationNotifier` del backend existe y funciona, pero
// nace DESACTIVADO (`application.yml:93`: «VACIAS = FUNCION DESACTIVADA») y el arranque documentado
// no fija `TEMPLATES2_REVALIDATE_URL`/`_TOKEN` ni `REVALIDATE_SECRET`.
//
// Este handler es el camino que SÍ está en manos del frontend: lo llama el propio editor en cuanto
// el `POST …/release` responde, y hasta que no contesta, el diálogo NO afirma que ya se puede ver.
// NO sustituye al webhook del backend —que sigue siendo el camino correcto para los cambios que no
// nacen del editor— sino que garantiza que el caso que vio la clienta deje de ocurrir aunque el
// backend esté sin configurar. Cerrar el hueco del arranque exige tocar `src/**`/`scripts/**`, que
// este bloque tiene prohibidos: queda en `preguntas-abiertas.md` § P-3-8-5.
//
// ── Por qué no lleva secreto compartido, y por qué eso es seguro ──────────────────────────────
// El secreto de `/api/revalidate` protege una llamada de SERVIDOR a SERVIDOR; aquí quien llama es
// el navegador de la clienta, que no puede guardar un secreto. En su lugar, la autorización es una
// PRUEBA DE ESTADO: antes de purgar nada, este handler pregunta al backend
// `GET /public/i/{token}/exists` (ruta pública, `03 §3.16`) y exige que el estado real coincida con
// el motivo alegado — «publicado» solo purga si de verdad está publicado; «despublicado» y «enlace
// nuevo», solo si de verdad ya no lo está. Quien no tenga el token no puede nombrar la etiqueta, y
// quien lo tenga solo consigue que su propia invitación se sirva fresca: exactamente lo que ya
// puede provocar recargando a los 300 s. No se acepta ninguna etiqueta arbitraria: la etiqueta se
// CONSTRUYE aquí a partir del token validado.
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getApiBaseUrl } from "@/lib/api-client";

/** El `publicToken` del backend es opaco; se acota su forma para que no pueda torcer la ruta. */
const Cuerpo = z.object({
  publicToken: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  motivo: z.enum(["published", "unpublished", "token-rotated"]),
});

/** Qué tiene que decir `exists` para que el motivo alegado sea cierto. */
const PUBLICADO_ESPERADO: Record<z.infer<typeof Cuerpo>["motivo"], boolean> = {
  published: true,
  unpublished: false,
  "token-rotated": false,
};

export async function POST(req: Request): Promise<Response> {
  let crudo: unknown;
  try {
    crudo = await req.json();
  } catch {
    return Response.json({ revalidated: false, error: "malformed_json" }, { status: 400 });
  }

  const analizado = Cuerpo.safeParse(crudo);
  if (!analizado.success) {
    return Response.json({ revalidated: false, error: "invalid_body" }, { status: 400 });
  }
  const { publicToken, motivo } = analizado.data;

  let publicado: boolean;
  try {
    const r = await fetch(`${getApiBaseUrl()}/public/i/${publicToken}/exists`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!r.ok) return Response.json({ revalidated: false, error: "estado_desconocido" }, { status: 502 });
    publicado = ((await r.json()) as { published?: boolean }).published === true;
  } catch {
    // El editor lo trata como «no pudimos confirmarlo» y lo dice; nunca como un éxito silencioso.
    return Response.json({ revalidated: false, error: "backend_inalcanzable" }, { status: 502 });
  }

  if (publicado !== PUBLICADO_ESPERADO[motivo]) {
    return Response.json({ revalidated: false, error: "estado_no_coincide" }, { status: 409 });
  }

  // `{ expire: 0 }`: en next@16 `revalidateTag` exige el segundo argumento y esto es lo más cercano
  // a la purga incondicional que pedía `04 §15.2` (mismo razonamiento que `../route.ts`).
  const tag = `invitation:${publicToken}`;
  revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: true, tag, motivo, at: Date.now() });
}
