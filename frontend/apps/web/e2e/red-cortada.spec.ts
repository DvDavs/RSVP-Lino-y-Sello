// e2e/red-cortada.spec.ts — E-12 de `04 §20.2`: red cortada A MITAD DE EDICIÓN y restaurada.
// Criterio: el indicador pasa por "sin conexión" y termina en "Guardado", SIN perder ninguna
// operación (04 §12.5/§12.8). Contra el backend real (04 §20.3): la red que se corta es la del
// propio navegador (`context.setOffline`), no un mock de la API — el servidor sigue arriba y
// escuchando todo el tiempo, exactamente como en un cliente real que entra a un túnel.
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { aplicarOperaciones, conLockDeInvitacionSembrada, invitacionSembrada, jwtDemo, revisionActual, sesionDemo } from "./preparar.ts";

test.use({ viewport: { width: 1440, height: 900 } });

/** Estado del store dentro de la página (enganche de `playwright.config.ts`). */
type Handle = {
  getState: () => {
    composed: { sections: { blocks: { id: string; type: string; provenance: string; value: { kind: string; value?: string } | null }[] }[] } | null;
    setBlock: (id: string, v: { kind: "text"; value: string }) => void;
  };
};

async function primerTextoDeUsuario(page: import("@playwright/test").Page): Promise<{ blockId: string; valor: string }> {
  const encontrado = await page.evaluate(() => {
    const s = (window as unknown as { __editorStore: Handle }).__editorStore.getState();
    for (const sec of s.composed?.sections ?? []) {
      for (const b of sec.blocks) {
        if (b.type === "text" && b.provenance === "user" && b.value?.kind === "text") {
          return { blockId: b.id, valor: b.value.value ?? "" };
        }
      }
    }
    return null;
  });
  if (!encontrado) throw new Error("La invitación sembrada no tiene ningún bloque de texto del usuario");
  return encontrado;
}

test("E-12 · red cortada a mitad de edición y restaurada: pasa por «sin conexión» y termina en «Guardado», sin perder nada", async ({
  page,
  context,
}) => {
  test.slow(); // cruza dos ventanas reales de temporización: el debounce (2 s) y el reenganche a `online`.
  // Bloque 3-6, política anti-flake (`contratos.md` §6): esta prueba mide un delta EXACTO de
  // revisión ("no avanzó mientras no había red") sobre la invitación sembrada COMPARTIDA con el
  // bloque del editor — medido en esta misma sesión: sin el mutex, una escritura AJENA que aterriza
  // durante la ventana sin red hace que la aserción de la línea 76 falle por una causa que no tiene
  // nada que ver con lo que esta prueba mide (ver `preparar.ts` para la evidencia completa).
  await conLockDeInvitacionSembrada(() => flujoRedCortada(page, context));
});

async function flujoRedCortada(page: Page, context: BrowserContext): Promise<void> {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();
  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);
  await expect(page.getByRole("radiogroup", { name: "Ver la invitación en" })).toBeVisible({ timeout: 20_000 });

  const { blockId, valor: original } = await primerTextoDeUsuario(page);
  const revisionInicial = await revisionActual(invitationId, token);
  const nuevo = `${original} · E-12 sin conexión`;

  try {
    // ── 1. Se corta la red A MITAD de editar: primero se escribe, LUEGO se corta ───────────────
    await page.evaluate(
      ([id, v]) => {
        (window as unknown as { __editorStore: Handle }).__editorStore.getState().setBlock(id as string, { kind: "text", value: v as string });
      },
      [blockId, nuevo] as const,
    );
    // El indicador ya dice "dirty" (el debounce de texto es de 2 s, `04 §12.1`) — se corta la red
    // ANTES de que el lote salga, para que sea la PRIMERA petición la que encuentre la red caída.
    await expect(page.locator("[data-save-state]")).not.toHaveAttribute("data-save-state", "idle", { timeout: 5_000 });
    await context.setOffline(true);

    // ── 2. El indicador debe decir la verdad: "Sin conexión…", persistente, no un toast ────────
    await expect(page.locator("[data-save-state]")).toHaveAttribute("data-save-state", "offline", { timeout: 15_000 });
    await expect(page.getByText("Sin conexión — tus cambios se guardarán cuando vuelva")).toBeVisible();

    // La operación sigue en la cola LOCAL — nada se descartó por el fallo de red (04 §12.5, fila 1).
    // Clave exacta de `lib/autosave.ts` `pendingStorageKey` (`tpl:pending:{invitationId}`, §12.7).
    const pendientesSinRed = await page.evaluate(
      (id) => window.localStorage.getItem(`tpl:pending:${id}`),
      invitationId,
    );
    expect(pendientesSinRed, "el borrador pendiente debe seguir en localStorage mientras no hay red (04 §12.7)").not.toBeNull();

    // Y el SERVIDOR, claro, no la recibió todavía: la revisión no avanzó.
    expect(await revisionActual(invitationId, token)).toBe(revisionInicial);

    // ── 3. Vuelve la red: el reenganche a `window.online` reintenta solo, sin que nadie haga nada ─
    await context.setOffline(false);
    await expect(page.locator("[data-save-state]")).toHaveAttribute("data-save-state", "idle", { timeout: 20_000 });
    await expect(page.getByText(/^Guardado /)).toBeVisible();

    // ── 4. Nada se perdió: el servidor SÍ tiene el texto escrito durante el corte ───────────────
    expect(await revisionActual(invitationId, token)).toBeGreaterThan(revisionInicial);
    const trasReconectar = await page.evaluate((id) => {
      const s = (window as unknown as { __editorStore: Handle }).__editorStore.getState();
      for (const sec of s.composed?.sections ?? []) for (const b of sec.blocks) if (b.id === id) return b.value?.value ?? null;
      return null;
    }, blockId);
    expect(trasReconectar).toBe(nuevo);
  } finally {
    await context.setOffline(false);
    const limpieza = await aplicarOperaciones(invitationId, token, [{ op: "setBlock", blockId, value: { kind: "text", value: original } }]);
    expect(limpieza.status).toBe(200);
  }
}
