// components/plan/PantallaPlan.tsx — `/editor/[invitationId]/plan` entera (fase 5, sesión E4):
// carga autenticada de `obtenerPlanDeInvitacion` + `obtenerCatalogo` en paralelo (el token vive en
// `sessionStorage`, P8, así que esta carga es de cliente — mismo criterio que
// `app/(chrome)/editor/[invitationId]/page.tsx`), y los tres estados del wireframe
// (`12-producto-completo.md` §3): sin pago (la OFERTA, es el estado vacío), con pago, historial.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { Skeleton } from "@invitaciones/ui/componentes/Skeleton.tsx";
import { IconoAtras } from "@invitaciones/icons";
import { clearAuthToken, getAuthToken } from "@/lib/api-client";
import { correoDeSoporteDelEntorno } from "@/lib/env";
import { es_MX } from "@/lib/i18n";
import { obtenerCatalogo, obtenerPlanDeInvitacion } from "@/lib/pagos/cliente";
import { SessionError } from "@/lib/errors";
import type { PlanDeInvitacion } from "@/lib/pagos/tipos";
import { BarraDelPanel } from "./BarraDelPanel.tsx";
import { HistorialDePagos } from "./HistorialDePagos.tsx";
import { OfertaDePlan, type EstadoCatalogo } from "./OfertaDePlan.tsx";
import { PlanPagado } from "./PlanPagado.tsx";

type EstadoPagina =
  | { readonly tipo: "sin-sesion"; readonly caducada: boolean }
  | { readonly tipo: "cargando" }
  | { readonly tipo: "error" }
  | { readonly tipo: "listo"; readonly plan: PlanDeInvitacion };

export interface PropsPantallaPlan {
  /** Ya validado con `/^\d+$/` por `layout.tsx` de `/editor/[invitationId]`. */
  readonly invitationId: string;
}

export function PantallaPlan({ invitationId }: PropsPantallaPlan) {
  const idNumerico = Number(invitationId);
  const parametros = useSearchParams();
  const [estado, setEstado] = useState<EstadoPagina>({ tipo: "cargando" });
  const [catalogoEstado, setCatalogoEstado] = useState<EstadoCatalogo>({ tipo: "cargando" });

  const marcarSinSesion = useCallback(() => {
    // Solo es «caducada» si de verdad había token (mismo criterio que
    // `lib/api-client.ts#marcarSesionCaducada`, que este módulo de pagos no puede tocar — vive en
    // otro fichero, P8 — así que la distinción se repite aquí sobre el mismo dato público).
    const caducada = getAuthToken() !== null;
    if (caducada) clearAuthToken();
    setEstado({ tipo: "sin-sesion", caducada });
  }, []);

  const cargar = useCallback(() => {
    if (!Number.isFinite(idNumerico) || idNumerico <= 0) return;
    setEstado({ tipo: "cargando" });
    setCatalogoEstado({ tipo: "cargando" });
    obtenerPlanDeInvitacion(idNumerico)
      .then((plan) => setEstado({ tipo: "listo", plan }))
      .catch((e: unknown) => {
        if (e instanceof SessionError) {
          marcarSinSesion();
          return;
        }
        setEstado({ tipo: "error" });
      });
    obtenerCatalogo()
      .then((catalogo) => setCatalogoEstado({ tipo: "listo", catalogo }))
      .catch(() => setCatalogoEstado({ tipo: "error" }));
  }, [idNumerico, marcarSinSesion]);

  const recargarCatalogo = useCallback(() => {
    setCatalogoEstado({ tipo: "cargando" });
    obtenerCatalogo()
      .then((catalogo) => setCatalogoEstado({ tipo: "listo", catalogo }))
      .catch(() => setCatalogoEstado({ tipo: "error" }));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (estado.tipo === "sin-sesion") {
    const volver = encodeURIComponent(`/editor/${invitationId}/plan`);
    return (
      <div role="alert" className="m-8 flex max-w-prose flex-col items-start gap-3 rounded-ui-card bg-ui-surface-raised p-6 shadow-ui-1">
        <p className="text-md text-ui-ink">
          {estado.caducada ? es_MX.panel.plan.sinSesion.sesionTerminada : es_MX.panel.plan.sinSesion.hayQueEntrar}
        </p>
        <Button asChild data-testid="plan-ir-a-acceso">
          <Link href={`/acceso?volver=${volver}${estado.caducada ? "&motivo=sesion" : ""}`}>{es_MX.comun.iniciarSesion}</Link>
        </Button>
      </div>
    );
  }

  if (estado.tipo === "cargando") {
    return (
      <div className="mx-auto w-full max-w-ui-page px-4 py-10 sm:px-8" data-testid="plan-cargando">
        <Skeleton variante="bloque" alto={260} etiqueta={es_MX.panel.plan.cargando} className="rounded-ui-card" />
        <div className="mt-6">
          <Skeleton variante="texto" lineas={2} etiqueta={es_MX.panel.plan.cargando} />
        </div>
      </div>
    );
  }

  if (estado.tipo === "error") {
    const correo = correoDeSoporteDelEntorno();
    return (
      <div role="alert" data-testid="plan-error" className="m-8 flex max-w-prose flex-col items-start gap-3 rounded-ui-card bg-ui-surface-raised p-6 shadow-ui-1">
        <p className="text-md text-ui-ink">{es_MX.panel.plan.error.titulo}</p>
        <p className="text-sm text-ui-ink-muted">{es_MX.panel.plan.error.cuerpo}</p>
        {correo ? (
          <p className="text-sm text-ui-ink-muted">{es_MX.panel.plan.error.escribenos(correo)}</p>
        ) : (
          <Link href="/ayuda" className="text-sm font-semibold text-ui-link hover:underline">
            {es_MX.panel.plan.error.verAyuda}
          </Link>
        )}
        <Button data-testid="plan-reintentar" onClick={cargar}>
          {es_MX.comun.reintentar}
        </Button>
      </div>
    );
  }

  const plan = estado.plan;

  return (
    <div className="pb-16">
      <header className="border-b border-ui-divider bg-ui-surface px-4 py-5 sm:px-8">
        <div className="mx-auto flex max-w-ui-page flex-col gap-3">
          <Link href={`/editor/${invitationId}`} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-ui-link hover:underline">
            <IconoAtras size={16} tone="mono" />
            {es_MX.panel.marcador.volverAlEditor}
          </Link>
          <h1 className="display-sm text-ui-ink">{plan.nombreEvento ?? es_MX.panel.plan.invitacionSinNombre}</h1>
          <BarraDelPanel invitationId={invitationId} actual="plan" />
        </div>
      </header>

      <main className="mx-auto flex max-w-ui-page flex-col gap-10 px-4 py-8 sm:px-8">
        {plan.pagada ? (
          <PlanPagado invitationId={idNumerico} plan={plan} />
        ) : (
          <OfertaDePlan
            invitationId={idNumerico}
            planQuery={parametros.get("plan")}
            catalogoEstado={catalogoEstado}
            onRecargarCatalogo={recargarCatalogo}
            onPagoYaHecho={cargar}
            onSesionCaducada={marcarSinSesion}
          />
        )}

        <HistorialDePagos pagos={plan.pagos} />
      </main>
    </div>
  );
}
