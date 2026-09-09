// components/plan/OfertaDePlan.tsx — estado «sin pago» de `/editor/[invitationId]/plan`: es el
// ESTADO VACÍO de la pantalla y es la oferta (wireframe `12-producto-completo.md` §3, ADR-5-0B-01):
// editar y previsualizar son gratis, y esta es la salida honesta hacia publicar. Ningún precio se
// calcula aquí — sale siempre del catálogo (`obtenerCatalogo()`, formateado con `lib/pagos/dinero`).
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@invitaciones/ui/componentes/Badge/index.ts";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { RadioGroup } from "@invitaciones/ui/componentes/RadioGroup/index.ts";
import { Skeleton } from "@invitaciones/ui/componentes/Skeleton.tsx";
import { Composition, Triangle } from "@invitaciones/ui/shapes";
import { ContactoParaContratar } from "@/components/sitio/ContactoParaContratar";
import { pagoEnLineaDisponible } from "@/lib/env";
import { es_MX } from "@/lib/i18n";
import { crearCheckout } from "@/lib/pagos/cliente";
import { formatearImporte } from "@/lib/pagos/dinero";
import { ErrorDePago } from "@/lib/pagos/tipos";
import type { CatalogoDePlanes, Plan } from "@/lib/pagos/tipos";
import { SessionError } from "@/lib/errors";

export type EstadoCatalogo =
  | { readonly tipo: "cargando" }
  | { readonly tipo: "error" }
  | { readonly tipo: "listo"; readonly catalogo: CatalogoDePlanes };

type EstadoPago = { readonly tipo: "idle" | "abriendo" } | { readonly tipo: "error"; readonly mensaje: string };

export interface PropsOfertaDePlan {
  readonly invitationId: number;
  /** `?plan=<codigo>` de la URL: preselecciona esa opción si existe de verdad en el catálogo. */
  readonly planQuery: string | null;
  readonly catalogoEstado: EstadoCatalogo;
  readonly onRecargarCatalogo: () => void;
  /** `PAY_ALREADY_PAID`: el backend ya la tiene por pagada — se recarga el plan entero. */
  readonly onPagoYaHecho: () => void;
  readonly onSesionCaducada: () => void;
}

function ordenados(planes: readonly Plan[]): readonly Plan[] {
  return [...planes].sort((a, b) => a.orden - b.orden);
}

