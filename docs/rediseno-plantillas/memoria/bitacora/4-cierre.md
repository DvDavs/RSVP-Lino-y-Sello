# Bitácora del cierre de la fase 4 (2026-09-09)

Orquestador raíz. Rama `claude/fase-4-kit-de-autor`, desde `d4cb633`. Un solo nivel de agentes,
worktrees para lo paralelo, `merge --no-ff` con verificación propia antes de cada aceptación.

## Lo que pasó a mitad de sesión, porque explica el reparto
Los tres primeros agentes (revisión adversarial, arte de `boda-clasica`, ronda 2 de correcciones) eran
Opus y **murieron los tres a la vez** por agotar el límite de sesión del modelo, cada uno a media
tarea. Ninguno perdió trabajo: lo tenían escrito en su árbol. Se relanzaron **continuadores con
Sonnet** apuntando a lo que ya había en disco, con el encargo reducido a «verifica esto y ciérralo».
Los tres cerraron. La lección para la memoria: **un agente que escribe en disco a medida que avanza se
puede relevar; uno que acumula en su contexto, no.**

## Verificaciones que hizo el orquestador, no los sub-agentes

| Qué | Cómo lo comprobé | Resultado |
|---|---|---|
| La plantilla de la 2.ª prueba ciega | recalculé su `package_hash` con el kit del árbol principal | `sha256:08a38846…`, el mismo que devolvió el backend en su registro |
| Su resultado visual | abrí la captura de 1280 px y la miré | textos reales, la negrita del `richText` aplicada, cero texto de desarrollador |
| El arreglo de 4-1D | sabotaje **distinto** del suyo: quité la sección de marcas de `plantilla bloque` | suite roja señalando el fichero; restaurada, 180/180 |
| La miniatura de `boda-clasica@1.0.2` | la abrí como imagen | dice «Hacienda Los Naranjos · Morelos»; el nombre real desapareció |
| Que no se pisó nada publicado | `build-art.mjs --check` y `build-packages.mjs --check` | «Sin deriva» las dos, y `git status` no toca un byte de `1.0.0` ni `1.0.1` |
| El arreglo del previsualizador | levanté el servidor y pedí los cuatro caminos del ataque | 403 los cuatro; `fuentes.css` sigue en 200 con 24 `@font-face` |
| Que ese arreglo es la causa | **devolví el fichero a su versión anterior y volví a pedir `/etc/passwd`** | 200, 1 238 B, empezando por `root:x:0:0`. Restaurado |
| La compuerta de peso tipográfico | devolví el peso 600 al `theme.json` de `cumple-retro` | `ERROR TPL_FONT_WEIGHT_NOT_SELF_HOSTED` nombrando los pesos que sí hay |

## Cifras finales, ejecutadas en el árbol integrado

**Frontend** (`pnpm -r test`), **3 377 pruebas, 0 fallos**:

| paquete | pruebas |
|---|---|
| `tokens` | 55 |
| `icons` | 179 |
| `schema` | 609 |
| `sections` | 977 |
| `ui` | 654 |
| `template-kit` | **187** (eran 173 al abrir el cierre) |
| `apps/web` | 627 |
| `migration-legacy` | 89 |

`pnpm -r typecheck`: **8 paquetes**, 0 errores.

**Backend** (`./gradlew check`): **1 271 pruebas, 0 fallos, 0 ignoradas**, 39,2 s.

**Humo** (`scripts/smoke.sh`, backend real en :6099): **19/19 OK · 0 fallidas**.

**Registro de las 15 versiones**, una por una contra el backend real: 13 dieron `201 created` y 2
`200 noop_same_hash` (ya las había sembrado `seed-demo.sh`). **Segunda pasada: las 15 con `200
noop_same_hash`**, sin una sola fila nueva — la idempotencia contada, no afirmada.

**Catálogo del cliente** (`GET /editor/templates2/catalog`, token MASTER): **13 plantillas**, una por
slug, con `boda-clasica@1.0.2` (la de la miniatura limpia). **Los ocho `eventKind` del esquema tienen
plantilla**: wedding 4, quince 2, birthday 2, y una cada uno baptism, communion, confirmation,
graduation, generic.

**`migration-legacy`, medido porque se dudaba**: 89 pruebas en **16,2 s** de reloj, y con tres agentes
trabajando en paralelo en la misma máquina. No añade ni un minuto a nada.

## Los cuatro trabajos del cierre

### 4-5B — segunda prueba ciega: veredicto «sí»
Agente Sonnet sin acceso al kit, al esquema ni a las bitácoras previas. Creó `cumple-retro`
(cumpleaños) en **2 min 44 s** de cronómetro contra los 30 del objetivo, con un `richText`, un grupo
de dos fichas y una imagen con asset. **Un solo error** en toda la prueba. `check` en verde,
`registrar` 201 y luego 200, tres capturas miradas. La ronda 1 había dicho «no»; ésta dice «sí».
Su reserva —las marcas de texto enriquecido y cómo añadir un bloque que el andamio no trae— la cerró
4-1D.

