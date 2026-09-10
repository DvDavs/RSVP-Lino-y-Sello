// lib/admin/textos.ts — TODOS los textos de interfaz de `/admin`, es-MX, en un objeto plano
// (mismo estilo que `lib/i18n.ts`: cada valor es una cadena o una función que interpola).
//
// Por qué NO viven en `lib/i18n.ts`: la partición de ese fichero por áreas es trabajo de la
// sesión E2 (`00-INDICE.md`); tocarlo desde aquí, en paralelo, garantiza un conflicto de fusión en
// E6 sobre el mismo fichero que dos sesiones más están editando a la vez. `/admin` tampoco es
// parte del chrome de la clienta que hoy vive en `i18n.ts` (barra, editor, web pública): es la
// consola del equipo, con su propio vocabulario. Cuando E2 termine de partir `lib/i18n.ts` por
// áreas, E6 puede mover este objeto entero a `lib/i18n/admin.ts` sin tocar un solo consumidor: la
// forma del objeto (`textosAdmin.<sección>.<clave>`) ya es la que tendría allí.
//
// Reglas duras de identidad visual que este fichero cumple (`identidad-visual/SKILL.md`):
// NUNCA emojis, en ningún texto ni en comentario de interfaz. Los mensajes de error dicen QUÉ
// HACER (título + cuerpo + una acción), nunca «algo salió mal» a secas. Es-MX natural, cálido y
// breve — nada de calcos del inglés. La prueba `textos.test.ts` es la compuerta: recorre el
// objeto entero y cae si algún texto trae un emoji o está vacío.

export const textosAdmin = {
  pagina: {
    titulo: "Administración",
    cerrarSesion: "Cerrar sesión",
  },

  comun: {
    cargando: "Cargando…",
    reintentar: "Volver a intentarlo",
    buscar: "Buscar",
    abrir: "Abrir",
    sinDato: "—",
    estadoDesconocido: "Sin clasificar",
  },

  pestanas: {
    resumen: "Resumen",
    clientas: "Clientas",
    invitaciones: "Invitaciones",
    pagos: "Pagos",
    plantillas: "Plantillas",
  },

  resumen: {
    titulo: "Resumen",
    tarjetas: {
      clientas: "Clientas",
      invitaciones: "Invitaciones",
      publicadas: "Publicadas",
      pagadas: "Pagadas",
      rsvpUltimos7Dias: "RSVP en 7 días",
    },
    error: {
      titulo: "No pudimos cargar el resumen",
      cuerpo: "Las cifras de arriba no llegaron esta vez. El resto del panel sigue disponible.",
      accion: "Volver a intentarlo",
    },
  },

  clientas: {
    titulo: "Clientas",
    columnas: {
      nombre: "Nombre",
      correo: "Correo",
      rol: "Rol",
      estado: "Estado",
      invitaciones: "Invitaciones",
      altaEn: "Alta",
    },
    filtros: {
      buscar: "Buscar por nombre o correo",
    },
    vacio: {
      sinFiltro: "Todavía no hay clientas registradas.",
      conFiltro: "Ninguna clienta coincide con esa búsqueda.",
    },
    error: {
      titulo: "No pudimos cargar las clientas",
      cuerpo: "Inténtalo de nuevo; si sigue sin cargar, el resto del panel funciona con normalidad.",
      accion: "Volver a intentarlo",
    },
    roles: {
      USER: "Clienta",
      ADMIN: "Administrador",
      MASTER: "Dueño",
    },
    habilitada: "Habilitada",
    deshabilitada: "Deshabilitada",
  },

  invitaciones: {
    titulo: "Invitaciones",
    columnas: {
      evento: "Invitación",
      clienta: "Clienta",
      plan: "Plan",
      pago: "Pago",
      estado: "Estado",
      enlace: "Enlace",
      acciones: "Acciones",
    },
    filtros: {
      buscar: "Buscar por evento o clienta",
      estado: "Estado",
      estadoTodos: "Todos los estados",
      plan: "Plan",
      planTodos: "Todos los planes",
      pago: "Pago",
      pagoTodos: "Cualquier pago",
    },
    estados: {
      publicada: "Publicada",
      enEdicion: "En edición",
      deshabilitada: "Deshabilitada",
    },
    pago: {
      pagada: "Pagado",
      pendiente: "Pendiente",
    },
    acciones: {
      abrir: "Abrir",
      deshabilitar: "Deshabilitar",
      habilitar: "Habilitar",
      deshabilitarDeshabilitadoMovil: "Se activa en pantalla ancha",
    },
    vacio: {
      sinFiltro: "Todavía no hay invitaciones.",
      conFiltro: "Ninguna invitación coincide con esos filtros.",
    },
    error: {
      titulo: "No pudimos cargar las invitaciones",
      cuerpo: "Inténtalo de nuevo; si sigue sin cargar, el resto del panel funciona con normalidad.",
      accion: "Volver a intentarlo",
    },
    alternarError: {
      titulo: "No pudimos cambiar el estado de esta invitación",
      cuerpo: "El cambio no se guardó. Revisa tu conexión e inténtalo de nuevo.",
      accion: "Volver a intentarlo",
    },
  },

  pagos: {
    titulo: "Pagos",
    columnas: {
      clienta: "Clienta",
      invitacion: "Invitación",
      plan: "Plan",
      importe: "Importe",
      estado: "Estado",
      fecha: "Fecha",
    },
    filtros: {
      estado: "Estado",
      estadoTodos: "Todos los estados",
    },
    estados: {
      pagado: "Pagado",
      pendiente: "Pendiente",
      devuelto: "Devuelto",
    },
    vacio: {
      sinFiltro: "Todavía no hay pagos registrados.",
      conFiltro: "Ningún pago coincide con ese filtro.",
    },
    error: {
      titulo: "No pudimos cargar los pagos",
      cuerpo: "Inténtalo de nuevo; si sigue sin cargar, el resto del panel funciona con normalidad.",
      accion: "Volver a intentarlo",
    },
  },

  planes: {
    titulo: "Planes",
    columnas: {
      nombre: "Plan",
      invitaciones: "Invitaciones que lo usan",
    },
    vacio: "Todavía no hay planes registrados.",
    error: {
      titulo: "No pudimos cargar los planes",
      cuerpo: "Inténtalo de nuevo; si sigue sin cargar, el resto del panel funciona con normalidad.",
      accion: "Volver a intentarlo",
    },
  },

  plantillas: {
    titulo: "Plantillas registradas",
    subtitulo: "Solo lectura: el alta de una plantilla es con el kit de autor.",
    columnas: {
      slug: "Plantilla",
      version: "Versión",
      estado: "Estado",
      tiposDeEvento: "Tipos de evento",
      registradaEn: "Registrada",
      invitaciones: "Invitaciones que la usan",
    },
    estados: {
      published: "Publicada",
      deprecated: "Obsoleta",
    },
    vacio: "Todavía no hay plantillas registradas.",
    error: {
      titulo: "No pudimos cargar las plantillas",
      cuerpo: "Inténtalo de nuevo; si sigue sin cargar, el resto del panel funciona con normalidad.",
      accion: "Volver a intentarlo",
    },
  },

  sesion: {
    error: {
      titulo: "Tu sesión no es válida o expiró",
      cuerpo: "Inicia sesión de nuevo para seguir usando la administración.",
      accion: "Iniciar sesión",
    },
    sinPermiso: {
      titulo: "Tu cuenta no tiene acceso a la administración",
      cuerpo: "Esta consola es solo para el equipo. Si crees que es un error, escribe a soporte.",
    },
  },
} as const;

export type TextosAdmin = typeof textosAdmin;
