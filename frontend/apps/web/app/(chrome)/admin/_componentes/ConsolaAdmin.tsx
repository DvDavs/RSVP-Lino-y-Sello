"use client";

// app/(chrome)/admin/_componentes/ConsolaAdmin.tsx — el armazón de `/admin` (`12-producto-completo.md
// §B3.6`): cabecera + `Tabs` del sistema con las cinco pestañas (Resumen, Clientas, Invitaciones,
// Pagos, Plantillas) y la puerta de sesión.
//
// AUTORIZACIÓN (léelo dos veces, brief del encargo E5-D): la pantalla NO es la puerta — la niega el
// backend (`@PreAuthorize` en `/product/admin/**`); esto solo evita enseñar una consola vacía y muda
// a quien no puede usarla. `lib/admin/cliente.ts` clasifica cualquier 401/403 como `SessionError`
// (nunca como un vacío ni como un error de bloque disimulado). Cada panel delega ese caso aquí por
// `onSesionInvalida`, que separa las dos historias que un `SessionError` puede contar:
//   · 401 (`sin-token`): no hay sesión, o caducó — se manda a `/acceso?volver=/admin`, igual que
//     hace `AsistenteDeCreacion.tsx` con `/editor`.
//   · 403 (`sin-permiso`): SÍ hay sesión, pero el rol no alcanza (una clienta USER llegó aquí) — un
//     403 NO es «no hay clientas»: sustituye las pestañas enteras por un estado honesto
//     (`textosAdmin.sesion.sinPermiso`) con una salida real, nunca cinco tablas rotas ni un spinner
//     infinito. Basta que UN bloque lo reporte para que la pantalla entera cambie de estado — con el
//     mismo rol, los demás bloques van a fallar igual, así que no tiene sentido dejarlos "cargando".
//
// PESTAÑAS — las dos propiedades que hay que conservar A LA VEZ (5-E5-J, defecto 1):
//   (a) CADA BLOQUE CARGA POR SU CUENTA: los cinco paneles se montan desde el primer render y piden
//       su dato en paralelo, así que el resumen no espera a las tablas ni al revés, un 403 aparece
//       aunque nadie abra esa pestaña, y cambiar de pestaña NO vuelve a pedir nada ni pierde el
//       estado local (filtros, página) del panel que se deja atrás. Eso lo da `forceMount`.
//   (b) SOLO UNA PESTAÑA VISIBLE. Y esto `forceMount` NO lo da: Radix calcula
//       `present = forceMount || isSelected` y luego `hidden = !present`, de modo que con
//       `forceMount` la expresión es SIEMPRE `false` y NINGÚN panel recibe nunca `hidden` — las
//       cinco secciones se pintaban apiladas a la vez en los tres anchos (`bitacora/5-E5-I.md §1`).
// Por eso `Tabs` va CONTROLADO (`value`/`onValueChange`) y cada `TabsContent` recibe su propio
// `hidden` calculado aquí (`panel()`): Radix pone su `hidden` ANTES de esparcir el resto de props
// (`react-tabs/dist/index.mjs`: `hidden: !present, ...contentProps`), así que el nuestro gana.
// `hidden` a secas y no `opacity-0`/`visibility` ni una clase de Tailwind: el atributo `hidden` da
// `display:none` por hoja de agente de usuario, que es lo único que saca el panel del árbol de
// accesibilidad Y del orden de tabulación (el `tabIndex={0}` que Radix pone en todo `tabpanel`
// dejaría el panel oculto alcanzable con el tabulador con cualquier otra técnica). Además es un
// ATRIBUTO, no CSS: se puede afirmar en jsdom, donde no hay hojas de estilo — de ahí la compuerta
// «solo un tabpanel visible a la vez» de `ConsolaAdmin.test.tsx`.
//
// El chequeo de `getAuthToken()` al montar es SÍNCRONO (sin red): si no hay token, ni siquiera se
// dispara la primera petición de ningún panel — nunca hay una consola visible sin sesión, ni por un
// instante.
import { useCallback, useEffect, useState, type JSX } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { EmptyState } from "@invitaciones/ui/componentes/EmptyState.tsx";
import { Skeleton } from "@invitaciones/ui/componentes/Skeleton.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@invitaciones/ui/componentes/Tabs/index.ts";
import { clearAuthToken, getAuthToken } from "@/lib/api-client";
import { textosAdmin } from "@/lib/admin/textos";
import { PanelClientas } from "./PanelClientas.tsx";
import { PanelPlantillas } from "./PanelPlantillas.tsx";
import { PanelResumen } from "./PanelResumen.tsx";

// Presupuesto de peso (`ui-pantalla §8`, 150 KB gz de primera carga): `PanelInvitaciones` y
// `PanelPagos` son los dos únicos bloques que usan `Select` (Radix) — `PanelInvitaciones` además
// `Dialog`, vía `AccionDeFila`. Ese trío de primitivas (Select + Dialog + su `Popper`/
// `DismissableLayer`/`FocusScope` compartido) pesaba, importado de forma estática, ~110 KB gz por sí
// solo — con todo lo demás, la ruta pasaba de 300 KB. `next/dynamic` los saca del grafo de módulos
// de LA PÁGINA (ya no aparecen en `page_client-reference-manifest.js`) y los convierte en un chunk
// aparte que el navegador pide la primera vez que la persona abre esa pestaña — «Resumen» (la que
// se ve de entrada) y «Clientas»/«Plantillas» (sin Select ni Dialog) siguen siendo parte del primer
// paquete, sin esqueleto de más. Medido en `5-E5-D.md`.
const PanelInvitaciones = dynamic(() => import("./PanelInvitaciones.tsx").then((m) => m.PanelInvitaciones), {
  loading: () => <Skeleton variante="bloque" alto={280} etiqueta={textosAdmin.comun.cargando} />,
});
const PanelPagos = dynamic(() => import("./PanelPagos.tsx").then((m) => m.PanelPagos), {
  loading: () => <Skeleton variante="bloque" alto={280} etiqueta={textosAdmin.comun.cargando} />,
});

