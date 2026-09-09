# `/contacto` — sesión **E3** (cuenta, marca y legal)

**Esto es un marcador del andamio 5-0d y se sustituye ENTERO.** Hoy no lee nada y no llama al backend.

## Qué pantalla va aquí
Los medios de contacto de Lino & Sello: WhatsApp click-to-chat y correo. Sin API de Meta (`D-04` de
`memoria/decisiones-dueno.md`): un enlace `https://wa.me/<numero>?text=<mensaje>` y un `mailto:`.

## De dónde salen el número y el correo
De `lib/contacto.ts`, que YA existe y ya está probado, leyendo `NEXT_PUBLIC_CONTACTO_WHATSAPP` y
`NEXT_PUBLIC_CONTACTO_CORREO`. **No dupliques esa lógica**: `lib/env.ts` la reexporta como catálogo,
pero la fuente sigue siendo `contacto.ts`.
Regla que viene de `G-01` (`bitacora/3c-ux.md §4`) y que esta pantalla hereda: **si no hay ningún
canal configurado, la interfaz lo dice honestamente en vez de pintar un botón muerto.** El caso ya
está resuelto en `ContactoParaContratar`; reutilízalo o síguelo.

## Ficheros que E3 puede tocar desde aquí
- esta carpeta, `app/(chrome)/(sitio)/legal/**`, `app/(chrome)/perfil/**`,
- `lib/contacto.ts` y `lib/env.ts` (es la sesión dueña del catálogo de entorno a partir de ahora),
- `robots.ts` / `sitemap.ts` cuando los cree (hoy NO existen: los crea E3, ver `/r/[token]/README.md`),
- sus propios componentes y sus pruebas.

## Ficheros que NO puede tocar
`lib/panel/**` salvo para leer, y las carpetas de E2, E4 y E5.

## Notas del andamio
- Grupo `(sitio)`, por eso `contenedor="div"`.
- Las direcciones y el número los fija `decisiones-dueno.md` `D-03` y `D-04`. No los escribas en el
  código: van por variable de entorno.
