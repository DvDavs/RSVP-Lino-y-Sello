// test/fixtures/manifest.ts — el `TemplateManifest` REAL de `boda-clasica@1.0.0`, leído por SQL de
// `tpl_template_version.manifest` en esta misma sesión (no inventado, `04 §3` del brief de 3-5: "no
// lo dupliques ni lo inventes"). Es EXACTAMENTE lo que el contrato nuevo devolverá en
// `GET .../document` en cuanto el backend publique el campo — hasta entonces, sirve de fixture a las
// pruebas de componente y a `lib/manifest.ts` → `sembrarManifiestoFixture` en los e2e
// (`paneles.spec.ts`, `imagenes.spec.ts`) que necesitan el panel de contenido con datos reales.
import { TemplateManifest, ThemeSpec } from "@invitaciones/schema";
import crudo from "./boda-clasica.manifest.json" with { type: "json" };
import temaCrudo from "./boda-clasica.theme.json" with { type: "json" };

export const MANIFEST_BODA_CLASICA = TemplateManifest.parse(crudo);
/** El `theme.json` REAL (mismo origen que el manifiesto): tres paletas, dos combinaciones de
 *  tipografía. Tampoco lo promete el contrato nuevo (solo `manifest`, `contratos.md §3`); se usa
 *  igual como fixture — nunca inventado — para `ThemePicker` en pruebas y en las capturas. */
export const THEME_BODA_CLASICA = ThemeSpec.parse(temaCrudo);
export const CLAVE_BODA_CLASICA = "boda-clasica@1.0.0";
