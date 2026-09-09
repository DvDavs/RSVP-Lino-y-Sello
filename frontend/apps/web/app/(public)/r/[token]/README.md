# `/r/[token]` — sesión **E2** (invitados · RSVP · compartir)

**Esto es un marcador del andamio 5-0d y se sustituye ENTERO.** Hoy no mira el token, no llama al
backend y responde lo mismo para cualquier valor.

## Qué pantalla va aquí
El enlace personal de cada invitado. Es **la ruta que más gente va a abrir** del producto entero,
casi siempre en un móvil y desde un mensaje de WhatsApp. Enseña la invitación con la sección de RSVP
ligada a ESE invitado: su nombre, sus cupos, y confirmar o declinar, con derecho a cambiar de opinión.

## Por qué `/r/[token]` y no `/i/[publicToken]?g=<token>`
Decisión del orquestador de E1, desarrollada en `diseno/12-producto-completo.md`. En una cadena de
consulta el token del invitado viaja en el `Referer` hacia cualquier recurso externo que la página
cargue y se queda en los registros de los intermediarios con más facilidad; como segmento de ruta el
recorte es más fácil de razonar y la ruta es más corta de compartir. La ruta pública general
(`/i/[publicToken]`) sigue existiendo para quien no tiene enlace personal.

## Reglas de seguridad que E2 NO puede saltarse
1. **Tokens con entropía de verdad**, generados con un generador criptográfico. 5-0b-A inventarió
   cómo se generan hoy los del RSVP heredado: léelo antes de reutilizarlos.
2. **Respuesta indistinguible** para token inexistente, caducado y ya usado — como ya hace
   `/i/[publicToken]` con sus cinco casos (`not-found.tsx` de esa carpeta lo explica). Nada de
   «este enlace ya se usó» frente a «este enlace no existe»: eso es un oráculo de enumeración.
3. **Límite de intentos** por IP y por token.
4. **Cero datos de otros invitados.** La respuesta trae el invitado del token y nada más: ni la
   lista, ni los contadores del anfitrión, ni el correo o el teléfono de nadie.
5. **`noindex` en las tres capas** (layout de `(public)`, `metadata` de la página, `X-Robots-Tag` de
   `next.config.ts`). No lo quites.

## Presupuesto
Esta ruta hereda el trato de `/i/[publicToken]`: **no importa `lib/i18n.ts`** (sus textos viven en
`./textos.ts`) y no importa el barril `@invitaciones/ui`. Mide con `e2e/presupuesto.spec.ts` antes de
dar por buena la pantalla.

## Backend que consume
`modules/product/guests` (nuevo) apoyado en `modules/shared/guests` y `modules/all/**` heredados,
según la tabla de 5-0b-A. **Nunca** `modules/user/invitations` (prohibido, se retira en la fase 7).

## Ficheros que E2 puede tocar desde aquí
- esta carpeta entera, `app/(chrome)/editor/[invitationId]/invitados/**`,
- `lib/panel/nav.invitados.ts` y `lib/panel/nav.compartir.ts`,
- `src/main/kotlin/.../modules/product/guests/**` y sus pruebas,
- sus propios componentes y sus pruebas.

## Ficheros que NO puede tocar
`app/(public)/i/[publicToken]/**` (otra sesión), `lib/panel/nav.ts`, `lib/panel/tipos.ts`,
`e2e/preparar.ts`, `e2e/a11y-publico.spec.ts` y `e2e/editor-3c-evidencia.spec.ts` (los está aislando
la sesión del CI).

## Pendiente que NO es de esta carpeta
`robots.ts` y `sitemap.ts` todavía no existen en el proyecto. Los crea **E3**, y cuando lo haga tiene
que excluir `/r/**` y `/i/**`. Hasta entonces, las tres capas de `noindex` de arriba son la defensa.
