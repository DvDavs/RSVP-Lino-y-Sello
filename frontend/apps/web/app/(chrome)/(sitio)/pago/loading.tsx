// app/(chrome)/(sitio)/pago/loading.tsx — frontera de carga de Next para esta ruta (`ui-pantalla`
// §2/§7). La consulta real del estado del pago la hace `PantallaPago` en el navegador y tiene su
// propio estado de carga; esto solo cubre el instante en que Next resuelve el segmento de la ruta.
import { CargaPago } from "@/components/pago/CargaPago";

export default function CargandoPago() {
  return <CargaPago />;
}
