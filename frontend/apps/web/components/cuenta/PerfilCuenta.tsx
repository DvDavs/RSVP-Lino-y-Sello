// components/cuenta/PerfilCuenta.tsx — la pantalla `/perfil` entera (fase 5, E3). Construye el
// wireframe de `docs/rediseno-plantillas/diseno/12-producto-completo.md` § «7 · /perfil»: cuatro
// bloques (datos, contraseña, sesiones, estado del correo) más «Tu información».
//
// Contrato: `docs/rediseno-plantillas/memoria/handoffs/5-E3-A2-contrato-cuenta.md`. Puntos que
// esta pantalla tiene que respetar sin excepción:
//  - El correo NO se edita en «Tus datos» (§1: `PUT /user/profile` lo ignora si se manda). El
//    cambio de correo vive en su propio diálogo, con contraseña, y no aplica nada hasta que se
//    confirma el enlace que manda `POST /user/account/email` — el texto lo dice ANTES de pedir el
//    cambio, no después.
//  - La verificación de correo NO bloquea nada hoy (§5.1): solo se enseña el estado y un reenvío.
//  - Cambiar la contraseña cierra TODAS las sesiones (§2/§5.3): se avisa ANTES del botón, y al
//    terminar se manda a `/acceso` (mismo `motivo=sesion` que ya usa `AsistenteAcceso`).
//  - `POST /user/account/logout` no invalida el `accessToken` (sigue vivo hasta que caduca, §2):
//    por eso `logoutAccount()` ya lo borra del cliente (`lib/api-client.ts`); aquí solo hace falta
//    navegar a `/acceso` después.
//  - Errores SIEMPRE junto al campo, nunca un banner genérico arriba (wireframe, fila «ERROR»).
//
// «Pedir que borren mi cuenta» (wireframe): no hay ruta para eso (`ADR-5-E3-B2-01`, ver la bitácora
// y `decisiones.md`). Se resuelve con el correo de soporte de `lib/env.ts` en vez de pintar un
// botón muerto (regla G-01) — `correoSoporte` llega ya resuelto desde el Server Component
// (`app/(chrome)/perfil/page.tsx`) porque `lib/env.ts` lee `process.env` por índice de cadena, y
// ese acceso no lo sustituye Next en el bundle de cliente.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Avatar } from "@invitaciones/ui/componentes/Avatar/index.ts";
import { Badge } from "@invitaciones/ui/componentes/Badge/index.ts";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { Dialog } from "@invitaciones/ui/componentes/Dialog/index.ts";
import { Field } from "@invitaciones/ui/componentes/Field/index.ts";
import { Input } from "@invitaciones/ui/componentes/Input/index.ts";
import { Skeleton } from "@invitaciones/ui/componentes/Skeleton.tsx";
import { codigoCuentaDeError, mensajeCuentaDeError } from "@/components/sitio/traducir-errores";
import { EncabezadoSitio } from "@/components/editor/EncabezadoSitio";
import {
  authResendVerification,
  changePassword,
  getAuthToken,
  getProfile,
  logoutAccount,
  requestEmailChange,
  updateProfile,
  SessionError,
} from "@/lib/api-client";
import type { Profile } from "@/lib/api-types";
import { es_MX } from "@/lib/i18n";

const DESTINO_ACCESO = `/acceso?volver=${encodeURIComponent("/perfil")}`;
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PropsPerfilCuenta {
  readonly correoSoporte: string | null;
}

type EstadoCarga = "cargando" | "listo" | "error";

