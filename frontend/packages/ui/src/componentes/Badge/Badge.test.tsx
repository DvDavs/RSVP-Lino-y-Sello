import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge.tsx";

expect.extend(toHaveNoViolations);

describe("Badge", () => {
  it("siempre lleva texto (nunca solo color)", () => {
    render(<Badge tone="primary">Nuevo</Badge>);
    expect(screen.getByText("Nuevo")).toBeInTheDocument();
  });

  it.each(["neutro", "primary", "success", "warning", "danger", "info", "accent"] as const)(
    "tono %s no introduce violaciones de a11y",
    async (tone) => {
      const { container } = render(<Badge tone={tone}>Texto de ejemplo</Badge>);
      expect(await axe(container)).toHaveNoViolations();
    },
  );

  it("admite className adicional sin perder las clases base", () => {
    render(
      <Badge tone="warning" className="ml-2">
        Texto de ejemplo
      </Badge>,
    );
    const badge = screen.getByText("Texto de ejemplo");
    expect(badge.className).toMatch(/label-sm/);
    expect(badge.className).toMatch(/ml-2/);
  });
});
