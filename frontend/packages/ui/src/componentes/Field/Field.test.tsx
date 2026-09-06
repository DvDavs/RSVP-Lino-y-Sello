import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Field } from "./Field.tsx";

describe("Field", () => {
  it("asocia la etiqueta al control por id/htmlFor", () => {
    render(
      <Field label="Correo electrónico">
        <input type="email" />
      </Field>,
    );
    const control = screen.getByLabelText("Correo electrónico");
    expect(control).toBeInstanceOf(HTMLInputElement);
  });

  it("respeta un id explícito", () => {
    render(
      <Field id="correo" label="Correo electrónico">
        <input type="email" />
      </Field>,
    );
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("id", "correo");
  });

  it("la ayuda queda enlazada por aria-describedby cuando no hay error", () => {
    render(
      <Field label="Correo electrónico" hint="El mismo con el que contrataste">
        <input type="email" />
      </Field>,
    );
    const control = screen.getByLabelText("Correo electrónico");
    const idAyuda = control.getAttribute("aria-describedby");
    expect(idAyuda).toBeTruthy();
    expect(document.getElementById(idAyuda!)).toHaveTextContent("El mismo con el que contrataste");
    expect(control).not.toHaveAttribute("aria-invalid");
  });

  it("el error sustituye a la ayuda, marca aria-invalid y usa role=alert", () => {
    render(
      <Field label="Correo electrónico" hint="Ayuda" error="Revisa el correo: le falta el dominio.">
        <input type="email" />
      </Field>,
    );
    const control = screen.getByLabelText("Correo electrónico");
    expect(control).toHaveAttribute("aria-invalid", "true");
    const idDescrito = control.getAttribute("aria-describedby");
    const mensaje = document.getElementById(idDescrito!);
    expect(mensaje).toHaveTextContent("Revisa el correo: le falta el dominio.");
    expect(mensaje).toHaveAttribute("role", "alert");
    expect(screen.queryByText("Ayuda")).not.toBeInTheDocument();
  });

  it("required añade un asterisco decorativo sin romper el nombre accesible", () => {
    render(
      <Field label="Correo electrónico" required>
        <input type="email" />
      </Field>,
    );
    expect(screen.getByLabelText("Correo electrónico", { exact: false })).toBeInTheDocument();
  });

  it("sin violaciones de axe", async () => {
    const { container } = render(
      <div>
        <Field label="Correo electrónico" hint="Ayuda">
          <input type="email" />
        </Field>
        <Field label="Fecha del evento" error="Falta la fecha">
          <input type="date" />
        </Field>
      </div>,
    );
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
