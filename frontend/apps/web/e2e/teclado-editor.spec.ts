// e2e/teclado-editor.spec.ts — E-10 de `04 §20.2`: recorrido completo por teclado del editor SIN
// trampas de foco. Complementa `a11y.spec.ts`/`a11y-publico.spec.ts` (E-08/E-09, `axe`): `axe` no
// detecta trampas de foco dinámicas — hay que recorrer el DOM de verdad, con `Tab`/`Shift+Tab`
// reales, contra el editor REAL con una invitación cargada (no un esqueleto vacío).
//
// ALCANCE, medido y documentado, no supuesto: E-10a/b recorren el *chrome* del editor (cabecera,
// lista de secciones, apariencia) — donde ocurre TODA la edición real (04 §4: "el lienzo NO edita
// texto sobre sí mismo") — y se DETIENEN, sin fallar, en cuanto el foco entra al `<iframe>` del
// lienzo. Motivo medido, no supuesto: `document.activeElement` del documento PADRE solo informa el
// `<IFRAME>` en sí (nunca el nodo real con foco dentro), así que hay que preguntarle al FRAME por
// su propio `activeElement`; haciéndolo así, el lienzo — aislado con `sandbox` SIN
// `allow-same-origin`, ADR-031, la misma arquitectura de la compuerta A1-A8 que el bloque 3-0b ya
// midió y que E-07/`lienzo-csp.spec.ts` cubre sin volver a abrirla aquí — devuelve lecturas
// INCONSISTENTES de foco entre corridas idénticas (medido: a veces informa el mismo `<span>`
// decorativo de `SelectionOverlay.tsx` varias veces seguidas, que NI SIQUIERA tiene `tabIndex` —
// verificado leyendo el componente —, así que no puede estar recibiendo foco de verdad; es la
// instrumentación de foco entre documentos la que se confunde en la frontera del `sandbox`, no un
// bloque real del producto). Concluir "trampa real" o "sin trampa" ahí sin una auditoría dedicada
// del lienzo sería inventar un dato — se deja anotado como pendiente en `preguntas-abiertas.md`,
// no se afirma ninguna de las dos cosas.
//
// Tres comprobaciones:
//  1. E-10a — Tab hacia adelante por el *chrome*: nunca se repite el mismo control 3 veces seguidas.
//  2. E-10b — Shift+Tab hacia atrás: mismo criterio, en reversa.
//  3. E-10c — El diálogo de publicar (Radix `Dialog`, modal de verdad): mientras está abierto, `Tab`
//     debe quedarse DENTRO de él — es la contención de foco CORRECTA que un modal debe tener, lo
//     contrario de una trampa accidental — y `Escape` debe cerrarlo devolviendo el foco a quien lo
//     abrió (WCAG 2.4.3, 2.1.2).
// Nota de aislamiento (bloque 3-6, `contratos.md` §6): las tres pruebas de este archivo usan la
// invitación sembrada COMPARTIDA pero NUNCA envían una operación (ni `setBlock` ni ninguna de las
// 11) — solo navegan y mueven el foco —, así que no compiten por `baseRevision` con las pruebas del
// editor que sí escriben y van bajo `conLockDeInvitacionSembrada` (`preparar.ts`). No se bloquean
// aquí a propósito: hacerlo sin necesidad solo alargaría la corrida.
import { expect, test } from "@playwright/test";
import { invitacionSembrada, jwtDemo, sesionDemo } from "./preparar.ts";

test.use({ viewport: { width: 1440, height: 900 } });

/** Nombre estable de `document.activeElement` EN EL DOCUMENTO PADRE (el *chrome*), o `null` si no
 *  hay ninguno (foco perdido en `<body>`) o si el foco está DENTRO del `<iframe>` del lienzo —
 *  este helper no drena la frontera del `sandbox` a propósito, ver la cabecera del archivo. */
function focoDelChrome(): "IFRAME" | string | null {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  if (el.tagName === "IFRAME") return "IFRAME";
  const testid = el.getAttribute("data-testid");
  const id = el.id;
  const texto = (el.textContent ?? "").trim().slice(0, 40);
  return `${el.tagName}${id ? "#" + id : ""}${testid ? "[data-testid=" + testid + "]" : ""}::${texto}`;
}

