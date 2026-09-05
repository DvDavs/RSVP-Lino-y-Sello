// Tipos compartidos por las ilustraciones de estados vacíos (11 §4.3).

/** Los tres estados vacíos que entrega este bloque; el resto del inventario (`11 §4.3`: sin
 * plantillas, sin confirmaciones, sin conexión, 404, enlace caducado) queda para cuando ese estado
 * exista de verdad en el producto (`preguntas-abiertas.md`). */
export type NombreIlustracion = "sin-invitaciones" | "sin-fotos" | "error-generico";

export interface PropsIlustracion {
  /** Lado del lienzo cuadrado en píxeles CSS. La retícula fuente es 160; 120 es el tamaño de
   * `EmptyState` (`11 §5`). */
  size?: number;
  className?: string;
}
