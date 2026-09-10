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
    // Añadido por E5-D (ensamblado de pantalla, `5-E5-D.md`): frontera de error de la propia ruta
    // (`error.tsx`, `ui-pantalla §7`). No existía un texto genérico de página completa: los siete
    // bloques ya tienen el suyo, pero un fallo de RENDER (no de red) tumba la pantalla entera y
    // necesita su propio título/cuerpo/acción, nunca "algo salió mal" a secas.
    errorInesperado: {
      titulo: "Algo salió mal en la administración",
      cuerpo: "No pudimos mostrar esta pantalla. Vuelve a intentarlo; si sigue fallando, escribe a soporte.",
      accion: "Volver a intentarlo",
    },
  },

  comun: {
    cargando: "Cargando…",
    reintentar: "Volver a intentarlo",
    buscar: "Buscar",
    abrir: "Abrir",
    sinDato: "—",
    estadoDesconocido: "Sin clasificar",
    // El fallo más común de una consola — el wifi — no tenía copia propia (5-E5-R1 MEDIA-2);
    // mismo tono que `lib/i18n.ts:28` (`errores.sinRed`), con título + cuerpo + acción como el
    // resto de los bloques de error de este fichero.
    sinRed: {
      titulo: "No hay conexión",
      cuerpo: "Parece que se cayó tu internet. Vuelve a intentarlo cuando regrese la señal.",
      accion: "Volver a intentarlo",
    },
    // Añadido por E5-D: falta un «Cancelar» genérico para el diálogo de confirmación de
    // `AccionDeFila` (deshabilitar/habilitar una invitación) — ningún bloque existente lo traía.
    cancelar: "Cancelar",
    // Añadido por E5-D (arreglo de seguimiento, hallazgo MEDIA-1): acción de cierre de un aviso que
    // no se reintenta (un 403 de jerarquía no se arregla reintentando la misma acción).
    entendido: "Entendido",
    // Añadido por E5-D: título genérico de un estado vacío de tabla. Cada tabla sigue enseñando su
    // propio cuerpo (`<tabla>.vacio.sinFiltro`/`conFiltro`); esto es solo el encabezado corto que
    // pide `EmptyState.titulo` y que ningún bloque definía por separado.
    sinResultados: "Nada que mostrar",
    // Añadido por E5-D: paginación de las tres tablas con `PaginaX` (clientas, invitaciones,
    // pagos) — no existía ningún texto de paginador en el encargo de `lib/admin`.
    paginador: {
      etiqueta: "Paginación",
      anterior: "Anterior",
      siguiente: "Siguiente",
      paginaDe: (pagina: number, total: number) => `Página ${pagina} de ${total}`,
    },
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
    // Añadido por E5-D: el diálogo de confirmación de `AccionDeFila` (`_componentes/AccionDeFila.tsx`)
    // pide un título y una descripción propios, distintos del texto del botón (`acciones.deshabilitar`/
    // `.habilitar`) — ninguno de los dos existía todavía.
    confirmacionDeshabilitar: {
      titulo: "¿Deshabilitar esta invitación?",
      descripcion: "Dejará de verse en internet hasta que la vuelvas a habilitar. La clienta no pierde su contenido.",
      confirmando: "Deshabilitando…",
    },
    confirmacionHabilitar: {
      titulo: "¿Habilitar esta invitación?",
      descripcion: "Vuelve a verse en internet con el enlace que ya tenía.",
      confirmando: "Habilitando…",
    },
    // Añadido por E5-D (arreglo de seguimiento, hallazgo MEDIA-1 de la revisión de autorización):
    // un 403 de `alternarEstadoInvitacion` por jerarquía («esta invitación no es de tu clienta») NO
    // es un fallo de red ni una sesión caducada — es distinto de `alternarError` a propósito, para
    // no decirle a quien administra «revisa tu conexión» cuando el problema es de permisos.
    alternarProhibido: {
      titulo: "Esta invitación no es tuya",
      cuerpo: "No puedes deshabilitarla ni habilitarla: pertenece a una clienta fuera de tu jerarquía.",
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
    // Añadido por E5-D: nota informativa de origen del dato (contrato §5, `origen: "invitaciones"`
    // mientras E4 no entregue su propia fuente de pagos). Reutiliza vocabulario ya presente en el
    // fichero (invitaciones, pagos) — no introduce un término nuevo.
    fuenteDatos: "Estos importes salen de tus invitaciones; cuando el módulo de pagos esté listo, la tabla no cambia de forma.",
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
      // Añadido por E5-D: el estado honesto de un 403 necesita una salida (regla del encargo:
      // "ofrece una salida, no cinco tablas rotas"). No había ninguna acción asociada a este texto.
      accion: "Ir a mis invitaciones",
    },
  },
} as const;

export type TextosAdmin = typeof textosAdmin;
