# Issues de la fase 3 — I-01…I-12, TODAS CERRADAS en la fase 3-B (2026-09-05)

Rama de cierre `claude/fase-3b-cierre-orquestacion-z0pd4g`. Orden = por daño.
**A** = necesitaba decisión del dueño · **T** = trabajo técnico ya diagnosticado.

> **Estado al cierre.** Las doce issues están cerradas, cada una con la prueba que lo demuestra y
> **verificada por el orquestador ejecutándola**, no por el reporte de su sub-agente. En la mayoría
> se saboteó el arreglo para ver la compuerta en rojo antes de darla por buena.
>
> **La fase 3, en cambio, NO queda formalmente cerrada**: la revisión adversarial repetida encontró
> **dos altas nuevas** (`handoffs/3b-adv.md`), y una de ellas —**N-01**, toma de cuenta completa por
> `POST /auth/request-password-reset`— vive en `modules/auth`, área que el dueño acotó a I-02 con un
> «NO tocar nada más». Necesita su autorización expresa. Detalle y arreglo propuesto en
> `preguntas-abiertas.md`.

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

> **CERRADA** en `13adea3 · merge 3b2a7aa`. Prueba que lo demuestra: sabotear `o.set<ObjectNode>` devuelve 9 fallos con `ClassCastException` en `OperationReducerGoldenTest.kt:67` y `:132`; restaurado, verde. Y por HTTP: el mismo `POST` con `marks:["bold"]` pasa de `500 TPL_INTERNAL` a `200 applied=true` (`evidencia/fase-3/i01-http-antes-despues.txt`).

## I-02 · ALTA · **A** · La pantalla de acceso expone enumeración de cuentas
`/acceso` (nueva en esta fase) da puerta pública a `/auth/token`, que **no limita intentos**
(12 fallos seguidos, ninguno bloqueado) y tiene un **oráculo de temporización de ≈22×**:
correo inexistente 3,8-4,8 ms · correo existente con contraseña mala 86,7-91,2 ms, sin solape.
El texto del error sí es idéntico. **Arreglo**: limitar por cuenta y por IP, y ejecutar el
hash también cuando el usuario no existe (hash señuelo) para igualar tiempos.
**La fase 3 no creó el fallo, le construyó el portal.** Vive en el módulo `auth` heredado:
**necesita dueño asignado**.

> **CERRADA** en `505ad41 + c7cc738 · merge 6da890c`. Prueba que lo demuestra: oráculo con el mismo método y N=30: **15,0× → 1,01×** con solape total (`evidencia/fase-3/i02-oraculo-antes-despues.txt`); `429` en el 6.º fallo con cuerpos idénticos; y el salto por `X-Forwarded-For` que encontró la adversarial, cerrado: 25 intentos rotando la cabecera pasan de 25 `401` a `429` desde el 21.º.

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

> **CERRADA** en `cf5e285 · merge afe9d2f`. Prueba que lo demuestra: comentando el `import "./canvas-runtime.ts"` de `common.ts` la compuerta da `2 failed / 1 passed`; restaurada, `3 passed`. El `eval` de Zod queda cerrado **sin tocar la CSP**.

## I-04 · ALTA · **T** · `smoke.sh` mide 10/19 y su evidencia ya no es cierta
`handoffs/3-0a.md` afirma «19/19 rutas OK». Hoy da **10/19 con 14 fallidas** (verificado por el
orquestador). Causa: `smoke.sh:144,151,246` suben `.png` y `ADR-3-2d-02` pasó el arte a WebP.
Corrigiendo la extensión llega a 17/19; falta subir los **tres** assets en la ruta 17 (hoy sube
1 y el manifiesto declara 3 → `422`) y hacer la 19 independiente del orden (`409`).
**Arreglo**: actualizar el script, regenerar `evidencia/fase-3/bloque-0/smoke.txt` y corregir
la tabla de `handoffs/3-0a.md §2`, que sigue diciendo `preview.png`.

