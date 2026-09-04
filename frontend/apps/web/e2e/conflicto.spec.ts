// e2e/conflicto.spec.ts — E-06 de `04 §20.2`: **dos contextos de navegador** editan la misma
// invitación; el segundo recibe `409 TPL_REVISION_CONFLICT`.
// Criterio: aparece el diálogo de §12.6 y **ninguna de las dos ediciones se pierde en silencio**.
//
// Dos CONTEXTOS distintos a propósito: el candado de `BroadcastChannel` (§12.6 (a)) elimina el caso
// de dos pestañas del mismo navegador, así que un conflicto real exige dos navegadores. Es también
// la prueba de que esa prevención no tapa el caso que sí importa.
import { existsSync, mkdirSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { API_BASE, aplicarOperaciones, invitacionSembrada, jwtDemo, revisionActual, sesionDemo } from "./preparar.ts";

const EVIDENCIA = new URL("../../../../docs/rediseno-plantillas/evidencia/fase-3/editor/", import.meta.url).pathname;
if (!existsSync(EVIDENCIA)) mkdirSync(EVIDENCIA, { recursive: true });

test.use({ viewport: { width: 1440, height: 900 } });

type Handle = {
  getState: () => {
    composed: { sections: { blocks: { id: string; type: string; provenance: string; value: { kind: string; value?: string } | null }[] }[] } | null;
    revision: number;
    saveState: string;
    conflict: { currentRevision: number; pending: unknown[] } | null;
    setBlock: (id: string, v: { kind: "text"; value: string }) => void;
    flushNow: () => void;
  };
};

async function abrirEditor(contexto: BrowserContext, token: string, invitationId: number): Promise<Page> {
  const page = await contexto.newPage();
  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);
  await expect(page.getByRole("radiogroup", { name: "Ver la invitación en" })).toBeVisible({ timeout: 20_000 });
  return page;
}

async function primerTexto(page: Page): Promise<{ blockId: string; valor: string }> {
  const r = await page.evaluate(() => {
    const s = (window as unknown as { __editorStore: Handle }).__editorStore.getState();
    for (const sec of s.composed?.sections ?? []) {
      for (const b of sec.blocks) {
        if (b.type === "text" && b.provenance === "user" && b.value?.kind === "text") return { blockId: b.id, valor: b.value.value ?? "" };
      }
    }
    return null;
  });
  if (!r) throw new Error("La invitación sembrada no tiene ningún bloque de texto del usuario");
  return r;
}

async function escribirYGuardar(page: Page, blockId: string, valor: string): Promise<void> {
  await page.evaluate(
    ([id, v]) => {
      const s = (window as unknown as { __editorStore: Handle }).__editorStore.getState();
      s.setBlock(id as string, { kind: "text", value: v as string });
      s.flushNow();
    },
    [blockId, valor] as const,
  );
}

