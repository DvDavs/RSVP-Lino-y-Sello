# Issues abiertas al cerrar la sesión de la fase 3 (2026-09-05)

Rama `claude/fase-3-frontend-orchestration-yuh8sx`. Orden = por daño.
**A** = necesita decisión del dueño · **T** = trabajo técnico ya diagnosticado.

## I-01 · ALTA · **A+T** · Negrita y cursiva devuelven `500`
Poner **negrita** o *cursiva* en cualquier campo de texto enriquecido rompe el guardado.
`DomainJson.kt:291` hace `o.set<ArrayNode>("marks", arr)`; `ObjectNode.set()` devuelve `this`
y, por ser el retorno del lambda, Kotlin inserta un `CHECKCAST` a `ArrayNode` →
`ClassCastException` → `500 TPL_INTERNAL`. El mismo cuerpo sin `marks` responde `200`.
**Arreglo**: `o.set<ObjectNode>(…)` o cerrar el lambda con `Unit` (una línea).
**Lo importante**: 2 390 pruebas no lo veían porque `marks` solo aparece en
`golden/blocks/richText.cases.json`, un fichero de casos de **esquema** que nunca pasa por
`DomainJson.encode`. Hay que añadir un golden de **documento** con `marks` y un caso de
reductor. **Requiere autorización**: es `modules/templates2`, área prohibida, y sería la
**segunda** excepción de la fase (la primera fue exponer `manifest`+`theme`).

## I-02 · ALTA · **A** · La pantalla de acceso expone enumeración de cuentas
`/acceso` (nueva en esta fase) da puerta pública a `/auth/token`, que **no limita intentos**
(12 fallos seguidos, ninguno bloqueado) y tiene un **oráculo de temporización de ≈22×**:
correo inexistente 3,8-4,8 ms · correo existente con contraseña mala 86,7-91,2 ms, sin solape.
El texto del error sí es idéntico. **Arreglo**: limitar por cuenta y por IP, y ejecutar el
hash también cuando el usuario no existe (hash señuelo) para igualar tiempos.
**La fase 3 no creó el fallo, le construyó el portal.** Vive en el módulo `auth` heredado:
**necesita dueño asignado**.

## I-03 · ALTA · **T** · La compuerta de la CSP no puede ponerse en roja
La única aserción sobre `script-src` en `e2e/lienzo-csp.spec.ts` es un `console.warn`: el spec
da `1 passed` mientras imprime que la política está abierta, y dentro del iframe
`window.__cspViolations = ["script-src | eval"]`. Con ella verde, **el criterio A4 (cero
`securitypolicyviolation`), una de las cinco condiciones obligatorias de ADR-1R-F-02 y del
contrato §8, NO se cumple en `apps/web`** — `ADR-3-0b-01` lo midió sobre `spikes/canvas-gate`.
**Arreglo**: afirmar con `expect`, sabotear para probar el rojo, y cerrar el `eval` de Zod
(`jitless` no surte efecto aquí; sospecha: segunda copia de `zod`). **No aflojar la CSP.**
Si no se puede cerrar, enmendar `ADR-3-0b-01` para que diga que A4 vale en el spike y no en
el producto.

## I-04 · ALTA · **T** · `smoke.sh` mide 10/19 y su evidencia ya no es cierta
`handoffs/3-0a.md` afirma «19/19 rutas OK». Hoy da **10/19 con 14 fallidas** (verificado por el
orquestador). Causa: `smoke.sh:144,151,246` suben `.png` y `ADR-3-2d-02` pasó el arte a WebP.
Corrigiendo la extensión llega a 17/19; falta subir los **tres** assets en la ruta 17 (hoy sube
1 y el manifiesto declara 3 → `422`) y hacer la 19 independiente del orden (`409`).
**Arreglo**: actualizar el script, regenerar `evidencia/fase-3/bloque-0/smoke.txt` y corregir
la tabla de `handoffs/3-0a.md §2`, que sigue diciendo `preview.png`.

