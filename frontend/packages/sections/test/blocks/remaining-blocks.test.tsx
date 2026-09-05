// Cobertura de los componentes de bloque que no tienen un escenario U- dedicado: TimeBlock,
// DateTimeRangeBlock, LinkBlock, LocationBlock, ChoiceBlock, BooleanBlock, PersonBlock,
// AudioBlock, ListTextBlock (caso con contenido) y TextBlock en modo canvas.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import {
  TextBlock,
  DateBlock,
  TimeBlock,
  DateTimeRangeBlock,
  LinkBlock,
  LocationBlock,
  ChoiceBlock,
  BooleanBlock,
  PersonBlock,
  AudioBlock,
  ListTextBlock,
} from "../../src/blocks/index.ts";
import { ComposedBlockSchema } from "../schema-values.ts";
import type { ComposedBlock } from "../../src/schema-types.ts";
import { textBlock, dateBlock } from "../fixtures.ts";

const ref_ = { sectionKey: "s", blockId: "b" };

describe("TextBlock", () => {
  it("mode='canvas' con onActivate: clic invoca onActivate con el ref_", () => {
    const onActivate = vi.fn();
    const { container } = render(
      <TextBlock block={textBlock()} mode="canvas" onActivate={onActivate} ref_={ref_} />,
    );
    const span = container.querySelector("span")!;
    expect(span.getAttribute("data-block-id")).toBe("b");
    span.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onActivate).toHaveBeenCalledWith(ref_);
  });
});

describe("DateBlock", () => {
  it("renderiza <time datetime='YYYY-MM-DD'> con el texto formateado", () => {
    const { container } = render(<DateBlock block={dateBlock()} mode="public" ref_={ref_} />);
    const time = container.querySelector("time")!;
    expect(time.getAttribute("datetime")).toBe("2026-12-12");
    expect(time.textContent).toBe("12 de diciembre de 2026");
  });
});

describe("TimeBlock", () => {
  it("renderiza <time datetime='HH:mm'> con el texto formateado", () => {
    const block = ComposedBlockSchema.parse({
      id: "event.time", role: "eventTime", type: "time", label: "Hora", provenance: "user",
      value: { kind: "time", value: "17:00", formatted: "5:00 p.m." },
    });
    const { container } = render(<TimeBlock block={block} mode="public" ref_={ref_} />);
    const time = container.querySelector("time")!;
    expect(time.getAttribute("datetime")).toBe("17:00");
    expect(time.textContent).toBe("5:00 p.m.");
  });
});

describe("DateTimeRangeBlock", () => {
  it("usa `start` como datetime y `formatted` como texto", () => {
    const block = ComposedBlockSchema.parse({
      id: "event.when", role: "eventWhen", type: "dateTimeRange", label: "Cuándo", provenance: "user",
      value: {
        kind: "dateTimeRange", start: "2026-12-12T17:00", end: "2026-12-12T23:00",
        formatted: "12 de diciembre de 2026, 5:00 p.m. – 11:00 p.m.",
      },
    });
    const { container } = render(<DateTimeRangeBlock block={block} mode="public" ref_={ref_} />);
    const time = container.querySelector("time")!;
    expect(time.getAttribute("datetime")).toBe("2026-12-12T17:00");
    expect(time.textContent).toContain("5:00 p.m.");
  });
});

