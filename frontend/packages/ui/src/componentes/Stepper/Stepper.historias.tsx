"use client";

import { useState } from "react";
import type { Historia } from "../../historias/tipos.ts";
import { Stepper } from "./Stepper.tsx";

function Ejemplo() {
  const [valor, setValor] = useState(2);
  return <Stepper value={valor} onChange={setValor} min={0} max={10} label="lugares para la boda" />;
}

export const historias: Historia = {
  slug: "stepper",
  nombre: "Stepper",
  familia: "superficies",
  descripcion:
    "Contador numérico con botones ≥ 44 px («Restar/Sumar <campo>», nunca «+»/«−» mudos). Se deshabilita en los límites sin dejar de decir a quién pertenece el campo.",
  variantes: [{ nombre: "Lugares para la boda", render: () => <Ejemplo /> }],
  estados: [
    {
      nombre: "En el mínimo",
      render: () => <Stepper value={0} onChange={() => {}} min={0} max={5} label="acompañantes" />,
    },
    {
      nombre: "Deshabilitado",
      render: () => <Stepper value={2} onChange={() => {}} disabled label="lugares para la boda" />,
    },
  ],
};
