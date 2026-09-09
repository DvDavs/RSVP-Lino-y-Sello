# Glosario (semilla; se amplía por ADR)

- **Plantilla (template package)**: paquete versionado e inmutable (manifiesto + esquema de contenido + tokens/presets + valores por defecto + assets + migraciones). Identificada por `slug@semver`.
- **Tema (theme)**: elección de paleta y tipografía entre los presets de la plantilla. Solo ids, nunca CSS.
- **Estructura (structure)**: lista ordenada de secciones con `key` estable, `variant`, `visible`.
- **Sección**: unidad de página de la invitación (portada, padres, itinerario, galería, mesa de regalos, RSVP…).
- **Bloque**: unidad editable dentro de una sección, con id estable y rol explícito (p. ej. `parentsA`, `godparents`).
- **Contenido (content)**: lo que edita el cliente, por id de bloque. Nunca posicional.
- **Datos de negocio**: invitación, invitados, RSVP, itinerario en PostgreSQL; nunca dentro del documento.
- **Documento de invitación**: `{schemaVersion, template, theme, structure, content}` del cliente.
- **Composición**: función pura `componer(plantilla@v, contenido, datosDeNegocio) → documento renderizable`.
- **Release (InvitationRelease)**: copia inmutable publicada (documento + versión de plantilla + tema resuelto + hash).
- **Migración de documento**: función pura que lleva un documento de una versión de plantilla/esquema a otra.
- **Kit de autor**: herramientas para crear y validar una plantilla nueva sin tocar Kotlin.
- **Bloque (block)**: unidad editable dentro de una sección, con id estable (`blockId`) y rol explícito (p. ej. `parentA1`, `godparentA`). Catálogo cerrado de 14 tipos (`text`, `richText`, `listText`, `image`, `audio`, `date`, `time`, `dateTimeRange`, `link`, `location`, `choice`, `boolean`, `person`, `group`).
- **Grupo (group)**: bloque de tipo `group`, lista repetible de ítems (`itemId` ULID del servidor) cada uno con sus propios `itemBlocks` (ids cortos, relativos al grupo — nunca prefijados).
- **Rol (role)**: etiqueta semántica cerrada de un bloque (qué representa, no cómo se ve). Sustituye al emparejamiento por texto o posición que causaba H-01/H-02. El merge y la IA direccionan siempre por `blockId`/rol, nunca por índice.
- **Procedencia (provenance)**: de dónde vino el valor resuelto de un bloque al componer — `user` (lo escribió el cliente), `default` (contenido de demostración de la plantilla), `business` (dato real de Postgres), `fixed` (contenido no editable de la plantilla) o `empty` (sin valor en ningún nivel).
- **`attic`**: contenido huérfano tras una migración de versión o un cambio de plantilla; nunca se borra, se conserva indexado por `slug@version` de origen.
- **Composición (`compose`)**: función pura `(paquete, documento, datos de negocio, locale) → (ComposedDocument, CompositionReport)`. Se ejecuta en cada lectura del editor y una vez al publicar; no existe "regenerar" como operación aparte.
- **`InvitationRelease` / `tpl_release`**: copia inmutable publicada (documento compuesto + versión de plantilla + hash de contenido). El render público solo lee esto, nunca el documento de trabajo.
- **`public_token`**: identificador opaco y estable del enlace público de una invitación (en `tpl_document`, nunca el `invitationId`).
- **Operación (`Operation`) / lote (`OperationBatch`)**: unidad de edición del reductor único que comparten el editor humano, el autoguardado y la IA. Un lote humano se aplica todo o nada; una propuesta de IA (`EditProposal`) descarta operación por operación.
- **Invariante (`I-xx`)**: regla entre campos que Zod no puede exportar a JSON Schema (p. ej. `end ≥ start`); se implementa dos veces (TypeScript y Kotlin) y se prueba con la misma tabla de casos. Catálogo actual: `I-01`…`I-23`.

## Añadido al cierre de la fase 1 (ronda 1R)

