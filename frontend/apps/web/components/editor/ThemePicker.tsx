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
//
// FRONTERA (fase 3-C, `04 §19.4`): la MUESTRA de cada preset se pinta con los colores y la fuente
// del PAQUETE DE PLANTILLA (`palette.tokens`, `fontSet.heading.family`), nunca con los tokens
// `--ui-*` del chrome; el marco, el foco y el texto alrededor son chrome. Por eso los colores de la
// muestra van por `style` en línea: son datos de la plantilla, no una decisión de diseño de aquí.
import type { ThemeSpec } from "@invitaciones/schema";
import { IconoExito, IconoPaleta, IconoTipografia } from "@invitaciones/icons";
import { es_MX } from "@/lib/i18n.ts";
import { useEditorStore } from "@/lib/store.ts";

const CLASES_OPCION =
  "flex min-h-11 items-center gap-2 rounded-ui-control px-2.5 py-1.5 text-sm text-ui-ink transition-colors duration-200 ease-ui-out focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface";

export function ThemePicker({ theme }: { theme: ThemeSpec | null }) {
  const themeActual = useEditorStore((s) => s.composed?.theme ?? null);

  if (!themeActual) return null;

  if (!theme) {
    return (
      <div className="flex flex-col gap-2">
        <Titulo />
        <div className="flex items-center gap-2.5">
          <MuestraPaleta tokens={themeActual.tokens} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ui-ink">{themeActual.fonts.heading.family}</p>
            <p className="text-xs text-ui-ink-muted">Paleta y tipografía actuales</p>
          </div>
        </div>
        <p className="text-xs text-ui-ink-muted">
          Las demás combinaciones de esta plantilla todavía no están disponibles aquí para elegir.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Titulo />

      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ui-ink">
          <IconoPaleta size={18} />
          Paleta
        </span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Paleta de colores">
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
                className={`${CLASES_OPCION} border-[1.5px] ${activa ? "border-ui-primary bg-ui-primary-soft text-ui-on-primary-soft" : "border-ui-border hover:bg-ui-surface-alt"}`}
              >
                <MuestraPaleta tokens={paleta.tokens} />
                <span>{paleta.name["es-MX"]}</span>
                {activa ? <IconoExito size={16} tone="mono" className="shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ui-ink">
          <IconoTipografia size={18} />
          Tipografía
        </span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Combinación de tipografías">
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
                className={`${CLASES_OPCION} border-[1.5px] ${activa ? "border-ui-primary bg-ui-primary-soft text-ui-on-primary-soft" : "border-ui-border hover:bg-ui-surface-alt"}`}
              >
                {/* La muestra usa la fuente DEL PAQUETE de plantilla, no la del chrome. */}
                <span
                  aria-hidden="true"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-ui-control bg-ui-surface-alt"
                  style={{ fontFamily: fontSet.heading.family, fontSize: 18 }}
                >
                  Aa
                </span>
                <span>{fontSet.name["es-MX"]}</span>
                {activa ? <IconoExito size={16} tone="mono" className="shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Titulo() {
  return <h3 className="label-md text-ui-ink-muted">{es_MX.editor.panel.apariencia}</h3>;
}

/**
 * Miniatura de una paleta DE LA PLANTILLA: papel, acento y tinta del preset, con una «Aa» encima
 * para que se vea la pareja fondo/tinta real. `aria-hidden`: el nombre del preset ya está al lado.
 */
function MuestraPaleta({ tokens }: { tokens: Record<string, string> }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-ui-control"
      style={{ background: tokens.bg, color: tokens.ink, boxShadow: `inset 0 0 0 3px ${tokens.accent}` }}
    >
      <span style={{ fontSize: 12, fontWeight: 700 }}>Aa</span>
    </span>
  );
}
