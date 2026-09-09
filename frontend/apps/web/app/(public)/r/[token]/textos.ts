// app/(public)/r/[token]/textos.ts — cadenas es-MX del ENLACE PERSONAL DEL INVITADO.
//
// Mismo patrón y mismo motivo que `app/(public)/i/[publicToken]/textos.ts`: `lib/i18n.ts` es UN
// SOLO objeto `as const` del chrome autenticado, y una sola clave suya arrastra el árbol entero
// (`editor.*`, `asistente.*`, `panel.*`) al JS de esta ruta — la que MÁS gente abre, casi siempre en
// móvil desde un enlace de WhatsApp, y la última en la que se puede pagar ese peso.
//
// TONO: quien lee esto es una invitada, no una clienta. Se le habla de tú, corto y cálido, y nunca
// se le explica la maquinaria del producto (ni "token", ni "backend", ni "cupo asignado").
export const textosInvitado = {
  /** `<title>` — genérico A PROPÓSITO: no puede delatar de quién es la invitación (regla 3, el
   *  título es lo que previsualiza WhatsApp). */
  titulo: "Tu invitación",

  paraTi: "PARA TI",

  /** `(adultos, ninos, jovenes) => "Te apartamos …"` — el wireframe (§B3.1) siempre dice adultos, y
   *  añade niños/jóvenes solo si el invitado tiene alguno asignado. */
  cupos(adultos: number, ninos: number, jovenes: number): string {
    const partes: string[] = [`${adultos} ${adultos === 1 ? "lugar" : "lugares"} de adulto`];
    if (ninos > 0) partes.push(`${ninos} de niño`);
    if (jovenes > 0) partes.push(`${jovenes} de joven`);
    if (partes.length === 1) return `Te apartamos ${partes[0]}.`;
    const ultima = partes.pop() as string;
    return `Te apartamos ${partes.join(", ")} y ${ultima}.`;
  },

  decision: {
    encabezado: "¿Nos acompañas?",
    siAsisto: "Sí, ahí estaré",
    noPuedo: "No podré ir",
    cuantosVamos: "Cuántos vamos",
    adultos: "Adultos",
    ninos: "Niños",
    jovenes: "Jóvenes",
    de: (cupo: number) => `de ${cupo}`,
    restar: "Uno menos",
    sumar: "Uno más",
    confirmar: "Confirmar mi asistencia",
    declinar: "Avisar que no podré ir",
    cancelar: "Cancelar y volver a mi respuesta",
    ayuda: "Puedes volver a este enlace y cambiar tu respuesta cuando quieras.",
    /** Botón deshabilitado: los tres cupos en cero con "Sí" elegido (422 GUEST_INVALID evitado en el borde). */
    sinLugares: "Elige al menos un lugar antes de confirmar.",
  },

  confirmado: {
    encabezado: "Quedaste confirmada",
    /** `(adultos, ninos, jovenes) => "Apartamos …"`, mismo formato que `cupos`. */
    detalle(adultos: number, ninos: number, jovenes: number): string {
      const partes: string[] = [];
      if (adultos > 0) partes.push(`${adultos} ${adultos === 1 ? "adulto" : "adultos"}`);
      if (ninos > 0) partes.push(`${ninos} ${ninos === 1 ? "niño" : "niños"}`);
      if (jovenes > 0) partes.push(`${jovenes} ${jovenes === 1 ? "joven" : "jóvenes"}`);
      const lista = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}` : (partes[0] ?? "tu lugar");
      return `Apartamos ${lista} a tu nombre.`;
    },
    correo: "Te mandamos el detalle a tu correo.",
    cambiar: "Cambiar mi respuesta",
  },

  declinado: {
    encabezado: "Avisamos que no podrás ir",
    detalle: "Gracias por contarnos. Si algo cambia, puedes volver a este enlace.",
    cambiar: "Cambiar mi respuesta",
  },

  cerrado: {
    titulo: "Esta convocatoria ya cerró",
    cuerpo: "La fecha para confirmar ya pasó. Si tienes dudas, escríbele directamente a quien te invitó.",
  },

  /** `404 RSVP_LINK_NOT_FOUND` — UN SOLO estado para los seis casos que el backend no distingue
   *  (contrato §0.5): inexistente, caducado, rotado, invitación despublicada o anfitrión
   *  deshabilitado. Nunca se ofrece "buscar tu invitación": sería el oráculo que esto evita. */
  noResuelve: {
    titulo: "Este enlace ya no funciona",
    cuerpo: "Pídele a quien te invitó que te mande el suyo otra vez.",
  },

  /** `429 RSVP_TOO_MANY_ATTEMPTS` — pide esperar, SIN decir si el enlace era válido (regla 6). */
  limite: {
    titulo: "Muchos intentos seguidos",
    cuerpo: "Espera unos minutos y vuelve a intentarlo.",
  },

  /** Cualquier otro fallo (red caída, 500, respuesta irreconocible). */
  error: {
    titulo: "No pudimos abrir esta invitación",
    cuerpo: "Ocurrió un problema al cargar el contenido. Inténtalo de nuevo en un momento.",
  },

  reintentar: "Reintentar",
  cargando: "Cargando tu invitación…",
  cargandoInvitacion: "Cargando la invitación…",

  /** Barra fija al pie (móvil, mientras no haya respuesta). */
  barraFija: {
    etiqueta: "Tu respuesta",
  },

  /** Enlace portado al gancho DOM que `RsvpSection` deja dentro de la invitación (contrato §3): un
   *  invitado que llega a esa sección leyendo la invitación completa puede responder ahí mismo, sin
   *  tener que volver arriba a buscar la tarjeta. */
  irAResponder: "Confirmar mi asistencia",
} as const;