export function OfertaDePlan({ invitationId, planQuery, catalogoEstado, onRecargarCatalogo, onPagoYaHecho, onSesionCaducada }: PropsOfertaDePlan) {
  const t = es_MX.panel.plan.oferta;
  const catalogo = catalogoEstado.tipo === "listo" ? catalogoEstado.catalogo : null;
  const planes = catalogo ? ordenados(catalogo.planes) : [];

  const [seleccion, setSeleccion] = useState<string | null>(null);
  // `PAY_NOT_CONFIGURED` reactivo (el catálogo decía que sí, el checkout dice que no): se pinta
  // igual que si `catalogo.pagoEnLinea` hubiera sido `false` desde el principio (G-01, nunca un
  // botón muerto), sin esperar a que la clienta recargue la página.
  const [forzarSinLinea, setForzarSinLinea] = useState(false);
  const [estadoPago, setEstadoPago] = useState<EstadoPago>({ tipo: "idle" });

  useEffect(() => {
    if (planes.length === 0 || seleccion !== null) return;
    const deQuery = planQuery !== null && planes.some((p) => p.codigo === planQuery) ? planQuery : null;
    setSeleccion(deQuery ?? planes.find((p) => p.recomendado)?.codigo ?? planes[0]!.codigo);
    // Solo al llegar el catálogo (o cambiar de invitación): una vez elegida, la clienta manda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogo]);

  const pagoDisponible = !forzarSinLinea && catalogo?.pagoEnLinea === true && pagoEnLineaDisponible();

  async function pagar(): Promise<void> {
    if (!seleccion) return;
    setEstadoPago({ tipo: "abriendo" });
    try {
      const { checkoutUrl } = await crearCheckout(invitationId, seleccion);
      window.location.assign(checkoutUrl);
      // No se restablece `estadoPago`: la pestaña está a punto de navegar a Stripe.
    } catch (e: unknown) {
      if (e instanceof SessionError) {
        onSesionCaducada();
        return;
      }
      if (e instanceof ErrorDePago) {
        if (e.code === "PAY_NOT_CONFIGURED") {
          setForzarSinLinea(true);
          setEstadoPago({ tipo: "idle" });
          return;
        }
        if (e.code === "PAY_ALREADY_PAID") {
          onPagoYaHecho();
          return;
        }
        if (e.code === "PAY_PLAN_NOT_FOUND") {
          setEstadoPago({ tipo: "error", mensaje: es_MX.panel.plan.errores.planNoEncontrado });
          onRecargarCatalogo();
          return;
        }
        setEstadoPago({ tipo: "error", mensaje: e.message || es_MX.panel.plan.errores.generico });
        return;
      }
      setEstadoPago({ tipo: "error", mensaje: es_MX.panel.plan.errores.generico });
    }
  }

  return (
    <section data-testid="plan-sin-pago" aria-labelledby="plan-sin-pago-titulo">
      <Composition
        className="rounded-ui-card border border-ui-divider bg-ui-surface-raised p-6 sm:p-8"
        contentClassName="relative"
        shape={<Triangle tone="accent" rotate={-8} />}
        place="arriba-derecha"
        size="130px"
      >
        <h2 id="plan-sin-pago-titulo" className="heading-lg text-ui-ink">
          {t.titulo}
        </h2>
        <p className="text-md mt-2 max-w-[60ch] text-ui-ink-muted">{t.texto}</p>

        <div className="mt-6">
          {catalogoEstado.tipo === "cargando" ? (
            <Skeleton variante="bloque" alto={220} etiqueta={es_MX.comun.cargando} className="rounded-ui-card" />
          ) : null}

          {catalogoEstado.tipo === "error" ? (
            <div className="rounded-ui-control bg-ui-warning-soft p-4 text-sm text-ui-on-warning-soft">
              <p>{t.catalogoError}</p>
              <Button variant="terciario" size="sm" className="mt-2" onClick={onRecargarCatalogo} data-testid="plan-reintentar-catalogo">
                {es_MX.comun.reintentar}
              </Button>
            </div>
          ) : null}

          {planes.length > 0 ? (
            <>
              <h3 className="label-md text-ui-ink-muted">{t.opciones}</h3>
              <RadioGroup
                className="mt-3"
                aria-label={t.opciones}
                value={seleccion ?? undefined}
                onValueChange={setSeleccion}
                opciones={planes.map((plan) => ({
                  value: plan.codigo,
                  label: (
                    <div data-testid={`plan-opcion-${plan.codigo}`} className="flex flex-1 flex-col gap-1 py-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-md font-semibold text-ui-ink">{plan.nombre}</span>
                        {plan.recomendado ? <Badge tone="accent">{es_MX.sitio.precios.recomendado}</Badge> : null}
                      </span>
                      <span className="flex flex-wrap items-baseline gap-2">
                        <span className="display-sm text-ui-ink">{formatearImporte(plan.precioCentavos, plan.moneda)}</span>
                        <span className="label-md text-ui-ink-muted">{es_MX.sitio.precios.pagoUnico}</span>
                      </span>
                      {plan.incluye.length > 0 ? <span className="text-sm text-ui-ink-muted">{plan.incluye.join(" · ")}</span> : null}
                    </div>
                  ),
                }))}
              />

              {estadoPago.tipo === "error" ? (
                <p role="alert" className="mt-4 text-sm font-semibold text-ui-danger-text">
                  {estadoPago.mensaje}
                </p>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {pagoDisponible ? (
                  <Button
                    type="button"
                    size="lg"
                    data-testid="plan-pagar"
                    loading={estadoPago.tipo === "abriendo"}
                    loadingText={t.abriendoPago}
                    disabled={!seleccion}
                    onClick={() => void pagar()}
                  >
                    {t.pagarYPublicar}
                  </Button>
                ) : null}
                <Button asChild variant="terciario" size="lg" data-testid="plan-ver-planes">
                  <Link href={`/precios?inv=${invitationId}`}>{t.verTodosLosPlanes}</Link>
                </Button>
              </div>

              {!pagoDisponible ? (
                <div data-testid="plan-sin-pago-en-linea" className="mt-5 border-t border-ui-divider pt-5">
                  <p className="text-sm text-ui-ink-muted">{t.sinPagoEnLinea}</p>
                  <ContactoParaContratar className="mt-3" />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </Composition>
    </section>
  );
}
