// packages/ui/src/utilidades/foco.ts — anillo de foco compartido por la familia de formularios
// (`11 §5`; fórmula fijada en `memoria/handoffs/3c-0.md`): halo de 2 px de `surface` + anillo de
// 3 px de `focus`. Se calcula y aplica como `style.boxShadow` en línea (no como clase Tailwind)
// porque `packages/ui` no compila Tailwind y las pruebas miden `getComputedStyle` — comprobado en
// `bitacora/3c-b2-f1.md`: jsdom no resuelve `:focus-visible` contra hojas de estilo reales, y no
// expande `var()` dentro de propiedades compuestas, así que el valor debe llegar completo. El
// estado de foco se rastrea con `onFocus`/`onBlur` (no `:focus-visible`): se anuncia con cualquier
// método de entrada, decisión más simple y determinista que distinguir teclado de ratón (11 §5 no
// exige la distinción).
"use client";

import { useCallback, useState, type FocusEvent } from "react";

/** El halo de superficie (2 px) más el anillo de `focus` (llega a 5 px de radio). */
export const SOMBRA_ANILLO_FOCO = "0 0 0 2px var(--ui-surface), 0 0 0 5px var(--ui-focus)";

/** Compone una sombra propia (borde, por ejemplo) con el anillo de foco cuando corresponde. */
export function conAnilloFoco(enFoco: boolean, sombraPropia?: string): string | undefined {
  if (!enFoco) return sombraPropia;
  return sombraPropia ? `${sombraPropia}, ${SOMBRA_ANILLO_FOCO}` : SOMBRA_ANILLO_FOCO;
}

export interface EstadoFoco<E extends HTMLElement = HTMLElement> {
  readonly enFoco: boolean;
  readonly onFocus: (evento: FocusEvent<E>) => void;
  readonly onBlur: (evento: FocusEvent<E>) => void;
}

/**
 * Rastrea el foco de un control y expone `onFocus`/`onBlur` listos para pasar al elemento. Un solo
 * lugar para toda la familia de formularios; cada componente decide cómo mezclar `enFoco` en su
 * `boxShadow` (algunos añaden un borde propio, otros solo el anillo).
 */
export function useFoco<E extends HTMLElement = HTMLElement>(
  onFocusExterno?: (evento: FocusEvent<E>) => void,
  onBlurExterno?: (evento: FocusEvent<E>) => void,
): EstadoFoco<E> {
  const [enFoco, setEnFoco] = useState(false);
  const onFocus = useCallback(
    (evento: FocusEvent<E>) => {
      setEnFoco(true);
      onFocusExterno?.(evento);
    },
    [onFocusExterno],
  );
  const onBlur = useCallback(
    (evento: FocusEvent<E>) => {
      setEnFoco(false);
      onBlurExterno?.(evento);
    },
    [onBlurExterno],
  );
  return { enFoco, onFocus, onBlur };
}
