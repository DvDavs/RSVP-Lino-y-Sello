// components/sitio/AvisoBorrador.test.tsx — que el aviso de borrador diga exactamente eso, con la
// fecha, y no un texto genérico que se pueda confundir con un documento ya validado.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AvisoBorrador } from "./AvisoBorrador.tsx";
import { es_MX } from "@/lib/i18n";

describe("AvisoBorrador", () => {
  it("dice que es un borrador pendiente de revisión legal y lleva la fecha", () => {
    render(<AvisoBorrador />);
    const aviso = screen.getByRole("note");
    expect(aviso.textContent).toContain("Borrador pendiente de revisión legal");
    expect(aviso.textContent).toContain(es_MX.legal.fechaUltimaRevision);
  });

  it("usa el mismo texto que compone `es_MX.legal.avisoBorrador`, no uno reescrito a mano", () => {
    render(<AvisoBorrador />);
    expect(screen.getByRole("note").textContent).toBe(
      es_MX.legal.avisoBorrador(es_MX.legal.fechaUltimaRevision),
    );
  });
});
