// packages/ui/src/utilidades/useReducedMotion.ts — lectura reactiva de `prefers-reduced-motion`.
//
// El interruptor CENTRAL del movimiento es CSS (`shapes/shapes.css`, `11 §6.2` regla 5): las
// animaciones se emiten dentro de `@media (prefers-reduced-motion: no-preference)` y además se
// apagan explícitamente con `reduce`. Este hook NO duplica eso: existe para el movimiento que CSS
// no puede apagar solo — un `requestAnimationFrame`, un autoplay, un `scrollIntoView({behavior})`.
//
// `useSyncExternalStore` en vez de `useEffect`: el valor del servidor es `false` (sin animación
// asumida) y el del cliente se lee en el primer render, así que no hay un frame con la animación
// encendida antes de apagarla.
"use client";

import { useSyncExternalStore } from "react";

const CONSULTA = "(prefers-reduced-motion: reduce)";

function suscribir(alCambiar: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener("change", alCambiar);
  return () => mq.removeEventListener("change", alCambiar);
}

function leerCliente(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(CONSULTA).matches;
}

/** `true` cuando la persona ha pedido menos movimiento en su sistema operativo. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(suscribir, leerCliente, () => false);
}
