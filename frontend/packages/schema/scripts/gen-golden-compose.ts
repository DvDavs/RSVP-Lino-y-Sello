// packages/schema/scripts/gen-golden-compose.ts — golden/compose/<id>.case.json
//
// CIERRA LA OBJECIÓN O-10 de `bitacora/2-0a-REV.md`: "las ramas descubiertas de `compose.ts` no son
// irrelevantes, son REGLAS DE COMPOSICIÓN SIN PROBAR" — R8 entera, `orphanSections`, clave duplicada,
// variante desconocida, asset ausente del `AssetIndex`, 3 de los 6 `businessField`, 3 de los 5
// `formatId`, la medianoche de `h12`, los locales `es-ES`/`en-US` y los kinds `audio`/`time`/`boolean`.
// La revisión pedía explícitamente convertirlas en **casos golden, no en pruebas TS sueltas**: una
// prueba TS sube la cobertura de rama pero NO cruza a Kotlin, y por tanto no es cobertura de paridad.
//
// Cada caso lleva TODAS sus entradas en línea (paquete, documento, negocio, AssetIndex, locale) y la
// salida REAL de `compose()`. Kotlin ejecuta el mismo caso y compara canónicamente: si las dos
// implementaciones divergen en cualquiera de estas ramas, la prueba lo dice.
import { writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { TemplateManifest, ThemeSpec, DefaultsFile } from "../src/manifest.ts";
import type { InvitationDocument } from "../src/document.ts";
import type { AssetIndex, BusinessSnapshot } from "../src/composed.ts";
import type { Locale } from "../src/common.ts";
import { compose, type TemplatePackage } from "../src/compose.ts";
import {
  textSpec, richTextSpec, listTextSpec, imageSpec, audioSpec, dateSpec, timeSpec, dateTimeRangeSpec,
  linkSpec, locationSpec, choiceSpec, booleanSpec, personSpec, groupSpec, sectionSpec,
  themeFixture, manifestFixture, defaultsFixture, documentFixture, loc,
  textValue, richTextValue, listTextValue, imageValue, audioValue, dateValue, timeValue,
  dateTimeRangeValue, linkValue, locationValue, choiceValue, booleanValue, personValue,
  groupItem, groupValue, ulid, assetId,
} from "./fixtures.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT = HERE + "../golden/compose/";
mkdirSync(OUT, { recursive: true });
const write = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

const NEGOCIO_BASE: BusinessSnapshot = {
  invitationId: 7001, date: "2027-03-08", time: "19:05", hashtag: "#AnaYLuis",
  coverPhotoUrl: "https://cdn.invitaciones.evolutiondev.mx/legacy/portada.jpg",
  childrenAllowed: false, youngAllowed: true, eventKind: "wedding", planTier: 2,
  timezone: "America/Mexico_City",
};
const NEGOCIO_NULO: BusinessSnapshot = {
  ...NEGOCIO_BASE, date: null, time: null, hashtag: null, coverPhotoUrl: null,
  childrenAllowed: true, youngAllowed: false,
};

const A1 = assetId("photo1");
const A2 = assetId("photo2");
const AUDIO = assetId("sonido1");
const AUSENTE = assetId("ausente");
const ASSETS: AssetIndex = {
  [A1]: { url: "https://cdn.invitaciones.evolutiondev.mx/a/uno.webp", width: 1200, height: 800 },
  [A2]: { url: "https://cdn.invitaciones.evolutiondev.mx/a/dos.webp" },
  [AUDIO]: { url: "https://cdn.invitaciones.evolutiondev.mx/a/tres.mp3" },
};

type Caso = {
  name: string; descripcion: string;
  manifest: TemplateManifest; theme: ThemeSpec; defaults: DefaultsFile;
  documento: InvitationDocument; business: BusinessSnapshot; assets: AssetIndex; locale: Locale;
  compuesto: unknown; reporte: unknown;
};

const casos: Caso[] = [];
function caso(
  name: string, descripcion: string, pkg: TemplatePackage, documento: InvitationDocument,
  business: BusinessSnapshot, assets: AssetIndex, locale: Locale,
): void {
  const r = compose(pkg, documento, business, assets, locale);
  const dos = compose(pkg, documento, business, assets, locale);
  // R9: idempotencia comprobada EN LA GENERACIÓN, no solo en la prueba.
  if (JSON.stringify(r) !== JSON.stringify(dos)) throw new Error(`${name}: compose() no es idempotente`);
  casos.push({
    name, descripcion, manifest: pkg.manifest, theme: pkg.theme, defaults: pkg.defaults,
    documento, business, assets, locale, compuesto: r.composed, reporte: r.report,
  });
}

// ---------------------------------------------------------------------------------------------
// R8 — tema: paleta y tipografía elegidas o por defecto, con `themeFallback` (rama NUNCA ejercitada
// por los dos golden de `golden/templates/`, donde `themeFallback` es `null` en ambos).
// ---------------------------------------------------------------------------------------------
const temaDosPaletas = themeFixture({
  palettes: [
    { id: "olive", name: loc("Olivo"), tokens: { bg: "#FFFFFF", surface: "#F5F5F0", ink: "#222222", accent: "#556B2F", accentInk: "#FFFFFF", muted: "#999999" } },
    { id: "rosa", name: loc("Rosa"), tokens: { bg: "#FFF8F8", surface: "#FDEEEE", ink: "#3A2222", accent: "#B05A6A", accentInk: "#FFFFFF", muted: "#A08888" } },
  ],
  fontSets: [
    { id: "clasica", name: loc("Clásica"), heading: { family: "Playfair Display", weights: [400, 700], source: "bundled" }, body: { family: "Lora", weights: [400], source: "bundled" } },
    { id: "moderna", name: loc("Moderna"), heading: { family: "Inter", weights: [600], source: "bundled" }, body: { family: "Inter", weights: [400], source: "bundled" } },
  ],
  defaultPaletteId: "olive", defaultFontSetId: "clasica",
});
const mTema = manifestFixture([sectionSpec("cover", "cover", [textSpec("cover.title", "coverTitle")])]);
const pkgTema: TemplatePackage = { manifest: mTema, theme: temaDosPaletas, defaults: defaultsFixture(mTema, {}) };

caso("r8-fallback-de-paleta-y-fontset",
  "R8: la paleta y el fontSet del documento no existen en el tema → se cae a los por defecto y se registra themeFallback con AMBOS campos",
  pkgTema, documentFixture(mTema, temaDosPaletas, { paletteId: "no-existe", fontSetId: "tampoco" }),
  NEGOCIO_BASE, {}, "es-MX");

caso("r8-fallback-solo-de-paleta",
  "R8: solo la paleta falla; el fontSet elegido SÍ existe → themeFallback trae únicamente paletteId",
  pkgTema, documentFixture(mTema, temaDosPaletas, { paletteId: "no-existe", fontSetId: "moderna" }),
  NEGOCIO_BASE, {}, "es-MX");

caso("r8-sin-fallback-eligiendo-la-segunda",
  "R8: paleta y fontSet no por defecto pero declarados → themeFallback null y tokens de la SEGUNDA paleta",
  pkgTema, documentFixture(mTema, temaDosPaletas, { paletteId: "rosa", fontSetId: "moderna" }),
  NEGOCIO_BASE, {}, "es-MX");

// ---------------------------------------------------------------------------------------------
// R1 — estructura: sección huérfana, clave duplicada, variante desconocida, e inserción R1c.
// ---------------------------------------------------------------------------------------------
const mR1 = manifestFixture([
  sectionSpec("cover", "cover", [textSpec("cover.title", "coverTitle")], { variants: ["default", "alt"] }),
  sectionSpec("family", "family", [textSpec("family.intro", "familyIntro")]),
  sectionSpec("event", "event", [textSpec("event.title", "eventTitle")]),
  sectionSpec("footer", "footer", [textSpec("footer.note", "footerNote")], { required: true }),
]);
const temaR1 = themeFixture();
const pkgR1: TemplatePackage = { manifest: mR1, theme: temaR1, defaults: defaultsFixture(mR1, {}) };

caso("r1-huerfana-duplicada-y-variante-desconocida",
  "R1: clave de structure que el manifiesto no declara → orphanSections y NO se renderiza; clave repetida → gana la primera; variante desconocida → defaultVariant; sección required con visible:false → se fuerza true (I-17)",
  pkgR1,
  documentFixture(mR1, temaR1, {
    structure: { sections: [
      { key: "cover", variant: "no-declarada", visible: true },
      { key: "fantasma", variant: "default", visible: true },
      { key: "cover", variant: "alt", visible: false },
      { key: "footer", variant: "default", visible: false },
      { key: "event", variant: "default", visible: false },
    ] },
    content: { "zz.huerfano": textValue("clave que esta versión ya no declara") },
  }),
  NEGOCIO_BASE, {}, "es-MX");

caso("r1c-insercion-en-posicion-relativa-del-manifiesto",
  "R1c (ADR-1R-D-06): las secciones ausentes de doc.structure se insertan en su POSICIÓN RELATIVA del manifiesto, NUNCA al final. Manifiesto [cover,family,event,footer], documento [cover,event] → cover, family, event, footer. Anexar al final habría dejado `family` DESPUÉS del pie de página, que es el bug exacto que la ronda 1R detectó en xv-jardin",
  pkgR1,
  documentFixture(mR1, temaR1, {
    structure: { sections: [
      { key: "cover", variant: "default", visible: true },
      { key: "event", variant: "default", visible: true },
    ] },
  }),
  NEGOCIO_BASE, {}, "es-MX");

caso("r1c-insercion-con-el-orden-del-documento-invertido",
  "R1c, caso adversarial: el orden del ARRAY del documento manda sobre el del manifiesto (autoridad del cliente, R1). Manifiesto [cover,family,event,footer], documento [event,cover] → `family` entra detrás de `cover` (su último predecesor del manifiesto presente) y `footer` detrás de `event`, dando [event,footer,cover,family]. Es la lectura literal de R1c y fija que 'posición relativa' se resuelve contra el ORDEN YA CONSTRUIDO, no contra el índice del manifiesto",
  pkgR1,
  documentFixture(mR1, temaR1, {
    structure: { sections: [
      { key: "event", variant: "default", visible: true },
      { key: "cover", variant: "default", visible: true },
    ] },
  }),
  NEGOCIO_BASE, {}, "es-MX");

const mRequiredOculta = manifestFixture([
  sectionSpec("cover", "cover", [textSpec("cover.title", "coverTitle")], { required: true, defaultVisible: false }),
  sectionSpec("event", "event", [textSpec("event.title", "eventTitle")]),
]);
const pkgRequiredOculta: TemplatePackage = { manifest: mRequiredOculta, theme: temaR1, defaults: defaultsFixture(mRequiredOculta, {}) };

caso("r1c-required-con-defaultVisible-false",
  "HUECO CONOCIDO (registrado en preguntas-abiertas.md, 2-2): R1 fuerza visible:true sobre una sección `required` que ESTÁ en doc.structure (I-17), pero R1c inserta las ausentes con `spec.defaultVisible` tal cual (01 §5.3). Un manifiesto con required:true y defaultVisible:false produce una sección obligatoria invisible en cuanto el documento no la menciona, y ninguna invariante lo detecta porque I-17 solo mira doc.structure. Se congela el comportamiento actual para que Kotlin y TypeScript no diverjan mientras el dueño no decida",
  pkgRequiredOculta,
  documentFixture(mRequiredOculta, temaR1, {
    structure: { sections: [{ key: "event", variant: "default", visible: true }] },
  }),
  NEGOCIO_BASE, {}, "es-MX");

// ---------------------------------------------------------------------------------------------
// R2/R3/R5 — tres escalones, procedencia y asset ausente del AssetIndex.
// ---------------------------------------------------------------------------------------------
const mR2 = manifestFixture([
  sectionSpec("cover", "cover", [
    textSpec("cover.title", "coverTitle", { required: true }),          // valor de usuario
    textSpec("cover.subtitle", "coverSubtitle", { required: true }),    // solo default → stillDefault
    textSpec("cover.button", "coverButtonLabel", { required: true }),   // sin nada → missingRequired
    textSpec("cover.legal", "decorative", { source: "fixed" }),         // fixed → provenance "fixed"
    imageSpec("cover.image", "coverImage", { required: true }),         // asset AUSENTE del índice
    imageSpec("cover.bg", "coverBackground"),                           // asset presente
  ]),
]);
const pkgR2: TemplatePackage = {
  manifest: mR2, theme: temaR1,
  defaults: defaultsFixture(mR2, {
    "cover.subtitle": textValue("Nos casamos (texto de demostración)"),
    "cover.legal": textValue("Aviso fijo de la plantilla"),
  }),
};

caso("r2-tres-escalones-y-asset-ausente",
  "R2/R3/R5: user → default → empty; `fixed` solo puede venir de defaults; un assetId que NO está en el AssetIndex NO inventa URL: value null y provenance 'empty' (R5). missingRequired y stillDefault poblados; clave de content no declarada → orphanContent",
  pkgR2,
  documentFixture(mR2, temaR1, {
    content: {
      "cover.title": textValue("Ana & Luis"),
      "cover.image": imageValue(AUSENTE, { alt: "portada" }),
      "cover.bg": imageValue(A1, { alt: "fondo", x: 0.25, y: 0.75 }),
      "zz.borrado": textValue("huérfano"),
      "aa.borrado": textValue("otro huérfano"),
    },
  }),
  NEGOCIO_BASE, ASSETS, "es-MX");

// ---------------------------------------------------------------------------------------------
// R4 — negocio por rol: los SEIS businessField, con datos y con nulos.
// ---------------------------------------------------------------------------------------------
const mNegocio = manifestFixture([
  sectionSpec("event", "event", [
    dateSpec("biz.date", "eventDate", { source: "business", businessField: "invitation.date", formatId: "long", required: true }),
    timeSpec("biz.time", "eventTime", { source: "business", businessField: "invitation.time", formatId: "h12", required: true }),
    textSpec("biz.hashtag", "hashtag", { source: "business", businessField: "invitation.hashtag" }),
    imageSpec("biz.cover", "coverImage", { source: "business", businessField: "invitation.coverPhotoUrl" }),
    booleanSpec("biz.children", "rsvpChildrenAllowed", { source: "business", businessField: "invitation.childrenAllowed" }),
    booleanSpec("biz.young", "rsvpYoungAllowed", { source: "business", businessField: "invitation.youngAllowed" }),
  ]),
]);
const pkgNegocio: TemplatePackage = { manifest: mNegocio, theme: temaR1, defaults: defaultsFixture(mNegocio, {}) };

caso("r4-negocio-los-seis-campos",
  "R4: los SEIS businessField resueltos desde BusinessSnapshot, ignorando doc.content por completo (que aquí trae un valor competidor para biz.hashtag)",
  pkgNegocio, documentFixture(mNegocio, temaR1, { content: { "biz.hashtag": textValue("ESTO SE IGNORA") } }),
  NEGOCIO_BASE, {}, "es-MX");

caso("r4-negocio-con-nulos",
  "R4: date/time/hashtag/coverPhotoUrl nulos → provenance 'empty' y value null; los dos boolean SIEMPRE tienen valor. Los required nulos entran en missingRequired",
  pkgNegocio, documentFixture(mNegocio, temaR1, {}), NEGOCIO_NULO, {}, "es-MX");

// ---------------------------------------------------------------------------------------------
// R6 — formateo determinista: los cinco formatId y la medianoche de h12.
// ---------------------------------------------------------------------------------------------
const mFormato = manifestFixture([
  sectionSpec("event", "event", [
    dateSpec("f.long", "eventDate", { formatId: "long" }),
    dateSpec("f.monthYear", "storyDate", { formatId: "month-year" }),
    dateSpec("f.iso", "rsvpDeadline", { formatId: "iso" }),
    dateSpec("f.desconocido", "celebrantsDate", { formatId: "no-existe" }),
    timeSpec("f.medianoche", "eventTime", { formatId: "h12" }),
    timeSpec("f.mediodia", "coverDate", { formatId: "h12" }),
    dateTimeRangeSpec("f.rangoMismoDia", "eventWhen"),
    dateTimeRangeSpec("f.rangoOtroDia", "storyTitle"),
    dateTimeRangeSpec("f.rangoSinFin", "eventNote"),
  ]),
], { locales: ["es-MX", "es-ES", "en-US"] });
const pkgFormato: TemplatePackage = { manifest: mFormato, theme: temaR1, defaults: defaultsFixture(mFormato, {}) };
const contenidoFormato = {
  "f.long": dateValue("2027-01-31"),
  "f.monthYear": dateValue("2027-07-04"),
  "f.iso": dateValue("2027-12-25"),
  "f.desconocido": dateValue("2027-02-28"),
  "f.medianoche": timeValue("00:07"),
  "f.mediodia": timeValue("12:00"),
  "f.rangoMismoDia": dateTimeRangeValue("2027-05-01T16:00", "2027-05-01T23:30"),
  "f.rangoOtroDia": dateTimeRangeValue("2027-05-01T22:00", "2027-05-02T02:15"),
  "f.rangoSinFin": dateTimeRangeValue("2027-05-01T09:05"),
};

for (const l of ["es-MX", "es-ES", "en-US"] as const)
  caso(`r6-formatos-${l}`,
    `R6: los cinco formatId (long, month-year, iso, h12 y uno desconocido → long), la medianoche de h12 (H % 12 === 0 → 12) y las tres formas de formatRange, en ${l}. Sin Intl: tabla de meses literal (ICU difiere entre JVM y Node)`,
    pkgFormato, documentFixture(mFormato, temaR1, { content: contenidoFormato, locale: l }),
    NEGOCIO_BASE, {}, l);

const mFormatoCruzado = manifestFixture([
  sectionSpec("event", "event", [
    dateSpec("x.fechaConH12", "eventDate", { formatId: "h12" }),      // fecha con formato de hora
    timeSpec("x.horaConLong", "eventTime", { formatId: "long" }),     // hora con formato de fecha
    timeSpec("x.horaConMonthYear", "coverDate", { formatId: "month-year" }),
  ]),
]);
const pkgFormatoCruzado: TemplatePackage = { manifest: mFormatoCruzado, theme: temaR1, defaults: defaultsFixture(mFormatoCruzado, {}) };

caso("r6-formato-cruzado-devuelve-el-valor-crudo",
  "R6, guarda de paridad: `formatId` es un `Ident` libre, así que un DateSpec puede declarar formatId 'h12' y un TimeSpec 'long' con datos perfectamente válidos. Sin guarda, JavaScript producía 'NaN:undefined pm' y Kotlin lanzaría NumberFormatException sobre el MISMO documento. Los tres formateadores devuelven el valor crudo cuando la entrada no tiene la forma que ese formato espera",
  pkgFormatoCruzado,
  documentFixture(mFormatoCruzado, temaR1, {
    content: {
      "x.fechaConH12": dateValue("2027-01-31"),
      "x.horaConLong": timeValue("13:45"),
      "x.horaConMonthYear": timeValue("07:00"),
    },
  }),
  NEGOCIO_BASE, {}, "es-MX");

// ---------------------------------------------------------------------------------------------
// R7 — grupos: usuario, default, vacío y merge por (grupo, itemId, itemBlockId).
// ---------------------------------------------------------------------------------------------
const mGrupos = manifestFixture([
  sectionSpec("event", "event", [
    groupSpec("g.usuario", "eventCards", [textSpec("title", "eventTitle"), imageSpec("image", "decorative"), textSpec("nota", "eventNote")]),
    groupSpec("g.default", "giftOptions", [textSpec("title", "giftOptionTitle")], { required: true }),
    groupSpec("g.vacio", "galleryPhotos", [imageSpec("photo", "galleryPhoto")], { required: true }),
  ]),
]);
const pkgGrupos: TemplatePackage = {
  manifest: mGrupos, theme: temaR1,
  defaults: defaultsFixture(mGrupos, {
    "g.default": groupValue([groupItem(ulid("demo1"), { title: textValue("Regalo de demostración") })]),
  }),
};

caso("r7-grupos-usuario-default-y-vacio",
  "R7: el orden de los ítems es el del array de doc.content; el orden de los bloques DENTRO del ítem lo fija el spec, no el JSON; un itemBlock sin valor es 'empty' aunque el grupo sea 'user'; el escalón de default opera a nivel de GRUPO COMPLETO, nunca por ítem (mezclarlo resucitaría H-02); grupo required vacío → missingRequired; grupo required que sigue en default → stillDefault",
  pkgGrupos,
  documentFixture(mGrupos, temaR1, {
    content: {
      "g.usuario": groupValue([
        groupItem(ulid("item2"), { nota: textValue("segunda tarjeta"), title: textValue("Recepción") }),
        groupItem(ulid("item1"), { title: textValue("Ceremonia"), image: imageValue(A2, { alt: "iglesia" }) }),
      ]),
    },
  }),
  NEGOCIO_BASE, ASSETS, "es-MX");

// ---------------------------------------------------------------------------------------------
// Los 13 kinds escalares resueltos, incluidos `audio`, `time` y `boolean` de usuario.
// ---------------------------------------------------------------------------------------------
const mKinds = manifestFixture([
  sectionSpec("cover", "cover", [
    textSpec("k.text", "coverTitle"),
    richTextSpec("k.richText", "storyBody"),
    listTextSpec("k.listText", "dressCodeDetail"),
    imageSpec("k.image", "coverImage"),
    audioSpec("k.audio", "backgroundMusic"),
    dateSpec("k.date", "coverDate"),
    timeSpec("k.time", "eventTime"),
    dateTimeRangeSpec("k.range", "eventWhen"),
    linkSpec("k.link", "footerLink"),
    linkSpec("k.linkSinLabel", "hashtagLink"),
    locationSpec("k.location", "eventPlace"),
    locationSpec("k.locationMinima", "eventLocationNote"),
    choiceSpec("k.choice", "hashtagPlatform", [{ id: "instagram", label: "Instagram" }, { id: "tiktok", label: "TikTok" }]),
    choiceSpec("k.choiceDesconocida", "giftOptionKind", [{ id: "sobre", label: "Sobre" }]),
    booleanSpec("k.boolean", "personPhotoVisible"),
    personSpec("k.person", "parentA1"),
    personSpec("k.personSinNota", "parentA2"),
  ]),
]);
const pkgKinds: TemplatePackage = { manifest: mKinds, theme: temaR1, defaults: defaultsFixture(mKinds, {}) };

caso("kinds-los-trece-escalares",
  "resolveScalar sobre los 13 kinds, incluidos audio/time/boolean de usuario y las variantes con campo opcional ausente (link sin label, location sin address/mapHref, person sin note). `choice` con optionId fuera de options: la etiqueta cae al propio optionId y se registra I-02 en invalidValues",
  pkgKinds,
  documentFixture(mKinds, temaR1, {
    content: {
      "k.text": textValue("Ana & Luis"),
      "k.richText": richTextValue(["Primer párrafo.", "", "Tercer párrafo."]),
      "k.listText": listTextValue(["Formal", "Colores tierra"]),
      "k.image": imageValue(A1, { alt: "portada", x: 0.5, y: 0.25 }),
      "k.audio": audioValue(AUDIO),
      "k.date": dateValue("2027-09-18"),
      "k.time": timeValue("13:45"),
      "k.range": dateTimeRangeValue("2027-09-18T18:00", "2027-09-18T23:00"),
      "k.link": linkValue("https://ejemplo.mx/mapa", "Cómo llegar"),
      "k.linkSinLabel": linkValue("https://ejemplo.mx/insta"),
      "k.location": locationValue("Hacienda El Olivo", { address: "Camino Real 12", mapHref: "https://maps.example.com/olivo" }),
      "k.locationMinima": locationValue("Jardín trasero"),
      "k.choice": choiceValue("tiktok"),
      "k.choiceDesconocida": choiceValue("transferencia"),
      "k.boolean": booleanValue(true),
      "k.person": personValue("Ana Ruiz", "madrina"),
      "k.personSinNota": personValue("Luis Paz"),
    },
  }),
  NEGOCIO_BASE, ASSETS, "es-MX");

// ---------------------------------------------------------------------------------------------
// O-12 — `invalidValues`: un valor presente pero inválido para su spec deja rastro en el informe.
// ---------------------------------------------------------------------------------------------
const mInvalidos = manifestFixture([
  sectionSpec("cover", "cover", [
    textSpec("v.corto", "coverTitle", { maxLength: 5 }),
    textSpec("v.unaLinea", "coverSubtitle", { multiline: false }),
    listTextSpec("v.lista", "dressCodeDetail", { maxItems: 2 }),
    dateTimeRangeSpec("v.rango", "eventWhen"),
    choiceSpec("v.choice", "hashtagPlatform", [{ id: "instagram" }]),
    groupSpec("v.grupo", "eventCards", [textSpec("title", "eventTitle")], { min: 2, max: 4 }),
    textSpec("v.dosCodigos", "coverButtonLabel", { maxLength: 5, multiline: false }),
    groupSpec("v.escalarEnGrupo", "galleryPhotos", [textSpec("title", "galleryIntro")]),
  ]),
]);
const pkgInvalidos: TemplatePackage = { manifest: mInvalidos, theme: temaR1, defaults: defaultsFixture(mInvalidos, {}) };

caso("o12-invalid-values",
  "O-12: valores presentes pero inválidos contra su spec (I-16, I-30, I-04, I-01, I-02) se registran en report.invalidValues, ordenados por blockId y luego por código. `composed` NO cambia: el valor se sigue resolviendo igual; lo único que cambia es que el informe lo dice, que es lo que `TPL_PUBLISH_BLOCKED_INVALID_VALUES` (03 §5) necesita para bloquear la publicación",
  pkgInvalidos,
  documentFixture(mInvalidos, temaR1, {
    content: {
      "v.corto": textValue("texto demasiado largo"),
      "v.unaLinea": textValue("dos\nlíneas"),
      "v.lista": listTextValue(["a", "b", "c"]),
      "v.rango": dateTimeRangeValue("2027-05-02T10:00", "2027-05-01T10:00"),
      "v.choice": choiceValue("no-declarada"),
      "v.grupo": groupValue([groupItem(ulid("solo1"), { title: textValue("único") })]),
      // Un mismo blockId con DOS códigos: fija el desempate por código del orden de R9.
      "v.dosCodigos": textValue("demasiado largo\ny con salto"),
      // Un escalar guardado bajo un spec `group`: hoy desaparecía sin traza (I-15).
      "v.escalarEnGrupo": textValue("no soy un grupo"),
    },
  }),
  NEGOCIO_BASE, {}, "es-MX");

// ---------------------------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------------------------
for (const f of readdirSync(OUT)) if (f.endsWith(".case.json")) rmSync(OUT + f);
const vistos = new Set<string>();
for (const c of casos) {
  if (vistos.has(c.name)) throw new Error(`caso duplicado: ${c.name}`);
  vistos.add(c.name);
  write(OUT + `${c.name}.case.json`, c);
}
console.log(`golden/compose: ${casos.length} casos de las reglas R1-R9 (O-10 cerrada como paridad, no como cobertura TS)`);
