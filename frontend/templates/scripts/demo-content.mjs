// frontend/templates/scripts/demo-content.mjs
//
// Emite los LOTES DE OPERACIONES (`OperationBatch` sin `baseRevision`) que rellenan la invitación
// de demostración de `boda-clasica@1.0.0` con contenido de boda creíble y escrito en es-MX.
// Lo consume `scripts/seed-demo.sh`, que le pasa el mapa `nombre de archivo → assetId` de los
// assets ya subidos por `POST /editor/invitations/{id}/assets` y le añade el `baseRevision` de cada
// lote.
//
//   node frontend/templates/scripts/demo-content.mjs assets.json > lotes.json
//
// Por qué el contenido tiene que ser real y no "Texto de ejemplo": el bloqueo de publicación
// `TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT` (`03 §3.10`) impide publicar mientras queden bloques con
// `provenance: "default"`, y el dueño va a juzgar la invitación mirándola. Un `lorem ipsum` fallaría
// las dos cosas a la vez.
//
// Los bloques `source: "business"` (`cover.date`, `couple.date`, `gallery.hashtag`,
// `rsvp.childrenAllowed`) y `source: "fixed"` (`cover.buttonLabel`, `rsvp.background`,
// `footer.note`) NO se tocan: escribirlos devuelve `422 TPL_BLOCK_NOT_EDITABLE` (I-21). Los de
// negocio salen de las columnas de `invitation`, que el sembrador ya rellena.

import fs from 'node:fs';

const assets = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const img = (nombre, alt, focal = { x: 0.5, y: 0.42 }) => {
  const assetId = assets[nombre];
  if (!assetId) throw new Error(`falta el assetId de "${nombre}" en el mapa de assets`);
  return { kind: 'image', assetId, alt, focal };
};
const T = (value) => ({ kind: 'text', value });
const L = (...items) => ({ kind: 'listText', items });
const P = (name, note) => (note === undefined ? { kind: 'person', name } : { kind: 'person', name, note });
const D = (value) => ({ kind: 'date', value });
const R = (...parrafos) => ({
  kind: 'richText',
  doc: { type: 'doc', content: parrafos.map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })) },
});
const LOC = (name, address, mapHref) => ({ kind: 'location', name, address, mapHref });
const RANGO = (start, end) => (end ? { kind: 'dateTimeRange', start, end } : { kind: 'dateTimeRange', start });
const LINK = (href, label) => ({ kind: 'link', href, label });
const CH = (optionId) => ({ kind: 'choice', optionId });

const set = (blockId, value) => ({ op: 'setBlock', blockId, value });
/**
 * `TempId` es `^tmp:[A-Za-z0-9_-]{8,64}$` (`packages/schema/src/common.ts:29`): con MENOS de ocho
 * caracteres tras el prefijo, el lote entero sale `400 TPL_MALFORMED_JSON` y el cuerpo no dice
 * "tempId corto" — dice que ninguna de las once operaciones del `oneOf` casa, con 54 violaciones.
 * De ahí el prefijo `demo-`: garantiza el mínimo aunque el nombre del ítem sea "foto-1".
 */
const item = (groupId, nombre, values) => ({ op: 'addItem', groupId, tempId: `tmp:demo-${nombre}`, values });

// --------------------------------------------------------------------------------- los seis lotes
// Se reparte en lotes pequeños a propósito: el reductor es todo-o-nada por lote (ADR-014), así que
// un lote grande que falle por un solo bloque no deja ver cuál. Cada `clientBatchId` es estable, que
// es lo que hace la siembra idempotente: repetirla devuelve `200 {applied:false}` (ADR-1R-B-03).

