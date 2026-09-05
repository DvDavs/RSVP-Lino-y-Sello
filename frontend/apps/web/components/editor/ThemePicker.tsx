"use client";

// components/editor/ThemePicker.tsx — paleta y tipografía (04 §6.2, §7.1 paso 8, P7: SOLO los
// presets del paquete, nunca un selector de color libre). Previsualización en vivo al pasar el ratón
// (`PREVIEW_THEME`, sin escribir nada) y `setTheme` al confirmar. Si el id ya no existe en la versión
// vigente, el store revierte solo (`422 TPL_OPERATION_INVALID` → aviso es-MX, `lib/store.ts`).
//
// `ThemeSpec` (paletas/fuentes de `theme.json`) NO está prometido por el contrato nuevo (solo
// `manifest`, ver `lib/manifest.ts`): sin él no hay catálogo de presets que mostrar, así que este
// componente EXPLICA la degradación (P1) en vez de inventar opciones — pregunta ALTA en
// `preguntas-abiertas.md`.
import { Check } from "lucide-react";
import type { ThemeSpec } from "@invitaciones/schema";
import { useEditorStore } from "@/lib/store.ts";

export function ThemePicker({ theme }: { theme: ThemeSpec | null }) {
  const themeActual = useEditorStore((s) => s.composed?.theme ?? null);

  if (!themeActual) return null;

  if (!theme) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-ui-eyebrow font-semibold uppercase tracking-[1.2px] text-ui-ink-muted">Apariencia</h3>
        <div className="flex items-center gap-2.5">
          <PastillaPaleta tokens={themeActual.tokens} />
          <div className="min-w-0">
            <p className="truncate text-ui-aux font-semibold text-ui-ink">{themeActual.fonts.heading.family}</p>
            <p className="text-ui-eyebrow text-ui-ink-muted">Paleta y tipografía actuales</p>
          </div>
        </div>
        <p className="text-ui-eyebrow text-ui-ink-muted">
          Las demás combinaciones de esta plantilla todavía no están disponibles aquí para elegir.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-ui-eyebrow font-semibold uppercase tracking-[1.2px] text-ui-ink-muted">Apariencia</h3>

      <div className="flex flex-col gap-1.5">
        <span className="text-ui-aux font-semibold text-ui-ink">Paleta</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Paleta de colores">
          {theme.palettes.map((paleta) => {
            const activa = paleta.id === themeActual.paletteId;
            return (
              <button
                key={paleta.id}
                type="button"
                role="radio"
                aria-checked={activa}
                data-testid={`paleta-${paleta.id}`}
                onMouseEnter={() => useEditorStore.getState().previewTheme(paleta.id, null)}
                onMouseLeave={() => useEditorStore.getState().previewTheme(null, null)}
                onFocus={() => useEditorStore.getState().previewTheme(paleta.id, null)}
                onBlur={() => useEditorStore.getState().previewTheme(null, null)}
                onClick={() => useEditorStore.getState().setTheme({ paletteId: paleta.id })}
                className={`flex items-center gap-2 rounded-ui-control border px-2.5 py-1.5 transition-colors ${activa ? "border-ui-accent bg-ui-accent-soft" : "border-ui-border-field hover:border-ui-accent hover:bg-ui-bg-alt"}`}
              >
                <PastillaPaleta tokens={paleta.tokens} />
                <span className="text-ui-eyebrow text-ui-ink">{paleta.name["es-MX"]}</span>
                {activa ? <Check aria-hidden="true" className="size-3.5 text-ui-accent" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-ui-aux font-semibold text-ui-ink">Tipografía</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Combinación de tipografías">
          {theme.fontSets.map((fontSet) => {
            const activa = fontSet.id === themeActual.fontSetId;
            return (
              <button
                key={fontSet.id}
                type="button"
                role="radio"
                aria-checked={activa}
                data-testid={`fuente-${fontSet.id}`}
                onMouseEnter={() => useEditorStore.getState().previewTheme(null, fontSet.id)}
                onMouseLeave={() => useEditorStore.getState().previewTheme(null, null)}
                onFocus={() => useEditorStore.getState().previewTheme(null, fontSet.id)}
                onBlur={() => useEditorStore.getState().previewTheme(null, null)}
                onClick={() => useEditorStore.getState().setTheme({ fontSetId: fontSet.id })}
                className={`flex items-center gap-1.5 rounded-ui-control border px-2.5 py-1.5 transition-colors ${activa ? "border-ui-accent bg-ui-accent-soft" : "border-ui-border-field hover:border-ui-accent hover:bg-ui-bg-alt"}`}
              >
                <span style={{ fontFamily: fontSet.heading.family }} className="text-ui-body">
                  Aa
                </span>
                <span className="text-ui-eyebrow text-ui-ink">{fontSet.name["es-MX"]}</span>
                {activa ? <Check aria-hidden="true" className="size-3.5 text-ui-accent" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PastillaPaleta({ tokens }: { tokens: Record<string, string> }) {
  return (
    <span aria-hidden="true" className="flex size-6 shrink-0 overflow-hidden rounded-full border border-ui-border">
      <span className="w-1/3" style={{ background: tokens.bg }} />
      <span className="w-1/3" style={{ background: tokens.accent }} />
      <span className="w-1/3" style={{ background: tokens.ink }} />
    </span>
  );
}
