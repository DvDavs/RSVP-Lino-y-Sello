// src/semantica.ts — roles semánticos (`--ui-*`) → paso de escala, por tema, y las parejas de
// contraste garantizadas con su umbral. Traslado literal de `semantica()` y `PAREJAS` de
// `evidencia/fase-3c/moodboard/verificar-paletas.mjs` (`11 §1.3` y §1.4): mismos pasos, mismos
// umbrales, mismas notas. Cambiar un paso aquí cambia el resultado de `verify-contrast`.
import { BLANCO, type MatizId, type Paleta, type Paso, type PasoNeutro } from "./paletas.ts";

export const TEMAS = ["light", "dark"] as const;
export type Tema = (typeof TEMAS)[number];

/**
 * Los 46 roles de color del sistema. El orden es el de emisión en `generated/tokens.css`.
 * `SemanticColorRole` es el alias en inglés que pide el contrato del paquete.
 */
export const ROLES_COLOR = [
  "surface", "surface-raised", "surface-alt",
  "ink", "ink-muted", "ink-placeholder",
  "border", "divider",
  "primary", "on-primary", "primary-hover", "primary-soft", "on-primary-soft", "primary-bright", "link",
  "accent", "on-accent", "accent-soft", "on-accent-soft",
  "success", "on-success", "success-text", "success-soft", "on-success-soft",
  "danger", "on-danger", "danger-text", "danger-soft", "on-danger-soft",
  "warning", "on-warning", "warning-text", "warning-soft", "on-warning-soft",
  "info", "on-info", "info-text", "info-soft", "on-info-soft",
  "focus",
  "support-1", "support-1-soft", "support-1-deep",
  "support-2", "support-2-soft", "support-2-deep",
] as const;

export type RolColor = (typeof ROLES_COLOR)[number];
export type SemanticColorRole = RolColor;

/** Mapa completo de un tema: todos los roles resueltos a hex. */
export type MapaSemantico = Readonly<Record<RolColor, string>>;

type Pasos = Readonly<Record<Paso, string>>;
type PasosNeutros = Readonly<Record<PasoNeutro, string>>;

/**
 * Roles → paso de escala (`11 §1.3`). Reglas que codifica: el brillo lo dan las superficies claras
 * (50-300) y la tipografía los pasos oscuros (600-900); el 500 es decorativo; el tema oscuro es un
 * mapa, no una excepción (ningún componente sabe en qué tema está).
 */
export function semantica(paleta: Paleta, tema: Tema): MapaSemantico {
  const e = Object.fromEntries(
    Object.entries(paleta.escalas).map(([rol, s]) => [rol, s.pasos]),
  ) as Record<MatizId, Pasos>;
  const n: PasosNeutros = paleta.neutral.pasos;
  const foco: Pasos = e[paleta.matizFoco];

  if (tema === "light") {
    return Object.freeze({
      surface: n[50], "surface-raised": BLANCO, "surface-alt": e.primary[50],
      ink: n[900], "ink-muted": n[700], "ink-placeholder": n[600],
      border: n[500], divider: n[200],
      primary: e.primary[600], "on-primary": BLANCO, "primary-hover": e.primary[700],
      "primary-soft": e.primary[100], "on-primary-soft": e.primary[800],
      "primary-bright": e.primary[500], link: e.primary[700],
      accent: e.accent[400], "on-accent": n[950], "accent-soft": e.accent[100], "on-accent-soft": e.accent[800],
      success: e.success[600], "on-success": BLANCO, "success-text": e.success[700], "success-soft": e.success[100], "on-success-soft": e.success[800],
      danger: e.danger[600], "on-danger": BLANCO, "danger-text": e.danger[600], "danger-soft": e.danger[100], "on-danger-soft": e.danger[800],
      warning: e.warning[400], "on-warning": n[950], "warning-text": e.warning[700], "warning-soft": e.warning[100], "on-warning-soft": e.warning[800],
      info: e.info[600], "on-info": BLANCO, "info-text": e.info[700], "info-soft": e.info[100], "on-info-soft": e.info[800],
      focus: foco[500],
      "support-1": e.support1[500], "support-1-soft": e.support1[100], "support-1-deep": e.support1[800],
      "support-2": e.support2[500], "support-2-soft": e.support2[100], "support-2-deep": e.support2[800],
    });
  }

  return Object.freeze({
    surface: n[950], "surface-raised": n[900], "surface-alt": n[800],
    ink: n[50], "ink-muted": n[300], "ink-placeholder": n[400],
    border: n[500], divider: n[800],
    primary: e.primary[300], "on-primary": n[950], "primary-hover": e.primary[200],
    "primary-soft": e.primary[900], "on-primary-soft": e.primary[100],
    "primary-bright": e.primary[500], link: e.primary[300],
    accent: e.accent[300], "on-accent": n[950], "accent-soft": e.accent[900], "on-accent-soft": e.accent[100],
    success: e.success[300], "on-success": n[950], "success-text": e.success[300], "success-soft": e.success[900], "on-success-soft": e.success[100],
    danger: e.danger[300], "on-danger": n[950], "danger-text": e.danger[300], "danger-soft": e.danger[900], "on-danger-soft": e.danger[100],
    warning: e.warning[300], "on-warning": n[950], "warning-text": e.warning[300], "warning-soft": e.warning[900], "on-warning-soft": e.warning[100],
    info: e.info[300], "on-info": n[950], "info-text": e.info[300], "info-soft": e.info[900], "on-info-soft": e.info[100],
    focus: foco[300],
    "support-1": e.support1[400], "support-1-soft": e.support1[900], "support-1-deep": e.support1[200],
    "support-2": e.support2[400], "support-2-soft": e.support2[900], "support-2-deep": e.support2[200],
  });
}

