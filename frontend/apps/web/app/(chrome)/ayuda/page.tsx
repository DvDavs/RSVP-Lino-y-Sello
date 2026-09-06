// app/(chrome)/ayuda/page.tsx — la página a la que apunta «Ayuda» de la cabecera (U-1) y el botón
// «Dónde se cambia» del campo de fecha bloqueado (U-3, `04 §6.3` «[Editar allí]»).
//
// No es relleno: cada apartado responde una pregunta que la revisión de uso sin instrucciones
// registró como duda REAL de la clienta (`bitacora/3-ux.md`), y el de la fecha dice con todas las
// letras lo que hoy se puede y lo que no. Es un componente de servidor: no lleva ni un byte de JS.
import Link from "next/link";
import type { Metadata } from "next";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = { title: "Ayuda" };

/** Cada duda que la revisión de uso vio nacer, con su respuesta. `id` = ancla enlazable. */
const DUDAS: Array<{ id: string; pregunta: string; respuesta: React.ReactNode }> = [
  {
    id: "empezar",
    pregunta: "¿Cómo empiezo mi invitación?",
    respuesta: (
      <>
        <p>
          Tu invitación se crea cuando contratas un plan. En cuanto existe, aparece en{" "}
          <Link href="/editor" className="font-semibold text-ui-primary underline">
            Mis invitaciones
          </Link>
          . Ahí eliges la plantilla —el punto de partida del diseño— y ya puedes cambiar textos,
          fotos y colores.
        </p>
      </>
    ),
  },
  {
    id: "fecha",
    pregunta: "¿Dónde se cambia la fecha del evento?",
    respuesta: (
      <>
        <p>
          <strong>Hoy la fecha del evento no se puede cambiar desde el editor, ni desde tu cuenta.</strong>{" "}
          Es la fecha que quedó registrada al contratar la invitación, y por eso aparece con candado
          en la portada y en la sección de los novios: si se pudiera escribir en dos sitios, tu
          invitación acabaría diciendo dos fechas distintas.
        </p>
        <p className="mt-2">
          Para cambiarla, pídelo por el mismo medio por el que contrataste tu invitación. Quien
          gestiona tu cuenta la actualiza y el cambio se ve en tu invitación en cuanto vuelvas a
          abrirla; no tienes que rehacer nada de lo que ya escribiste.
        </p>
        <p className="mt-2">
          Las horas de cada momento del día —ceremonia, recepción, fiesta— sí las cambias tú, en la
          sección <strong>Itinerario</strong>. Si le pones una fecha distinta de la de la portada, te
          avisamos antes de publicar.
        </p>
      </>
    ),
  },
  {
    id: "publicar",
    pregunta: "¿Qué pasa cuando publico?",
    respuesta: (
      <p>
        Publicar hace visible tu invitación en su enlace público, el que compartes con tus invitados.
        Antes de publicar revisamos que no falte nada obligatorio. Puedes seguir editando después:
        los cambios no se ven hasta que vuelves a publicar. Si te arrepientes, «Despublicar» la
        retira de internet.
      </p>
    ),
  },
  {
    id: "quien-la-ve",
    pregunta: "¿Quién puede ver mi invitación?",
    respuesta: (
      <p>
        Solo quien tenga el enlace. No aparece en buscadores. Si crees que el enlace se compartió de
        más, «Generar un enlace nuevo» deja el anterior sin efecto — y a quien ya lo tenía dejará de
        abrirle, así que tendrás que volver a mandarlo.
      </p>
    ),
  },
  {
    id: "planes",
    pregunta: "Una plantilla dice que necesita otro plan",
    respuesta: (
      <p>
        Algunas plantillas están incluidas solo en los planes superiores. Puedes usar cualquiera de
        las que no lo indican; para las demás, pide el cambio de plan por el mismo medio por el que
        contrataste tu invitación.
      </p>
    ),
  },
];

export default function PaginaAyuda() {
  return (
    <>
      <header className="static flex min-h-24 items-center justify-between gap-4 bg-ui-bg px-6 py-4">
        <Link href="/editor" className="rounded-ui-control font-ui-display text-ui-title font-semibold text-ui-ink-heading">
          Invitaciones
        </Link>
      </header>
      <main className="mx-auto w-full max-w-(--ui-content-max) px-6 py-10">
        <h1 className="font-ui-display text-ui-section font-semibold text-ui-ink-heading">{es_MX.ayuda.titulo}</h1>
        <p className="mt-1 text-ui-body text-ui-ink-muted">{es_MX.ayuda.intro}</p>

        <div className="mt-8 flex max-w-prose flex-col gap-8">
          {DUDAS.map((duda) => (
            // `scroll-mt` deja la pregunta por debajo del borde superior cuando se llega por ancla.
            <section key={duda.id} id={duda.id} aria-labelledby={`${duda.id}-titulo`} className="scroll-mt-6">
              <h2 id={`${duda.id}-titulo`} className="text-ui-card font-semibold text-ui-ink-heading">
                {duda.pregunta}
              </h2>
              <div className="mt-2 text-ui-body text-ui-ink">{duda.respuesta}</div>
            </section>
          ))}
        </div>

        <p className="mt-10">
          <Link href="/editor" className="font-semibold text-ui-primary underline">
            ← {es_MX.ayuda.volverAlEditor}
          </Link>
        </p>
      </main>
    </>
  );
}
