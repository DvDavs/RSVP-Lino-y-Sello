// components/sitio/dudas-ayuda.ts — el contenido de `/ayuda`, aparte de su presentación.
//
// Cada duda de esta lista nació de la revisión de uso sin instrucciones (`bitacora/3-ux.md`): no
// hay relleno. La respuesta va en texto plano (no JSX) para que el buscador pueda mirar dentro de
// ella sin tener que recorrer un árbol de React, y para que estas frases se puedan probar.
export interface Duda {
  /** Ancla enlazable: `/ayuda#fecha` sigue funcionando (lo enlaza el editor). */
  readonly id: string;
  readonly pregunta: string;
  readonly parrafos: readonly string[];
}

export const DUDAS: readonly Duda[] = [
  {
    id: "empezar",
    pregunta: "¿Cómo empiezo mi invitación?",
    parrafos: [
      "Tu invitación se crea cuando contratas un plan. En cuanto existe, aparece en «Mis invitaciones». Ahí eliges la plantilla —el punto de partida del diseño— y ya puedes cambiar textos, fotos y colores.",
      "Si todavía no has contratado nada, escríbenos: abajo, en «¿No está tu duda aquí?», está el contacto para pedir precios y que te dejemos la cuenta lista.",
    ],
  },
  // G-01 / medias del cierre 3-C. `components/asistente/MisInvitaciones.tsx` manda aquí con
  // `/ayuda#planes` a quien no tiene ninguna invitación: el ancla `planes` TIENE que ser la duda de
  // cómo se contrata y cuánto cuesta, no la de cambiar de plan. Antes era esta última y la clienta
  // leía la misma frase que la había traído («contrata un plan»), sin decirle dónde ni con quién.
  {
    id: "planes",
    pregunta: "¿Cuánto cuesta y cómo contrato un plan?",
    parrafos: [
      "Los precios todavía no están publicados en el sitio: dependen del plan —cuántas plantillas y cuántos invitados incluye— y te los pasamos por escrito en cuanto nos preguntes.",
      "Los planes se contratan con nuestro equipo, no en línea. Escríbenos por el contacto que aparece al final de esta página, en «¿No está tu duda aquí?»: te decimos el precio, qué plan te conviene y te dejamos la cuenta creada para que solo entres y elijas el diseño.",
      "Todavía no se puede pagar desde la página. Cuando exista, aparecerá aquí.",
    ],
  },
  {
    id: "fecha",
    pregunta: "¿Dónde se cambia la fecha del evento?",
    parrafos: [
      "La fecha del evento se cambia desde el editor, en el panel de la portada: el botón «Cambiar la fecha». Es la fecha que quedó registrada al contratar tu invitación, y al guardarla se actualiza en toda la invitación de una vez, para que nunca diga dos fechas distintas.",
      "Si tu invitación ya está publicada, tienes que volver a publicar para que tus invitados vean la fecha nueva. Te lo recordamos ahí mismo.",
      "Las horas de cada momento del día —ceremonia, recepción, fiesta— las cambias en la sección Itinerario. Si le pones una fecha distinta de la de la portada, te avisamos antes de publicar.",
    ],
  },
  {
    id: "publicar",
    pregunta: "¿Qué pasa cuando publico?",
    parrafos: [
      "Publicar hace visible tu invitación en su enlace público, el que compartes con tus invitados. Antes de publicar revisamos que no falte nada obligatorio.",
      "Puedes seguir editando después: los cambios no se ven hasta que vuelves a publicar. Si te arrepientes, «Despublicar» la retira de internet.",
    ],
  },
  {
    id: "quien-la-ve",
    pregunta: "¿Quién puede ver mi invitación?",
    parrafos: [
      "Solo quien tenga el enlace. No aparece en buscadores. Si crees que el enlace se compartió de más, «Generar un enlace nuevo» deja el anterior sin efecto: a quien ya lo tenía dejará de abrirle, así que tendrás que volver a mandarlo.",
    ],
  },
  {
    id: "confirmaciones",
    pregunta: "¿Cómo confirman mis invitados?",
    parrafos: [
      "Cada invitado abre el enlace en su teléfono y confirma desde ahí, sin instalar nada ni crear una cuenta. Tú ves las confirmaciones desde tu invitación.",
    ],
  },
  {
    id: "cambiar-plan",
    pregunta: "Una plantilla dice que necesita otro plan",
    parrafos: [
      "Algunas plantillas están incluidas solo en los planes superiores. Puedes usar cualquiera de las que no lo indican; para las demás, pídenos el cambio de plan por el contacto del final de esta página y te decimos la diferencia.",
    ],
  },
  {
    id: "fotos",
    pregunta: "¿Qué fotos puedo subir?",
    parrafos: [
      "JPG, PNG o WebP, hasta 8 MB cada una. Si una foto pesa más, redúcela antes de subirla: te avisamos en el momento, no después de esperar la subida entera.",
    ],
  },
];

/** Normaliza para buscar: minúsculas y sin acentos, para que «publicacion» encuentre «publicación». */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Filtra por pregunta Y respuesta: quien escribe «whatsapp» busca en el cuerpo, no en el título. */
export function filtrarDudas(dudas: readonly Duda[], consulta: string): readonly Duda[] {
  const aguja = normalizar(consulta.trim());
  if (aguja.length === 0) return dudas;
  return dudas.filter((duda) => normalizar(`${duda.pregunta} ${duda.parrafos.join(" ")}`).includes(aguja));
}
