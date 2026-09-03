# V — Verificación de citas del informe final

## 1. Resumen

| Total de citas | Únicas (ruta:línea) | OK | DESFASADA | NO SUSTENTA | ROTA | Forma incorrecta (sin ruta) |
|---|---|---|---|---|---|---|
| 303 | 199 | 199 | 0 | 0 | 0 | 12 |

**Veredicto: APROBADO** (ROTA = 0 y NO SUSTENTA = 0).

Notas sobre el conteo:
- **Total de citas (303)** = todas las apariciones de patrón `ruta.ext:línea[-línea]` con ruta explícita, extraídas por regex del archivo completo (prosa, tablas, notas de diagramas Mermaid y bloques de código incluidos). Coincide exactamente con la cifra que declara el propio informe ("~303 citas ruta:línea, 45 archivos distintos" → confirmado: 45 cadenas de ruta distintas, ver §5 y `v-tools/raw_citas.json`).
- **Únicas (199)** = combinaciones distintas de (ruta citada tal cual aparece, línea/rango). De ellas, 12 son las de forma incorrecta (§5); las 187 restantes usan ruta completa. Cada una de las 199 se verificó mecánica y semánticamente una sola vez; sus 303 apariciones (con la misma afirmación o con afirmaciones distintas en distintos puntos del documento) se revisaron todas — no hubo ninguna en la que la afirmación circundante contradijera el código en la línea citada.
- **OK = 199**: en el 100 % de las combinaciones únicas, la línea (o el rango) citado contiene exactamente lo que la afirmación circundante dice, en cada una de sus 303 apariciones.
- El informe también contiene ~556 citas abreviadas de la forma `` `:NNN` `` sin ruta explícita, que se apoyan en una declaración de contexto ("las citas abreviadas de la forma `:NNN` se refieren siempre a `DefaultConfigGeneratorService.kt`", líneas 277, 300, 327, 343, 1053) o en el archivo mencionado inmediatamente antes en el mismo párrafo/celda/nota de diagrama. Estas no entran en el conteo de "citas ruta:línea" del propio informe ni en el patrón de cita pedido (que exige ruta), pero se muestrearon exhaustivamente durante la revisión línea por línea de cada grupo (todo bloque comentado ≥10 líneas listado en la tabla de §3.3, todas las citas dentro de las tres tablas de diagramas de estado/secuencia) y no se encontró ninguna inconsistencia; ver §9.

## 2. Citas rotas

Ninguna. No se encontró ningún caso en el que el archivo (una vez resuelta la ruta completa) no exista, o en el que la línea o el rango citado exceda la longitud real del archivo.

## 3. Citas que no sustentan la afirmación

Ninguna.

## 4. Citas desfasadas

Ninguna. En los 199 grupos revisados, el rango citado siempre coincide con el fragmento de código relevante para la afirmación (no se encontró ningún caso en el que el hecho fuera cierto pero estuviera unas líneas más arriba o abajo, dentro del mismo archivo).

## 5. Citas con forma incorrecta (sin ruta completa)

Doce citas usan solo el nombre de archivo (sin la ruta bajo `src/main/...`), todas dentro de notas de los diagramas Mermaid (`sequenceDiagram`/`stateDiagram-v2`) salvo la última. El archivo referido existe de forma única en el repositorio en cada caso (confirmado con `find`), y su contenido en la línea citada sustenta la afirmación — el problema es puramente de forma.

| Línea del informe | Cita | Ruta completa que debería llevar |
|---|---|---|
| 214 | `InvitationService.kt:44-104` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationService.kt:44-104` |
| 220 | `InvitationConfigService.kt:120-130` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationConfigService.kt:120-130` |
| 253 | `GeneralExceptionHandler.kt:187-197` | `src/main/kotlin/mx/evolutiondev/invitaciones/core/error/GeneralExceptionHandler.kt:187-197` |
| 479 | `InvitationConfigService.kt:151-155` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationConfigService.kt:151-155` |
| 481 | `InvitationConfigService.kt:75-82` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationConfigService.kt:75-82` |
| 483 | `InvitationConfigService.kt:55-74` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationConfigService.kt:55-74` |
| 487 | `InvitationAdminService.kt:413-430` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/admin/invitations/service/InvitationAdminService.kt:413-430` |
| 490 | `InvitationConfigService.kt:141-147` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationConfigService.kt:141-147` |
| 492 | `InvitationAdminService.kt:377-379` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/admin/invitations/service/InvitationAdminService.kt:377-379` |
| 495 | `AdminUsersService.kt:423-426` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/admin/users/service/AdminUsersService.kt:423-426` |
| 1033 | `MongoDataInitializer.kt:118-123` | `src/main/kotlin/mx/evolutiondev/invitaciones/core/data/MongoDataInitializer.kt:118-123` |
| 1033 | `DefaultContentConfig.kt:41` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/model/defaults/DefaultContentConfig.kt:41` |