- **`AssetIndex`**: cuarto parámetro de `compose`. Traduce cada `assetId` del documento a la URL y los metadatos que el render necesita. Vive fuera del `ComposedDocument` a propósito: dentro del compuesto las URL ya van resueltas y ningún `assetId` sobrevive.
- **`canonicalJson`**: serialización determinista de un JSON (orden de claves fijo, sin espacios, números normalizados). Es la única entrada admisible de cualquier hash del módulo, porque Postgres reordena las claves de un `jsonb` y los bytes almacenados no son estables.
- **`contentHash`**: hash del par `{composed, report}` de una composición, con prefijo de algoritmo (`sha256:…`). Es el `ETag` del render público. Incluye el informe para que un cambio de estado (por ejemplo, un bloque que deja de estar en su valor de demostración) invalide la caché.
- **`package_hash`**: hash del paquete de plantilla **entero** (manifiesto, tema, defaults, migraciones y assets). Es la clave de idempotencia del registro: si dos paquetes distintos lo comparten, el segundo se descarta en silencio, y por eso debe cubrirlo todo.
- **`switchTemplate`**: operación de cambio de plantilla de una invitación ya editada. Transporta contenido solo entre bloques del mismo rol singleton; los grupos van íntegros al `attic`.
- **`clearItemBlock`**: undécima operación del catálogo. Borra el valor de un bloque dentro de un ítem de grupo. Existe porque sin ella la inversa de un `setItemBlock` sobre un ítem sin valor previo no era expresable, y esa entrada del historial quedaba sin poder deshacerse.
- **Procedencia `default` y bloqueo de publicación**: un bloque que sigue mostrando el contenido de demostración de la plantilla se marca `stillDefault` y bloquea la publicación. Deshacer una edición debe devolver el bloque a `default` (con `clearBlock`), nunca escribir el valor de demostración como si fuera del cliente: eso desactivaría el bloqueo y volvería a publicar datos ficticios como reales (H-03).
- **Cohorte de migración**: conjunto de plantillas legadas que comparten origen y tratamiento. Son cuatro, no una: reproducibles desde el repositorio, reconstruibles desde los `payload-template-*`, sin fila Flyway, y no reproducibles.
- **Texto visible**: todo el texto que un invitado ve renderizado, de demostración incluido. Es la unidad de comparación de la verificación de migración: se compara íntegro y con igualdad exacta tras normalizar, sin umbrales difusos.
- **Compuerta A1-A8**: las ocho comprobaciones que la fase 3 debe pasar antes de construir el editor, para confirmar que el lienzo en iframe sin `allow-same-origin` es viable (fuentes, imágenes, CSP, selección, medición, captura). Si falla, se activa la contingencia ya aprobada del origen dedicado.

## Añadido en la fase 3-C (sistema de diseño e identidad visual)

- **Token semántico**: variable CSS `--ui-<rol>` (`primary`, `surface`, `ink-muted`, `focus`…) que
  resuelve a un color por su FUNCIÓN, no por su matiz — el mismo nombre cambia de hex entre paleta y
  entre tema claro/oscuro, y ningún componente sabe cuál es. Se consume solo por la utilidad de
  Tailwind del preset (`bg-ui-primary`, `text-ui-on-primary`…), nunca por un paso de escala
  (`primary-600`) ni por un hex literal: un token sin rol es exactamente el hueco por donde se cuela
  una identidad inconsistente (`contratos.md §13.2`, `diseno/11-sistema-de-diseno.md §1.3`).
- **Voz tipográfica**: una de las tres familias del sistema con un papel fijo — `display` (Fraunces,
  títulos y encabezados, nunca el cuerpo), `text` (Onest, cuerpo de lectura) y `label` (Red Hat Mono,
  etiquetas en mayúsculas con tracking). Cada rol de tamaño (`display-2xl`…`label-sm`) pertenece a una
  sola voz; mezclar la voz de cuerpo en un título es la regla que nunca se rompe (`11 §2.2`).
- **Historia**: el objeto (`slug`, `nombre`, `familia`, `descripcion`, `variantes`, `estados?`) con el
  que un componente de `@invitaciones/ui` se declara ante la galería `/design/componentes/[slug]`.
  Vive junto al componente (`<Nombre>.historias.tsx`), se suma a mano al registro
  (`packages/ui/src/historias/registro.ts`) y es lo que la regresión visual del proyecto Playwright
  `design` captura, en claro y oscuro, a 390 y 1440 px (`contratos.md §13.4`).