export function PerfilCuenta({ correoSoporte }: PropsPerfilCuenta) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoCarga>("cargando");
  const [perfil, setPerfil] = useState<Profile | null>(null);

  const cargar = useCallback(() => {
    if (getAuthToken() === null) {
      router.replace(DESTINO_ACCESO);
      return;
    }
    setEstado("cargando");
    getProfile()
      .then((datos) => {
        setPerfil(datos);
        setEstado("listo");
      })
      .catch((error: unknown) => {
        if (error instanceof SessionError) {
          router.replace(DESTINO_ACCESO);
          return;
        }
        setEstado("error");
      });
  }, [router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <>
      <EncabezadoSitio volverA="/perfil" />
      <main className="mx-auto w-full max-w-ui-page px-5 py-12 sm:px-8">
        <h1 className="display-md text-ui-ink">{es_MX.perfil.titulo}</h1>

        {estado === "error" ? (
          <div className="mt-8 rounded-ui-card bg-ui-danger-soft p-5">
            <p role="alert" className="text-md text-ui-on-danger-soft">
              {es_MX.perfil.errores.cargando}
            </p>
            <Button variant="secundario" size="sm" className="mt-3" onClick={cargar}>
              {es_MX.comun.reintentar}
            </Button>
          </div>
        ) : null}

        {estado === "cargando" ? (
          <div className="mt-8 flex flex-col gap-10" aria-hidden={false}>
            <Skeleton variante="bloque" alto={72} etiqueta={es_MX.comun.cargando} />
            <Skeleton variante="texto" lineas={3} />
            <Skeleton variante="texto" lineas={3} />
          </div>
        ) : null}

        {estado === "listo" && perfil ? (
          <div className="mt-8 flex flex-col gap-10">
            <CabeceraCuenta perfil={perfil} />
            <BloqueDatos perfil={perfil} onGuardado={(actualizado) => setPerfil(actualizado)} />
            <BloqueCambiarCorreo perfil={perfil} />
            <BloqueContrasena />
            <BloqueSesiones />
            <BloqueTuInformacion correoSoporte={correoSoporte} />
          </div>
        ) : null}
      </main>
    </>
  );
}

// ── Cabecera: avatar + nombre + estado del correo ────────────────────────────────────────────────