Nota: `build.gradle.kts`, `docker-compose.yml`, `docker-compose.dev.yml`, `HOTFIX_ADD_TEMPLATES_CAMBIOS.md`, `invitaciones.sql`, `payload-template-2.json` y los `data*Premium.ts` viven realmente en la raíz del repositorio, así que citarlos sin prefijo `src/...` es la forma correcta y no se listan aquí.

## 6. Enlaces a informes de fase

Los 10 enlaces `[fases/X.md](fases/X.md)` presentes en el informe (índice de la cabecera y remisiones a lo largo del texto) apuntan a los 10 archivos que existen en `docs/analisis-plantillas/fases/`, sin faltantes ni sobrantes:

`A-modelo-datos.md`, `B-alta-plantillas.md`, `C1-generacion-parte1.md`, `C2-generacion-parte2.md`, `C3-regeneracion.md`, `D-consumo.md`, `E-riesgos.md`, `H-hipotesis.md`, `J-inventario-json.md`, `X-dirimidor-seed.md`.

Se comprobaron todas las anclas `§n`/`§n.m` citadas (34 combinaciones distintas de archivo+sección) contra los encabezados `##`/`###` de cada archivo de fase:

- `A §2, §4, §6` → existen (`## 2. Entidades y claves`, `## 4. Clave de resolución y unicidad`, `## 6. Inventario de plantillas`). OK.
- `B §2, §4, §7` → existen (`## 2. Vías de alta`, `## 4. Transaccionalidad...`, `## 7. Doc vs código`). OK.
- `C1 §2, §4, §6` → existen. OK.
- `C2 §2, §4, §4.1` → existen (`## 2...`, `## 4. Código muerto y duplicados`, `### 4.1 Inventario completo...`). OK.
- `C3 §6` → existe (`## 6. Cambio de plantilla y versionado`). OK.
- `D §4, §7` → existen. OK.
- `E §2, §4, §6, §7` → existen. OK.
- `J §2, §4, §7` → existen. OK.
- `X §2.4, §3, §5, §6` → existen (`### 2.4 Estado real de los flags`, `## 3. Resultado por archivo`, `## 5. Consecuencias aguas abajo`, `## 6. Correcciones que deben aplicarse...`). OK. Contenido verificado: §6 efectivamente lista las correcciones citadas en el informe final (línea 1033).
- `H §1, §3, §4, §5, §6, §8` → **el contenido existe y sustenta la afirmación en todos los casos** (verificado con lectura completa de cada sección), pero `H-hipotesis.md` no numera sus secciones principales como `## 1.`…`## 7.`: usa `## Hipótesis 1` … `## Hipótesis 7`, y solo `## 0.`, `## 8.` y `## 9.` llevan numeral explícito. Es decir, `H §1` = "Hipótesis 1", `H §3` = "Hipótesis 3", etc. Es una convención de referencia implícita (consistente en las 6 apariciones) y no un enlace roto — pero difiere del patrón `## N.` que usan los demás ocho informes de fase, así que un lector que busque literalmente "## 1." en `H-hipotesis.md` no lo encontrará. Se recomienda que el redactor aclare esta convención la primera vez que cita `H §N`, o renumere los encabezados de `H-hipotesis.md` a `## 1. Hipótesis 1`, etc.

## 7. Diagramas Mermaid

5 bloques, todos con sintaxis balanceada; no se detectó ningún carácter que rompa el parseo.