> **CERRADA** en `346eef5 · merge 75db41c`. Prueba que lo demuestra: `19/19 OK · 0 fallidas · exit 0`, verificado por el orquestador en una tercera corrida independiente; el antes era 10/19.

## I-05 · ALTA · **T** · Verificar que WCAG quedó cumplida de verdad
La adversarial midió el `<h2>` del RSVP en **2,66:1** (umbral 3,0) y 8 de 12 títulos en la
tipografía de cuerpo, **con `axe` en 0 violaciones** porque lo deja en `incomplete` por el
degradado. El merge de 3-9 dice haberlo corregido, pero **su pasada de verificación no llegó a
correr**. **Hay que medir**: ratio del `<h2>` del RSVP y familia resuelta de los 12 títulos,
sobre la invitación publicada. Y añadir el caso a `test/theme/contraste-plantillas.test.ts`,
que hoy solo compara parejas de tokens, no combinaciones renderizadas.

> **CERRADA** en `a6682f8 · merge 6effb78`. Prueba que lo demuestra: devolver el velo del RSVP a 55 % tumba 5 pruebas, una por paleta, con el ratio compuesto real (3,15–3,47:1 contra el 4,5 que exige WCAG 1.4.3).


## I-05b · ALTA · **T** · La portada no garantiza contraste sobre la foto de la clienta
Encargo del dueño **tras** cerrar I-05, al ver que el agujero que I-05 dejó anotado en
`CoverSection .scrim` era la misma clase de defecto. `cover.image` es contenido de la clienta —sube
su propia foto—, así que el peor caso no es la lámina del paquete sino **cualquier fotografía**.

> **CERRADA** en `a10ece1 · merge 037d4fe`. Prueba que lo demuestra: quitar el papel opaco de la
> portada tumba **39** pruebas; el peor caso real era `muted` a **1,74:1** sobre foto negra, no el
> 4,13 que estaba anotado. Subir el lavado quedó descartado por aritmética: para llegar a 4,5:1
> haría falta un 98,6–99 %, es decir A1 con el signo cambiado. A1 no regresa, y está medido: la
> tinta del arte se conserva al 93,4 % en móvil y al 100 % en escritorio.
## I-06 · ALTA · **A** · La clienta no puede cambiar la fecha de su boda
Ninguna ruta de cliente escribe `invitation.date`; solo existe la de administración
(`InvitationAdminService.kt:414`). El editor ya explica dónde se cambia, pero el destino no
existe para ella. Es el tercer verbo del criterio de terminado. **Hueco de backend fuera del
alcance de esta fase: necesita dueño.**

> **CERRADA** en `acb111c · merge dc27345`. Prueba que lo demuestra: 16 pruebas de contrato sobre Postgres real (positivo, otro dueño `403`, nueve de formato inválido) y e2e `cambiar-fecha.spec.ts`; `curl` real cambia la fecha y **sólo** las columnas `date`/`time`.

## I-07 · MEDIA · **A** · El webhook de invalidación sigue desactivado
El editor ya invalida y **espera** antes de decir «ya se puede ver», pero el backend no llama a
`/api/revalidate` porque faltan `templates2.revalidate.url` y `.token` en `application.yml`
(área prohibida). Sin ellas, tras publicar el invitado puede ver la versión anterior hasta
300 s. **Es configuración, no código.**

> **CERRADA** en `5eca1fb · merge 707e15b`. Prueba que lo demuestra: la issue estaba mal diagnosticada («es configuración, no código»): las dos claves ya estaban desde 2-6. El defecto real era que `HttpClient` prefiere HTTP/2 y Next.js cierra la conexión; con `.version(HTTP_1_1)` el invitado ve lo nuevo en **t+0 s** en vez de esperar hasta 300.

