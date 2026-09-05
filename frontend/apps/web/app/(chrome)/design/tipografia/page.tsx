import type { Metadata } from "next";

/**
 * `/design/tipografia` — especímenes de la escala tipográfica del chrome (fase 3-C, bloque 1,
 * 3C-2). `11 §2.2`: tres voces (`display`/`heading` en Fraunces, `text` en Onest, `label` en Red
 * Hat Mono), autoalojadas y NUNCA intercambiables entre sí (regla dura, `brief-comun.md`).
 *
 * Ruta independiente a propósito (brief 3c-2, ajuste 3 del orquestador): `app/(chrome)/design/**`
 * y su índice/layout los crea 3C-1 en paralelo. Ya integrados: el `layout.tsx` de `/design` aporta
 * el `<main>` y el marco `data-theme` conmutable, así que esta página empieza por `<section>` (un
 * documento tiene UN solo `<main>`) y toma el color de los tokens de ese marco.
 *
 * Clases: las tipográficas de `@invitaciones/ui/estilos.css` (`display-*`, `heading-*`, `text-*`,
 * `label-*`, `.prose`, `.numeros-tabulares`) — nunca las de tamaño `text-ui-*` del chrome antiguo
 * (`arte-chrome.md`) que este bloque sustituye. El COLOR, en cambio, sí sale de los tokens
 * (`text-ui-ink`, `text-ui-ink-muted`, `text-ui-ink-placeholder`, `border-ui-border`): con la
 * paleta escrita a mano (`text-neutral-*`) la página era ilegible en el tema oscuro de la galería
 * — 86 de 87 nodos de texto por debajo del umbral AA, la mayoría en 1,02-1,26:1, medido en
 * Chromium sobre la pila renderizada. Corrección del revisor 3c-rev-2.
 */
export const metadata: Metadata = {
  title: "Tipografía",
};

interface FilaEscala {
  readonly clase: string;
  readonly voz: "display" | "heading" | "text" | "label";
  readonly tamano: string;
  readonly peso: string;
  readonly muestra: string;
}

const ESCALA: readonly FilaEscala[] = [
  { clase: "display-2xl", voz: "display", tamano: "40 / 64", peso: "800", muestra: "Celebremos juntos" },
  { clase: "display-xl", voz: "display", tamano: "32 / 48", peso: "800", muestra: "Una invitación única" },
  { clase: "display-lg", voz: "display", tamano: "28 / 36", peso: "700", muestra: "El gran día se acerca" },
  { clase: "display-md", voz: "display", tamano: "24 / 28", peso: "700", muestra: "Guarda la fecha" },
  { clase: "display-sm", voz: "display", tamano: "20 / 22", peso: "700", muestra: "Nos vemos pronto" },
  { clase: "heading-lg", voz: "heading", tamano: "24 / 28", peso: "700", muestra: "Datos del evento" },
  { clase: "heading-md", voz: "heading", tamano: "20 / 22", peso: "700", muestra: "Confirma tu asistencia" },
  { clase: "heading-sm", voz: "heading", tamano: "17 / 18", peso: "700", muestra: "Preguntas frecuentes" },
  { clase: "text-lg", voz: "text", tamano: "18 / 18", peso: "450", muestra: "Nos encantaría contar contigo en este día tan especial." },
  { clase: "text-md", voz: "text", tamano: "16 / 16", peso: "450", muestra: "Recibirás la confirmación por correo en cuanto respondas." },
  { clase: "text-sm", voz: "text", tamano: "14 / 14", peso: "450", muestra: "El código de vestimenta es formal, colores tierra." },
  { clase: "text-xs", voz: "text", tamano: "13 / 13", peso: "450", muestra: "Tamaño mínimo de interfaz: pies de foto, ayudas de campo." },
  { clase: "label-lg", voz: "label", tamano: "14 / 14", peso: "500", muestra: "48 confirmados" },
  { clase: "label-md", voz: "label", tamano: "12 / 12", peso: "500", muestra: "Paso 2 de 4" },
  { clase: "label-sm", voz: "label", tamano: "11 / 11", peso: "500", muestra: "Borrador" },
];

const FAMILIA_POR_VOZ: Record<FilaEscala["voz"], string> = {
  display: "Fraunces",
  heading: "Fraunces",
  text: "Onest",
  label: "Red Hat Mono",
};

const PARRAFO_ES_MX =
  "El próximo sábado 14 de febrero nos reuniremos en el jardín de la hacienda para celebrar " +
  "quince años de Andrea Muñoz Íñiguez. Habrá música en vivo, piñata para los más pequeños y una " +
  "mesa de antojitos con salsas de distinto nivel de picor — desde la más suave hasta la que ni " +
  "el tío Naón se atreve a probar. Confírmanos tu asistencia antes del 1.º de febrero; si vienes " +
  "acompañado, indícalo al responder para reservarte lugar junto a la pista. ¡Aquí no caben las " +
  "disculpas por llegar tarde, pero sí los abrazos, el confeti y el «¡órale, qué bonito quedó todo!»."; // acentos, ñ, ¡!, «», número ordinal