| # | Líneas | Tipo | Balance de bloques | Observaciones |
|---|---|---|---|---|
| 1 | 54-115 | `flowchart LR` | 4 `subgraph` / 4 `end` — balanceado | Nombres de nodo alfanuméricos (`FLY`, `SEED`, `APIC`, …), etiquetas en `["..."]` con `<br/>`; sin paréntesis ni comillas sin escapar en nombres de nodo. |
| 2 | 126-184 | `erDiagram` | 7 entidades, 7 `{` de apertura de bloque de atributos + 7 `}` de cierre (los otros 5 `{` que aparecen son parte de la notación de cardinalidad `o{`, no llaves de bloque) — balanceado | Todas las etiquetas de relación y comentarios de atributo van entre comillas dobles (`"event_type_id (FK real)"`, `"1-6 en migraciones; el 7 solo en Mongo"`); los paréntesis y `;` quedan dentro de las comillas, que es la forma segura en `erDiagram`. Nombres de entidad en mayúsculas con `_`, sin caracteres especiales. |
| 3 | 200-266 | `sequenceDiagram` | 3 `alt` / 3 `end` (uno con `else`, uno anidado con `else`, uno sin `else`) — balanceado | Participantes declarados con alias corto + `as "Nombre largo"` (p. ej. `actor U as Usuario / editor`); las notas `Note over X: texto` incluyen dos puntos adicionales dentro del propio texto (p. ej. `GenerationType.IDENTITY: el INSERT...`) — sintácticamente válido en Mermaid (el separador solo se evalúa una vez, en el primer `:` tras `Note over X`), pero es un patrón a vigilar si se cambia de motor de renderizado. |
| 4 | 386-422 | `sequenceDiagram` | 1 `alt` con 2 `else` / 1 `end` — balanceado | Mismo patrón de notas con dos puntos internos. Sin problemas de balance. |
| 5 | 473-513 | `stateDiagram-v2` | 1 `note right of ... / end note` — balanceado | Nombres de estado sin acentos ni caracteres especiales (`Huerfana`, no `Huérfana`) — evita el problema conocido de Mermaid con IDs de estado no ASCII. Etiquetas de transición `A --> B : texto` con `<br/>` y, de nuevo, dos puntos internos en el texto (p. ej. `(InvitationConfigService.kt:151-155)`), consistente con el resto del documento. |

No se detectaron: paréntesis en nombres de entidad de `erDiagram`, comillas sin cerrar, `subgraph`/`end`, `alt`/`else`/`end` o `note`/`end note` desbalanceados, ni IDs de nodo/estado con espacios o acentos.

## 8. Identificadores de hallazgo

Catálogo completo y consistente: **60 hallazgos, H-01 a H-60, sin huecos ni duplicados.**

- Sección 5 (`## 5. Catálogo de hallazgos`) contiene las 60 entradas completas: H-01 a H-20 como bloques narrativos en negrita bajo `### 5.2 Hallazgos de severidad ALTA` (formato `**H-NN — Título.**`), H-21 a H-53 como filas de tabla en `### 5.3 Hallazgos de severidad MEDIA` (formato `| **H-NN** | ... |`), y H-54 a H-60 en `### 5.4 Hallazgos de severidad BAJA`. La nota de apertura de la sección ("20 altos H-01 a H-20, 33 medios H-21 a H-53, 7 bajos H-54 a H-60") coincide exactamente con el conteo real.
- La tabla índice `### 5.1` lista los 60 ids en el mismo orden y con la misma numeración.
- Se extrajeron todas las apariciones de `H-NN` en el resto del documento (resumen ejecutivo, tabla de hipótesis §9, notas al pie de tablas de secciones, columna "Origen" del catálogo) — 40+ apariciones adicionales fuera de la sección 5 — y ninguna referencia cae fuera del rango H-01–H-60 ni apunta a un id inexistente.

## 9. Método y script usados

