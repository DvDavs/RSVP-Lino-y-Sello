# Evidencia 4-7 — registro contra el backend y capturas de todo el catálogo

Agente 4-7, worktree `wt/47`, rama `wip/f4-47`. Backend propio: `TPL_DEV_PORT=6017`,
`TPL_DEV_DB=invitaciones_f4_47`, `TPL_TEST_STATE_DIR=/tmp/templates2-pg-f4-47`. Variables en
`build/dev/env-4-7.sh` (no versionado; reconstruible con `handoffs/4-0a.md §1`).

## Qué hay aquí

- `registro-<slug>-<version>-1.txt` / `-2.txt` — salida literal de `pnpm plantilla registrar` para
  cada uno de los 12 paquetes, dos veces cada uno (idempotencia).
- `catalogo-completo.json` — `GET /editor/templates2/catalog` autenticado, sin filtro.
- `catalogo-eventKind-{wedding,baptism,quince}.json` — el mismo catálogo filtrado por `eventKind`.
- `capturas/<slug>-<version>/<slug>@<version>-{390,768,1280}.png` — capturas de página completa,
  tres viewports, de `pnpm plantilla capturas`.
- `<slug>-movil.jpg` / `<slug>-escritorio.jpg` — **imágenes de contacto** (una por plantilla, 11
  pares): la captura de página completa (390 px para "movil", 1280 px para "escritorio") recortada
  en columnas verticales y compuestas lado a lado con `sharp`, para que ninguna pase de 2500 px de
  alto. Script: `/tmp/.../contacto.mjs` (no versionado; algoritmo descrito abajo).
- `smoke.txt`, `seed-demo.txt` — salida de `scripts/smoke.sh` y `scripts/seed-demo.sh` al levantar
  el entorno.

## Comando que produjo cada cosa

```bash
source build/dev/env-4-7.sh
scripts/dev-backend.sh start        # una vez
scripts/seed-demo.sh                # una vez — registra boda-clasica@1.0.0 y xv-jardin@1.0.0 de paso
scripts/smoke.sh                    # 19/19 OK

cd frontend
pnpm plantilla registrar templates/<slug>/<version>     # x2 por paquete
pnpm plantilla check templates/<slug>/<version>          # para leer el package_hash del kit
pnpm plantilla capturas templates/<slug>/<version> --destino <evidencia>/capturas/<slug>-<version> --anchos 390,768,1280

# catálogo
curl -sS "$TPL_DEV_BASE/editor/templates2/catalog" -H "Authorization: Bearer $TOKEN" | jq .
curl -sS "$TPL_DEV_BASE/editor/templates2/catalog?eventKind=wedding" -H "Authorization: Bearer $TOKEN" | jq .
```

## Imagen de contacto — cómo se hizo

`sharp` no está en el PATH de node normal del proyecto; se importó directo desde
`frontend/node_modules/.pnpm/sharp@0.35.4_@types+node@26.4.1/node_modules/sharp/dist/index.mjs`.
Algoritmo: escala la captura de página completa a un ancho fijo (480 px para "movil", desde la
captura de 390; 640 px para "escritorio", desde la de 1280), calcula cuántas columnas `n` hacen
falta para que cada una mida ≤ 2400 px de alto, corta la imagen escalada en `n` franjas
horizontales y las compone una al lado de otra (nunca superpuestas) en un lienzo blanco, exportado
JPEG calidad 84. El resultado se lee de arriba-izquierda a abajo-derecha, columna por columna
(como una tira que se dobló en acordeón), no como una cuadrícula de secciones.

## Tabla final — registro (12 versiones, 11 slugs)

| slug | versión | `package_hash` (kit == backend) | 1.ª llamada | 2.ª llamada | `templateVersionId` | en catálogo |
|---|---|---|---|---|---|---|
| bautizo-elegante | 1.0.0 | `sha256:15bf3cd2…7627c` | 201 created | 200 noop_same_hash | 4 | sí |
| boda-basica | 1.0.0 | `sha256:42d57bee…4c258d` | 201 created | 200 noop_same_hash | 5 | sí |
| boda-premium | 1.0.0 | `sha256:27cf9135…10ebec4` | 201 created | 200 noop_same_hash | 6 | sí |
| boda-premium-2 | 1.0.0 | `sha256:76be6c06…2eef8d01` | 201 created | 200 noop_same_hash | 7 | sí |
| comunion-elegante | 1.0.0 | `sha256:d49ddee8…c444cb0b` | 201 created | 200 noop_same_hash | 8 | sí |
| confirmacion-elegante | 1.0.0 | `sha256:2ba4ff77…5975b3e14d3` | 201 created | 200 noop_same_hash | 9 | sí |
| cumpleanos-elegante | 1.0.0 | `sha256:5394f083…56c771f` | 201 created | 200 noop_same_hash | 10 | sí |
| evento-elegante | 1.0.0 | `sha256:50f3fa0f…52ef7ca58928` | 201 created | 200 noop_same_hash | 11 | sí |
| xv-elegance | 1.0.0 | `sha256:2d190566…dda260f1c` | 201 created | 200 noop_same_hash | 12 | sí |
| boda-clasica | 1.0.0 | `sha256:02a9a294…2085d1a96` | 200 noop_same_hash* | 200 noop_same_hash | 1 | sí (1.0.1 es la que se ve) |
| boda-clasica | 1.0.1 | `sha256:1d99bac4…40c118cca2` | 201 created | 200 noop_same_hash | 13 | sí |
| xv-jardin | 1.0.0 | `sha256:d805fc53…0ad14f442b5ee` | 200 noop_same_hash* | 200 noop_same_hash | 2 | sí |

