// e2e/deshacer.spec.ts — E-02 de `04 §20.2`: escribir, deshacer, rehacer, recargar la página.
// Criterio: **tras recargar, el estado coincide con lo último confirmado**.
//
// Contra el backend REAL: si el undo mandara la operación equivocada (o no la mandara), la recarga
// lo delataría, porque el documento se relee del servidor.
import { expect, test } from "@playwright/test";
import { aplicarOperaciones, conLockDeInvitacionSembrada, invitacionSembrada, jwtDemo, revisionActual, sesionDemo } from "./preparar.ts";

test.use({ viewport: { width: 1440, height: 900 } });

/** Estado del store dentro de la página (enganche de `playwright.config.ts`, ver la página). */
type Handle = {
  getState: () => {
    composed: { sections: { key: string; visible: boolean; title: string; blocks: { id: string; type: string; provenance: string; value: { kind: string; value?: string } | null }[] }[] } | null;
    saveState: string;
    undo: { label: string }[];
    redo: { label: string }[];
    setBlock: (id: string, v: { kind: "text"; value: string }) => void;
    undoOnce: () => void;
    redoOnce: () => void;
    flushNow: () => void;
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

test("E-02 · escribir, deshacer, rehacer y recargar: el estado coincide con lo último confirmado", async ({ page }) => {
  await conLockDeInvitacionSembrada(() => flujo(page));
});

// Bloque 3-6: el cuerpo va en una función aparte para poder envolverlo ENTERO en
// `conLockDeInvitacionSembrada` (política anti-flake, `contratos.md` §6 — ver `preparar.ts` para
// la medición completa: `invitacionSembrada()` es un recurso compartido con otros siete archivos
// y sin el mutex esta prueba puede recibir el `409` de OTRA prueba a mitad de camino).
async function flujo(page: import("@playwright/test").Page): Promise<void> {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();
  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);
  await expect(page.getByRole("radiogroup", { name: "Ver la invitación en" })).toBeVisible({ timeout: 20_000 });

  const { blockId, valor: original } = await primerTextoDeUsuario(page);
  const nuevo = `${original} · E-02`;
  const revisionInicial = await revisionActual(invitationId, token);

  // ── 1. Escribir y confirmar en el servidor ───────────────────────────────────────────────
  await page.evaluate(
    ([id, v]) => {
      const s = (window as unknown as { __editorStore: Handle }).__editorStore.getState();
      s.setBlock(id as string, { kind: "text", value: v as string });
      s.flushNow();
    },
    [blockId, nuevo] as const,
  );
  await expect(page.locator("[data-save-state]")).toHaveAttribute("data-save-state", "idle", { timeout: 20_000 });
  expect(await revisionActual(invitationId, token)).toBeGreaterThan(revisionInicial);
  // El botón de deshacer dice QUÉ va a deshacer, en es-MX.
  await expect(page.getByTestId("undo")).toHaveAttribute("aria-label", /^Deshacer: /);

  // ── 2. Deshacer: la inversa viaja como operaciones NUEVAS (04 §11.3, caso 2) ──────────────
  const revisionTrasEscribir = await revisionActual(invitationId, token);
  await page.getByTestId("undo").click();
  await page.evaluate(() => (window as unknown as { __editorStore: Handle }).__editorStore.getState().flushNow());
  await expect(page.locator("[data-save-state]")).toHaveAttribute("data-save-state", "idle", { timeout: 20_000 });
  expect(await revisionActual(invitationId, token)).toBeGreaterThan(revisionTrasEscribir);

  // ── 3. Rehacer ───────────────────────────────────────────────────────────────────────────
  await page.getByTestId("redo").click();
  await page.evaluate(() => (window as unknown as { __editorStore: Handle }).__editorStore.getState().flushNow());
  await expect(page.locator("[data-save-state]")).toHaveAttribute("data-save-state", "idle", { timeout: 20_000 });

  // ── 4. Recargar: la verdad la trae `GET .../document`, no la memoria del navegador ────────
  await page.reload();
  await expect(page.getByRole("radiogroup", { name: "Ver la invitación en" })).toBeVisible({ timeout: 20_000 });
  const trasRecargar = await page.evaluate((id) => {
    const s = (window as unknown as { __editorStore: Handle }).__editorStore.getState();
    for (const sec of s.composed?.sections ?? []) {
      for (const b of sec.blocks) if (b.id === id) return b.value?.value ?? null;
    }
    return null;
  }, blockId);
  expect(trasRecargar).toBe(nuevo);
  // Las pilas arrancan vacías tras recargar: el servidor no conoce el concepto "deshacer".
  await expect(page.getByTestId("undo")).toBeDisabled();

  // ── 5. Se restaura el valor original para no ensuciar la invitación de demostración ───────
  // Por HTTP con la revisión vigente: la limpieza no debe poder tumbar una prueba ya demostrada.
  const limpieza = await aplicarOperaciones(invitationId, token, [
    { op: "setBlock", blockId, value: { kind: "text", value: original } },
  ]);
  expect(limpieza.status).toBe(200);
}

test("E-02b · deshacer antes de que salga el lote no genera tráfico (04 §11.3, caso 1)", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();
  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);
  await expect(page.getByRole("radiogroup", { name: "Ver la invitación en" })).toBeVisible({ timeout: 20_000 });

  const peticiones: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/document/operations")) peticiones.push(r.url());
  });

  const { blockId } = await primerTextoDeUsuario(page);
  await page.evaluate((id) => {
    const s = (window as unknown as { __editorStore: Handle }).__editorStore.getState();
    s.setBlock(id as string, { kind: "text", value: "borrador que se cancela" });
  }, blockId);
  await expect(page.getByTestId("undo")).toBeEnabled();

  await page.getByTestId("undo").click();
  await page.evaluate(() => (window as unknown as { __editorStore: Handle }).__editorStore.getState().flushNow());
  await expect(page.locator("[data-save-state]")).toHaveAttribute("data-save-state", /idle/, { timeout: 20_000 });
  // La operación se canceló en el borrador: NO se envió nada al servidor.
  expect(peticiones).toEqual([]);
});
