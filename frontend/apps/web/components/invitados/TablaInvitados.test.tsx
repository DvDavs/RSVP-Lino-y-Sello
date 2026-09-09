// components/invitados/TablaInvitados.test.tsx — vigila los arreglos de la revisión Opus sobre la
// presentación de la lista: nombre accesible de la tabla, disparador de edición que dice qué hace,
// corte en el punto de ruptura del EDITOR (`ed:`, 900 px) y orden de encabezados en las tarjetas.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EventRules, GuestItem } from "@/lib/invitados/api";
import { textosInvitados as t } from "@/lib/invitados/textos";
import { TablaInvitados } from "./TablaInvitados";
import { TarjetasInvitados } from "./TarjetasInvitados";

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const reglas: EventRules = { childrenAllowed: true, youngAllowed: false };

function invitado(sobrescribir: Partial<GuestItem> = {}): GuestItem {
  return {
    id: 1,
    fullName: "María Fernanda Cruz",
    email: null,
    phone: null,
    tableNumber: null,
    adults: 2,
    children: 1,
    young: 0,
    adultsConfirmed: 0,
    childrenConfirmed: 0,
    youngConfirmed: 0,
    status: "PENDING",
    message: null,
    updatedAt: null,
    ...sobrescribir,
  };
}

function pintarTabla(invitados = [invitado()]) {
  return render(
    <TablaInvitados
      invitationId={7}
      rules={reglas}
      invitados={invitados}
      onCambiado={() => {}}
      onEliminado={() => {}}
    />,
  );
}

describe("TablaInvitados — accesibilidad", () => {
  it("la tabla tiene nombre accesible (<caption>), no solo «tabla de 5 columnas»", () => {
    pintarTabla();
    expect(screen.getByRole("table", { name: t.tabla.leyenda })).not.toBeNull();
  });

  it("el disparador de edición dice QUÉ hace, no solo a quién (ahí vive también el borrado)", () => {
    pintarTabla();
    expect(screen.getByRole("button", { name: t.tabla.editarA("María Fernanda Cruz") })).not.toBeNull();
  });

  it("con fullName null usa el respaldo también en la etiqueta accesible", () => {
    pintarTabla([invitado({ fullName: null })]);
    expect(screen.getByRole("button", { name: t.tabla.editarA(t.tabla.sinNombre) })).not.toBeNull();
  });

  it("el disparador de edición lleva anillo de foco visible del sistema (--ui-focus)", () => {
    pintarTabla();
    const disparador = screen.getByRole("button", { name: t.tabla.editarA("María Fernanda Cruz") });
    expect(disparador.className).toContain("focus-visible:");
    expect(disparador.className).toContain("var(--ui-focus)");
  });
});

describe("punto de ruptura: el del EDITOR (ed:, 900 px), no el genérico md:", () => {
  it("la tabla solo aparece a partir de `ed:`", () => {
    const { container } = pintarTabla();
    const envoltura = container.firstElementChild as HTMLElement;
    expect(envoltura.className).toContain("ed:block");
    expect(envoltura.className).not.toContain("md:block");
  });

  it("las tarjetas desaparecen a partir de `ed:`", () => {
    const { container } = render(
      <TarjetasInvitados
        invitationId={7}
        rules={reglas}
        invitados={[invitado()]}
        onCambiado={() => {}}
        onEliminado={() => {}}
      />,
    );
    const lista = container.querySelector("ul") as HTMLElement;
    expect(lista.className).toContain("ed:hidden");
    expect(lista.className).not.toContain("md:hidden");
  });
});

describe("voces tipográficas del sistema, nunca tamaños inventados", () => {
  // Se mira el FUENTE, no el DOM: los botones de `@invitaciones/ui` traen su propio `text-[15px]`
  // interno, que es del sistema de diseño y no de esta pantalla. Lo que la regla dura prohíbe es
  // inventar tamaños AQUÍ en vez de usar `display-*`/`heading-*`/`text-*`/`label-*`.
  it("ningún componente de `components/invitados/**` inventa un `text-[NNpx]`", () => {
    const carpeta = join(process.cwd(), "components", "invitados");
    const fuentes = readdirSync(carpeta).filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."));
    expect(fuentes.length).toBeGreaterThan(4);
    for (const fichero of fuentes) {
      const texto = readFileSync(join(carpeta, fichero), "utf8");
      expect(texto, `${fichero} usa un tamaño de texto inventado`).not.toMatch(/\btext-\[[\d.]+px\]/);
    }
  });

  it("el nombre de la fila usa la voz `heading-sm` («titulo de fila»)", () => {
    pintarTabla();
    const disparador = screen.getByRole("button", { name: t.tabla.editarA("María Fernanda Cruz") });
    expect(disparador.className).toContain("heading-sm");
  });
});

describe("orden de encabezados", () => {
  it("el nombre de la tarjeta es `h2`: el único nivel por encima es el `h1` de la pantalla", () => {
    render(
      <TarjetasInvitados
        invitationId={7}
        rules={reglas}
        invitados={[invitado()]}
        onCambiado={() => {}}
        onEliminado={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "María Fernanda Cruz" })).not.toBeNull();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });
});
