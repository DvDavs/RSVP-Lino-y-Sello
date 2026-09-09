// test/check-peso-fuente.test.ts — la compuerta del PESO tipográfico, no sólo de la familia
// (ADR-4-1E-01, bitácora 4-1e).
//
// El defecto real que cierra este archivo: `frontend/templates/cumple-retro/1.0.0` declaraba
// `body: {family:"Inter", weights:[400,600]}` y `check` lo daba por bueno (0 errores, 0 avisos)
// porque `TPL_FONT_NOT_SELF_HOSTED` comprobaba la FAMILIA, nunca el PESO — Inter 600 no existe en
// `apps/web/app/(public)/publico.css` (que sólo autoaloja 400/500), así que esa invitación se
// pintaba con la pila de reserva (Georgia / la sans del sistema) y nada avisaba. La única red que lo
// cazó fue `apps/web/test/fuentes-autoalojadas.test.ts`, de OTRO paquete.
//
// Cada aserción compara la CADENA ENTERA del mensaje (`toBe`, no `toContain`), igual que
// `check-sabotajes.test.ts`: el criterio no es que el hallazgo exista, es que baste para arreglar
// el paquete sin abrir código.
import { describe, expect, it } from "vitest";
import { check } from "../src/check.ts";
import { copiarPaquete, escribirTema, leerTema, mensajeDe } from "./ayuda.ts";

type J = Record<string, any>;

describe("check: el PESO tipográfico, no sólo la familia (ADR-4-1E-01)", () => {
  it("un peso que la familia autoalojada NO importa es ERROR, con los pesos que sí hay y cuál poner", () => {
    const dir = copiarPaquete("bautizo-elegante/1.0.0");
    const tema = leerTema(dir) as J;
    // La familia SÍ está autoalojada (Inter); el peso 600 del cuerpo, no — publico.css sólo importa
    // Inter 400/500. Es el MISMO fallo que tenía cumple-retro/1.0.0 antes de este bloque.
    tema["fontSets"][0].body.weights = [400, 600];
    escribirTema(dir, tema);
    expect(mensajeDe(dir, "TPL_FONT_WEIGHT_NOT_SELF_HOSTED")).toBe(
      'ERROR TPL_FONT_WEIGHT_NOT_SELF_HOSTED  theme.json#/fontSets/0/body/weights/1\n'
      + '  El fontSet "cormorant-garamond-inter" declara el peso 600 de "Inter" en body y la superficie '
      + 'pública NO lo autoaloja (sólo 400, 500): esa invitación se pintaría con la pila de reserva '
      + '(Georgia / la sans del sistema).\n'
      + '  Sugerencia: Pesos que "Inter" autoaloja hoy en apps/web/app/(public)/publico.css: 400, 500. '
      + 'Pon uno de esos en theme.json, o autoaloja el 600 (añade `@import "@fontsource/inter/600.css"` '
      + 'a publico.css): la superficie pública nunca pide una fuente a un tercero en tiempo de '
      + 'ejecución (ADR-1R-F-07).',
    );
  });

  it("el mismo fallo en el TITULAR (heading), con su propio puntero", () => {
    const dir = copiarPaquete("bautizo-elegante/1.0.0");
    const tema = leerTema(dir) as J;
    // Cormorant Garamond se autoaloja en 400/600: 700 no existe.
    tema["fontSets"][0].heading.weights = [400, 700];
    escribirTema(dir, tema);
    expect(mensajeDe(dir, "TPL_FONT_WEIGHT_NOT_SELF_HOSTED")).toBe(
      'ERROR TPL_FONT_WEIGHT_NOT_SELF_HOSTED  theme.json#/fontSets/0/heading/weights/1\n'
      + '  El fontSet "cormorant-garamond-inter" declara el peso 700 de "Cormorant Garamond" en heading '
      + 'y la superficie pública NO lo autoaloja (sólo 400, 600): esa invitación se pintaría con la '
      + 'pila de reserva (Georgia / la sans del sistema).\n'
      + '  Sugerencia: Pesos que "Cormorant Garamond" autoaloja hoy en apps/web/app/(public)/publico.css: '
      + '400, 600. Pon uno de esos en theme.json, o autoaloja el 700 (añade '
      + '`@import "@fontsource/cormorant-garamond/700.css"` a publico.css): la superficie pública nunca '
      + 'pide una fuente a un tercero en tiempo de ejecución (ADR-1R-F-07).',
    );
  });

  it("una familia NO autoalojada no dobla el hallazgo con el de peso: sólo se reporta la familia", () => {
    // Si la familia entera va a sustituirse, comprobar además sus pesos sería ruido duplicado
    // (motivo escrito en el propio `revisarFuentes`, check.ts).
    const dir = copiarPaquete("bautizo-elegante/1.0.0");
    const tema = leerTema(dir) as J;
    tema["fontSets"][0].heading = { family: "Great Vibes", weights: [400, 900], source: "google" };
    escribirTema(dir, tema);
    const codigos = check({ dir, escribir: false }).hallazgos.map(h => h.codigo);
    expect(codigos).toContain("TPL_FONT_NOT_SELF_HOSTED");
    expect(codigos).not.toContain("TPL_FONT_WEIGHT_NOT_SELF_HOSTED");
  });

  it("los pesos reales de las plantillas publicadas no disparan la compuerta (regresión de cumple-retro/1.0.0)", () => {
    // cumple-retro/1.0.0 declaraba `body Inter [400,600]` (ADR-4-1E-01, arreglado en este bloque).
    // Ahora ninguna de las plantillas publicadas dispara TPL_FONT_WEIGHT_NOT_SELF_HOSTED.
    for (const slug of ["bautizo-elegante/1.0.0", "cumple-retro/1.0.0", "xv-jardin/1.0.0"]) {
      const dir = copiarPaquete(slug);
      const codigos = check({ dir, escribir: false }).hallazgos.map(h => h.codigo);
      expect(codigos, slug).not.toContain("TPL_FONT_WEIGHT_NOT_SELF_HOSTED");
    }
  });
});
