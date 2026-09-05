/**
 * N-02 (`ADR-3C-N02-01`): desde la fase 3-C el enlace público se construye con el origen por el que
 * la clienta NAVEGA (`window.location.origin`), no con `NEXT_PUBLIC_SITE_URL`, que Next hornea en el
 * build y que por tanto puede apuntar a un servidor que no es el suyo. Este archivo declara el
 * origen de jsdom para que la expectativa siga siendo un dominio público de verdad y no el
 * `localhost:3000` por defecto del entorno de pruebas.
 *
 * @vitest-environment-options { "url": "https://invitaciones.mx/editor/3" }
 */
// components/editor/publicar-enlace-y-cache.test.tsx — las dos mentiras de la pantalla de
// publicado, medidas en la revisión de uso:
//   U-6 · el enlace que se copiaba y se mandaba por WhatsApp era `http://localhost/i/…`: no le
//         abría a ningún invitado, ni a la propia novia («Ver como invitado» →
//         `ERR_CONNECTION_REFUSED`).
//   U-5 · el diálogo decía «✅ Tu invitación ya se puede ver en internet» **sin haber invalidado
//         nada**, y el enlace servía la versión anterior durante ~5 minutos.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as apiClient from "@/lib/api-client.ts";
import { useEditorStore } from "@/lib/store.ts";
import { PublishDialog } from "./PublishDialog.tsx";
import { composedFixture, documentFixture } from "../../test/fixtures/composed.ts";

const TOKEN = "pub_FCTH3DCWGNP954PYK16F0XH5GV";

function prepararStore(): void {
  useEditorStore.getState().reset();
  useEditorStore.setState({
    invitationId: 3,
    loadState: "ready",
    document: documentFixture(),
    composed: composedFixture(),
    revision: 7,
  });
}

/** Publicación que responde con el `publicUrl` DEFECTUOSO que devuelve el backend por defecto. */
function espiarApi(): void {
  vi.spyOn(apiClient, "getPreflight").mockResolvedValue({ canPublish: true, blockers: [], warnings: [], sameAsActiveRelease: false } as never);
  vi.spyOn(apiClient, "publishRelease").mockResolvedValue({
    releaseId: 1,
    contentHash: "h",
    documentRevision: 7,
    publishedAt: "2026-09-05T03:29:00Z",
    publicToken: TOKEN,
    publicUrl: `http://localhost/i/${TOKEN}`,
    reusedActiveRelease: false,
  } as never);
  // `useTemplateManifest` pasa por aquí; sin manifiesto no hay comprobación de fechas, que es lo
  // que se quiere en esta prueba (U-4 tiene la suya).
  vi.spyOn(apiClient, "getDocument").mockRejectedValue(new Error("sin manifiesto en esta prueba"));
}

async function publicar(): Promise<void> {
  const usuario = userEvent.setup();
  await usuario.click(screen.getByTestId("abrir-publicar"));
  await screen.findByTestId("confirmar-publicar");
  await usuario.click(screen.getByTestId("confirmar-publicar"));
}

beforeEach(() => {
  prepararStore();
  espiarApi();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("U-6 · el enlace que la clienta manda a sus invitados", () => {
  it("se construye con el origen del sitio, no con el `localhost` del servidor", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://invitaciones.mx");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ revalidated: true })));
    render(<PublishDialog invitationId={3} />);
    await publicar();

    const esperado = `https://invitaciones.mx/i/${TOKEN}`;
    await waitFor(() => expect(screen.getByTestId("enlace-publicado").textContent).toBe(esperado));
    expect(screen.getByTestId("enlace-publicado").textContent).not.toMatch(/localhost/);

    expect(screen.getByRole("link", { name: /ver como invitado/i }).getAttribute("href")).toBe(esperado);
    expect(screen.getByRole("link", { name: /whatsapp/i }).getAttribute("href")).toBe(
      `https://wa.me/?text=${encodeURIComponent(esperado)}`,
    );
  });
});

describe("U-5 · no se afirma «ya se puede ver» hasta que la invalidación responde", () => {
  it("pide la invalidación del enlace público con el token recién publicado", async () => {
    const espia = vi.fn(async () => Response.json({ revalidated: true }));
    vi.stubGlobal("fetch", espia);
    render(<PublishDialog invitationId={3} />);
    await publicar();

    await waitFor(() => expect(espia).toHaveBeenCalled());
    const [url, opciones] = espia.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/revalidate/tras-publicar");
    expect(JSON.parse(String(opciones.body))).toEqual({ publicToken: TOKEN, motivo: "published" });

    await waitFor(() => expect(screen.getByTestId("estado-publicado").getAttribute("data-invalidacion")).toBe("hecha"));
    expect(screen.getByTestId("estado-publicado").textContent).toMatch(/ya se puede ver en internet/i);
  });

  it("mientras la invalidación no ha respondido, NO dice que ya se ve", async () => {
    let resolver: (r: Response) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => { resolver = r; })));
    render(<PublishDialog invitationId={3} />);
    await publicar();

    const estado = await screen.findByTestId("estado-publicado");
    expect(estado.getAttribute("data-invalidacion")).toBe("pendiente");
    expect(estado.textContent).not.toMatch(/ya se puede ver/i);
    expect(estado.textContent).toMatch(/actualizando el enlace/i);

    resolver(Response.json({ revalidated: true }));
    await waitFor(() => expect(screen.getByTestId("estado-publicado").getAttribute("data-invalidacion")).toBe("hecha"));
  });

  it("si la invalidación falla lo dice, en vez de prometer lo que no puede cumplir", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ revalidated: false }, { status: 502 })));
    render(<PublishDialog invitationId={3} />);
    await publicar();

    await waitFor(() => expect(screen.getByTestId("estado-publicado").getAttribute("data-invalidacion")).toBe("fallida"));
    expect(screen.getByTestId("estado-publicado").textContent).toMatch(/puede tardar unos minutos/i);
    expect(screen.getByTestId("estado-publicado").textContent).not.toMatch(/ya se puede ver/i);
  });
});
