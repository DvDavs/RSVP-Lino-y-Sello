/**
 * N-02 (`ADR-3C-N02-01`): desde la fase 3-C el enlace público se construye con el origen por el que
 * la clienta NAVEGA (`window.location.origin`), no con `NEXT_PUBLIC_SITE_URL`, que Next hornea en el
 * build y que por tanto puede apuntar a un servidor que no es el suyo. Este archivo declara el
 * origen de jsdom para que la expectativa siga siendo un dominio público de verdad y no el
 * `localhost:3000` por defecto del entorno de pruebas.
 *
 * @vitest-environment-options { "url": "https://invitaciones.mx/editor/3" }
 */
// components/editor/PublishDialog.test.tsx — 04 §6.5, §7.1 pasos 10-12: preflight → lista accionable
// → publicar → enlace. `422 TPL_PUBLISH_BLOCKED_*` vuelve al preflight con la lista actualizada.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as apiClient from "@/lib/api-client.ts";
import { ApiError } from "@/lib/errors.ts";
import { useEditorStore } from "@/lib/store.ts";
import { PublishDialog } from "./PublishDialog.tsx";

function preflightConBloqueo() {
  return {
    canPublish: false,
    blockers: [{ code: "TPL_PUBLISH_BLOCKED_MISSING_REQUIRED", blockIds: ["eventPlace"] }],
    warnings: [],
    report: { missingRequired: ["eventPlace"], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null },
    contentHash: "sha256:" + "a".repeat(64),
    sameAsActiveRelease: false,
  };
}

function preflightLimpio() {
  return { ...preflightConBloqueo(), canPublish: true, blockers: [] };
}

describe("PublishDialog", () => {
  beforeEach(() => {
    useEditorStore.setState({
      loadState: "ready",
      revision: 3,
      composed: { composedVersion: 1, template: { slug: "x", version: "1.0.0" }, locale: "es-MX", theme: {} as never, sections: [{ key: "event", type: "event", variant: "timeline", visible: true, title: "Ceremonia", blocks: [{ id: "eventPlace", role: "eventPlace", type: "location", label: "Lugar", provenance: "empty", value: null }] }] } as never,
    });
  });

  it("con bloqueos, «Publicar» está deshabilitado y la lista es accionable", async () => {
    const usuario = userEvent.setup();
    vi.spyOn(apiClient, "getPreflight").mockResolvedValue(preflightConBloqueo());
    render(<PublishDialog invitationId={3} />);
    await usuario.click(screen.getByTestId("abrir-publicar"));
    await waitFor(() => expect(screen.getByTestId("confirmar-publicar")).toBeTruthy());
    expect((screen.getByTestId("confirmar-publicar") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/falta completar/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /completar/i })).toBeTruthy();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sin bloqueos, publicar muestra el enlace y permite copiarlo", async () => {
    const usuario = userEvent.setup();
    // ACTUALIZADO en el bloque 3-8 (U-6): el enlace que se enseña, se copia y se comparte ya NO es
    // el `publicUrl` que devuelve el servidor —que en el arranque real vale `http://localhost/i/…`
    // y no le abre a ningún invitado— sino el que se construye con el ORIGEN PÚBLICO del sitio
    // (`lib/enlace-publico.ts`). La prueba declara ese origen para que la expectativa siga siendo
    // exacta y no dependa del `window.location` de jsdom.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://invitaciones.mx");
    vi.spyOn(apiClient, "getPreflight").mockResolvedValue(preflightLimpio());
    vi.spyOn(apiClient, "publishRelease").mockResolvedValue({
      releaseId: 1,
      contentHash: "sha256:" + "a".repeat(64),
      documentRevision: 3,
      publishedAt: new Date().toISOString(),
      publicToken: "pub_x",
      publicUrl: "https://invitaciones.mx/i/pub_x",
      reusedActiveRelease: false,
    });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });

    render(<PublishDialog invitationId={3} />);
    await usuario.click(screen.getByTestId("abrir-publicar"));
    await waitFor(() => expect((screen.getByTestId("confirmar-publicar") as HTMLButtonElement).disabled).toBe(false));
    await usuario.click(screen.getByTestId("confirmar-publicar"));
    await waitFor(() => expect(screen.getByTestId("enlace-publicado")).toBeTruthy());
    expect(screen.getByTestId("enlace-publicado").textContent).toBe("https://invitaciones.mx/i/pub_x");

    await usuario.click(screen.getByTestId("copiar-enlace"));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://invitaciones.mx/i/pub_x"));
  });

  it("un 422 al confirmar vuelve al preflight con la lista actualizada", async () => {
    const usuario = userEvent.setup();
    vi.spyOn(apiClient, "getPreflight").mockResolvedValueOnce(preflightLimpio()).mockResolvedValueOnce(preflightConBloqueo());
    vi.spyOn(apiClient, "publishRelease").mockRejectedValue(
      new ApiError({ timestamp: "", statusCode: 422, code: "TPL_PUBLISH_BLOCKED_MISSING_REQUIRED", message: "Falta contenido obligatorio." }, 422),
    );

    render(<PublishDialog invitationId={3} />);
    await usuario.click(screen.getByTestId("abrir-publicar"));
    await waitFor(() => expect((screen.getByTestId("confirmar-publicar") as HTMLButtonElement).disabled).toBe(false));
    await usuario.click(screen.getByTestId("confirmar-publicar"));

    await waitFor(() => expect((screen.getByTestId("confirmar-publicar") as HTMLButtonElement).disabled).toBe(true));
    expect(screen.getByText(/falta completar/i)).toBeTruthy();
  });

  it("un error de red en el preflight muestra Reintentar", async () => {
    const usuario = userEvent.setup();
    vi.spyOn(apiClient, "getPreflight").mockRejectedValue(new Error("red caída"));
    render(<PublishDialog invitationId={3} />);
    await usuario.click(screen.getByTestId("abrir-publicar"));
    expect(await screen.findByRole("button", { name: /reintentar/i })).toBeTruthy();
  });
});