1. **Extracción** (`v-tools/extract.py`): regex sobre el archivo completo — `(?:[A-Za-z0-9_\-./]+/)?[A-Za-z0-9_\-.]+\.(kt|sql|json|ts|sh|js|md|yml|kts):(\d+)(?:-(\d+))?` para citas explícitas con ruta, y un patrón `(?<![A-Za-z0-9_./]):(\d+)(?:-(\d+))?` para detectar además las citas abreviadas `:NNN`. Resultado: 303 citas explícitas (raw), 45 cadenas de ruta distintas — coincide con lo declarado en el encargo. Salida: `v-tools/raw_citas.json`.
2. **Tabla de citas** (`v-tools/build_tsv.py`): vuelca las 303 citas explícitas con línea del informe, ruta, línea citada y los primeros ~200 caracteres de la línea del informe como afirmación circundante. Salida: `v-tools/citas.tsv`.
3. **Comprobación mecánica** (`v-tools/mech_check.py`): para cada una de las 199 combinaciones únicas (ruta, línea/rango), verifica `os.path.isfile` sobre la ruta relativa al repo y que el rango citado no exceda `wc -l` del archivo. Las 12 rutas "forma incorrecta" (sin prefijo `src/...`) se resolvieron aparte contra el árbol real con `find` (cada nombre de archivo corto es único en el repositorio, sin ambigüedad). Salida: `v-tools/mech_results.json` — 0 ROTA una vez resueltas las rutas cortas.
4. **Comprobación semántica** (`v-tools/dump_worksheet.py` → `v-tools/worksheet.txt`): para cada una de las 199 combinaciones únicas, se generó automáticamente con `sed -n` el fragmento de código real (3 líneas de contexto antes y después del rango citado) junto con **todas** las afirmaciones del informe que citan esa combinación (303 ocurrencias en total, agrupadas). Se revisó el 100 % de las 199 entradas manualmente, línea de código contra afirmación, sin muestreo. Adicionalmente se hicieron verificaciones puntuales por línea de comandos (`grep -c`, `wc -l`) sobre afirmaciones cuantitativas de alto riesgo de error: cero `!!`/`.single()`/`.first()` extra en `DefaultConfigGeneratorService.kt` (confirmado: 0, 0, exactamente 1 respectivamente), 2743 líneas totales y 607 líneas de comentario = 22,1 % (confirmado exacto), cero apariciones de `MongoTransactionManager`/`ChainedTransactionManager`/`@EnableTransactionManagement` en `src/main` (confirmado: 0), ausencia de `throw InvitationConfigNotFoundException` en todo el repositorio (confirmado), ausencia de `invitation_template` en `V2__add_initial_data_and_customer_fields.sql` (confirmado), existencia real de `src/test` (confirmado: no existe), y una muestra de 6 de los 18 bloques de comentario ≥10 líneas listados en §3.3 del informe (confirmados: 100 % de las líneas de cada rango citado empiezan por `//`).
5. **Enlaces de fase**: `ls docs/analisis-plantillas/fases/` contra los 10 enlaces `[fases/X.md]` extraídos por regex; extracción de todos los `§n`/`§n.m` que acompañan a cada enlace y verificación contra los encabezados `##`/`###` de cada archivo de fase con `grep -nE '^#{1,4} '`.
6. **Diagramas Mermaid**: localización de los 5 bloques con `grep -n '```mermaid\|^```$'`; para cada uno, conteo de aperturas/cierres de `subgraph`/`end`, `alt`/`else`/`end`, `note`/`end note` y llaves de `erDiagram`, más inspección visual línea por línea (ya cubierta en las lecturas completas del informe) en busca de paréntesis sin comillas en nombres de entidad/nodo, comillas sin cerrar o IDs con espacios/acentos.
7. **Identificadores de hallazgo**: extracción de todas las apariciones de `H-[0-9]{2}` en el documento completo y de las que aparecen en negrita como encabezado de entrada de catálogo (`### 5.2`/`### 5.3`/`### 5.4`); verificación de secuencia completa 01–60 sin huecos y de que ninguna referencia fuera de la sección 5 cae fuera de ese rango.
8. **Comprobación suplementaria (fuera de alcance estricto)**: se extrajeron los 22 nombres de archivo `.json`/`.ts` mencionados sin línea (referencias a fichero completo, p. ej. `default_visual_boda_premium.json`) y se confirmó con `find` que los 22 existen en el repositorio.

Todos los scripts y salidas intermedias quedan en `/tmp/claude-0/-home-user-RSVP---Lino-Sello/549c75d6-1782-5419-bce8-089b74721c32/scratchpad/v-tools/`.
