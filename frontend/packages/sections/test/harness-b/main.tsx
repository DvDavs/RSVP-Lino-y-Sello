// packages/sections/test/harness-b/main.tsx — CÓDIGO DE NAVEGADOR (sin `node:*`). Lee `?type=` de
// la URL, carga `composed.json` (generado por `generate-fixture.ts`, el `ComposedDocument` REAL
// de `boda-clasica@1.0.0`) y monta la sección de ese tipo con `ThemeProvider` + `sectionRegistry`
// — el mismo camino que usaría `/i/[publicToken]` en `apps/web`, sin chrome ni overlays
// (`mode="public"`).
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../../src/theme/ThemeProvider.tsx";
import { sectionRegistry } from "../../src/registry.ts";
import type { ComposedDocument } from "@invitaciones/schema";
import "../../src/theme/tokens.css";

async function main(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type") ?? "cover";

  const res = await fetch("./composed.json");
  const composed = (await res.json()) as ComposedDocument;
  const section = composed.sections.find((s) => s.type === type);
  const root = document.getElementById("root")!;

  if (!section) {
    root.textContent = `No hay sección de tipo "${type}" en composed.json`;
    return;
  }

  const entry = sectionRegistry[section.type];
  const Component = entry.component;

  createRoot(root).render(
    <ThemeProvider theme={composed.theme}>
      <Component section={section} variant={section.variant} mode="public" />
    </ThemeProvider>,
  );

  // Señal para Playwright: la captura espera a que este atributo aparezca en <body>, en vez de un
  // `waitForTimeout` a ciegas (que sería adivinar cuánto tarda React + las fuentes de reserva).
  document.body.setAttribute("data-harness-ready", "true");
}

void main();
