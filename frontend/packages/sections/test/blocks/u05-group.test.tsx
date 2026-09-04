// U-05 (04 §20.1): "GroupBlock con 3 ítems → <ul> con 3 <li>, en el orden de items (R7)."
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { GroupBlock } from "../../src/blocks/index.ts";
import { groupBlock } from "../fixtures.ts";

const ref_ = { sectionKey: "family", blockId: "family.godparents" };

describe("U-05 — GroupBlock: <ul>/<li> en el orden de items", () => {
  it("3 ítems ⇒ <ul> con exactamente 3 <li>, en el mismo orden que `items`", () => {
    const group = groupBlock();
    const { container } = render(<GroupBlock group={group} mode="public" ref_={ref_} />);

    const list = container.querySelector("ul");
    expect(list).not.toBeNull();
    const items = list!.querySelectorAll(":scope > li");
    expect(items.length).toBe(3);

    // Orden: R7 — "los ítems se ordenan por su posición en doc.content[groupId].items".
    expect(items[0]!.textContent).toContain("Roberto Cruz");
    expect(items[1]!.textContent).toContain("Carolina Aquino");
    expect(items[2]!.textContent).toContain("Familia Gómez");
  });

  it("no son <div> sueltos: cada ítem es un <li> real (04 §17.3)", () => {
    const group = groupBlock();
    const { container } = render(<GroupBlock group={group} mode="public" ref_={ref_} />);
    expect(container.querySelectorAll("div").length).toBe(0);
  });

  it("mode='canvas': un itemBlock cuya clave `itemId.itemBlockId` está en `pending` recibe aria-busy", () => {
    const group = groupBlock();
    const firstItemId = group.items[0]!.itemId;
    const firstItemBlockId = group.items[0]!.blocks[0]!.id;
    const pending = new Set([`${firstItemId}.${firstItemBlockId}`]);
    const { container } = render(
      <GroupBlock group={group} mode="canvas" onActivate={() => {}} ref_={ref_} pending={pending} />,
    );
    const activated = container.querySelector(`[data-item-id="${firstItemId}"]`)!;
    expect(activated.getAttribute("aria-busy")).toBe("true");
    // El segundo ítem no está en `pending`: sin aria-busy.
    const secondItemId = group.items[1]!.itemId;
    const notPending = container.querySelector(`[data-item-id="${secondItemId}"]`)!;
    expect(notPending.hasAttribute("aria-busy")).toBe(false);
  });
});
