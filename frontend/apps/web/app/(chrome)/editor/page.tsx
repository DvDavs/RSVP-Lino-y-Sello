"use client";

// app/(chrome)/editor/page.tsx — catálogo de plantillas (04 §6.1) Y puerta de entrada del cliente.
//
// ─── Qué cambió en el bloque 3-8 y por qué ────────────────────────────────────────────────────
// U-2. El botón «Elegir esta plantilla» de esta página era un `<button type="submit">` **fuera de
// todo formulario y sin manejador**: cero peticiones, cero mensajes, en las dos tarjetas. El
// segundo verbo del criterio de terminado («elegir una plantilla») era literalmente imposible para
// quien entra por aquí, que es por donde entra una persona. Había DOS superficies para elegir
// plantilla y esta, la que se ve primero, estaba muerta; la viva es la de
// `/editor/[invitationId]` cuando el documento no existe todavía (por eso el e2e E-01 estaba en
// verde mientras el producto estaba roto).
//
// U-1. La cabecera tenía «Ayuda» y «Mi cuenta» como `href="#"`, y el aviso de sesión no ofrecía
// ninguna salida. Ahora la cabecera es `EncabezadoSitio` (controles reales) y el aviso lleva un
// botón «Iniciar sesión» que va a `/acceso`.
//
// ─── La decisión de producto, y es conservadora ───────────────────────────────────────────────
// En el producto real **una invitación nace de una compra**: `templates2` no crea invitaciones
// (ADR-2-4-02) y ninguna de las 19 rutas de `03-api.md` lo hace. Así que «elegir plantilla» no
// puede significar «crear una invitación»: significa «aplicar esta plantilla a una invitación que
// ya tengo». Por eso esta página empieza por **Mis invitaciones** (`GET /user/invitations/all`) y
// resuelve los tres casos:
//   · ninguna invitación → se explica que nace de la compra; NO se pinta un botón que no puede
//     funcionar (era justo el defecto que se está corrigiendo).
//   · una → las tarjetas actúan sobre ella, sin preguntar nada.
//   · varias → un `<select>` etiquetado arriba elige a cuál; las tarjetas actúan sobre la elegida.
// Una invitación que YA tiene plantilla no se puede recambiar desde aquí: eso es `04 §7.3`
// (confirmación explícita + `attic`) y vive en su propio editor. Aquí se ofrece «Seguir editando».
// Registrado en `preguntas-abiertas.md` § P-3-8-1/P-3-8-2.
import { CalendarDays, PartyPopper, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EncabezadoSitio } from "@/components/editor/EncabezadoSitio";
import { Button, estilosBoton } from "@/components/ui/button";
import {
  ApiError,
  SessionError,
  chooseTemplate,
  getCatalog,
  getDocument,
  listarInvitaciones,
  type InvitacionDelCliente,
} from "@/lib/api-client";
import type { CatalogItem, CatalogResponse } from "@/lib/api-types";
import { es_MX } from "@/lib/i18n";
// Lector PURO del `ComposedDocument` (no pinta nada, no arrastra chrome). La frontera de
// `04 §19.3` prohíbe que `(public)` alcance el chrome, no al revés; duplicar la búsqueda por rol
// aquí sería la duplicación que P1 prohíbe.
import { tituloDe } from "../../(public)/_componentes/composed-lectura";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "listo"; datos: CatalogResponse }
  | { tipo: "sesion" }
  | { tipo: "error"; mensaje: string; codigo?: string };

/** Estado de cada invitación del cliente: ¿ya tiene plantilla o está por empezar? */
type EstadoInvitacion = "sin-plantilla" | "con-plantilla" | "sin-acceso";
interface FilaInvitacion extends InvitacionDelCliente {
  estado: EstadoInvitacion;
  /**
   * El nombre HUMANO de la invitación («Mariana & Rodrigo»), leído del documento ya empezado.
   * `04 §6.2` pedía exactamente esto («Boda de Ana y Luis») y la implementación enseñaba
   * `boda-clasica · versión 194` (D-6). Con cinco invitaciones «Boda · 18 de abril de 2027»
   * idénticas, sin este nombre la clienta no puede distinguir la suya.
   */
  nombre: string | null;
}

const ETIQUETA_EVENTO: Record<string, string> = {
  wedding: "Boda",
  quince: "XV años",
  baptism: "Bautizo",
  communion: "Primera comunión",
  confirmation: "Confirmación",
  birthday: "Cumpleaños",
  graduation: "Graduación",
  generic: "Evento",
};

/** Como máximo se consultan 12 documentos para etiquetar la lista: es una pantalla, no un barrido. */
const MAX_INVITACIONES_CONSULTADAS = 12;

