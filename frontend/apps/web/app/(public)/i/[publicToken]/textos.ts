// app/(public)/i/[publicToken]/textos.ts — cadenas es-MX de la RUTA PÚBLICA.
//
// Deliberadamente separadas de `lib/i18n.ts` (que es del chrome del editor y lo está tocando otro
// bloque en paralelo): son textos que ve un INVITADO, no un cliente autenticado, y su tono es otro.
//
// 3C-8: `noDisponible`, `error` y `reintentar` VIVÍAN en `es_MX.publico.*` / `es_MX.comun.reintentar`
// (`lib/i18n.ts`). Como `es_MX` es UN SOLO objeto exportado, importar cualquier clave suya obliga al
// bundler a incluir el árbol ENTERO — medido: `error.tsx`/`not-found.tsx` metían el `editor.*` y el
// `asistente.*` de OTRAS tareas del bloque 3 (que no usan) en el JS de la ruta pública, y eso solo
// sacó `/i/[publicToken]` de presupuesto (163,1 de 150 KB gz, `check-budget.mjs`). Se mueven aquí,
// con el MISMO literal exacto (nada de texto cambia): `error.tsx` y `not-found.tsx` ya no importan
// `lib/i18n.ts` en absoluto. El literal de `noDisponible.titulo` NO se cambia: `e2e/publico-no-
// disponible.spec.ts:10` y `e2e/a11y.spec.ts:9` lo afirman y son de otro bloque (prohibido tocarlos).
export const textosPublicos = {
  /** `<title>` cuando el documento no trae `coverTitle` (o cuando no hay documento que leer). */
  tituloGenerico: "Invitación",

  /** `403 TPL_INVITATION_UNAVAILABLE`: la invitación EXISTE; quien no está disponible es el anfitrión.
   *  El texto no dice por qué (cuenta deshabilitada, bloqueada…): eso es información de negocio y el
   *  invitado no tiene por qué recibirla (P8). */
  noDisponibleAhora: {
    titulo: "Esta invitación no está disponible por ahora",
    cuerpo: "El anfitrión la tiene pausada. Si crees que es un error, escríbele directamente.",
  },

  /** `404 TPL_RELEASE_NOT_FOUND` — un solo estado para token inexistente, rotado, sin release,
   *  despublicado y `uses_templates2=false` (antes `es_MX.publico.noDisponible`). */
  noDisponible: {
    titulo: "Esta invitación ya no está disponible",
    cuerpo: "El enlace pudo haber expirado, cambiado o el anfitrión retiró la invitación.",
  },

  /** `error.tsx` — cualquier fallo que no sea el 404/403 (antes `es_MX.publico.error`). */
  error: {
    titulo: "No pudimos abrir esta invitación",
    cuerpo: "Ocurrió un problema al cargar el contenido. Inténtalo de nuevo en un momento.",
  },

  /** Antes `es_MX.comun.reintentar`: mismo texto, sin tirar del chrome entero para una palabra. */
  reintentar: "Reintentar",
} as const;
