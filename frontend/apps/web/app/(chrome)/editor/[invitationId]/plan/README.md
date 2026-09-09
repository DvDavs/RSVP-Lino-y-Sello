# `/editor/[invitationId]/plan` — sesión **E4** (pagos)

**Esto es un marcador del andamio 5-0d y se sustituye ENTERO.** Hoy no lee nada y no enseña ningún
dato de facturación.

## Qué pantalla va aquí
El plan de ESTA invitación: cuál es, qué incluye, en qué estado está el pago y cómo cambiarlo. Desde
aquí sale la ida a Stripe Checkout, cuya vuelta aterriza en `/pago`. Es el destino de la entrada
«Plan» del registro (`lib/panel/nav.plan.ts`).

## Backend que consume
Los endpoints de planes y pagos de `templates2` de la fase 5 (creación de la sesión de Checkout y
consulta del estado del plan). El precio y el estado los manda SIEMPRE el backend: el frontend no
calcula importes ni decide qué está pagado.

## Ficheros que E4 puede tocar desde aquí
- esta carpeta entera, y las de `/precios` y `/pago`,
- `lib/panel/nav.plan.ts`,
- sus propios componentes y pruebas.

## Ficheros que NO puede tocar
`lib/panel/nav.ts`, `lib/panel/tipos.ts`, `lib/panel/nav.invitados.ts` y `nav.compartir.ts` (E2), y
`lib/env.ts` — si necesita otra variable de entorno, se pide al orquestador: el catálogo es una
lista cerrada.

## Notas del andamio
- La clave publicable de Stripe se lee con `lib/env.ts`
  (`clavePublicableDeStripeDelEntorno()` / `pagoEnLineaDisponible()`), nunca con `process.env` suelto:
  ahí está la validación que impide publicar por error una clave secreta.
- Sin clave configurada NO se pinta ningún botón de pago; la pantalla lo dice. Nunca un botón muerto.
- Marcador estático: sin `loading.tsx` ni `error.tsx` hasta que haya datos de verdad.