/**
 * Onda decorativa del borde inferior de la imagen (arte-chrome.md §5.1: "se pinta como <image>
 * dentro de un <svg> con clipPath: el borde inferior es una onda decorativa, no una recta"). Curva
 * propia (el documento describe el efecto, no publica las coordenadas exactas del trazo original) en
 * espacio `objectBoundingBox` para que escale con cualquier tamaño de tarjeta.
 */
function OndaClipPath({ id }: { id: string }) {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        <clipPath id={id} clipPathUnits="objectBoundingBox">
          <path d="M0,0 H1 V0.90 C0.83,0.99 0.63,1.0 0.47,0.93 C0.31,0.86 0.14,0.87 0,0.95 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}

interface AccionTarjeta {
  /** `null` ⇒ no hay ninguna invitación a la que aplicarle la plantilla: no se pinta botón. */
  invitationId: number | null;
  ocupada: string | null;
  alElegir: (item: CatalogItem) => void;
}

function TarjetaPlantilla({ item, accion }: { item: CatalogItem; accion: AccionTarjeta }) {
  const clipId = `onda-${item.slug}`;
  const estaOcupada = accion.ocupada === item.slug;
  const otraOcupada = accion.ocupada !== null && !estaOcupada;
  return (
    // Sin `hover:scale`/`transform` en la tarjeta (corrección 3, arte-chrome.md §5: "transition:
    // all 0s ease… es decisión, no olvido: la rejilla no salta"). Solo el título transiciona con el
    // hover del `article` (`group`); el CTA ya transiciona por su propio hover (Button).
    <li className="group flex h-full flex-col overflow-hidden rounded-ui-card bg-ui-surface shadow-ui-1">
      <OndaClipPath id={clipId} />
      <div className="relative aspect-[3/4] w-full bg-ui-bg-alt" style={{ clipPath: `url(#${clipId})` }}>
        <Image
          src={item.previewUrl}
          // U-13 (media, de propina): con `alt=""` una vista previa que no carga deja SOLO el icono
          // de imagen rota — y esta es la pantalla que se llama «Elige una plantilla». Con el nombre
          // dentro, el hueco al menos dice de qué plantilla es.
          alt={`Vista previa de ${item.name["es-MX"]}`}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <h3 className="text-ui-card font-bold leading-[var(--text-ui-card--line-height)] text-ui-ink-heading transition-colors duration-[var(--ui-duration)] ease-[var(--ui-ease)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden group-hover:text-ui-primary-hover">
          {item.name["es-MX"]}
        </h3>
        <ul className="flex flex-col gap-2">
          {/* Metadatos SIEMPRE en este orden: tipo de evento → plan mínimo requerido (corrección 2:
              mapeo de "ciudad → categoría → precio" de la referencia; aquí no hay precio, no se
              inventa uno). */}
          <li className="flex min-w-0 items-center gap-2 text-ui-aux text-ui-ink">
            <PartyPopper className="size-4 shrink-0 text-ui-primary-hover" aria-hidden="true" />
            <span className="truncate">{item.eventKinds.map((k) => ETIQUETA_EVENTO[k] ?? k).join(", ")}</span>
          </li>
          <li className="flex min-w-0 items-center gap-2 text-ui-aux text-ui-ink">
            <Sparkles className="size-4 shrink-0 text-ui-primary-hover" aria-hidden="true" />
            <span className="truncate">
              {item.minPlanTier > 1 ? `Requiere el plan ${item.minPlanTier} o superior` : "Incluida en todos los planes"}
            </span>
          </li>
        </ul>
        {accion.invitationId === null ? null : (
          <Button
            className="mt-auto w-full"
            busy={estaOcupada}
            // `04 §7.1` paso 2, literal: «botón en estado `aria-busy`, **resto de tarjetas inertes**».
            disabled={otraOcupada}
            data-testid={`catalogo-elegir-${item.slug}`}
            onClick={() => accion.alElegir(item)}
          >
            {estaOcupada ? es_MX.editor.catalogo.eligiendo : es_MX.editor.catalogo.elegir}
          </Button>
        )}
      </div>
    </li>
  );
}

/** Fecha `YYYY-MM-DD` de negocio → texto es-MX; si viene vacía o rara, se devuelve tal cual. */
function fechaLegible(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!partes) return iso ?? "";
  const fecha = new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
  return fecha.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function CatalogoPlantillas() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [invitaciones, setInvitaciones] = useState<FilaInvitacion[] | null>(null);
  const [errorInvitaciones, setErrorInvitaciones] = useState<string | null>(null);
  const [elegida, setElegida] = useState<number | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [errorEleccion, setErrorEleccion] = useState<string | null>(null);

  const cargarCatalogo = useCallback(() => {
    setEstado({ tipo: "cargando" });
    getCatalog()
      .then((datos) => setEstado({ tipo: "listo", datos }))
      .catch((err: unknown) => {
        if (err instanceof SessionError) setEstado({ tipo: "sesion" });
        else if (err instanceof ApiError) setEstado({ tipo: "error", mensaje: err.message, codigo: err.code });
        else setEstado({ tipo: "error", mensaje: err instanceof Error ? err.message : String(err) });
      });
  }, []);

  useEffect(() => {
    cargarCatalogo();
  }, [cargarCatalogo]);

  // Mis invitaciones + su estado real (¿ya tiene plantilla?). Sin esto, la página no sabe a QUÉ
  // invitación aplicar la plantilla y el botón vuelve a ser el botón muerto de U-2.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const lista = await listarInvitaciones();
        const recortada = lista.slice(0, MAX_INVITACIONES_CONSULTADAS);
        const filas = await Promise.all(
          recortada.map(async (inv): Promise<FilaInvitacion> => {
            try {
              const doc = await getDocument(inv.id);
              return { ...inv, estado: "con-plantilla", nombre: doc.composed ? tituloDe(doc.composed) : null };
            } catch (e: unknown) {
              if (e instanceof ApiError && e.code === "TPL_DOCUMENT_NOT_STARTED") return { ...inv, estado: "sin-plantilla", nombre: null };
              if (e instanceof ApiError && (e.code === "TPL_FORBIDDEN" || e.code === "TPL_NOT_MIGRATED")) {
                return { ...inv, estado: "sin-acceso", nombre: null };
              }
              // Cualquier otro fallo: se trata como «ya empezada» y la clienta entra a su editor,
              // que sabe explicar lo que pase. Nunca se le ofrece un botón que puede no funcionar.
              return { ...inv, estado: "con-plantilla", nombre: null };
            }
          }),
        );
        if (cancelado) return;
        setInvitaciones(filas);
        const primeraSinPlantilla = filas.find((f) => f.estado === "sin-plantilla");
        setElegida(primeraSinPlantilla?.id ?? null);
      } catch (e: unknown) {
        if (cancelado) return;
        if (e instanceof SessionError) {
          setInvitaciones([]);
          return; // el catálogo ya pinta el aviso de sesión con su botón
        }
        setInvitaciones([]);
        setErrorInvitaciones(e instanceof Error ? e.message : es_MX.editor.catalogo.errorInvitaciones);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  /** U-2: el flujo REAL de `04 §7.1` paso 2, con sus tres errores nombrados. */
  function elegirPlantilla(item: CatalogItem): void {
    if (elegida === null) return;
    setOcupada(item.slug);
    setErrorEleccion(null);
    void chooseTemplate(elegida, { templateSlug: item.slug, templateVersion: item.version })
      .then(() => {
        router.push(`/editor/${elegida}`);
      })
      .catch((e: unknown) => {
        const codigo = e instanceof ApiError ? e.code : undefined;
        if (codigo === "TPL_PLAN_TIER_INSUFFICIENT") {
          setErrorEleccion(`«${item.name["es-MX"]}» es de un plan superior al de tu invitación. Puedes elegir otra o pedir el cambio de plan.`);
        } else if (codigo === "TPL_TEMPLATE_VERSION_NOT_FOUND") {
          setErrorEleccion("Esta plantilla ya no está disponible. Actualizamos la lista.");
          cargarCatalogo(); // §7.1 p.2: «se recarga el catálogo»
        } else if (codigo === "TPL_MIGRATION_PLAN_MISSING") {
          setErrorEleccion("No podemos cambiar a esta versión ahora mismo. Avísanos y lo revisamos.");
        } else if (e instanceof SessionError) {
          setEstado({ tipo: "sesion" });
        } else if (e instanceof TypeError) {
          setErrorEleccion(es_MX.errores.sinRed);
        } else {
          setErrorEleccion(e instanceof Error ? e.message : es_MX.errores.generico);
        }
        setOcupada(null);
      });
  }

  if (estado.tipo === "cargando") {
    return (
      <p role="status" aria-live="polite" className="text-ui-ink-muted">
        {es_MX.comun.cargando}
      </p>
    );
  }

  // U-1: el aviso deja de ser un callejón sin salida. Botón real hacia la pantalla de acceso.
  if (estado.tipo === "sesion") {
    return (
      <div role="alert" className="flex max-w-prose flex-col items-start gap-3 rounded-ui-card bg-ui-surface p-6 shadow-ui-1">
        <p className="text-ui-body text-ui-ink">{es_MX.acceso.hayQueEntrar}</p>
        <Link href="/acceso?volver=%2Feditor" className={estilosBoton()}>
          {es_MX.comun.iniciarSesion}
        </Link>
      </div>
    );
  }

  if (estado.tipo === "error") {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-ui-control border border-ui-border bg-ui-surface p-4 text-ui-ink">
        <p>{estado.mensaje}</p>
        {estado.codigo ? <p className="text-ui-ink-muted">{es_MX.errores.codigo(estado.codigo)}</p> : null}
        <Button variant="secondary" onClick={cargarCatalogo}>
          {es_MX.comun.reintentar}
        </Button>
      </div>
    );
  }

  const { items } = estado.datos;
  const conPlantilla = (invitaciones ?? []).filter((i) => i.estado === "con-plantilla");
  const sinPlantilla = (invitaciones ?? []).filter((i) => i.estado === "sin-plantilla");
  const hayInvitaciones = (invitaciones ?? []).length > 0;

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="mis-invitaciones" className="flex flex-col gap-3">
        <h2 id="mis-invitaciones" className="text-ui-card font-semibold text-ui-ink-heading">
          {es_MX.editor.catalogo.misInvitaciones}
        </h2>

        {invitaciones === null ? (
          <p role="status" className="text-ui-ink-muted">
            {es_MX.comun.cargando}
          </p>
        ) : errorInvitaciones ? (
          <p role="alert" className="text-ui-aux text-ui-danger">
            {es_MX.editor.catalogo.errorInvitaciones} {errorInvitaciones}
          </p>
        ) : !hayInvitaciones ? (
          <p className="max-w-prose text-ui-body text-ui-ink-muted">{es_MX.editor.catalogo.sinInvitaciones}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(invitaciones ?? []).map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-ui-control border border-ui-border bg-ui-surface p-3.5"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-ui-body font-semibold text-ui-ink-heading">
                    {inv.nombre ?? (inv.estado === "sin-plantilla" ? `${inv.event} · sin plantilla todavía` : inv.event)}
                  </span>
                  <span className="flex items-center gap-1.5 text-ui-aux text-ui-ink-muted">
                    <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                    {inv.date ? es_MX.editor.catalogo.fechaDeLaInvitacion(fechaLegible(inv.date)) : "Sin fecha registrada"}
                    <span className="text-ui-ink-muted">· nº {inv.id}</span>
                  </span>
                </span>
                {inv.estado === "sin-acceso" ? (
                  <span className="text-ui-aux text-ui-ink-muted">No disponible</span>
                ) : (
                  <Link href={`/editor/${inv.id}`} className={estilosBoton({ variant: "secondary", size: "sm" })}>
                    {inv.estado === "con-plantilla" ? es_MX.editor.catalogo.seguirEditando : es_MX.editor.catalogo.empezar}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Con VARIAS invitaciones por empezar hay que decir a cuál se le aplica la plantilla, o el
            botón volvería a ser ambiguo. Un `<select>` etiquetado: sin diálogo, sin menú, accesible. */}
        {sinPlantilla.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="invitacion-destino" className="text-ui-aux font-semibold text-ui-ink">
              {es_MX.editor.catalogo.paraCual}
            </label>
            <select
              id="invitacion-destino"
              className="h-11 rounded-ui-control border border-ui-border-field bg-white px-3 text-ui-body text-ui-ink"
              value={elegida ?? ""}
              onChange={(e) => setElegida(Number(e.target.value))}
            >
              {sinPlantilla.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.event}
                  {inv.date ? ` · ${fechaLegible(inv.date)}` : ""} · nº {inv.id}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {hayInvitaciones && sinPlantilla.length === 0 ? (
          <p className="max-w-prose text-ui-aux text-ui-ink-muted">
            {conPlantilla.length === 1
              ? "Tu invitación ya tiene plantilla. Ábrela para seguir editándola; el diseño se cambia desde dentro."
              : "Todas tus invitaciones ya tienen plantilla. Ábrelas para seguir editándolas."}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="plantillas-disponibles" className="flex flex-col gap-4">
        <h2 id="plantillas-disponibles" className="text-ui-card font-semibold text-ui-ink-heading">
          Plantillas disponibles
        </h2>
        {errorEleccion ? (
          <p role="alert" className="max-w-prose rounded-ui-control bg-red-50 p-3 text-ui-aux text-ui-danger">
            {errorEleccion}
          </p>
        ) : null}
        {items.length === 0 ? (
          <p className="text-ui-ink-muted">{es_MX.editor.catalogo.vacio}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <TarjetaPlantilla
                key={`${item.slug}@${item.version}`}
                item={item}
                accion={{ invitationId: elegida, ocupada, alElegir: elegirPlantilla }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function PaginaCatalogo() {
  return (
    <>
      <EncabezadoSitio volverA="/editor" />
      <main className="mx-auto max-w-(--ui-content-max) px-6 py-10">
        <div className="mb-8">
          <h1 className="font-ui-display text-ui-section font-semibold text-ui-ink-heading">{es_MX.editor.catalogo.titulo}</h1>
          <p className="mt-1 text-ui-ink-muted">Elige el punto de partida para tu invitación.</p>
        </div>
        <CatalogoPlantillas />
      </main>
    </>
  );
}
