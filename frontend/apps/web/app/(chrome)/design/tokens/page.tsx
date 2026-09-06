import type { CSSProperties } from "react";
import {
  BREAKPOINTS,
  CONTENEDOR,
  CURVAS,
  DURACIONES,
  ESCALA,
  ESPACIO,
  MATICES,
  PAREJAS,
  PASOS,
  PASOS_NEUTROS,
  RADIOS_SEMANTICOS,
  ROLES_COLOR,
  ROLES_TIPOGRAFICOS,
  SOMBRAS,
  USO_CURVA,
  USO_DURACION,
  Z_INDEX,
  clampTipografico,
  contraste,
  enEscritorio,
  enMovil,
  luminancia,
  paletaActiva,
  semantica,
  variacionesDe,
  type RolTipograficoId,
} from "@invitaciones/tokens";
import estilos from "../galeria.module.css";

/**
 * `/design/tokens` — todas las escalas, los roles con su pareja medida, la tipografía, el espacio,
 * la forma y el movimiento. El conmutador de tema vive en el layout: aquí no hay ni una decisión de
 * color tomada en el componente, solo `var(--ui-*)`.
 *
 * Las clases del preset se escriben LITERALES (nunca `text-ui-${rol}`): Tailwind 4 encuentra las
 * utilidades leyendo el código, y una plantilla interpolada no existe para él.
 */
const CLASE_TAMANO: Record<RolTipograficoId, string> = {
  "display-2xl": "text-ui-display-2xl",
  "display-xl": "text-ui-display-xl",
  "display-lg": "text-ui-display-lg",
  "display-md": "text-ui-display-md",
  "display-sm": "text-ui-display-sm",
  "heading-lg": "text-ui-heading-lg",
  "heading-md": "text-ui-heading-md",
  "heading-sm": "text-ui-heading-sm",
  "text-lg": "text-ui-text-lg",
  "text-md": "text-ui-text-md",
  "text-sm": "text-ui-text-sm",
  "text-xs": "text-ui-text-xs",
  "label-lg": "text-ui-label-lg",
  "label-md": "text-ui-label-md",
  "label-sm": "text-ui-label-sm",
};

const CLASE_VOZ = {
  display: "font-ui-display",
  text: "font-ui-text",
  label: "font-ui-label",
} as const;

const MUESTRA = "Nos casamos el 14 de febrero";

const paleta = paletaActiva();
const claro = semantica(paleta, "light");
const oscuro = semantica(paleta, "dark");
const TINTA = paleta.neutral.pasos[950];
const PAPEL = paleta.neutral.pasos[50];

/** Tinta legible sobre un paso concreto de la escala: se decide midiendo, no a ojo. */
const tintaSobre = (hex: string): string => (luminancia(hex) > 0.35 ? TINTA : PAPEL);

function Seccion({ id, titulo, entradilla, children }: { id: string; titulo: string; entradilla: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-ui-divider pt-8">
      <header className="grid gap-2">
        <h2 id={id} className="font-ui-display text-ui-display-lg text-ui-ink">
          {titulo}
        </h2>
        <p className="max-w-[68ch] font-ui-text text-ui-text-sm text-ui-ink-muted">{entradilla}</p>
      </header>
      {children}
    </section>
  );
}

