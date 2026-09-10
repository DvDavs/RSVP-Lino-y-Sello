"use client";

// app/(chrome)/admin/_componentes/PanelResumen.tsx — la pestaña «Resumen» (`12-producto-completo.md
// §B3.6`): las cinco cifras de `GET /product/admin/metricas` sobre `FilaDeMetricas`. Pide su propio
// dato, con su propio ciclo de carga/error — nunca espera a ninguna otra pestaña ni bloquea la
// pantalla (regla del encargo: «el resumen no espera a las tablas ni al revés»).
//
// Un `SessionError` (401/403) NO se pinta aquí como un error de bloque: se delega a
// `onSesionInvalida`, que decide en `ConsolaAdmin` si hay que mandar a `/acceso` (401) o enseñar el
// estado de «sin permiso» de página entera (403) — un 403 no es «no hay clientas», es una historia
// distinta (regla dura del encargo).
import { useCallback, useEffect, useState, type JSX } from "react";
import { obtenerMetricas } from "@/lib/admin/cliente";
import { textosAdmin } from "@/lib/admin/textos";
import { SessionError } from "@/lib/errors";
import { FilaDeMetricas, type MetricaDeResumen } from "./FilaDeMetricas.tsx";

export interface PanelResumenProps {
  readonly onSesionInvalida: (statusCode: 401 | 403) => void;
}

type EstadoResumen = "cargando" | "error" | "listo";

export function PanelResumen({ onSesionInvalida }: PanelResumenProps): JSX.Element {
  const [estado, setEstado] = useState<EstadoResumen>("cargando");
  const [clientas, setClientas] = useState<number | null>(null);
  const [invitaciones, setInvitaciones] = useState<number | null>(null);
  const [publicadas, setPublicadas] = useState<number | null>(null);
  const [pagadas, setPagadas] = useState<number | null>(null);
  const [rsvp, setRsvp] = useState<number | null>(null);

  const cargar = useCallback(() => {
    let cancelado = false;
    setEstado("cargando");
    obtenerMetricas()
      .then((datos) => {
        if (cancelado) return;
        setClientas(datos.clientas);
        setInvitaciones(datos.invitaciones);
        setPublicadas(datos.publicadas);
        setPagadas(datos.pagadas);
        setRsvp(datos.rsvpUltimos7Dias);
        setEstado("listo");
      })
      .catch((error: unknown) => {
        if (cancelado) return;
        if (error instanceof SessionError) {
          onSesionInvalida(error.statusCode);
          return;
        }
        setEstado("error");
      });
    return () => {
      cancelado = true;
    };
  }, [onSesionInvalida]);

  useEffect(() => cargar(), [cargar]);

  const t = textosAdmin.resumen;
  const metricas: MetricaDeResumen[] = [
    { etiqueta: t.tarjetas.clientas, valor: clientas ?? 0 },
    { etiqueta: t.tarjetas.invitaciones, valor: invitaciones ?? 0 },
    { etiqueta: t.tarjetas.publicadas, valor: publicadas ?? 0 },
    { etiqueta: t.tarjetas.pagadas, valor: pagadas ?? 0 },
    { etiqueta: t.tarjetas.rsvpUltimos7Dias, valor: rsvp ?? 0 },
  ];

  return (
    <section aria-labelledby="admin-resumen-titulo" className="flex flex-col gap-4">
      <h2 id="admin-resumen-titulo" className="display-sm text-ui-ink">
        {t.titulo}
      </h2>
      <FilaDeMetricas
        metricas={metricas}
        estado={estado}
        etiquetaCargando={textosAdmin.comun.cargando}
        error={{
          titulo: t.error.titulo,
          cuerpo: t.error.cuerpo,
          etiquetaReintentar: t.error.accion,
          onReintentar: cargar,
        }}
      />
    </section>
  );
}
