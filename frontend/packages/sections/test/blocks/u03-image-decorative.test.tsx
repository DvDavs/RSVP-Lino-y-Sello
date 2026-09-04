// U-03 (04 §20.1): "ImageBlock con role:"decorative" → alt="" y aria-hidden="true"."
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ImageBlock } from "../../src/blocks/index.ts";
import { decorativeImageBlock, imageBlock } from "../fixtures.ts";

const ref_ = { sectionKey: "footer", blockId: "footer.logo" };

describe("U-03 — ImageBlock decorativo", () => {
  it('role:"decorative" ⇒ alt="" y aria-hidden="true"', () => {
    const { container } = render(<ImageBlock block={decorativeImageBlock()} mode="public" ref_={ref_} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("alt")).toBe("");
    expect(img!.getAttribute("aria-hidden")).toBe("true");
  });

  it('role != "decorative" ⇒ conserva el alt real y no lleva aria-hidden', () => {
    const { container } = render(<ImageBlock block={imageBlock()} mode="public" ref_={ref_} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("alt")).toBe("Ana y Luis abrazados frente al mar");
    expect(img!.hasAttribute("aria-hidden")).toBe(false);
  });

  it("aplica el punto focal por CSSOM (--inv-focal-x/y), nunca con la prop `style` de React", () => {
    // `ImageBlock.tsx` no tiene ninguna prop `style={{…}}` en su JSX (grep-able, ver también
    // test/lint-guards.test.ts): el punto focal llega SOLO por `el.style.setProperty` en un
    // `useEffect`, que la CSP del lienzo sí permite (handoffs/3-0b.md §1) a diferencia de un
    // `style="…"` parseado desde el HTML servido. `element.style.setProperty` SÍ se refleja en el
    // atributo `style` tras ejecutarse (mutación cliente, tras existir el nodo) — lo que la CSP
    // bloquea es el atributo presente YA en el HTML que sirve el servidor, no esto.
    const { container } = render(<ImageBlock block={imageBlock()} mode="public" ref_={ref_} />);
    const img = container.querySelector("img")!;
    expect(img.style.getPropertyValue("--inv-focal-x")).toBe("50.00%");
    expect(img.style.getPropertyValue("--inv-focal-y")).toBe("35.00%");
  });
});
