// packages/ui/src/componentes/Image.historias.tsx — historia de la galería (`11 §5` fila «Image»).
// `variantes`: las cinco máscaras de foto (§3.1), todas sin `src` (estado "pendiente": el placeholder
// del sistema, determinista, sin red). `estados`: los cuatro de la tabla, congelados con
// `congelarEnEstado` para que la captura de regresión visual no compita con la carga real de la
// imagen — ver el comentario de esa prop en `Image.tsx`.
//
// Convención de registro (contrato de integración F1+F2, ver `historias/registro.ts`): exporta
// `historias: readonly Historia[]`, aunque solo tenga una entrada.
import { MASCARAS } from "../shapes/mascaras.ts";
import { Image } from "./Image.tsx";
import { FOTO_DEMO } from "./demo-foto.ts";
import type { Historia, Variante } from "../historias/tipos.ts";

const NOMBRE_MASCARA: Record<(typeof MASCARAS)[number], string> = {
  "radius-lg": "Radio grande",
  blob: "Blob",
  arch: "Arco",
  seal: "Sello",
  rotated: "Cuadrado rotado",
};

const variantesMascara: Variante[] = MASCARAS.map((mascara) => ({
  nombre: NOMBRE_MASCARA[mascara],
  nota: `mask="${mascara}", sin src: estado "pendiente" (placeholder del sistema, §3.3).`,
  render: () => (
    <div style={{ width: 200 }}>
      <Image mask={mascara} alt={`Fotografía pendiente, máscara ${mascara}`} imageId={`historia-${mascara}`} />
    </div>
  ),
}));

export const historias: readonly Historia[] = [
  {
    slug: "image",
    nombre: "Image",
    familia: "imagen",
    descripcion:
      "Toda fotografía del producto: máscara o radio ≥ 24 px (§3.1), placeholder del sistema sin foto, alt obligatorio salvo decorative.",
    variantes: variantesMascara,
    estados: [
      {
        nombre: "Pendiente",
        nota: "Sin src: shapes/Image pinta el placeholder del sistema directamente.",
        render: () => (
          <div style={{ width: 200 }}>
            <Image mask="radius-lg" alt="Foto de portada pendiente" imageId="historia-pendiente" />
          </div>
        ),
      },
      {
        nombre: "Cargando",
        nota: "Skeleton dentro de la máscara mientras el navegador decodifica la imagen.",
        render: () => (
          <div style={{ width: 200 }}>
            <Image mask="radius-lg" src={FOTO_DEMO} alt="Pareja en su boda" congelarEnEstado="cargando" />
          </div>
        ),
      },
      {
        nombre: "Cargada",
        nota: "Fundido de opacidad de 200 ms al terminar de cargar.",
        render: () => (
          <div style={{ width: 200 }}>
            <Image mask="radius-lg" src={FOTO_DEMO} alt="Pareja en su boda" congelarEnEstado="cargada" />
          </div>
        ),
      },
      {
        nombre: "Rota",
        nota: "onError: placeholder del sistema con el alt como texto, no un icono de imagen rota del navegador.",
        render: () => (
          <div style={{ width: 200 }}>
            <Image mask="radius-lg" src="/no-existe.jpg" alt="Pareja en su boda" congelarEnEstado="rota" />
          </div>
        ),
      },
      {
        nombre: "Decorativa",
        nota: "decorative: true retira la imagen del árbol accesible (alt=\"\").",
        render: () => (
          <div style={{ width: 200 }}>
            <Image mask="seal" src={FOTO_DEMO} decorative congelarEnEstado="cargada" />
          </div>
        ),
      },
    ],
  },
];