const lotes = [
  {
    clientBatchId: 'seed-boda-01-portada',
    operations: [
      set('cover.title', T('Ana Sofía & Diego')),
      set('cover.subtitle', T('Nos casamos')),
      set('cover.image', img('cover.webp', 'Lámina de papelería con una guirnalda de olivo dibujada a mano', { x: 0.5, y: 0.32 })),
    ],
  },
  {
    clientBatchId: 'seed-boda-02-novios',
    operations: [
      set('couple.heading', T('Con la bendición de Dios y de nuestros padres')),
      set('couple.groom', P('Diego Márquez Cruz')),
      set('couple.bride', P('Ana Sofía Robles Herrera')),
      set('couple.groomPhoto', img('portrait-a.webp', '', { x: 0.5, y: 0.47 })),
      set('couple.bridePhoto', img('portrait-b.webp', '', { x: 0.5, y: 0.47 })),
      set('couple.groomText', R(
        'Ana, me enseñaste que la casa no es un lugar sino una persona.',
        'Gracias por decir que sí aquella noche en Valle de Bravo, con el frío calándonos y el café ya tibio.',
      )),
      set('couple.brideText', R(
        'Diego, contigo todo se volvió sencillo: los domingos, las mudanzas, los aeropuertos.',
        'Nos falta la mitad bonita de la vida y quiero pasarla contigo.',
      )),
    ],
  },
  {
    clientBatchId: 'seed-boda-03-familia',
    operations: [
      set('family.intro', L(
        'Con la bendición de quienes nos dieron la vida y nos enseñaron a querer,',
        'y acompañados por quienes han caminado a nuestro lado.',
      )),
      set('family.parentA1', P('Martha Elena Cruz de Márquez')),
      set('family.parentA2', P('Jorge Márquez Sandoval')),
      set('family.parentB1', P('Guadalupe Herrera de Robles')),
      set('family.parentB2', P('Fernando Robles Aguilar')),
      item('family.godparents', 'padrino-velacion', { person: P('Alicia Robles Herrera'), label: T('Velación') }),
      item('family.godparents', 'padrino-lazo', { person: P('Ricardo Márquez Cruz'), label: T('Lazo') }),
      item('family.godparents', 'padrino-anillos', { person: P('Sofía Beltrán Nava'), label: T('Anillos') }),
      item('family.godparents', 'padrino-arras', { person: P('Emiliano Robles Herrera'), label: T('Arras') }),
    ],
  },
  {
    clientBatchId: 'seed-boda-04-itinerario',
    operations: [
      set('event.title', T('El día')),
      item('event.cards', 'ev-ceremonia', {
        title: T('Ceremonia religiosa'),
        when: RANGO('2027-04-18T17:00', '2027-04-18T18:15'),
        place: LOC('Parroquia de San Juan Bautista', 'Jardín Centenario 8, Villa Coyoacán, Ciudad de México', 'https://maps.google.com/?q=Parroquia+de+San+Juan+Bautista+Coyoacan'),
        note: T('Te pedimos llegar 20 minutos antes'),
      }),
      item('event.cards', 'ev-coctel', {
        title: T('Cóctel de bienvenida'),
        when: RANGO('2027-04-18T19:30', '2027-04-18T20:30'),
        place: LOC('Hacienda de San Gabriel de las Palmas', 'Carretera Amacuzac–Cuernavaca km 3, Amacuzac, Morelos', 'https://maps.google.com/?q=Hacienda+San+Gabriel+de+las+Palmas'),
        note: T('En los jardines, junto al acueducto'),
      }),
      item('event.cards', 'ev-cena', {
        title: T('Recepción y cena'),
        when: RANGO('2027-04-18T20:30', '2027-04-18T22:30'),
        place: LOC('Hacienda de San Gabriel de las Palmas', 'Salón principal', 'https://maps.google.com/?q=Hacienda+San+Gabriel+de+las+Palmas'),
        note: T('Menú de tres tiempos; hay opción vegetariana'),
      }),
      item('event.cards', 'ev-baile', {
        title: T('Baile'),
        when: RANGO('2027-04-18T22:30', '2027-04-19T03:00'),
        place: LOC('Hacienda de San Gabriel de las Palmas', 'Terraza de los arcos'),
        note: T('Zapatos cómodos a partir de la medianoche'),
      }),
    ],
  },
  {
    clientBatchId: 'seed-boda-05-galeria-historia',
    operations: [
      set('gallery.title', T('Nuestros días')),
      set('gallery.intro', T('Seis láminas de la papelería que acompaña esta invitación.')),
      ...[1, 2, 3, 4, 5, 6].map((i) =>
        item('gallery.photos', `foto-${i}`, {
          image: img(`gallery-${i}.webp`, `Estudio botánico ${i} de la papelería de Ana Sofía y Diego`, { x: 0.5, y: 0.5 }),
        })),
      set('story.title', T('Cómo llegamos aquí')),
      item('story.milestones', 'hito-cafe', {
        title: T('Un café que duró seis horas'),
        date: D('2019-03-01'),
        body: R('Nos presentaron en la boda de unos amigos en Tepoztlán. Al día siguiente quedamos "para un café rápido" en la Roma y cerramos el lugar.'),
        image: img('story-1.webp', '', { x: 0.5, y: 0.5 }),
      }),
      item('story.milestones', 'hito-propuesta', {
        title: T('La pregunta'),
        date: D('2026-12-01'),
        body: R('En el mirador de Valle de Bravo, con la niebla subiendo del lago. Diego llevaba tres meses cargando el anillo en la mochila.'),
        image: img('story-2.webp', '', { x: 0.5, y: 0.5 }),
      }),
    ],
  },
  {
    clientBatchId: 'seed-boda-06-regalos-y-detalles',
    operations: [
      set('gifts.title', T('Mesa de regalos')),
      item('gifts.options', 'regalo-tienda', {
        kind: CH('store'),
        title: T('Liverpool'),
        detail: L('Evento núm. 51234567', 'A nombre de Ana Sofía Robles y Diego Márquez'),
        link: LINK('https://mesaderegalos.liverpool.com.mx/milistaderegalos/51234567', 'Ver la mesa en Liverpool'),
      }),
      item('gifts.options', 'regalo-banco', {
        kind: CH('bank'),
        title: T('Transferencia'),
        detail: L('BBVA México', 'Ana Sofía Robles Herrera', 'CLABE 012180001234567895'),
      }),
      item('gifts.options', 'regalo-sobres', {
        kind: CH('cash'),
        title: T('Lluvia de sobres'),
        detail: L('Habrá un buzón a la entrada del salón, junto al libro de firmas.'),
      }),
      set('suggestions.title', T('Dónde quedarse')),
      item('suggestions.items', 'hotel-hacienda', {
        name: T('Hotel Hacienda Vista Hermosa'),
        detail: L('A 10 minutos de la hacienda', 'Tarifa especial con el código ANAYDIEGO2027', 'Reservaciones al 777 123 4567'),
        link: LINK('https://maps.google.com/?q=Hotel+Hacienda+Vista+Hermosa+Morelos', 'Cómo llegar'),
      }),
      item('suggestions.items', 'hotel-amacuzac', {
        name: T('Posada Los Amates'),
        detail: L('En el centro de Amacuzac', 'Opción económica, ocho habitaciones'),
      }),
      set('amenities.title', T('Para que no te preocupes por nada')),
      item('amenities.items', 'amenidad-transporte', {
        name: T('Transporte redondo'),
        detail: L('Sale de la parroquia a las 18:15', 'Regresa a la Ciudad de México a las 2:00 y a las 3:30', 'Cupo limitado: indícalo al confirmar'),
      }),
      item('amenities.items', 'amenidad-ninos', {
        name: T('Área de niños'),
        detail: L('Con cuidadoras profesionales de 20:00 a 1:00', 'Cena y películas en el salón anexo'),
      }),
      set('dressCode.title', T('Código de vestimenta')),
      item('dressCode.rules', 'vestimenta-ellas', {
        title: T('Ellas'),
        detail: T('Vestido largo. Te pedimos reservar el blanco, el marfil y el beige para la novia.'),
        image: img('dress-a.webp', '', { x: 0.5, y: 0.45 }),
      }),
      item('dressCode.rules', 'vestimenta-ellos', {
        title: T('Ellos'),
        detail: T('Esmoquin o traje oscuro con corbata. La terraza es de piedra: evita el tacón de aguja.'),
        image: img('dress-b.webp', '', { x: 0.5, y: 0.45 }),
      }),
      set('rsvp.title', T('¿Nos acompañas?')),
      set('rsvp.deadline', D('2027-03-20')),
      set('rsvp.note', T('Confirma antes del 20 de marzo. Cada invitación indica el número de lugares apartados a tu nombre.')),
    ],
  },
];

process.stdout.write(JSON.stringify(lotes, null, 2) + '\n');
