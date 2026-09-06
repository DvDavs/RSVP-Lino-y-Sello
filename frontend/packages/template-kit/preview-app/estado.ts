// preview-app/estado.ts — el cliente del previsualizador: pide el estado y se entera de los cambios.
//
// La recarga al guardar NO usa el HMR de Vite: los tres `.json` del paquete viven fuera de la raíz
// del servidor, así que no son módulos que Vite pueda invalidar. El servidor los vigila, recompone
// en Node y empuja un evento por `text/event-stream`; aquí se vuelve a pedir el estado y React
// repinta. Sin `location.reload()`: no se pierde ni el desplazamiento ni el ancho elegido.
import { useEffect, useState } from "react";
import type { ComposedDocument } from "@invitaciones/schema";

export interface Hallazgo {
  readonly severidad: "ERROR" | "AVISO" | "CORREGIDO";
  readonly codigo: string;
  readonly puntero: string;
  readonly problema: string;
  readonly sugerencia: string;
}

export interface EstadoPreview {
  readonly ok: boolean;
  readonly dir: string;
  readonly slug?: string;
  readonly version?: string;
  readonly diagnostico: string;
  readonly hallazgos: readonly Hallazgo[];
  readonly composed?: ComposedDocument;
  readonly fuentes: readonly { readonly family: string; readonly weights: readonly number[]; readonly rol: string }[];
  readonly notas: readonly string[];
  readonly paletas: readonly { readonly id: string; readonly nombre: string }[];
  readonly conjuntosDeFuentes: readonly { readonly id: string; readonly nombre: string }[];
  readonly version_estado: number;
}

function url(paleta: string | null, fuentes: string | null): string {
  const p = new URLSearchParams();
  if (paleta !== null) p.set("paleta", paleta);
  if (fuentes !== null) p.set("fuentes", fuentes);
  const cola = p.toString();
  return cola === "" ? "/__preview/estado.json" : `/__preview/estado.json?${cola}`;
}

/** El estado del paquete, siempre al día: se repide cada vez que el servidor avisa de un cambio. */
export function useEstado(paleta: string | null = null, fuentes: string | null = null): EstadoPreview | null {
  const [estado, setEstado] = useState<EstadoPreview | null>(null);

  useEffect(() => {
    let vivo = true;
    const pedir = (): void => {
      void fetch(url(paleta, fuentes), { cache: "no-store" })
        .then(r => r.json() as Promise<EstadoPreview>)
        .then(e => { if (vivo) setEstado(e); })
        .catch(() => { /* el servidor se está reiniciando; el próximo evento lo arregla */ });
    };
    pedir();
    const flujo = new EventSource("/__preview/eventos");
    flujo.addEventListener("cambio", pedir);
    return () => { vivo = false; flujo.close(); };
  }, [paleta, fuentes]);

  return estado;
}
