"use client";

// app/(public)/r/[token]/PantallaInvitado.tsx — la ISLA (04 §15.6 / contrato §3): TODO el estado
// personal del invitado se resuelve AQUÍ, en el navegador, después de la hidratación. `page.tsx` no
// le pasa ni el nombre ni los cupos: solo el `token` de la URL. Es la única forma de que el HTML que
// sale del servidor no lleve ni un dato de este invitado (regla de seguridad 1 del encargo) — el
// primer render (antes de que corra ningún `useEffect`) es siempre el estado "cargando", sin nombre.
//
// Estados del wireframe (`diseno/12-producto-completo.md` §B3.1):
//   1. sin responder  → tarjeta de identidad + decisión (RadioGroup + contadores).
//   2. ya respondió   → resumen + "Cambiar mi respuesta" (funciona en los dos sentidos).
//   3. no resuelve    → UNA sola pantalla para los seis casos que el backend no distingue.
//   4. cerrado        → se dice ANTES de enseñar el formulario, nunca al fallar el envío.
//
// Nada en `console` con el token o datos del invitado, en ninguna rama (regla 5) — ni los `catch`
// registran el error crudo, que podría llevar el `code` con el `message` del backend pero nunca el
// nombre ni el token (que de todos modos ninguna respuesta del backend expone, contrato §2).
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ComposedDocument } from "@invitaciones/schema";
import { ApiError, type RsvpEstado, type RsvpGuest, enviarRsvp, obtenerRsvp } from "@/lib/invitados/rsvp";
import { RenderInvitacion } from "../../_componentes/RenderInvitacion";
import { Contador } from "./Contador";
import { obtenerRenderPublico } from "./renderPublico";
import { textosInvitado } from "./textos";
import estilos from "./pagina.module.css";

// DESVIACIÓN documentada del wireframe (§B3.1): la foto de portada con máscara "Seal" que encabeza
// el primer pliegue NO se repite aquí sobre la tarjeta de identidad. Sale de `composed`
// (`coverImage`/`coverBackground`), que solo se conoce tras resolver `event.publicToken` — pintarla
// arriba exigiría una segunda espera (o una petición duplicada) antes de la tarjeta que SÍ es
// imprescindible (nombre, cupos, decisión). La misma fotografía ya aparece, con máscara, dentro de
// la portada de `InvitacionCompleta` un poco más abajo. Ver el reporte de entrega para el detalle.
const ANCLA_DECISION = "r-tarjeta-decision";

type Fase = "cargando" | "no-resuelve" | "limite" | "error" | "listo";

interface FormularioRespuesta {
  readonly attending: boolean;
  readonly adults: number;
  readonly children: number;
  readonly young: number;
}

function formularioDesdeInvitado(guest: RsvpGuest): FormularioRespuesta {
  if (guest.status === "DECLINED") return { attending: false, adults: 0, children: 0, young: 0 };
  if (guest.status === "CONFIRMED") {
    return {
      attending: true,
      adults: guest.adultsConfirmed,
      children: guest.childrenConfirmed,
      young: guest.youngConfirmed,
    };
  }
  // PENDING: se ofrece el cupo completo como punto de partida; el invitado ajusta si hace falta.
  return { attending: true, adults: guest.adults, children: guest.children, young: guest.young };
}

function totalElegido(f: FormularioRespuesta): number {
  return f.adults + f.children + f.young;
}

function mensajeDeErrorEnvio(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "GUEST_QUOTA_EXCEEDED":
        return "No puedes confirmar más lugares de los que te asignamos. Ajusta los números e inténtalo otra vez.";
      case "GUEST_INVALID":
        return textosInvitado.decision.sinLugares;
      case "RSVP_TOO_MANY_ATTEMPTS":
        return `${textosInvitado.limite.titulo}. ${textosInvitado.limite.cuerpo}`;
      default:
        return "No pudimos guardar tu respuesta. Inténtalo de nuevo en un momento.";
    }
  }
  return "No pudimos guardar tu respuesta. Revisa tu conexión e inténtalo de nuevo.";
}