## I-05 · ALTA · **T** · Verificar que WCAG quedó cumplida de verdad
La adversarial midió el `<h2>` del RSVP en **2,66:1** (umbral 3,0) y 8 de 12 títulos en la
tipografía de cuerpo, **con `axe` en 0 violaciones** porque lo deja en `incomplete` por el
degradado. El merge de 3-9 dice haberlo corregido, pero **su pasada de verificación no llegó a
correr**. **Hay que medir**: ratio del `<h2>` del RSVP y familia resuelta de los 12 títulos,
sobre la invitación publicada. Y añadir el caso a `test/theme/contraste-plantillas.test.ts`,
que hoy solo compara parejas de tokens, no combinaciones renderizadas.

## I-06 · ALTA · **A** · La clienta no puede cambiar la fecha de su boda
Ninguna ruta de cliente escribe `invitation.date`; solo existe la de administración
(`InvitationAdminService.kt:414`). El editor ya explica dónde se cambia, pero el destino no
existe para ella. Es el tercer verbo del criterio de terminado. **Hueco de backend fuera del
alcance de esta fase: necesita dueño.**

## I-07 · MEDIA · **A** · El webhook de invalidación sigue desactivado
El editor ya invalida y **espera** antes de decir «ya se puede ver», pero el backend no llama a
`/api/revalidate` porque faltan `templates2.revalidate.url` y `.token` en `application.yml`
(área prohibida). Sin ellas, tras publicar el invitado puede ver la versión anterior hasta
300 s. **Es configuración, no código.**

## I-08 · MEDIA · **T** · Crear una plantilla sigue siendo escribir JSON a mano
Añadir una plantilla **no toca Kotlin ni recompila el frontend**: 3 JSON + imágenes y un
comando (`scripts/dev-backend.sh register <dir>`), idempotente y validado. Pero son ~830
líneas de JSON para 9 secciones, así que hoy **solo lo puede hacer un programador**. El kit de
autor es de la fase 4. **Sugerencia para la fase 4**: empezar creando una plantilla mínima
real (5-6 secciones) y cronometrarla, para medir el coste en vez de estimarlo.

## I-09 · ALTA · **A+T** · Una plantilla no puede referenciar sus imágenes de demostración
`AssetEntry` (`manifest.ts:45-50`) no tiene campo de id y `TemplateRegistrationService.kt:104`
acuña `"as_" + ulid.next()` en el registro, así que un `assetId` escrito en `defaults.json` no
resuelve: `cover.image` sale `provenance:"empty"` y `canPublish:false`. Peor: `rsvp.background`
es `fixed` y queda **inalcanzable por cualquier vía** (`422 TPL_BLOCK_NOT_EDITABLE`).
Parche mínimo propuesto (~11 líneas, alias en el `AssetIndex`, sin tocar la base de datos) en
`bitacora/3-2d.md §5.4`. Hoy se rodea sembrando la demostración por la API real.

## I-10 · MEDIA · **T** · Cierre formal de la memoria, sin hacer
Todas las ADR de la fase 3 siguen en estado *propuesta*. Falta aceptarlas o rechazarlas,
añadir `contratos.md §12`, actualizar `tablero.md` y `00-INDICE.md`, y escribir
`handoffs/3-para-fase-4.md`.

## I-11 · BAJA · **T** · Protocolo de medición del LCP
La métrica con `simulate` es **bimodal** (15 corridas del mismo build: 11 en 2,0-2,3 s y 4 en
3,2-3,3 s). Las corridas `NO_LCP` sesgan la mediana **a la baja**, y si otra sesión ocupa el
puerto 3000, `next start` muere y **LHCI mide una aplicación ajena**. Fijar el procedimiento
(comprobar el puerto, N corridas, descartar `NO_LCP`) para que no vuelva a haber dos medidas
contradictorias.

## I-12 · BAJA · **T** · Trabajo rescatado sin integrar
`claude/fase-3-wip-3-10` — I-01, I-03 e I-04 en curso, **sin commits propios**; el WIP rescata
15 archivos sueltos. `claude/fase-3-wip-3-9` — ya integrado en la rama principal; su rama
conserva 88 archivos sueltos (recapturas a medias) por si hicieran falta.
