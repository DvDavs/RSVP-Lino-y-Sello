// components/sitio/AsistenteAcceso.tsx — `/acceso` entera: entrar, crear cuenta y recuperar la
// contraseña, en una sola pantalla con dos pestañas (`11 §7`, fila «Acceso y registro»).
//
// Qué cambia respecto de la pantalla de la fase 3 y por qué:
//  1. Antes solo se podía ENTRAR. Quien no tenía cuenta se quedaba fuera sin ninguna salida, y la
//     recuperación de contraseña no existía en la interfaz aunque el backend la sirviera desde
//     siempre (`POST /auth/request-password-reset`).
//  2. El registro va en TRES pasos con progreso visible (`WizardProgress`) en vez de un formulario
//     de cinco campos: es el mismo contrato del asistente de creación y el mismo componente.
//  3. Los controles son los del sistema (`Field` + `Input` + `Button`), no `<input>` con clases
//     sueltas: el foco, el error con icono y el `aria-describedby` los pone el componente.
//
// Lo que NO cambia (a propósito): el token sigue escribiéndose SOLO dentro de `lib/api-client.ts`
// (P8) y esta pantalla no toca `sessionStorage`; y el texto del error de credenciales es el mismo
// para «no existe» y para «contraseña mal», que es lo que impide enumerar cuentas.
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { Field } from "@invitaciones/ui/componentes/Field/index.ts";
import { Input } from "@invitaciones/ui/componentes/Input/index.ts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@invitaciones/ui/componentes/Tabs/index.ts";
import { WizardProgress, type EstadoPaso } from "@invitaciones/ui/componentes/WizardProgress/index.ts";
import { authLogin, authRequestPasswordReset, authSignup } from "@/lib/api-client";
import { es_MX } from "@/lib/i18n";
import { destinoSeguro, traducirErrorAcceso, traducirErrorRegistro, type PasoRegistro } from "./traducir-errores.ts";

const CLASE_PANEL = "mt-8";
const CLASE_TITULO = "display-sm text-ui-ink";
const CLASE_INTRO = "text-md mt-2 text-ui-ink-muted";

/** `1 → ["actual","pendiente","pendiente"]`. Un solo sitio decide el estado de los tres círculos. */
function estadosDe(actual: PasoRegistro): readonly EstadoPaso[] {
  return [1, 2, 3].map((n) => (n < actual ? "hecho" : n === actual ? "actual" : "pendiente")) as EstadoPaso[];
}

