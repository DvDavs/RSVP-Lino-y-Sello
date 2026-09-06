# 3C-UX → orquestador · recorrido de UX sin instrucciones (cierre de la fase 3-C)

Worktree `wt/ux` desde `1a81b7e`. Sin commit ni push. Backend 6110 (`invitaciones_ux`) y web 3110
levantados y parados; sin procesos vivos. Detalle y narración: `bitacora/3c-ux.md`. Capturas: **64**
en `evidencia/fase-3c/cierre/ux/` (`m*` = 390×844, `e*` = 1440×900).

## 1. Veredicto
**No, una clienta no completa el flujo sin instrucciones.** Dos muros terminales antes de tocar el
editor. A partir del segundo evalúo con una llave maestra (fila de `invitation` insertada por SQL,
que es lo único que hay: ADR-2-4-02 dice que no existe ruta HTTP). Del editor en adelante el producto
es bueno: guardado automático evidente, fecha editable, paleta con nombres humanos, publicación
revisada, enlace real y WhatsApp.

## 2. Qué está cerrado (verificado, no leído)
- **UX-N-01 cerrada**: `/` → 200, portada en `es-MX`, cero desbordamiento a 390 y 1440.
- **UX-N-02 cerrada por partida doble**: paso 2 «Solo plantillas de XV años», 1 resultado (XV
  Jardín), sin «Boda clásica»; y el editor resultante trae «La quinceañera» / «Mis papás y padrinos»,
  ninguna sección de boda.
- **UX-N-03 cerrada en lo esencial**: la política de contraseñas ya no sale en «Entrar». Arista nueva
  (M-12): la contraseña que no cumple la política responde «Algo salió mal» en vez del mensaje bueno.
- Cerradas también de la fase 3: existe `/acceso` (antes no había pantalla de acceso), el enlace
  público ya no dice `localhost`, la fecha del evento se cambia desde la Portada, el pie «JPG, PNG o
  WebP · hasta 8 MB» está en «Elegir foto», las vistas previas del catálogo cargan, y el editor a
  390 px no desborda.

## 3. Lo que corregí yo (todo con las compuertas en verde)
| Qué | Archivo | Efecto medido |
|---|---|---|
| Insignia «El de tu invitación» → **«Tu evento»** | `apps/web/lib/i18n.ts` (`asistente.evento.tuTipo`) | 390 px: `scrollW 421→390`, `innerW 421→390`; la barra de acción vuelve dentro de la pantalla (`top 853`→`788`) y los toques dejan de caer en la tarjeta de al lado |
| Paso 4 muestra el nombre de marca y no el `slug` | `apps/web/components/asistente/AsistenteDeCreacion.tsx` (nueva `nombreDePlantilla`) | «plantilla «xv-jardin»» → «plantilla «XV Jardín»» |
| Panel de publicado: tercera frase redundante → qué pasa después | `apps/web/lib/i18n.ts` (`publicar.descripcionExito`) | «Comparte el enlace… Puedes seguir editando y volver a publicar cuando quieras.» |

Pruebas ajustadas: `PasoTipoEvento.test.tsx:48`, `AsistenteDeCreacion.test.tsx:257`,
`e2e/asistente.spec.ts:68`.
**Compuertas con salida real**: `test` **10/10 (web 517/517, ui 654, sections 653, schema 527, icons
179, tokens 55)** · `typecheck` **10/10** · `lint` **6/6, 0 errores, 1 aviso preexistente ajeno** ·
`build` verde.

## 4. Lo que NO toqué (con archivo:línea)
1. **G-01 · no hay forma de comprar.** `/` «Empezar mi invitación» → `/acceso` → asistente «Todavía
   no tienes invitaciones… [Ver planes]» (`components/asistente/MisInvitaciones.tsx:14`,
   `AYUDA_PLANES = "/ayuda#planes"`) → preguntas frecuentes sin precio y sin contacto. Ni teléfono,
   ni correo, ni WhatsApp en todo el sitio. Decisión de producto, no de código.
2. **G-02 · asistente inservible con la cuenta ya provista de plantilla.** Paso 1 con la pregunta y
   cero respuestas y «Continuar» inhabilitado; `?tipo=` de la portada se ignora.
   `components/asistente/AsistenteDeCreacion.tsx` (rama `todasConPlantilla`, ~línea 456).
