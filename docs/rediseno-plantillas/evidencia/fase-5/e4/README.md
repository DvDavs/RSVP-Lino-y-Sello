# Evidencia fase 5 · sesión E4 — capturas con backend real

Capturas PNG a 390/768/1280 px, página completa, con datos reales del backend (cuenta nueva,
invitaciones creadas por los ayudantes de `e2e/preparar-pagos.ts`, pago confirmado con el webhook
de Stripe firmado de verdad). Cada PNG se miró con la herramienta de lectura de imágenes para
confirmar que muestra el estado correcto (no una pantalla de error ni vacía).

## Estado: 21/21 capturadas y verificadas.

## Lista

- `precios-{390,768,1280}.png` — `/precios`, catálogo real con los tres planes (Sencillo/Fiesta/Grande),
  «Fiesta» marcado Recomendado, y el mensaje honesto «El pago en línea todavía no está disponible;
  escríbenos» en los tres (backend sin `STRIPE_SECRET_KEY` en este entorno). Correctas en los tres anchos.
- `plan-sin-pago-{390,768,1280}.png` — `/editor/<id>/plan` de una invitación sin pagar: oferta con los
  tres planes, «Fiesta» preseleccionado, «Ver todos los planes», bloque de «pago en línea no disponible»
  e historial vacío («Todavía no hay pagos registrados»). Correctas en los tres anchos.
- `plan-con-pago-{390,768,1280}.png` — `/editor/<id>/plan` de la invitación pagada por el webhook:
  tarjeta «Plan Fiesta» con insignia Pagado, fecha e importe ($899.00), lo que incluye, «Ir a mi
  invitación», e historial con una fila (Fiesta, $899.00, Pagado). Correctas en los tres anchos.
- `pago-confirmado-{390,768,1280}.png` — `/pago?inv=<id>&sesion=<sessionId>` de la misma invitación
  pagada: «Listo, tu plan está activo», nombre del plan e importe, «Ir a mi invitación» / «Ver mi
  plan». Correctas en los tres anchos.
- `pago-esperando-{390,768,1280}.png` — `/pago?inv=<id>&sesion=cs_test_x` de una invitación con un pago
  PENDIENTE sin confirmar (capturada a los pocos segundos, antes de los 60 s de sondeo): anillo de
  carga, «Estamos confirmando tu pago», texto de «no cierres esta página». Correctas en los tres anchos.
- `pago-cancelado-{390,768,1280}.png` — `/pago?inv=<id>&cancelado=1`: «No completaste el pago», «no te
  cobramos nada», «Volver a intentar» / «Ver los planes». Correctas en los tres anchos.
- `publicar-bloqueo-plan-{390,768,1280}.png` — `/editor/<id>` (la misma invitación sin pagar y
  publicable de `plan-sin-pago`/`pago-cancelado`) con el diálogo de publicar abierto: bloqueo «Falta
  el plan: publica cuando tu invitación tenga un plan pagado» con el enlace «Elegir plan»
  (`publicar-ir-al-plan`), botón «Publicar» deshabilitado, y el aviso preexistente y ajeno del
  itinerario de ejemplo (contenido sembrado, no un defecto de esta sesión). Correctas en los tres
  anchos; la corrida que las produjo tuvo que repetirse porque el backend de `:6003` se cayó a media
  corrida por un reinicio del entorno ajeno a este agente (no lo paré ni lo reinicié yo).

## Defectos visuales observados (sin tocar código)

1. **`plan-con-pago-390.png` — desborde horizontal sin pista visual**: la tabla de «Pagos de esta
   invitación» (`HistorialDePagos`, columnas Fecha/Plan/Importe/Estado/Comprobante, `min-w-[560px]`)
   es más ancha que el viewport de 390 px. El contenedor scrollea horizontalmente por su cuenta (la
   página en sí no desborda, correcto), pero al cargar se ve la tabla cortada a media palabra
   («PAGAD…») sin ningún indicio (sombra, flecha, "desliza →") de que hay más columnas si se desliza
   el dedo. En Sencillo/Fiesta/Grande no aplica porque ahí no hay tabla.
   **Corregido** (agente 5-4-V): `HistorialDePagos.tsx:44-51` envuelve la tabla en un contenedor
   `role="region"` + `tabIndex={0}` + `aria-label` (`t.deslizate`, nueva clave en `lib/i18n.ts:890`,
   «Pagos de esta invitación, desplázate para ver más»), alcanzable con teclado con el anillo de foco
   del sistema (`focus-visible:ring-ui-focus`); `HistorialDePagos.tsx:106-109` añade el degradado
   decorativo (`aria-hidden`) en el borde derecho con `from-ui-surface`. Ninguna columna se ocultó.
2. **Anillo de foco azul en los títulos de `/pago`** (`pago-confirmado`, `pago-esperando`,
   `pago-cancelado`, los tres anchos): el `<h1>` recibe foco por programación (correcto para lectores
   de pantalla al cambiar de estado) y sale con un recuadro AZUL visible pese a la clase
   `focus:outline-none` del componente. Visualmente no combina con la paleta rosa/magenta del resto
   de la interfaz (botones, enlaces, Badge «Pagado» en verde). No bloquea nada y es mejor que no tener
   indicador de foco, pero el color desentona.
   **Corregido** (agente 5-4-V): los cinco `<h1 ref={tituloRef} tabIndex={-1}>` de
   `PantallaPago.tsx` (líneas 141, 163, 177, 204, 263) cambiaron `focus:outline-none` por
   `focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus
   focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface` — mismo patrón que
   `EncabezadoSitio.tsx:39` y el resto de `packages/ui`. `PantallaPlan.tsx` no tiene este patrón (su
   `<h1>` no recibe foco programático), así que no necesitó cambio.
3. Nada más reseñable: sin texto cortado, sin botones muertos, contraste aparente correcto en los 21
   estados revisados (fondo `ui-canvas` crema, texto `ui-ink` oscuro, acentos magenta/verde con
   suficiente contraste a simple vista). En `publicar-bloqueo-plan` el diálogo cabe completo a los
   tres anchos, sin desborde horizontal ni recortes del texto del bloqueo.

## Datos usados

Cuenta nueva (`cuentaNueva()`); tres invitaciones de esa cuenta: una sin pagar y publicable
(`invitacionSinPagarPublicable`, reusada en `plan-sin-pago`, `pago-cancelado` y `publicar-bloqueo-plan`),
una sin pagar simple con un pago `PENDIENTE` (`sessionId=cs_test_x`, sin webhook) para `pago-esperando`,
y una tercera pagada de verdad con el webhook firmado (`firmarWebhook` + `enviarWebhook`, plan real de
`GET /public/plans`) para `plan-con-pago` y `pago-confirmado`. Los datos de cada corrida (invitaciones,
pagos, evento de Stripe) se borraron en el bloque `finally` del propio spec; el spec temporal
(`e2e/_capturas-e4.spec.ts`) se borró al terminar.
