# 4-ADV — Auditoría adversarial de fase 4 (kit + registro)

Dos agentes: **4-ADV-1** hizo P3, P2, el sabotaje de `check` y descubrió el agujero de `preview`, y se
quedó sin presupuesto antes de corregirlo o de auditar el registro (su evidencia está en
`docs/rediseno-plantillas/evidencia/fase-4/4-adv/`: `p3-cero-presentacion.txt`, `p2-*.txt`,
`check-sabotaje.txt`, `preview-lectura-fuera-del-paquete.txt`). **4-ADV-2** (este documento) continuó:
corrigió `preview` y auditó el registro con peticiones reales.

## 1. P3 — cero presentación en Kotlin

Verificado limpio por 4-ADV-1 (`p3-cero-presentacion.txt`): ocho búsquedas (hex/rgb/hsl, tamaños con
unidad, familias tipográficas, nombres de icono, literales del paquete de composición, defaults de
paleta/fuente/variante y de etiqueta/título) sobre todo `modules/templates2/**` en Kotlin, sin un solo
hallazgo real — los `grep` que sí devuelven líneas son identificadores de dominio (`label`, `title`,
`AssetContentType.IMAGE_SVG`) y mensajes de error, no presentación colada en el backend. **No re-hecho**
por 4-ADV-2: nada que corregir.

## 2. P2 — ids estables

Verificado limpio por 4-ADV-1 en los 13 paquetes publicados (`p2-ids-estables.txt`,
`p2-determinismo.txt`, `p2-merge-por-id.txt`): sin `blockId` duplicados, sin `section.key` duplicadas,
sin `itemBlocks` duplicados, todo `itemId` cumple `^[0-9A-HJKMNP-TV-Z]{26}$` (ULID) y es único dentro de
su grupo, toda clave de `defaults.content` es un `blockId` declarado, el reductor localiza fichas de
grupo por `itemId` (nunca por índice: `findIndex(x => x.itemId === op.itemId)` en TypeScript,
`indexOfFirst { it.itemId.value == op.itemId }` en Kotlin, el mismo criterio en las dos capas). **No
re-hecho** por 4-ADV-2.

## 3. `check` — esquives encontrados (no corregidos: van a `issues-fase-4.md`)

4-ADV-1 rompió un paquete correcto y publicado (`xv-jardin/1.0.0`) de DIEZ maneras (`check-sabotaje.txt`,
`/tmp/adv/sab/b1`…`b10`, además de una variante `b2b`). Seis las detecta `check` con su error de siempre;
**cuatro pasan en verde y no deberían**:

| # | Sabotaje | Por qué escapa | Issue |
|---|---|---|---|
| b1 | Marca ajena escrita en `template.json` en vez de `defaults.json` | Las tres compuertas de contenido (`revisarMarcaAjena`/`revisarEnlaceTercero`/`revisarDatoBancario`) solo recorren `crudoDefaults["content"]`, `check.ts:459-461` | I-4ADV-01 |
| b3 | URL de tercero sin esquema (`www.…`, sin `http(s)://`) | `RE_URL` exige el esquema, `check.ts:1048` | I-4ADV-02 |
| b4 | CLABE con puntos entre los dígitos (`1104.1234.5678`) | `RE_NUMERO_LARGO` no incluye `.` en su clase de caracteres, `check.ts:1099` | I-4ADV-03 |
| b10 | SVG con `<script>` dentro, declarado como asset | `revisarAssets` solo mide `sha256`/`bytes`/`contentType`; nunca abre el contenido de un SVG, `check.ts:597-644` | I-4ADV-04 |