3. **G-03 · el campo «¿Dónde?» del paso 3 rompe el guardado en TODA invitación nueva.**
   `POST …/document/operations` → `422 TPL_ITEM_UNKNOWN` en `event.cards[<itemId de defaults>]`. El
   `itemId` sale del compuesto (`components/asistente/datos-basicos.ts:157`), pero un documento recién
   creado tiene `content` vacío y `setItemBlock` no acepta un ítem que solo existe en los *defaults*.
   Además el aviso miente: dice «Puedes continuar» y «Continuar» no continúa
   (`apps/web/lib/i18n.ts`, `asistente.datos.errorGuardado`). Necesita decisión de contrato
   (materializar el grupo, o `setItemBlock` que cree el ítem, o que el asistente use `addItem`).
4. **G-04 · se publica con dos fechas distintas sin aviso.** El guardián existe
   (`apps/web/lib/i18n.ts`, `publicar.avisoFechasDistintas`) pero compara contra el documento y la
   fecha del itinerario que ve el invitado viene de los *defaults*.
5. **G-05 · se publica con «Nombre de la mamá» / «Nombre del papá» y secciones vacías con título.**
   La revisión previa solo marcó el texto de ejemplo de la portada.
6. **G-06 · el enlace público desaparece al cerrar el panel.** «Mis invitaciones»
   (`components/asistente/MisInvitaciones.tsx`) no muestra estado «publicada» ni enlace, y reabrir
   «Publicar» enseña otra vez la pantalla de pre-publicación.
7. Medias y bajas M-08…B-20: tabla completa en `bitacora/3c-ux.md §4`.

## 5. Arranque: dos trampas que cuestan una hora
1. `pnpm --filter web run build` **no** corre el `build` de `@invitaciones/ui`
   (`packages/ui/scripts/copiar-fuentes-publicas.ts`), así que `apps/web/public/fonts/*.woff2` no
   existen y el sitio sirve **404 en las tres voces tipográficas**, cayendo a las fuentes del sistema
   sin ningún error visible. Usa `pnpm run build` desde `frontend/`.
2. Con el backend fuera del 6003 hay que exportar **también** `NEXT_PUBLIC_CDN_ORIGIN`: la CSP del
   lienzo se arma en `apps/web/proxy.ts:107` (`img-src … 127.0.0.1:6003`) y bloquea todas las
   imágenes de la vista previa del editor. `apps/web/next.config.ts:55` fija además el 6003 en
   `images.remotePatterns` sin variable de entorno que lo cambie.

## 6. Qué falta
Foto de más de 8 MB y RSVP del invitado: no probados, se acabó el presupuesto de contexto. Todo lo
demás del encargo está recorrido en móvil y en escritorio.

## Correcciones UX-A
`wt/ux-a` cerró **G-02**, **G-03** y la mitad de **G-06** que vive en `MisInvitaciones.tsx` (detalle
y cifras en `bitacora/3c-ux-a.md`). G-03: el paso 3 materializa con `addItem` un grupo que solo vive
en los *defaults* en vez de mandar `setItemBlock` contra un `itemId` que el servidor no conoce
(`422 TPL_ITEM_UNKNOWN`); mismo defecto reproducido y documentado, sin corregir, en
`components/editor/GroupField.tsx`+`lib/store.ts` (`preguntas-abiertas.md § UX-A`). Compuertas con
salida real: `test` 64 ficheros/531 pruebas en verde, `typecheck` 0 errores, e2e reales `:6113`/
`:3113` `asistente.spec.ts` 7/7 + `clienta-sin-sesion.spec.ts` 1/1. **G-01, G-04, G-05** y la otra
mitad de G-06 (panel de publicar) siguen abiertos. Sin commit ni push.
## Correcciones UX-C
Cierra G-01 y M-12 de este handoff. `ContactoParaContratar` (nuevo, `lib/contacto.ts` +
`components/sitio/ContactoParaContratar.tsx`) puesto en `Planes.tsx` y `ayuda/page.tsx`: dos
variables de entorno opcionales (`NEXT_PUBLIC_CONTACTO_WHATSAPP`, `NEXT_PUBLIC_CONTACTO_CORREO`);
sin configurar, la frase es honesta y no hay botón muerto. El ancla real de `/ayuda#planes` ahora
responde «¿Cuánto cuesta y cómo contrato un plan?» (antes era la duda de cambiar de plan).
M-12: contraseña que no cumple la política en «Entrar» → mensaje de credenciales, no «Algo salió
mal»; en «Crear cuenta» se pinta el mensaje del propio servidor (`@StrongPassword`), saneado por
`soloTexto()`. Verificado con salida real: `test` 536/536, `typecheck` limpio, `build` verde,
`check-budget` en presupuesto (`/` 148,2/150 KB gz), e2e 14/14 contra backend propio. Detalle y las
dos trampas de arranque encontradas en `bitacora/3c-ux-c.md`. Pendiente de decisión del dueño: el
WhatsApp/correo reales y si hay compra en línea (`preguntas-abiertas.md § Fase 3-C · UX-C`).
