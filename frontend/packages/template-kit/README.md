# `@invitaciones/template-kit` — kit de autor de plantillas

CLI `plantilla`: crear, validar, registrar y diagnosticar paquetes de plantilla **sin tocar Kotlin,
sin reiniciar nada y sin escribir un solo digesto a mano** (P4, P5).

```bash
cd frontend
pnpm plantilla                       # la ayuda con todos los comandos
pnpm plantilla nueva mi-boda --evento wedding
pnpm plantilla check templates/mi-boda/1.0.0
pnpm plantilla registrar templates/mi-boda/1.0.0
pnpm plantilla doctor
```

## Comandos

| comando | qué hace |
|---|---|
| `nueva <slug> --evento <tipo> [--secciones a,b,c] [--destino <dir>] [--version <semver>] [--nombre <texto>] [--descripcion <texto>]` | Escribe `templates/<slug>/<version>/{template.json,theme.json,defaults.json}` válidos a la primera. |
| `check <dir> [--no-escribir] [--estricto] [--silencioso]` | Valida el paquete entero y **mide y escribe** los `sha256`/`bytes` de los assets. |
| `registrar <dir> [--raiz <dir>] [--sin-check]` | `check` y, si pasa, `POST /master/templates2/versions` con token MASTER. |
| `doctor` | Comprueba el entorno y dice cómo arreglar cada cosa que falte. |
| `secciones [<tipo>]` | Imprime el catálogo: variantes, huecos, roles y qué escribe el andamio. |
| `preview <dir> [--puerto <n>] [--paleta <id>] [--fuentes <id>] [--sin-marcadores]` | Levanta el previsualizador local y **se queda escuchando**: la plantilla con sus defaults, en móvil y escritorio a la vez, y se repinta al guardar cualquiera de los tres `.json`. |
| `capturas <dir> [--destino <dir>] [--anchos 390,768,1280] [--paleta <id>] [--seccion <clave>]` | Fotografía la plantilla con Chromium en tres anchos y escribe los PNG **fuera** del directorio de la versión. |

Códigos de salida: `0` todo bien · `1` el paquete o el entorno tienen fallos · `2` error de uso.

## Formato de los mensajes (contrato)

Cada hallazgo son **tres líneas y ninguna más**:

```
<SEVERIDAD> <CÓDIGO>  <fichero>#<puntero RFC 6901>
  <el problema, en una frase>
  Sugerencia: <qué escribir para arreglarlo, sin abrir código>
```

`SEVERIDAD` ∈ `ERROR` (el paquete no se registra), `AVISO` (el registro lo acepta pero
probablemente no es lo que querías) y `CORREGIDO` (lo ha arreglado el kit). El puntero es
`template.json#/sections/1/blocks/0/role`, pegable en un editor; `#$` significa el fichero entero.
La última línea de `check` es siempre `N error(es) · N aviso(s) · N corregido(s)`.

## Lo que el kit hace por ti, y lo que no

Hace: el árbol exacto de `01 §2.1`; el esquema y las 30 invariantes; los digestos de los assets
(medidos, nunca tecleados); `previewImage` entre los assets declarados; alias de assets (I-09);
rutas de asset seguras; un plan de migración por cada `migrationsFrom`; claves de `defaults.json`
que sean `blockId`; contraste WCAG 2.2 AA de las paletas (las 9 parejas), y dos avisos que el
registro **no** da: rol fuera de su tipo de sección (I-32 sin implementar, ADR-4-0B-04) y variante
que ningún componente sabe pintar.

No hace: imágenes (el andamio sale sin `assets/`; la miniatura se saca con `capturas` y se declara
a mano), ni diseño, ni textos de verdad, ni levanta el backend por ti (`doctor` dice cómo).

## Previsualizar: `preview` y `capturas`

```bash
cd frontend
pnpm plantilla preview templates/mi-boda/1.0.0    # deja esta terminal abierta; Ctrl+C para salir
pnpm plantilla capturas templates/mi-boda/1.0.0   # 3 PNG en templates/mi-boda/capturas/
```

`preview` levanta un servidor de Vite **dentro del kit** (`preview-app/`) que compone el paquete con
`compose()` de `@invitaciones/schema` y lo pinta con `SectionsRoot` de `@invitaciones/sections`. Sin
backend y sin base de datos: los assets salen del disco del propio paquete.

- **Los dos anchos a la vez.** Cada uno en su `<iframe>` (390 y 1280; 768 con un botón), porque las
  secciones deciden su diseño con `@media` y con `100svh`, que miran a la VENTANA: un `<div>` de
  390 px enseñaría el diseño de escritorio encogido (ADR-4-1B-02).
- **Se repinta al guardar** cualquiera de los tres `.json`, sin recargar la página (medido: 83 ms).
- **Si el paquete no pasa `check`, no hay página en blanco**: sale el diagnóstico con las mismas tres
  líneas de la terminal.
- **Puerto** de partida 5310; si está ocupado toma el siguiente y lo dice.
- **No escribe nada** dentro del paquete (`check --no-escribir`).

Lo que se ve y **no** está en el paquete, siempre anunciado en la salida: los huecos de imagen sin
valor llevan un marcador («imagen pendiente · `<blockId>`»; `--sin-marcadores` los deja vacíos, como
los verá un invitado) y la fecha y la hora son de demostración fijas, porque son `source: "business"`
y las pone Postgres (R4). Un grupo sin ítems en `defaults.json` sale vacío a propósito (R5).

`capturas` fotografía **ese mismo** previsualizador con Chromium en 390, 768 y 1280 px y escribe
`<slug>@<version>[-<seccion>]-<ancho>.png` en `<slug>/capturas/`, **hermano** del directorio de la
versión: un archivo no declarado dentro del paquete lo rechaza el registro con
`TPL_PACKAGE_UNEXPECTED_FILE`, así que un `--destino` que caiga dentro se rechaza antes de abrir el
navegador. **Nunca ejecuta `playwright install`**: Chromium está preinstalado y, si la revisión del
paquete no está en disco, cae a `$PLAYWRIGHT_BROWSERS_PATH/chromium`.

## De dónde sale cada cosa

- Vocabulario de secciones, huecos, roles y variantes: `@invitaciones/sections/catalog` (bloque 4-0B).
- Forma de cada rama del `oneOf`, roles, sugerencias y `explainBlockSpec`: `@invitaciones/schema`.
- `canonicalJson`: `@invitaciones/schema` (`src/compose.ts`), no una copia.
- Fórmula de contraste: `packages/sections/src/theme/contrast.ts`, por ruta relativa (mismo
  precedente que `packages/schema/test/paleta-contraste.contract.test.ts`).
- Subida HTTP: `docs/rediseno-plantillas/evidencia/fase-4/0a/registrar-http.sh` (bloque 4-0A).

## Pruebas

```bash
pnpm --filter @invitaciones/template-kit run test        # vitest run --coverage
pnpm --filter @invitaciones/template-kit run typecheck
```

`test/check-sabotajes.test.ts` rompe un paquete correcto de cinco maneras y compara los mensajes
**enteros**: si cambias un mensaje, esa prueba se pone roja a propósito.

`test/preview-capturas.test.ts` y `test/cli-preview-capturas.test.ts` levantan un servidor y un
Chromium de verdad, y por eso llevan un plazo **generoso** (240 s): comprueban HECHOS (hay tres PNG,
tienen estas dimensiones, el texto cambió sin recargar), nunca tiempos. Todo lo que puede probarse
sin navegador está en `test/componer-recursos.test.ts` y no se repite allí.