`*` `boda-clasica@1.0.0` y `xv-jardin@1.0.0` ya las registró `scripts/seed-demo.sh` al levantar el
entorno (es el mismo camino HTTP, `registrar-http.sh`, y es requisito de `seed-demo.sh` para poblar
la invitación de demostración). La "primera" llamada de este agente sobre esos dos paquetes ya cayó
en `noop_same_hash`; la creación real (`201`) quedó en la salida de `seed-demo.sh` (`seed-demo.txt`,
`xv-jardin@1.0.0 HTTP 201 result=created templateVersionId=2`). Para los otros 10 paquetes, las dos
llamadas SÍ las hizo este agente y el patrón `201 → 200` quedó medido de punta a punta.

Comprobado con SQL directo (`SELECT count(*) FROM tpl_template_version`): 13 filas — las 12 de la
tabla más `xv-jardin@1.0.99`, que crea `scripts/smoke.sh` en su propia ruta de prueba (ajena a este
registro). Ninguna fila se duplicó entre la 1.ª y la 2.ª llamada de ningún paquete.

Los 12 `package_hash` que devolvió el backend coinciden **byte a byte** con los que calcula
`pnpm plantilla check` (columna 3 de la tabla): sin discrepancias.

## Catálogo del cliente

`GET /editor/templates2/catalog` (autenticado, `demo.master@example.com`) devuelve **11 items**, uno
por slug (la versión más alta de cada uno: `boda-clasica` sale como `1.0.1`, no `1.0.0`).
Filtro por `eventKind`:
- `?eventKind=wedding` → `boda-basica, boda-clasica, boda-premium, boda-premium-2` (4)
- `?eventKind=baptism` → `bautizo-elegante` (1)
- `?eventKind=quince` → `xv-elegance, xv-jardin` (2)

## Tiempo de alta de una plantilla

`bautizo-elegante@1.0.0`, primera vez, de punta a punta con `pnpm plantilla registrar` (incluye el
arranque de `pnpm`/`tsx`, no solo la llamada HTTP): **1.39 s reales** (`time`, ver
`registro-bautizo-elegante-1.0.0-1.txt`). El backend no se reinició, no se tocó Kotlin, no hubo
`gradlew` de por medio: es P4 cumplido y medido, no afirmado.

## Fallos encontrados

Ninguno. Los 12 registros dieron el código esperado en ambas llamadas, los 12 `package_hash`
coincidieron kit↔backend, y las 11 capturas + 22 imágenes de contacto se generaron sin error.

## Rutas exactas de las imágenes de contacto

```
docs/rediseno-plantillas/evidencia/fase-4/4-7/bautizo-elegante-movil.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/bautizo-elegante-escritorio.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/boda-basica-movil.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/boda-basica-escritorio.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/boda-premium-movil.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/boda-premium-escritorio.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/boda-premium-2-movil.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/boda-premium-2-escritorio.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/comunion-elegante-movil.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/comunion-elegante-escritorio.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/confirmacion-elegante-movil.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/confirmacion-elegante-escritorio.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/cumpleanos-elegante-movil.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/cumpleanos-elegante-escritorio.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/evento-elegante-movil.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/evento-elegante-escritorio.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/xv-elegance-movil.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/xv-elegance-escritorio.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/boda-clasica-movil.jpg          (plantilla 1.0.1, la publicada en catálogo)
docs/rediseno-plantillas/evidencia/fase-4/4-7/boda-clasica-escritorio.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/xv-jardin-movil.jpg
docs/rediseno-plantillas/evidencia/fase-4/4-7/xv-jardin-escritorio.jpg
```

Todas ≤ 2400 px de alto (ver el log de generación en cada nombre de fichero de arriba: la línea que
`contacto.mjs` imprimió con el tamaño final va en la bitácora).