test("E-10a · Tab hacia adelante por el editor: nunca se pierde ni se atasca el foco", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();
  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);
  await expect(page.getByRole("radiogroup", { name: "Ver la invitación en" })).toBeVisible({ timeout: 20_000 });
  await expect(page.frameLocator('iframe[title="Vista previa de la invitación"]').locator(".lienzo-raiz")).toBeVisible({
    timeout: 20_000,
  });

  const visitados = new Set<string>();
  let anterior: string | null = null;
  let repeticionesSeguidas = 0;
  const PULSACIONES = 60; // de sobra para agotar el *chrome*: cabecera + 12 filas + apariencia.
  let llegoAlLienzo = false;
  for (let i = 0; i < PULSACIONES; i++) {
    await page.keyboard.press("Tab");
    const leido = await page.evaluate(focoDelChrome);
    if (leido === "IFRAME") {
      llegoAlLienzo = true; // fin del recorrido del *chrome* — no es un fallo, ver cabecera.
      break;
    }
    if (leido !== null) {
      repeticionesSeguidas = leido === anterior ? repeticionesSeguidas + 1 : 0;
      expect(
        repeticionesSeguidas,
        `el foco lleva ${repeticionesSeguidas + 1} pulsaciones de Tab seguidas SIN moverse de "${leido}" — trampa de foco`,
      ).toBeLessThan(3);
      visitados.add(leido);
    } else {
      repeticionesSeguidas = 0;
    }
    anterior = leido;
  }
  expect(llegoAlLienzo, `${PULSACIONES} Tab no llegaron a alcanzar el lienzo — ¿la página tiene menos controles de los esperados?`).toBe(
    true,
  );
  // El *chrome* de una invitación de 12 secciones tiene bastante más que un puñado de controles:
  // cabecera, cada fila (asa + botón + interruptor/etiqueta + menú) y el selector de apariencia.
  expect(visitados.size, `el recorrido del *chrome* solo visitó ${visitados.size} controles distintos`).toBeGreaterThan(15);
  const llegaAPublicar = [...visitados].some((v) => v.includes("abrir-publicar"));
  expect(llegaAPublicar, `el botón «Publicar» debe alcanzarse por teclado (visitados: ${[...visitados].join(" | ")})`).toBe(true);
});

test("E-10b · Shift+Tab hacia atrás: el recorrido también funciona en reversa", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();
  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);
  await expect(page.getByRole("radiogroup", { name: "Ver la invitación en" })).toBeVisible({ timeout: 20_000 });

  // Se avanza primero para no arrancar ya en el primer elemento (donde Shift+Tab no tendría a
  // dónde ir dentro de la página y el navegador saldría de ella — no es lo que se quiere medir).
  for (let i = 0; i < 15; i++) await page.keyboard.press("Tab");

  let anteriorNoNulo: string | null = null;
  let repeticionesSeguidas = 0;
  const visitados = new Set<string>();
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Shift+Tab");
    const leido = await page.evaluate(focoDelChrome);
    if (leido === "IFRAME") break; // wrapping-around hasta el lienzo: fin del *chrome*, no un fallo.
    if (leido !== null) {
      repeticionesSeguidas = leido === anteriorNoNulo ? repeticionesSeguidas + 1 : 0;
      expect(repeticionesSeguidas, `Shift+Tab #${i + 1} atascado en "${leido}"`).toBeLessThan(3);
      visitados.add(leido);
      anteriorNoNulo = leido;
    }
  }
  expect(visitados.size).toBeGreaterThan(3);
});

test("E-10c · el diálogo de publicar SÍ contiene el foco mientras está abierto, y Escape lo cierra devolviendo el foco", async ({
  page,
}) => {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();
  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);
  await expect(page.getByTestId("abrir-publicar")).toBeEnabled({ timeout: 20_000 });

  await page.getByTestId("abrir-publicar").focus();
  await page.keyboard.press("Enter");
  const dialogo = page.getByTestId("publish-dialog");
  await expect(dialogo).toBeVisible();
  // Radix `Dialog` mueve el foco dentro al abrir (WCAG 2.4.3): el nodo activo debe estar DENTRO.
  await expect(async () => {
    const dentro = await page.evaluate(() => {
      const dlg = document.querySelector('[data-testid="publish-dialog"]');
      return Boolean(dlg && document.activeElement && dlg.contains(document.activeElement));
    });
    expect(dentro).toBe(true);
  }).toPass({ timeout: 5_000 });

  // Diez `Tab` no deben sacar el foco del diálogo — esa es la contención CORRECTA de un modal,
  // no una trampa: lo distingue el hecho de que el propio diálogo se puede cerrar con `Escape`.
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    const dentro = await page.evaluate(() => {
      const dlg = document.querySelector('[data-testid="publish-dialog"]');
      return Boolean(dlg && document.activeElement && dlg.contains(document.activeElement));
    });
    expect(dentro, `Tab #${i + 1} dentro del diálogo se escapó a un elemento de detrás`).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden({ timeout: 5_000 });
  // El foco vuelve a quien abrió el diálogo — sin esto, tras cerrar, el foco cae al principio del
  // documento y hay que recorrer TODA la barra otra vez para seguir editando (WCAG 2.4.3).
  await expect(page.getByTestId("abrir-publicar")).toBeFocused();
});
