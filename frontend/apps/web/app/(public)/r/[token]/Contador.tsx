"use client";

// app/(public)/r/[token]/Contador.tsx — el control `[ - ] n [ + ]  de n` del wireframe (§B3.1).
// Escrito a mano (no hay `Input`/`Stepper` disponible: esta ruta no importa el barril
// `@invitaciones/ui`, README §"Presupuesto"), con objetivo de toque >= 44px y el valor anunciado a
// lectores de pantalla en una región viva, para que +/- repetidos no se pierdan en el silencio.
import { textosInvitado } from "./textos";
import estilos from "./pagina.module.css";

interface ContadorProps {
  readonly etiqueta: string;
  readonly valor: number;
  readonly maximo: number;
  readonly onCambiar: (siguiente: number) => void;
  readonly deshabilitado?: boolean;
}

export function Contador({ etiqueta, valor, maximo, onCambiar, deshabilitado = false }: ContadorProps) {
  const puedeRestar = !deshabilitado && valor > 0;
  const puedeSumar = !deshabilitado && valor < maximo;

  return (
    <div className={estilos.contadorFila} role="group" aria-label={etiqueta}>
      <span className={estilos.contadorEtiqueta}>{etiqueta}</span>
      <div className={estilos.contadorControles}>
        <button
          type="button"
          className={estilos.contadorBoton}
          onClick={() => onCambiar(Math.max(0, valor - 1))}
          disabled={!puedeRestar}
          aria-label={`${textosInvitado.decision.restar}: ${etiqueta}`}
        >
          −
        </button>
        <span className={estilos.contadorValor} aria-live="polite">
          {valor}
        </span>
        <button
          type="button"
          className={estilos.contadorBoton}
          onClick={() => onCambiar(Math.min(maximo, valor + 1))}
          disabled={!puedeSumar}
          aria-label={`${textosInvitado.decision.sumar}: ${etiqueta}`}
        >
          +
        </button>
        <span className={estilos.contadorDe}>{textosInvitado.decision.de(maximo)}</span>
      </div>
    </div>
  );
}
