# I-08 · cuánto cuesta hoy añadir una plantilla — MEDIDO, no estimado

Dato pedido por el prompt de la fase 3-B para el handoff de la fase 4. Lo midió el **orquestador**
escribiendo a mano una plantilla mínima de 5 secciones y registrándola por HTTP contra el backend
real (`127.0.0.1:6003`), sin tocar Kotlin y sin recompilar nada.

## Resultado

| | |
|---|---|
| **Tiempo de reloj, de la primera línea al `201`** | **7 min 29 s** |
| Líneas de JSON | **106** (template 83 · theme 10 · defaults 13) |
| Secciones · bloques | 5 · 11 |
| Assets | 1 (`preview.webp`, obligatorio: lo exige `previewImage`) |
| **Intentos de registro hasta el `201`** | **4** |

Comparación con las dos plantillas de producto: `xv-jardin` 828 líneas / 9 secciones ·
`boda-clasica` 1.667 líneas / 12 secciones. ⇒ ~92 líneas por sección, ~36 por bloque.

**Cautela sobre el cronómetro:** lo escribió un agente que ya tenía delante los dos paquetes de
producto para copiarles la forma. Un autor humano que empiece de cero tardará más; el dato
transferible no es el reloj, son los **cuatro intentos** y en qué falló cada uno.

## Los cuatro intentos, que son el dato de verdad

1. **`422 TPL_MANIFEST_INVALID`, 164 violaciones.** `role` es una **enumeración cerrada** de ~60
   valores (`packages/schema/src/blocks.ts:83`) y no hay forma de adivinarla: inventé
   `celebrantName`, `momentName` y `momentPlace`, y ninguno existe. Hay que leer el esquema.
2. **`422`, 58 violaciones.** El bloque `group` no lleva `constraints.minItems/maxItems` sino
   `min` / `max` / `reorderable` / `itemLabel` / `itemBlocks`, y su `role` sale de otra rama del
   `oneOf`. El mensaje dice *qué* propiedad sobra, pero no *cuál* de las ramas del `oneOf`
   pretendías: con 14 tipos de bloque, «0 are valid» obliga a comparar a mano contra un paquete que
   ya funcione.
3. **`422 TPL_PACKAGE_ASSET_MISMATCH`.** `previewImage` tiene que estar **entre los assets
   declarados**: no basta con nombrar el fichero, hay que declararlo con `path`, `sha256`,
   `contentType` y `bytes` exactos, y subirlo en el mismo multipart.
4. **`201 created`** · `templateVersionId=4` · `packageHash=sha256:4904fa37…` · `assetsRegistered=1`.

## Lectura para la fase 4

Lo que P4 promete se cumple: **añadir una plantilla no toca Kotlin ni recompila el frontend**, y el
registro es idempotente y validado. Pero las tres primeras respuestas son de esquema, y sólo se
resuelven **leyendo `packages/schema/src/blocks.ts`**. Lo caro no son las 106 líneas: es el
vocabulario cerrado —roles, tipos de bloque, forma exacta por rama del `oneOf`— que hoy no está
documentado en ningún sitio legible por un autor, y que el validador señala sin poder sugerir. Ese,
y no el volumen de JSON, es el problema que tiene que resolver el kit de autor.

Nota de estado: la versión registrada quedó **deprecada** al terminar la medición, para no alterar
el catálogo que usan las demás pruebas.
