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
// Orden de resolución, de más fiable a menos (CORREGIDO en la fase 3-C por N-02, `ADR-3C-N02-01`):
//   1. `window.location.origin` — el origen por el que la clienta está entrando AHORA MISMO. Es
//      correcto por construcción: si ella llegó por ahí, sus invitados también pueden.
//   2. `NEXT_PUBLIC_SITE_URL` — el origen que el despliegue declara para sí mismo. Queda para el
//      servidor y el SSR, donde no hay `window`.
//   3. el `publicUrl` del servidor — último recurso, y solo para no quedarse sin nada.
//
// POR QUÉ ESE ORDEN Y NO EL CONTRARIO. El bloque 3-8 puso la variable delante y el comentario la
// llamaba «correcta por construcción». No lo es: `NEXT_PUBLIC_SITE_URL` la hornea Next EN EL BUILD,
// así que es una foto del momento de compilar, no del despliegue. Medido en `bitacora/3b-adv.md
// §6.2`: con un artefacto construido para `:3050` y servido en `:3000`, «Copiar enlace», «Ver como
// invitado» y el texto de WhatsApp entregaron `http://127.0.0.1:3050/i/pub_…` mientras la clienta
// navegaba en `:3000` — U-6 reproducida por otra puerta. `window.location.origin` no puede estar
// equivocado: es, literalmente, la puerta por la que la clienta ha entrado. La variable sigue
// mandando donde `window` no existe (SSR, metadatos), que es su sitio.

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

/** El origen público del sitio, o `null` si no hay ninguno deducible ni declarado. */
export function origenPublico(): string | null {
  if (typeof window !== "undefined" && window.location?.origin) {
    const navegado = normalizarOrigen(window.location.origin);
    if (navegado) return navegado;
  }
  return normalizarOrigen(process.env.NEXT_PUBLIC_SITE_URL);
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

// ───────────────────────────────────────────────────────────────────────────────────────────────
// N-02 · el origen HORNEADO frente al origen que se va a SERVIR (`ADR-3C-N02-01`)
// ───────────────────────────────────────────────────────────────────────────────────────────────

/** Puerto efectivo de un origen, con el implícito del esquema cuando no lleva uno explícito. */
function puertoDe(origen: string): string {
  const url = new URL(origen);
  if (url.port) return url.port;
  return url.protocol === "https:" ? "443" : "80";
}

/**
 * ¿Se construyó este artefacto para un origen distinto del que este proceso va a servir?
 *
 * Es la compuerta que faltaba en U-6 y que N-02 destapó (`bitacora/3b-adv.md §6.2`). Las variables
 * `NEXT_PUBLIC_*` se hornean al construir; el puerto y el origen reales se deciden al arrancar. Si
 * discrepan, todo lo que dependa del origen sale mal **en silencio**: la CSP del lienzo rechaza el
 * `<iframe>` y los enlaces que la clienta comparte apuntan a un servidor que no es el suyo. Ninguna
 * compuerta del repositorio lo ve, porque Playwright y LHCI reconstruyen con el mismo origen que
 * después sirven — el desajuste es invisible por diseño del arnés.
 *
 * Devuelve el motivo del fallo, o `null` si no hay nada que objetar.
 *
 * QUÉ SE COMPARA, Y POR QUÉ SÓLO ESO. En el arranque se conoce con certeza el `PORT` que va a
 * escuchar `next start`, pero **no** el origen público cuando hay un proxy inverso delante (ahí el
 * puerto interno y el público no tienen por qué parecerse). Así que:
 *   · Si el despliegue declara `EDITOR_ORIGIN` (variable de servidor), esa es la verdad y se compara
 *     contra ella: cualquier `NEXT_PUBLIC_*` que diga otra cosa es un error de despliegue.
 *   · Si no la declara, sólo se compara el PUERTO, y sólo cuando el origen horneado es **local**
 *     (`127.0.0.1`, `localhost`…). Un origen horneado local afirma «me sirvo en esta máquina», y ahí
 *     el puerto de `PORT` sí es comparable. Es exactamente el caso medido en la fase 3-B.
 *   · Con un origen horneado público y sin `EDITOR_ORIGIN` no se puede afirmar nada, y no se afirma.
 *
 * Puerta de escape: `PERMITIR_ORIGEN_DESALINEADO=1`, para el caso —legítimo— de servir a propósito
 * un artefacto en otro puerto sabiendo lo que se hace. Es la que usa la prueba A/B de este bloque.
 */
export function motivoDeOrigenDesalineado(entorno: NodeJS.ProcessEnv = process.env): string | null {
  if (entorno.NODE_ENV !== "production") return null;
  if (entorno.NEXT_PHASE === "phase-production-build") return null; // construir no es servir
  if (entorno.PERMITIR_ORIGEN_DESALINEADO === "1") return null;

  const horneados: Array<[string, string]> = [];
  for (const nombre of ["NEXT_PUBLIC_EDITOR_ORIGIN", "NEXT_PUBLIC_SITE_URL"] as const) {
    const valor = normalizarOrigen(entorno[nombre]);
    if (valor) horneados.push([nombre, valor]);
  }
  if (horneados.length === 0) return null; // nada horneado: no hay desajuste posible

  const servido = normalizarOrigen(entorno.EDITOR_ORIGIN);
  if (servido) {
    const discrepante = horneados.find(([, valor]) => valor !== servido);
    if (!discrepante) return null;
    const [nombre, valor] = discrepante;
    return (
      `${nombre} se horneó en el build con ${valor}, pero este servidor declara EDITOR_ORIGIN=${servido}. ` +
      "Servir un artefacto compilado para otro origen rompe EN SILENCIO la vista previa del editor " +
      "(la CSP del lienzo nombraría el origen equivocado y el navegador rechazaría el iframe) y " +
      "reparte a los invitados enlaces al origen del build (N-02). Reconstruye con el origen real, " +
      "o pon PERMITIR_ORIGEN_DESALINEADO=1 si de verdad quieres servir así."
    );
  }

  const puerto = entorno.PORT?.trim() || "3000"; // el defecto de `next start`
  for (const [nombre, valor] of horneados) {
    if (!esOrigenLocal(valor)) continue; // origen público sin EDITOR_ORIGIN: nada que comparar
    if (puertoDe(valor) === puerto) continue;
    return (
      `${nombre} se horneó en el build con ${valor}, pero este servidor va a escuchar en el puerto ` +
      `${puerto}. El mismo artefacto servido en otro puerto rechaza el iframe del lienzo y reparte ` +
      "enlaces públicos al puerto del build (N-02, medido). Reconstruye con el puerto real, declara " +
      "EDITOR_ORIGIN, o pon PERMITIR_ORIGEN_DESALINEADO=1 si de verdad quieres servir así."
    );
  }
  return null;
}
