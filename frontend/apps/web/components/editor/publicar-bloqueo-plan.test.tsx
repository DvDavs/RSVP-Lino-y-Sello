/**
 * ADR-5-0B-01 (sesión E4, `handoffs/5-4-contrato-pagos.md` §2.6): la puerta de publicación por plan
 * pagado llega al diálogo de publicar como un bloqueo `TPL_PLAN_UNPAID` más. Este archivo (nuevo,
 * no toca `PublishDialog.test.tsx`) prueba solo ese bloqueo: el texto y el enlace «Elegir plan».
 *
 * @vitest-environment-options { "url": "https://invitaciones.mx/editor/3" }
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as apiClient from "@/lib/api-client.ts";
import { es_MX } from "@/lib/i18n.ts";
import { useEditorStore } from "@/lib/store.ts";
import { PublishDialog } from "./PublishDialog.tsx";

function preflightConPlanSinPagar() {
  return {
    canPublish: false,
    blockers: [{ code: "TPL_PLAN_UNPAID" }],
    warnings: [],
    report: { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null },
    contentHash: "sha256:" + "a".repeat(64),
    sameAsActiveRelease: false,
  };
}

describe("PublishDialog — bloqueo TPL_PLAN_UNPAID", () => {
  beforeEach(() => {
    useEditorStore.setState({
      loadState: "ready",
      revision: 3,
      composed: { composedVersion: 1, template: { slug: "x", version: "1.0.0" }, locale: "es-MX", theme: {} as never, sections: [] } as never,
    });
  });

  it("enseña el texto de 'falta el plan' y un enlace a /editor/<id>/plan, no un botón muerto", async () => {
    const usuario = userEvent.setup();
    vi.spyOn(apiClient, "getPreflight").mockResolvedValue(preflightConPlanSinPagar());
    render(<PublishDialog invitationId={3} />);

    await usuario.click(screen.getByTestId("abrir-publicar"));
    await waitFor(() => expect(screen.getByTestId("confirmar-publicar")).toBeTruthy());

    expect((screen.getByTestId("confirmar-publicar") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(es_MX.editor.publicar.bloqueo.TPL_PLAN_UNPAID)).toBeTruthy();

    const enlace = screen.getByTestId("publicar-ir-al-plan");
    expect(enlace.tagName).toBe("A");
    expect(enlace.getAttribute("href")).toBe("/editor/3/plan");
    expect(enlace.textContent).toBe(es_MX.panel.plan.elegirPlan);
  });
});
