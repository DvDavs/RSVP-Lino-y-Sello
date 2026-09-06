// e2e/util/design-galeria.ts — utilidades compartidas por `design.spec.ts`, `design-contraste.spec.ts`
// y `design-axe.spec.ts` (fase 3-C, bloque 2, F3): la lista de páginas de la galería (crece sola con
// el registro de historias, `@invitaciones/ui/historias` — SOLO código de test/Node importa ese
// subpath directamente; ver el porqué de la restricción en `packages/ui/src/historias/registro.ts`)
// y el cambio de tema sin la carrera contra la transición de color (medida, ver más abajo).
import type { Page } from "@playwright/test";
import { registro } from "@invitaciones/ui/historias";

export interface PaginaGaleria {
  readonly ruta: string;
  readonly nombre: string;
}

/** Páginas fijas de `/design` (bloque 1: tokens/tipografía/iconos/formas; bloque 2: componentes). */
export const PAGINAS_FIJAS: readonly PaginaGaleria[] = [
  { ruta: "/design", nombre: "indice" },
  { ruta: "/design/tokens", nombre: "tokens" },
  { ruta: "/design/tipografia", nombre: "tipografia" },
  { ruta: "/design/iconos", nombre: "iconos" },
  { ruta: "/design/formas", nombre: "formas" },
  { ruta: "/design/componentes", nombre: "componentes-indice" },
];

/**
 * Todas las páginas de la galería: las fijas más una por historia registrada. Si el registro está
 * vacío (worktree con solo una parte del bloque 2) esto no falla, solo devuelve las fijas — la
 * galería, y esta lista, funcionan con lo que haya (ajuste del orquestador, 3c-b2-f3 §1/§3).
 */
export function paginasDeGaleria(): readonly PaginaGaleria[] {
  const deComponentes = registro.map((historia) => ({
    ruta: `/design/componentes/${historia.slug}`,
    nombre: `componente-${historia.slug}`,
  }));
  return [...PAGINAS_FIJAS, ...deComponentes];
}

export const TEMAS = ["light", "dark"] as const;
export type Tema = (typeof TEMAS)[number];

const ETIQUETA_TEMA: Record<Tema, string> = { light: "Claro", dark: "Oscuro" };

/**
 * Dos correcciones sobre lo obvio ("entrar y hacer clic"), ambas MEDIDAS en este bloque (ver
 * `bitacora/3c-b2-f3.md`):
 *
 * 1. `congelarMovimiento` ANTES de cualquier interacción: el conmutador de tema (`navegacion.tsx`)
 *    usa `transition-colors duration-[var(--ui-dur-1)]` — no está condicionado a
 *    `prefers-reduced-motion` (es una utilidad de Tailwind normal, no una animación de formas), así
 *    que `reducedMotion: "reduce"` del contexto NO lo apaga. Sin esto, medir justo después del clic
 *    (incluso tras `document.fonts.ready`, que resuelve casi al instante) captura un color A MITAD
 *    de la transición: se midió `ratio ≈ 1.2` en los enlaces de la navegación en vez de los ≈ 15-18
 *    reales, un falso positivo de contraste, no un fallo real del sistema.
 * 2. El cambio de tema es un `useState` de React dentro de `MarcoDeTema`: `page.click()` espera a
 *    que el evento se despache, no a que termine ninguna transición CSS que ese cambio dispare.
 */
export async function congelarMovimiento(page: Page): Promise<void> {
  await page.addStyleTag({
    content: "*, *::before, *::after { transition: none !important; animation: none !important; }",
  });
}

/**
 * Cambia el tema de la galería con el conmutador visible (`role="group"`, botones Claro/Oscuro).
 * Llama primero a `congelarMovimiento` (nota 1 de arriba) — este helper no lo hace por su cuenta
 * porque `design.spec.ts` necesita inyectarlo ANTES de la primera captura en claro también, no solo
 * antes de pasar a oscuro.
 */
export async function cambiarTema(page: Page, tema: Tema): Promise<void> {
  if (tema === "light") return; // la galería arranca siempre en claro (MarcoDeTema, estado inicial).
  await page.getByRole("button", { name: ETIQUETA_TEMA[tema] }).click();
  await page.getByRole("button", { name: ETIQUETA_TEMA[tema] }).evaluate(async () => {
    await new Promise((resuelve) => requestAnimationFrame(() => requestAnimationFrame(resuelve)));
  });
}