- **Vitrina**: contenedor de historia (`EscaparateSuperposicion`,
  `packages/ui/src/historias/escaparate.tsx`) para un componente de superposición (`Dialog`, `Sheet`)
  que la galería necesita mostrar ABIERTO. Monta el panel `modal={false}` dentro de una caja con
  `contain: paint`, para que el `position: fixed` del panel se resuelva contra la ficha y no contra la
  ventana, sin secuestrar el foco ni el `aria-hidden` de toda la página.
- **Forma protagonista**: la única forma decorativa (`Rays`, `Blob`, `Seal`…) con papel principal en
  un bloque o tarjeta; una segunda forma solo se admite en un tono `-soft`, con menos del 30 % del
  área y sin tocar a la primera (`11 §3.4` R1). Es la regla que impide que la composición se vea
  recargada al combinar la biblioteca de formas.
- **Capa de compatibilidad**: bloque de `app/(chrome)/globals.css` (`@theme inline`, sección
  «COMPATIBILIDAD FASE 3») que traduce nombres de utilidad viejos del chrome de la fase 3
  (`bg-ui-bg`, `text-ui-ink-heading`, `font-ui-sans`, `text-ui-eyebrow`…) al valor real de un token
  nuevo, para las pantallas que la fase 3-C todavía no había migrado. Es deuda intencional y
  retirable, no un segundo sistema: un componente nuevo nunca escribe un nombre de esta lista
  (`contratos.md §13.1`, antipatrón en `guias/identidad-visual.md §9`).

## Añadido en la fase 4 (kit de autor de plantillas)

- **Kit de autor**: `frontend/packages/template-kit`, invocado como `pnpm plantilla <comando>` desde
  `frontend/`. Ocho comandos (`doctor`, `nueva`, `secciones`, `bloque`, `check`, `preview`,
  `capturas`, `registrar`) que cubren el recorrido entero de crear una plantilla y darla de alta sin
  escribir código ni conocer el esquema (`contratos.md §14`).
- **Andamio (`plantilla nueva`)**: paquete de partida generado desde el catálogo de secciones, válido
  a la primera. Sus **valores** son texto de relleno que el autor debe reescribir; sus **etiquetas**
  son rótulos presentables curados por rol, porque una etiqueta sí se publica (ADR-4-1C-01).
- **Compuerta (`TPL_*`)**: comprobación con nombre propio de `check`, con tres severidades — ERROR
  (no se registra), AVISO (se registra; `--estricto` lo vuelve error) y CORREGIDO (el kit lo arregla y
  lo dice). Catálogo y severidad de cada una en `contratos.md §14.3`.
- **Sabotaje**: prueba que rompe a propósito lo que una compuerta protege y **fija su mensaje literal**
  en rojo, antes de restaurarlo. Es la única prueba de que la compuerta no está vacía: sin ella, quitar
  la comprobación deja la suite en verde. `test/check-sabotajes.test.ts`.
- **`package_hash`**: hash del paquete **entero** y clave de idempotencia del registro. Repetir el alta
  del mismo paquete es `200 noop_same_hash`; el mismo `slug@version` con otro contenido es `409`.
- **`noop_same_hash`**: respuesta correcta —no un fallo— de volver a registrar un paquete idéntico.
- **Prueba ciega**: prueba de usabilidad del kit hecha por un agente al que se le prohíbe leer el
  código del kit, el esquema y las bitácoras previas; solo tiene la guía, el checklist y los README.
  Se cronometra y su veredicto es «¿lo haría en 30 minutos alguien que no programa, sin adivinar
  nada?». La ronda 1 (`bitacora/4-5.md`) respondió **no** y por eso existe la ronda de correcciones
  4-1C.
- **Plantilla convertida**: una de las nueve que salieron del catálogo antiguo con
  `packages/migration-legacy`. Correctas, limpias y accesibles, pero **sin arte propio**: sus huecos de
  imagen están pendientes porque en el origen eran URLs externas inalcanzables.
- **Plantilla de diseño**: `boda-clasica` y `xv-jardin`, escritas a mano a partir de los ejemplos de
  forma, con arte generado por `frontend/templates/scripts/build-art.mjs` (SVG autoral → WebP,
  determinista).
- **Asset del paquete vs. asset de la demostración**: los primeros van dentro de `<version>/assets/`,
  entran en el `package_hash` y los sube el registro; los segundos viven en `<slug>/demo/<paleta>/`,
  **no** entran en el paquete y los sube `scripts/seed-demo.sh` a la invitación de ejemplo.