function comportamientoDesplazamiento(): ScrollBehavior {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "smooth";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function PantallaInvitado({ token }: { token: string }) {
  const [fase, setFase] = useState<Fase>("cargando");
  const [datos, setDatos] = useState<RsvpEstado | null>(null);
  const [cerradoDetectado, setCerradoDetectado] = useState(false);

  useEffect(() => {
    let vigente = true;
    obtenerRsvp(token)
      .then((resultado) => {
        if (!vigente) return;
        setDatos(resultado);
        setFase("listo");
      })
      .catch((error: unknown) => {
        if (!vigente) return;
        // Nunca un `console.*` con el `error` crudo aquí: podría llevar el `message` del backend
        // (que no repite el token, pero es disciplina de la regla 5 no arriesgarlo por rama).
        if (error instanceof ApiError && error.code === "RSVP_LINK_NOT_FOUND") {
          setFase("no-resuelve");
        } else if (error instanceof ApiError && error.code === "RSVP_TOO_MANY_ATTEMPTS") {
          setFase("limite");
        } else {
          setFase("error");
        }
      });
    return () => {
      vigente = false;
    };
  }, [token]);

  if (fase === "cargando") {
    return (
      <main className={estilos.aviso} role="status" aria-live="polite">
        <p className={estilos.avisoCuerpo}>{textosInvitado.cargando}</p>
      </main>
    );
  }

  if (fase === "no-resuelve") {
    return (
      <main className={estilos.aviso}>
        <div className={estilos.manchaFondo} aria-hidden="true" />
        <div className={estilos.avisoContenido}>
          <h1 className={estilos.avisoTitulo}>{textosInvitado.noResuelve.titulo}</h1>
          <hr className={estilos.filete} />
          <p className={estilos.avisoCuerpo}>{textosInvitado.noResuelve.cuerpo}</p>
        </div>
      </main>
    );
  }

  if (fase === "limite") {
    return (
      <main className={estilos.aviso} role="alert">
        <div className={estilos.manchaFondo} aria-hidden="true" />
        <div className={estilos.avisoContenido}>
          <h1 className={estilos.avisoTitulo}>{textosInvitado.limite.titulo}</h1>
          <hr className={estilos.filete} />
          <p className={estilos.avisoCuerpo}>{textosInvitado.limite.cuerpo}</p>
        </div>
      </main>
    );
  }

  if (fase === "error") {
    return (
      <main className={estilos.aviso} role="alert">
        <div className={estilos.avisoContenido}>
          <h1 className={estilos.avisoTitulo}>{textosInvitado.error.titulo}</h1>
          <hr className={estilos.filete} />
          <p className={estilos.avisoCuerpo}>{textosInvitado.error.cuerpo}</p>
        </div>
      </main>
    );
  }

  // fase === "listo"
  const estado = datos as RsvpEstado;
  return (
    <PantallaLista
      token={token}
      estadoInicial={estado}
      cerradoDetectado={cerradoDetectado}
      onCerradoDetectado={() => setCerradoDetectado(true)}
    />
  );
}

interface PantallaListaProps {
  readonly token: string;
  readonly estadoInicial: RsvpEstado;
  readonly cerradoDetectado: boolean;
  readonly onCerradoDetectado: () => void;
}

function PantallaLista({ token, estadoInicial, cerradoDetectado, onCerradoDetectado }: PantallaListaProps) {
  const [datos, setDatos] = useState(estadoInicial);
  const [enEdicion, setEnEdicion] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioRespuesta>(() => formularioDesdeInvitado(estadoInicial.guest));

  const { guest, event } = datos;
  const yaRespondio = guest.status !== "PENDING";
  const cerrado = event.closed || cerradoDetectado;
  const mostrarFormulario = !yaRespondio || enEdicion;

  function reiniciarFormulario(desde: RsvpGuest) {
    setFormulario(formularioDesdeInvitado(desde));
    setErrorEnvio(null);
  }

  function empezarEdicion() {
    reiniciarFormulario(guest);
    setEnEdicion(true);
  }

  function cambiarAsistencia(attending: boolean) {
    setErrorEnvio(null);
    setFormulario((actual) => {
      if (!attending) return { attending: false, adults: 0, children: 0, young: 0 };
      // Al volver a "Sí" desde un estado en ceros (p. ej. tras declinar), se ofrece de nuevo el
      // cupo completo en vez de dejar un formulario que no se puede enviar (P1: nunca un atasco
      // silencioso).
      if (totalElegido(actual) === 0) {
        return { attending: true, adults: guest.adults, children: guest.children, young: guest.young };
      }
      return { ...actual, attending: true };
    });
  }

  /** Envía `override` si se da (acciones directas de la barra fija, que no esperan a que el
   *  estado del radio termine de aplicarse) o el `formulario` actual en cualquier otro caso. */
  async function enviar(override?: FormularioRespuesta) {
    const cuerpo = override ?? formulario;
    setEnviando(true);
    setErrorEnvio(null);
    try {
      const payload = cuerpo.attending
        ? { attending: true as const, adults: cuerpo.adults, children: cuerpo.children, young: cuerpo.young }
        : { attending: false as const, adults: 0, children: 0, young: 0 };
      const actualizado = await enviarRsvp(token, payload);
      setDatos(actualizado);
      setFormulario(formularioDesdeInvitado(actualizado.guest));
      setEnEdicion(false);
    } catch (error) {
      if (error instanceof ApiError && error.code === "RSVP_CLOSED") {
        onCerradoDetectado();
      } else {
        setErrorEnvio(mensajeDeErrorEnvio(error));
      }
    } finally {
      setEnviando(false);
    }
  }

  const envioInvalido = formulario.attending && totalElegido(formulario) === 0;

  return (
    <div className={estilos.pantalla}>
      <div className={estilos.contenido}>
        <div className={estilos.columnaFija}>
          <section className={estilos.tarjeta} aria-label={textosInvitado.paraTi}>
            <p className={estilos.etiqueta}>{textosInvitado.paraTi}</p>
            <h1 className={estilos.nombre}>{guest.fullName}</h1>
            <p className={estilos.cuposTexto}>{textosInvitado.cupos(guest.adults, guest.children, guest.young)}</p>
          </section>

          <div id={ANCLA_DECISION}>
            {yaRespondio && !enEdicion ? (
              <ResumenRespuesta guest={guest} onCambiar={empezarEdicion} />
            ) : cerrado ? (
              <div className={estilos.cerrado} role="status">
                <p className={estilos.cerradoTitulo}>{textosInvitado.cerrado.titulo}</p>
                <p className={estilos.cerradoCuerpo}>{textosInvitado.cerrado.cuerpo}</p>
              </div>
            ) : (
              <TarjetaDecision
                event={event}
                guest={guest}
                formulario={formulario}
                onCambiarAsistencia={cambiarAsistencia}
                onCambiarContador={(campo, valor) => {
                  setErrorEnvio(null);
                  setFormulario((actual) => ({ ...actual, [campo]: valor }));
                }}
                onEnviar={enviar}
                enviando={enviando}
                envioInvalido={envioInvalido}
                errorEnvio={errorEnvio}
                mostrarCancelarEdicion={enEdicion}
                onCancelarEdicion={() => {
                  reiniciarFormulario(guest);
                  setEnEdicion(false);
                }}
              />
            )}
          </div>
        </div>

        <div className={estilos.columnaInvitacion}>
          <InvitacionCompleta publicToken={event.publicToken} />
        </div>
      </div>

      {mostrarFormulario && !cerrado ? (
        <BarraFija formulario={formulario} guest={guest} onEnviar={enviar} enviando={enviando} />
      ) : null}
    </div>
  );
}

// --------------------------------------------------------------------------------------------
// Resumen — "ya respondió" (estado 2 del wireframe). Funciona en los dos sentidos.
// --------------------------------------------------------------------------------------------
function ResumenRespuesta({ guest, onCambiar }: { guest: RsvpGuest; onCambiar: () => void }) {
  const confirmado = guest.status === "CONFIRMED";
  const textos = confirmado ? textosInvitado.confirmado : textosInvitado.declinado;
  return (
    <section className={`${estilos.tarjeta} ${estilos.tarjetaResumen}`} aria-live="polite">
      {confirmado ? (
        <span className={estilos.resumenIcono} aria-hidden="true">
          ✓
        </span>
      ) : null}
      <p className={estilos.resumenEncabezado}>{textos.encabezado}</p>
      <p className={estilos.resumenDetalle}>
        {confirmado
          ? textosInvitado.confirmado.detalle(guest.adultsConfirmed, guest.childrenConfirmed, guest.youngConfirmed)
          : textosInvitado.declinado.detalle}
      </p>
      {confirmado && guest.hasEmail ? <p className={estilos.resumenCorreo}>{textosInvitado.confirmado.correo}</p> : null}
      <button type="button" className={estilos.botonSecundario} onClick={onCambiar}>
        {textos.cambiar}
      </button>
    </section>
  );
}

// --------------------------------------------------------------------------------------------
// Decisión — RadioGroup del sistema (escrito a mano, ver `README` §"controles") + contadores.
// --------------------------------------------------------------------------------------------
interface TarjetaDecisionProps {
  readonly event: RsvpEstado["event"];
  readonly guest: RsvpGuest;
  readonly formulario: FormularioRespuesta;
  readonly onCambiarAsistencia: (attending: boolean) => void;
  readonly onCambiarContador: (campo: "adults" | "children" | "young", valor: number) => void;
  readonly onEnviar: () => void;
  readonly enviando: boolean;
  readonly envioInvalido: boolean;
  readonly errorEnvio: string | null;
  readonly mostrarCancelarEdicion: boolean;
  readonly onCancelarEdicion: () => void;
}

function TarjetaDecision({
  event,
  guest,
  formulario,
  onCambiarAsistencia,
  onCambiarContador,
  onEnviar,
  enviando,
  envioInvalido,
  errorEnvio,
  mostrarCancelarEdicion,
  onCancelarEdicion,
}: TarjetaDecisionProps) {
  const nombreGrupo = useId();
  const deshabilitado = enviando;

  return (
    <section className={estilos.tarjeta} aria-labelledby={`${nombreGrupo}-titulo`}>
      <h2 id={`${nombreGrupo}-titulo`} className={estilos.encabezadoDecision}>
        {textosInvitado.decision.encabezado}
      </h2>

      <div className={estilos.radioGrupo} role="radiogroup" aria-labelledby={`${nombreGrupo}-titulo`}>
        <OpcionRadio
          nombre={nombreGrupo}
          id={`${nombreGrupo}-si`}
          marcada={formulario.attending}
          etiqueta={textosInvitado.decision.siAsisto}
          onSeleccionar={() => onCambiarAsistencia(true)}
          deshabilitado={deshabilitado}
        />
        <OpcionRadio
          nombre={nombreGrupo}
          id={`${nombreGrupo}-no`}
          marcada={!formulario.attending}
          etiqueta={textosInvitado.decision.noPuedo}
          onSeleccionar={() => onCambiarAsistencia(false)}
          deshabilitado={deshabilitado}
        />
      </div>

      {formulario.attending ? (
        <div className={estilos.contadores}>
          <p className={estilos.contadoresEncabezado}>{textosInvitado.decision.cuantosVamos}</p>
          <Contador
            etiqueta={textosInvitado.decision.adultos}
            valor={formulario.adults}
            maximo={guest.adults}
            onCambiar={(v) => onCambiarContador("adults", v)}
            deshabilitado={deshabilitado}
          />
          {event.childrenAllowed && guest.children > 0 ? (
            <Contador
              etiqueta={textosInvitado.decision.ninos}
              valor={formulario.children}
              maximo={guest.children}
              onCambiar={(v) => onCambiarContador("children", v)}
              deshabilitado={deshabilitado}
            />
          ) : null}
          {event.youngAllowed && guest.young > 0 ? (
            <Contador
              etiqueta={textosInvitado.decision.jovenes}
              valor={formulario.young}
              maximo={guest.young}
              onCambiar={(v) => onCambiarContador("young", v)}
              deshabilitado={deshabilitado}
            />
          ) : null}
        </div>
      ) : null}

      {errorEnvio ? (
        <p className={estilos.errorEnvio} role="alert">
          {errorEnvio}
        </p>
      ) : null}

      <button
        type="button"
        className={estilos.botonPrimario}
        onClick={() => onEnviar()}
        disabled={enviando || envioInvalido}
      >
        {formulario.attending ? textosInvitado.decision.confirmar : textosInvitado.decision.declinar}
      </button>
      {envioInvalido ? <p className={estilos.ayudaTexto}>{textosInvitado.decision.sinLugares}</p> : null}
      <p className={estilos.ayudaTexto}>{textosInvitado.decision.ayuda}</p>

      {mostrarCancelarEdicion ? (
        <button type="button" className={estilos.botonSecundario} onClick={onCancelarEdicion} disabled={enviando}>
          {textosInvitado.decision.cancelar}
        </button>
      ) : null}
    </section>
  );
}

function OpcionRadio({
  nombre,
  id,
  marcada,
  etiqueta,
  onSeleccionar,
  deshabilitado,
}: {
  readonly nombre: string;
  readonly id: string;
  readonly marcada: boolean;
  readonly etiqueta: string;
  readonly onSeleccionar: () => void;
  readonly deshabilitado: boolean;
}) {
  return (
    <label className={estilos.radioOpcion} data-marcada={marcada ? "true" : "false"} htmlFor={id}>
      <input
        type="radio"
        id={id}
        name={nombre}
        className={estilos.radioEntrada}
        checked={marcada}
        onChange={onSeleccionar}
        disabled={deshabilitado}
      />
      <span className={estilos.radioIndicador} aria-hidden="true" />
      <span className={estilos.radioTexto}>{etiqueta}</span>
    </label>
  );
}

// --------------------------------------------------------------------------------------------
// Barra fija al pie (móvil, mientras no haya respuesta).
// --------------------------------------------------------------------------------------------
function BarraFija({
  formulario,
  guest,
  onEnviar,
  enviando,
}: {
  readonly formulario: FormularioRespuesta;
  readonly guest: RsvpGuest;
  readonly onEnviar: (override?: FormularioRespuesta) => void;
  readonly enviando: boolean;
}) {
  // Los dos botones ENVÍAN de inmediato (acción directa, no solo marcan el radio de arriba): es
  // la barra de "confirmar o declinar en un toque" del wireframe (§B3.1). "Sí" reutiliza la
  // selección ya hecha si es válida, o el cupo completo si el invitado aún no había elegido
  // cuántos van (mismo criterio que `cambiarAsistencia`, P1: nunca un toque que no hace nada).
  const paraConfirmar: FormularioRespuesta =
    formulario.attending && totalElegido(formulario) > 0
      ? formulario
      : { attending: true, adults: guest.adults, children: guest.children, young: guest.young };
  const paraDeclinar: FormularioRespuesta = { attending: false, adults: 0, children: 0, young: 0 };

  return (
    <div className={estilos.barraFija}>
      <p className={estilos.barraFijaEtiqueta}>{textosInvitado.barraFija.etiqueta}</p>
      <div className={estilos.barraFijaBotones}>
        <button
          type="button"
          className={estilos.barraFijaBoton}
          data-enfasis={!formulario.attending ? "true" : "false"}
          onClick={() => onEnviar(paraDeclinar)}
          disabled={enviando}
        >
          {textosInvitado.decision.noPuedo}
        </button>
        <button
          type="button"
          className={estilos.barraFijaBoton}
          data-enfasis={formulario.attending ? "true" : "false"}
          onClick={() => onEnviar(paraConfirmar)}
          disabled={enviando}
        >
          {textosInvitado.decision.siAsisto}
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------------------
// La invitación completa — el mismo render que `/i/[publicToken]`, resuelto EN EL NAVEGADOR
// (contrato §3): `publicToken` solo se conoce tras el `GET /public/r/{token}`, así que ni esta
// petición puede hacerse en el servidor sin arrastrar el estado del invitado con ella.
// --------------------------------------------------------------------------------------------
function InvitacionCompleta({ publicToken }: { publicToken: string }) {
  const [composed, setComposed] = useState<ComposedDocument | null>(null);
  const [fallo, setFallo] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [nodosPuente, setNodosPuente] = useState<readonly Element[]>([]);

  useEffect(() => {
    let vigente = true;
    obtenerRenderPublico(publicToken)
      .then((resultado) => {
        if (!vigente) return;
        if (resultado.status === "ok") setComposed(resultado.data.composed);
      })
      .catch(() => {
        if (vigente) setFallo(true);
      });
    return () => {
      vigente = false;
    };
  }, [publicToken]);

  useEffect(() => {
    if (!composed) return;
    const contenedor = contenedorRef.current;
    if (!contenedor) return;
    // Gancho DOM estable que `RsvpSection` deja para su propia isla (contrato §3,
    // `RsvpSection.tsx`): si la invitación trae una sección de RSVP, aquí se monta un puente real
    // (nunca el `<a href="#…">` inerte) de vuelta a la tarjeta de decisión — sin duplicar el
    // formulario completo, que ya vive arriba con su propio estado.
    setNodosPuente(Array.from(contenedor.querySelectorAll("[data-rsvp-mount]")));
  }, [composed]);

  if (fallo) {
    return <p className={estilos.invitacionCargando}>{textosInvitado.error.cuerpo}</p>;
  }

  if (!composed) {
    return (
      <p className={estilos.invitacionCargando} role="status" aria-live="polite">
        {textosInvitado.cargandoInvitacion}
      </p>
    );
  }

  return (
    <div ref={contenedorRef}>
      <RenderInvitacion composed={composed} />
      {nodosPuente.map((nodo) =>
        createPortal(
          <button
            type="button"
            className={estilos.puente}
            onClick={() =>
              document.getElementById(ANCLA_DECISION)?.scrollIntoView({ behavior: comportamientoDesplazamiento(), block: "start" })
            }
          >
            {textosInvitado.irAResponder}
          </button>,
          nodo,
          nodo.id || undefined,
        ),
      )}
    </div>
  );
}
