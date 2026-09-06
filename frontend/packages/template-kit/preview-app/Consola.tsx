// preview-app/Consola.tsx — el chrome del previsualizador: qué paquete es, en qué anchos se ve, con
// qué paleta, y qué dice `check`.
//
// Identidad visual (`.claude/skills/identidad-visual`, `diseno/10`): color SÓLO desde los tokens
// `--ui-*` del producto (`@invitaciones/tokens/tokens.css`), tipografías del sistema de diseño
// autoalojadas por Fontsource, cero emojis, controles propios (nada de `<select>` sin vestir). Y la
// regla que más importa aquí: **el chrome del producto y los tokens de la plantilla no se mezclan**
// — los `--inv-*` de la invitación viven dentro de los `<iframe>`, en otro documento, así que no
// pueden filtrarse ni en un sentido ni en el otro. Esa es la razón de fondo de los marcos, además de
// las consultas de medios.
import { useState } from "react";
import { useEstado } from "./estado.ts";
import { Diagnostico } from "./Diagnostico.tsx";
import "./consola.css";

/** Los tres anchos que también captura `plantilla capturas`: mismo vocabulario en los dos sitios. */
export const ANCHOS = [
  { id: "movil", etiqueta: "Móvil", ancho: 390, alto: 844 },
  { id: "tableta", etiqueta: "Tableta", ancho: 768, alto: 1024 },
  { id: "escritorio", etiqueta: "Escritorio", ancho: 1280, alto: 900 },
] as const;

type IdAncho = (typeof ANCHOS)[number]["id"];

export function Consola() {
  const [visibles, setVisibles] = useState<readonly IdAncho[]>(["movil", "escritorio"]);
  const [paleta, setPaleta] = useState<string | null>(null);
  const [fuentes, setFuentes] = useState<string | null>(null);
  const estado = useEstado(paleta, fuentes);

  // Quitar el último ancho dejaría la pantalla vacía: el conmutador nunca se puede apagar del todo.
  const alternar = (id: IdAncho): void => {
    setVisibles(v => {
      if (v.includes(id)) return v.length === 1 ? v : v.filter(x => x !== id);
      return ANCHOS.map(a => a.id).filter(x => x === id || v.includes(x));   // orden estable
    });
  };

  const titulo = estado?.slug === undefined
    ? "Previsualizador"
    : `${estado.slug}@${estado.version ?? ""}`;

  return (
    <div className="kit">
      <header className="kit__barra">
        <div className="kit__identidad">
          <span className="kit__marca">plantilla preview</span>
          <h1 className="kit__titulo">{titulo}</h1>
          <p className="kit__ruta" title={estado?.dir ?? ""}>{estado?.dir ?? "…"}</p>
        </div>

        <div className="kit__grupo" role="group" aria-label="Anchos visibles">
          {ANCHOS.map(a => (
            <button
              key={a.id}
              type="button"
              className="kit__boton"
              aria-pressed={visibles.includes(a.id)}
              onClick={() => { alternar(a.id); }}
            >
              {a.etiqueta}
              <span className="kit__boton-nota">{a.ancho}</span>
            </button>
          ))}
        </div>

        {estado !== null && estado.paletas.length > 1 ? (
          <div className="kit__grupo" role="group" aria-label="Paleta">
            {estado.paletas.map(p => (
              <button
                key={p.id}
                type="button"
                className="kit__boton"
                aria-pressed={(paleta ?? estado.composed?.theme.paletteId) === p.id}
                onClick={() => { setPaleta(p.id); }}
              >
                {p.nombre}
              </button>
            ))}
          </div>
        ) : null}

        {estado !== null && estado.conjuntosDeFuentes.length > 1 ? (
          <div className="kit__grupo" role="group" aria-label="Tipografías">
            {estado.conjuntosDeFuentes.map(f => (
              <button
                key={f.id}
                type="button"
                className="kit__boton"
                aria-pressed={(fuentes ?? estado.composed?.theme.fontSetId) === f.id}
                onClick={() => { setFuentes(f.id); }}
              >
                {f.nombre}
              </button>
            ))}
          </div>
        ) : null}

        <p className="kit__estado" data-ok={estado?.ok === true}>
          {estado === null ? "Componiendo…" : estado.ok ? "check en verde" : "check en rojo"}
        </p>
      </header>

      {estado !== null && !estado.ok ? (
        <div className="kit__panel">
          <Diagnostico estado={estado} />
        </div>
      ) : null}

      {estado !== null && estado.ok && estado.notas.length > 0 ? (
        <ul className="kit__notas">
          {estado.notas.map(n => <li key={n}>{n}</li>)}
        </ul>
      ) : null}

      {/* Con el paquete en rojo NO se pintan los marcos: cada uno enseñaría otra copia del mismo
          diagnóstico (tres veces el mismo texto). El panel de arriba ya lo dice una vez, y el
          lienzo suelto (`/?marco=…`, el que fotografía `capturas`) lo sigue enseñando por su
          cuenta, que es donde importa que no salga una página en blanco. */}
      <main className="kit__marcos" hidden={estado !== null && !estado.ok}>
        {ANCHOS.filter(a => visibles.includes(a.id)).map(a => (
          <figure key={a.id} className="kit__marco" style={{ width: `${a.ancho}px` }}>
            <figcaption className="kit__marco-titulo">
              {a.etiqueta} · {a.ancho}&nbsp;px
            </figcaption>
            <iframe
              className="kit__iframe"
              title={`${titulo} en ${a.etiqueta}`}
              src={enlaceDeMarco(a.id, paleta, fuentes)}
              width={a.ancho}
              height={a.alto}
            />
          </figure>
        ))}
      </main>
    </div>
  );
}

/** URL del lienzo dentro del marco. Es la MISMA que usa `plantilla capturas`. */
export function enlaceDeMarco(marco: string, paleta: string | null, fuentes: string | null): string {
  const p = new URLSearchParams({ marco });
  if (paleta !== null) p.set("paleta", paleta);
  if (fuentes !== null) p.set("fuentes", fuentes);
  return `/?${p.toString()}`;
}
