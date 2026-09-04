"use client";

// app/(public)/_componentes/RenderInvitacion.tsx — ÚNICA frontera de cliente de la superficie
// pública. Envuelve `SectionsRoot` de `@invitaciones/sections` y no añade ni un comportamiento:
// ni estado, ni efectos, ni manejadores. `mode="public"` deja fuera `SelectionOverlay`,
// `data-block-*` y los manejadores de activación (04 §5.3 U-07).
//
// POR QUÉ ESTE `"use client"` EXISTE (medido, no supuesto — `bitacora/3-3.md` §2):
// `04 §15.3` exige que la página sea RSC pura y que "packages/sections no lleve ni un `use client`
// en modo public". Hoy NO se cumple, y no por culpa de esta ruta: cinco archivos de
// `packages/sections` importan hooks de React en el módulo, así que Turbopack **rompe el build**
// con `Ecmascript file had an error` en cuanto un Server Component los importa:
//   · src/SectionsRoot.tsx:5            `useRef`
//   · src/theme/ThemeProvider.tsx:17    `useEffect, useId, useRef`
//   · src/canvas/CanvasContext.tsx:10   `createContext, useContext, useMemo`
//   · src/canvas/SelectionOverlay.tsx:9 `useRef, useState, useLayoutEffect`
//   · src/blocks/ImageBlock.tsx:15      `useEffect, useRef`
// `frontend/packages/**` es área PROHIBIDA para el bloque 3-3, así que la única salida sin tocar
// contrato ajeno es declarar aquí la frontera y MEDIR lo que cuesta (ver `handoffs/3-3.md` §3).
// Cuando `packages/sections` deje de necesitar hooks en modo público, este archivo desaparece y la
// página vuelve a ser RSC pura sin cambiar nada más.
import { SectionsRoot } from "@invitaciones/sections";
import type { ComposedDocument } from "@invitaciones/schema";
import estilos from "./RenderInvitacion.module.css";

export function RenderInvitacion({ composed }: { composed: ComposedDocument }) {
  return (
    <div className={estilos.lienzo}>
      <SectionsRoot composed={composed} mode="public" />
    </div>
  );
}
