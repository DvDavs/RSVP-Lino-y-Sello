// lib/invitados/textos.ts — cadenas es-MX de la pantalla de invitados (`/editor/[invitationId]/
// invitados`). Vive aquí y no en `lib/i18n.ts`: el volumen y la especificidad (micro-copy del pegado
// de lista con línea/sugerencia por renglón, encabezados de tabla, textos de conteo) es propio de
// esta pantalla y no del vocabulario compartido del chrome (`ui-pantalla` §4: «si no encaja, un
// `textos.ts` propio de tu carpeta»). Las cadenas verdaderamente genéricas (`Cargando…`,
// `Reintentar`, `Cancelar`) se toman de `es_MX.comun`, no se repiten aquí.
export const textosInvitados = {
  titulo: "Invitados",
  subtitulo: "Reparte los pases y manda a cada quien su enlace.",

  contadores: {
    confirmados: "Confirmados",
    pendientes: "Pendientes",
    noAsisten: "No asisten",
    lugares: "Lugares",
    lugaresDe: (usados: number, total: number) => `${usados} de ${total}`,
  },

  filtros: {
    buscarEtiqueta: "Buscar por nombre",
    buscarPlaceholder: "Nombre del invitado",
    estadoEtiqueta: "Filtrar por estado",
    estadoTodos: "Todos",
    estadoConfirmados: "Confirmados",
    estadoPendientes: "Pendientes",
    estadoNoAsisten: "No asisten",
  },

  acciones: {
    agregarInvitado: "Agregar invitado",
    pegarLista: "Pegar una lista",
    exportar: "Exportar",
    exportando: "Exportando…",
    compartir: "Compartir",
    editar: "Editar",
    verMas: "Ver más invitados",
  },

  estado: {
    confirmada: "Confirmada",
    pendiente: "Pendiente",
    noAsiste: "No asiste",
  },

  tabla: {
    /** Nombre accesible de la tabla (`<caption class="sr-only">`): sin él solo se anuncia «tabla». */
    leyenda: "Tus invitados, con sus pases, su estado y cómo mandarles su enlace",
    /** Etiqueta del disparador de edición: dice QUÉ hace, no solo a quién. */
    editarA: (nombre: string) => `Editar a ${nombre}`,
    columnaNombre: "Nombre",
    columnaPases: "Pases",
    columnaEstado: "Estado",
    columnaEnlace: "Enlace",
    columnaCompartir: "Compartir",
    /** «2A 1N 0J»: adultos, niños, jóvenes invitados. */
    pases: (adultos: number, ninos: number, jovenes: number) => `${adultos}A ${ninos}N ${jovenes}J`,
    usaPases: (adultos: number, ninos: number, jovenes: number) => `usa ${adultos}A ${ninos}N ${jovenes}J`,
    actualizadoHace: (relativo: string) => `hace ${relativo}`,
    sinNombre: "Invitado sin nombre",
  },

  relativo: {
    ahoraMismo: "un momento",
    minutos: (n: number) => `${n} ${n === 1 ? "minuto" : "minutos"}`,
    horas: (n: number) => `${n} ${n === 1 ? "hora" : "horas"}`,
    dias: (n: number) => `${n} ${n === 1 ? "día" : "días"}`,
  },

  vacio: {
    titulo: "Todavía no tienes invitados",
    texto: "Agrégalos de uno en uno o pega tu lista de WhatsApp.",
  },

  error: {
    titulo: "No pudimos cargar tus invitados",
    texto: "Revisa tu conexión e inténtalo otra vez.",
  },

  cargando: "Cargando invitados",

  compartir: {
    tituloDialogo: (nombre: string) => `Compartir con ${nombre}`,
    descripcionDialogo: "Elige cómo mandarle su enlace.",
    copiarEnlace: "Copiar enlace",
    enlaceCopiado: "Enlace copiado",
    verEnlace: "Ver el enlace",
    botonWhatsapp: "WhatsApp",
    botonCorreo: "Correo",
    // Nombres accesibles de los cuatro botones de acción, que se repiten en CADA fila y en CADA
    // tarjeta: sin el nombre del invitado, un lector de pantalla recita «Copiar enlace, botón»
    // veinticinco veces sin decir de quién es el enlace que se va a copiar o mandar. Cada uno empieza
    // por el texto visible del botón (WCAG 2.5.3, «etiqueta en el nombre»).
    copiarEnlaceDe: (nombre: string) => `Copiar enlace de ${nombre}`,
    verEnlaceDe: (nombre: string) => `Ver el enlace de ${nombre}`,
    whatsappA: (nombre: string) => `WhatsApp a ${nombre}`,
    correoA: (nombre: string) => `Correo a ${nombre}`,
    correoEnviado: (nombre: string) => `Le mandamos su enlace a ${nombre} por correo.`,
    sinCorreo: "Este invitado no tiene correo registrado.",
    sinTelefono: "Este invitado no tiene teléfono registrado.",
    errorEnlace: "No pudimos traer el enlace. Inténtalo de nuevo.",
  },

  // Compartir LA INVITACIÓN, no el enlace de nadie en particular: para un grupo de WhatsApp o para
  // pegar en redes. Vive aparte de `compartir` (arriba), que es siempre por invitado.
  compartirGeneral: {
    titulo: "Comparte tu invitación",
    descripcion: "Este es el enlace general, para un grupo o tus redes. No es el enlace personal de nadie.",
    cargando: "Comprobando si tu invitación está publicada",
    errorEstado: "No pudimos comprobar si tu invitación ya está publicada.",
    enlaceEtiqueta: "Tu enlace",
    copiarEnlace: "Copiar enlace",
    enlaceCopiado: "Enlace copiado",
    errorCopiar: "No pudimos copiar. Inténtalo de nuevo.",
    botonWhatsapp: "Compartir por WhatsApp",
    mensajeRedesEtiqueta: "Mensaje para redes",
    copiarMensaje: "Copiar mensaje",
    mensajeCopiado: "Mensaje copiado",
    mensaje: (enlace: string) =>
      `Te compartimos el enlace de nuestra invitación. Ahí puedes ver todos los detalles y confirmarnos si nos acompañas: ${enlace}`,
    noPublicada: {
      texto: "Publica tu invitación para conseguir el enlace que se abre para todos tus invitados.",
      ir: "Ir a publicar",
    },
  },

  formulario: {
    tituloAlta: "Agregar invitado",
    descripcionAlta: "Escribe sus datos. Solo el nombre es obligatorio.",
    tituloEdicion: "Editar invitado",
    descripcionEdicion: "Cambia los datos que necesites.",
    nombre: "Nombre completo",
    faltaNombre: "Escribe el nombre del invitado.",
    correo: "Correo electrónico",
    correoInvalido: "Ese correo no tiene un formato válido. Revisa que lleve una @ y un dominio.",
    telefono: "Teléfono",
    mesa: "Número de mesa",
    adultos: "Adultos",
    ninos: "Niños",
    jovenes: "Jóvenes",
    numeroInvalido: "Escribe un número de 0 en adelante.",
    guardar: "Guardar invitado",
    guardando: "Guardando…",
    guardarCambios: "Guardar cambios",
    eliminarInvitado: "Eliminar invitado",
    confirmarBorradoTitulo: (nombre: string) => `¿Eliminar a ${nombre}?`,
    confirmarBorradoTexto:
      "Se pierde su enlace de confirmación y su respuesta. Esta acción no se puede deshacer.",
    eliminando: "Eliminando…",
    invitadoCreado: "Invitado agregado",
    invitadoActualizado: "Cambios guardados",
    invitadoEliminado: "Invitado eliminado",
  },

  pegarLista: {
    tituloBoton: "Pegar una lista",
    titulo: "Pega tu lista",
    descripcion: "Un invitado por renglón: nombre, adultos, niños, jóvenes, teléfono, correo.",
    placeholder: "María Fernanda Cruz, 2, 1, 0, 9511234567",
    revisar: "Revisar lista",
    revisando: "Revisando…",
    vistaPrevia: (listos: number, problemas: number) =>
      problemas === 0
        ? `Vista previa: ${listos} ${listos === 1 ? "invitado listo" : "invitados listos"}`
        : `Vista previa: ${listos} ${listos === 1 ? "invitado listo" : "invitados listos"}, ${problemas} ${problemas === 1 ? "con problema" : "con problemas"}`,
    renglon: (n: number) => `Renglón ${n}:`,
    agregarListos: (n: number) => (n === 1 ? "Agregar el 1 que está bien" : `Agregar los ${n} que están bien`),
    agregando: "Agregando…",
    volver: "Volver a la lista",
    listaVacia: "Pega al menos un renglón antes de revisar.",
    importados: (n: number) => (n === 1 ? "Se agregó 1 invitado." : `Se agregaron ${n} invitados.`),
  },

  reintentar: "Reintentar",
} as const;
