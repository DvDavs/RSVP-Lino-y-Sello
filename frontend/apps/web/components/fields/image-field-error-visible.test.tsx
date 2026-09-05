// components/fields/image-field-error-visible.test.tsx — U-7: «la foto demasiado grande falla en
// silencio». El mensaje EXISTÍA y era bueno; el defecto era DÓNDE se pintaba: al final del
// `FieldShell`, por debajo del texto alternativo y de los dos deslizadores del punto focal — medido
// en `y=928` con la ventana en 900, **28 px por debajo del borde visible** y lejos del botón que
// falló. Estas pruebas fijan las tres correcciones: sitio, desplazamiento y pie de límites.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ImageSpec } from "@/lib/block-types.ts";
import { ImageField } from "./ImageField.tsx";

function espec(): ImageSpec {
  return {
    id: "coverImage",
    role: "coverImage",
    label: { "es-MX": "Foto de portada" },
    required: true,
    editable: true,
    source: "user",
    aiEditable: true,
    type: "image",
    constraints: { aspect: "square", maxBytes: 8 * 1024 * 1024 },
  };
}

const VALOR = { assetId: "as_01ARZ3NDEKTSV4RRFFQ69G5FAV", url: "https://cdn/x.webp", alt: "Ana y Luis", focal: { x: 0.5, y: 0.5 } };

/** Un archivo de 27 MB, como los que salen de un móvil moderno (el de la revisión de uso). */
function fotoEnorme(): File {
  const archivo = new File([new Uint8Array(8)], "IMG_9042.jpg", { type: "image/jpeg" });
  Object.defineProperty(archivo, "size", { value: 27 * 1024 * 1024 });
  return archivo;
}

function elegir(archivo: File): void {
  const input = screen.getByLabelText(/elegir archivo/i) as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [archivo], configurable: true });
  fireEvent.change(input);
}

describe("el error de la foto se ve, y se ve donde falló", () => {
  it("se pinta ANTES del texto alternativo y del punto focal, no al final del campo", () => {
    render(<ImageField id="c-foto" invitationId={3} spec={espec()} value={VALOR} onCommit={vi.fn()} />);
    elegir(fotoEnorme());

    const aviso = screen.getByRole("alert");
    expect(aviso.textContent).toMatch(/pesa más de 8 MB/i);

    // El orden en el documento es la prueba: el mensaje tiene que ir por DELANTE de los controles
    // que lo empujaban fuera de la pantalla. `DOCUMENT_POSITION_FOLLOWING` = «viene después».
    const alt = screen.getByLabelText("Texto alternativo");
    const focal = screen.getByLabelText(/horizontal/i);
    expect(aviso.compareDocumentPosition(alt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(aviso.compareDocumentPosition(focal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Y va pegado al botón que falló: mismo contenedor que «Cambiar foto».
    const boton = screen.getByRole("button", { name: /cambiar foto/i });
    const contenedor = boton.closest("div")?.parentElement;
    expect(contenedor?.contains(aviso)).toBe(true);
  });

  it("desplaza el panel hasta el mensaje y le lleva el foco", () => {
    const desplazar = vi.fn();
    // jsdom no implementa `scrollIntoView`: se instala para poder comprobar que se llama.
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: desplazar, configurable: true, writable: true });

    render(<ImageField id="c-foto" invitationId={3} spec={espec()} value={VALOR} onCommit={vi.fn()} />);
    elegir(fotoEnorme());

    expect(desplazar).toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("alert"));
  });

  it("anuncia el límite ANTES de fallar, igual que ya hacía la galería", () => {
    render(<ImageField id="c-foto" invitationId={3} spec={espec()} value={VALOR} onCommit={vi.fn()} />);
    expect(screen.getByText("JPG, PNG o WebP · hasta 8 MB")).toBeTruthy();
  });
});
