// app/(chrome)/(sitio)/precios/loading.tsx — frontera de carga de Next para esta ruta (`ui-pantalla`
// §2/§7). El fetch real del catálogo lo hace `PantallaPrecios` en el navegador y tiene su propio
// estado de carga; esto solo cubre el instante en que Next resuelve el segmento de la ruta.
import { CargaDePlanes } from "@/components/precios/CargaDePlanes";

export default function CargandoPrecios() {
  return (
    <div className="mx-auto w-full max-w-ui-page px-5 pb-16 pt-12 sm:px-8">
      <CargaDePlanes />
    </div>
  );
}
