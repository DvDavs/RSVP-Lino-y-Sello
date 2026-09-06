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

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Cierre de la fase 3-C · las tres graves del recorrido de UX (`bitacora/3c-ux.md §4`)
  // ─────────────────────────────────────────────────────────────────────────────────────────────

  /** Manifiesto mínimo con la forma de `xv-jardin`/`boda-clasica` en lo que estas pruebas miran. */
  function manifiestoConItinerario() {
    return {
      sections: [
        { key: "cover", required: true, blocks: [{ id: "cover.date", type: "date", source: "business", businessField: "invitation.date" }] },
        { key: "family", required: false, blocks: [] },
        { key: "event", required: true, blocks: [{ id: "event.cards", type: "group", itemBlocks: [{ id: "when", type: "dateTimeRange" }] }] },
      ],
    } as never;
  }

  /** El compuesto EXACTO que se publicó con dos fechas y un «Todo listo» (G-04 + G-05, `m43`). */
  function compuestoDeLaRevision() {
    return {
      composedVersion: 1,
      template: { slug: "xv-jardin", version: "1.0.0" },
      locale: "es-MX",
      theme: {},
      sections: [
        {
          key: "cover",
          type: "cover",
          variant: "a",
          visible: true,
          title: "Portada",
          blocks: [{ id: "cover.date", role: "coverDate", type: "date", label: "Fecha", provenance: "business", value: { kind: "date", value: "2027-03-20", formatted: "20 de marzo de 2027" } }],
        },
        {
          key: "family",
          type: "family",
          variant: "a",
          visible: true,
          title: "Mis papás y padrinos",
          blocks: [
            {
              id: "family.people",
              role: "familyGroup",
              type: "group",
              label: "Personas",
              provenance: "default",
              items: [
                { itemId: "i1", blocks: [{ id: "name", role: "personName", type: "person", label: "Nombre", provenance: "default", value: { kind: "person", name: "Nombre de la mamá" } }] },
                { itemId: "i2", blocks: [{ id: "name", role: "personName", type: "person", label: "Nombre", provenance: "default", value: { kind: "person", name: "Nombre del papá" } }] },
              ],
            },
          ],
        },
        {
          key: "event",
          type: "event",
          variant: "a",
          visible: true,
          title: "Cuándo y dónde",
          blocks: [
            {
              id: "event.cards",
              role: "eventCards",
              type: "group",
              label: "Momentos",
              provenance: "default",
              items: [
                { itemId: "e1", blocks: [{ id: "when", role: "eventWhen", type: "dateTimeRange", label: "Cuándo", provenance: "default", value: { kind: "dateTimeRange", start: "2026-11-14T16:30", formatted: "14 de noviembre de 2026, 16:30" } }] },
              ],
            },
          ],
        },
      ],
    } as never;
  }

  it("G-04 · con dos fechas distintas NO dice «Todo listo» y el aviso nombra las dos", async () => {
    const usuario = userEvent.setup();
    useEditorStore.setState({ loadState: "ready", revision: 3, composed: compuestoDeLaRevision() });
    vi.spyOn(apiClient, "getPreflight").mockResolvedValue(preflightLimpio());
    render(<PublishDialog invitationId={3} manifest={manifiestoConItinerario()} />);
    await usuario.click(screen.getByTestId("abrir-publicar"));

    const aviso = await screen.findByTestId("aviso-fechas");
    expect(aviso.textContent).toContain("20 de marzo de 2027");
    expect(aviso.textContent).toContain("14 de noviembre de 2026");
    expect(screen.queryByText(/todo listo para publicar/i)).toBeNull();
    // El itinerario es de ejemplo: no es direccionable, así que se ofrece «Revisar», no el atajo.
    expect(screen.queryByTestId("usar-fecha-evento")).toBeNull();
    // Se puede publicar (solo bloquean los obligatorios), pero el botón no transmite «todo listo».
    expect((screen.getByTestId("confirmar-publicar") as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId("confirmar-publicar").textContent).toMatch(/de todos modos/i);
    expect(screen.getByTestId("resumen-avisos").textContent).toMatch(/sin terminar/i);
  });

  it("G-04 · con el itinerario de la clienta, «Usar la fecha del evento» lo desplaza de un toque", async () => {
    const usuario = userEvent.setup();
    const compuesto = compuestoDeLaRevision() as unknown as { sections: Array<{ blocks: Array<{ items?: Array<{ blocks: Array<{ provenance: string }> }> }> }> };
    compuesto.sections[2]!.blocks[0]!.items![0]!.blocks[0]!.provenance = "user";
    useEditorStore.setState({ loadState: "ready", revision: 3, composed: compuesto as never });
    const setItemBlock = vi.fn();
    useEditorStore.setState({ setItemBlock, flushNow: vi.fn() } as never);
    vi.spyOn(apiClient, "getPreflight").mockResolvedValue(preflightLimpio());
    render(<PublishDialog invitationId={3} manifest={manifiestoConItinerario()} />);
    await usuario.click(screen.getByTestId("abrir-publicar"));

    await usuario.click(await screen.findByTestId("usar-fecha-evento"));
    expect(setItemBlock).toHaveBeenCalledWith("event.cards", "e1", "when", { kind: "dateTimeRange", start: "2027-03-20T16:30" });
  });

  it("G-05 · lista el contenido de ejemplo por sección, con el texto entre comillas y «Ocultar sección»", async () => {
    const usuario = userEvent.setup();
    useEditorStore.setState({ loadState: "ready", revision: 3, composed: compuestoDeLaRevision() });
    const setSectionVisible = vi.fn();
    useEditorStore.setState({ setSectionVisible } as never);
    vi.spyOn(apiClient, "getPreflight").mockResolvedValue(preflightLimpio());
    render(<PublishDialog invitationId={3} manifest={manifiestoConItinerario()} />);
    await usuario.click(screen.getByTestId("abrir-publicar"));

    const familia = await screen.findByTestId("ejemplo-family");
    expect(familia.textContent).toContain("Mis papás y padrinos");
    expect(familia.textContent).toContain("«Nombre de la mamá»");
    await usuario.click(screen.getByTestId("ocultar-seccion-family"));
    expect(setSectionVisible).toHaveBeenCalledWith("family", false);
    // «Cuándo y dónde» es obligatoria en el manifiesto: se lista, pero sin «Ocultar sección».
    expect(screen.getByTestId("ejemplo-event")).toBeTruthy();
    expect(screen.queryByTestId("ocultar-seccion-event")).toBeNull();
  });

  it("G-06 · publicada, la barra enseña el estado y «Compartir» abre la vista de publicada", async () => {
    const usuario = userEvent.setup();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://invitaciones.mx");
    useEditorStore.setState({
      loadState: "ready",
      revision: 7,
      publicToken: "pub_x",
      publicUrl: "http://localhost/i/pub_x",
      revisionPublicada: 7,
      activeRelease: { releaseId: 1, publishedAt: "2026-09-06T10:06:18Z", contentHash: "sha256:x", documentRevision: 7, stale: false, staleReason: [] },
    });
    render(<PublishDialog invitationId={3} manifest={null} />);

    expect(screen.getAllByTestId("estado-publicacion")[0]?.textContent).toMatch(/publicada/i);
    await usuario.click(screen.getByTestId("abrir-compartir"));
    expect(screen.getByTestId("enlace-publicado").textContent).toBe("https://invitaciones.mx/i/pub_x");
    expect(screen.getByRole("link", { name: /ver como invitado/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /compartir por whatsapp/i })).toBeTruthy();
  });

  it("G-06 · con cambios sin publicar, el estado lo dice y ofrece «Volver a publicar»", async () => {
    const usuario = userEvent.setup();
    useEditorStore.setState({
      loadState: "ready",
      revision: 9,
      publicToken: "pub_x",
      publicUrl: "http://localhost/i/pub_x",
      revisionPublicada: 7,
      activeRelease: { releaseId: 1, publishedAt: "2026-09-06T10:06:18Z", contentHash: "sha256:x", documentRevision: 7, stale: true, staleReason: ["event_date_changed"] },
    });
    vi.spyOn(apiClient, "getPreflight").mockResolvedValue(preflightLimpio());
    render(<PublishDialog invitationId={3} manifest={null} />);

    expect(screen.getAllByTestId("estado-publicacion")[0]?.textContent).toMatch(/cambios sin publicar/i);
    await usuario.click(screen.getByTestId("abrir-compartir"));
    await usuario.click(screen.getByTestId("volver-a-publicar"));
    await waitFor(() => expect(screen.getByTestId("confirmar-publicar")).toBeTruthy());
  });
});
