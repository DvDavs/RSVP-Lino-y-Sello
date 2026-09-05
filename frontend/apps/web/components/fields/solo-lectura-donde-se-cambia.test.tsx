// components/fields/solo-lectura-donde-se-cambia.test.tsx — U-3: «la fecha de la boda no se puede
// cambiar en ninguna parte». Salía 🔒 con «Se toma de los datos de tu invitación» y ningún enlace,
// ningún botón, ningún nombre de pantalla: cinco minutos buscando algo que no existe, y el TERCER
// verbo del criterio de terminado imposible. `04 §6.3` dibujaba `[Editar allí]` justo ahí.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SoloLectura } from "./FieldShell.tsx";
import { es_MX } from "@/lib/i18n";

describe("un campo bloqueado nunca es un candado mudo", () => {
  it("cuando hay un sitio donde se resuelve, lo enlaza (el `[Editar allí]` de §6.3)", () => {
    render(
      <SoloLectura
        label="Fecha del evento"
        valor="18 de abril de 2027"
        explicacion={es_MX.editor.soloLectura.deLaInvitacion}
        dondeSeCambia={{ href: "/ayuda#fecha", etiqueta: es_MX.editor.soloLectura.dondeSeCambia }}
      />,
    );
    const enlace = screen.getByRole("link", { name: /dónde se cambia/i });
    expect(enlace.getAttribute("href")).toBe("/ayuda#fecha");
    // La frase original de §6.3 sigue entera: la corrección AÑADE, no sustituye.
    expect(screen.getByText(/Se toma de los datos de tu invitación\./)).toBeTruthy();
  });

  it("sin destino no se inventa ninguno: un enlace a ningún sitio es peor que no tenerlo", () => {
    render(<SoloLectura label="Texto del botón" valor="Save the date" explicacion={es_MX.editor.soloLectura.deLaPlantilla} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
