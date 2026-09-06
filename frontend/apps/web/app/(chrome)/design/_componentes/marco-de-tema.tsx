"use client";

import { useState, type ReactNode } from "react";
import estilos from "../galeria.module.css";

const TEMAS = [
  { id: "light", etiqueta: "Claro" },
  { id: "dark", etiqueta: "Oscuro" },
] as const;

type Tema = (typeof TEMAS)[number]["id"];

/**
 * Envuelve la galería en un `data-theme` conmutable. Es la demostración de la regla de `11 §1.5`:
 * el tema oscuro es un MAPA de tokens, no una excepción — dentro de este marco no hay un solo
 * componente que sepa en qué tema está.
 */
export function MarcoDeTema({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>("light");
  return (
    <div data-theme={tema} className={`${estilos.raiz} min-h-screen`} data-galeria-tema={tema}>
      {/* `<header>`, no `<div>` (hallazgo de `@axe-core/playwright`, `design-axe.spec.ts`, regla
          "region"): esta barra vive fuera de `<nav>`/`<main>` y sin landmark quedaba fuera de
          cualquier región, "contenido huérfano" para un lector de pantalla que navegue por
          regiones. `<header>` aquí (no anidado en article/aside/main/nav/section) resuelve a
          role="banner" sin marcar nada a mano. */}
      <header className="sticky top-0 z-20 border-b border-ui-divider bg-ui-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-ui-page flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="font-ui-label text-ui-label-md uppercase text-ui-ink-muted">
            Sistema de diseño · paleta Bugambilia
          </p>
          <div
            role="group"
            aria-label="Tema de la galería"
            className="flex gap-1 rounded-ui-pill bg-ui-surface-alt p-1"
          >
            {TEMAS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tema === t.id}
                onClick={() => setTema(t.id)}
                className={
                  "rounded-ui-pill px-4 py-2 font-ui-text text-ui-text-sm transition-colors duration-[var(--ui-dur-1)] ease-ui-out " +
                  (tema === t.id
                    ? "bg-ui-primary text-ui-on-primary"
                    : "text-ui-ink hover:bg-ui-primary-soft hover:text-ui-on-primary-soft")
                }
              >
                {t.etiqueta}
              </button>
            ))}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
