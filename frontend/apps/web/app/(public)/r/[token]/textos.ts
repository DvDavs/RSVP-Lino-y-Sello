// app/(public)/r/[token]/textos.ts — cadenas es-MX del ENLACE PERSONAL DEL INVITADO.
//
// POR QUÉ NO LEE `lib/i18n.ts`. `es_MX` es UN SOLO objeto `as const`: importar una sola clave suya
// obliga al bundler a incluir el árbol ENTERO del chrome (`editor.*`, `asistente.*`, `panel.*`) en
// el JS de esta ruta. Medido en 3C-8 sobre la ruta hermana: sacó `/i/[publicToken]` de presupuesto
// (163,1 de 150 KB gz). `/r/[token]` es la ruta que MÁS gente abre, casi siempre en móvil y desde un
// enlace de WhatsApp: es la última en la que se puede pagar ese peso. Mismo patrón y mismo motivo
// que `app/(public)/i/[publicToken]/textos.ts`.
//
// TONO: quien lee esto es una invitada, no una clienta. Se le habla de tú, corto y cálido, y nunca
// se le explica la maquinaria del producto.
export const textosInvitado = {
  /** `<title>`. Genérico a propósito: el título no puede delatar de quién es la invitación. */
  titulo: "Tu invitación",

  marcador: {
    encabezado: "Aquí vas a confirmar tu asistencia",
    cuerpo:
      "Estamos terminando esta página. En cuanto esté lista, quien te invitó te va a compartir el enlace para que confirmes si puedes acompañarle.",
  },
} as const;