test("E-06 · dos navegadores editan lo mismo: el segundo ve el diálogo y nada se pierde en silencio", async ({ browser }) => {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();

  const contextoA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const contextoB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const paginaA = await abrirEditor(contextoA, token, invitationId);
    const paginaB = await abrirEditor(contextoB, token, invitationId);
    // Contextos distintos ⇒ `BroadcastChannel` no los ve: los dos son editores.
    await expect(paginaA.getByText("Esta invitación ya está abierta en otra pestaña.")).toHaveCount(0);
    await expect(paginaB.getByText("Esta invitación ya está abierta en otra pestaña.")).toHaveCount(0);

    const { blockId, valor: original } = await primerTexto(paginaA);
    const revisionInicial = await revisionActual(invitationId, token);

    // ── A guarda primero: la revisión del servidor avanza ──────────────────────────────────
    await escribirYGuardar(paginaA, blockId, `${original} · desde A`);
    await expect(paginaA.locator("[data-save-state]")).toHaveAttribute("data-save-state", "idle", { timeout: 20_000 });
    const revisionDeA = await revisionActual(invitationId, token);
    expect(revisionDeA).toBeGreaterThan(revisionInicial);

    // ── B, que sigue en la revisión vieja, guarda: `409 TPL_REVISION_CONFLICT` ─────────────
    await escribirYGuardar(paginaB, blockId, `${original} · desde B`);
    const dialogo = paginaB.getByTestId("conflict-dialog");
    await expect(dialogo).toBeVisible({ timeout: 20_000 });
    await expect(dialogo.getByText("Esta invitación cambió en otro lugar")).toBeVisible();
    // Las TRES opciones, con la conservadora por defecto (§12.6 (b)).
    await expect(dialogo.getByRole("radio")).toHaveCount(3);
    await expect(dialogo.getByRole("radio").first()).toBeChecked();
    await paginaB.screenshot({ path: `${EVIDENCIA}conflicto.png` });

    // NADA se pierde en silencio: la edición de B sigue en la cola y el diálogo la cuenta.
    const estadoB = await paginaB.evaluate(() => {
      const s = (window as unknown as { __editorStore: Handle }).__editorStore.getState();
      return { saveState: s.saveState, pendientes: s.conflict?.pending.length ?? 0, revisionServidor: s.conflict?.currentRevision ?? null };
    });
    expect(estadoB.saveState).toBe("conflict");
    expect(estadoB.pendientes).toBeGreaterThan(0);
    expect(estadoB.revisionServidor).toBe(revisionDeA);
    // La edición de A tampoco se ha perdido: sigue en el servidor.
    const enServidor = await fetch(`${API_BASE}/editor/invitations/${invitationId}/document`, {
      headers: { authorization: `Bearer ${token}` },
    }).then((r) => r.json() as Promise<{ document: { content: Record<string, { value?: string }> } }>);
    expect(enServidor.document.content[blockId]?.value).toBe(`${original} · desde A`);

    // ── B elige la opción conservadora: trae la versión nueva y lo dice ────────────────────
    await paginaB.getByTestId("conflict-continue").click();
    await expect(dialogo).toHaveCount(0, { timeout: 20_000 });
    await expect(paginaB.getByTestId("aviso").filter({ hasText: "descartaron" })).toBeVisible();
    const trasResolver = await paginaB.evaluate((id) => {
      const s = (window as unknown as { __editorStore: Handle }).__editorStore.getState();
      for (const sec of s.composed?.sections ?? []) for (const b of sec.blocks) if (b.id === id) return b.value?.value ?? null;
      return null;
    }, blockId);
    expect(trasResolver).toBe(`${original} · desde A`);

    // ── Limpieza: se devuelve el valor original a la invitación de demostración ────────────
    const limpieza = await aplicarOperaciones(invitationId, token, [
      { op: "setBlock", blockId, value: { kind: "text", value: original } },
    ]);
    expect(limpieza.status).toBe(200);
  } finally {
    await contextoA.close();
    await contextoB.close();
  }
});

test("E-06b · dos PESTAÑAS del mismo navegador no llegan a chocar: la segunda entra en solo lectura", async ({ context }) => {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();
  const paginaA = await abrirEditor(context, token, invitationId);
  const paginaB = await abrirEditor(context, token, invitationId);

  // §12.6 (a): prevención antes que resolución. Elimina el caso más común del 409.
  await expect(paginaB.getByText("Esta invitación ya está abierta en otra pestaña.")).toBeVisible({ timeout: 10_000 });
  await expect(paginaA.getByText("Esta invitación ya está abierta en otra pestaña.")).toHaveCount(0);

  // "Editar aquí de todas formas" toma el control y degrada a la primera.
  await paginaB.getByRole("button", { name: "Editar aquí de todas formas" }).click();
  await expect(paginaA.getByText("Esta invitación ya está abierta en otra pestaña.")).toBeVisible({ timeout: 10_000 });
  await paginaA.close();
  await paginaB.close();
});
