// lib/crop.ts — recorte y exportación de imágenes (04 §13.2). Puro (sin React): recibe un
// `HTMLImageElement` ya cargado + un rectángulo de recorte en PORCENTAJE (lo que produce
// `react-image-crop`) y devuelve un `Blob` WebP listo para `POST …/assets` (cuerpo binario crudo).
//
// El recorte es DESTRUCTIVO por decisión ya tomada (`preguntas-abiertas.md`, `04 §13.3`): `ImageValue`
// solo guarda `assetId`/`alt`/`focal`, nunca un rectángulo. Este archivo no lo cambia; solo produce el
// archivo ya recortado que se sube.

export interface RectanguloPorcentaje {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const LADO_MAYOR_MAXIMO_PX = 2000;
export const CALIDAD_WEBP = 0.9;

/** Proporción fija por `ImageSpec.constraints.aspect` (04 §13.2 paso 3). `"free"` ⇒ `undefined`. */
export function proporcionParaAspect(aspect: "free" | "square" | "portrait" | "landscape" | "wide"): number | undefined {
  switch (aspect) {
    case "square":
      return 1;
    case "portrait":
      return 3 / 4;
    case "landscape":
      return 4 / 3;
    case "wide":
      return 16 / 9;
    case "free":
      return undefined;
  }
}

/**
 * Pinta el rectángulo de recorte (en % del tamaño NATURAL de la imagen) en un `<canvas>` del tamaño
 * destino (lado mayor ≤ `LADO_MAYOR_MAXIMO_PX`) y exporta a WebP. Lanza si el navegador no puede
 * producir el blob (muy raro; se clasifica como error genérico en la interfaz).
 */
export async function recortarAWebp(
  imagen: HTMLImageElement,
  recortePorcentaje: RectanguloPorcentaje,
  calidad: number = CALIDAD_WEBP,
): Promise<Blob> {
  const anchoNatural = imagen.naturalWidth;
  const altoNatural = imagen.naturalHeight;
  const anchoRecorteOrig = (recortePorcentaje.width / 100) * anchoNatural;
  const altoRecorteOrig = (recortePorcentaje.height / 100) * altoNatural;
  const xOrig = (recortePorcentaje.x / 100) * anchoNatural;
  const yOrig = (recortePorcentaje.y / 100) * altoNatural;

  const escala = Math.min(1, LADO_MAYOR_MAXIMO_PX / Math.max(anchoRecorteOrig, altoRecorteOrig));
  const anchoDestino = Math.max(1, Math.round(anchoRecorteOrig * escala));
  const altoDestino = Math.max(1, Math.round(altoRecorteOrig * escala));

  const canvas = document.createElement("canvas");
  canvas.width = anchoDestino;
  canvas.height = altoDestino;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No pudimos preparar la foto en este navegador.");
  ctx.drawImage(imagen, xOrig, yOrig, anchoRecorteOrig, altoRecorteOrig, 0, 0, anchoDestino, altoDestino);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("No pudimos generar el archivo recortado."));
      },
      "image/webp",
      calidad,
    );
  });
}

/** Carga un `File`/`Blob` como `HTMLImageElement` (para pasar a `recortarAWebp`). */
export function cargarImagenDesdeArchivo(archivo: Blob): Promise<{ imagen: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => resolve({ imagen, url });
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No pudimos leer esa imagen."));
    };
    imagen.src = url;
  });
}

/** Recorte de porcentaje "toda la imagen", usado como valor inicial cuando `aspect === "free"`. */
export const RECORTE_COMPLETO: RectanguloPorcentaje = { x: 0, y: 0, width: 100, height: 100 };

/** Recorte inicial centrado con una proporción fija dada (04 §13.2 paso 3). */
export function recorteCentradoConProporcion(proporcion: number, anchoNatural: number, altoNatural: number): RectanguloPorcentaje {
  const proporcionImagen = anchoNatural / altoNatural;
  let width: number;
  let height: number;
  if (proporcionImagen > proporcion) {
    height = 100;
    width = (proporcion / proporcionImagen) * 100;
  } else {
    width = 100;
    height = (proporcionImagen / proporcion) * 100;
  }
  return { x: (100 - width) / 2, y: (100 - height) / 2, width, height };
}

/** Palabras es-MX del punto focal (04 §18, `Slider` con `aria-valuetext` en palabras). */
export function textoFocal(x: number, y: number): string {
  const vertical = y < 0.34 ? "arriba" : y > 0.66 ? "abajo" : "al centro";
  const horizontal = x < 0.34 ? "a la izquierda" : x > 0.66 ? "a la derecha" : "";
  if (vertical === "al centro" && horizontal === "") return "centro";
  return [vertical, horizontal].filter(Boolean).join(" ").trim();
}
