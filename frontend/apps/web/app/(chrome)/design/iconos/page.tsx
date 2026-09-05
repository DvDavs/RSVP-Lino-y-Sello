"use client";
// app/(chrome)/design/iconos/page.tsx — galería de `@invitaciones/icons` (brief 3C-3 §"Entregables"
// 4). Combina `mitad-a.tsx` (navegación, edición, y las secciones que caen en los primeros 41
// nombres) y `mitad-b.tsx` (los nombres 42 a 82, integrados desde 3C-3B). No depende
// de `app/(chrome)/design/layout.tsx` ni de un índice `/design` (los crea otro bloque en paralelo,
// en otro worktree): esta ruta funciona sola, con `app/(chrome)/layout.tsx` como único ancestro.
//
// Componente de cliente porque el buscador filtra en el propio navegador (sin ida y vuelta al
// servidor): no hay `export const metadata` aquí por esa razón (Next lo prohíbe en un Client
// Component); la pestaña se queda con el título por defecto de `(chrome)/layout.tsx`.
import { useMemo, useState } from "react";
import { Icon } from "@invitaciones/icons";
import type { IconTone } from "@invitaciones/icons";
import { iconosMitadA } from "./mitad-a.tsx";
import { iconosMitadB } from "./mitad-b.tsx";
import type { EntradaGaleria } from "./tipos.ts";
import styles from "./iconos.module.css";

const TAMANOS = [16, 24, 32, 48] as const;
const TONOS: readonly IconTone[] = ["duo", "mono"];
const FONDOS = ["surface", "primary"] as const;

const TODOS: EntradaGaleria[] = [...iconosMitadA, ...iconosMitadB].sort((a, b) => a.nombre.localeCompare(b.nombre));

export default function PaginaIconos() {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const consulta = busqueda.trim().toLowerCase();
    return consulta === "" ? TODOS : TODOS.filter((entrada) => entrada.nombre.includes(consulta));
  }, [busqueda]);

  return (
    <main className={styles.pagina}>
      <header className={styles.cabecera}>
        <p className={styles.etiqueta}>Sistema de diseño · @invitaciones/icons</p>
        <h1 className={styles.titulo}>Iconos</h1>
        <p className={styles.intro}>
          Retícula 24×24, trazo <code>1.75</code>, dos tonos vía <code>var(--tono)</code> (doc 11 §4.1). {TODOS.length}{" "}
          de 82 nombres del inventario canónico tienen ya su SVG. Cada icono se muestra en <code>mono</code> y{" "}
          <code>duo</code>, sobre superficie y sobre el color primario, a 16/24/32/48 px.
        </p>
        <label className={styles.buscadorEtiqueta} htmlFor="buscador-iconos">
          Buscar por nombre
        </label>
        <input
          id="buscador-iconos"
          className={styles.buscador}
          type="search"
          placeholder='p. ej. "chevron", "rsvp"…'
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
        />
      </header>

      {filtrados.length === 0 ? (
        <p className={styles.sinResultados}>Ningún icono coincide con «{busqueda}».</p>
      ) : (
        <ul className={styles.rejilla}>
          {filtrados.map((entrada) => (
            <li key={entrada.nombre} className={styles.tarjeta}>
              <p className={styles.nombreIcono}>{entrada.nombre}</p>
              <div className={styles.combinaciones}>
                {FONDOS.map((fondo) => (
                  <div key={fondo} className={fondo === "surface" ? styles.filaSuperficie : styles.filaPrimario}>
                    {TONOS.map((tono) => (
                      <div key={tono} className={styles.grupoTono}>
                        <span className={styles.etiquetaTono}>{tono}</span>
                        <div className={styles.tamanos}>
                          {TAMANOS.map((tamano) => (
                            <Icon key={tamano} name={entrada.nombre} tone={tono} size={tamano} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
