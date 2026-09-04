// packages/sections/test/harness-c/main.tsx — entrada del banco de capturas (TAREA 3, brief
// 3-2c). Lee `?type=` de la URL, monta `<SectionsRoot composed={...} mode="public" />` con el
// tema real y los datos de `data.ts` — exactamente el mismo árbol que renderiza `/i/[publicToken]`
// (04 §5.1: "los mismos componentes renderizan… /i/[publicToken]"), nada de maquetado aparte.
import { createRoot } from "react-dom/client";
import { SectionsRoot } from "../../src/SectionsRoot.tsx";
import { HARNESS_DOCS } from "./data.ts";
import "../../src/theme/tokens.css";

const params = new URLSearchParams(window.location.search);
const type = params.get("type") ?? "";
const doc = HARNESS_DOCS[type];

const root = document.getElementById("root")!;
if (doc === undefined) {
  root.textContent = `harness-c: tipo desconocido "${type}". Usa ?type=giftTable|suggestions|amenities|rsvp|family|footer`;
} else {
  createRoot(root).render(<SectionsRoot composed={doc} mode="public" />);
}
