// components/invitados/CompartirInvitacion.test.tsx — bloque 5-3: el enlace GENERAL (no el de
// ningún invitado), solo cuando la invitación está publicada, y el mensaje de WhatsApp bien
// codificado.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as apiClient from "@/lib/api-client";
import { ApiError } from "@/lib/errors";
import type { GetDocumentResponse } from "@/lib/api-types";
import { textosInvitados as t } from "@/lib/invitados/textos";
import { CompartirInvitacion } from "./CompartirInvitacion";

const PUBLIC_TOKEN = "pub_FCTH3DCWGNP954PYK16F0XH5GV";

function documento(sobrescribir: Partial<GetDocumentResponse> = {}): GetDocumentResponse {
  return {
    document: {} as never,
    composed: {} as never,
    report: {} as never,
    revision: 3,
    templateVersion: { slug: "boda-clasica", version: "1.0.0", status: "published" },
    publicToken: PUBLIC_TOKEN,
    publicUrl: `http://localhost/i/${PUBLIC_TOKEN}`,
    activeRelease: { releaseId: 1, publishedAt: "2026-03-01T00:00:00Z", documentRevision: 3, contentHash: "sha256:abc", stale: false, staleReason: [] },
    ...sobrescribir,
  };
}

describe("CompartirInvitacion — solo se enseña publicada", () => {
  it("sin publicar: no promete un enlace, dice qué falta y no hay botones de compartir", async () => {
    vi.spyOn(apiClient, "getDocument").mockResolvedValue(documento({ activeRelease: null }));
    render(<CompartirInvitacion invitationId={7} />);

    expect(await screen.findByText(t.compartirGeneral.noPublicada.texto)).toBeTruthy();
    expect(screen.queryByTestId("compartir-general-enlace")).toBeNull();
    expect(screen.queryByText(t.compartirGeneral.botonWhatsapp)).toBeNull();
  });

  it("sin documento todavía (TPL_DOCUMENT_NOT_STARTED): mismo aviso de «no publicada», no un error", async () => {
    vi.spyOn(apiClient, "getDocument").mockRejectedValue(
      new ApiError({ timestamp: "t", statusCode: 404, code: "TPL_DOCUMENT_NOT_STARTED", message: "" }, 404),
    );
    render(<CompartirInvitacion invitationId={7} />);
    expect(await screen.findByText(t.compartirGeneral.noPublicada.texto)).toBeTruthy();
    expect(screen.queryByText(t.compartirGeneral.errorEstado)).toBeNull();
  });

  it("fallo de red de verdad: tarjeta de error con Reintentar, no «no publicada»", async () => {
    vi.spyOn(apiClient, "getDocument").mockRejectedValueOnce(new Error("network"));
    render(<CompartirInvitacion invitationId={7} />);
    expect(await screen.findByText(t.compartirGeneral.errorEstado)).toBeTruthy();
    expect(screen.queryByText(t.compartirGeneral.noPublicada.texto)).toBeNull();

    vi.spyOn(apiClient, "getDocument").mockResolvedValue(documento());
    const usuario = userEvent.setup();
    await usuario.click(screen.getByText(t.reintentar));
    await waitFor(() => expect(screen.getByTestId("compartir-general-enlace")).toBeTruthy());
  });

  it("publicada: el enlace es el AYUDANTE COMPARTIDO (window.location.origin + /i/publicToken), no uno armado a mano", async () => {
    vi.spyOn(apiClient, "getDocument").mockResolvedValue(documento());
    render(<CompartirInvitacion invitationId={7} />);

    const esperado = `${window.location.origin}/i/${PUBLIC_TOKEN}`;
    expect(await screen.findByText(esperado)).toBeTruthy();
    // Nunca el `publicUrl` crudo del servidor (el defecto U-6: `http://localhost/i/…`).
    expect(screen.queryByText(`http://localhost/i/${PUBLIC_TOKEN}`)).toBeNull();
  });

  it("copiar enlace usa el portapapeles con el enlace público, nunca el de un invitado", async () => {
    vi.spyOn(apiClient, "getDocument").mockResolvedValue(documento());
    const escribir = vi.fn().mockResolvedValue(undefined);
    const usuario = userEvent.setup();
    render(<CompartirInvitacion invitationId={7} />);

    const boton = await screen.findByText(t.compartirGeneral.copiarEnlace);
    // Se define justo antes del clic, no antes del render: `getDocument` resuelve async y ese hueco
    // le da tiempo a jsdom de reponer su propio `navigator.clipboard` encima del doble.
    Object.defineProperty(navigator, "clipboard", { value: { writeText: escribir }, configurable: true });
    await usuario.click(boton);
    expect(escribir).toHaveBeenCalledWith(`${window.location.origin}/i/${PUBLIC_TOKEN}`);
  });

  it("el botón de WhatsApp es click-to-chat (wa.me) con el mensaje bien codificado", async () => {
    vi.spyOn(apiClient, "getDocument").mockResolvedValue(documento());
    render(<CompartirInvitacion invitationId={7} />);

    const enlace = `${window.location.origin}/i/${PUBLIC_TOKEN}`;
    const boton = (await screen.findByText(t.compartirGeneral.botonWhatsapp)).closest("a");
    expect(boton).toBeTruthy();
    const href = boton?.getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
    const textoDecodificado = decodeURIComponent(href.slice("https://wa.me/?text=".length));
    expect(textoDecodificado).toBe(t.compartirGeneral.mensaje(enlace));
    expect(boton?.getAttribute("target")).toBe("_blank");
    expect(boton?.getAttribute("rel")).toBe("noreferrer");
  });

  it("el mensaje para redes se puede copiar tal cual, con el mismo enlace", async () => {
    vi.spyOn(apiClient, "getDocument").mockResolvedValue(documento());
    const escribir = vi.fn().mockResolvedValue(undefined);
    const usuario = userEvent.setup();
    render(<CompartirInvitacion invitationId={7} />);

    const enlace = `${window.location.origin}/i/${PUBLIC_TOKEN}`;
    const bloqueMensaje = await screen.findByTestId("compartir-general-mensaje");
    expect(within(bloqueMensaje).getByText(t.compartirGeneral.mensaje(enlace))).toBeTruthy();

    // Se define justo antes del clic (ver el otro caso de copiar, arriba): el hueco async de
    // `getDocument` le da tiempo a jsdom de reponer su propio `navigator.clipboard`.
    Object.defineProperty(navigator, "clipboard", { value: { writeText: escribir }, configurable: true });
    await usuario.click(screen.getByText(t.compartirGeneral.copiarMensaje));
    expect(escribir).toHaveBeenCalledWith(t.compartirGeneral.mensaje(enlace));
  });

  it("el mensaje general no lleva ningún token de invitado ni dato personal", async () => {
    vi.spyOn(apiClient, "getDocument").mockResolvedValue(documento());
    render(<CompartirInvitacion invitationId={7} />);
    const enlace = `${window.location.origin}/i/${PUBLIC_TOKEN}`;
    const mensaje = t.compartirGeneral.mensaje(enlace);
    expect(mensaje).not.toMatch(/confirmationToken|guestId|token=/i);
    await screen.findByText(mensaje);
  });
});
