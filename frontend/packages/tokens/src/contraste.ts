// src/contraste.ts — contraste WCAG 2.x (luminancia relativa) y el recorrido de las parejas
// garantizadas. Es la lógica que `scripts/verify-contrast.ts` imprime y con la que rompe el build.
// Semilla: `evidencia/fase-3c/moodboard/verificar-paletas.mjs`.
import { PALETAS, type Paleta, type PaletaId } from "./paletas.ts";
import { PAREJAS, ROLES_COLOR, TEMAS, semantica, type MapaSemantico, type RolColor, type Tema } from "./semantica.ts";

function canal(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa WCAG 2.x de un `#rrggbb`. */
export function luminancia(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

/** Ratio de contraste WCAG 2.x entre dos `#rrggbb` (1 a 21). */
export function contraste(figura: string, fondo: string): number {
  const a = luminancia(figura);
  const b = luminancia(fondo);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export interface FilaContraste {
  readonly paleta: string;
  readonly tema: Tema;
  readonly figura: RolColor;
  readonly fondo: RolColor;
  readonly hexFigura: string;
  readonly hexFondo: string;
  readonly ratio: number;
  readonly umbral: number | null;
  /** `null` en las parejas informativas. */
  readonly ok: boolean | null;
  readonly nota: string;
}

export interface ResultadoContraste {
  readonly filas: readonly FilaContraste[];
  /** Parejas con umbral (las informativas no cuentan). */
  readonly evaluadas: number;
  readonly fallos: number;
}

/**
 * Sabotaje deliberado de un rol: la ÚNICA forma de demostrar que la compuerta cae. Lo usan
 * `test/contraste.test.ts` y la opción `--sabotear=<rol>=<hex>` de `verify-contrast`. Nunca se
 * llama desde código de producto.
 */
export type Sabotaje = Partial<Record<RolColor, string>>;

function aplicarSabotaje(mapa: MapaSemantico, sabotaje?: Sabotaje): MapaSemantico {
  if (!sabotaje) return mapa;
  return Object.freeze({ ...mapa, ...sabotaje });
}

/** Recorre paletas x temas x parejas y devuelve todas las filas medidas. */
export function verificarParejas(
  paletas: readonly Paleta[] = Object.values(PALETAS),
  sabotaje?: Sabotaje,
): ResultadoContraste {
  const filas: FilaContraste[] = [];
  let evaluadas = 0;
  let fallos = 0;
  for (const p of paletas) {
    for (const tema of TEMAS) {
      const s = aplicarSabotaje(semantica(p, tema), sabotaje);
      for (const pareja of PAREJAS) {
        const hexFigura = s[pareja.figura];
        const hexFondo = s[pareja.fondo];
        const ratio = contraste(hexFigura, hexFondo);
        const ok = pareja.umbral === null ? null : ratio >= pareja.umbral;
        if (pareja.umbral !== null) {
          evaluadas++;
          if (!ok) fallos++;
        }
        filas.push({
          paleta: `${p.id}:${p.nombre}`, tema,
          figura: pareja.figura, fondo: pareja.fondo,
          hexFigura, hexFondo, ratio, umbral: pareja.umbral, ok, nota: pareja.nota,
        });
      }
    }
  }
  return { filas, evaluadas, fallos };
}

/** La tabla literal de `11 §1.6`: mismas columnas, mismos anchos, mismo pie. */
export function tablaContraste(resultado: ResultadoContraste = verificarParejas()): string {
  const col = (t: string | number, n: number): string => String(t).padEnd(n);
  const lineas: string[] = [];
  lineas.push(
    col("paleta", 13) + col("tema", 6) + col("figura", 17) + col("fondo", 15) + col("hex", 17) +
      col("ratio", 7) + col("umbral", 7) + col("estado", 7) + "nota",
  );
  lineas.push("-".repeat(118));
  for (const f of resultado.filas) {
    const estado = f.ok === null ? "info" : f.ok ? "OK" : "FALLA";
    lineas.push(
      col(f.paleta, 13) + col(f.tema, 6) + col(f.figura, 17) + col(f.fondo, 15) +
        col(`${f.hexFigura}/${f.hexFondo}`, 17) + col(f.ratio.toFixed(2), 7) +
        col(f.umbral === null ? "-" : f.umbral.toFixed(1), 7) + col(estado, 7) + f.nota,
    );
  }
  lineas.push("-".repeat(118));
  const paletas = new Set(resultado.filas.map((f) => f.paleta)).size;
  lineas.push(
    `${paletas} paletas x ${TEMAS.length} temas x ${PAREJAS.length} parejas = ${resultado.filas.length} filas; ` +
      `${resultado.evaluadas} con umbral; ${resultado.fallos} fallos.`,
  );
  return lineas.join("\n");
}

/** Semántica resuelta de una paleta en los dos temas (para la galería y para `--json`). */
export function semanticaResuelta(id: PaletaId): Record<Tema, MapaSemantico> {
  const p = PALETAS[id];
  return { light: semantica(p, "light"), dark: semantica(p, "dark") };
}

/** Los roles, en orden de emisión. Reexportado aquí por comodidad de la galería. */
export const ROLES = ROLES_COLOR;
