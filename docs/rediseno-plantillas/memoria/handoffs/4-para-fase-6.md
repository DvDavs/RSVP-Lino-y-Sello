# Fase 4 → fase 6 (arte de plantillas): cómo vestir una plantilla con el kit

Lee esto y `contratos.md §14`. No necesitas leer el código del kit: si lo necesitas, es un defecto
del kit y merece una issue.

## Lo que la fase 4 te deja
Una plantilla es un **paquete versionado e inmutable** en `frontend/templates/<slug>/<version>/`. Se
crea, se valida, se ve y se da de alta con `pnpm plantilla` (ocho comandos, `contratos.md §14.2`), sin
tocar Kotlin y sin reiniciar nada. Alta medida: **1,39 s**. La prueba ciega de la fase creó una
plantilla completa en **6 min 47 s**.

## El recorrido, en seis comandos (desde `frontend/`)
```bash
pnpm install                              # una vez; si falta, `plantilla` te lo dice y cómo
pnpm plantilla doctor                     # entorno: Node, backend, cuenta MASTER, Chromium
pnpm plantilla nueva <slug> --evento <tipo> --secciones <lista> --destino /tmp/taller
pnpm plantilla preview /tmp/taller/<slug>/1.0.0   # deja esta terminal abierta: se repinta al guardar
pnpm plantilla check  /tmp/taller/<slug>/1.0.0    # mide y escribe los digestos; 0 errores = registrable
pnpm plantilla capturas /tmp/taller/<slug>/1.0.0  # 3 PNG (390/768/1280), FUERA del paquete
pnpm plantilla registrar /tmp/taller/<slug>/1.0.0 # 201 la primera vez, 200 noop_same_hash la segunda
```
Dos que te ahorran abrir código: `pnpm plantilla secciones [<tipo>]` (qué huecos hay) y
`pnpm plantilla bloque [<tipo>]` (**la forma exacta** de un valor, con ejemplo copiable).

## Las compuertas que te van a parar (y son deliberadas)
Severidad completa en `contratos.md §14.3`. Las que más afectan al arte:
- **`TPL_PALETTE_CONTRAST_BELOW_AA`** — toda pareja de color debe cumplir WCAG 2.2 AA. No es
  negociable y no hay bandera para saltárselo: la paleta bonita que no cumple **no se registra**.
- **`TPL_FONT_NOT_SELF_HOSTED`** — solo las familias que el producto autoaloja. La lista **se deriva**
  de `apps/web/app/(public)/publico.css`: para añadir una familia, se añade su `@import` ahí y la
  compuerta la acepta sola. Hoy son cuatro; las nueve convertidas se remapearon a ellas (ADR-4-6-01) y
  la familia original de cada una está en `evidencia/fase-4/<slug>/informe-de-perdidas.json`, lista
  para restaurarse cuando la autoalojes.
- **`TPL_THIRD_PARTY_LINK` / `_BANK_DATA` / `_BRAND`** — el contenido de demostración no lleva datos de
  terceros: enlaces solo a `example.com`, datos bancarios con «(ejemplo)» en el propio texto.
- **`TPL_PACKAGE_UNEXPECTED_FILE`** — ni un fichero que el manifiesto no declare. Las capturas van
  fuera de la versión.
- **`TPL_LABEL_DE_ANDAMIO`** (aviso) — el `label` de un bloque **se publica** en algunas secciones. Si
  te queda la frase del andamio, el invitado la lee.
- Los `sha256`/`bytes` de cada asset **los mide `check`**: nunca los escribas a mano.

## Qué plantillas existen hoy y en qué estado visual están
| Plantilla | `eventKind` | Arte |
|---|---|---|
| `boda-clasica` | wedding | **con arte propio**: 9 assets, miniatura y juegos de demostración por paleta, generados por `frontend/templates/scripts/build-art.mjs` (SVG autoral → WebP, determinista) |
| `xv-jardin` | quince | **con arte propio**: 5 assets, miniatura, mismo generador |
| `boda-basica`, `boda-premium`, `boda-premium-2` | wedding | convertidas: **0 assets, sin miniatura**, 13-14 huecos de imagen vacíos cada una |
| `xv-elegance` | quince | convertida: 0 assets, 10 huecos |
| `bautizo-elegante` | baptism | convertida: 0 assets, 10 huecos |
| `comunion-elegante` | communion | convertida: 0 assets, 10 huecos |
| `confirmacion-elegante` | confirmation | convertida: 0 assets, 10 huecos |
| `cumpleanos-elegante` | birthday | convertida: 0 assets, 10 huecos |
| `evento-elegante` | generic | convertida: 0 assets, 11 huecos |
| `toga-y-sello` | graduation | nacida de la prueba ciega: 0 assets, 2 huecos |

Los **ocho** `eventKind` del esquema tienen ya al menos una plantilla. Ninguna de las convertidas
trae imágenes propias: en el catálogo de origen eran URLs externas que este entorno no alcanza.

## Qué falta de arte (el trabajo de la fase 6)
1. **Miniatura (`previewImage`) en 11 de las 13 versiones**: hoy solo `boda-clasica` y `xv-jardin`
   tienen. Sin miniatura, el catálogo del cliente enseña un hueco.
2. **~103 huecos de imagen vacíos** repartidos por las convertidas: en el previsualizador salen con el
   marcador «imagen pendiente · `<blockId>`» del kit (ADR-4-1B-03), y así se ven en las capturas.
3. **Las convertidas son correctas, no bonitas**: estructura, textos y accesibilidad en su sitio, pero
   sin dirección de arte propia. Son el catálogo de partida que hay que vestir, no el final.
4. La hoja de ruta pide **6-8 plantillas premium** con arte: las que vistas y las que crees nuevas
   salen por el mismo camino, el kit.

## Reglas al vestir
- **Una versión registrada es inmutable.** Para cambiar el arte de una plantilla ya publicada, se
  publica una versión nueva (`1.0.1`, `1.0.2`…), nunca se pisan sus bytes.
- El arte de las dos plantillas de diseño se **regenera**, no se edita: `build-art.mjs` es determinista
  y `--check` falla si alguien tocó un píxel a mano.
- Las plantillas tienen su **propio** sistema de tokens (`--inv-*`), separado del chrome del producto
  (`--ui-*`). No los mezcles: `guias/identidad-visual.md` es del producto, no de las plantillas.
