"use client";

// app/(chrome)/acceso/page.tsx — LA PANTALLA DE ACCESO (U-1).
//
// Por qué existe: la revisión de uso sin instrucciones abandonó aquí, en el minuto 3. `/editor`
// decía «Tu sesión no es válida o expiró. Inicia sesión de nuevo.» y **no había dónde**: ni botón,
// ni campo de correo, ni ruta `/login` en el `build` (`bitacora/3-ux.md` §1.1). `04 §7.1` paso 1 ya
// contrataba «401 → redirección a login»; faltaba la pantalla a la que redirigir.
//
// El token sigue viviendo SOLO en `lib/api-client.ts` (P8, contratos §8 C4): esta página llama a
// `authLogin`, que es la única función que escribe el token, y no toca `sessionStorage` por su
// cuenta.
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { CLASES_CONTROL } from "@/components/fields/FieldShell";
import { ApiError, SessionError, authLogin } from "@/lib/api-client";
import { es_MX } from "@/lib/i18n";

/** Solo se acepta una ruta interna: un `?volver=https://otro-sitio` sería un redirector abierto. */
function destinoSeguro(crudo: string | null): string {
  if (!crudo) return "/editor";
  if (!crudo.startsWith("/") || crudo.startsWith("//")) return "/editor";
  return crudo;
}

function FormularioAcceso() {
  const router = useRouter();
  const parametros = useSearchParams();
  const volver = destinoSeguro(parametros.get("volver"));
  const motivo = parametros.get("motivo");

  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // `replace` y no `push`: si la clienta pulsa «atrás» no debe volver al formulario de acceso
      // ya resuelto.
      router.replace(volver);
    } catch (e: unknown) {
      // Ni un error se pinta en inglés ni con jerga (U-9): 401 es «no coinciden», la red caída es
      // «no hay conexión», y cualquier otra cosa lleva su código para poder reportarla.
      if (e instanceof SessionError) setError(es_MX.acceso.credencialesInvalidas);
      else if (e instanceof ApiError) setError(`${es_MX.errores.generico} ${es_MX.errores.codigo(e.code)}`);
      else if (e instanceof TypeError) setError(es_MX.errores.sinRed);
      else setError(e instanceof Error ? e.message : es_MX.errores.generico);
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <h1 className="font-ui-display text-ui-section font-semibold text-ui-ink-heading">{es_MX.acceso.titulo}</h1>
      <p className="mt-2 text-ui-body text-ui-ink-muted">{es_MX.acceso.intro}</p>

      {motivo === "sesion" ? (
        <p role="status" className="mt-4 rounded-ui-control bg-ui-bg-alt p-3 text-ui-aux text-ui-ink">
          {es_MX.acceso.sesionTerminada}
        </p>
      ) : null}

      <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => void enviar(e)} noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="acceso-correo" className="text-ui-aux font-semibold text-ui-ink">
            {es_MX.acceso.correo}
          </label>
          <input
            id="acceso-correo"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            className={CLASES_CONTROL}
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="acceso-contrasena" className="text-ui-aux font-semibold text-ui-ink">
            {es_MX.acceso.contrasena}
          </label>
          <input
            id="acceso-contrasena"
            name="password"
            type="password"
            autoComplete="current-password"
            className={CLASES_CONTROL}
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
          />
        </div>

        {error ? (
          <p role="alert" className="text-ui-aux text-ui-danger">
            {error}
          </p>
        ) : null}

        <Button type="submit" busy={enviando} className="mt-2 w-full">
          {enviando ? es_MX.acceso.entrando : es_MX.acceso.entrar}
        </Button>
      </form>
    </main>
  );
}

export default function PaginaAcceso() {
  // `useSearchParams` obliga a un límite de Suspense en una página del App Router: sin él, el build
  // falla con «useSearchParams should be wrapped in a suspense boundary» (verificado, next@16.3.4).
  return (
    <Suspense
      fallback={
        <p role="status" className="p-8 text-ui-ink-muted">
          {es_MX.comun.cargando}
        </p>
      }
    >
      <FormularioAcceso />
    </Suspense>
  );
}
