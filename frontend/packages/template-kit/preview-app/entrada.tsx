// preview-app/entrada.tsx — punto de entrada del previsualizador. UNA página con dos papeles:
//
//   /                → la CONSOLA: el chrome del kit (anchos, paleta, diagnóstico de `check`).
//   /?marco=<ancho>  → el LIENZO: sólo la invitación, sin nada del kit alrededor.
//
// La consola incrusta el lienzo en un `<iframe>` por cada ancho. Es la única forma honesta de ver
// «móvil» y «escritorio» a la vez: las secciones de `packages/sections` deciden su diseño con
// `@media (min-width: …)` y con unidades de ventana (`100svh`), que miran a la VENTANA. Un `<div>`
// de 390 px de ancho enseñaría el diseño de escritorio encogido, no el de móvil.
//
// `capturas` apunta directamente a `/?marco=…`: la fotografía es de la invitación, sin el chrome.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Consola } from "./Consola.tsx";
import { Lienzo } from "./Lienzo.tsx";

const parametros = new URLSearchParams(window.location.search);
const marco = parametros.get("marco");
const paleta = parametros.get("paleta");
const fuentes = parametros.get("fuentes");

const raiz = document.getElementById("raiz");
if (raiz === null) throw new Error("falta #raiz en index.html");

document.body.dataset["papel"] = marco === null ? "consola" : "lienzo";

createRoot(raiz).render(
  <StrictMode>
    {marco === null
      ? <Consola />
      : <Lienzo paleta={paleta} fuentes={fuentes} />}
  </StrictMode>,
);
