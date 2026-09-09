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
    /** 404 y error de la web pública (11 §7, fila «Estados»): título, frase, UNA acción primaria
     *  («Ir a la portada») y una salida secundaria hacia `/ayuda` (mismo patrón que
     *  `errores.algoSalioMal`: nunca dos botones primarios, `11 §5`). */
    noExiste: {
      titulo: "Esta página no existe",
      cuerpo: "El enlace que abriste no existe o cambió de dirección. Desde la portada llegas a todo lo demás.",
      verAyuda: "Ver la ayuda",
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
    // B-17 (`bitacora/3c-ux.md §4`): la frase anterior («…con los que contrataste tu invitación»)
    // le hablaba solo a quien ya compró, y a esta pantalla se llega desde «Empezar mi invitación»,
    // que es el botón de quien NO ha comprado. Ahora sirve a los dos y señala la otra pestaña.
    intro: "Escribe el correo y la contraseña de tu cuenta. Si todavía no tienes una, créala en la pestaña de al lado.",
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
      // B-16: decía «Tres datos y ya» y pedía cuatro campos. Se cuenta lo que la persona ve: pasos.
      intro: "Tres pasos y ya. Después eliges el tipo de evento.",
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
        "Tu invitación nace cuando contratas un plan: ahí se define cuántas plantillas y cuántos invitados incluye. Escríbenos y te decimos precios y qué plan te conviene.",
      accion: "Ya tengo cuenta: entrar",
      nota: "Los precios todavía no se publican aquí: te los pasamos en cuanto nos escribas.",
    },
    /**
     * G-01 (`bitacora/3c-ux.md §4`): el sitio no tenía ni un canal para comprar ni para preguntar,
     * así que «Empezar mi invitación» terminaba en un circuito cerrado de cuatro toques. Estos son
     * los textos del bloque de contacto, que sale en la portada y en `/ayuda`. El número y el
     * correo NO están aquí: vienen del entorno (`lib/contacto.ts`), porque cuáles son es una
     * decisión de producto y un dato inventado sería peor que la ausencia.
     */
    contactar: {
      titulo: "¿Cómo se contrata?",
      intro:
        "Los planes se contratan con nuestro equipo: nos escribes, te decimos precios y te dejamos la cuenta lista para empezar.",
      whatsapp: "Escribir por WhatsApp",
      correo: "Escribir por correo",
      /** Va dentro del `?text=` de `wa.me`: quien lo recibe sabe de dónde sale sin preguntar. */
      mensaje:
        "Hola, quiero una invitación digital con confirmación de asistencia. ¿Me pasan precios y cómo la contrato?",
      asunto: "Quiero contratar una invitación digital",
      /** Sin ningún canal configurado se dice la verdad: nunca un botón que no lleva a nadie. */
      sinContacto:
        "Los planes se contratan con nuestro equipo; el contacto se publicará aquí en cuanto esté configurado. Si alguien ya te atendió, escríbele por ese mismo medio.",
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
    /**
     * `/precios` (fase 5, sesión E4): el catálogo real de planes, sustituyendo el marcador de
     * `panel.secciones.precios`. Un pago único por invitación (contrato §0); ningún precio se
     * calcula ni se inventa aquí, todos vienen del backend.
     */
    precios: {
      /** Metadatos del documento (`<title>`/descripción): esta página SÍ se indexa. */
      tituloDocumento: "Planes y precios · Lino & Sello",
      descripcionDocumento:
        "Un pago único por invitación: elige entre Sencillo, Fiesta o Grande y ve lo que incluye cada plan.",
      eyebrow: "Planes",
      titulo: "Un pago por invitación. Sin mensualidades.",
      intro: "Escribes y ves tu invitación gratis; pagas cuando la quieras mandar.",
      recomendado: "Recomendado",
      pagoUnico: "Pago único",
      elegir: (nombre: string) => `Elegir ${nombre}`,
      empezarGratis: "Empieza gratis",
      notaEmpezarGratis: "Eliges el plan cuando tu invitación esté lista.",
      pagoNoDisponible: "El pago en línea todavía no está disponible; escríbenos.",
      vacio: {
        titulo: "Escríbenos y te pasamos los precios",
        texto:
          "Todavía no pudimos cargar el catálogo de planes. Escríbenos y te decimos precios y cuál te conviene.",
      },
      preguntas: {
        titulo: "Preguntas de compra",
        uno: {
          pregunta: "¿Puedo probar antes de pagar?",
          respuesta: "Sí: escribes y ves tu invitación gratis; pagas cuando la quieras mandar.",
        },
        dos: {
          pregunta: "¿Puedo cambiar de plan?",
          respuesta: "Sí, mientras no hayas publicado. Escríbenos y te cambiamos al plan que necesites.",
        },
        tres: {
          pregunta: "¿Qué pasa si cancelo?",
          respuesta: "Si no llegas a publicar, no se te cobra nada. Si ya publicaste, escríbenos y lo revisamos contigo.",
        },
      },
      contacto: {
        titulo: "¿Prefieres que te lo expliquemos?",
      },
    },
    /**
     * `/pago` (fase 5, sesión E4): la vuelta de Stripe Checkout. Tres estados en una sola ruta
     * (`12-producto-completo.md §5`) y el que manda es el del BACKEND, nunca la URL de vuelta:
     * volver de Checkout no es haber pagado. `README.md` de esta carpeta detalla la regla.
     */
    pago: {
      tituloDocumento: "Tu pago · Lino & Sello",
      esperando: {
        titulo: "Estamos confirmando tu pago",
        cuerpo:
          "Tu banco ya nos contestó; falta que el cobro quede registrado. Esto suele tardar unos segundos. No cierres esta página.",
        /** Nombre accesible del `ProgressRing` indeterminado. */
        progreso: "Confirmando tu pago",
      },
      tardando: {
        titulo: "Está tardando más de lo normal",
        cuerpo: "Puede que el cobro tarde un poco más de lo habitual. Puedes seguir esperando o revisar tu plan.",
      },
      /** Compartido por "tardando" y por el estado de error: la misma salida honesta a soporte. */
      soporte: {
        conCorreo: "Si prefieres, escríbenos y lo revisamos contigo:",
        sinCorreo: "Escríbenos desde la ayuda y lo revisamos contigo.",
        irAyuda: "Ir a la ayuda",
        asunto: "Mi pago no se confirma",
      },
      confirmado: {
        titulo: "Listo, tu plan está activo",
        conEvento: (plan: string, evento: string) => `Plan ${plan} para «${evento}».`,
        sinEvento: (plan: string) => `Plan ${plan} activo.`,
        sinPlan: "Tu plan está activo.",
        comprobante: "Guarda esta página como constancia; el comprobante de Stripe llega a tu correo.",
        verComprobante: "Ver comprobante de Stripe",
        irInvitacion: "Ir a mi invitación",
        verPlan: "Ver mi plan",
      },
      cancelado: {
        titulo: "No completaste el pago",
        cuerpo: "No te cobramos nada. Tu invitación sigue guardada tal como la dejaste.",
        volverAIntentar: "Volver a intentar",
        verPlanes: "Ver los planes",
      },
      sinSesion: {
        titulo: "Entra a tu cuenta para ver el estado de tu pago",
        cuerpo: "Necesitamos que inicies sesión para consultar este pago.",
        entrar: "Iniciar sesión",
      },
      error: {
        titulo: "No pudimos consultar tu pago",
        cuerpo: "Vuelve a intentarlo en un momento; si sigue pasando, escríbenos.",
      },
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
      // G-01: el texto anterior («escríbenos por el mismo medio por el que contrataste tu
      // invitación») dejaba fuera justo a quien todavía no ha contratado nada, que es quien más
      // necesita esta caja. Ahora la caja ES el contacto (`ContactoParaContratar`).
      texto: "Escríbenos y te contestamos nosotros, hayas contratado ya o estés todavía preguntando precios.",
    },
  },
  /**
   * Asistente de creación de `/editor` (fase 3-C, 3C-6; `11 §7` fila «Asistente de creación»).
   * Cuatro pasos: tipo de evento → plantilla → datos básicos → confirmación. Los textos son los
   * del doc 11 cuando existen; el resto sigue su tono (segunda persona, verbos concretos, sin
   * jerga y sin códigos: los códigos de error viven en `errores.codigo`).
   */
  asistente: {
    navegacion: "Progreso del asistente",
    atras: "Atrás",
    continuar: "Continuar",
    continuarCon: (nombre: string) => `Continuar con ${nombre}`,
    pasos: {
      evento: "Tipo de evento",
      plantilla: "Plantilla",
      datos: "Datos básicos",
      listo: "Listo",
    },
    /** Sin sesión: se va a `/acceso` con retorno; el aviso existe por si la redirección tarda. */
    sesion: {
      titulo: "Entra a tu cuenta para empezar",
      texto: "Te llevamos a la pantalla de acceso. En cuanto entres, vuelves justo aquí.",
    },
    cargando: "Preparando el asistente…",
    errorRed: "No pudimos cargar esto. Revisa tu conexión y vuelve a intentarlo.",
    evento: {
      titulo: "¿Qué vamos a celebrar?",
      ayuda: "Elige uno; te mostramos solo las plantillas que le van.",
      grupo: "Tipo de evento",
      plantillas: (n: number) => (n === 1 ? "1 plantilla" : `${n} plantillas`),
      sinPlantillas: "Todavía no hay plantillas",
      // 3C-UX F-04: «El de tu invitación» son 19 caracteres en la mono de la insignia, que por
      // contrato de diseño (`11 §5`) no parte línea: medía 165 px dentro de una columna de tarjeta
      // de 97 px a 390 px de ancho y arrastraba TODA la página a 421 px de desplazamiento
      // horizontal. «Tu evento» cabe en la columna y dice lo mismo junto al nombre del tipo.
      tuTipo: "Tu evento",
      distintoDelRegistrado: (registrado: string) =>
        `Tu invitación está registrada como ${registrado}. Puedes mirar otros tipos, pero las plantillas de ${registrado} son las que encajan con sus secciones.`,
      paraCual: "¿Para cuál invitación?",
      paraCualAyuda: "La plantilla se aplicará a la invitación que elijas aquí.",
    },
    plantilla: {
      titulo: "Elige el punto de partida",
      ayuda: (tipo: string) =>
        `Solo plantillas de ${tipo}. Los colores y la tipografía los cambias después, dentro del editor.`,
      filtros: "Filtrar plantillas",
      todas: (n: number) => `Todas · ${n}`,
      enMiPlan: "Incluidas en mi plan",
      vistaPreviaDe: (nombre: string) => `Vista previa de la plantilla ${nombre}`,
      incluida: "Incluida en tu plan",
      requierePlan: (nivel: number) => `Requiere el plan ${nivel}`,
      verQueIncluye: (nivel: number) => `Ver qué incluye el plan ${nivel}`,
      usar: "Usar esta plantilla",
      usando: "Preparando tu invitación…",
      elegida: "Elegida",
      /** Capacidades reales del manifiesto (`packages/schema` `Capability`), no etiquetas de estilo. */
      capacidad: {
        singlePlace: "Un solo lugar",
        story: "Nuestra historia",
        hashtags: "Hashtag",
        music: "Música",
        countdown: "Cuenta regresiva",
      },
      vacioTitulo: "Todavía no hay plantillas para este tipo",
      vacioTexto:
        "Estamos preparando más diseños. Mientras tanto puedes mirar los de otro tipo de evento.",
      vacioAccion: "Elegir otro tipo",
      sinResultadosTitulo: "Ningún diseño cumple ese filtro",
      sinResultadosTexto: "Prueba con otro filtro o quítalos para ver todas las plantillas de este tipo.",
      quitarFiltros: "Quitar los filtros",
      errorPlanTier: (nombre: string) =>
        `«${nombre}» es de un plan superior al de tu invitación. Elige otra o pide el cambio de plan.`,
      errorNoDisponible: "Esta plantilla ya no está disponible. Actualizamos la lista.",
      errorMigracion: "No podemos preparar esta plantilla ahora mismo. Avísanos y lo revisamos.",
    },
    datos: {
      titulo: "Los datos básicos",
      ayuda: "Puedes cambiarlos después, dentro del editor.",
      quienes: "¿Quiénes celebran?",
      cuando: "¿Cuándo?",
      donde: "¿Dónde?",
      fecha: "Fecha del evento",
      fechaAyuda: "Es la fecha que verán tus invitados en la portada.",
      hora: "Hora de inicio",
      lugar: "Nombre del lugar",
      lugarAyuda: "La dirección y el mapa se completan dentro del editor.",
      fechaInvalida: "Escribe la fecha como día, mes y año. Por ejemplo: 18 de abril de 2027.",
      guardando: "Guardando tus datos…",
      // 3C-UX G-03: el aviso decía «Puedes continuar» y «Continuar» NO continuaba. Ahora el texto
      // ofrece exactamente los dos botones que salen debajo, ni uno más.
      errorGuardar:
        "No pudimos guardar estos datos. Vuelve a intentarlo, o sigue sin guardar: los escribes dentro del editor y no se pierde nada.",
      errorGuardarSinRed:
        "No hay conexión, así que no pudimos guardar estos datos. Vuelve a intentarlo, o sigue sin guardar: los escribes dentro del editor y no se pierde nada.",
      reintentar: "Volver a guardar",
      seguirSinGuardar: "Seguir sin guardar",
      omitir: "Lo lleno después",
    },
    listo: {
      titulo: "Tu invitación ya tiene diseño",
      resumen: (tipo: string, plantilla: string) => `${tipo} · plantilla «${plantilla}»`,
      queSigue:
        "Dentro del editor cambias textos, fotos y colores, y publicas cuando esté lista. Nada se ve en internet hasta que tú lo publiques.",
      abrir: "Abrir mi invitación",
      // ADR-5-0B-01 (puerta de publicación): editar y previsualizar son gratis, el plan solo hace
      // falta para publicar. `panel.plan.elegirPlan` es el texto del botón (se reutiliza: es el
      // mismo destino y la misma etiqueta que el resto del producto usa para ir al plan).
      notaPlan: "Puedes escribirla y verla gratis; el plan solo hace falta para publicarla.",
    },
    sinInvitaciones: {
      titulo: "Todavía no tienes invitaciones",
      texto:
        "Tu invitación se crea cuando contratas un plan. En cuanto exista, aparece aquí y podrás elegirle una plantilla.",
      accion: "Ver planes",
      /** Título de la PÁGINA en ese caso: el del estado vacío es su propio encabezado (h2). */
      tituloDePagina: "Tus invitaciones",
    },
    /**
     * 3C-UX G-02: con todas las invitaciones ya diseñadas, el paso 1 era una pregunta sin
     * respuestas y un «Continuar» inhabilitado para siempre. Deja de fingir que es el paso 1: dice
     * en una frase por qué y enseña «Mis invitaciones», que es la salida real.
     */
    sinLibres: {
      titulo: "Todas tus invitaciones ya tienen diseño",
      texto:
        "El diseño se cambia desde dentro de cada invitación. Ábrela para seguir editándola o comparte su enlace.",
      /** Con una sola invitación, el plural sería mentira. */
      tituloUna: "Tu invitación ya tiene diseño",
      textoUna:
        "El diseño se cambia desde dentro de la invitación. Ábrela para seguir editándola o comparte su enlace.",
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
      // 3C-UX G-06: la fila dice también QUÉ es cada invitación y en qué estado está, y cuando está
      // publicada enseña el enlace de las invitadas sin obligar a volver a publicar para verlo.
      seguirEditando: "Abrir en el editor",
      empezar: "Elegir plantilla",
      estadoEnEdicion: "En edición",
      estadoPublicada: "Publicada",
      enlaceDeInvitadas: "Enlace de tus invitadas",
      copiarEnlace: "Copiar",
      enlaceCopiado: "Enlace copiado",
      enlaceNoCopiado: "No pudimos copiar el enlace. Selecciónalo y cópialo a mano.",
      verComoInvitada: "Ver como invitada",
      errorInvitaciones: "No pudimos cargar tus invitaciones.",
      errorCatalogo: "No pudimos cargar las plantillas.",
      fechaDeLaInvitacion: (fecha: string) => `Fecha del evento: ${fecha}`,
      /** Fase 3-C, 3C-6: la lista de «Mis invitaciones» vive ahora en el paso 1 del asistente. */
      sinFecha: "Sin fecha registrada",
      sinAcceso: "No disponible",
      numero: (id: number) => `Invitación n.º ${id}`,

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
      // U-4 / G-04: dos fechas distintas en la misma invitación. Desde 3C-UX-B el aviso mira TAMBIÉN
      // el itinerario de ejemplo, que es el que se publicó con dos fechas distintas y un «Todo listo».
      avisoFechasDistintas: (evento: string, itinerario: string) =>
        `Tu evento es el ${evento}, pero el itinerario que verán tus invitados dice ${itinerario}.`,
      avisoFechasDeEjemplo: (evento: string, itinerario: string) =>
        `Tu evento es el ${evento}, pero el itinerario sigue con el horario de ejemplo (${itinerario}) y es el que verán tus invitados.`,
      usarLaFechaDelEvento: "Usar la fecha del evento en el itinerario",
      aplicandoFechas: "Aplicando…",
      fechasAplicadas: "El itinerario ya usa la fecha de tu evento.",
      noPudimosAplicarFechas: "No pudimos cambiar la fecha del itinerario. Ábrelo y cámbiala ahí.",
      revisarFechas: "Revisar",
      // G-05: TODO lo que sigue en contenido de ejemplo y la invitada va a leer, no solo lo obligatorio.
      tituloEjemplos: "Contenido de ejemplo que verán tus invitados",
      ejemploDeBloque: (etiqueta: string, muestra: string) => (muestra ? `${etiqueta}: «${muestra}»` : etiqueta),
      ejemploDeGrupo: (etiqueta: string, muestra: string, cuantos: number) =>
        muestra
          ? `${etiqueta}: ${cuantos === 1 ? "1 ficha de ejemplo" : `${cuantos} fichas de ejemplo`}, empezando por «${muestra}»`
          : `${etiqueta}: ${cuantos === 1 ? "1 ficha de ejemplo" : `${cuantos} fichas de ejemplo`}`,
      seccionEnteraDeEjemplo: "Esta sección es de ejemplo entera.",
      ocultarSeccion: "Ocultar sección",
      seccionOcultada: (titulo: string) => `«${titulo}» ya no se verá en tu invitación.`,
      yMasEjemplos: (cuantos: number) => (cuantos === 1 ? "y 1 más" : `y ${cuantos} más`),
      hayAvisos: (cuantos: number) =>
        cuantos === 1
          ? "Puedes publicar, pero hay 1 cosa que tus invitados verían sin terminar."
          : `Puedes publicar, pero hay ${cuantos} cosas que tus invitados verían sin terminar.`,
      publicarDeTodosModos: "Publicar de todos modos",
      // G-06: el estado «publicada» y el enlace dejan de vivir dentro del diálogo que acaba de publicar.
      estadoPublicada: "Publicada",
      estadoConCambios: "Cambios sin publicar",
      etiquetaEstadoPublicada: "Tu invitación está publicada",
      etiquetaEstadoConCambios: "Tu invitación está publicada, con cambios que aún no ven tus invitados",
      compartir: "Compartir",
      volverAPublicar: "Volver a publicar",
      volverAPublicarCorto: "Publicar",
      yaEstaPublicada: "Tu invitación ya está publicada. Vuelve a publicar para que tus invitados vean los cambios.",
      alDiaConLoPublicado: "Tus invitados ya ven esta versión.",
      copiarEnlace: "Copiar enlace",
      enlaceCopiado: "¡Enlace copiado!",
      enlaceCopiadoToast: "Enlace copiado. Ya puedes pegarlo en WhatsApp.",
      enlaceNoCopiado: "No pudimos copiar el enlace. Selecciónalo y cópialo a mano.",
      tuEnlace: "El enlace de tus invitados",
      cerrar: "Cerrar",
      // 3C-UX F-09: decía «Tu invitación ya está en línea.», la tercera frase seguida que afirma lo
      // mismo que el título («Tu invitación está en vivo») y que `yaSeVe`. Aquí se contesta lo que
      // la clienta sí se pregunta al publicar: si puede seguir editando después.
      descripcionExito: "Comparte el enlace con tus invitados. Puedes seguir editando y volver a publicar cuando quieras.",
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
        // ADR-5-0B-01: la puerta de publicación (`ReleaseService`) bloquea sin plan pagado. El
        // texto vive aquí porque `textoHallazgo` (PublishDialog.tsx) resuelve TODOS los bloqueos
        // por este mapa; el enlace a la pantalla del plan es el cambio propio de PublishDialog.tsx.
        TPL_PLAN_UNPAID: "Falta el plan: publica cuando tu invitación tenga un plan pagado.",
      },
      avisoSeccionVacia: "Esta sección está visible pero no tiene contenido todavía",
    },
  },
  preview: {
    titulo: "Vista previa",
  },
  // `publico.*` se retiró de aquí en 3C-8: vivía solo para `/i/[publicToken]/{error,not-found}.tsx`,
  // y como `es_MX` es un único objeto exportado, importar una sola clave suya bundlea el árbol
  // ENTERO — sacaba la ruta pública de presupuesto (163,1 de 150 KB gz). Mismo texto, ahora en
  // `app/(public)/i/[publicToken]/textos.ts` (`textosPublicos.error` / `.noDisponible`).
  /**
   * Fase 5 · andamio del PANEL DEL CLIENTE y marcadores de las rutas nuevas (5-0d).
   *
   * `nav.*` son las etiquetas del registro de navegación (`lib/panel/nav.ts`): cada entrada declara
   * una CLAVE de aquí, nunca un literal, y el tipo `EntradaDeNavegacion` obliga a que la clave
   * exista (`keyof Es_MX["panel"]["nav"]`).
   *
   * `marcador.*` y `secciones.*` son el texto de las páginas EN CONSTRUCCIÓN que dejan sitio a cada
   * sesión de la fase 5. Cada sesión sustituye su pantalla entera y se lleva por delante su entrada
   * de `secciones`; `nav` y `marcador` sobreviven.
   *
   * EXCEPCIÓN deliberada: `/r/[token]` (la confirmación del invitado) NO lee de aquí. Vive en el
   * grupo `(public)`, y `es_MX` es un único objeto `as const`: importar una sola clave arrastra el
   * árbol entero del chrome al JS de una ruta pública y móvil — medido en 3C-8, sacó `/i` de
   * presupuesto (163,1 de 150 KB gz). Sus textos están en `app/(public)/r/[token]/textos.ts`, igual
   * que los de `/i/[publicToken]`.
   */
  panel: {
    /** Nombre accesible de la barra de navegación del panel del cliente (`components/plan/BarraDelPanel.tsx`). */
    navegacion: "Secciones de tu invitación",
    nav: {
      invitados: "Invitados",
      plan: "Plan",
      compartir: "Compartir",
    },
    marcador: {
      /** Insignia de la página: dice de una lo que es, antes de leer nada más. */
      enConstruccion: "En construcción",
      volverAlEditor: "Volver al editor",
      verMisInvitaciones: "Ver mis invitaciones",
      verLaAyuda: "Ver la ayuda",
    },
    secciones: {
      invitados: {
        titulo: "Invitados",
        texto:
          "Aquí vas a llevar tu lista de invitados y ver quién confirmó, quién no puede ir y quién todavía no contesta. Estamos construyéndola; por ahora no hay nada que mostrar.",
      },
      plan: {
        titulo: "Tu plan",
        texto:
          "Aquí vas a ver el plan de esta invitación, lo que incluye y cómo cambiarlo. Estamos construyéndolo; por ahora no hay nada que mostrar.",
      },
      precios: {
        titulo: "Planes y precios",
        texto:
          "Aquí van a estar los planes con lo que incluye cada uno y su precio. Todavía no los publicamos. Mientras tanto, en la ayuda te decimos cómo contratar.",
      },
      pago: {
        titulo: "Tu pago",
        texto:
          "Esta es la página a la que vas a regresar al terminar de pagar. Todavía no está conectada, así que aquí no se cobra nada ni se confirma ningún pago.",
      },
      admin: {
        titulo: "Administración",
        texto:
          "Esta sección es para el equipo de Lino & Sello. Todavía no está construida: no muestra información de ninguna cuenta ni de ninguna invitación.",
      },
      perfil: {
        titulo: "Tu cuenta",
        texto:
          "Aquí vas a poder cambiar tus datos, tu contraseña y la marca de tus invitaciones. Estamos construyéndolo; por ahora no hay nada que mostrar.",
      },
      contacto: {
        titulo: "Contacto",
        texto:
          "Aquí va a estar la forma de escribirnos. Mientras la terminamos, los medios de contacto que ya existen están en la ayuda.",
      },
      legal: {
        titulo: "Avisos legales",
        texto:
          "Aquí van a estar el aviso de privacidad, los términos del servicio y la política de cookies. Todavía no los publicamos.",
      },
    },
    /**
     * `/editor/[invitationId]/plan` (fase 5, sesión E4): el plan de ESTA invitación — la oferta
     * mientras no está pagada (estado vacío de la pantalla), el resumen cuando ya lo está, y el
     * historial de pagos. Ningún precio se escribe aquí: siempre viene del backend
     * (`handoffs/5-4-contrato-pagos.md` §2.2/§2.4) y se formatea con `lib/pagos/dinero.ts`.
     */
    plan: {
      metaTitulo: "Plan de tu invitación",
      invitacionSinNombre: "Tu invitación",
      cargando: "Cargando tu plan…",
      sinSesion: {
        hayQueEntrar: "Para ver el plan de tu invitación necesitas entrar a tu cuenta.",
        sesionTerminada: "Tu sesión terminó. Vuelve a entrar para seguir donde lo dejaste.",
      },
      error: {
        titulo: "No pudimos cargar tu plan",
        cuerpo: "Revisa tu conexión e inténtalo de nuevo.",
        escribenos: (correo: string) => `Si sigue pasando, escríbenos a ${correo}.`,
        verAyuda: "Ver la ayuda",
      },
      oferta: {
        titulo: "Esta invitación todavía no tiene plan",
        texto:
          "Puedes escribirla y verla completa sin pagar. Para publicarla y mandarla a tus invitados necesitas un plan.",
        opciones: "Elige un plan",
        pagarYPublicar: "Pagar y publicar",
        abriendoPago: "Abriendo el pago…",
        verTodosLosPlanes: "Ver todos los planes",
        sinPagoEnLinea: "El pago en línea todavía no está disponible.",
        catalogoError: "No pudimos cargar los planes.",
      },
      errores: {
        noConfigurado: "El pago en línea todavía no está disponible.",
        yaPagada: "Esta invitación ya tiene un plan pagado. Actualizamos la información.",
        planNoEncontrado: "Ese plan ya no está disponible. Aquí tienes el catálogo actualizado.",
        generico: "No pudimos abrir el pago. Inténtalo de nuevo.",
      },
      pagado: {
        planActivo: "Plan activo",
        badgePagado: "Pagado",
        pagadoEl: (fecha: string, importe: string) => `Pagado el ${fecha} · ${importe}`,
        sinDatosDePlan: "Tu plan está activo; si tienes dudas escríbenos.",
        irAMiInvitacion: "Ir a mi invitación",
        verComprobante: "Ver mi comprobante",
      },
      historial: {
        titulo: "Pagos de esta invitación",
        vacio: "Todavía no hay pagos registrados.",
        deslizate: "Pagos de esta invitación, desplázate para ver más",
        fecha: "Fecha",
        plan: "Plan",
        importe: "Importe",
        estado: "Estado",
        comprobante: "Comprobante",
        estados: {
          PAGADO: "Pagado",
          PENDIENTE: "Pendiente",
          FALLIDO: "Fallido",
          CADUCADO: "Caducado",
          REEMBOLSADO: "Reembolsado",
        },
      },
      elegirPlan: "Elegir plan",
    },
  },
  revalidate: {
    noAutorizado: "Token de revalidación inválido.",
    cuerpoInvalido: "Cuerpo de la petición inválido.",
  },
} as const;

export type Es_MX = typeof es_MX;
