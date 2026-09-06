"use client";

// components/editor/EncabezadoSitio.tsx — la cabecera del chrome, con CONTROLES DE VERDAD (U-1).
//
// Antes: `04 §6.1` dibuja «[? Ayuda]» y «[Mi cuenta ▾]» como controles reales y la implementación
// puso dos `href="#"` que no llevaban a ningún sitio (D-8 de `bitacora/3-ux.md`; la clienta hizo
// clic en los dos y la URL solo ganó una almohadilla). Un enlace que no lleva a nada es peor que no
// tenerlo: promete una salida que no existe justo cuando la persona está buscando una.
//
// Ahora los dos destinos existen: «Ayuda» va a `/ayuda` (página real en es-MX) y el bloque de
// cuenta es un control con estado — «Iniciar sesión» cuando no hay sesión, «Cerrar sesión» cuando
// la hay. No hay menú desplegable: no habría nada más que poner dentro y un menú de una sola opción
// esconde la acción tras un clic de más.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@invitaciones/ui";
import { IconoAyuda, IconoEntrar, IconoSalir } from "@invitaciones/icons";
import { clearAuthToken, getAuthToken } from "@/lib/api-client";
import { es_MX } from "@/lib/i18n";

export function EncabezadoSitio({ volverA }: { volverA?: string }) {
  const router = useRouter();
  // `getAuthToken()` lee `sessionStorage`: en el render del servidor no existe, así que el estado
  // arranca en `null` («no lo sé todavía») y se resuelve en el primer efecto del cliente. Sin este
  // paso, el HTML del servidor y el del cliente no coinciden y React avisa de hidratación.
  const [conSesion, setConSesion] = useState<boolean | null>(null);

  useEffect(() => {
    setConSesion(getAuthToken() !== null);
  }, []);

  const destinoAcceso = `/acceso${volverA ? `?volver=${encodeURIComponent(volverA)}` : ""}`;

  return (
    <header className="static flex min-h-24 flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-ui-surface px-6 py-4">
      <Link
        href="/editor"
        className="rounded-ui-control heading-md text-ui-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface"
      >
        Invitaciones
      </Link>
      <nav aria-label="Cuenta y ayuda" className="flex items-center gap-1">
        <Button asChild variant="terciario" size="sm">
          <Link href="/ayuda">
            <IconoAyuda size={18} tone="mono" />
            {es_MX.comun.ayuda}
          </Link>
        </Button>
        {conSesion === null ? null : conSesion ? (
          <Button
            variant="terciario"
            size="sm"
            onClick={() => {
              clearAuthToken();
              setConSesion(false);
              router.push("/acceso");
              router.refresh();
            }}
          >
            <IconoSalir size={18} tone="mono" />
            {es_MX.comun.cerrarSesion}
          </Button>
        ) : (
          <Button asChild variant="terciario" size="sm">
            <Link href={destinoAcceso}>
              <IconoEntrar size={18} tone="mono" />
              {es_MX.comun.iniciarSesion}
            </Link>
          </Button>
        )}
      </nav>
    </header>
  );
}
