// lib/i18n.ts — cadenas es-MX del chrome, sin biblioteca (04 §2). Objeto tipado plano: cada clave es
// una ruta con puntos, cada valor una cadena o una función que interpola parámetros.
//
// La marca (`comun.marca`, el pie) NO es un literal de este fichero: `lib/marca.ts` es su fuente
// única (D-02) y aquí solo se consume. Antes de este cambio `comun.marca` valía literalmente
// `"Invitaciones"` — el nombre GENÉRICO del producto, no el de una marca — y se repetía roto en
// `sitio.pie.derechos`. Ver la cabecera de `lib/marca.ts` para la frontera completa (qué es
// identidad literal y qué es configuración de entorno).
import { NOMBRE_MARCA, derechosReservados } from "./marca.ts";

export const es_MX = {
  comun: {
    cargando: "Cargando…",
    reintentar: "Reintentar",
    volver: "Volver",
    ayuda: "Ayuda",
    contacto: "Contacto",
    miCuenta: "Mi cuenta",
    guardado: "Guardado",
    guardando: "Guardando…",
    sinConexion: "Sin conexión",
    iniciarSesion: "Iniciar sesión",
    cerrarSesion: "Cerrar sesión",
    misInvitaciones: "Mis invitaciones",
    cancelar: "Cancelar",
    /** D-02: el nombre de la marca, no una palabra genérica. Fuente única: `lib/marca.ts`. */
    marca: NOMBRE_MARCA,
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
      // Fase 5, E3: teléfono opcional en el paso 3. El aviso va ANTES de escribir, no después de
      // que el servidor lo rechace (`Patterns.kt:56`: `+52` y 10 dígitos, sin espacios ni guiones).
      telefono: "Teléfono (opcional)",
      ayudaTelefono: "Con la lada de México: +52 y 10 dígitos, sin espacios ni guiones. Por ejemplo: +525512345678.",
      telefonoInvalido: "Ese teléfono no tiene el formato correcto: +52 y 10 dígitos, sin espacios ni guiones.",
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
      // Fase 5, E3 (contrato §5.1/§A2.1): la cuenta nace sin verificar y ENTRA igual — nada bloquea
      // el uso del producto. Se dice antes de crear la cuenta, junto al correo, para que la persona
      // no se sorprenda con un correo de confirmación que no esperaba.
      avisoSinVerificar: "Te mandamos un correo para confirmar esta dirección. Mientras tanto puedes usar tu cuenta sin ningún límite.",
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
    /**
     * `/contacto` (`12-producto-completo.md §B3.8`). Los canales (WhatsApp, correo de venta) usan
     * el mismo texto que `contactar` de arriba —mismo mensaje, mismo asunto— para que la conversación
     * empiece igual sea cual sea la puerta por la que entró la clienta. Este bloque solo añade lo
     * propio de esta pantalla: el encabezado y la caja de soporte para quien ya contrató.
     */
    paginaContacto: {
      eyebrow: "Hablemos",
      titulo: "¿Te ayudamos a decidir?",
      subtitulo: "Contestamos personas, no un robot.",
      tarjetaWhatsapp: { titulo: "WhatsApp", texto: "Para precios y para contratar." },
      tarjetaCorreo: { titulo: "Correo", texto: "Para lo que prefieras por escrito." },
      /**
       * Otra bandeja y otro tono que el contacto de venta (`NEXT_PUBLIC_SOPORTE_CORREO`, distinto de
       * `NEXT_PUBLIC_CONTACTO_CORREO`): esto es para quien YA contrató y algo no le funciona.
       */
      soporte: {
        titulo: "¿Ya eres clienta y algo no funciona?",
        /** Se parte en prefijo/sufijo para que la página pueda enlazar el correo de verdad. */
        prefijo: "Escríbenos a",
        sufijo: "y cuéntanos el nombre de tu invitación.",
        sinConfigurar:
          "El correo de soporte se publicará aquí en cuanto esté configurado. Mientras tanto, escríbenos por el contacto de arriba.",
      },
    },
    ctaFinal: {
      titulo: "¿Empezamos?",
      cuerpo: "Tu invitación puede estar lista esta misma tarde.",
      accion: "Empezar mi invitación",
    },
    pie: {
      // «invitaciones» va en minúscula a propósito: aquí es el sustantivo común (lo que se manda),
      // no la marca — la marca ya se lee arriba, en el `heading` del pie (`comun.marca`). D-02.
      lema: "Invitaciones digitales con RSVP, hechas en México.",
      derechos: (anio: number) => derechosReservados(anio),
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
    /**
     * Fase 5: soporte para quien YA es clienta, otra bandeja que el contacto de venta de arriba
     * (`NEXT_PUBLIC_SOPORTE_CORREO`, no `NEXT_PUBLIC_CONTACTO_CORREO`). Mismo criterio honesto de
     * `lib/contacto.ts`: sin la variable, se dice y no se inventa una dirección.
     */
    soporte: {
      titulo: "¿Ya eres clienta?",
      prefijo: "Para dudas de tu cuenta o de una invitación ya contratada, escríbenos a",
      sinConfigurar:
        "El correo de soporte para clientas se publicará aquí en cuanto esté configurado.",
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
  /**
   * `/verificar-correo` (fase 5, E3; `handoffs/5-E3-A2-contrato-cuenta.md §3-§4`). Ruta pública,
   * SIN sesión: quien llega aquí viene de su buzón. Los textos de error se ordenan por `code`
   * (nunca por `message`, el contrato lo dice explícito) — cada clave de abajo corresponde a un
   * `code` estable, no a la redacción que hoy manda el servidor.
   */
  cuenta: {
    verificarCorreo: {
      titulo: "Confirma tu correo",
      verificando: "Confirmando tu correo…",
      sinToken: {
        titulo: "Este enlace no trae el código de confirmación",
        cuerpo: "Ábrelo directo desde el correo que te mandamos, sin cambiarle nada a la dirección.",
      },
      // El texto del éxito es el que ya manda el servidor (`message`): distingue verificación
      // simple de confirmación de un cambio de correo con la MISMA frase confiable, sin que el
      // frontend tenga que adivinar el caso (contrato §5.3: "puede hacer falta mandar a /acceso").
      verificado: {
        titulo: "Listo",
        entrar: "Entrar a mi cuenta",
      },
      tokenInvalido: {
        titulo: "Ese enlace ya no sirve",
        cuerpo: "Puede que ya lo hayas usado, o que se haya cortado algo al copiarlo. Pide uno nuevo con tu correo.",
      },
      tokenCaducado: {
        titulo: "Ese enlace caducó",
        cuerpo: "Los enlaces de confirmación duran 24 horas. Pide uno nuevo con tu correo.",
      },
      reenvio: {
        correo: "Correo electrónico",
        enviar: "Mandar un enlace nuevo",
        enviando: "Mandando…",
        // Literal del contrato §5.7: un reenvío puede no mandar nada aunque responda 200 (tope por
        // IP, en silencio, a propósito). No se puede prometer «te lo acabamos de mandar».
        enviado: "Si el correo corresponde a una cuenta sin verificar, te mandamos un enlace nuevo.",
      },
      demasiadosIntentos: "Espera unos minutos antes de volver a intentarlo.",
      error: {
        titulo: "No pudimos confirmar tu correo",
        cuerpo: "Vuelve a intentarlo en un momento; si sigue pasando, pide un enlace nuevo.",
      },
    },
  },
  /**
   * `/perfil` (fase 5, E3; `12-producto-completo.md §7` del wireframe, `handoffs/5-E3-A2-contrato-cuenta.md`).
   * Cuatro bloques: datos, contraseña, sesiones, estado del correo. Errores SIEMPRE junto al campo
   * (`§B3.7`: «nunca un banner genérico arriba»).
   */
  perfil: {
    titulo: "Tu cuenta",
    correoSinVerificar: "Correo sin verificar",
    reenviarVerificacion: "Reenviar",
    reenviando: "Mandando…",
    verificacionReenviada: "Si tu cuenta todavía no está verificada, te mandamos un enlace nuevo.",
    cambioDeCorreoPendiente: (correo: string) => `Tienes un cambio de correo pendiente a ${correo}. Confírmalo desde tu buzón.`,
    volverAPedirCambio: "Volver a pedir el cambio",

    datos: {
      titulo: "Tus datos",
      nombre: "Nombre",
      apellidos: "Apellidos",
      correo: "Correo",
      // El correo se ve pero no se edita aquí (contrato §1: `PUT /user/profile` lo ignora).
      correoNota: "Para cambiarlo, usa «Cambiar correo» abajo: pide verificar el nuevo antes de aplicarlo.",
      cambiarCorreo: "Cambiar correo",
      telefono: "Teléfono",
      guardar: "Guardar cambios",
      guardando: "Guardando…",
      guardado: "Guardado",
      faltaNombre: "Escribe tu nombre.",
      faltaApellidos: "Escribe tus apellidos.",
      telefonoInvalido: "Ese teléfono no tiene el formato correcto: +52 y 10 dígitos, sin espacios ni guiones.",
    },

    cambiarCorreoDialogo: {
      titulo: "Cambiar tu correo",
      descripcion: "Te mandamos un enlace de confirmación a la nueva dirección. Tu correo de acceso no cambia hasta que lo abras.",
      nuevoCorreo: "Nuevo correo",
      contrasenaActual: "Tu contraseña actual",
      pedir: "Pedir el cambio",
      pidiendo: "Pidiendo…",
      // Genérico a propósito (contrato §2: la respuesta no dice si el correo estaba tomado).
      pedido: "Si los datos son correctos, te mandamos un enlace de confirmación a la nueva dirección.",
      faltaCorreo: "Escribe el nuevo correo.",
      correoInvalido: "Ese correo no tiene un formato válido.",
      faltaContrasena: "Escribe tu contraseña actual.",
      contrasenaIncorrecta: "Tu contraseña actual no coincide.",
      cerrar: "Cancelar",
    },

    contrasena: {
      titulo: "Contraseña",
      actual: "Actual",
      nueva: "Nueva",
      repite: "Repite la nueva",
      ayuda: "Al menos 8 caracteres, con mayúscula, minúscula y un símbolo.",
      // Se avisa ANTES de enviar (el botón lleva este texto al lado), no después de que ya cerró
      // la sesión: contrato §5.3, "avisarlo antes de que pulse".
      avisoCierraSesion: "Al cambiarla, cerramos tu sesión en todos los dispositivos y tendrás que volver a entrar.",
      cambiar: "Cambiar contraseña",
      cambiando: "Cambiando…",
      faltaActual: "Escribe tu contraseña actual.",
      faltaNueva: "Escribe la nueva contraseña.",
      noCoincide: "Las dos contraseñas nuevas no son iguales.",
      actualIncorrecta: "Tu contraseña actual no coincide.",
    },

    sesiones: {
      titulo: "Sesiones",
      intro: "Si usaste tu cuenta en un equipo prestado, ciérralas todas.",
      cerrarTodas: "Cerrar sesión en todos los dispositivos",
      cerrando: "Cerrando…",
    },

    tuInformacion: {
      titulo: "Tu información",
      // ADR-5-E3-B2-01: no hay ruta de baja autoservicio (`preguntas-abiertas.md`), así que el
      // botón del wireframe se resuelve con el correo de soporte que ya existe (`lib/env.ts`) en
      // vez de pintar un control muerto (regla G-01).
      pedirBaja: "Pedir que borren mi cuenta",
      pedirBajaTexto: (correo: string) => `Escríbenos a ${correo} desde el correo de tu cuenta y la damos de baja.`,
      sinSoporte: "Escríbenos desde el correo de tu cuenta para pedir que la demos de baja.",
    },

    errores: {
      demasiadosIntentos: "Espera unos minutos antes de volver a intentarlo.",
      generico: "No pudimos completar esto. Inténtalo de nuevo.",
      cargando: "No pudimos cargar tu perfil.",
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
  },
  /**
   * `/legal` (`12-producto-completo.md §B3.9`). Borradores en es-MX, redactados a partir de lo que
   * el producto guarda REALMENTE hoy (`InvitationGuestEntity`, `CustomerEntity`, D-02..D-05) — no
   * una plantilla genérica. Cada documento lleva su aviso de borrador con fecha (regla dura del
   * README de esta ruta): no se publica texto legal presentado como definitivo. La revisión de un
   * abogado queda como pregunta abierta (`preguntas-abiertas.md`).
   */
  legal: {
    fechaUltimaRevision: "9 de septiembre de 2026",
    avisoBorrador: (fecha: string) => `Borrador pendiente de revisión legal. Última actualización: ${fecha}.`,
    indice: {
      titulo: "Avisos legales",
      subtitulo: "Todavía no los ha revisado un abogado: son el punto de partida, no el texto final.",
      enEstaPagina: "En esta página",
      privacidad: {
        enlace: "Aviso de privacidad",
        resumen: "Qué guardamos de ti y de tus invitados, para qué y por cuánto tiempo.",
        subtemas: ["Qué guardamos", "Tus invitados", "Tus derechos"],
      },
      terminos: {
        enlace: "Términos del servicio",
        resumen: "Qué incluye tu plan, cómo se publica y qué pasa si cancelas.",
        subtemas: ["Qué incluye tu plan", "Devoluciones"],
      },
    },
    volverAAvisos: "Volver a Avisos legales",
    privacidad: {
      titulo: "Aviso de privacidad",
      intro:
        "Este aviso explica qué datos guarda Lino & Sello, de quién, para qué los usa y qué puedes hacer al respecto.",
      enEstaSeccion: "En este aviso",
      secciones: [
        {
          id: "quien-trata-tus-datos",
          titulo: "Quién trata tus datos",
          parrafos: [
            "Lino & Sello (linoysello.com) es responsable del tratamiento de los datos que recibe a través de este sitio y del editor de invitaciones.",
          ],
        },
        {
          id: "que-guardamos-de-ti",
          titulo: "Qué guardamos de ti, la clienta",
          parrafos: [
            "Cuando creas una cuenta guardamos tu nombre, tu correo y tu teléfono, y la contraseña que elijas — cifrada, nunca en claro.",
            "También guardamos el contenido de tus invitaciones: los datos del evento que escribes, las fotos que subes y las respuestas de tus invitados.",
          ],
        },
        {
          id: "tus-invitados",
          titulo: "Los datos de tus invitados",
          parrafos: [
            "Cuando das de alta a un invitado guardamos su nombre, su correo, su teléfono, los cupos que le asignas (cuántos adultos, niños o jóvenes puede llevar) y su respuesta de confirmación: si va, cuántos confirma y, si aplica, su mensaje de felicitación.",
            "Esos datos son tuyos, no nuestros: los guardamos para que puedas mandarle a cada invitado su enlace personal y llevar la cuenta de quién confirmó. No los usamos para nada distinto de operar tu invitación, y no se los vendemos ni se los cedemos a nadie más.",
            "Si un invitado quiere que corrijamos o borremos sus datos, tiene que pedírtelo a través de ti — eres tú quien lo dio de alta. Si tú nos escribes pidiéndolo en su nombre, lo hacemos.",
          ],
        },
        {
          id: "para-que-los-usamos",
          titulo: "Para qué los usamos",
          parrafos: [
            "Para darte de alta, dejarte entrar a tu cuenta y operar tu invitación: mostrarla a tus invitados, recibir sus confirmaciones y mandarte los correos del servicio (verificación de cuenta, avisos de tu invitación, soporte).",
            "Todavía no usamos tus datos con fines de publicidad ni se los compartimos con nadie para ese fin.",
          ],
        },
        {
          id: "cuanto-tiempo",
          titulo: "Cuánto tiempo los guardamos",
          parrafos: [
            "Mientras tu cuenta esté activa. Si la cancelas, borramos o anonimizamos tus datos y los de tus invitados en un plazo razonable, salvo lo que la ley nos obligue a conservar (por ejemplo, comprobantes de pago).",
          ],
        },
        {
          id: "con-quien-los-compartimos",
          titulo: "Con quién los compartimos",
          parrafos: [
            "Con los proveedores que hacen posible el servicio: quien aloja el sitio y la base de datos, quien manda los correos transaccionales y, cuando esté activo el pago en línea, Stripe para procesar tu cobro. Ninguno los usa para nada distinto de prestarnos ese servicio.",
          ],
        },
        {
          id: "tus-derechos",
          titulo: "Tus derechos",
          parrafos: [
            "Como titular de tus datos, en México tienes derecho a Acceder a ellos, Rectificarlos si están mal, Cancelarlos (pedir que los borremos) u Oponerte a un uso concreto — los derechos ARCO. Escríbenos a soporte@linoysello.com para ejercer cualquiera de ellos; te contestamos por el mismo correo.",
          ],
        },
        {
          id: "cambios-a-este-aviso",
          titulo: "Cambios a este aviso",
          parrafos: [
            "Si lo cambiamos de forma importante, lo avisamos en esta misma página con la fecha de la nueva versión.",
          ],
        },
      ],
    },
    terminos: {
      titulo: "Términos del servicio",
      intro:
        "Estos términos explican qué ofrece Lino & Sello, qué puedes esperar de tu plan y qué pasa si algo cambia.",
      enEstaSeccion: "En estos términos",
      secciones: [
        {
          id: "que-incluye-tu-plan",
          titulo: "Qué incluye tu plan",
          parrafos: [
            "Editar tu invitación es gratis: puedes elegir plantilla, escribir tus datos y previsualizarla sin pagar nada. Publicarla —que tus invitados puedan verla y confirmar— requiere un plan contratado.",
            "Cada plan define cuántas plantillas puedes usar y cuántos invitados puedes registrar. Te decimos el detalle cuando contratas.",
          ],
        },
        {
          id: "pagos",
          titulo: "Pagos",
          parrafos: [
            "El pago en línea, cuando esté activo, se procesa con Stripe; nosotros no vemos ni guardamos el número de tu tarjeta.",
          ],
        },
        {
          id: "devoluciones",
          titulo: "Devoluciones",
          parrafos: [
            "Si algo salió mal con tu pago o tu plan, escríbenos a soporte@linoysello.com contándonos qué pasó; lo revisamos caso por caso.",
          ],
        },
        {
          id: "tu-contenido",
          titulo: "El contenido de tu invitación",
          parrafos: [
            "Tú eres responsable de los textos, fotos y datos que subes: cuida que tengas derecho a usarlos y que la información de tus invitados sea correcta.",
          ],
        },
        {
          id: "disponibilidad",
          titulo: "Disponibilidad del servicio",
          parrafos: [
            "Hacemos lo posible por mantener el sitio disponible, pero no lo garantizamos al cien por ciento: puede haber mantenimientos o fallos que lo interrumpan brevemente.",
          ],
        },
        {
          id: "cambios-a-estos-terminos",
          titulo: "Cambios a estos términos",
          parrafos: [
            "Si los cambiamos de forma importante, lo avisamos en esta misma página con la fecha de la nueva versión.",
          ],
        },
      ],
    },
  },
  revalidate: {
    noAutorizado: "Token de revalidación inválido.",
    cuerpoInvalido: "Cuerpo de la petición inválido.",
  },
} as const;

export type Es_MX = typeof es_MX;
