// components/sitio/VerificarCorreo.tsx — `/verificar-correo`, la pantalla más urgente de este
// encargo (fase 5, E3; `handoffs/5-E3-A2-contrato-cuenta.md §3-§4`).
//
// El backend ya manda correos de verificación (y de confirmación de cambio de correo) con un
// enlace a `${FRONTEND_URL}/verificar-correo?token=<token>`; antes de esta pantalla esa ruta no
// existía y todo el que pulsara el enlace caía en un 404.
//
// Pública, SIN sesión: `POST /auth/verify-email` es `permitAll` (contrato §3). Nunca se exige
// entrar antes de verificar — sería pedir lo que todavía no se puede pedir.
//
// El mismo enlace sirve para confirmar un cambio de correo pendiente, y confirmar cierra TODAS las
// sesiones abiertas de la cuenta (contrato §5.3). No hay forma de distinguir los dos casos desde
// aquí sin adivinar por el texto del `message` (el contrato prohíbe ordenar por `message`, solo por
// `code` — y el éxito no lleva `code`), así que en los dos casos se enseña el mensaje que YA manda
// el servidor (confiable, es-MX, distingue los dos casos por su cuenta) y se ofrece la MISMA
// salida: entrar de nuevo en `/acceso`. Es segura en los dos casos: si la sesión de esta pestaña no
// cambió, entrar de nuevo no hace daño; si sí cambió, es justo lo que hace falta.
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconoCorreo, IconoError, IconoExito, IconoReloj } from "@invitaciones/icons";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { Field } from "@invitaciones/ui/componentes/Field/index.ts";
import { Input } from "@invitaciones/ui/componentes/Input/index.ts";
import { Skeleton } from "@invitaciones/ui/componentes/Skeleton.tsx";
import { authResendVerification, authVerifyEmail } from "@/lib/api-client";
import { es_MX } from "@/lib/i18n";
import { codigoCuentaDeError } from "./traducir-errores.ts";

type Estado =
  | { readonly tipo: "sin-token" }
  | { readonly tipo: "verificando" }
  | { readonly tipo: "verificado"; readonly mensaje: string }
  | { readonly tipo: "token-invalido" }
  | { readonly tipo: "token-caducado" }
  | { readonly tipo: "error" };

const CLASE_CONTENEDOR = "mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-5 py-16 text-center sm:px-8";
const CLASE_TITULO = "display-sm text-ui-ink";
const CLASE_CUERPO = "text-md max-w-[48ch] text-ui-ink-muted";

