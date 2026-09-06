// packages/ui/src/componentes/demo-foto.ts — una fotografía de demostración que NO depende de red
// (el proxy de este entorno bloquea Google Fonts y los bancos de imágenes, `contratos.md §7`): un
// PNG de 8×8 en `bugambilia 600` (`#bb0076`, `11 §1.2`) codificado como `data:` URI. Solo para la
// galería (`Image.historias.tsx`) y las pruebas de `Image.test.tsx`; nunca para el producto real.
export const FOTO_DEMO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGPYzVCGFTEMLQkA3LtMQQ3332QAAAAASUVORK5CYII=";
