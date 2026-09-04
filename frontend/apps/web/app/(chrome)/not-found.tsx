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
// Sin `style={{…}}` a propósito: las utilidades de `globals.css` bastan y ningún documento de este
// proyecto debe depender de atributos `style` en línea.
export default function NoEncontradoGlobal() {
  return (
    <main className="mx-auto max-w-prose px-6 py-24 text-center">
      <h1 className="font-ui-display text-ui-section font-semibold text-ui-ink-heading">Página no encontrada</h1>
      <p className="mt-3 text-ui-body text-ui-ink-muted">
        El enlace que abriste no existe o cambió de dirección.
      </p>
    </main>
  );
}
