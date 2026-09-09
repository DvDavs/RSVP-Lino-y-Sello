// app/(public)/r/[token]/renderPublico.ts — fetch MÍNIMO de `GET /public/i/{publicToken}/render`
// para `InvitacionCompleta` (`PantallaInvitado.tsx`), sin pasar por `lib/api-client.ts`.
//
// `lib/api-client.ts` ya trae `getPublicRender` con exactamente esta forma (§15 de `03-api.md`),
// pero importarlo desde aquí — un componente `"use client"` — mete en el primer JS de ESTA ruta el
// módulo `lib/api-client.ts` entero, cuya cabecera hace `import { OperationBatch } from
// "@invitaciones/schema"` (el esquema de operaciones del editor, con Zod). Medido con `pnpm run
// build && pnpm run budget` (README de esta carpeta, §Presupuesto): ese único import añadía ~87 KB
// gz al bundle de `/r/[token]` — la ruta que MÁS gente abre, la que menos puede permitírselo —, sin
// que esta pantalla use ni el editor ni Zod para nada. Mismo motivo por el que `lib/invitados/
// rsvp.ts` ya evita ese módulo para las rutas del §2 del contrato; esto hace lo mismo para el único
// otro fetch de esta pantalla (el render público, que no lleva ningún dato del invitado —
// contrato §3, no confundir con `obtenerRsvp`/`enviarRsvp`, que sí son personales).
import { ApiError, UnknownApiError } from "@/lib/errors";
import type { PublicRenderResponse, PublicRenderResult } from "@/lib/api-types";

/** Mismo valor que `lib/api-client.ts#getApiBaseUrl` (`NEXT_PUBLIC_API_BASE_URL`). Se duplica esta
 *  única línea en vez de importarla de allí — ver el motivo arriba: importar CUALQUIER cosa de ese
 *  módulo arrastra `@invitaciones/schema` entera al bundle del cliente. */
function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:6003";
}

/**
 * `GET /public/i/{publicToken}/render` — SIN auth, SIN `If-None-Match` (esta pantalla no cachea:
 * el `publicToken` solo se conoce tras resolver el token del invitado, así que cada carga pide el
 * render fresco; el 304 se maneja de todos modos por si el backend lo devolviera). Nunca se llama
 * antes de `obtenerRsvp` (contrato §2): el `publicToken` viaja en su respuesta.
 */
export async function obtenerRenderPublico(publicToken: string): Promise<PublicRenderResult> {
  const url = `${getApiBaseUrl()}/public/i/${encodeURIComponent(publicToken)}/render`;
  const respuesta = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const etag = respuesta.headers.get("ETag");

  if (respuesta.status === 304) {
    return { status: "not-modified", etag };
  }

  const textoCrudo = await respuesta.text();

  if (respuesta.ok) {
    if (textoCrudo.length === 0) throw new UnknownApiError(respuesta.status, textoCrudo);
    return { status: "ok", data: JSON.parse(textoCrudo) as PublicRenderResponse, etag };
  }

  // No-2xx: se clasifica SIEMPRE por su `code` (P1) — nunca se descarta el cuerpo en silencio.
  let cuerpo: unknown;
  try {
    cuerpo = textoCrudo.length > 0 ? JSON.parse(textoCrudo) : undefined;
  } catch {
    cuerpo = undefined;
  }
  if (typeof cuerpo === "object" && cuerpo !== null && typeof (cuerpo as { code?: unknown }).code === "string") {
    const c = cuerpo as { code: string; message?: unknown };
    throw new ApiError(
      {
        timestamp: new Date().toISOString(),
        statusCode: respuesta.status,
        code: c.code,
        message: typeof c.message === "string" ? c.message : "",
        details: undefined,
      },
      respuesta.status,
    );
  }
  throw new UnknownApiError(respuesta.status, textoCrudo);
}
