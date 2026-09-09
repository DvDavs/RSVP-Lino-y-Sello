// components/sitio/TarjetasContacto.test.tsx — mismo criterio de `contacto.test.tsx` (G-01) para la
// versión en tarjeta de `/contacto`: sin canales, ni una tarjeta vacía; con canales, tarjeta y botón
// reales por cada uno.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TarjetasContacto } from "./TarjetasContacto.tsx";
import { leerContacto } from "@/lib/contacto";
import { es_MX } from "@/lib/i18n";

describe("TarjetasContacto", () => {
  it("sin nada configurado no pinta ninguna tarjeta: solo la frase honesta", () => {
    render(<TarjetasContacto contacto={leerContacto({})} />);
    expect(screen.getByText(es_MX.sitio.contactar.sinContacto)).not.toBeNull();
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("con los dos canales, hay dos tarjetas con su icono, su dato y su botón", () => {
    render(
      <TarjetasContacto
        contacto={leerContacto({
          NEXT_PUBLIC_CONTACTO_WHATSAPP: "+5215512345678",
          NEXT_PUBLIC_CONTACTO_CORREO: "hola@ejemplo.mx",
        })}
      />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: es_MX.sitio.paginaContacto.tarjetaWhatsapp.titulo })).not.toBeNull();
    expect(screen.getByRole("heading", { name: es_MX.sitio.paginaContacto.tarjetaCorreo.titulo })).not.toBeNull();
    const whatsapp = screen.getByRole("link", { name: es_MX.sitio.contactar.whatsapp });
    expect(whatsapp.getAttribute("href")).toContain("https://wa.me/5215512345678?text=");
    expect(whatsapp.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("link", { name: es_MX.sitio.contactar.correo }).getAttribute("href")).toContain(
      "mailto:hola@ejemplo.mx",
    );
    expect(screen.getByText("+521 55 1234 5678")).not.toBeNull();
  });

  it("con un solo canal se pinta una sola tarjeta, no un hueco donde iría la otra", () => {
    render(<TarjetasContacto contacto={leerContacto({ NEXT_PUBLIC_CONTACTO_CORREO: "hola@ejemplo.mx" })} />);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("link", { name: es_MX.sitio.contactar.correo })).not.toBeNull();
    expect(screen.queryByRole("link", { name: es_MX.sitio.contactar.whatsapp })).toBeNull();
  });
});
