// app/api/revalidate/route.ts — webhook que el backend llama tras publicar/despublicar/rotar el
// enlace (contratos.md §8, ADR-2-6-01; 04-frontend-y-editor.md §15.2). Cuerpo EXACTO fijado por el
// backend (`RevalidationNotifier.kt:171-173`, ver `preguntas-abiertas.md` punto C.8):
//   { "tag": "invitation:<publicToken>", "publicToken": "<publicToken>", "reason": "published"|"unpublished"|"token-rotated" }
// Cabecera `x-revalidate-token`, comparada en tiempo constante. Sin `REVALIDATE_SECRET` configurado,
// el endpoint RECHAZA TODO (nunca "acepta porque no hay token configurado").
//
// HALLAZGO no cubierto por `04 §15.2` (verificado contra `next@16.3.4`, no supuesto): esa sección
// muestra `revalidateTag(tag)` de un solo argumento. En esta versión de Next, `revalidateTag` exige
// un SEGUNDO argumento obligatorio (`profile: string | { expire?: number }`,
// `next/dist/server/web/spec-extension/revalidate.d.ts`) — el build ni siquiera compila sin él. Se
// usa `{ expire: 0 }`: la entrada se considera caducada de inmediato, que es el equivalente más
// cercano a la purga incondicional que pedía el diseño original.
import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";

const RevalidateBody = z.object({
  tag: z.string().min(1),
  publicToken: z.string().min(1),
  reason: z.enum(["published", "unpublished", "token-rotated"]),
});

/** Comparación en tiempo constante; longitudes distintas nunca deben filtrar información por timing. */
function tokensCoinciden(recibido: string, esperado: string): boolean {
  const bufferRecibido = Buffer.from(recibido, "utf8");
  const bufferEsperado = Buffer.from(esperado, "utf8");
  if (bufferRecibido.length !== bufferEsperado.length) {
    // Se sigue llamando a timingSafeEqual sobre un par de igual longitud construido a partir del
    // esperado: así el tiempo de esta rama no depende de la longitud de lo recibido tampoco.
    timingSafeEqual(bufferEsperado, bufferEsperado);
    return false;
  }
  return timingSafeEqual(bufferRecibido, bufferEsperado);
}

export async function POST(req: Request): Promise<Response> {
  const esperado = process.env.REVALIDATE_SECRET;
  // Sin variable de entorno configurada, NUNCA se acepta nada (no hay "modo abierto" implícito).
  if (!esperado || esperado.length === 0) {
    return Response.json({ error: "revalidate_not_configured" }, { status: 401 });
  }

  const recibido = req.headers.get("x-revalidate-token") ?? "";
  if (!tokensCoinciden(recibido, esperado)) {
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }

  let cuerpoCrudo: unknown;
  try {
    cuerpoCrudo = await req.json();
  } catch {
    return Response.json({ error: "malformed_json" }, { status: 400 });
  }

  const analizado = RevalidateBody.safeParse(cuerpoCrudo);
  if (!analizado.success) {
    return Response.json(
      { error: "invalid_body", issues: analizado.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { tag, publicToken, reason } = analizado.data;
  const etiquetaEsperada = `invitation:${publicToken}`;
  if (tag !== etiquetaEsperada) {
    // El backend siempre manda `tag === "invitation:" + publicToken" (ADR-2-6-01); si algún día
    // discrepan, se revalida la que de verdad corresponde al token, no la que llegó suelta.
    revalidateTag(etiquetaEsperada, { expire: 0 });
    return Response.json({ revalidated: true, tag: etiquetaEsperada, reason, at: Date.now() });
  }

  revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: true, tag, reason, at: Date.now() });
}
