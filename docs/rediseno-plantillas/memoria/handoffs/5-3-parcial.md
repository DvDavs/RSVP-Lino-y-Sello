# 5-3 · Compartir — handoff parcial (agente E2-E)

## Terminado y verificado
- `lib/panel/nav.compartir.ts`: `href` ahora `/editor/${id}/invitados` (antes `/editor/${id}`),
  KDoc actualizado. `visible: estado.publicada` sin tocar. `nav.test.ts` sigue en verde.
- `components/invitados/CompartirInvitacion.tsx` (nuevo): bloque de compartir LA INVITACIÓN en
  general. Estados `cargando|publicada|no-publicada|error`, fuente: `getDocument()`
  (`lib/api-client.ts`, reutilizado, mismo criterio que `asistente/invitaciones.ts`:
  `publicada = activeRelease !== null`). Enlace con `enlacePublico()` (`lib/enlace-publico.ts`,
  reutilizado, no tocado). Publicada: copiar enlace, WhatsApp click-to-chat (`https://wa.me/?text=`,
  sin número, D-04), mensaje para redes copiable. Sin publicar: texto qué falta + enlace al editor,
  sin prometer un enlace roto (U-6). `TPL_DOCUMENT_NOT_STARTED` se trata como «no publicada», no
  como error de red.
- Integrado en `components/invitados/PantallaInvitados.tsx` (import + render bajo el subtítulo).
- Textos es-MX nuevos en `lib/invitados/textos.ts` → `compartirGeneral` (título, descripción,
  estados, mensaje de WhatsApp/redes). Nada de literales sueltos en el JSX.
- Pruebas nuevas: `components/invitados/CompartirInvitacion.test.tsx` (8 casos: oculto sin publicar,
  `TPL_DOCUMENT_NOT_STARTED` ≠ error, error real + reintentar, enlace = ayudante compartido, copiar
  enlace, WhatsApp bien codificado, mensaje de redes copiable, sin datos personales).
- `PantallaInvitados.test.tsx`: añadido `beforeEach` que mockea `getDocument` a «no publicada» —
  sin él, el bloque nuevo cae a su propio estado de error (sin mock) y duplica el texto
  «Reintentar» que ya usan las pruebas existentes de la lista. Con el mock, sigue en verde.

## Verificado con salida real
- `cd frontend && pnpm --filter web run test` → **716 passed, 1 failed** (el único rojo permitido,
  `components/sitio/portada.test.tsx`, ajeno, sin tocar). Antes: 708 en verde. Ahora 716 en verde
  (+8, todas mías). No bajó de la referencia.
- `pnpm -r run typecheck` → los 6 paquetes en `Done`, sin errores.
- `npx vitest run test/tokens-no-leak.test.ts` → 2 passed.
- `grep` de emojis (script Python con rangos Unicode) y de hex sueltos (`#[0-9a-fA-F]{3,8}`) sobre
  todos los ficheros tocados → sin resultados.

## Pendiente (bloque 3 del encargo)
- Repasar los textos es-MX de las superficies de compartir POR INVITADO que ya existían
  (`components/invitados/AccionesInvitado.tsx`, `lib/invitados/textos.ts` → `compartir.*`): cálidos,
  breves, de tú, sin exclamaciones de más. Hoy están bien pero no se han revisado línea por línea
  con ese criterio explícito — es el paso que falta antes de entregar.
- Reporte final (≤15 líneas) con los textos citados literalmente.

## Cómo verificar
```
cd /home/user/RSVP-Lino-y-Sello/frontend
pnpm --filter web run test
pnpm -r run typecheck
```