function Escala({ nombre, matiz, pasos, valores }: { nombre: string; matiz: string; pasos: readonly number[]; valores: Record<number, string> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[132px_minmax(0,1fr)] sm:items-center">
      <p className="font-ui-text text-ui-text-sm text-ui-ink">
        {nombre}
        <span className="block font-ui-label text-ui-label-sm uppercase text-ui-ink-muted">{matiz}</span>
      </p>
      <div className={`${estilos.pasos} overflow-x-auto`}>
        {pasos.map((paso) => (
          <div
            key={paso}
            className={estilos.paso}
            style={{ background: valores[paso], color: tintaSobre(valores[paso]) }}
            // Referencia del paso crudo de la escala, no una pareja verificada: `11 §1.5` regla 2
            // ("el 500 es decorativo, nunca texto") deja el 400/500 de algunos matices por debajo de
            // 4,5:1 aquí a propósito — es la misma marca que ya usa la tabla de "Parejas
            // garantizadas" de abajo para las dos filas informativas, y la que lee
            // `e2e/design-contraste.spec.ts` para no confundir una escala con un texto de producto.
            data-umbral="informativa"
          >
            <span className="font-ui-label text-ui-label-sm">{paso}</span>
            <span className="font-ui-label text-ui-label-sm opacity-80">{valores[paso].slice(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PaginaTokens() {
  return (
    <div className="grid gap-10">
      <header className="grid gap-3">
        <p className="font-ui-label text-ui-label-md uppercase text-ui-ink-muted">Tokens</p>
        <h1 className="font-ui-display text-ui-display-xl text-ui-ink">Paleta {paleta.nombre}, y todo lo que se deriva</h1>
        <p className="max-w-[68ch] font-ui-text text-ui-text-lg text-ui-ink-muted">{paleta.lema}</p>
        <p className="max-w-[68ch] font-ui-text text-ui-text-sm text-ui-ink-muted">
          Las escalas se generan en OKLCH con la misma tabla de luminosidad para todos los matices, así que el paso 600
          de cualquiera pesa lo mismo. Los ratios de esta página son los que mide <code className="font-ui-label">pnpm
          run verify-contrast</code>, que rompe el build si alguno baja de su umbral.
        </p>
      </header>

      <Seccion
        id="escalas"
        titulo="Escalas"
        entradilla="Diez pasos por matiz y once neutros cálidos. Existen como variable CSS para las formas; nunca como utilidad, para que ningún componente elija un paso a mano."
      >
        <div className="grid gap-3">
          {MATICES.map((matiz) => (
            <Escala
              key={matiz}
              nombre={matiz}
              matiz={`${paleta.escalas[matiz].nombre} · ${paleta.escalas[matiz].h}°`}
              pasos={PASOS}
              valores={paleta.escalas[matiz].pasos}
            />
          ))}
          <Escala
            nombre="neutral"
            matiz={`${paleta.neutral.nombre} · ${paleta.neutral.h}°`}
            pasos={PASOS_NEUTROS}
            valores={paleta.neutral.pasos}
          />
        </div>
      </Seccion>

      <Seccion
        id="roles"
        titulo="Roles semánticos"
        entradilla="Los 46 roles del sistema. La muestra pinta var(--ui-…), así que sigue al conmutador de tema; las dos columnas de hex enseñan a qué paso va cada rol en cada tema."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES_COLOR.map((rol) => (
            <div key={rol} className="grid gap-2 rounded-ui-card bg-ui-surface-raised p-3 shadow-ui-1">
              <div className={estilos.muestraRol} style={{ background: `var(--ui-${rol})` } as CSSProperties} />
              <p className="font-ui-text text-ui-text-sm text-ui-ink">--ui-{rol}</p>
              <p className="font-ui-label text-ui-label-sm text-ui-ink-muted">
                claro {claro[rol].slice(1)} · oscuro {oscuro[rol].slice(1)}
              </p>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion
        id="parejas"
        titulo="Parejas garantizadas"
        entradilla="Cuarenta y dos parejas, cuarenta con umbral (4,5 texto normal; 3,0 solo donde se declara gráfico) y dos informativas. No existe la pareja foco/primario: el anillo nunca toca el control, lleva un halo de 2 px de surface en medio."
      >
        <div className="overflow-x-auto rounded-ui-card bg-ui-surface-raised shadow-ui-1">
          <table className="w-full border-collapse font-ui-text text-ui-text-sm">
            <caption className="px-4 pt-4 text-left font-ui-text text-ui-text-sm text-ui-ink-muted">
              Ratio WCAG 2.x de cada pareja en los dos temas.
            </caption>
            <thead>
              <tr className="text-left font-ui-label text-ui-label-sm uppercase text-ui-ink-muted">
                <th scope="col" className="px-4 py-3">Muestra</th>
                <th scope="col" className="px-4 py-3">Figura sobre fondo</th>
                <th scope="col" className="px-4 py-3">Claro</th>
                <th scope="col" className="px-4 py-3">Oscuro</th>
                <th scope="col" className="px-4 py-3">Umbral</th>
                <th scope="col" className="px-4 py-3">Uso</th>
              </tr>
            </thead>
            <tbody>
              {PAREJAS.map((pareja) => {
                const rc = contraste(claro[pareja.figura], claro[pareja.fondo]);
                const ro = contraste(oscuro[pareja.figura], oscuro[pareja.fondo]);
                return (
                  <tr key={`${pareja.figura}/${pareja.fondo}`} className="border-t border-ui-divider align-middle">
                    <td className="px-4 py-2">
                      {/* Los `data-*` son la superficie de medición de
                          `evidencia/fase-3c/bloque-1/contraste-en-pantalla.mjs`: mide el contraste
                          sobre la PILA RENDERIZADA (getComputedStyle), no sobre los datos. */}
                      <span
                        className="inline-flex h-9 w-16 items-center justify-center rounded-ui-control font-ui-text text-ui-text-sm"
                        data-pareja={`${pareja.figura}/${pareja.fondo}`}
                        data-figura={pareja.figura}
                        data-fondo={pareja.fondo}
                        data-umbral={pareja.umbral === null ? "informativa" : pareja.umbral.toFixed(1)}
                        style={{
                          background: `var(--ui-${pareja.fondo})`,
                          color: `var(--ui-${pareja.figura})`,
                        } as CSSProperties}
                      >
                        Aa
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ui-ink">
                      {pareja.figura} <span className="text-ui-ink-muted">sobre</span> {pareja.fondo}
                    </td>
                    <td className="px-4 py-2 text-ui-ink">{rc.toFixed(2)}</td>
                    <td className="px-4 py-2 text-ui-ink">{ro.toFixed(2)}</td>
                    <td className="px-4 py-2 text-ui-ink-muted">
                      {pareja.umbral === null ? "informativa" : pareja.umbral.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-ui-ink-muted">{pareja.nota}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion
        id="tipografia"
        titulo="Escala tipográfica"
        entradilla="Tres voces: la display titula, la de texto se lee y la mono etiqueta. La de cuerpo no titula nunca. Los tamaños interpolan con clamp() entre 390 y 1024 px."
      >
        <p className="rounded-ui-card bg-ui-surface-alt p-4 font-ui-text text-ui-text-sm text-ui-ink">
          Las familias (Fraunces, Onest y Red Hat Mono) las instala <code className="font-ui-label">packages/ui</code>.
          Hasta entonces las muestras caen en el respaldo del sistema: lo que esta página fija son los TOKENS de tamaño,
          interlineado, tracking, peso y ejes.
        </p>
        <div className="grid gap-4">
          {ROLES_TIPOGRAFICOS.map((rol) => {
            const r = ESCALA[rol];
            return (
              <article key={rol} className="grid gap-2 rounded-ui-card bg-ui-surface-raised p-4 shadow-ui-1">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h3 className="font-ui-label text-ui-label-md uppercase text-ui-ink-muted">{rol}</h3>
                  <p className="font-ui-text text-ui-text-xs text-ui-ink-muted">
                    {r.movil} → {r.escritorio} px · interlineado {String(enMovil(r.lineHeight))} → {String(enEscritorio(r.lineHeight))} ·
                    tracking {String(enMovil(r.tracking))} · peso {r.peso}
                    {r.ejes ? ` · ${variacionesDe(r)}` : ""}
                  </p>
                </div>
                <p
                  className={`${CLASE_VOZ[r.voz]} ${CLASE_TAMANO[rol]} text-ui-ink ${r.mayusculas ? "uppercase" : ""}`}
                  style={r.ejes ? ({ fontVariationSettings: variacionesDe(r) } as CSSProperties) : undefined}
                >
                  {MUESTRA}
                </p>
                <p className="font-ui-label text-ui-label-sm text-ui-ink-muted">
                  {clampTipografico(r.movil, r.escritorio)} · {r.uso}
                </p>
              </article>
            );
          })}
        </div>
      </Seccion>

      <Seccion
        id="espacio"
        titulo="Espacio y forma"
        entradilla="Base 4: 4·8·12·16·24·32·48·64·96. Los radios tienen nombre de uso, y una foto nunca baja de 24 px de radio."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid gap-2">
            {Object.entries(ESPACIO).map(([paso, valor]) => (
              <div key={paso} className="flex items-center gap-3">
                <span className="w-16 font-ui-label text-ui-label-sm uppercase text-ui-ink-muted">space-{paso}</span>
                <span className="h-3 rounded-ui-pill bg-ui-primary" style={{ width: `${valor}px` }} />
                <span className="font-ui-text text-ui-text-xs text-ui-ink-muted">{valor} px</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(RADIOS_SEMANTICOS).map(([nombre, valor]) => (
              <div key={nombre} className="grid gap-2">
                <div
                  className={estilos.cuadroForma}
                  style={{ borderRadius: `var(--ui-radius-${nombre})` } as CSSProperties}
                />
                <p className="font-ui-label text-ui-label-sm uppercase text-ui-ink-muted">
                  radius-{nombre} · {valor === 999 ? "píldora" : `${valor} px`}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Object.keys(SOMBRAS).map((nombre) => (
            <div
              key={nombre}
              className="grid gap-2 rounded-ui-card bg-ui-surface-raised p-4"
              style={{ boxShadow: `var(--ui-shadow-${nombre})` } as CSSProperties}
            >
              <p className="font-ui-text text-ui-text-sm text-ui-ink">shadow-{nombre}</p>
              <p className="font-ui-text text-ui-text-xs text-ui-ink-muted">
                {nombre === "color" ? "Plana y desplazada, en un tono de apoyo. Una por vista." : "Difusa, tintada de cacao."}
              </p>
            </div>
          ))}
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 font-ui-text text-ui-text-sm text-ui-ink-muted">
          <div>
            <dt className="inline font-ui-label text-ui-label-sm uppercase">contenedor</dt>{" "}
            <dd className="inline text-ui-ink">{CONTENEDOR.max}</dd>
          </div>
          <div>
            <dt className="inline font-ui-label text-ui-label-sm uppercase">canaleta</dt>{" "}
            <dd className="inline text-ui-ink">{CONTENEDOR.canaleta}</dd>
          </div>
          <div>
            <dt className="inline font-ui-label text-ui-label-sm uppercase">capas</dt>{" "}
            <dd className="inline text-ui-ink">{Object.entries(Z_INDEX).map(([n, v]) => `${n} ${v}`).join(" · ")}</dd>
          </div>
          <div>
            <dt className="inline font-ui-label text-ui-label-sm uppercase">cortes</dt>{" "}
            <dd className="inline text-ui-ink">{Object.entries(BREAKPOINTS).map(([n, v]) => `${n} ${v}`).join(" · ")}</dd>
          </div>
        </dl>
      </Seccion>

      <Seccion
        id="movimiento"
        titulo="Movimiento"
        entradilla="Cuatro duraciones, una respiración larguísima para las formas de fondo y cuatro curvas. Toda animación se emite dentro de prefers-reduced-motion: no-preference."
      >
        <div className="overflow-x-auto rounded-ui-card bg-ui-surface-raised shadow-ui-1">
          <table className="w-full border-collapse font-ui-text text-ui-text-sm">
            <thead>
              <tr className="text-left font-ui-label text-ui-label-sm uppercase text-ui-ink-muted">
                <th scope="col" className="px-4 py-3">Token</th>
                <th scope="col" className="px-4 py-3">Valor</th>
                <th scope="col" className="px-4 py-3">Uso</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(DURACIONES).map(([nombre, valor]) => (
                <tr key={nombre} className="border-t border-ui-divider">
                  <td className="px-4 py-2 text-ui-ink">--ui-dur-{nombre}</td>
                  <td className="px-4 py-2 text-ui-ink">{valor} ms</td>
                  <td className="px-4 py-2 text-ui-ink-muted">{USO_DURACION[nombre as keyof typeof USO_DURACION]}</td>
                </tr>
              ))}
              {Object.entries(CURVAS).map(([nombre, valor]) => (
                <tr key={nombre} className="border-t border-ui-divider">
                  <td className="px-4 py-2 text-ui-ink">--ui-ease-{nombre}</td>
                  <td className="px-4 py-2 text-ui-ink">{valor}</td>
                  <td className="px-4 py-2 text-ui-ink-muted">{USO_CURVA[nombre as keyof typeof USO_CURVA]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
    </div>
  );
}