### 4-1D — la reserva de la prueba ciega
`plantilla bloque richText` enseña ahora un ejemplo con negrita y enlace; el error de un `richText`
mal escrito da la forma correcta y el fragmento copiable; la guía explica cómo añadir un bloque que tu
andamio no trae. **La lista de marcas se deriva del esquema**, no está escrita a mano: si mañana
aparece una marca nueva, la ayuda no se queda vieja en silencio. +7 pruebas.

### 4-9C — `boda-clasica@1.0.2`
La miniatura del catálogo llevaba horneado en píxeles el nombre de una hacienda de bodas real.
Regenerarla sobre `1.0.0` habría pisado una versión ya registrada, que es justo lo que el kit enseña a
no hacer, así que **se publica una versión nueva** y `1.0.0`/`1.0.1` quedan congeladas con la imagen
vieja: esa congelación es la prueba de que no se pisó nada. De paso sincronizó los ejemplos de diseño,
que seguían con la marca del proveedor anterior y datos reales que dos bloques anteriores ya habían
limpiado en las plantillas.
**Hallazgo que cambió el plan a mitad**: al limpiar dos nombres de negocio real del ejemplo,
`build-packages.mjs` reescribió el `defaults.json` de `1.0.0` y `1.0.1` ya registradas, porque para el
contenido no existe el mecanismo que sí existe para las imágenes. Se revirtió; queda como ADR-4-9C-02
y como pregunta al dueño.

### 4-ADV — revisión adversarial: **cerrable**, una alta corregida
- **La alta**: `preview` servía **cualquier fichero del disco**. La ruta que sirve las tipografías
  pasaba la raíz `/` a la función que comprueba que un fichero no se salga de su directorio, y con esa
  raíz la comprobación no comprueba nada. Devolvía `/etc/passwd`, los certificados y
  `/proc/self/environ`, que en un proceso de desarrollo lleva credenciales — y la guía manda dejar ese
  comando abierto durante todo el taller. Corregido, acotado a las tres raíces de `node_modules` de
  las que salen las fuentes, con los enlaces simbólicos resueltos antes de comparar.
- **El registro aguantó los cinco ataques**: sin token 401, con rol de cliente 403, cambiar un byte
  sin subir versión 409, idempotencia sin fila nueva, y los nombres de asset con `../` o rutas
  absolutas rechazados con 422 **antes de subir nada** (comprobado en el disco, no por el código de
  respuesta).
- **P3 y P2 limpios**: ni un color, tipografía, tamaño ni texto de interfaz en el Kotlin del módulo
  nuevo; y en las plantillas, ningún `blockId` ni `itemId` duplicado, todos con su formato.
- **Cinco issues** medias y bajas en `issues-fase-4.md`. La que más importa: **las compuertas de
  contenido de tercero miran `defaults.json` y no `template.json`**, así que el mismo dato escrito en
  el sitio equivocado pasa en verde.

### 4-1E — el rojo que destapó la prueba ciega
Al integrar `cumple-retro`, la prueba de tipografías de `apps/web` se puso roja: la plantilla pedía
Inter 600 y el producto autoaloja Inter 400 y 500. **`check` la daba por buena**, porque la compuerta
miraba la familia y nunca el peso. Y el andamio **generaba ese peso él solo**, así que cualquier
plantilla nacida del kit con esa pareja tipográfica nacía rota; la otra plantilla creada a ciegas se
libró por casualidad. Ahora el peso ausente es ERROR y los pesos del andamio se derivan de lo que el
producto autoaloja de verdad. De las quince versiones del repositorio, sólo `cumple-retro` estaba
afectada.

## Las ADR
**Las 14 que quedaban en propuesta: aceptadas las 14, ninguna rechazada**, y no por complacencia — las
catorce estaban implementadas, con pruebas en verde y con su compuerta saboteada antes de aceptarse.
**Cinco llevan enmienda o nota**, y todas salen de algo medido en este cierre, no de una opinión. Las
cuatro nuevas del cierre (`ADR-4-1D-01`, `ADR-4-9C-01`, `ADR-4-9C-02`, `ADR-4-ADV-01`, `ADR-4-1E-01`)
quedan en propuesta para el orquestador siguiente.

## Lo que no se hizo, y por qué
- **No se cambió la versión que siembra la demostración.** `seed-demo.sh` sigue en
  `boda-clasica@1.0.0`, así que la invitación de ejemplo no enseña la miniatura corregida. Se
  comprobó por qué antes de decidir: **once puntos de `apps/web` fijan literalmente esa versión**, y
  `apps/web` es territorio de la fase 5, que corre en paralelo.
- **No se tocaron los dos nombres de lugar real que quedan en 8 plantillas convertidas.** Cambiarlos
  altera el `package_hash` de ocho paquetes: es un bloque con su registro y su verificación, no un
  retoque de cierre. La fase 6 va a tocar esas ocho para vestirlas; ese es el momento.
- **No se cerraron las cinco issues medias y bajas**, por el mismo criterio: ninguna bloquea, todas
  tienen reproducción y arreglo propuesto escritos.