type EstadoSesion = "verificando" | "sin-token" | "sin-permiso" | "activa";

/** Las cinco pestañas de la consola, en el orden en que se pintan. */
type Pestana = "resumen" | "clientas" | "invitaciones" | "pagos" | "plantillas";

const PESTANA_INICIAL: Pestana = "resumen";

const DESTINO_ACCESO = `/acceso?volver=${encodeURIComponent("/admin")}`;

export function ConsolaAdmin(): JSX.Element {
  const router = useRouter();
  const [sesion, setSesion] = useState<EstadoSesion>("verificando");
  const [pestana, setPestana] = useState<Pestana>(PESTANA_INICIAL);

  /** Props de un `TabsContent`: montado siempre (`forceMount`), visible solo si es el activo. */
  const panel = (valor: Pestana): { forceMount: true; hidden: boolean } => ({
    forceMount: true,
    hidden: valor !== pestana,
  });

  useEffect(() => {
    if (getAuthToken() === null) {
      setSesion("sin-token");
      router.replace(DESTINO_ACCESO);
      return;
    }
    setSesion("activa");
  }, [router]);

  const manejarSesionInvalida = useCallback(
    (statusCode: 401 | 403) => {
      if (statusCode === 401) {
        setSesion("sin-token");
        router.replace(DESTINO_ACCESO);
        return;
      }
      setSesion("sin-permiso");
    },
    [router],
  );

  function cerrarSesion(): void {
    clearAuthToken();
    setSesion("sin-token");
    router.replace("/acceso");
  }

  return (
    <main className="mx-auto flex w-full max-w-ui-page flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-md text-ui-ink">{textosAdmin.pagina.titulo}</h1>
        {sesion === "activa" ? (
          <Button variant="terciario" size="sm" onClick={cerrarSesion}>
            {textosAdmin.pagina.cerrarSesion}
          </Button>
        ) : null}
      </header>

      {sesion === "verificando" || sesion === "sin-token" ? (
        <p role="status" aria-live="polite" className="text-md text-ui-ink-muted">
          {textosAdmin.comun.cargando}
        </p>
      ) : sesion === "sin-permiso" ? (
        <div role="alert">
          <EmptyState
            ilustracion="error-generico"
            titulo={textosAdmin.sesion.sinPermiso.titulo}
            texto={textosAdmin.sesion.sinPermiso.cuerpo}
            accion={{ etiqueta: textosAdmin.sesion.sinPermiso.accion, href: "/editor" }}
          />
        </div>
      ) : (
        <Tabs value={pestana} onValueChange={(valor) => setPestana(valor as Pestana)}>
          <TabsList aria-label={textosAdmin.pagina.titulo}>
            <TabsTrigger value="resumen">{textosAdmin.pestanas.resumen}</TabsTrigger>
            <TabsTrigger value="clientas">{textosAdmin.pestanas.clientas}</TabsTrigger>
            <TabsTrigger value="invitaciones">{textosAdmin.pestanas.invitaciones}</TabsTrigger>
            <TabsTrigger value="pagos">{textosAdmin.pestanas.pagos}</TabsTrigger>
            <TabsTrigger value="plantillas">{textosAdmin.pestanas.plantillas}</TabsTrigger>
          </TabsList>
          {/* `forceMount` + `hidden` PROPIO (`panel()`), las dos cosas a la vez. Ver el bloque
              «PESTAÑAS» de la cabecera: `forceMount` solo mantiene las cinco montadas y pidiendo su
              dato en paralelo; el `hidden` que Radix calcularía (`hidden = !(forceMount ||
              isSelected)`) queda anulado por el propio `forceMount`, así que lo ponemos nosotros a
              partir de la pestaña activa. `hidden` (no `opacity`, no `visibility`) es lo que saca de
              verdad el panel del árbol accesible y del orden de tabulación. */}
          <TabsContent value="resumen" {...panel("resumen")}>
            <PanelResumen onSesionInvalida={manejarSesionInvalida} />
          </TabsContent>
          <TabsContent value="clientas" {...panel("clientas")}>
            <PanelClientas onSesionInvalida={manejarSesionInvalida} />
          </TabsContent>
          <TabsContent value="invitaciones" {...panel("invitaciones")}>
            <PanelInvitaciones onSesionInvalida={manejarSesionInvalida} />
          </TabsContent>
          <TabsContent value="pagos" {...panel("pagos")}>
            <PanelPagos onSesionInvalida={manejarSesionInvalida} />
          </TabsContent>
          <TabsContent value="plantillas" {...panel("plantillas")}>
            <PanelPlantillas onSesionInvalida={manejarSesionInvalida} />
          </TabsContent>
        </Tabs>
      )}
    </main>
  );
}
