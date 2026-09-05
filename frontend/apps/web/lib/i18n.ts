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
  },
  errores: {
    generico: "Algo salió mal. Inténtalo de nuevo.",
    sesionInvalida: "Tu sesión no es válida o expiró. Inicia sesión de nuevo.",
    rolInsuficiente: "Tu cuenta no tiene permiso para hacer esto.",
    noEncontrado: "No encontramos lo que buscabas.",
    conflictoRevision: "Alguien más guardó cambios antes que tú. Recarga para verlos.",
    cuerpoDemasiadoGrande: "Ese cambio es demasiado grande para enviarlo de una vez.",
    codigo: (codigo: string) => `Código: ${codigo}`,
  },
  editor: {
    catalogo: {
      titulo: "Elige una plantilla",
      filtroTodas: "Todas",
      filtroIncluidasEnPlan: "Incluidas en mi plan",
      resultados: (n: number) => `${n} ${n === 1 ? "resultado" : "resultados"}`,
      vacio: "No hay plantillas disponibles todavía.",
    },
    panel: {
      titulo: "Editor de la invitación",
      secciones: "Secciones",
      apariencia: "Apariencia",
      fotos: "Fotos",
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
      copiarEnlace: "Copiar enlace",
      enlaceCopiado: "¡Enlace copiado!",
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
