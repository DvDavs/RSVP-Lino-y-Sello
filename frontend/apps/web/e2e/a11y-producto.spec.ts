// e2e/a11y-producto.spec.ts — 3C-8: compuerta de accesibilidad del PRODUCTO completo, contra el
// backend real. Distinta de `a11y.spec.ts`/`a11y-pantallas-nuevas.spec.ts` (que solo exigen 0
// violaciones `critical`/`serious`) en dos puntos que pide el brief del bloque:
//
//   1. Aquí se exige `violations` VACÍO por completo (cualquier impacto), no solo grave/crítico.
//   2. `incomplete` de axe NO se ignora. `contratos.md §12.4` dejó documentado que axe devuelve
//      SIEMPRE `incomplete: ["color-contrast"]` en cuanto hay un solo degradado en la página —
//      pasa o falla el contraste real, exactamente igual — así que esa entrada puntual es la ÚNICA
//      tolerada en TODAS las pantallas (el contraste real lo mide `medirContraste`, más abajo,
//      sobre la pila renderizada, no sobre lo que `axe` no pudo decidir).
//
//      Con un `Dialog` MODAL abierto (pantalla «publicar») se tolera además `aria-hidden-focus`,
//      Y SOLO AHÍ (parámetro `toleraFocoDeDialogoModal` de `auditoriaAxe`): Radix pone
//      `aria-hidden="true"` en TODO lo de fuera del diálogo (`hideOthers`, el mismo mecanismo que
//      documentó `bitacora/3c-b2-f3.md` para la galería) y dos `<span data-radix-focus-guard>`
//      centinela dentro — el mecanismo con el que `FocusScope` atrapa el foco (igual que
//      `react-focus-lock`). Esos nodos aria-hidden SIGUEN teniendo botones/enlaces reales dentro
//      (para que reaparezcan intactos al cerrar el diálogo), y axe no puede verificar de forma
//      estática si de verdad son alcanzables por Tab mientras el `FocusScope` está activo — de ahí
//      `incomplete`, no una violación. Que NO lo sean de verdad ya está PROBADO, no solo asumido:
//      `e2e/teclado-editor.spec.ts:124` mueve el foco con Tab dentro de este mismo diálogo abierto
//      y confirma que nunca sale de él. Mismo `id` de regla que `preguntas-abiertas.md § 3c-7`
//      dejó anotado como no arreglable desde `packages/sections` — ahí SÍ es una violación real
//      (un `backdrop` con foco atrapable de verdad); aquí es el patrón esperado de un Dialog de
//      Radix correctamente trampeado. Cualquier OTRA regla sí hace fallar la prueba: `incomplete`
//      no es un aprobado por defecto.
//
// Pantallas: landing, acceso, ayuda, los cuatro pasos del asistente, el editor, publicar y el 404
// (brief 3c-8-e2e-presupuestos.md). Contraste sobre pila renderizada (`design-contraste.spec.ts`,
// extraído a `./util/contraste.ts`) en tres de ellas: landing (foto+texto, `ADR-3-i05b-01`), acceso
// (formulario) y editor (chrome más denso). El resto ya se cubre por la galería `/design` (mismos
// componentes, mismos tokens) — repetir las nueve pantallas sería medir dos veces lo mismo.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { invitacionSinDocumento, jwtDemo, sesionDemo, borrarInvitacion } from "./preparar.ts";
import { medirContraste } from "./util/contraste.ts";

interface OpcionesAuditoria {
  /** Deja fuera el lienzo (`packages/sections`, zona prohibida de este bloque — mismo criterio que
   *  `editor-3c-evidencia.spec.ts`): lo que se audita aquí es el CHROME del producto. */
  excluirLienzo?: boolean;
  /** Tolera `aria-hidden-focus` además de `color-contrast` — SOLO para la pantalla con un `Dialog`
   *  MODAL abierto (ver el porqué en la cabecera del archivo). */
  toleraFocoDeDialogoModal?: boolean;
}

const REGLAS_INCOMPLETAS_TOLERADAS_SIEMPRE = new Set(["color-contrast"]);
const REGLAS_INCOMPLETAS_TOLERADAS_CON_DIALOGO_MODAL = new Set(["color-contrast", "aria-hidden-focus"]);

async function auditoriaAxe(page: Page, donde: string, opciones: OpcionesAuditoria = {}): Promise<void> {
  const constructor = new AxeBuilder({ page });
  if (opciones.excluirLienzo) constructor.exclude("iframe");
  const resultados = await constructor.analyze();

  expect(resultados.violations, `${donde} — violaciones axe:\n${JSON.stringify(resultados.violations, null, 2)}`).toEqual(
    [],
  );

  const toleradas = opciones.toleraFocoDeDialogoModal
    ? REGLAS_INCOMPLETAS_TOLERADAS_CON_DIALOGO_MODAL
    : REGLAS_INCOMPLETAS_TOLERADAS_SIEMPRE;
  const incompletasNoToleradas = resultados.incomplete.filter((regla) => !toleradas.has(regla.id));
  expect(
    incompletasNoToleradas,
    `${donde} — incompletas de axe no toleradas (${[...toleradas].join(", ")} sí lo están aquí; ver cabecera del archivo):\n` +
      JSON.stringify(incompletasNoToleradas, null, 2),
  ).toEqual([]);
}

