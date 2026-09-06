// lib/i18n.ts — cadenas es-MX del chrome, sin biblioteca (04 §2). Objeto tipado plano: cada clave es
// una ruta con puntos, cada valor una cadena o una función que interpola parámetros.
export const es_MX = {
  comun: {
    cargando: "Cargando…",
    reintentar: "Reintentar",
    volver: "Volver",
    ayuda: "Ayuda",
    miCuenta: "Mi cuenta",
    guardado: "Guardado",
    guardando: "Guardando…",
    sinConexion: "Sin conexión",
    iniciarSesion: "Iniciar sesión",
    cerrarSesion: "Cerrar sesión",
    misInvitaciones: "Mis invitaciones",
    cancelar: "Cancelar",
    marca: "Invitaciones",
    entrar: "Entrar",
    crearCuenta: "Crear cuenta",
    irAlInicio: "Ir a la portada",
    ejemplo: "Ejemplo",
  },
  errores: {
    generico: "Algo salió mal. Inténtalo de nuevo.",
    sesionInvalida: "Tu sesión no es válida o expiró. Inicia sesión de nuevo.",
    // U-9 (bitácora 3-UX §1.12): «Failed to fetch» en inglés, al lado del impecable aviso de
    // «Sin conexión». Mismo tono, mismo idioma.
    sinRed: "No hay conexión. Vuelve a intentarlo cuando regrese el internet.",
    rolInsuficiente: "Tu cuenta no tiene permiso para hacer esto.",
    noEncontrado: "No encontramos lo que buscabas.",
    conflictoRevision: "Alguien más guardó cambios antes que tú. Recarga para verlos.",
    cuerpoDemasiadoGrande: "Ese cambio es demasiado grande para enviarlo de una vez.",
    codigo: (codigo: string) => `Código: ${codigo}`,
    /** 404 y error de la web pública (11 §7, fila «Estados»): título, frase y UNA salida. */
    noExiste: {
      titulo: "Esta página no existe",
      cuerpo: "El enlace que abriste no existe o cambió de dirección. Desde la portada llegas a todo lo demás.",
    },
    algoSalioMal: {
      titulo: "Algo salió mal",
      cuerpo: "No pudimos cargar esta página. Vuelve a intentarlo; si sigue pasando, mándanos el código de abajo.",
      reintentar: "Volver a intentarlo",
    },
  },
  /**
   * Pantalla de acceso (U-1). `04 §7.1` paso 1 contrataba «401 → redirección a login» y la
   * aplicación no tenía ninguna: el aviso «Inicia sesión de nuevo» era un callejón sin salida.
   */
  acceso: {
    titulo: "Entra a tu cuenta",
    intro: "Usa el mismo correo y la misma contraseña con los que contrataste tu invitación.",
    correo: "Correo electrónico",
    contrasena: "Contraseña",
    entrar: "Iniciar sesión",
    entrando: "Entrando…",
    faltaCorreo: "Escribe tu correo electrónico.",
    faltaContrasena: "Escribe tu contraseña.",
    credencialesInvalidas: "El correo o la contraseña no coinciden. Revísalos e inténtalo otra vez.",
    // El aviso NO acusa a nadie de haber expirado una sesión que nunca existió (U-1).
    hayQueEntrar: "Para ver y editar tu invitación necesitas entrar a tu cuenta.",
    sesionTerminada: "Tu sesión terminó. Vuelve a entrar para seguir donde lo dejaste.",

    // ── Fase 3-C · las dos pestañas de `/acceso` (11 §7, fila «Acceso y registro») ───────────
    pestanas: "Entrar o crear cuenta",
    pestanaEntrar: "Entrar",
    pestanaCrearCuenta: "Crear cuenta",

    // Recuperación de contraseña. La respuesta es SIEMPRE la misma exista o no la cuenta
    // (`ADR-3C-N01-01`: enumerar correos es la mitad del ataque).
    olvide: "¿Olvidaste tu contraseña?",
    recuperar: {
      titulo: "Recupera tu contraseña",
      intro: "Escribe tu correo y te mandamos un enlace para cambiarla.",
      enviar: "Enviar el enlace",
      enviando: "Enviando…",
      // Literal de N-01: no confirma ni desmiente que el correo exista.
      enviado: "Si el correo corresponde a una cuenta, te enviamos un enlace para cambiar la contraseña.",
      volver: "Volver a entrar",
    },

    // Registro en tres pasos (11 §7: «paso 2 Elige una contraseña · paso 3 ¿Cómo te llamamos?»).
    registro: {
      titulo: "Crea tu cuenta",
      intro: "Tres datos y ya. Después eliges el tipo de evento.",
      pasoCorreo: "Tu correo",
      pasoContrasena: "Elige una contraseña",
      pasoNombre: "¿Cómo te llamamos?",
      ayudaCorreo: "Aquí te mandamos el enlace de tu invitación.",
      ayudaContrasena: "Al menos 8 caracteres, con una mayúscula, una minúscula y un símbolo.",
      nombre: "Nombre",
      apellidos: "Apellidos",
      continuar: "Continuar",
      atras: "Atrás",
      crear: "Crear mi cuenta",
      creando: "Creando tu cuenta…",
      listo: "Listo. Elige el tipo de evento.",
      faltaNombre: "Escribe tu nombre.",
      faltaApellidos: "Escribe tus apellidos.",
      contrasenaCorta: "Tu contraseña necesita al menos 8 caracteres, una mayúscula, una minúscula y un símbolo.",
      correoInvalido: "Ese correo no parece válido. Revísalo.",
      correoOcupado: "Ya hay una cuenta con ese correo. Entra con tu contraseña o recupérala.",
    },
  },

  /**
   * Web pública (`/`). Textos de `11 §7`, fila «Web pública»: segunda persona, verbos concretos,
   * sin jerga y sin una sola promesa que el producto no cumpla hoy.
   */
  sitio: {
    saltarAlContenido: "Saltar al contenido",
    navegacion: "Navegación principal",
    navegacionPie: "Enlaces del pie",
    comoFunciona: "Cómo funciona",
    paraCadaCelebracion: "Para cada celebración",
    planes: "Planes",
    hero: {
      eyebrow: "Invitaciones digitales con RSVP",
      titulo: "Tu invitación, lista en una tarde.",
      cuerpo:
        "Eliges un diseño, escribes tus datos y compartes el enlace por WhatsApp. Tus invitados confirman desde su teléfono y tú ves quién viene.",
      empezar: "Empezar mi invitación",
      verComoFunciona: "Ver cómo funciona",
      fotoPendiente: "Pareja celebrando en un jardín al atardecer",
    },
    pasos: {
      titulo: "Tres pasos y a repartir.",
      intro: "No hay que instalar nada ni saber de diseño.",
      uno: {
        titulo: "Elige el diseño",
        cuerpo: "Dinos qué celebras y te mostramos solo las plantillas que le van. Puedes cambiar de idea después.",
      },
      dos: {
        titulo: "Escribe tus datos",
        cuerpo: "Nombres, fecha, lugar y tus fotos. Se guarda solo mientras escribes, sin botón de guardar.",
      },
      tres: {
        titulo: "Comparte el enlace",
        cuerpo: "Publicas y mandas el enlace por WhatsApp. Cada invitado confirma desde su teléfono.",
      },
    },
    tipos: {
      titulo: "Para cada celebración",
      intro: "Elige el tipo y te llevamos al asistente con las plantillas que le van.",
      boda: "Boda",
      xv: "XV años",
      bautizo: "Bautizo",
      comunion: "Primera comunión",
      cumpleanos: "Cumpleaños",
      graduacion: "Graduación",
      corporativo: "Corporativo",
      empezarCon: (tipo: string) => `Empezar una invitación de ${tipo}`,
    },
    testimonios: {
      titulo: "Lo que cuentan quienes ya la mandaron",
      // Nada de testimonios inventados haciéndose pasar por reales: van marcados como ejemplo.
      aviso: "Textos de muestra mientras reunimos testimonios reales de clientas.",
      uno: {
        cita: "Mandé el enlace por WhatsApp un martes y para el viernes ya tenía confirmadas a treinta personas.",
        autora: "Ana Torres",
        evento: "Boda en Guanajuato",
      },
      dos: {
        cita: "Cambié la hora de la misa desde el teléfono, en la fila del súper, y quedó al momento.",
        autora: "María Fernanda Cruz",
        evento: "XV años en Puebla",
      },
      tres: {
        cita: "Mis tíos entraron sin instalar nada. Eso era lo que más me preocupaba.",
        autora: "Rocío Delgado",
        evento: "Bautizo en Mérida",
      },
    },
    planesSeccion: {
      titulo: "Elige tu plan",
      cuerpo:
        "Tu invitación nace cuando contratas un plan: ahí se define cuántas plantillas y cuántos invitados incluye. Entra a tu cuenta para ver el tuyo o pedir un cambio.",
      accion: "Entrar a mi cuenta",
      nota: "Los precios se acuerdan con quien te atendió; todavía no se publican aquí.",
    },
    ctaFinal: {
      titulo: "¿Empezamos?",
      cuerpo: "Tu invitación puede estar lista esta misma tarde.",
      accion: "Empezar mi invitación",
    },
    pie: {
      lema: "Invitaciones digitales con RSVP, hechas en México.",
      derechos: (anio: number) => `${anio} Invitaciones`,
    },
  },
  ayuda: {
    titulo: "¿En qué te ayudamos?",
    intro: "Las dudas que más nos llegan mientras preparas tu invitación.",
    volverAlEditor: "Volver a mis invitaciones",
    buscar: "Busca tu duda",
    buscarAyuda: "Escribe una palabra: fecha, publicar, enlace, plan…",
    resultados: (n: number) => `${n} ${n === 1 ? "duda" : "dudas"}`,
    sinResultados: {
      titulo: "Ninguna duda coincide",
      texto: "Prueba con otra palabra o escríbenos y te contestamos nosotros.",
      accion: "Ver todas las dudas",
    },
    contacto: {
      titulo: "¿No está tu duda aquí?",
      texto: "Escríbenos por el mismo medio por el que contrataste tu invitación y te contestamos.",
    },
  },
  editor: {
    catalogo: {
      titulo: "Elige una plantilla",
      filtroTodas: "Todas",
      filtroIncluidasEnPlan: "Incluidas en mi plan",
      resultados: (n: number) => `${n} ${n === 1 ? "resultado" : "resultados"}`,
      vacio: "No hay plantillas disponibles todavía.",
      elegir: "Elegir esta plantilla",
      eligiendo: "Preparando tu invitación…",
      paraCual: "¿En cuál invitación?",
      sinInvitaciones:
        "Todavía no tienes ninguna invitación. Tu invitación se crea cuando contratas un plan; en cuanto esté, aparecerá aquí y podrás elegirle una plantilla.",
      misInvitaciones: "Mis invitaciones",
      seguirEditando: "Seguir editando",
      empezar: "Elegir plantilla",
      errorInvitaciones: "No pudimos cargar tus invitaciones.",
      errorCatalogo: "No pudimos cargar las plantillas.",
      fechaDeLaInvitacion: (fecha: string) => `Fecha del evento: ${fecha}`,
    },
    /** Barra superior del editor (`11 §7`, fila «Chrome del editor»). */
    barra: {
      inicio: "Mis invitaciones",
      deshacerRehacer: "Deshacer y rehacer",
      deshacer: (que: string) => `Deshacer: ${que}`,
      nadaQueDeshacer: "No hay nada que deshacer",
      rehacer: (que: string) => `Rehacer: ${que}`,
      nadaQueRehacer: "No hay nada que rehacer",
      verLaInvitacionEn: "Ver la invitación en",
      escritorio: "Escritorio",
      movil: "Móvil",
      sinNombre: "Tu invitación",
    },
    panel: {
      titulo: "Editor de la invitación",
      secciones: "Secciones",
      apariencia: "Apariencia",
      fotos: "Fotos",
      volverASecciones: "Volver a secciones",
      disenoDeLaSeccion: "Diseño de la sección",
      sinOpciones: "Por ahora no podemos mostrar las opciones de esta sección para editarlas aquí.",
      sinOpcionesSalida:
        "Puedes seguir mostrándola u ocultándola y reordenándola desde la lista; para el contenido, usa",
      sinOpcionesEnlace: "la vista previa",
    },
    /** Fila de sección: asa, interruptor y menú sin arrastre (`04 §14.4`, 2.5.7). */
    seccion: {
      reordenar: (nombre: string) => `Reordenar ${nombre}`,
      masOpciones: (nombre: string) => `Más opciones de ${nombre}`,
      mostrar: (nombre: string) => `Mostrar ${nombre}`,
      ocultar: (nombre: string) => `Ocultar ${nombre}`,
      siempreVisible: "Siempre visible",
      subir: "Subir",
      bajar: "Bajar",
      moverAlPrincipio: "Mover al principio",
      moverAlFinal: "Mover al final",
      quitar: (nombre: string) => `Quitar ${nombre}`,
      agregar: (que: string) => `Agregar ${que}`,
      alMaximo: (max: number) => `Alcanzaste el máximo de ${max}.`,
      alMinimo: (min: number) => `Agrega al menos ${min} ${min === 1 ? "elemento" : "elementos"}.`,
      ejemplo: "Ejemplo",
    },
    /** Campos del panel de bloque. */
    campo: {
      contenidoDeEjemplo: "Contenido de ejemplo — reemplázalo antes de publicar.",
      soloLecturaTitulo: "Solo lectura",
      sinValor: "—",
      elegirOpcion: "Elige una opción…",
      activado: "Activado",
      desactivado: "Desactivado",
      formato: "Formato de texto",
      negrita: "Negrita",
      cursiva: "Cursiva",
      enlace: "Enlace",
      ayudaTextoRico: "Selecciona texto y usa los botones para resaltarlo o convertirlo en enlace.",
      empieza: "Empieza",
      termina: "Termina (opcional)",
      moverArriba: (n: number) => `Mover el elemento ${n} arriba`,
      moverAbajo: (n: number) => `Mover el elemento ${n} abajo`,
      quitarElemento: (n: number) => `Quitar elemento ${n}`,
      elementoDe: (n: number, campo: string) => `Elemento ${n} de ${campo}`,
    },
    /** Gestor de fotos y foto suelta (`04 §6.4`, §13). */
    fotos: {
      titulo: (n: number, max: number) => `Galería — ${n} de ${max} fotos`,
      agregar: "Agregar",
      elegirParaGaleria: "Elegir fotos para la galería",
      soltarAqui: "Arrastra fotos aquí o",
      seleccionaArchivos: "selecciona archivos",
      limites: (mb: number, max: number) => `JPG, PNG o WebP · hasta ${mb} MB · máximo ${max} fotos`,
      subiendoN: (hechas: number, total: number) => `Subiendo ${hechas} de ${total}`,
      reordenarFoto: (n: number) => `Reordenar foto ${n}`,
      masOpcionesFoto: (n: number) => `Más opciones de la foto ${n}`,
      quitarFoto: (n: number) => `Quitar foto ${n}`,
      foto: (n: number) => `Foto ${n}`,
      sinBloqueDeFoto: "Esta plantilla no declaró un bloque de foto dentro de la galería — avísanos para revisarlo.",
      formatoNoAdmitido: "Formato no admitido. Usa JPG, PNG o WebP.",
      pesaMasDe: (mb: string) => `Pesa más de ${mb} MB.`,
      sinFoto: "Sin foto",
      cambiarFoto: "Cambiar foto",
      elegirFoto: "Elegir foto",
      usarEstaFoto: "Usar esta foto",
      textoAlternativo: "Texto alternativo",
      ayudaTextoAlternativo:
        "Describe la foto para quien no puede verla, p. ej. «Ana y Luis abrazados frente al mar».",
      puntoFocal: "Punto focal",
      ayudaPuntoFocal: "Qué parte de la foto se conserva siempre visible, aunque el marco cambie de forma.",
      horizontal: "Horizontal",
      vertical: "Vertical",
      preparando: "Preparando la foto",
    },
    /** Conflicto por `baseRevision` (`04 §12.6 (b)`). */
    conflicto: {
      titulo: "Esta invitación cambió en otro lugar",
      intro: (n: number) =>
        `Alguien (o tú, en otro dispositivo) guardó cambios mientras editabas. Tienes ${n} ${n === 1 ? "cambio" : "cambios"} sin guardar.`,
      hayQueElegir: "Elige una opción para seguir editando: mientras tanto no se guarda nada.",
      queHacer: "Qué hacer con tus cambios",
      traerLaNueva: (n: number) => `Traer la versión nueva y perder mis ${n} ${n === 1 ? "cambio" : "cambios"}`,
      intentarAplicar: (n: number) =>
        `Intentar aplicar mis ${n} ${n === 1 ? "cambio" : "cambios"} sobre la versión nueva`,
      intentarAplicarDetalle:
        "Los revisaremos uno por uno; los que ya no apliquen se descartarán y te los mostraremos antes de enviar nada.",
      verMisCambios: "Ver mis cambios antes de decidir",
      sinDescripcion: "No pudimos describir tus cambios pendientes.",
      resumenRebase: (aplicables: number, descartadas: number) =>
        `Se pueden aplicar ${aplicables} de tus cambios. Estos ${descartadas} ya no aplican sobre la versión nueva:`,
      seAplicanTodos: "Ninguno: se pueden aplicar todos.",
      continuar: "Continuar",
      aplicarLosQueSePuedan: "Aplicar los que se puedan",
    },
    /** Estados de la ruta del editor (error, no encontrada). */
    estados: {
      noPudimosAbrir: "No pudimos abrir el editor. Vuelve a intentarlo; tus cambios guardados siguen ahí.",
      invitacionNoEncontrada: "Revisa el enlace, o vuelve a tus invitaciones y ábrela desde ahí.",
      cargandoEditor: "Preparando tu invitación…",
    },
    /** Avisos de la barra del editor. */
    avisos: {
      otraPestana: "Esta invitación ya está abierta en otra pestaña.",
      editarAqui: "Editar aquí de todas formas",
      recuperados: (fecha: string, n: number) => `Tenías cambios sin guardar del ${fecha} (${n}).`,
      aplicarlos: "Aplicarlos",
      descartarlos: "Descartarlos",
      descartarAviso: "Descartar aviso",
      sinAcceso: "No tienes acceso a esta invitación.",
    },
    /** Diseño de una columna por debajo de 900 px (U-8, ADR-3-8-01). */
    movil: {
      pestanas: "Qué quieres ver",
      editar: "Editar",
      vistaPrevia: "Vista previa",
    },
    /** Bloque de solo lectura: dónde SÍ se cambia (U-3, `04 §6.3` «[Editar allí]»). */
    soloLectura: {
      dondeSeCambia: "Dónde se cambia",
      // La frase original de `04 §6.3` se conserva ENTERA (y con ella el e2e ajeno que la busca);
      // lo que se le añade es lo que faltaba: qué dato es y adónde ir a preguntarlo (U-3).
      deLaInvitacion:
        "Se toma de los datos de tu invitación. Es la fecha que quedó registrada al contratarla.",
      deLaPlantilla: "Este contenido lo define el diseño de la plantilla y no se puede editar.",
    },
    /**
     * U-3 resuelto de verdad (I-06): la fecha del evento ya se cambia DESDE AQUÍ. Es el
     * `[Editar allí]` que `04 §6.3` dibujaba y que nunca tuvo destino, ahora con destino: este
     * mismo panel. La frase de §6.3 se conserva entera y se le añade la salida real.
     */
    fechaEvento: {
      explicacion:
        "Se toma de los datos de tu invitación. Es la fecha que quedó registrada al contratarla, y puedes cambiarla aquí.",
      abrir: "Cambiar la fecha",
      etiquetaCampo: "Nueva fecha del evento",
      guardar: "Guardar la fecha",
      cancelar: "Cancelar",
      guardando: "Guardando la fecha",
      guardada: "Fecha actualizada.",
      // No se invalida nada solo (`ADR-3B-I06-01`): se le dice qué falta y qué hacer.
      republicar:
        "Tu invitación publicada sigue mostrando la fecha anterior. Vuelve a publicar para que tus invitados vean la nueva.",
      formatoInvalido: "Escribe la fecha como día, mes y año. Por ejemplo: 18 de abril de 2027.",
      sinGuardar: "No pudimos guardar la fecha. Inténtalo de nuevo.",
    },
    foto: {
      /** Mismo pie que ya tiene la galería, ahora también en la foto suelta (U-7). */
      limites: (mb: number) => `JPG, PNG o WebP · hasta ${mb} MB`,
      subiendo: "Subiendo foto",
    },
    lienzo: {
      tituloIframe: "Vista previa de la invitación",
      cargando: "Preparando la vista previa…",
      noDisponible:
        "La vista previa en vivo no está disponible en este momento. Puedes seguir editando desde la vista previa autenticada.",
      irAPreview: "Ver vista previa",
    },
    publicar: {
      abrir: "Publicar",
      titulo: "Publicar invitación",
      antesDePublicar: "Antes de publicar revisamos tu invitación:",
      cargandoRevision: "Revisando tu invitación…",
      errorRevision: "No pudimos revisar tu invitación. Inténtalo de nuevo.",
      sinPendientes: "Todo listo para publicar.",
      completar: "Completar",
      editar: "Editar",
      cancelar: "Cancelar",
      confirmar: "Publicar",
      publicando: "Publicando…",
      errorPublicar: "No pudimos publicar tu invitación. Revisamos la lista de nuevo por si algo cambió.",
      exitoTitulo: "Tu invitación está en vivo",
      // U-5: NO se afirma «ya se puede ver» hasta que la invalidación del enlace público responde.
      actualizandoEnlace: "Estamos actualizando el enlace de tus invitados…",
      yaSeVe: "Tu invitación ya se puede ver en internet.",
      tardaUnosMinutos:
        "Tu invitación quedó publicada. El enlace de tus invitados puede tardar unos minutos en mostrar esta versión.",
      // U-4: dos fechas distintas en la misma invitación.
      avisoFechasDistintas: (portada: string, itinerario: string) =>
        `La portada dice ${portada} y el primer momento del itinerario dice ${itinerario}. Tus invitados leerán la portada.`,
      revisarFechas: "Revisar",
      copiarEnlace: "Copiar enlace",
      enlaceCopiado: "¡Enlace copiado!",
      enlaceCopiadoToast: "Enlace copiado. Ya puedes pegarlo en WhatsApp.",
      enlaceNoCopiado: "No pudimos copiar el enlace. Selecciónalo y cópialo a mano.",
      tuEnlace: "El enlace de tus invitados",
      cerrar: "Cerrar",
      descripcionExito: "Tu invitación ya está en línea.",
      noSePuedePublicar: "Todavía no se puede publicar: resuelve lo que está marcado arriba.",
      noPudimosDespublicar: "No pudimos despublicar tu invitación.",
      noPudimosRotar: "No pudimos generar un enlace nuevo.",
      verComoInvitado: "Ver como invitado",
      compartirWhatsapp: "Compartir por WhatsApp",
      despublicar: "Despublicar",
      despublicando: "Despublicando…",
      confirmarDespublicar: "¿Quitar tu invitación de internet? El enlace dejará de mostrarse a tus invitados.",
      despublicada: "Tu invitación ya no está visible para tus invitados.",
      rotarEnlace: "Generar un enlace nuevo",
      rotando: "Generando enlace nuevo…",
      confirmarRotar: "El enlace actual dejará de funcionar y tendrás que compartir uno nuevo. ¿Continuar?",
      publicadaEl: (fecha: string) => `Publicada el ${fecha}`,
      bloqueo: {
        TPL_PUBLISH_BLOCKED_MISSING_REQUIRED: "Falta completar",
        TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT: "Sigue con el texto de ejemplo",
        TPL_PUBLISH_BLOCKED_INVALID_VALUES: "Tiene un valor que ya no es válido",
      },
      avisoSeccionVacia: "Esta sección está visible pero no tiene contenido todavía",
    },
  },
  preview: {
    titulo: "Vista previa",
  },
  publico: {
    noDisponible: {
      titulo: "Esta invitación ya no está disponible",
      cuerpo: "El enlace pudo haber expirado, cambiado o el anfitrión retiró la invitación.",
    },
    error: {
      titulo: "No pudimos abrir esta invitación",
      cuerpo: "Ocurrió un problema al cargar el contenido. Inténtalo de nuevo en un momento.",
    },
  },
  revalidate: {
    noAutorizado: "Token de revalidación inválido.",
    cuerpoInvalido: "Cuerpo de la petición inválido.",
  },
} as const;

export type Es_MX = typeof es_MX;
