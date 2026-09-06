// app/(chrome)/not-found.tsx — 404 de las URL que no casan con ninguna ruta.
//
// VIVE DENTRO DE UN GRUPO, no en `app/`, y `app/layout.tsx` NO EXISTE. Es obligatorio para que los
// tres layouts de grupo — `(chrome)`, `(canvas)` y `(public)` — sean layouts RAÍZ de verdad
// (`04 §19`, `handoffs/3-0b.md` §1: "dos layouts raíz por grupos de rutas").
//
// Defecto medido y corregido en el bloque 3-4: con un `app/layout.tsx` de nivel superior, Next
// ANIDA los layouts de grupo dentro de él y el HTML servido queda con un `<html>` dentro de un
// `<body>`. Dentro del lienzo eso rompía dos cosas a la vez: el `style={{…}}` de aquel layout raíz
// violaba `style-src` de la CSP (la CSP del lienzo no habilita atributos `style`) y React abortaba
// la hidratación con una discrepancia de HTML (#418), así que el lienzo no arrancaba nunca. La
// única forma de tener varios layouts raíz en el App Router es no tener ninguno por encima.
//
// Fase 3-C: por estar fuera del grupo `(sitio)`, esta página monta el shell de la web pública a
// mano (`MarcoSitio`) para no ser una pantalla huérfana sin cabecera ni pie, y ofrece UNA salida
// (`11 §7`, «ningún callejón sin salida»).
import type { Metadata } from "next";
import { EstadoDePagina } from "@/components/sitio/EstadoDePagina";
import { MarcoSitio } from "@/components/sitio/MarcoSitio";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.errores.noExiste.titulo,
  robots: { index: false, follow: true },
};

export default function NoEncontradoGlobal() {
  return (
    <MarcoSitio>
      <EstadoDePagina
        titulo={es_MX.errores.noExiste.titulo}
        texto={es_MX.errores.noExiste.cuerpo}
        accion={{ etiqueta: es_MX.comun.irAlInicio, href: "/" }}
      />
    </MarcoSitio>
  );
}