export default function EspecimenesTipografia() {
  return (
    <section className="mx-auto max-w-4xl py-8 text-ui-ink">
      <header className="mb-16">
        <p className="label-md text-ui-ink-muted">Sistema de diseño · Tipografía</p>
        <h1 className="display-xl mt-3">Tres voces, una jerarquía</h1>
        <p className="text-lg mt-4 max-w-2xl text-ui-ink-muted">
          Fraunces para titular, Onest para leer, Red Hat Mono para orientar. Autoalojadas,
          subconjunto latino + latin-ext, sin depender de ningún servicio externo.
        </p>
      </header>

      {/* ─── Las tres voces ────────────────────────────────────────────────────────────────── */}
      <section aria-labelledby="voces" className="mb-16">
        <h2 id="voces" className="heading-md mb-6">
          Las tres voces
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <article className="rounded-2xl border border-ui-border p-6">
            <p className="label-sm text-ui-ink-muted">Display / heading</p>
            <p className="display-sm mt-3">Fraunces</p>
            <p className="text-sm mt-2 text-ui-ink-muted">
              Variable, ejes wght + opsz + SOFT + WONK. Cambia de carácter con el tamaño: juguetona
              a 64&nbsp;px, sobria a 18&nbsp;px.
            </p>
          </article>
          <article className="rounded-2xl border border-ui-border p-6">
            <p className="label-sm text-ui-ink-muted">Text</p>
            <p className="text-lg mt-3">Onest</p>
            <p className="text-sm mt-2 text-ui-ink-muted">
              Peso 450 de base (no 400): a 16&nbsp;px sobre papel hueso, 400 se ve fina. Negrita a 650.
            </p>
          </article>
          <article className="rounded-2xl border border-ui-border p-6">
            <p className="label-sm text-ui-ink-muted">Label</p>
            <p className="label-lg mt-3">Red Hat Mono</p>
            <p className="text-sm mt-2 text-ui-ink-muted">
              Mayúsculas con tracking positivo para eyebrows y pasos; minúsculas para metadatos y
              contadores.
            </p>
          </article>
        </div>
      </section>

      {/* ─── Escala completa ───────────────────────────────────────────────────────────────── */}
      <section aria-labelledby="escala" className="mb-16">
        <h2 id="escala" className="heading-md mb-2">
          Escala completa
        </h2>
        <p className="text-sm mb-6 text-ui-ink-muted">
          Tamaño en px, móvil 390 / escritorio 1024+ (`11 §2.2`). Redimensiona la ventana para ver
          el <code className="label-sm">clamp()</code>.
        </p>
        <dl className="divide-y divide-ui-border">
          {ESCALA.map((fila) => (
            <div key={fila.clase} className="grid grid-cols-1 gap-2 py-5 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-baseline sm:gap-6">
              <dt className="label-sm text-ui-ink-placeholder">
                {fila.clase}
                <span className="block text-ui-ink-placeholder">
                  {FAMILIA_POR_VOZ[fila.voz]} · {fila.tamano} px · {fila.peso}
                </span>
              </dt>
              <dd className={fila.clase}>{fila.muestra}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ─── Párrafo largo es-MX ───────────────────────────────────────────────────────────── */}
      <section aria-labelledby="parrafo" className="mb-16">
        <h2 id="parrafo" className="heading-md mb-6">
          Párrafo largo (es-MX)
        </h2>
        <div className="prose">
          <p>{PARRAFO_ES_MX}</p>
          <ul>
            <li>Confirma antes del 1.º de febrero.</li>
            <li>Indica acompañantes al responder.</li>
            <li>
              Dudas al <a href="#contacto">equipo de anfitriones</a>.
            </li>
          </ul>
        </div>
      </section>

      {/* ─── Números tabulares ─────────────────────────────────────────────────────────────── */}
      <section aria-labelledby="numeros" className="mb-16">
        <h2 id="numeros" className="heading-md mb-6">
          Números tabulares
        </h2>
        <div className="flex flex-wrap gap-8">
          <div>
            <p className="label-md text-ui-ink-muted">Confirmados</p>
            <p className="display-sm numeros-tabulares mt-1">128</p>
          </div>
          <div>
            <p className="label-md text-ui-ink-muted">Pendientes</p>
            <p className="display-sm numeros-tabulares mt-1">24</p>
          </div>
          <div>
            <p className="label-md text-ui-ink-muted">Días restantes</p>
            <p className="display-sm numeros-tabulares mt-1">07</p>
          </div>
        </div>
        <p className="text-sm numeros-tabulares mt-4 text-ui-ink-muted">
          11:11 · 03:07:42 · $1,280.00 MXN — los dígitos ocupan siempre el mismo ancho en columna.
        </p>
      </section>

      {/* ─── Pesos y tracking ──────────────────────────────────────────────────────────────── */}
      <section aria-labelledby="pesos" className="mb-16">
        <h2 id="pesos" className="heading-md mb-6">
          Pesos y tracking
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-ui-border p-6">
            <p className="label-sm text-ui-ink-muted mb-3">Onest — regular (450) / negrita (650)</p>
            <p className="text-lg">
              Confirma tu asistencia <strong>antes del viernes</strong> para reservar tu lugar.
            </p>
          </div>
          <div className="rounded-2xl border border-ui-border p-6">
            <p className="label-sm text-ui-ink-muted mb-3">Red Hat Mono — tracking +0.06em / +0.12em</p>
            <p className="label-lg">48 confirmados</p>
            <p className="label-md mt-2">Paso 2 de 4</p>
          </div>
        </div>
      </section>

      {/* ─── Jerarquía en una tarjeta ──────────────────────────────────────────────────────── */}
      <section aria-labelledby="tarjeta">
        <h2 id="tarjeta" className="heading-md mb-6">
          Jerarquía en una tarjeta
        </h2>
        <article className="max-w-sm rounded-3xl border border-ui-border p-8">
          <p className="label-md text-ui-ink-muted">Quince años</p>
          <h3 className="heading-lg mt-2">Andrea Muñoz Íñiguez</h3>
          <p className="text-sm mt-3 text-ui-ink-muted">
            Sábado 14 de febrero, 6:00 p.m. Jardín Los Encinos, Querétaro.
          </p>
          <p className="label-sm mt-6 text-ui-ink-placeholder">Confirma antes del 1.º de febrero</p>
        </article>
      </section>
    </section>
  );
}
