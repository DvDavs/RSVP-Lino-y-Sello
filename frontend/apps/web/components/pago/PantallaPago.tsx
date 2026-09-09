// components/pago/PantallaPago.tsx — `/pago` entera: la vuelta de Stripe Checkout (wireframe
// `12-producto-completo.md` §5), sustituyendo el marcador de la sesión E4.
//
// REGLA QUE NO SE ROMPE (`README.md` de esta carpeta, `handoffs/5-4-contrato-pagos.md` §0): el pago
// se da por bueno SOLO por el webhook del backend. Esta pantalla nunca decide "pagado" por sí
// misma — ni por `?sesion=` en la URL, ni por haber vuelto de Checkout. Siempre consulta
// `obtenerPlanDeInvitacion(inv)` y pinta lo que el backend contesta; sin invitación válida que
// consultar, o si la clienta canceló en Stripe, esto ES el vacío de la ruta (estado "cancelado").
//
// Client component completo, igual que `PantallaPrecios`: la única lectura de `?inv=`/`sesion=`/
// `cancelado=` es `useSearchParams`, y `page.tsx` se queda con los metadatos y el límite de
// `Suspense` que ese hook exige.
"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { ProgressRing } from "@invitaciones/ui/componentes/ProgressRing/index.ts";
import { Seal } from "@invitaciones/ui/shapes";
import { IconoExito } from "@invitaciones/icons";
import { correoDeSoporteDelEntorno } from "@/lib/env";
import { SessionError } from "@/lib/errors";
import { es_MX } from "@/lib/i18n";
import { obtenerPlanDeInvitacion } from "@/lib/pagos/cliente";
import { enlaceHttpsValido } from "@/lib/pagos/enlaces";
import { formatearImporte } from "@/lib/pagos/dinero";
import type { PlanDeInvitacion } from "@/lib/pagos/tipos";
import { CargaPago } from "./CargaPago.tsx";

/** Cada 3 s (wireframe §5), como mucho 20 veces: ~60 s de sondeo antes de decir que tarda. */
const INTERVALO_SONDEO_MS = 3000;
const SONDEOS_MAXIMOS = 20;

type Estado =
  | { readonly tipo: "cargando" }
  | { readonly tipo: "cancelado" }
  | { readonly tipo: "esperando"; readonly tardando: boolean }
  | { readonly tipo: "confirmado"; readonly plan: PlanDeInvitacion }
  | { readonly tipo: "sin-sesion" }
  | { readonly tipo: "error" };

/** `inv` solo cuenta si es un entero positivo (`§`: "Sin `inv` válido... → cancelado"). */
function idValido(crudo: string | null): number | null {
  if (crudo === null || !/^[1-9][0-9]*$/.test(crudo)) return null;
  return Number(crudo);
}