describe("LinkBlock", () => {
  it("usa el label cuando existe", () => {
    const block = ComposedBlockSchema.parse({
      id: "event.mapLink", role: "eventMapLink", type: "link", label: "Mapa", provenance: "user",
      value: { kind: "link", href: "https://maps.example.com/x", label: "Cómo llegar" },
    });
    const { container } = render(<LinkBlock block={block} mode="public" ref_={ref_} />);
    const a = container.querySelector("a")!;
    expect(a.textContent).toBe("Cómo llegar");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("sin label, cae al host del href (04 §17.3)", () => {
    const block = ComposedBlockSchema.parse({
      id: "event.mapLink", role: "eventMapLink", type: "link", label: "Mapa", provenance: "user",
      value: { kind: "link", href: "https://maps.example.com/x" },
    });
    const { container } = render(<LinkBlock block={block} mode="public" ref_={ref_} />);
    expect(container.querySelector("a")!.textContent).toBe("maps.example.com");
  });

  it("un href fuera de esquema (defensa en profundidad) no se renderiza", () => {
    const block = {
      id: "event.mapLink", role: "eventMapLink", type: "link", label: "Mapa", provenance: "user",
      value: { kind: "link", href: "javascript:alert(1)" },
    } as unknown as ComposedBlock;
    const { container } = render(<LinkBlock block={block} mode="public" ref_={ref_} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("LocationBlock", () => {
  it("renderiza nombre, dirección y enlace de mapa", () => {
    const block = ComposedBlockSchema.parse({
      id: "event.place", role: "eventPlace", type: "location", label: "Lugar", provenance: "user",
      value: { kind: "location", name: "Jardín Las Palomas", address: "Av. Siempre Viva 123", mapHref: "https://maps.example.com/y" },
    });
    const { container } = render(<LocationBlock block={block} mode="public" ref_={ref_} />);
    expect(container.textContent).toContain("Jardín Las Palomas");
    expect(container.textContent).toContain("Av. Siempre Viva 123");
    expect(container.querySelector("a")!.getAttribute("href")).toBe("https://maps.example.com/y");
  });

  it("sin dirección ni mapHref, solo pinta el nombre", () => {
    const block = ComposedBlockSchema.parse({
      id: "event.place", role: "eventPlace", type: "location", label: "Lugar", provenance: "user",
      value: { kind: "location", name: "Jardín Las Palomas" },
    });
    const { container } = render(<LocationBlock block={block} mode="public" ref_={ref_} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("Jardín Las Palomas");
  });
});

describe("ChoiceBlock", () => {
  it("pinta el `label` ya resuelto por compose(), nunca el optionId", () => {
    const block = ComposedBlockSchema.parse({
      id: "gift.kind", role: "giftOptionKind", type: "choice", label: "Tipo", provenance: "user",
      value: { kind: "choice", optionId: "bank-account", label: "Cuenta bancaria" },
    });
    const { container } = render(<ChoiceBlock block={block} mode="public" ref_={ref_} />);
    expect(container.textContent).toBe("Cuenta bancaria");
    expect(container.textContent).not.toContain("bank-account");
  });
});

describe("BooleanBlock", () => {
  it("true ⇒ 'Sí', false ⇒ 'No'", () => {
    const make = (value: boolean) =>
      ComposedBlockSchema.parse({
        id: "rsvp.childrenAllowed", role: "rsvpChildrenAllowed", type: "boolean",
        label: "Niños", provenance: "business", value: { kind: "boolean", value },
      });
    const yes = render(<BooleanBlock block={make(true)} mode="public" ref_={ref_} />);
    expect(yes.container.textContent).toBe("Sí");
    const no = render(<BooleanBlock block={make(false)} mode="public" ref_={ref_} />);
    expect(no.container.textContent).toBe("No");
  });
});

describe("PersonBlock", () => {
  it("renderiza name y note cuando ambos existen", () => {
    const block = ComposedBlockSchema.parse({
      id: "parent.a1", role: "parentA1", type: "person", label: "Madre", provenance: "user",
      value: { kind: "person", name: "María López", note: "Madre de la novia" },
    });
    const { container } = render(<PersonBlock block={block} mode="public" ref_={ref_} />);
    expect(container.textContent).toBe("María LópezMadre de la novia");
  });

  it("sin note, no renderiza el <span> de la nota", () => {
    const block = ComposedBlockSchema.parse({
      id: "parent.a1", role: "parentA1", type: "person", label: "Madre", provenance: "user",
      value: { kind: "person", name: "María López" },
    });
    const { container } = render(<PersonBlock block={block} mode="public" ref_={ref_} />);
    expect(container.textContent).toBe("María López");
    // Envoltorio (activación) + nombre = 2; sin nota no hay un tercer <span>.
    expect(container.querySelectorAll("span").length).toBe(2);
  });
});

describe("AudioBlock", () => {
  it("nunca autoplay: sin autoPlay, con controls y muted por defecto (04 §17.5)", () => {
    const block = ComposedBlockSchema.parse({
      id: "footer.music", role: "backgroundMusic", type: "audio", label: "Música", provenance: "user",
      value: { kind: "audio", url: "https://cdn.example.com/musica.mp3" },
    });
    const { container } = render(<AudioBlock block={block} mode="public" ref_={ref_} />);
    const audio = container.querySelector("audio")!;
    expect(audio.hasAttribute("autoplay")).toBe(false);
    expect(audio.hasAttribute("controls")).toBe(true);
    expect(audio.muted).toBe(true);
  });
});

describe("ListTextBlock", () => {
  it("con items, pinta un <li> por ítem", () => {
    const block = ComposedBlockSchema.parse({
      id: "amenity.detail", role: "amenityDetail", type: "listText", label: "Detalle", provenance: "user",
      value: { kind: "listText", items: ["Estacionamiento", "Área para niños", "Barra libre"] },
    });
    const { container } = render(<ListTextBlock block={block} mode="public" ref_={ref_} />);
    expect(container.querySelectorAll("li").length).toBe(3);
    expect(container.querySelectorAll("li")[1]!.textContent).toBe("Área para niños");
  });
});
