// app/(public)/i/[publicToken]/textos.ts — cadenas es-MX de la RUTA PÚBLICA.
//
// Deliberadamente separadas de `lib/i18n.ts` (que es del chrome del editor y lo está tocando otro
// bloque en paralelo): son textos que ve un INVITADO, no un cliente autenticado, y su tono es otro.
// `not-found.tsx` sí sigue usando `es_MX.publico.noDisponible` porque su literal exacto ya está
// afirmado por `e2e/publico-no-disponible.spec.ts` y `e2e/a11y.spec.ts`, que este bloque no toca.
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
} as const;
