import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { ApiError, getPublicRender } from "@/lib/api-client";
import { fechaDe, fondoSeguroDe, subtituloDe, tituloDe } from "../../_componentes/composed-lectura";
import { textosPublicos } from "./textos";

// app/(public)/i/[publicToken]/opengraph-image.tsx — la tarjeta que se ve al pegar el enlace en
// WhatsApp (04 §15.4: "opengraph-image.tsx genera la tarjeta desde el servidor").
//
// TRES decisiones, las tres por privacidad y robustez (ADR-3-3-03):
//
// 1. La tarjeta es TIPOGRÁFICA, no la foto de portada. Una tarjeta de enlace la renderizan y
//    cachean servidores de terceros (WhatsApp, Telegram, Slack) fuera de todo control: subir ahí la
//    fotografía de la familia del cliente es una cesión de datos que nadie pidió. Además, en
//    producción los assets se sirven por URL FIRMADA de 15 min (`handoffs/2-5.md`, sección Assets),
//    así que una tarjeta que la incrustara se rompería en cuanto caducara la firma.
// 2. Solo viajan el TÍTULO y el SUBTÍTULO de portada. Ni dirección, ni lugar, ni teléfono, ni
//    nombres de padrinos. La fecha sí: es lo que hace útil la previsualización ("¿cuándo es?") y ya
//    va en el `<title>` del documento por diseño (04 §15.4).
// 3. Los colores y la tipografía salen del TEMA del documento (`theme.tokens`), no de una paleta
//    propia de `apps/web` (P3). El hex se revalida antes de usarse (`composed-lectura.ts`).
//
// Si el release no existe o no está disponible, se devuelve una tarjeta neutra: NUNCA un error, que
// haría que el enlace apareciera roto, y NUNCA un dato del documento.
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Invitación";

// `satori` (el motor de `next/og`) NO admite woff2 — solo ttf/otf/woff. `@fontsource` publica las
// dos variantes del mismo archivo; se usan las `.woff`.
const RAIZ_FUENTES = path.join(process.cwd(), "node_modules", "@fontsource");
const FUENTE_TITULO = path.join(
  RAIZ_FUENTES,
  "cormorant-garamond",
  "files",
  "cormorant-garamond-latin-600-normal.woff",
);
const FUENTE_CUERPO = path.join(RAIZ_FUENTES, "inter", "files", "inter-latin-400-normal.woff");

// Reserva usada cuando no hay documento (o no está disponible): los mismos valores de
// `packages/sections/src/theme/tokens.css`, para que la tarjeta neutra no invente una paleta.
const RESERVA = { bg: "#ffffff", ink: "#16130f", accent: "#3a3630", muted: "#6b655c" } as const;

type Tarjeta = {
  fondo: string;
  tinta: string;
  acento: string;
  apagado: string;
  titulo: string;
  subtitulo: string | null;
  fecha: string | null;
};

async function datosDeTarjeta(publicToken: string): Promise<Tarjeta> {
  const neutra: Tarjeta = {
    fondo: RESERVA.bg,
    tinta: RESERVA.ink,
    acento: RESERVA.accent,
    apagado: RESERVA.muted,
    titulo: textosPublicos.tituloGenerico,
    subtitulo: null,
    fecha: null,
  };
  try {
    const resultado = await getPublicRender(publicToken, {
      next: { revalidate: 300, tags: [`invitation:${publicToken}`] },
    });
    if (resultado.status === "not-modified") return neutra;
    const { composed } = resultado.data;
    const tokens = composed.theme.tokens;
    const hex = /^#[0-9a-fA-F]{6}$/;
    const seguro = (v: unknown, reserva: string) => (typeof v === "string" && hex.test(v) ? v : reserva);
    return {
      fondo: fondoSeguroDe(composed) ?? RESERVA.bg,
      tinta: seguro(tokens.ink, RESERVA.ink),
      acento: seguro(tokens.accent, RESERVA.accent),
      apagado: seguro(tokens.muted, RESERVA.muted),
      titulo: tituloDe(composed) ?? textosPublicos.tituloGenerico,
      subtitulo: subtituloDe(composed),
      fecha: fechaDe(composed),
    };
  } catch (err) {
    // `404`/`403` y cualquier otro fallo dan la misma tarjeta neutra: la previsualización de un
    // enlace nunca debe filtrar si el token existe (mismo criterio que el render, `03 §3.15`).
    if (err instanceof ApiError) return neutra;
    return neutra;
  }
}

export default async function TarjetaDeEnlace({ params }: { params: Promise<{ publicToken: string }> }) {
  const { publicToken } = await params;
  const [tarjeta, fuenteTitulo, fuenteCuerpo] = await Promise.all([
    datosDeTarjeta(publicToken),
    readFile(FUENTE_TITULO),
    readFile(FUENTE_CUERPO),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          padding: "72px 96px",
          background: tarjeta.fondo,
          color: tarjeta.tinta,
          fontFamily: "Inter",
          textAlign: "center",
        }}
      >
        {tarjeta.subtitulo ? (
          <div style={{ fontSize: 30, letterSpacing: 6, textTransform: "uppercase", color: tarjeta.apagado }}>
            {tarjeta.subtitulo}
          </div>
        ) : null}
        <div
          style={{
            fontFamily: "Cormorant Garamond",
            fontSize: 104,
            lineHeight: 1.08,
            maxWidth: 960,
            color: tarjeta.tinta,
          }}
        >
          {tarjeta.titulo}
        </div>
        <div style={{ width: 120, height: 2, background: tarjeta.acento, opacity: 0.7 }} />
        {tarjeta.fecha ? <div style={{ fontSize: 34, color: tarjeta.apagado }}>{tarjeta.fecha}</div> : null}
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Cormorant Garamond", data: fuenteTitulo, weight: 600, style: "normal" },
        { name: "Inter", data: fuenteCuerpo, weight: 400, style: "normal" },
      ],
    },
  );
}