## I-08 · MEDIA · **T** · Crear una plantilla sigue siendo escribir JSON a mano
Añadir una plantilla **no toca Kotlin ni recompila el frontend**: 3 JSON + imágenes y un
comando (`scripts/dev-backend.sh register <dir>`), idempotente y validado. Pero son ~830
líneas de JSON para 9 secciones, así que hoy **solo lo puede hacer un programador**. El kit de
autor es de la fase 4. **Sugerencia para la fase 4**: empezar creando una plantilla mínima
real (5-6 secciones) y cronometrarla, para medir el coste en vez de estimarlo.

> **MEDIDA (no era un defecto)** en `8d8efb0`. Prueba que lo demuestra: plantilla mínima de 5 secciones escrita a mano y registrada por HTTP sin tocar Kotlin: **106 líneas**, **4 intentos**, 7 min 29 s. Los tres primeros `422` son de vocabulario cerrado, no de volumen (`evidencia/fase-3/i08-plantilla-minima/`).

## I-09 · ALTA · **A+T** · Una plantilla no puede referenciar sus imágenes de demostración
`AssetEntry` (`manifest.ts:45-50`) no tiene campo de id y `TemplateRegistrationService.kt:104`
acuña `"as_" + ulid.next()` en el registro, así que un `assetId` escrito en `defaults.json` no
resuelve: `cover.image` sale `provenance:"empty"` y `canPublish:false`. Peor: `rsvp.background`
es `fixed` y queda **inalcanzable por cualquier vía** (`422 TPL_BLOCK_NOT_EDITABLE`).
Parche mínimo propuesto (~11 líneas, alias en el `AssetIndex`, sin tocar la base de datos) en
`bitacora/3-2d.md §5.4`. Hoy se rodea sembrando la demostración por la API real.

> **CERRADA** en `dafe12b · merge 3d5c094`. Prueba que lo demuestra: sin el arreglo, 5 fallos Kotlin y 2 TS; con él, 13/13 y 10/10. En vivo: la invitación sembrada pasa de **13 a 14 imágenes** y `rsvp.background` resuelve con `provenance:"fixed"`.

## I-10 · MEDIA · **T** · Cierre formal de la memoria, sin hacer
Todas las ADR de la fase 3 siguen en estado *propuesta*. Falta aceptarlas o rechazarlas,
añadir `contratos.md §12`, actualizar `tablero.md` y `00-INDICE.md`, y escribir
`handoffs/3-para-fase-4.md`.

> **CERRADA** en `este commit`. Prueba que lo demuestra: 69 ADR resueltas con motivo, `contratos.md §12`, `tablero.md`, `00-INDICE.md`, preguntas agrupadas y `handoffs/3-para-fase-4.md`.

## I-11 · BAJA · **T** · Protocolo de medición del LCP
La métrica con `simulate` es **bimodal** (15 corridas del mismo build: 11 en 2,0-2,3 s y 4 en
3,2-3,3 s). Las corridas `NO_LCP` sesgan la mediana **a la baja**, y si otra sesión ocupa el
puerto 3000, `next start` muere y **LHCI mide una aplicación ajena**. Fijar el procedimiento
(comprobar el puerto, N corridas, descartar `NO_LCP`) para que no vuelva a haber dos medidas
contradictorias.

> **CERRADA** en `f46b173 · merge 4f4c57a`. Prueba que lo demuestra: con un puerto ajeno el script **se niega a medir y sale con código 3**. Medida final con la máquina tranquila: mediana **2.241 ms**, rango 2.185–2.255, N=9, 0 descartadas.

## I-12 · BAJA · **T** · Trabajo rescatado sin integrar
`claude/fase-3-wip-3-10` — I-01, I-03 e I-04 en curso, **sin commits propios**; el WIP rescata
15 archivos sueltos. `claude/fase-3-wip-3-9` — ya integrado en la rama principal; su rama
conserva 88 archivos sueltos (recapturas a medias) por si hicieran falta.

> **CERRADA** en `fe512fb`. Prueba que lo demuestra: los 15 ficheros de `23ac378` contabilizados: 14 integrados por la vía de su issue y **1 rechazado con motivo** (relajaba una aserción de contrato que la rama conserva estricta).

