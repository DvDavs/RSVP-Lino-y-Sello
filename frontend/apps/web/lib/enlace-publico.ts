// lib/enlace-publico.ts — EL ENLACE QUE LA CLIENTA MANDA A SUS INVITADOS (U-6).
//
// El defecto medido: «Copiar enlace», el texto de WhatsApp y «Ver como invitado» entregaban
// `http://localhost/i/pub_…` — el `publicUrl` que devuelve el backend tal cual (`app.frontend.url`
// vale `http://localhost` por defecto, `application.yml:94`). Si la novia lo manda a doscientos
// invitados, **a ninguno le abre**; ni a ella misma, que recibió `ERR_CONNECTION_REFUSED`
// (`bitacora/3-ux.md` §1.10, capturas `33` y `36`).
//
// Quién debe construir el enlace: **el sitio que lo enseña**, no el servidor que no sabe por qué
// dominio llegó la clienta. `04 §6.5` daba por hecho un origen público correcto
// (`https://invitaciones.mx/i/01J8ZC…`) y no decía quién lo arma — hueco D-13.
//
// Orden de resolución, de más fiable a menos:
//   1. `NEXT_PUBLIC_SITE_URL` — el origen que el despliegue declara para sí mismo.
//   2. `window.location.origin` — el origen por el que la clienta está entrando AHORA MISMO. Es
//      correcto por construcción: si ella llegó por ahí, sus invitados también pueden.
//   3. el `publicUrl` del servidor — último recurso, y solo para no quedarse sin nada.

/** Hosts que NO sirven para compartir: solo abren en la máquina donde corre el servidor. */
const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]", "host.docker.internal"]);

export function esOrigenLocal(origen: string): boolean {
  try {
    const url = new URL(origen);
    return HOSTS_LOCALES.has(url.hostname);
  } catch {
    return true; // lo que no es una URL válida tampoco sirve para compartir
  }
}

/** `https://sitio.mx/` → `https://sitio.mx` (sin barra final). `null` si no es una URL utilizable. */
function normalizarOrigen(valor: string | undefined | null): string | null {
  if (!valor) return null;
  try {
    const url = new URL(valor);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** El origen público del sitio, o `null` si no hay ninguno declarado ni deducible. */
export function origenPublico(): string | null {
  const declarado = normalizarOrigen(process.env.NEXT_PUBLIC_SITE_URL);
  if (declarado) return declarado;
  if (typeof window !== "undefined" && window.location?.origin) return normalizarOrigen(window.location.origin);
  return null;
}

/**
 * El enlace que se copia, se manda por WhatsApp y abre «Ver como invitado».
 * `publicUrlServidor` solo se usa si no hay ningún origen del sitio (nunca en el navegador).
 */
export function enlacePublico(publicToken: string, publicUrlServidor?: string | null): string {
  const origen = origenPublico();
  if (origen) return `${origen}/i/${publicToken}`;
  return publicUrlServidor ?? `/i/${publicToken}`;
}

/**
 * Comprobación de arranque (U-6, segunda mitad: «falla el arranque si ese origen es `localhost` en
 * un despliegue real»). Devuelve el motivo del fallo, o `null` si todo está en orden.
 *
 * Qué cuenta como «despliegue real», y por qué así: un `next start` de este repositorio —el que
 * levantan Playwright y Lighthouse para medir— también corre con `NODE_ENV=production` y sobre
 * `127.0.0.1`. Distinguirlos por el `NODE_ENV` a secas tumbaría las compuertas del propio proyecto.
 * La señal que sí los separa es **a qué backend habla**: en todos los arranques locales de este
 * repositorio la API es `http://127.0.0.1:6003` (`playwright.config.ts`, `lighthouserc.cjs`,
 * `scripts/dev-backend.sh`), y un despliegue real nunca tiene su API en el bucle local del propio
 * contenedor del frontend. Con la API en un host real y el origen público en `localhost`, el
 * despliegue está roto de la forma exacta que describe U-6 y debe negarse a arrancar.
 * `PERMITIR_ORIGEN_LOCAL=1` es la puerta de escape explícita, para quien de verdad quiera esa
 * combinación. Registrado como pregunta abierta P-3-8-3 por si el dueño prefiere otro criterio.
 */
export function motivoDeArranqueInvalido(entorno: NodeJS.ProcessEnv = process.env): string | null {
  if (entorno.NODE_ENV !== "production") return null;
  // `next build` también entra por aquí en algunas fases; construir no es servir.
  if (entorno.NEXT_PHASE === "phase-production-build") return null;
  if (entorno.PERMITIR_ORIGEN_LOCAL === "1") return null;

  const api = normalizarOrigen(entorno.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:6003");
  if (api === null || esOrigenLocal(api)) return null; // arranque local del propio repositorio

  const declarado = normalizarOrigen(entorno.NEXT_PUBLIC_SITE_URL);
  if (declarado === null) {
    return (
      "NEXT_PUBLIC_SITE_URL no está definida. Sin ella, el enlace que tus clientas comparten con " +
      "sus invitados se construye con el origen que devuelva el servidor y puede salir como " +
      "http://localhost/i/… (U-6). Declara el origen público del sitio, p. ej. " +
      "NEXT_PUBLIC_SITE_URL=https://invitaciones.mx"
    );
  }
  if (esOrigenLocal(declarado)) {
    return (
      `NEXT_PUBLIC_SITE_URL vale ${declarado}, que solo abre en esta máquina. El enlace que las ` +
      "clientas mandan a sus invitados quedaría inservible (U-6). Declara el origen público real, " +
      "o pon PERMITIR_ORIGEN_LOCAL=1 si de verdad quieres arrancar así."
    );
  }
  return null;
}
