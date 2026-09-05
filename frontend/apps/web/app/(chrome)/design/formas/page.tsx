"use client";

// apps/web/app/(chrome)/design/formas/page.tsx — galería viva de la biblioteca de formas
// (`@invitaciones/ui/shapes`, bloque 3C-4). Ruta interna `/design/formas` (`11 §8.1`).
//
// Qué hay aquí: las once formas con sus parámetros manipulables, las cinco máscaras de foto, las
// ocho reglas de composición de `11 §3.4` y los cinco ejemplos de composición que las aplican.
//
// Integración (orquestador 3-C): los tokens provisionales de la vista previa se retiraron al fusionar
// 3C-1; `shapes.css` llega por `@invitaciones/ui/estilos.css` desde `globals.css`.
import { useId, useState } from "react";
import {
  Blob,
  ColorShadow,
  Composition,
  Image,
  MASCARAS,
  Pill,
  Placeholder,
  Rays,
  RotatedSquare,
  Seal,
  Stripes,
  Triangle,
  WaveDivider,
  type Mascara,
  type PerfilOnda,
} from "@invitaciones/ui";

/* ───────────────────────────────────────────────────────── estilos de galería ── */

const ESTILOS = `
.gf-pagina {
  background: var(--ui-surface);
  color: var(--ui-ink);
  font-family: var(--ui-font-text);
  min-height: 100vh;
  padding: 0 0 96px;
}
.gf-ancho { max-width: var(--ui-content-max); margin: 0 auto; padding-inline: var(--ui-gutter); }
.gf-cabecera { padding: 56px 0 32px; }
.gf-eyebrow {
  display: inline-block;
  font-family: var(--ui-font-label, var(--ui-font-text));
  font-size: var(--ui-text-xs);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ui-on-primary-soft);
  background: var(--ui-primary-soft);
  border-radius: var(--ui-radius-pill);
  padding: 6px 14px;
}
.gf-pagina h1 {
  font-family: var(--ui-font-display);
  font-weight: 800;
  font-size: clamp(32px, 6vw, 56px);
  line-height: 1.05;
  letter-spacing: -0.02em;
  margin: 20px 0 12px;
}
.gf-pagina h2 {
  font-family: var(--ui-font-display);
  font-weight: 700;
  font-size: clamp(24px, 3.4vw, 34px);
  line-height: 1.15;
  letter-spacing: -0.01em;
  margin: 0 0 8px;
}
.gf-pagina h3 {
  font-family: var(--ui-font-display);
  font-weight: 700;
  font-size: 18px;
  line-height: 1.25;
  margin: 14px 0 4px;
}
.gf-pagina p { margin: 0 0 12px; line-height: 1.55; color: var(--ui-ink-muted); }
.gf-intro { max-width: 68ch; font-size: 17px; }
.gf-aviso {
  border: 2px solid var(--ui-support-1);
  background: var(--ui-support-1-soft);
  color: var(--ui-support-1-deep);
  border-radius: var(--ui-radius-md);
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.5;
  max-width: 80ch;
}
.gf-seccion { padding-top: 56px; }
.gf-seccion > header { margin-bottom: 24px; max-width: 72ch; }
.gf-rejilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 24px;
}
.gf-tarjeta {
  background: var(--ui-surface-raised);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-shadow-1);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.gf-lienzo {
  aspect-ratio: 4 / 3;
  border-radius: var(--ui-radius-md);
  overflow: hidden;
  background: var(--ui-surface-alt);
  display: grid;
  place-items: stretch;
}
.gf-lienzo--claro { background: var(--ui-surface-raised); }
.gf-lienzo--centrado { display: grid; place-items: center; padding: 18px; }
.gf-lienzo--onda { display: flex; flex-direction: column; justify-content: flex-end; background: var(--ui-primary-soft); }
.gf-codigo {
  font-family: var(--ui-font-label, var(--ui-font-text));
  font-size: var(--ui-text-xs);
  line-height: 1.5;
  background: var(--ui-surface-alt);
  color: var(--ui-on-primary-soft);
  border-radius: var(--ui-radius-sm);
  padding: 8px 10px;
  margin-top: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.gf-controles { display: flex; flex-direction: column; gap: 10px; padding: 4px 0 12px; }
.gf-control { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px 12px; }
.gf-control > span {
  font-family: var(--ui-font-label, var(--ui-font-text));
  font-size: var(--ui-text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ui-ink-muted);
}
.gf-control > b { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 14px; }
.gf-control > input, .gf-control > select { grid-column: 1 / -1; }

/* Controles con aspecto propio: nada nativo sin estilar (10 §1.6). */
.gf-pagina input[type="range"] {
  appearance: none;
  width: 100%;
  height: 22px;
  background: transparent;
  cursor: pointer;
}
.gf-pagina input[type="range"]::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: var(--ui-radius-pill);
  background: var(--ui-divider);
}
.gf-pagina input[type="range"]::-moz-range-track {
  height: 6px;
  border-radius: var(--ui-radius-pill);
  background: var(--ui-divider);
}
.gf-pagina input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  margin-top: -7px;
  border-radius: 50%;
  background: var(--ui-primary);
  border: 3px solid var(--ui-surface-raised);
  box-shadow: 0 1px 3px rgb(41 32 24 / 0.3);
}
.gf-pagina input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--ui-primary);
  border: 3px solid var(--ui-surface-raised);
}
.gf-pagina select {
  appearance: none;
  width: 100%;
  font: inherit;
  font-size: 14px;
  color: var(--ui-ink);
  background: var(--ui-surface-raised);
  border: 2px solid var(--ui-border);
  border-radius: var(--ui-radius-sm);
  padding: 9px 34px 9px 12px;
  min-height: 44px;
  cursor: pointer;
}
.gf-pagina .gf-select { position: relative; }
.gf-pagina .gf-select::after {
  content: "";
  position: absolute;
  right: 14px;
  top: 50%;
  width: 9px;
  height: 9px;
  border-right: 2px solid var(--ui-ink-muted);
  border-bottom: 2px solid var(--ui-ink-muted);
  transform: translateY(-70%) rotate(45deg);
  pointer-events: none;
}
.gf-pagina :focus-visible {
  outline: 3px solid var(--ui-focus);
  outline-offset: 2px;
  border-radius: 4px;
}

.gf-reglas { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 16px; }
.gf-regla {
  background: var(--ui-surface-raised);
  border-left: 4px solid var(--ui-primary);
  border-radius: var(--ui-radius-md);
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-ink-muted);
}
.gf-regla b { display: block; color: var(--ui-ink); font-size: 15px; margin-bottom: 4px; }

.gf-ejemplos { display: grid; gap: 32px; }
.gf-ejemplo > figcaption { font-size: 14px; line-height: 1.55; color: var(--ui-ink-muted); margin-top: 10px; max-width: 76ch; }
.gf-ejemplo > figcaption b { color: var(--ui-ink); }

.gf-heroe { border-radius: var(--ui-radius-xl); min-height: 340px; padding: 28px; }
.gf-heroe-rejilla { display: grid; gap: 24px; align-items: center; grid-template-columns: 1fr; }
@media (min-width: 720px) { .gf-heroe-rejilla { grid-template-columns: 1.1fr 0.9fr; } }
.gf-papel {
  background: var(--ui-surface-raised);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-shadow-2);
  padding: 22px 24px;
}
.gf-papel h3 { margin-top: 0; font-size: clamp(24px, 4vw, 34px); }
.gf-papel p { margin-bottom: 0; }
.gf-acciones { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 18px; }
.gf-boton {
  font: inherit;
  font-weight: 600;
  border: 2px solid transparent;
  border-radius: var(--ui-radius-pill);
  padding: 12px 22px;
  min-height: 46px;
  background: var(--ui-primary);
  color: var(--ui-on-primary);
  cursor: pointer;
  transition: background var(--ui-dur-1) var(--ui-ease-out);
}
.gf-boton:hover { background: var(--ui-primary-hover); }
.gf-boton--secundario { background: transparent; color: var(--ui-primary); border-color: var(--ui-primary); }

.gf-tarjeta-destacada { max-width: 380px; padding: 18px; display: grid; gap: 14px; }
.gf-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.gf-lista li {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--ui-surface-raised);
  border: 2px solid var(--ui-divider);
  border-radius: var(--ui-radius-md);
  padding: 12px 14px;
  font-size: 15px;
  color: var(--ui-ink);
}
.gf-panel { background: var(--ui-surface-raised); border-radius: var(--ui-radius-lg); box-shadow: var(--ui-shadow-1); padding: 20px; }
.gf-banda { min-height: 220px; padding: 28px; display: grid; align-content: center; }
.gf-testimonio { min-height: 300px; display: grid; place-items: center; padding: 32px 20px; }
.gf-testimonio blockquote {
  margin: 0;
  max-width: 46ch;
  background: var(--ui-surface-raised);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-shadow-2);
  padding: 24px;
  text-align: center;
}
.gf-testimonio blockquote p { font-family: var(--ui-font-display); font-size: 20px; color: var(--ui-ink); line-height: 1.35; }
.gf-testimonio footer { font-size: 14px; color: var(--ui-ink-muted); }
.gf-medallon {
  width: 76px;
  height: 76px;
  display: grid;
  place-items: center;
  position: relative;
  margin: 0 auto 14px;
}
.gf-medallon > svg:first-child { position: absolute; inset: 0; }
.gf-medallon > svg:last-child { position: relative; width: 34px; height: 34px; }
.gf-seccion-onda { border-radius: var(--ui-radius-xl); overflow: hidden; }
`;

