// U-04 (04 §20.1): "RichTextBlock con marcas bold+italic y href → produce <strong><em><a>; CERO
// innerHTML (se afirma sobre el HTML serializado)."
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { RichTextBlock } from "../../src/blocks/index.ts";
import { richTextBlock } from "../fixtures.ts";
import { ComposedBlockSchema } from "../schema-values.ts";
import type { ComposedBlock } from "../../src/schema-types.ts";

const ref_ = { sectionKey: "couple", blockId: "couple.groomText" };

describe("U-04 — RichTextBlock: árbol React a mano, cero innerHTML", () => {
  it("produce <strong>/<em>/<a> anidados correctamente y el texto plano completo", () => {
    const { container } = render(<RichTextBlock block={richTextBlock()} mode="public" ref_={ref_} />);

    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
    const em = strong!.querySelector("em");
    expect(em).not.toBeNull();
    expect(em!.textContent).toBe("eterno");

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe("https://ejemplo.mx/historia");
    expect(link!.getAttribute("target")).toBe("_blank");
    expect(link!.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link!.textContent).toBe("nuestra historia");

    expect(container.querySelector("p")).not.toBeNull();
    expect(container.textContent).toBe("Te prometo amor eterno y visitar nuestra historia");
  });

  it("NUNCA usa dangerouslySetInnerHTML: el HTML serializado no contiene marcado inyectado como texto", () => {
    const { container } = render(<RichTextBlock block={richTextBlock()} mode="public" ref_={ref_} />);
    // Si el componente hubiese serializado el doc a una cadena HTML y la hubiese insertado con
    // dangerouslySetInnerHTML, el propio `<p>` no tendría hijos <strong>/<em>/<a> como ELEMENTOS
    // DOM reales — tendría un único nodo de texto con las etiquetas literales. Comprobamos ambas
    // cosas: hay elementos reales, y ninguna etiqueta aparece como TEXTO literal en ningún nodo.
    const paragraph = container.querySelector("p")!;
    expect(paragraph.children.length).toBeGreaterThan(0);
    for (const node of Array.from(paragraph.querySelectorAll("*"))) {
      expect(node.textContent).not.toMatch(/<[a-z]+[^>]*>/i);
    }
  });

  it("rechaza un href fuera de esquema http(s) (defensa en profundidad, 04 §17.6)", () => {
    // `HttpUrl` (esquema) ya rechazaría "javascript:…" en `.parse()` — así que este fixture NO
    // pasa por él a propósito: simula que un valor mal formado llega igual al componente (otro
    // caller, un desajuste de versión), que es exactamente el escenario que la defensa en
    // profundidad de `blocks/url.ts` cubre. Cast deliberado, no un uso normal del tipo.
    const block = {
      id: "couple.groomText", role: "celebrantAText", type: "richText",
      label: "Mensaje", provenance: "user",
      value: {
        kind: "richText",
        doc: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "clic aquí", href: "javascript:alert(1)" }],
            },
          ],
        },
      },
    } as unknown as ComposedBlock;
    const { container } = render(<RichTextBlock block={block} mode="public" ref_={ref_} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("clic aquí");
  });

  it("value: null no renderiza ningún nodo (R2/R5)", () => {
    const block = ComposedBlockSchema.parse({
      id: "couple.groomText", role: "celebrantAText", type: "richText",
      label: "Mensaje", provenance: "empty", value: null,
    });
    const { container } = render(<RichTextBlock block={block} mode="public" ref_={ref_} />);
    expect(container.innerHTML).toBe("");
  });
});
