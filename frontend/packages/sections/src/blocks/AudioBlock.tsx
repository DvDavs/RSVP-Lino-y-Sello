// packages/sections/src/blocks/AudioBlock.tsx — tipo 5/14.
// "El audio de fondo (backgroundMusic) NUNCA se reproduce automáticamente: control explícito,
// silenciado por defecto" (04 §17.5, WCAG 1.4.2 Audio Control) — por eso: sin `autoPlay`, con
// `controls` nativo (el usuario decide) y `muted` inicial como red de seguridad adicional.
import type { BlockComponentProps } from "./types.ts";
import { isSafeHttpUrl } from "./url.ts";
import styles from "./AudioBlock.module.css";

export function AudioBlock({ block }: BlockComponentProps) {
  if (block.value === null || block.value.kind !== "audio") return null;
  if (!isSafeHttpUrl(block.value.url)) return null; // defensa en profundidad (04 §17.6)
  // Sin activationAttrs a propósito: <audio controls> ya es un widget nativo completo (teclado
  // y lector de pantalla incluidos); envolverlo en onClick de "seleccionar" interceptaría los
  // propios controles nativos del reproductor dentro del lienzo.
  return (
    <audio
      className={styles.audio}
      src={block.value.url}
      controls
      preload="none"
      muted
      aria-label={block.label}
    >
      Tu navegador no puede reproducir este audio.
    </audio>
  );
}
