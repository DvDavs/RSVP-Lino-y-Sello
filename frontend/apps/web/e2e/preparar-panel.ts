// e2e/preparar-panel.ts — utilidades de MI bloque (3-5) para los e2e del panel de contenido,
// aparte de `preparar.ts` (de 3-4, no se toca). Dos cosas nuevas:
//
// 1. `sembrarManifiesto`: el contrato nuevo («GET .../document gana un campo `manifest`») todavía no
//    llega por HTTP (`bitacora/3-5.md` §1). `secciones.spec.ts`/`publicar.spec.ts` no lo necesitan
//    (reordenar y publicar no dependen del manifiesto); `paneles.spec.ts`/`imagenes.spec.ts` sí, para
//    poder ejercer el panel de contenido de verdad. Se siembra el manifiesto REAL de
//    `boda-clasica@1.0.0` (leído por SQL de `tpl_template_version.manifest` en esta sesión, no
//    inventado) a través de `window.__seedManifestFixture`, el mismo enganche de
//    `NEXT_PUBLIC_E2E_HOOKS=1` que ya usa `window.__editorStore` — el resto del flujo (documento,
//    operaciones, assets, publicación) sigue siendo el backend real, sin mocks (04 §20.3).
// 2. `documentoActual`/`restaurarBloque`: leer y devolver un bloque de contenido a su valor original
//    por HTTP, para no ensuciar la invitación de demostración entre corridas.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { API_BASE, aplicarOperaciones, invitacionSinDocumento, revisionActual } from "./preparar.ts";

const FOTO_CUADRADA = fileURLToPath(new URL("./fixtures/foto-prueba.png", import.meta.url));
const FOTO_VERTICAL = fileURLToPath(new URL("./fixtures/foto-vertical.png", import.meta.url));

const RUTA_MANIFIESTO = fileURLToPath(new URL("../test/fixtures/boda-clasica.manifest.json", import.meta.url));
const RUTA_TEMA = fileURLToPath(new URL("../test/fixtures/boda-clasica.theme.json", import.meta.url));
export const MANIFIESTO_BODA_CLASICA: unknown = JSON.parse(readFileSync(RUTA_MANIFIESTO, "utf8"));
export const TEMA_BODA_CLASICA: unknown = JSON.parse(readFileSync(RUTA_TEMA, "utf8"));
export const CLAVE_BODA_CLASICA = "boda-clasica@1.0.0";

type SemillaManifiesto = (invitationId: number, templateVersion: string, manifest: unknown, theme: unknown) => void;

/**
 * Debe llamarse DESPUÉS de `page.goto` (el gancho lo monta el `useEffect` de la página). Siembra
 * también `theme.json` (tres paletas reales, `boda-clasica.theme.json`): tampoco lo promete el
 * contrato nuevo, pero sin él `ThemePicker` no tiene presets que mostrar en las capturas ni en los
 * e2e que lo ejercen de verdad.
 */
export async function sembrarManifiesto(page: Page, invitationId: number): Promise<void> {
  await page.waitForFunction(() => Boolean((window as unknown as { __seedManifestFixture?: unknown }).__seedManifestFixture));
  await page.evaluate(
    ([id, clave, manifest, theme]) => {
      (window as unknown as { __seedManifestFixture: SemillaManifiesto }).__seedManifestFixture(
        id as number,
        clave as string,
        manifest,
        theme,
      );
    },
    [invitationId, CLAVE_BODA_CLASICA, MANIFIESTO_BODA_CLASICA, TEMA_BODA_CLASICA] as const,
  );
}

export async function documentoActual(invitationId: number, token: string): Promise<{ revision: number; content: Record<string, unknown> }> {
  const r = await fetch(`${API_BASE}/editor/invitations/${invitationId}/document`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`GET .../document respondió ${r.status}`);
  const cuerpo = (await r.json()) as { revision: number; document: { content: Record<string, unknown> } };
  return { revision: cuerpo.revision, content: cuerpo.document.content };
}

/** Deja `blockId` exactamente como estaba antes de la prueba: con su valor, o ausente (`clearBlock`). */
export async function restaurarBloque(invitationId: number, token: string, blockId: string, valorOriginal: unknown): Promise<void> {
  const operacion = valorOriginal === undefined ? { op: "clearBlock", blockId } : { op: "setBlock", blockId, value: valorOriginal };
  const r = await aplicarOperaciones(invitationId, token, [operacion]);
  if (r.status !== 200) throw new Error(`No pude restaurar ${blockId} (HTTP ${r.status})`);
}

async function subirAsset(invitationId: number, token: string, ruta: string, contentType: string): Promise<string> {
  const r = await fetch(`${API_BASE}/editor/invitations/${invitationId}/assets`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": contentType },
    body: readFileSync(ruta),
  });
  if (!r.ok) throw new Error(`POST .../assets respondió ${r.status}`);
  const cuerpo = (await r.json()) as { assetId: string };
  return cuerpo.assetId;
}

/**
 * Crea una invitación NUEVA, elige `boda-clasica@1.0.0` y rellena por HTTP los cuatro bloques
 * obligatorios que de verdad bloquean `canPublish` (verificado contra el preflight real de esta
 * sesión, `bitacora/3-5.md`: `cover.title`, `couple.groom`, `couple.bride` — texto de ejemplo — y
 * `cover.image`, sin default posible). Sirve a `publicar.spec.ts` para probar despublicar/rotar sin
 * tocar la invitación de demostración persistente (`invitacionSembrada()`), que otros bloques
 * comparten. Se limpia con `borrarInvitacion` de `preparar.ts`.
 */
export async function crearInvitacionPublicable(token: string): Promise<number> {
  const invitationId = invitacionSinDocumento();
  const choose = await fetch(`${API_BASE}/editor/invitations/${invitationId}/document:choose-template`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ templateSlug: "boda-clasica", templateVersion: "1.0.0" }),
  });
  if (!choose.ok) throw new Error(`:choose-template respondió ${choose.status}`);

  const assetPortada = await subirAsset(invitationId, token, FOTO_VERTICAL, "image/png");
  const baseRevision = await revisionActual(invitationId, token);
  const r = await fetch(`${API_BASE}/editor/invitations/${invitationId}/document/operations`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      baseRevision,
      clientBatchId: `publicable${Date.now().toString(36)}`,
      operations: [
        { op: "setBlock", blockId: "cover.title", value: { kind: "text", value: "Ana & Luis" } },
        { op: "setBlock", blockId: "couple.groom", value: { kind: "person", name: "Luis" } },
        { op: "setBlock", blockId: "couple.bride", value: { kind: "person", name: "Ana" } },
        { op: "setBlock", blockId: "cover.image", value: { kind: "image", assetId: assetPortada, alt: "Ana y Luis", focal: { x: 0.5, y: 0.5 } } },
      ],
    }),
  });
  if (!r.ok) throw new Error(`No pude dejar publicable la invitación de prueba (HTTP ${r.status})`);
  return invitationId;
}

export { FOTO_CUADRADA };
