// GENERADO por scripts/generar.ts a partir de svg/rsvp-confirmado.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoRsvpConfirmado = forwardRef<SVGSVGElement, IconProps>(function IconoRsvpConfirmado(
  { size = 24, title, tone = "duo", className, style, ...resto },
  ref,
) {
  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{ ...(style ?? {}), "--tono": tone === "duo" ? "var(--ui-primary-soft)" : "currentColor" } as CSSProperties}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      <g transform="translate(12 12) scale(0.205) translate(-50 -50)"><path d="M98.5 50.0L98.3 51.3L97.8 52.5L97.0 53.7L96.0 54.8L94.8 55.9L93.5 56.9L92.1 57.8L90.8 58.7L89.7 59.5L88.7 60.4L88.0 61.3L87.6 62.2L87.4 63.2L87.4 64.4L87.7 65.6L88.1 67.0L88.7 68.4L89.2 70.0L89.7 71.6L90.1 73.1L90.2 74.7L90.2 76.1L89.8 77.4L89.2 78.5L88.4 79.4L87.2 80.1L85.9 80.6L84.4 80.9L82.8 81.1L81.1 81.1L79.5 81.1L77.9 81.0L76.5 81.0L75.2 81.2L74.1 81.5L73.2 82.0L72.5 82.7L71.8 83.6L71.3 84.8L70.9 86.2L70.4 87.6L70.0 89.2L69.4 90.8L68.8 92.3L68.1 93.6L67.2 94.7L66.1 95.6L65.0 96.1L63.7 96.4L62.4 96.3L61.0 95.9L59.6 95.2L58.2 94.4L56.9 93.5L55.6 92.5L54.4 91.5L53.2 90.7L52.1 90.0L51.0 89.6L50.0 89.5L49.0 89.6L47.9 90.0L46.8 90.7L45.6 91.5L44.4 92.5L43.1 93.5L41.8 94.4L40.4 95.2L39.0 95.9L37.6 96.3L36.3 96.4L35.0 96.1L33.9 95.6L32.8 94.7L31.9 93.6L31.2 92.3L30.6 90.8L30.0 89.2L29.6 87.6L29.1 86.2L28.7 84.8L28.2 83.6L27.5 82.7L26.8 82.0L25.9 81.5L24.8 81.2L23.5 81.0L22.1 81.0L20.5 81.1L18.9 81.1L17.2 81.1L15.6 80.9L14.1 80.6L12.8 80.1L11.6 79.4L10.8 78.5L10.2 77.4L9.8 76.1L9.8 74.7L9.9 73.1L10.3 71.6L10.8 70.0L11.3 68.4L11.9 67.0L12.3 65.6L12.6 64.4L12.6 63.2L12.4 62.2L12.0 61.3L11.3 60.4L10.3 59.5L9.2 58.7L7.9 57.8L6.5 56.9L5.2 55.9L4.0 54.8L3.0 53.7L2.2 52.5L1.7 51.3L1.5 50.0L1.7 48.7L2.2 47.5L3.0 46.3L4.0 45.2L5.2 44.1L6.5 43.1L7.9 42.2L9.2 41.3L10.3 40.5L11.3 39.6L12.0 38.7L12.4 37.8L12.6 36.8L12.6 35.6L12.3 34.4L11.9 33.0L11.3 31.6L10.8 30.0L10.3 28.4L9.9 26.9L9.8 25.3L9.8 23.9L10.2 22.6L10.8 21.5L11.6 20.6L12.8 19.9L14.1 19.4L15.6 19.1L17.2 18.9L18.9 18.9L20.5 18.9L22.1 19.0L23.5 19.0L24.8 18.8L25.9 18.5L26.8 18.0L27.5 17.3L28.2 16.4L28.7 15.2L29.1 13.8L29.6 12.4L30.0 10.8L30.6 9.2L31.2 7.7L31.9 6.4L32.8 5.3L33.9 4.4L35.0 3.9L36.3 3.6L37.6 3.7L39.0 4.1L40.4 4.8L41.8 5.6L43.1 6.5L44.4 7.5L45.6 8.5L46.8 9.3L47.9 10.0L49.0 10.4L50.0 10.5L51.0 10.4L52.1 10.0L53.2 9.3L54.4 8.5L55.6 7.5L56.9 6.5L58.2 5.6L59.6 4.8L61.0 4.1L62.4 3.7L63.7 3.6L65.0 3.9L66.1 4.4L67.2 5.3L68.1 6.4L68.8 7.7L69.4 9.2L70.0 10.8L70.4 12.4L70.9 13.8L71.3 15.2L71.8 16.4L72.5 17.3L73.2 18.0L74.1 18.5L75.2 18.8L76.5 19.0L77.9 19.0L79.5 18.9L81.1 18.9L82.8 18.9L84.4 19.1L85.9 19.4L87.2 19.9L88.4 20.6L89.2 21.5L89.8 22.6L90.2 23.9L90.2 25.3L90.1 26.9L89.7 28.4L89.2 30.0L88.7 31.6L88.1 33.0L87.7 34.4L87.4 35.6L87.4 36.8L87.6 37.8L88.0 38.7L88.7 39.6L89.7 40.5L90.8 41.3L92.1 42.2L93.5 43.1L94.8 44.1L96.0 45.2L97.0 46.3L97.8 47.5L98.3 48.7L98.5 50.0 Z" fill="var(--tono)" vectorEffect="non-scaling-stroke"/></g><path d="M8.3 12.2 L10.9 14.7 L15.8 9.6"/>
    </svg>
  );
});