Ninguno de los cuatro lo corrige 4-ADV-2 (el encargo lo prohíbe explícitamente: "si es media o baja, no
la corrijas"). Las cuatro están detalladas con reproducción y arreglo propuesto en
`memoria/issues-fase-4.md`.

## 4. `preview` — ALTA corregida: `/__preview/fs/` servía cualquier fichero del disco

**Encontrado por 4-ADV-1** (`preview-lectura-fuera-del-paquete.txt`): `GET /__preview/fs/etc/passwd` →
`200` con el archivo entero; `GET /__preview/fs/proc/self/environ` → `200` con **las variables de
entorno del proceso de desarrollo** (9118 B); certificados de `/root/.ccr/`; y `..` normalizado o
codificado sin ningún efecto. Causa: la ruta se servía con `servirArchivo(res, "/", …)` — la raíz era el
sistema de ficheros entero, así que la comprobación "¿la ruta cae dentro de la raíz?" era un no-op.

**Corregido por 4-ADV-2** en `frontend/packages/template-kit/src/preview.ts`:

- `servirArchivo(res, raiz, relativa)` — una única raíz (usada por `/__preview/asset/`). Comprueba por
  texto Y por `fs.realpathSync` (de la ruta y de la raíz), para que un enlace simbólico que apunte fuera
  tampoco se sirva.
- `servirArchivoAbsoluto(res, raices, relativa)` — nueva, exclusiva de `/__preview/fs/`. Reconstruye la
  ruta absoluta (necesaria: las URLs de `hojaDeFuentes` traen la ruta completa del `.woff2`, no una
  relativa a una única raíz) y **solo** la sirve si cae dentro de alguna de `raicesModulos` (los tres
  `node_modules` desde los que se resuelven las tipografías `@fontsource`, ADR-4-1B-06), con enlaces
  simbólicos resueltos en ambos lados.

**Verificación con salida real** (`evidencia/fase-4/4-adv/preview-fs-arreglo.txt`): las cuatro peticiones
originales, más `..` normalizado, `%2e%2e%2f`, `%2f` inicial codificado y una doble barra, todas dan
`403` ahora. Con el previsualizador levantado sobre `boda-clasica/1.0.1`: `/__preview/fuentes.css` sigue
resolviendo `Cormorant Garamond` e `Inter` (`200`, 14511 B, vía el enlace simbólico de pnpm
`apps/web/node_modules/@fontsource/cormorant-garamond → node_modules/.pnpm/…`, que sigue cayendo dentro
de una raíz permitida); `pnpm plantilla capturas` produjo sus tres PNG (390/768/1280 px, 1-2.3 MB cada
uno).

**Prueba automatizada**: `frontend/packages/template-kit/test/preview-seguridad-fs.test.ts` (3 pruebas:
archivo fuera de raíz rechazado, enlace simbólico hacia fuera rechazado, tipografía legítima servida).
Saboteada a mano (se volvió a poner `servirArchivo(res, "/", …)` en la ruta `fs/`) y confirmada en
**rojo** (2 de 3 pruebas fallan, `esperaba 403/404 …, llegó 200`); restaurado el arreglo, **verde** (3/3).
Salida completa de las dos corridas en `evidencia/fase-4/4-adv/preview-fs-rojo-verde.txt`.

ADR: `decisiones.md` → **ADR-4-ADV-01**.

Suite completa del kit tras el arreglo: **176 pruebas, 0 fallos** (173 previas + 3 nuevas),
`pnpm --filter @invitaciones/template-kit test`.

## 5. Registro — auditado con peticiones reales (backend levantado, puerto 6092)

Cinco comprobaciones, todas con salida literal en `evidencia/fase-4/4-adv/registro-auditoria.txt`:

1. **Autorización**: sin token → `401`. Con token de una cuenta `USER` recién creada (sin promover) →
   `403 Access Denied`. Ninguno de los dos crea nada — el rechazo lo produce Spring Security antes de
   que el controlador se ejecute (`@PreAuthorize("hasRole('MASTER')")` + `hasRole("MASTER")` en
   `SecurityConfig.kt:44`). **Correcto.**
2. **Inmutabilidad**: se registró un paquete fresco (`201`), se cambió un byte de su `defaults.json` SIN
   subir la versión, y se volvió a registrar → `409 TPL_VERSION_HASH_MISMATCH`, con el hash registrado y
   el solicitado en el detalle. **Correcto** — ninguna versión publicada se pisa.
3. **Idempotencia**: el mismo paquete, dos veces → `201` y luego `200 noop_same_hash`. Contadas las
   filas de `tpl_template_version` para ese slug por SQL directo: 1 antes, 1 después. **Correcto.**
4. **Nombres de asset maliciosos**: tres intentos (`assets/../fuera.webp` como nombre de parte
   multipart, `/etc/passwd` como nombre de parte, `assets` con `filename="..\win.webp"` estilo Windows)
   — los tres rechazados con `422` (`TPL_PACKAGE_UNEXPECTED_FILE` o `TPL_PACKAGE_ASSET_MISMATCH`) ANTES
   de llegar a la subida de assets. Comprobado en disco (`build/templates2-assets/`, el almacén local de
   `LocalAssetStorage`, activo en este entorno): ni un solo archivo con esos nombres, ni nada bajo
   `/etc`. La clave de almacenamiento nunca usa el nombre declarado del asset — se deriva de
   `slug`/`version`/`sha256` (`Templates2S3KeyService.templateAssetKey`) — y además tres capas
   independientes (regex de `TemplatePackageReader`, patrón del JSON Schema de `AssetEntry.path`, y el
   propio `LocalAssetStorage.resolver`) cierran la ruta de traversal antes de eso. **No es una alta.**
5. **Versiones**: `1.0.0` dos veces con contenido distinto → cubierto por el caso 2 (`409`). Versión no
   semver (`"no-es-semver"`) → `422 TPL_MANIFEST_INVALID` por el patrón del JSON Schema, antes de tocar
   el registro. Versión MENOR que la ya publicada (`0.9.0` registrada DESPUÉS de `1.0.0`, mismo slug) →
   `201` también, con `structuralDiff` vacío (el contenido es idéntico, así que ADR-028 no exige bump
   mayor). El catálogo queda con las dos versiones `published`. **No es una alta** (nada se pisa, nada se
   pierde, el catálogo sigue sirviendo la versión más alta) pero sí una superficie sin aviso — issue de
   severidad baja (I-4ADV-05).

Ningún alta en el registro: las cinco comprobaciones se comportan como documenta `02 §4`/ADR-008/ADR-028.
La única corrección de este frente fue I-4ADV-05, y se dejó como issue (baja), no como alta.

Suite Kotlin de `templates2` tras la auditoría (sin tocar producción): **1247 pruebas, 0 fallos, 0
errores**, `./gradlew :test --tests '*templates2*'`.

## Veredicto

**Sí, la fase 4 es cerrable desde el kit y el registro.** El único ALTA real de todo el encargo —
`/__preview/fs/` sirviendo cualquier fichero del sistema, incluidas las variables de entorno del
proceso — está corregido, probado con salida real (servidor levantado, las cuatro peticiones originales
más variantes codificadas y de enlace simbólico) y fijado con una prueba automatizada en rojo/verde. El
registro, examinado con los cinco ataques que un auditor adversarial probaría primero (autorización,
inmutabilidad, idempotencia, traversal de nombres de asset, semántica de versión), no cede en ninguno.

Quedan cinco issues de severidad media/baja (cuatro esquives de `check` ya conocidos desde 4-ADV-1, más
uno nuevo del registro) documentadas en `issues-fase-4.md` con reproducción y arreglo propuesto: ninguna
bloquea el cierre de la fase, pero conviene resolverlas antes de que un autor de plantillas real use
`check` como única red de seguridad.