async function sinParejasPorDebajoDeUmbral(page: Page, donde: string): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const resultado = await page.evaluate(medirContraste);
  const fallos = resultado.filter((fila) => !fila.ok);
  expect(
    fallos,
    `${donde}: ${resultado.length} elementos medidos, ${fallos.length} por debajo de su umbral:\n${JSON.stringify(fallos, null, 2)}`,
  ).toEqual([]);
}

test.describe.configure({ mode: "parallel" });

test("landing (/): axe sin violaciones ni incompletas, contraste sobre la pila renderizada", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await auditoriaAxe(page, "landing");
  await sinParejasPorDebajoDeUmbral(page, "landing");
});

test("acceso (/acceso): axe sin violaciones ni incompletas, contraste sobre la pila renderizada", async ({ page }) => {
  await page.goto("/acceso");
  await expect(page.getByRole("heading", { name: "Entra a tu cuenta" })).toBeVisible();
  await auditoriaAxe(page, "acceso");
  await sinParejasPorDebajoDeUmbral(page, "acceso");

  // La segunda pestaña (Crear cuenta) es una disposición distinta: mismo criterio de exigencia.
  await page.getByRole("tab", { name: "Crear cuenta" }).click();
  await expect(page.getByRole("heading", { name: "Crea tu cuenta" })).toBeVisible();
  await auditoriaAxe(page, "acceso · crear cuenta");
});

test("ayuda (/ayuda): axe sin violaciones ni incompletas", async ({ page }) => {
  await page.goto("/ayuda");
  await expect(page.getByRole("heading", { name: "¿En qué te ayudamos?", level: 1 })).toBeVisible();
  await auditoriaAxe(page, "ayuda");
});

test("404 público (/i/<token inexistente>): axe sin violaciones ni incompletas", async ({ page }) => {
  await page.goto(`/i/token-que-no-existe-${Date.now()}`);
  await expect(page.getByRole("heading", { name: "Esta invitación ya no está disponible" })).toBeVisible();
  await auditoriaAxe(page, "404 público");
});

test("asistente de creación, los cuatro pasos: axe sin violaciones ni incompletas en cada uno", async ({ page }) => {
  test.slow();
  const token = await jwtDemo();
  const invitationId = invitacionSinDocumento();
  try {
    await sesionDemo(page, token);
    await page.goto(`/editor?inv=${invitationId}`);

    // Paso 1 — tipo de evento.
    await expect(page.getByRole("heading", { name: "¿Qué vamos a celebrar?", level: 1 })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Paso 1 de 4")).toBeVisible();
    await auditoriaAxe(page, "asistente · paso 1 (tipo de evento)");
    await page.getByTestId("asistente-continuar").click();

    // Paso 2 — plantilla.
    await expect(page.getByRole("heading", { name: "Elige el punto de partida", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Boda clásica", level: 2 })).toBeVisible({ timeout: 20_000 });
    await auditoriaAxe(page, "asistente · paso 2 (plantilla)");
    await page.getByTestId("asistente-usar-boda-clasica").click();

    // Paso 3 — datos básicos.
    await expect(page.getByRole("heading", { name: "Los datos básicos", level: 1 })).toBeVisible({ timeout: 30_000 });
    await auditoriaAxe(page, "asistente · paso 3 (datos básicos)");
    await page.getByTestId("asistente-continuar").click();

    // Paso 4 — listo.
    await expect(page.getByRole("heading", { name: "Tu invitación ya tiene diseño", level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await auditoriaAxe(page, "asistente · paso 4 (listo)");
  } finally {
    borrarInvitacion(invitationId);
  }
});

test("editor y publicar: axe sin violaciones ni incompletas, contraste sobre la pila renderizada", async ({ page }) => {
  test.slow();
  const token = await jwtDemo();
  const invitationId = invitacionSinDocumento();
  try {
    await sesionDemo(page, token);
    // Camino corto al editor con plantilla ya aplicada: elegir en el asistente y abrir.
    await page.goto(`/editor?inv=${invitationId}`);
    await expect(page.getByRole("heading", { name: "¿Qué vamos a celebrar?", level: 1 })).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("asistente-continuar").click();
    await expect(page.getByRole("heading", { name: "Boda clásica", level: 2 })).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("asistente-usar-boda-clasica").click();
    await expect(page.getByRole("heading", { name: "Los datos básicos", level: 1 })).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("asistente-continuar").click();
    await expect(page.getByRole("heading", { name: "Tu invitación ya tiene diseño", level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("asistente-abrir-editor").click();
    await expect(page).toHaveURL(new RegExp(`/editor/${invitationId}$`), { timeout: 30_000 });

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByRole("heading", { name: "Secciones" })).toBeVisible({ timeout: 30_000 });
    await auditoriaAxe(page, "editor · lista de secciones", { excluirLienzo: true });
    await sinParejasPorDebajoDeUmbral(page, "editor · lista de secciones");

    await page.getByTestId("abrir-publicar").click();
    await expect(page.getByRole("dialog", { name: "Publicar invitación" })).toBeVisible({ timeout: 20_000 });
    await auditoriaAxe(page, "publicar · diálogo", { excluirLienzo: true, toleraFocoDeDialogoModal: true });
    await page.keyboard.press("Escape");
  } finally {
    borrarInvitacion(invitationId);
  }
});
