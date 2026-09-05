// components/fields/solo-lectura-donde-se-cambia.test.tsx — U-3: un campo bloqueado nunca es un
// candado mudo. `04 §6.3` dibujaba `[Editar allí]` junto a la explicación y no se implementó.
//
// La FECHA ya no pasa por aquí: desde I-06 se cambia de verdad, con su propio control
// (`FechaDelEvento`, `fecha-del-evento.test.tsx`). Este componente sigue sirviendo a los demás
// bloques `business` —hashtag, «se admiten niños»…—, que todavía no tienen ruta de cliente que los
// escriba y por eso conservan el enlace a la ayuda en vez de prometer una edición que no existe.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SoloLectura } from "./FieldShell.tsx";
import { es_MX } from "@/lib/i18n";

describe("un campo bloqueado nunca es un candado mudo", () => {
  it("cuando hay un sitio donde se resuelve, lo enlaza (el `[Editar allí]` de §6.3)", () => {
    render(
      <SoloLectura
        label="Hashtag"
        valor="#AnaYLuis2027"
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
