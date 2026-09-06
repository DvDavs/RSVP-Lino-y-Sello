// components/sitio/contacto.test.tsx — G-01: el sitio no tenía por dónde comprar ni por dónde
// preguntar. Lo que se prueba aquí es la regla que hace que eso no se arregle mintiendo: con datos
// configurados hay canales de verdad; sin datos NO hay ningún botón, hay una frase honesta.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContactoParaContratar } from "./ContactoParaContratar.tsx";
import { formatearTelefono, leerContacto, normalizarCorreo, normalizarTelefono } from "@/lib/contacto";
import { es_MX } from "@/lib/i18n";

describe("lectura del entorno", () => {
  it("acepta E.164 con y sin `+`, y con los espacios que uno escribe en un `.env`", () => {
    expect(normalizarTelefono("+5215512345678")).toBe("5215512345678");
    expect(normalizarTelefono("52 155 1234 5678")).toBe("5215512345678");
    expect(normalizarTelefono("+52 (155) 1234-5678")).toBe("5215512345678");
  });

  it("rechaza lo que no es un teléfono en vez de publicar un enlace roto", () => {
    for (const basura of [undefined, "", "  ", "pendiente", "0155123456789", "1234567", "+52155123456789012"]) {
      expect(normalizarTelefono(basura)).toBeNull();
    }
  });

  it("acepta un correo y rechaza lo que no lo es", () => {
    expect(normalizarCorreo(" hola@ejemplo.mx ")).toBe("hola@ejemplo.mx");
    for (const basura of [undefined, "", "hola", "hola@ejemplo", "hola @ejemplo.mx"]) {
      expect(normalizarCorreo(basura)).toBeNull();
    }
  });

  it("el enlace de WhatsApp lleva el mensaje ya escrito en es-MX y sin `+` en la ruta", () => {
    const { whatsapp } = leerContacto({ NEXT_PUBLIC_CONTACTO_WHATSAPP: "+5215512345678" });
    expect(whatsapp?.enlace).toBe(
      `https://wa.me/5215512345678?text=${encodeURIComponent(es_MX.sitio.contactar.mensaje)}`,
    );
    expect(whatsapp?.etiqueta).toBe("+521 55 1234 5678");
  });

  it("el correo lleva asunto, para que quien lo reciba sepa de qué va sin abrirlo", () => {
    const { correo } = leerContacto({ NEXT_PUBLIC_CONTACTO_CORREO: "hola@ejemplo.mx" });
    expect(correo?.enlace).toBe(`mailto:hola@ejemplo.mx?subject=${encodeURIComponent(es_MX.sitio.contactar.asunto)}`);
  });

  it("un entorno vacío NO está configurado, y uno con un solo canal SÍ", () => {
    expect(leerContacto({}).configurado).toBe(false);
    expect(leerContacto({ NEXT_PUBLIC_CONTACTO_WHATSAPP: "no-es-un-numero" }).configurado).toBe(false);
    expect(leerContacto({ NEXT_PUBLIC_CONTACTO_CORREO: "hola@ejemplo.mx" }).configurado).toBe(true);
  });

  it("el número de diez dígitos sin prefijo también se lee", () => {
    expect(formatearTelefono("5512345678")).toBe("+55 1234 5678");
  });
});

describe("bloque de contacto", () => {
  it("sin nada configurado dice la verdad y no pinta ni un botón muerto", () => {
    render(<ContactoParaContratar contacto={leerContacto({})} />);
    expect(screen.getByText(es_MX.sitio.contactar.sinContacto)).not.toBeNull();
    expect(screen.queryByRole("link", { name: es_MX.sitio.contactar.whatsapp })).toBeNull();
    expect(screen.queryByRole("link", { name: es_MX.sitio.contactar.correo })).toBeNull();
  });

  it("con los dos canales, el de WhatsApp es un enlace real que abre fuera", () => {
    render(
      <ContactoParaContratar
        contacto={leerContacto({
          NEXT_PUBLIC_CONTACTO_WHATSAPP: "+5215512345678",
          NEXT_PUBLIC_CONTACTO_CORREO: "hola@ejemplo.mx",
        })}
      />,
    );
    const whatsapp = screen.getByRole("link", { name: es_MX.sitio.contactar.whatsapp });
    expect(whatsapp.getAttribute("href")).toContain("https://wa.me/5215512345678?text=");
    expect(whatsapp.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("link", { name: es_MX.sitio.contactar.correo }).getAttribute("href")).toContain(
      "mailto:hola@ejemplo.mx",
    );
    // El dato en claro, además del enlace: se puede copiar o teclear en otro aparato.
    expect(screen.getByText("+521 55 1234 5678")).not.toBeNull();
    expect(screen.getByText("hola@ejemplo.mx")).not.toBeNull();
    expect(screen.queryByText(es_MX.sitio.contactar.sinContacto)).toBeNull();
  });

  it("con un solo canal se pinta ese, no un hueco donde iría el otro", () => {
    render(<ContactoParaContratar contacto={leerContacto({ NEXT_PUBLIC_CONTACTO_CORREO: "hola@ejemplo.mx" })} />);
    expect(screen.getByRole("link", { name: es_MX.sitio.contactar.correo })).not.toBeNull();
    expect(screen.queryByRole("link", { name: es_MX.sitio.contactar.whatsapp })).toBeNull();
    expect(screen.getByText("hola@ejemplo.mx")).not.toBeNull();
  });

  it("el título es opcional y respeta el nivel que le pide la página", () => {
    render(<ContactoParaContratar contacto={leerContacto({})} conTitulo nivelTitulo="h3" />);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(es_MX.sitio.contactar.titulo);
  });
});