export function PantallaPago() {
  const parametros = useSearchParams();
  const invitationId = idValido(parametros.get("inv"));
  const sesion = parametros.get("sesion");
  const cancelado = parametros.get("cancelado") === "1";

  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const sondeosHechos = useRef(0);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const detenerSondeo = useCallback(() => {
    if (intervaloRef.current !== null) {
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }
  }, []);

  const consultar = useCallback(() => {
    if (invitationId === null) return;
    obtenerPlanDeInvitacion(invitationId)
      .then((plan) => {
        if (plan.pagada) {
          detenerSondeo();
          setEstado({ tipo: "confirmado", plan });
          return;
        }
        if (sesion === null) {
          // Sin sesión de Checkout que esperar y el backend dice que no está pagada: no hay nada
          // que sondear (§5, regla del wireframe).
          detenerSondeo();
          setEstado({ tipo: "cancelado" });
          return;
        }
        // Funcional a propósito: una respuesta que llega TARDE (pedida antes de agotar el minuto)
        // no puede devolver el bloque «está tardando» a su estado anterior.
        setEstado((anterior) =>
          anterior.tipo === "esperando" && anterior.tardando ? anterior : { tipo: "esperando", tardando: false },
        );
        // `sondeosHechos` NO se reinicia aquí (lo hacen el montaje y «volver a intentarlo»): si el
        // minuto ya se agotó, una respuesta rezagada no puede reabrir el sondeo por su cuenta.
        if (intervaloRef.current === null && sondeosHechos.current < SONDEOS_MAXIMOS) {
          intervaloRef.current = setInterval(() => {
            sondeosHechos.current += 1;
            if (sondeosHechos.current >= SONDEOS_MAXIMOS) {
              detenerSondeo();
              setEstado((anterior) => (anterior.tipo === "esperando" ? { tipo: "esperando", tardando: true } : anterior));
              return;
            }
            consultar();
          }, INTERVALO_SONDEO_MS);
        }
      })
      .catch((error: unknown) => {
        detenerSondeo();
        if (error instanceof SessionError) {
          setEstado({ tipo: "sin-sesion" });
          return;
        }
        setEstado({ tipo: "error" });
      });
    // `detenerSondeo` no va en las dependencias a propósito: es estable (`useCallback` sin deps).
  }, [invitationId, sesion]);

  useEffect(() => {
    if (invitationId === null || cancelado) {
      setEstado({ tipo: "cancelado" });
      return;
    }
    setEstado({ tipo: "cargando" });
    sondeosHechos.current = 0;
    consultar();
    return () => detenerSondeo();
  }, [invitationId, cancelado, consultar, detenerSondeo]);

  // El foco viaja al título CADA vez que la pantalla cambia de estado (no solo al confirmarse):
  // quien navega con teclado o lector de pantalla se entera de que la página ya dice otra cosa, y
  // el punto de partida vuelve a ser el encabezado, no el final del documento.
  useEffect(() => {
    if (estado.tipo !== "cargando") {
      tituloRef.current?.focus();
    }
  }, [estado.tipo]);

  const destinoReintentar = invitationId !== null ? `/editor/${invitationId}/plan` : "/editor";
  const destinoPlanes = invitationId !== null ? `/precios?inv=${invitationId}` : "/precios";

  if (estado.tipo === "cargando") return <CargaPago />;

  if (estado.tipo === "cancelado") {
    return (
      <Bloque testId="pago-cancelado">
        <h1 ref={tituloRef} tabIndex={-1} className="display-md text-ui-ink rounded-ui-control focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface">
          {es_MX.sitio.pago.cancelado.titulo}
        </h1>
        <p className="text-md max-w-[48ch] text-ui-ink-muted">{es_MX.sitio.pago.cancelado.cuerpo}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="primario" size="md" data-testid="pago-volver-a-intentar">
            <Link href={destinoReintentar}>{es_MX.sitio.pago.cancelado.volverAIntentar}</Link>
          </Button>
          <Button asChild variant="terciario" size="md">
            <Link href={destinoPlanes}>{es_MX.sitio.pago.cancelado.verPlanes}</Link>
          </Button>
        </div>
      </Bloque>
    );
  }

  if (estado.tipo === "sin-sesion") {
    // El valor de `sesion` viene de la URL: se codifica antes de meterlo en el `siguiente` para que
    // un `&` o un `#` dentro del identificador no parta la ruta de vuelta al decodificarla.
    const siguiente = `/pago?inv=${String(invitationId)}${sesion !== null ? `&sesion=${encodeURIComponent(sesion)}` : ""}`;
    return (
      <Bloque testId="pago-sin-sesion">
        <h1 ref={tituloRef} tabIndex={-1} className="display-md text-ui-ink rounded-ui-control focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface">
          {es_MX.sitio.pago.sinSesion.titulo}
        </h1>
        <p className="text-md max-w-[48ch] text-ui-ink-muted">{es_MX.sitio.pago.sinSesion.cuerpo}</p>
        <Button asChild variant="primario" size="md">
          <Link href={`/acceso?volver=${encodeURIComponent(siguiente)}`}>{es_MX.sitio.pago.sinSesion.entrar}</Link>
        </Button>
      </Bloque>
    );
  }

  if (estado.tipo === "error") {
    return (
      <Bloque testId="pago-error">
        <h1 ref={tituloRef} tabIndex={-1} className="display-md text-ui-ink rounded-ui-control focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface">
          {es_MX.sitio.pago.error.titulo}
        </h1>
        <p className="text-md max-w-[48ch] text-ui-ink-muted">{es_MX.sitio.pago.error.cuerpo}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="primario"
            size="md"
            data-testid="pago-reintentar"
            onClick={() => {
              setEstado({ tipo: "cargando" });
              consultar();
            }}
          >
            {es_MX.comun.reintentar}
          </Button>
        </div>
        <BloqueSoporte />
      </Bloque>
    );
  }

  if (estado.tipo === "esperando") {
    return (
      <Bloque testId="pago-esperando">
        <ProgressRing indeterminate label={es_MX.sitio.pago.esperando.progreso} size={96} />
        <h1 ref={tituloRef} tabIndex={-1} className="display-md text-ui-ink rounded-ui-control focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface">
          {es_MX.sitio.pago.esperando.titulo}
        </h1>
        {/* El sondeo cambia lo que dice esta zona sin que nadie toque nada: `role="status"` +
            `aria-live="polite"` es lo que hace que un lector de pantalla se entere de que la espera
            se alargó, en vez de dejar la página muda. Fuera del `h1`, que no cambia. */}
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
          <p className="text-md max-w-[48ch] text-ui-ink-muted">{es_MX.sitio.pago.esperando.cuerpo}</p>
          {estado.tardando ? (
            <div data-testid="pago-tardando" className="flex flex-col items-center gap-3 rounded-ui-card bg-ui-surface-alt p-6">
              <p className="heading-sm text-ui-ink">{es_MX.sitio.pago.tardando.titulo}</p>
              <p className="text-sm max-w-[48ch] text-ui-ink-muted">{es_MX.sitio.pago.tardando.cuerpo}</p>
              <BloqueSoporte />
              <div className="flex flex-wrap items-center justify-center gap-3">
                {/* Sin esto la espera agotada es un callejón: el sondeo se detuvo y la única salida
                    era abandonar la página. Vuelve a preguntar al backend (y reabre el sondeo). */}
                <Button
                  type="button"
                  variant="primario"
                  size="sm"
                  data-testid="pago-comprobar-de-nuevo"
                  onClick={() => {
                    sondeosHechos.current = 0;
                    setEstado({ tipo: "esperando", tardando: false });
                    consultar();
                  }}
                >
                  {es_MX.comun.reintentar}
                </Button>
                {invitationId !== null ? (
                  <Button asChild variant="secundario" size="sm" data-testid="pago-ver-plan">
                    <Link href={`/editor/${invitationId}/plan`}>{es_MX.sitio.pago.confirmado.verPlan}</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </Bloque>
    );
  }

  // estado.tipo === "confirmado"
  const { plan } = estado;
  const pagoReciente = plan.pagos[0] ?? null;
  const comprobante = enlaceHttpsValido(pagoReciente?.comprobanteUrl);
  const subtitulo =
    plan.plan === null
      ? es_MX.sitio.pago.confirmado.sinPlan
      : plan.nombreEvento !== null
        ? es_MX.sitio.pago.confirmado.conEvento(plan.plan.nombre, plan.nombreEvento)
        : es_MX.sitio.pago.confirmado.sinEvento(plan.plan.nombre);

  return (
    <Bloque testId="pago-confirmado">
      <div className="relative grid h-24 w-24 place-items-center">
        <Seal points={12} amplitude={4} tone="support-1-soft" className="absolute inset-0 h-24 w-24" />
        <IconoExito size={40} tone="mono" className="relative text-ui-support-1-deep" />
      </div>
      <h1 ref={tituloRef} tabIndex={-1} className="display-lg text-ui-ink rounded-ui-control focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface">
        {es_MX.sitio.pago.confirmado.titulo}
      </h1>
      <p className="text-md max-w-[48ch] text-ui-ink-muted">{subtitulo}</p>
      {pagoReciente !== null ? (
        <p className="label-md text-ui-ink-muted">{formatearImporte(pagoReciente.importeCentavos, pagoReciente.moneda)}</p>
      ) : null}
      {comprobante !== null ? (
        <p className="text-sm max-w-[48ch] text-ui-ink-muted">
          {es_MX.sitio.pago.confirmado.comprobante}{" "}
          <a href={comprobante} target="_blank" rel="noopener noreferrer" className="font-semibold text-ui-link hover:underline">
            {es_MX.sitio.pago.confirmado.verComprobante}
          </a>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="primario" size="md" data-testid="pago-ir-invitacion">
          <Link href={`/editor/${String(plan.invitationId)}`}>{es_MX.sitio.pago.confirmado.irInvitacion}</Link>
        </Button>
        <Button asChild variant="secundario" size="md" data-testid="pago-ver-plan">
          <Link href={`/editor/${String(plan.invitationId)}/plan`}>{es_MX.sitio.pago.confirmado.verPlan}</Link>
        </Button>
      </div>
    </Bloque>
  );
}

function Bloque({ testId, children }: { readonly testId: string; readonly children: ReactNode }) {
  return (
    <div
      data-testid={testId}
      className="mx-auto flex w-full max-w-ui-page flex-col items-center gap-4 px-5 py-20 text-center sm:px-8"
    >
      {children}
    </div>
  );
}

/** Correo de soporte si el entorno lo tiene; si no, un enlace honesto a `/ayuda` (nunca un botón muerto). */
function BloqueSoporte() {
  const correo = correoDeSoporteDelEntorno();
  if (correo !== null) {
    return (
      <p className="text-sm text-ui-ink-muted">
        {es_MX.sitio.pago.soporte.conCorreo}{" "}
        <a
          href={`mailto:${correo}?subject=${encodeURIComponent(es_MX.sitio.pago.soporte.asunto)}`}
          className="font-semibold text-ui-link hover:underline"
        >
          {correo}
        </a>
      </p>
    );
  }
  return (
    <p className="text-sm text-ui-ink-muted">
      {es_MX.sitio.pago.soporte.sinCorreo}{" "}
      <Link href="/ayuda" className="font-semibold text-ui-link hover:underline">
        {es_MX.sitio.pago.soporte.irAyuda}
      </Link>
    </p>
  );
}