/* ────────────────────────────────────────────────────────────────── piezas ── */

/** Icono `chispa` del moodboard (`partes/05-iconos.html`), copiado sin retocar.
 *  TODO(3C-integración): sustituir por `<ChispaIcon />` de `@invitaciones/icons`. */
function IconoChispa() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ui-primary)"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        fill="var(--ui-accent-soft)"
        stroke="none"
        d="M12 3 C12.7 8.2 15.8 11.3 21 12 C15.8 12.7 12.7 15.8 12 21 C11.3 15.8 8.2 12.7 3 12 C8.2 11.3 11.3 8.2 12 3 Z"
      />
      <path d="M12 3 C12.7 8.2 15.8 11.3 21 12 C15.8 12.7 12.7 15.8 12 21 C11.3 15.8 8.2 12.7 3 12 C8.2 11.3 11.3 8.2 12 3 Z" />
      <circle cx="19" cy="5" r="1.1" fill="var(--ui-primary)" stroke="none" />
    </svg>
  );
}

function Deslizador({
  etiqueta,
  valor,
  min,
  max,
  paso = 1,
  alCambiar,
}: {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  paso?: number;
  alCambiar: (v: number) => void;
}) {
  const id = useId();
  return (
    <label className="gf-control" htmlFor={id}>
      <span>{etiqueta}</span>
      <b>{valor}</b>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        onChange={(e) => alCambiar(Number(e.target.value))}
      />
    </label>
  );
}