/** Umbral WCAG 2.x de texto normal. */
export const UMBRAL_TEXTO = 4.5;
/** Umbral WCAG 2.x de elemento gráfico (borde de control, anillo de foco, icono de acción). */
export const UMBRAL_GRAFICO = 3.0;

export interface Pareja {
  readonly figura: RolColor;
  readonly fondo: RolColor;
  /** `null` = pareja informativa (decorativa): se mide y se imprime, pero no rompe el build. */
  readonly umbral: number | null;
  readonly nota: string;
}

/**
 * Las 42 parejas garantizadas (`11 §1.4`). 40 con umbral, 2 informativas.
 *
 * NO existe la pareja `focus`/`primary` a propósito: el anillo de foco nunca toca el control (lleva
 * un halo de 2 px de `surface` en medio: `box-shadow: 0 0 0 2px var(--ui-surface), 0 0 0 5px
 * var(--ui-focus)`), así que su color adyacente es siempre `surface`, que sí se mide. Medir
 * `focus`/`primary` sería medir algo que el sistema prohíbe dibujar.
 */
export const PAREJAS: readonly Pareja[] = [
  { figura: "ink", fondo: "surface", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "ink", fondo: "surface-raised", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "ink", fondo: "surface-alt", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "ink-muted", fondo: "surface", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "ink-muted", fondo: "surface-raised", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "ink-muted", fondo: "surface-alt", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "ink-placeholder", fondo: "surface-raised", umbral: UMBRAL_TEXTO, nota: "texto normal (campo)" },
  { figura: "border", fondo: "surface-raised", umbral: UMBRAL_GRAFICO, nota: "grafico: borde de control" },
  { figura: "border", fondo: "surface", umbral: UMBRAL_GRAFICO, nota: "grafico: borde de control" },
  { figura: "divider", fondo: "surface", umbral: null, nota: "decorativo: separador" },
  { figura: "on-primary", fondo: "primary", umbral: UMBRAL_TEXTO, nota: "texto normal (boton)" },
  { figura: "on-primary", fondo: "primary-hover", umbral: UMBRAL_TEXTO, nota: "texto normal (boton hover)" },
  { figura: "on-primary-soft", fondo: "primary-soft", umbral: UMBRAL_TEXTO, nota: "texto normal (chip)" },
  { figura: "primary", fondo: "surface", umbral: UMBRAL_GRAFICO, nota: "grafico: icono de accion, aro secundario" },
  { figura: "primary", fondo: "surface-raised", umbral: UMBRAL_GRAFICO, nota: "grafico: icono de accion, aro secundario" },
  { figura: "link", fondo: "surface", umbral: UMBRAL_TEXTO, nota: "texto normal (enlace)" },
  { figura: "link", fondo: "surface-raised", umbral: UMBRAL_TEXTO, nota: "texto normal (enlace)" },
  { figura: "link", fondo: "surface-alt", umbral: UMBRAL_TEXTO, nota: "texto normal (enlace)" },
  { figura: "primary-bright", fondo: "surface", umbral: null, nota: "decorativo: formas" },
  { figura: "on-accent", fondo: "accent", umbral: UMBRAL_TEXTO, nota: "texto normal (acento calido)" },
  { figura: "on-accent-soft", fondo: "accent-soft", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "on-success", fondo: "success", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "success-text", fondo: "surface", umbral: UMBRAL_TEXTO, nota: "texto normal (estado)" },
  { figura: "success-text", fondo: "surface-raised", umbral: UMBRAL_TEXTO, nota: "texto normal (estado)" },
  { figura: "on-success-soft", fondo: "success-soft", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "on-danger", fondo: "danger", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "danger-text", fondo: "surface", umbral: UMBRAL_TEXTO, nota: "texto normal (error)" },
  { figura: "danger-text", fondo: "surface-raised", umbral: UMBRAL_TEXTO, nota: "texto normal (error)" },
  { figura: "on-danger-soft", fondo: "danger-soft", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "on-warning", fondo: "warning", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "warning-text", fondo: "surface", umbral: UMBRAL_TEXTO, nota: "texto normal (aviso)" },
  { figura: "warning-text", fondo: "surface-raised", umbral: UMBRAL_TEXTO, nota: "texto normal (aviso)" },
  { figura: "on-warning-soft", fondo: "warning-soft", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "on-info", fondo: "info", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "info-text", fondo: "surface", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "info-text", fondo: "surface-raised", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "on-info-soft", fondo: "info-soft", umbral: UMBRAL_TEXTO, nota: "texto normal" },
  { figura: "focus", fondo: "surface", umbral: UMBRAL_GRAFICO, nota: "grafico: anillo de foco" },
  { figura: "focus", fondo: "surface-raised", umbral: UMBRAL_GRAFICO, nota: "grafico: anillo de foco" },
  { figura: "focus", fondo: "surface-alt", umbral: UMBRAL_GRAFICO, nota: "grafico: anillo de foco" },
  { figura: "support-1-deep", fondo: "support-1-soft", umbral: UMBRAL_TEXTO, nota: "texto normal (banda de apoyo 1)" },
  { figura: "support-2-deep", fondo: "support-2-soft", umbral: UMBRAL_TEXTO, nota: "texto normal (banda de apoyo 2)" },
];

/** Nombre de la variable CSS de un rol. */
export const variableDe = (rol: RolColor): `--ui-${RolColor}` => `--ui-${rol}`;
