// packages/ui/src/historias/escaparate.tsx — vitrina para las historias de SUPERPOSICIÓN
// (Dialog, Sheet). Añadido en la revisión del bloque 2 (fase 3-C); el porqué, medido:
//
// Un `Dialog`/`Sheet` abierto es una capa MODAL: Radix atrapa el foco, marca todo lo demás
// `aria-hidden` y le pone `pointer-events: none`, y el panel se posiciona con `position: fixed`
// contra la VENTANA. Eso es exactamente lo que debe hacer en producto, y exactamente lo que no
// puede hacer una ficha de galería:
//
//   - `aria-hidden` sobre la raíz de la galería → `axe` «aria-hidden-focus» (serio) y
//     «landmark-one-main» en cada página con una superposición abierta;
//   - `pointer-events: none` en el resto → el conmutador de tema deja de poder pulsarse: las
//     pruebas de oscuro caducaban a los 30 s esperando el botón «Oscuro»;
//   - `position: fixed` → el panel tapa la página entera en vez de vivir en su ficha, y la captura
//     de regresión visual depende del scroll y de qué historia montó primero.
//
// La vitrina resuelve las tres a la vez: el panel se monta DENTRO de esta caja (`container`), la
// caja es bloque contenedor (`contain: paint`) para que `position: fixed` se resuelva contra ella,
// y la historia pasa `modal={false}` para que no haya ni foco atrapado ni `aria-hidden` ni bloqueo
// de puntero. El velo, que Radix solo pinta en modo modal, lo pinta aquí la propia vitrina como
// adorno (`aria-hidden`), para que la ficha enseñe el aspecto real del componente.
"use client";

import { useState, type ReactNode } from "react";

export interface PropsEscaparateSuperposicion {
  /**
   * Recibe el nodo de la caja (o `null` en el primer render) para pasarlo como `container` del
   * portal. Mientras es `null` no se monta nada: así el panel nunca aparece un fotograma en el
   * `<body>` antes de tener su caja (lo que dejaría una captura distinta según el orden de montaje).
   */
  readonly children: (contenedor: HTMLElement | null) => ReactNode;
  /** Alto de la vitrina en píxeles. Debe dar aire al panel más alto de la historia. */
  readonly alto?: number;
  /** Velo decorativo bajo el panel, como el que pinta el modo modal. */
  readonly velo?: boolean;
  /** Nombre accesible de la vitrina: la ficha ya lo titula, aquí solo describe qué se expone. */
  readonly etiqueta: string;
}

export function EscaparateSuperposicion({
  children,
  alto = 280,
  velo = true,
  etiqueta,
}: PropsEscaparateSuperposicion) {
  const [caja, setCaja] = useState<HTMLDivElement | null>(null);

  return (
    <div
      ref={setCaja}
      role="group"
      aria-label={etiqueta}
      className="relative w-full overflow-hidden rounded-ui-media bg-ui-surface"
      // `contain: paint` hace de esta caja el bloque contenedor de los descendientes `fixed`
      // (igual que `transform`, pero sin crear una capa de composición ni desdibujar el texto) y,
      // de paso, recorta lo que se salga. `isolation` mantiene los `z-index` del panel dentro.
      style={{ height: alto, contain: "paint", isolation: "isolate" }}
    >
      {velo ? <span aria-hidden="true" className="absolute inset-0 bg-ui-ink/40" /> : null}
      {children(caja)}
    </div>
  );
}
