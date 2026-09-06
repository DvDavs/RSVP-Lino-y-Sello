import Link from "next/link";
import { PALETAS, PAREJAS, ROLES_COLOR, ROLES_TIPOGRAFICOS, paletaActiva } from "@invitaciones/tokens";

const SECCIONES = [
  {
    href: "/design/tokens",
    titulo: "Tokens",
    descripcion:
      "Escalas de la paleta, los 46 roles semánticos con su pareja medida, tipografía, espacio, forma y movimiento. Con conmutador de tema.",
    estado: "disponible",
  },
  {
    href: "/design/tipografia",
    titulo: "Tipografía",
    descripcion: "Las tres voces en uso: Fraunces para titular, Onest para leer, Red Hat Mono para etiquetar.",
    estado: "disponible",
  },
  {
    href: "/design/iconos",
    titulo: "Iconos",
    descripcion: "Inventario propio con búsqueda: retícula 24, trazo 1,75 redondeado, dos tonos.",
    estado: "disponible",
  },
  {
    href: "/design/formas",
    titulo: "Formas",
    descripcion: "Rayos, rayas, ondas, blobs, sello festoneado y máscaras de foto, con sus reglas de composición.",
    estado: "disponible",
  },
  {
    href: "/design/componentes",
    titulo: "Componentes",
    descripcion: "Cada componente con todas sus variantes y estados, como los ve el teclado y el lector de pantalla.",
    estado: "disponible",
  },
] as const;

export default function IndiceGaleria() {
  const paleta = paletaActiva();
  const cifras = [
    { dato: String(Object.keys(PALETAS).length), etiqueta: "paletas verificadas" },
    { dato: String(ROLES_COLOR.length), etiqueta: "roles de color" },
    { dato: String(PAREJAS.length), etiqueta: "parejas medidas" },
    { dato: String(ROLES_TIPOGRAFICOS.length), etiqueta: "roles tipográficos" },
  ];

  return (
    <div className="grid gap-10">
      <header className="grid gap-4">
        <p className="font-ui-label text-ui-label-md uppercase text-ui-ink-muted">Galería interna</p>
        <h1 className="font-ui-display text-ui-display-xl text-ui-ink">Sistema de diseño del producto</h1>
        <p className="max-w-[68ch] font-ui-text text-ui-text-lg text-ui-ink-muted">
          Todo lo que pinta el chrome del editor, la web pública, el acceso y el catálogo sale de aquí. Las plantillas
          de invitación tienen su propio sistema y esta página no las toca. Paleta activa: {paleta.nombre}.
        </p>
        <dl className="flex flex-wrap gap-3">
          {cifras.map((c) => (
            <div key={c.etiqueta} className="rounded-ui-card bg-ui-surface-raised px-4 py-3 shadow-ui-1">
              <dt className="font-ui-label text-ui-label-sm uppercase text-ui-ink-muted">{c.etiqueta}</dt>
              <dd className="font-ui-display text-ui-display-sm text-ui-ink">{c.dato}</dd>
            </div>
          ))}
        </dl>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {SECCIONES.map((s) => (
          <li key={s.href}>
            <article className="grid h-full gap-2 rounded-ui-card bg-ui-surface-raised p-5 shadow-ui-1">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-ui-display text-ui-heading-md text-ui-ink">
                  <Link href={s.href} className="text-ui-link no-underline hover:underline">
                    {s.titulo}
                  </Link>
                </h2>
                <span className="font-ui-label text-ui-label-sm uppercase text-ui-ink-muted">{s.estado}</span>
              </div>
              <p className="font-ui-text text-ui-text-sm text-ui-ink-muted">{s.descripcion}</p>
            </article>
          </li>
        ))}
      </ul>

      <section aria-labelledby="como-se-usa" className="grid gap-3 rounded-ui-card bg-ui-surface-alt p-5">
        <h2 id="como-se-usa" className="font-ui-display text-ui-heading-md text-ui-ink">
          Cómo se consume
        </h2>
        <p className="max-w-[68ch] font-ui-text text-ui-text-sm text-ui-ink-muted">
          En el CSS raíz del módulo, después de Tailwind: <code className="font-ui-label">@import
          &quot;@invitaciones/tokens/tokens.css&quot;</code> y <code className="font-ui-label">@import
          &quot;@invitaciones/tokens/tailwind.css&quot;</code>. A partir de ahí el color entra por utilidad semántica
          (<code className="font-ui-label">bg-ui-primary</code>, <code className="font-ui-label">text-ui-on-primary</code>,
          <code className="font-ui-label"> ring-ui-focus</code>) y nunca por un paso de escala suelto.
        </p>
      </section>
    </div>
  );
}