function CabeceraCuenta({ perfil }: { readonly perfil: Profile }) {
  const [reenviando, setReenviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);

  async function reenviar(): Promise<void> {
    setReenviando(true);
    try {
      await authResendVerification({ email: perfil.email });
    } catch {
      // Respuesta genérica siempre (contrato §2): incluso una falla de red no cambia el mensaje
      // que se enseña — no hay nada que distinguir sin convertir esto en un enumerador.
    } finally {
      setReenviando(false);
      setReenviado(true);
    }
  }

  return (
    <section aria-labelledby="cabecera-cuenta-titulo" className="rounded-ui-card bg-ui-primary-soft p-6">
      <h2 id="cabecera-cuenta-titulo" className="sr-only">
        {es_MX.perfil.titulo}
      </h2>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar nombre={`${perfil.name} ${perfil.lastName}`} src={perfil.photo} size="md" />
        <div className="flex flex-col gap-1">
          <p className="heading-lg text-ui-on-primary-soft">
            {perfil.name} {perfil.lastName}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ui-on-primary-soft">{perfil.email}</span>
            {perfil.emailVerified ? null : (
              <>
                <Badge tone="warning">{es_MX.perfil.correoSinVerificar}</Badge>
                {reenviado ? (
                  <span className="text-sm text-ui-on-primary-soft">{es_MX.perfil.verificacionReenviada}</span>
                ) : (
                  <Button variant="terciario" size="sm" loading={reenviando} loadingText={es_MX.perfil.reenviando} onClick={() => void reenviar()}>
                    {es_MX.perfil.reenviarVerificacion}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Tus datos: nombre, apellidos, teléfono. El correo se ve pero no se edita aquí ───────────────

function BloqueDatos({
  perfil,
  onGuardado,
}: {
  readonly perfil: Profile;
  readonly onGuardado: (actualizado: Profile) => void;
}) {
  const [nombre, setNombre] = useState(perfil.name);
  const [apellidos, setApellidos] = useState(perfil.lastName);
  const [telefono, setTelefono] = useState(perfil.phone ?? "");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errores, setErrores] = useState<{ nombre?: string; apellidos?: string; telefono?: string }>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  async function guardar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setGuardado(false);
    setErrorGeneral(null);
    const nuevosErrores: typeof errores = {};
    if (nombre.trim().length === 0) nuevosErrores.nombre = es_MX.perfil.datos.faltaNombre;
    if (apellidos.trim().length === 0) nuevosErrores.apellidos = es_MX.perfil.datos.faltaApellidos;
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }
    setErrores({});
    setGuardando(true);
    try {
      const telefonoLimpio = telefono.trim();
      // Los campos que esta pantalla no enseña (fecha de nacimiento, dirección…) se reenvían TAL
      // CUAL llegaron: `PUT /user/profile` reemplaza el recurso entero, y omitirlos lo borraría.
      const actualizado = await updateProfile({
        name: nombre.trim(),
        lastName: apellidos.trim(),
        phone: telefonoLimpio.length > 0 ? telefonoLimpio : undefined,
        birthdate: perfil.birthdate,
        address: perfil.address,
        city: perfil.city,
        postalCode: perfil.postalCode,
        state: perfil.state,
      });
      onGuardado(actualizado);
      setGuardado(true);
    } catch (error: unknown) {
      const code = codigoCuentaDeError(error);
      if (code === "CUENTA_DEMASIADOS_INTENTOS") setErrorGeneral(es_MX.perfil.errores.demasiadosIntentos);
      else setErrorGeneral(es_MX.perfil.errores.generico);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section aria-labelledby="datos-titulo" className="flex flex-col gap-4">
      <h2 id="datos-titulo" className="heading-md text-ui-ink">
        {es_MX.perfil.datos.titulo}
      </h2>
      <form className="flex flex-col gap-4" onSubmit={(e) => void guardar(e)} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={es_MX.perfil.datos.nombre} error={errores.nombre}>
            <Input name="name" autoComplete="given-name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Field>
          <Field label={es_MX.perfil.datos.apellidos} error={errores.apellidos}>
            <Input
              name="lastName"
              autoComplete="family-name"
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
            />
          </Field>
        </div>
        <Field label={es_MX.perfil.datos.telefono} hint={es_MX.acceso.registro.ayudaTelefono} error={errores.telefono}>
          <Input name="tel" type="tel" autoComplete="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </Field>
        <Field label={es_MX.perfil.datos.correo} hint={es_MX.perfil.datos.correoNota}>
          <Input name="email" type="email" value={perfil.email} disabled readOnly />
        </Field>
        {errorGeneral ? (
          <p role="alert" className="text-sm font-semibold text-ui-danger-text">
            {errorGeneral}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={guardando} loadingText={es_MX.perfil.datos.guardando}>
            {es_MX.perfil.datos.guardar}
          </Button>
          {guardado ? <span className="text-sm text-ui-ink-muted">{es_MX.perfil.datos.guardado}</span> : null}
        </div>
      </form>
    </section>
  );
}

// ── Cambiar correo: diálogo aparte, con contraseña. No aplica nada hasta confirmar el enlace ─────

function BloqueCambiarCorreo({ perfil }: { readonly perfil: Profile }) {
  const [abierto, setAbierto] = useState(false);
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pedido, setPedido] = useState(false);
  const [errorCorreo, setErrorCorreo] = useState<string | undefined>(undefined);
  const [errorContrasena, setErrorContrasena] = useState<string | undefined>(undefined);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  function reiniciar(): void {
    setCorreo("");
    setContrasena("");
    setPedido(false);
    setErrorCorreo(undefined);
    setErrorContrasena(undefined);
    setErrorGeneral(null);
  }

  async function pedirCambio(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setErrorGeneral(null);
    const correoLimpio = correo.trim();
    let invalido = false;
    if (correoLimpio.length === 0) {
      setErrorCorreo(es_MX.perfil.cambiarCorreoDialogo.faltaCorreo);
      invalido = true;
    } else if (!RE_CORREO.test(correoLimpio)) {
      setErrorCorreo(es_MX.perfil.cambiarCorreoDialogo.correoInvalido);
      invalido = true;
    } else {
      setErrorCorreo(undefined);
    }
    if (contrasena.length === 0) {
      setErrorContrasena(es_MX.perfil.cambiarCorreoDialogo.faltaContrasena);
      invalido = true;
    } else {
      setErrorContrasena(undefined);
    }
    if (invalido) return;

    setEnviando(true);
    try {
      await requestEmailChange({ email: correoLimpio, password: contrasena });
      setPedido(true);
    } catch (error: unknown) {
      const code = codigoCuentaDeError(error);
      if (code === "CUENTA_PASSWORD_INCORRECTA") setErrorContrasena(es_MX.perfil.cambiarCorreoDialogo.contrasenaIncorrecta);
      else if (code === "CUENTA_DEMASIADOS_INTENTOS") setErrorGeneral(es_MX.perfil.errores.demasiadosIntentos);
      else setErrorGeneral(es_MX.perfil.errores.generico);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(siguiente) => {
        setAbierto(siguiente);
        if (!siguiente) reiniciar();
      }}
      trigger={
        <Button variant="secundario" size="sm" type="button">
          {es_MX.perfil.datos.cambiarCorreo}
        </Button>
      }
      title={es_MX.perfil.cambiarCorreoDialogo.titulo}
      description={es_MX.perfil.cambiarCorreoDialogo.descripcion}
    >
      {pedido ? (
        <p role="status" className="text-md rounded-ui-card bg-ui-success-soft p-4 text-ui-on-success-soft">
          {es_MX.perfil.cambiarCorreoDialogo.pedido}
        </p>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(e) => void pedirCambio(e)} noValidate>
          <Field label={es_MX.perfil.cambiarCorreoDialogo.nuevoCorreo} error={errorCorreo}>
            <Input
              name="new-email"
              type="email"
              autoComplete="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </Field>
          <Field label={es_MX.perfil.cambiarCorreoDialogo.contrasenaActual} error={errorContrasena}>
            <Input
              name="current-password"
              type="password"
              autoComplete="current-password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </Field>
          {errorGeneral ? (
            <p role="alert" className="text-sm font-semibold text-ui-danger-text">
              {errorGeneral}
            </p>
          ) : null}
          <Button type="submit" loading={enviando} loadingText={es_MX.perfil.cambiarCorreoDialogo.pidiendo}>
            {es_MX.perfil.cambiarCorreoDialogo.pedir}
          </Button>
        </form>
      )}
    </Dialog>
  );
}

// ── Contraseña: exige la actual, cierra todas las sesiones al terminar ──────────────────────────

function BloqueContrasena() {
  const router = useRouter();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repite, setRepite] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorActual, setErrorActual] = useState<string | undefined>(undefined);
  const [errorNueva, setErrorNueva] = useState<string | undefined>(undefined);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  async function cambiar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setErrorGeneral(null);
    let invalido = false;
    if (actual.length === 0) {
      setErrorActual(es_MX.perfil.contrasena.faltaActual);
      invalido = true;
    } else {
      setErrorActual(undefined);
    }
    if (nueva.length === 0) {
      setErrorNueva(es_MX.perfil.contrasena.faltaNueva);
      invalido = true;
    } else if (nueva !== repite) {
      setErrorNueva(es_MX.perfil.contrasena.noCoincide);
      invalido = true;
    } else {
      setErrorNueva(undefined);
    }
    if (invalido) return;

    setEnviando(true);
    try {
      await changePassword({ currentPassword: actual, newPassword: nueva });
      // Cierra todas las sesiones (contrato §2/§5.3): el `accessToken` de ESTA pestaña también deja
      // de servir de nada útil. Mismo aviso que usa `AsistenteAcceso` para una sesión terminada.
      router.push("/acceso?motivo=sesion");
    } catch (error: unknown) {
      const code = codigoCuentaDeError(error);
      if (code === "CUENTA_PASSWORD_INCORRECTA") setErrorActual(es_MX.perfil.contrasena.actualIncorrecta);
      else if (code === "CUENTA_DATOS_INVALIDOS") {
        // La política de la contraseña la escribe el servidor (mismo criterio que el alta, M-12):
        // no se reescribe aquí una segunda redacción de la misma regla.
        setErrorNueva(mensajeCuentaDeError(error) ?? es_MX.perfil.contrasena.ayuda);
      } else if (code === "CUENTA_DEMASIADOS_INTENTOS") setErrorGeneral(es_MX.perfil.errores.demasiadosIntentos);
      else setErrorGeneral(es_MX.perfil.errores.generico);
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby="contrasena-titulo" className="flex flex-col gap-4">
      <h2 id="contrasena-titulo" className="heading-md text-ui-ink">
        {es_MX.perfil.contrasena.titulo}
      </h2>
      <form className="flex flex-col gap-4" onSubmit={(e) => void cambiar(e)} noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={es_MX.perfil.contrasena.actual} error={errorActual}>
            <Input
              name="current-password"
              type="password"
              autoComplete="current-password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
          </Field>
          <Field label={es_MX.perfil.contrasena.nueva} hint={es_MX.perfil.contrasena.ayuda} error={errorNueva}>
            <Input
              name="new-password"
              type="password"
              autoComplete="new-password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
            />
          </Field>
          <Field label={es_MX.perfil.contrasena.repite}>
            <Input
              name="new-password-repite"
              type="password"
              autoComplete="new-password"
              value={repite}
              onChange={(e) => setRepite(e.target.value)}
            />
          </Field>
        </div>
        {/* Contrato §5.3: se avisa ANTES de que la persona pulse, no después. */}
        <p className="text-sm text-ui-ink-muted">{es_MX.perfil.contrasena.avisoCierraSesion}</p>
        {errorGeneral ? (
          <p role="alert" className="text-sm font-semibold text-ui-danger-text">
            {errorGeneral}
          </p>
        ) : null}
        <div>
          <Button type="submit" loading={enviando} loadingText={es_MX.perfil.contrasena.cambiando}>
            {es_MX.perfil.contrasena.cambiar}
          </Button>
        </div>
      </form>
    </section>
  );
}

// ── Sesiones: cierra todas de una vez. El `accessToken` se borra en el cliente aparte ───────────

function BloqueSesiones() {
  const router = useRouter();
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cerrarTodas(): Promise<void> {
    setCerrando(true);
    setError(null);
    try {
      await logoutAccount(); // ya borra el accessToken y el refreshToken locales (P8).
      router.push("/acceso");
    } catch {
      setError(es_MX.perfil.errores.generico);
      setCerrando(false);
    }
  }

  return (
    <section aria-labelledby="sesiones-titulo" className="flex flex-col gap-3">
      <h2 id="sesiones-titulo" className="heading-md text-ui-ink">
        {es_MX.perfil.sesiones.titulo}
      </h2>
      <p className="text-md text-ui-ink-muted">{es_MX.perfil.sesiones.intro}</p>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-ui-danger-text">
          {error}
        </p>
      ) : null}
      <div>
        <Button variant="secundario" loading={cerrando} loadingText={es_MX.perfil.sesiones.cerrando} onClick={() => void cerrarTodas()}>
          {es_MX.perfil.sesiones.cerrarTodas}
        </Button>
      </div>
    </section>
  );
}

// ── Tu información: sin ruta de baja autoservicio (ADR-5-E3-B2-01) ──────────────────────────────

function BloqueTuInformacion({ correoSoporte }: { readonly correoSoporte: string | null }) {
  return (
    <section aria-labelledby="tu-informacion-titulo" className="flex flex-col gap-3 border-t border-ui-border pt-8">
      <h2 id="tu-informacion-titulo" className="heading-md text-ui-ink">
        {es_MX.perfil.tuInformacion.titulo}
      </h2>
      {correoSoporte ? (
        <>
          <p className="text-md text-ui-ink-muted">{es_MX.perfil.tuInformacion.pedirBajaTexto(correoSoporte)}</p>
          <div>
            <Button asChild variant="terciario">
              <Link href={`mailto:${correoSoporte}?subject=${encodeURIComponent(es_MX.perfil.tuInformacion.pedirBaja)}`}>
                {es_MX.perfil.tuInformacion.pedirBaja}
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <p className="text-md text-ui-ink-muted">{es_MX.perfil.tuInformacion.sinSoporte}</p>
      )}
    </section>
  );
}
