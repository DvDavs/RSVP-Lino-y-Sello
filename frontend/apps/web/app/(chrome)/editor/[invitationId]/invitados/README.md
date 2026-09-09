# `/editor/[invitationId]/invitados` — sesión **E2** (invitados · RSVP · compartir)

**Esto es un marcador del andamio 5-0d y se sustituye ENTERO.** Hoy no lee nada, no llama al
backend y no enseña ningún dato.

## Qué pantalla va aquí
La lista de invitados de una invitación: alta manual y por importación, grupos/mesas, estado de cada
uno (confirmado, no puede ir, sin contestar) y el reenvío del enlace. Es la pantalla a la que apunta
la entrada «Invitados» del registro de navegación del panel (`lib/panel/nav.invitados.ts`).

## Backend que consume
`modules/product/guests` (subpaquete nuevo de esta sesión) apoyado en los endpoints heredados de
`modules/shared/guests` y `modules/all/**` que 5-0b-A marcó como reutilizables o endurecibles, con el
token de sesión que ya guarda `lib/api-client.ts`. **No** `modules/templates2`, que es el módulo del
documento de la invitación y no sabe nada de invitados; y **nunca** el módulo antiguo
(`modules/user/invitations`), prohibido hasta que se retire en la fase 7.

## Ficheros que E2 puede tocar desde aquí
- esta carpeta entera (`page.tsx`, y los `loading.tsx` / `error.tsx` / `not-found.tsx` que añada),
- `lib/panel/nav.invitados.ts` y `lib/panel/nav.compartir.ts` (sus dos entradas del registro),
- sus propios componentes y sus pruebas.

## Ficheros que NO puede tocar
`lib/panel/nav.ts` y `lib/panel/tipos.ts` (compositor compartido), `lib/panel/nav.plan.ts` (E4),
`lib/env.ts`, y el `layout.tsx` / `page.tsx` del editor, que son de otra fase.

## Notas del andamio
- El marcador es estático a propósito: sin datos no hay nada que suspender ni que fallar, así que no
  trae `loading.tsx` ni `error.tsx` (un `error.tsx` es `"use client"` y pesa en el JS de la ruta).
  Los añade E2 con la pantalla real.
- `layout.tsx` del padre ya rechaza con 404 un `invitationId` que no sea numérico.
- La cobertura de `axe` de esta pantalla entra en `e2e/a11y-producto.spec.ts` cuando exista de
  verdad; el marcador no se añade ahí.