export function VerificarCorreo() {
  const parametros = useSearchParams();
  const token = parametros.get("token");
  const [estado, setEstado] = useState<Estado>(token ? { tipo: "verificando" } : { tipo: "sin-token" });

  useEffect(() => {
    if (!token) return;
    let cancelado = false;
    authVerifyEmail({ token })
      .then((respuesta) => {
        if (!cancelado) setEstado({ tipo: "verificado", mensaje: respuesta.message });
      })
      .catch((error: unknown) => {
        if (cancelado) return;
        const code = codigoCuentaDeError(error);
        if (code === "CUENTA_TOKEN_INVALIDO") setEstado({ tipo: "token-invalido" });
        else if (code === "CUENTA_TOKEN_CADUCADO") setEstado({ tipo: "token-caducado" });
        else setEstado({ tipo: "error" });
      });
    return () => {
      cancelado = true;
    };
    // Un único intento por token (§4: un token de verificación se consume al usarse): nunca se
    // reintenta solo. Reintentar es la acción explícita de "pide uno nuevo" del panel de reenvío.
  }, [token]);

  if (estado.tipo === "sin-token") {
    return (
      <section aria-labelledby="verificar-titulo" className={CLASE_CONTENEDOR}>
        <IconoCorreo size={48} aria-hidden />
        <h1 id="verificar-titulo" className={CLASE_TITULO}>
          {es_MX.cuenta.verificarCorreo.sinToken.titulo}
        </h1>
        <p className={CLASE_CUERPO}>{es_MX.cuenta.verificarCorreo.sinToken.cuerpo}</p>
        <Button asChild>
          <Link href="/acceso">{es_MX.comun.iniciarSesion}</Link>
        </Button>
      </section>
    );
  }

  if (estado.tipo === "verificando") {
    return (
      <section aria-labelledby="verificar-titulo" className={CLASE_CONTENEDOR}>
        <h1 id="verificar-titulo" className={CLASE_TITULO}>
          {es_MX.cuenta.verificarCorreo.titulo}
        </h1>
        <p role="status" className={CLASE_CUERPO}>
          {es_MX.cuenta.verificarCorreo.verificando}
        </p>
        <Skeleton variante="bloque" alto={44} ancho={220} etiqueta={es_MX.cuenta.verificarCorreo.verificando} />
      </section>
    );
  }

  if (estado.tipo === "verificado") {
    return (
      <section aria-labelledby="verificar-titulo" className={CLASE_CONTENEDOR}>
        <IconoExito size={48} aria-hidden />
        <h1 id="verificar-titulo" className={CLASE_TITULO}>
          {es_MX.cuenta.verificarCorreo.verificado.titulo}
        </h1>
        <p role="status" className={CLASE_CUERPO}>
          {estado.mensaje}
        </p>
        <Button asChild>
          <Link href="/acceso">{es_MX.cuenta.verificarCorreo.verificado.entrar}</Link>
        </Button>
      </section>
    );
  }

  if (estado.tipo === "error") {
    return (
      <section aria-labelledby="verificar-titulo" className={CLASE_CONTENEDOR}>
        <IconoError size={48} aria-hidden />
        <h1 id="verificar-titulo" className={CLASE_TITULO}>
          {es_MX.cuenta.verificarCorreo.error.titulo}
        </h1>
        <p role="alert" className={CLASE_CUERPO}>
          {es_MX.cuenta.verificarCorreo.error.cuerpo}
        </p>
      </section>
    );
  }

  // "token-invalido" | "token-caducado": los dos ofrecen lo mismo, pedir uno nuevo (contrato §4.6).
  const copia =
    estado.tipo === "token-invalido" ? es_MX.cuenta.verificarCorreo.tokenInvalido : es_MX.cuenta.verificarCorreo.tokenCaducado;
  return (
    <section aria-labelledby="verificar-titulo" className={CLASE_CONTENEDOR}>
      <IconoReloj size={48} aria-hidden />
      <h1 id="verificar-titulo" className={CLASE_TITULO}>
        {copia.titulo}
      </h1>
      <p role="alert" className={CLASE_CUERPO}>
        {copia.cuerpo}
      </p>
      <PanelReenvio />
    </section>
  );
}

function PanelReenvio() {
  const [correo, setCorreo] = useState("");
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
      await authResendVerification({ email: correo.trim() });
      setEnviado(true);
    } catch (e: unknown) {
      // La respuesta buena es SIEMPRE la misma exista o no la cuenta (contrato §2): lo único que
      // se distingue aquí es un límite de intentos o un correo mal escrito, nunca si existe.
      const code = codigoCuentaDeError(e);
      if (code === "CUENTA_DEMASIADOS_INTENTOS") setError(es_MX.cuenta.verificarCorreo.demasiadosIntentos);
      else if (code === "CUENTA_DATOS_INVALIDOS") setError(es_MX.acceso.registro.correoInvalido);
      else if (e instanceof TypeError) setError(es_MX.errores.sinRed);
      else setError(es_MX.errores.generico);
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <p role="status" className="text-md mt-2 rounded-ui-card bg-ui-success-soft p-4 text-ui-on-success-soft">
        {es_MX.cuenta.verificarCorreo.reenvio.enviado}
      </p>
    );
  }

  return (
    <form className="mt-2 flex w-full flex-col gap-4 text-left" onSubmit={(e) => void enviar(e)} noValidate>
      <Field label={es_MX.cuenta.verificarCorreo.reenvio.correo} error={error ?? undefined}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
      </Field>
      <Button type="submit" loading={enviando} loadingText={es_MX.cuenta.verificarCorreo.reenvio.enviando} className="w-full">
        {es_MX.cuenta.verificarCorreo.reenvio.enviar}
      </Button>
    </form>
  );
}