export function AsistenteAcceso() {
  const router = useRouter();
  const parametros = useSearchParams();
  const volver = destinoSeguro(parametros.get("volver"));
  const motivo = parametros.get("motivo");

  return (
    <div className="mx-auto w-full max-w-lg px-5 py-12 sm:px-8">
      {motivo === "sesion" ? (
        <p role="status" className="text-sm mb-6 rounded-ui-control bg-ui-surface-alt p-3 text-ui-ink">
          {es_MX.acceso.sesionTerminada}
        </p>
      ) : null}

      <Tabs defaultValue="entrar">
        <TabsList aria-label={es_MX.acceso.pestanas}>
          <TabsTrigger value="entrar">{es_MX.acceso.pestanaEntrar}</TabsTrigger>
          <TabsTrigger value="crear">{es_MX.acceso.pestanaCrearCuenta}</TabsTrigger>
        </TabsList>

        <TabsContent value="entrar" className={CLASE_PANEL}>
          <PanelEntrar volver={volver} onEntrado={() => router.replace(volver)} />
        </TabsContent>

        <TabsContent value="crear" className={CLASE_PANEL}>
          <PanelRegistro onCreada={() => router.replace(volver)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Entrar (y, desde aquí, recuperar la contraseña)
// ───────────────────────────────────────────────────────────────────────────────────────────────

function PanelEntrar({ volver, onEntrado }: { readonly volver: string; readonly onEntrado: () => void }) {
  const [recuperando, setRecuperando] = useState(false);
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (recuperando) {
    return <PanelRecuperar correoInicial={correo} onVolver={() => setRecuperando(false)} />;
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    if (correo.trim().length === 0) {
      setError(es_MX.acceso.faltaCorreo);
      return;
    }
    if (contrasena.length === 0) {
      setError(es_MX.acceso.faltaContrasena);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await authLogin({ email: correo.trim(), password: contrasena });
      // `replace` y no `push`: si la clienta pulsa «atrás» no debe volver al formulario ya resuelto.
      onEntrado();
    } catch (e: unknown) {
      setError(traducirErrorAcceso(e));
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby="acceso-titulo">
      <h1 id="acceso-titulo" className={CLASE_TITULO}>
        {es_MX.acceso.titulo}
      </h1>
      <p className={CLASE_INTRO}>{es_MX.acceso.intro}</p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => void enviar(e)} noValidate>
        <Field label={es_MX.acceso.correo}>
          <Input
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </Field>
        <Field label={es_MX.acceso.contrasena}>
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
          />
        </Field>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-ui-danger-text">
            {error}
          </p>
        ) : null}

        <Button type="submit" loading={enviando} loadingText={es_MX.acceso.entrando} className="mt-2 w-full">
          {es_MX.acceso.entrar}
        </Button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button variant="terciario" size="sm" type="button" onClick={() => setRecuperando(true)}>
          {es_MX.acceso.olvide}
        </Button>
        {volver !== "/editor" ? null : (
          <Link href="/ayuda" className="rounded-ui-control py-2 text-sm font-semibold text-ui-link hover:underline">
            {es_MX.comun.ayuda}
          </Link>
        )}
      </div>
    </section>
  );
}

function PanelRecuperar({ correoInicial, onVolver }: { readonly correoInicial: string; readonly onVolver: () => void }) {
  const [correo, setCorreo] = useState(correoInicial);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    if (correo.trim().length === 0) {
      setError(es_MX.acceso.faltaCorreo);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await authRequestPasswordReset({ email: correo.trim() });
    } catch (e: unknown) {
      // Un 4xx aquí significa «ese correo no está» — y decirlo convertiría esta pantalla en un
      // enumerador de cuentas (`ADR-3C-N01-01`). Solo se reporta lo que NO revela nada: la red.
      if (e instanceof TypeError) {
        setError(es_MX.errores.sinRed);
        setEnviando(false);
        return;
      }
    }
    setEnviado(true);
    setEnviando(false);
  }

  return (
    <section aria-labelledby="recuperar-titulo">
      <h1 id="recuperar-titulo" className={CLASE_TITULO}>
        {es_MX.acceso.recuperar.titulo}
      </h1>
      <p className={CLASE_INTRO}>{es_MX.acceso.recuperar.intro}</p>

      {enviado ? (
        <p role="status" className="text-md mt-6 rounded-ui-card bg-ui-success-soft p-4 text-ui-on-success-soft">
          {es_MX.acceso.recuperar.enviado}
        </p>
      ) : (
        <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => void enviar(e)} noValidate>
          <Field label={es_MX.acceso.correo}>
            <Input
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-sm font-semibold text-ui-danger-text">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={enviando} loadingText={es_MX.acceso.recuperar.enviando} className="w-full">
            {es_MX.acceso.recuperar.enviar}
          </Button>
        </form>
      )}

      <div className="mt-5">
        <Button variant="terciario" size="sm" type="button" onClick={onVolver}>
          {es_MX.acceso.recuperar.volver}
        </Button>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Crear cuenta — tres pasos (11 §7): correo · contraseña · nombre
// ───────────────────────────────────────────────────────────────────────────────────────────────

function PanelRegistro({ onCreada }: { readonly onCreada: () => void }) {
  const [paso, setPaso] = useState<PasoRegistro>(1);
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estados = estadosDe(paso);
  const pasos = [
    { id: "correo", etiqueta: es_MX.acceso.registro.pasoCorreo, estado: estados[0] as EstadoPaso },
    { id: "contrasena", etiqueta: es_MX.acceso.registro.pasoContrasena, estado: estados[1] as EstadoPaso },
    { id: "nombre", etiqueta: es_MX.acceso.registro.pasoNombre, estado: estados[2] as EstadoPaso },
  ];

  function siguiente(): void {
    setError(null);
    if (paso === 1) {
      if (correo.trim().length === 0) {
        setError(es_MX.acceso.faltaCorreo);
        return;
      }
      setPaso(2);
      return;
    }
    if (paso === 2) {
      if (contrasena.length === 0) {
        setError(es_MX.acceso.faltaContrasena);
        return;
      }
      setPaso(3);
    }
  }

  async function crear(evento: React.FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    if (paso !== 3) {
      siguiente();
      return;
    }
    if (nombre.trim().length === 0) {
      setError(es_MX.acceso.registro.faltaNombre);
      return;
    }
    if (apellidos.trim().length === 0) {
      setError(es_MX.acceso.registro.faltaApellidos);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await authSignup({
        name: nombre.trim(),
        lastName: apellidos.trim(),
        email: correo.trim(),
        password: contrasena,
      });
      onCreada();
    } catch (e: unknown) {
      // La validación de forma la hace el servidor (una sola fuente): aquí solo se traduce y se
      // devuelve a la persona AL PASO del campo que falló, para que pueda corregirlo.
      const { mensaje, paso: destino } = traducirErrorRegistro(e);
      setError(mensaje);
      if (destino) setPaso(destino);
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby="registro-titulo">
      <h1 id="registro-titulo" className={CLASE_TITULO}>
        {es_MX.acceso.registro.titulo}
      </h1>
      <p className={CLASE_INTRO}>{es_MX.acceso.registro.intro}</p>

      <WizardProgress pasos={pasos} className="mt-6" />

      <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => void crear(e)} noValidate>
        {paso === 1 ? (
          <Field label={es_MX.acceso.correo} hint={es_MX.acceso.registro.ayudaCorreo}>
            <Input
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </Field>
        ) : null}

        {paso === 2 ? (
          <Field label={es_MX.acceso.contrasena} hint={es_MX.acceso.registro.ayudaContrasena}>
            <Input
              name="new-password"
              type="password"
              autoComplete="new-password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </Field>
        ) : null}

        {paso === 3 ? (
          <>
            <Field label={es_MX.acceso.registro.nombre}>
              <Input name="name" autoComplete="given-name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Field>
            <Field label={es_MX.acceso.registro.apellidos}>
              <Input
                name="lastName"
                autoComplete="family-name"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
              />
            </Field>
          </>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-semibold text-ui-danger-text">
            {error}
          </p>
        ) : null}

        <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row-reverse sm:items-center">
          <Button type="submit" loading={enviando} loadingText={es_MX.acceso.registro.creando} className="w-full sm:w-auto">
            {paso === 3 ? es_MX.acceso.registro.crear : es_MX.acceso.registro.continuar}
          </Button>
          {paso > 1 ? (
            <Button
              type="button"
              variant="terciario"
              onClick={() => {
                setError(null);
                setPaso((p) => (p === 3 ? 2 : 1));
              }}
            >
              {es_MX.acceso.registro.atras}
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
