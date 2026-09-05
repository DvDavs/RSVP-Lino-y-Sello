// app/(chrome)/design/iconos/page.tsx — versión MÍNIMA de la galería de iconos, creada por este
// agente (mitad B) porque la mitad A —dueña de esta página en el reparto (`3c-3-iconos.md` §
// "Entregables" 4)— no existe todavía en este worktree (ajuste del orquestador, `3c-3-iconos.md`
// #2: "crea la tuya MÍNIMA... el orquestador se queda con la de A en el merge"). Solo importa
// `mitad-b.tsx` (mis 41 iconos, nombres 42-82 del inventario); la versión final añade `mitad-a.tsx`
// y el resto de variantes que pide `11 §4` (16/24/32/48, mono/duo, sobre superficie y sobre
// primario, buscador). Aquí se cubre lo mínimo para poder capturar evidencia de esta mitad.
"use client";

import { useMemo, useState } from "react";
import { iconosMitadB } from "./mitad-b.tsx";

const TAMANOS = [16, 24, 32, 48] as const;

export default function PaginaIconos() {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return iconosMitadB;
    return iconosMitadB.filter(({ nombre }) => nombre.includes(q));
  }, [busqueda]);

  return (
    <main style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Sistema de iconos — mitad B</h1>
      <p style={{ color: "var(--ui-ink-muted, #666)", marginBottom: 20 }}>
        41 iconos (nombres 42-82 del inventario, <code>11 §4.2</code>) + 3 ilustraciones de estados
        vacíos. Versión mínima: la galería completa (mono/duo × 16/24/32/48, sobre superficie y sobre
        primario) la entrega la mitad A.
      </p>

      <label style={{ display: "block", marginBottom: 20 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Buscar icono</span>
        <input
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="p. ej. rsvp, boda, compartir…"
          style={{
            width: "100%",
            maxWidth: 320,
            height: 40,
            borderRadius: 8,
            border: "1.5px solid var(--ui-border, #999)",
            padding: "0 12px",
            fontSize: 15,
          }}
        />
      </label>

      <p style={{ fontSize: 13, color: "var(--ui-ink-muted, #666)", marginBottom: 12 }}>
        {filtrados.length} de {iconosMitadB.length}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        {filtrados.map(({ nombre, Icono }) => (
          <article
            key={nombre}
            style={{
              border: "1px solid var(--ui-divider, #ddd)",
              borderRadius: 14,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
              {TAMANOS.map((tamano) => (
                <div
                  key={`duo-${tamano}`}
                  title={`${nombre} · duo · ${tamano}px sobre primary-soft`}
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: tamano + 16,
                    height: tamano + 16,
                    borderRadius: 10,
                    background: "var(--ui-primary-soft, #f2e7ee)",
                    color: "var(--ui-link, #7a1f5c)",
                  }}
                >
                  <Icono size={tamano} tone="duo" />
                </div>
              ))}
              <div
                title={`${nombre} · mono · 24px`}
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "var(--ui-primary, #7a1f5c)",
                  color: "var(--ui-on-primary, #fff)",
                }}
              >
                <Icono size={24} tone="mono" />
              </div>
            </div>
            <code style={{ fontSize: 12.5 }}>{nombre}</code>
          </article>
        ))}
      </div>
    </main>
  );
}