function Selector<T extends string>({
  etiqueta,
  valor,
  opciones,
  alCambiar,
}: {
  etiqueta: string;
  valor: T;
  opciones: readonly T[];
  alCambiar: (v: T) => void;
}) {
  const id = useId();
  return (
    <label className="gf-control" htmlFor={id}>
      <span>{etiqueta}</span>
      <b>{valor}</b>
      <span className="gf-select">
        <select id={id} value={valor} onChange={(e) => alCambiar(e.target.value as T)}>
          {opciones.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function Ficha({
  titulo,
  descripcion,
  codigo,
  lienzo,
  controles,
  children,
}: {
  titulo: string;
  descripcion: string;
  codigo: string;
  lienzo?: string;
  controles?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="gf-tarjeta">
      <div className={`gf-lienzo ${lienzo ?? ""}`}>{children}</div>
      <h3>{titulo}</h3>
      <p>{descripcion}</p>
      {controles ? <div className="gf-controles">{controles}</div> : null}
      <code className="gf-codigo">{codigo}</code>
    </article>
  );
}

const REGLAS: readonly (readonly [string, string])[] = [
  ["1. Una protagonista por bloque", "Como máximo una forma protagonista por sección o tarjeta; la segunda va en un paso -soft, ocupa menos del 30 % del área y no toca a la primera."],
  ["2. Contraste de matiz forma/fondo", "La forma nunca comparte matiz con su fondo, salvo los rayos, que son dos pasos del mismo matiz por definición."],
  ["3. La forma nunca compite con el texto", "Solo detrás de un título display o de una foto; nunca bajo un párrafo, un campo o un botón. Composition recorta al bloque."],
  ["4. Fotos siempre con máscara", "Radio ≥ 24 px o una de las cinco máscaras. Sin foto, el placeholder del sistema y la nota en imagenes-pendientes.md."],
  ["5. Texto nunca sobre foto", "La legibilidad se resuelve por separación: papel opaco, banda o tarjeta. Nunca velo, degradado ni text-shadow."],
  ["6. El 500 es decorativo", "primary-bright solo vive en formas grandes; el texto va en 600-900 y las superficies en 50-200."],
  ["7. Movimiento", "Solo breathe y drift, solo en formas de fondo y como máximo una por vista. prefers-reduced-motion los apaga en shapes.css."],
  ["8. Sombra de color: una por vista", "Y nunca mezclada con la sombra difusa en el mismo elemento. El editor no lleva formas decorativas."],
];

/* ──────────────────────────────────────────────────────────────── la página ── */

export default function GaleriaDeFormas() {
  const [rayos, setRayos] = useState({ density: 12, radius: 160 });
  const [rayas, setRayas] = useState({ angle: -24, gap: 18, width: 9 });
  const [onda, setOnda] = useState<{ profile: PerfilOnda; layers: 1 | 2 }>({ profile: "suave", layers: 1 });
  const [blob, setBlob] = useState({ seed: 7, points: 7, amplitude: 22 });
  const [triangulo, setTriangulo] = useState({ rotate: -8, radius: 12 });
  const [cuadrado, setCuadrado] = useState({ rotate: 12 });
  const [sello, setSello] = useState({ points: 12, amplitude: 4 });
  const [mascara, setMascara] = useState<Mascara>("seal");
  const [semilla, setSemilla] = useState(31);

  return (
    <div className="gf-pagina">
      <style>{ESTILOS}</style>

      <header className="gf-ancho gf-cabecera">
        <span className="gf-eyebrow">Sistema de diseño · formas</span>
        <h1>Papel picado, no clipart.</h1>
        <p className="gf-intro">
          Las once formas de <code>@invitaciones/ui/shapes</code> son el recurso de composición del producto. Todas
          salen en SVG en línea, sin un solo color propio (el color viene de los tokens
          <code> --ui-*</code>), y todo lo que parece aleatorio deriva de una <code>seed</code>: el mismo número da el
          mismo dibujo en el servidor y en el navegador.
        </p>
      </header>

      <section className="gf-ancho gf-seccion" aria-labelledby="catalogo">
        <header>
          <h2 id="catalogo">Catálogo</h2>
          <p>Cada ficha dibuja el componente de verdad; los controles cambian sus props en caliente.</p>
        </header>

        <div className="gf-rejilla">
          <Ficha
            titulo="Rayos radiales"
            descripcion="Cuñas alternas de dos pasos del mismo matiz. Fondo de héroe, de testimonio y de banda de publicación. Respiran 12 s."
            codigo={`<Rays tone="primary-soft" density={${rayos.density}} radius={${rayos.radius}} breathe />`}
            controles={
              <>
                <Deslizador etiqueta="density" valor={rayos.density} min={6} max={20} alCambiar={(v) => setRayos((r) => ({ ...r, density: v }))} />
                <Deslizador etiqueta="radius" valor={rayos.radius} min={60} max={200} paso={10} alCambiar={(v) => setRayos((r) => ({ ...r, radius: v }))} />
              </>
            }
          >
            <Rays density={rayos.density} radius={rayos.radius} tone="primary-soft" backdrop="surface-alt" breathe />
          </Ficha>

          <Ficha
            titulo="Rayas"
            descripcion="Franjas de un solo tono. Fondo de banda; nunca detrás de texto de cuerpo."
            codigo={`<Stripes tone="support-2-soft" angle={${rayas.angle}} gap={${rayas.gap}} width={${rayas.width}} />`}
            lienzo="gf-lienzo--claro"
            controles={
              <>
                <Deslizador etiqueta="angle" valor={rayas.angle} min={-90} max={90} paso={3} alCambiar={(v) => setRayas((r) => ({ ...r, angle: v }))} />
                <Deslizador etiqueta="gap" valor={rayas.gap} min={8} max={40} alCambiar={(v) => setRayas((r) => ({ ...r, gap: v }))} />
                <Deslizador etiqueta="width" valor={rayas.width} min={2} max={rayas.gap} alCambiar={(v) => setRayas((r) => ({ ...r, width: v }))} />
              </>
            }
          >
            <Stripes angle={rayas.angle} gap={rayas.gap} width={rayas.width} tone="support-2-soft" backdrop="surface-raised" />
          </Ficha>

          <Ficha
            titulo="Onda"
            descripcion="Divisor de sección. Tres perfiles fijos y una o dos capas: no se admite un path libre, para que todas las ondas del producto sean la misma familia."
            codigo={`<WaveDivider profile="${onda.profile}" layers={${onda.layers}} from="primary-soft" to="surface" />`}
            lienzo="gf-lienzo--onda"
            controles={
              <>
                <Selector etiqueta="profile" valor={onda.profile} opciones={["suave", "marcada", "doble"] as const} alCambiar={(v) => setOnda((o) => ({ ...o, profile: v }))} />
                <Selector etiqueta="layers" valor={String(onda.layers) as "1" | "2"} opciones={["1", "2"] as const} alCambiar={(v) => setOnda((o) => ({ ...o, layers: Number(v) as 1 | 2 }))} />
              </>
            }
          >
            <WaveDivider profile={onda.profile} layers={onda.layers} from="primary-soft" to="surface-raised" tones={["support-1-soft"]} height={90} />
          </Ficha>

          <Ficha
            titulo="Blob orgánico"
            descripcion="Determinista por seed (mulberry32 → puntos polares → Catmull-Rom): el mismo número da el mismo blob en servidor y en cliente."
            codigo={`<Blob seed={${blob.seed}} points={${blob.points}} amplitude={${(blob.amplitude / 100).toFixed(2)}} tone="support-2-soft" />`}
            lienzo="gf-lienzo--centrado gf-lienzo--claro"
            controles={
              <>
                <Deslizador etiqueta="seed" valor={blob.seed} min={1} max={60} alCambiar={(v) => setBlob((b) => ({ ...b, seed: v }))} />
                <Deslizador etiqueta="points" valor={blob.points} min={5} max={12} alCambiar={(v) => setBlob((b) => ({ ...b, points: v }))} />
                <Deslizador etiqueta="amplitude ×100" valor={blob.amplitude} min={4} max={38} alCambiar={(v) => setBlob((b) => ({ ...b, amplitude: v }))} />
              </>
            }
          >
            <Blob seed={blob.seed} points={blob.points} amplitude={blob.amplitude / 100} tone="support-2-soft" breathe />
          </Ficha>

          <Ficha
            titulo="Triángulo"
            descripcion="Detrás de una foto o de una tarjeta, girado entre -12° y 12°, en matiz distinto del fondo y del elemento que sostiene."
            codigo={`<Triangle tone="accent" rotate={${triangulo.rotate}} radius={${triangulo.radius}} />`}
            lienzo="gf-lienzo--centrado"
            controles={
              <>
                <Deslizador etiqueta="rotate" valor={triangulo.rotate} min={-20} max={20} alCambiar={(v) => setTriangulo((t) => ({ ...t, rotate: v }))} />
                <Deslizador etiqueta="radius" valor={triangulo.radius} min={0} max={30} alCambiar={(v) => setTriangulo((t) => ({ ...t, radius: v }))} />
              </>
            }
          >
            <Triangle tone="accent" rotate={triangulo.rotate} radius={triangulo.radius} />
          </Ficha>

          <Ficha
            titulo="Cuadrado rotado"
            descripcion="El único sitio del paso 500 (primary-bright): decorativo, grande y nunca con texto encima. El lado se inscribe para que el giro no lo saque del bloque."
            codigo={`<RotatedSquare tone="primary-bright" rotate={${cuadrado.rotate}} radius="md" />`}
            lienzo="gf-lienzo--centrado gf-lienzo--claro"
            controles={
              <Deslizador etiqueta="rotate" valor={cuadrado.rotate} min={-45} max={45} alCambiar={(v) => setCuadrado({ rotate: v })} />
            }
          >
            <RotatedSquare tone="primary-bright" rotate={cuadrado.rotate} radius="md" />
          </Ficha>

          <Ficha
            titulo="Sello festoneado"
            descripcion="r(θ) = R + a·cos(nθ) muestreado a 240 pasos. Fondo de insignia, de estado vacío y de icono grande; también máscara de foto."
            codigo={`<Seal points={${sello.points}} amplitude={${sello.amplitude}} tone="primary-soft" />`}
            lienzo="gf-lienzo--centrado gf-lienzo--claro"
            controles={
              <>
                <Deslizador etiqueta="points" valor={sello.points} min={6} max={20} alCambiar={(v) => setSello((s) => ({ ...s, points: v }))} />
                <Deslizador etiqueta="amplitude" valor={sello.amplitude} min={1} max={9} alCambiar={(v) => setSello((s) => ({ ...s, amplitude: v }))} />
              </>
            }
          >
            <Seal points={sello.points} amplitude={sello.amplitude} tone="primary-soft" breathe />
          </Ficha>

          <Ficha
            titulo="Píldora"
            descripcion="La única forma con texto, y por eso la única que se anuncia. Su pareja fondo/texto es una de las verificadas: no se puede componer una nueva desde fuera."
            codigo={`<Pill tone="support-2" dot>128 confirmados</Pill>`}
            lienzo="gf-lienzo--centrado gf-lienzo--claro"
          >
            <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
              <Pill tone="support-2" dot>
                128 confirmados
              </Pill>
              <Pill tone="primary">Plan 2</Pill>
              <Pill tone="support-1" dot>
                Publicada
              </Pill>
              <Pill tone="accent">3 por revisar</Pill>
            </div>
          </Ficha>

          <Ficha
            titulo="Sombra de color desplazada"
            descripcion="Una por vista, en la tarjeta destacada: desplazamiento 8/8 px, borde de tinta de 2 px, color de apoyo. Nunca junto a una sombra difusa."
            codigo={`<ColorShadow tone="support-2" offset={{ x: 8, y: 8 }}>…</ColorShadow>`}
            lienzo="gf-lienzo--centrado"
          >
            <ColorShadow tone="support-2" offset={{ x: 8, y: 8 }} radius="md">
              <div style={{ padding: 16, display: "grid", gap: 8, maxWidth: 210 }}>
                <b style={{ fontFamily: "var(--ui-font-display)", fontSize: 17 }}>Mariana y Rodrigo</b>
                <span style={{ fontSize: 13, color: "var(--ui-ink-muted)" }}>Boda · 18 de abril</span>
              </div>
            </ColorShadow>
          </Ficha>

          <Ficha
            titulo="Placeholder del sistema"
            descripcion="Lo que se ve mientras no hay fotografía: degradado de dos tonos -soft, icono de galería de dos tonos y data-imagen-pendiente para volcar la lista a imagenes-pendientes.md."
            codigo={`<Placeholder imageId="landing-hero" label="Pareja riendo con papel picado" />`}
            lienzo="gf-lienzo--centrado gf-lienzo--claro"
          >
            <div style={{ width: "70%", aspectRatio: "1 / 1" }}>
              <Placeholder imageId="landing-hero" label="Pareja riendo con papel picado al fondo" />
            </div>
          </Ficha>

          <Ficha
            titulo="Composición"
            descripcion="El contenedor que pone la forma detrás del contenido, la recorta al bloque y la saca del árbol accesible. Es la regla 3 convertida en utilidad."
            codigo={`<Composition shape={<Blob seed={4} />} place="abajo-derecha" size="70%">…</Composition>`}
            lienzo="gf-lienzo--claro"
          >
            <Composition shape={<Blob seed={4} tone="support-1-soft" />} place="abajo-derecha" size="80%">
              <div style={{ padding: 18 }}>
                <b style={{ fontFamily: "var(--ui-font-display)", fontSize: 20 }}>Tres pasos y a repartir.</b>
              </div>
            </Composition>
          </Ficha>
        </div>
      </section>

      <section className="gf-ancho gf-seccion" aria-labelledby="mascaras">
        <header>
          <h2 id="mascaras">Máscaras de foto</h2>
          <p>
            Toda fotografía pasa por una de las cinco máscaras o por un radio de 24 px o más. Sin foto real, el
            placeholder del sistema; nunca un rectángulo duro sobre color plano y nunca texto encima.
          </p>
        </header>
        <div className="gf-controles" style={{ maxWidth: 320 }}>
          <Selector etiqueta="mask" valor={mascara} opciones={MASCARAS} alCambiar={setMascara} />
          <Deslizador etiqueta="seed" valor={semilla} min={1} max={60} alCambiar={setSemilla} />
        </div>
        <div className="gf-rejilla">
          {MASCARAS.map((m) => (
            <article className="gf-tarjeta" key={m}>
              <div className="gf-lienzo gf-lienzo--centrado gf-lienzo--claro">
                <div style={{ width: "78%" }}>
                  <Image
                    mask={m}
                    seed={semilla}
                    alt={`Fotografía pendiente con máscara ${m}`}
                    imageId="landing-hero"
                    tones={m === "blob" ? ["support-2-soft", "support-1-soft"] : ["primary-soft", "accent-soft"]}
                  />
                </div>
              </div>
              <h3>{m}</h3>
              <code className="gf-codigo">{`<Image mask="${m}" ${m === "blob" ? `seed={${semilla}} ` : ""}alt="…" />`}</code>
            </article>
          ))}
          <article className="gf-tarjeta">
            <div className="gf-lienzo gf-lienzo--centrado gf-lienzo--claro">
              <div style={{ width: "78%" }}>
                <Image mask={mascara} seed={semilla} alt="Fotografía pendiente, máscara elegida arriba" imageId="paso-1" />
              </div>
            </div>
            <h3>La elegida arriba</h3>
            <p>La misma pieza con los controles de esta sección, para comparar máscaras con la misma seed.</p>
            <code className="gf-codigo">{`<Image mask="${mascara}" seed={${semilla}} alt="…" />`}</code>
          </article>
        </div>
      </section>

      <section className="gf-ancho gf-seccion" aria-labelledby="reglas">
        <header>
          <h2 id="reglas">Reglas de composición</h2>
          <p>Las ocho reglas de 11 §3.4 son requisitos de revisión, no consejos.</p>
        </header>
        <div className="gf-reglas">
          {REGLAS.map(([titulo, texto]) => (
            <div className="gf-regla" key={titulo}>
              <b>{titulo}</b>
              {texto}
            </div>
          ))}
        </div>
      </section>

      <section className="gf-ancho gf-seccion" aria-labelledby="ejemplos">
        <header>
          <h2 id="ejemplos">Cinco composiciones</h2>
          <p>Los mismos componentes, aplicando las reglas. Cada pie dice cuál manda.</p>
        </header>

        <div className="gf-ejemplos">
          <figure className="gf-ejemplo" style={{ margin: 0 }}>
            <Composition
              className="gf-heroe"
              shape={<Rays density={14} radius={170} tone="primary-soft" backdrop="surface-alt" breathe />}
              place="cubrir"
            >
              <div className="gf-heroe-rejilla">
                <div className="gf-papel">
                  <span className="gf-eyebrow">Invitaciones digitales con RSVP</span>
                  <h3>Tu invitación, lista en una tarde.</h3>
                  <p>Eliges una plantilla, escribes los datos y compartes el enlace. Tus invitados confirman desde el teléfono.</p>
                  <div className="gf-acciones">
                    <button type="button" className="gf-boton">
                      Empezar mi invitación
                    </button>
                    <button type="button" className="gf-boton gf-boton--secundario">
                      Ver ejemplos
                    </button>
                  </div>
                </div>
                <Image
                  mask="seal"
                  points={14}
                  alt="Pareja riendo con confeti de papel picado al fondo, jardín al atardecer"
                  imageId="landing-hero"
                />
              </div>
            </Composition>
            <figcaption>
              <b>Héroe.</b> Rayos de fondo (protagonista única, dos pasos del mismo matiz) y la foto con máscara de
              sello encima. El texto vive en su propio papel opaco: nunca sobre la fotografía. Reglas 1, 2, 4 y 5.
            </figcaption>
          </figure>

          <figure className="gf-ejemplo" style={{ margin: 0 }}>
            <div style={{ display: "grid", placeItems: "center", padding: 32, background: "var(--ui-surface-alt)", borderRadius: "var(--ui-radius-xl)" }}>
              <ColorShadow tone="support-2" offset={{ x: 8, y: 8 }} className="gf-tarjeta-destacada">
                <Composition
                  shape={<RotatedSquare tone="primary-bright" rotate={12} radius="md" />}
                  place="centro"
                  size="94%"
                  style={{ borderRadius: "var(--ui-radius-md)" }}
                >
                  <div style={{ padding: 16 }}>
                    <Image mask="rotated" rotate={-7} alt="Manos con anillos sobre mantel de lino" imageId="evento-boda" />
                  </div>
                </Composition>
                <div style={{ display: "grid", gap: 6 }}>
                  <Pill tone="support-2" dot>
                    128 confirmados
                  </Pill>
                  <b style={{ fontFamily: "var(--ui-font-display)", fontSize: 20 }}>Mariana y Rodrigo</b>
                  <span style={{ fontSize: 14, color: "var(--ui-ink-muted)" }}>Boda · 18 de abril de 2027 · Querétaro</span>
                </div>
              </ColorShadow>
            </div>
            <figcaption>
              <b>Tarjeta destacada.</b> Una sola sombra de color (8/8, borde de tinta, sin sombra difusa encima) y la
              foto inclinada sobre el cuadrado rotado, que es el único sitio del paso 500. Reglas 6 y 8.
            </figcaption>
          </figure>

          <figure className="gf-ejemplo" style={{ margin: 0 }}>
            <div className="gf-seccion-onda">
              <div className="gf-banda" style={{ background: "var(--ui-primary-soft)" }}>
                <h3 style={{ margin: 0, fontSize: 26 }}>Para cada celebración</h3>
                <p style={{ marginBottom: 0 }}>Bodas, XV años, bautizos, comuniones, cumpleaños, graduaciones y eventos de empresa.</p>
              </div>
              <WaveDivider profile="doble" layers={2} from="primary-soft" to="surface-raised" tones={["support-1-soft"]} height={80} />
              <div style={{ background: "var(--ui-surface-raised)", padding: "24px 28px 32px" }}>
                <p style={{ marginBottom: 0 }}>La sección de abajo hereda el color de la onda: el divisor no es un adorno pegado, es la frontera.</p>
              </div>
            </div>
            <figcaption>
              <b>Divisor de sección.</b> Onda de dos capas entre dos bandas. La capa de atrás va en un apoyo -soft y
              desfasada: profundidad sin sombra. Regla 2 (matices distintos arriba y abajo).
            </figcaption>
          </figure>

          <figure className="gf-ejemplo" style={{ margin: 0 }}>
            <Composition
              shape={<Blob seed={23} points={7} amplitude={0.2} tone="accent-soft" drift />}
              place="derecha"
              size="300px"
              className="gf-banda"
              style={{ background: "var(--ui-surface-alt)", borderRadius: "var(--ui-radius-xl)", paddingBottom: 84 }}
              secondaryShape={{ shape: <Seal points={12} amplitude={4} tone="primary-soft" />, place: "abajo-izquierda", size: "180px" }}
            >
              <div className="gf-panel" style={{ maxWidth: 460 }}>
                <h3 style={{ marginTop: 0 }}>Tus invitaciones</h3>
                <ul className="gf-lista">
                  <li>
                    <Pill tone="support-2" dot>
                      Publicada
                    </Pill>
                    Mariana y Rodrigo
                  </li>
                  <li>
                    <Pill tone="accent">Borrador</Pill>
                    XV de Renata
                  </li>
                  <li>
                    <Pill tone="support-1" dot>
                      Programada
                    </Pill>
                    Bautizo de Emiliano
                  </li>
                </ul>
              </div>
            </Composition>
            <figcaption>
              <b>Lista con blob detrás.</b> El blob asoma por detrás del panel opaco, nunca por debajo de las filas: la
              regla 3 prohíbe la forma bajo un texto de lista. El sello que asoma abajo a la izquierda es la segunda
              forma, en -soft, sin tocar a la primera y limitada por la propia utilidad a menos del 30 % del bloque.
              Reglas 1 y 3.
            </figcaption>
          </figure>

          <figure className="gf-ejemplo" style={{ margin: 0 }}>
            <Composition
              className="gf-testimonio"
              shape={<Rays density={12} radius={130} tone="support-1-soft" backdrop="surface-raised" breathe />}
              place="cubrir"
              style={{ borderRadius: "var(--ui-radius-xl)" }}
            >
              <blockquote>
                <div className="gf-medallon">
                  <Seal points={12} amplitude={4} tone="primary-soft" />
                  <IconoChispa />
                </div>
                <p>«La mandé por WhatsApp un martes y para el viernes ya tenía ochenta confirmaciones.»</p>
                <footer>Paulina G. · boda en Querétaro</footer>
              </blockquote>
            </Composition>
            <figcaption>
              <b>Testimonio.</b> Icono de dos tonos sobre sello, y el sello sobre los rayos de fondo. La cita va en
              papel opaco con sombra 2. Una sola forma protagonista respirando (12 s), apagada con
              prefers-reduced-motion. Reglas 1, 5 y 7.
            </figcaption>
          </figure>
        </div>
      </section>
    </div>
  );
}
