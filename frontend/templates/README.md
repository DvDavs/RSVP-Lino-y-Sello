# `frontend/templates/` — paquetes de plantilla

Cada subdirectorio es un **paquete de plantilla registrable**: `<slug>/<version>/` con
`template.json`, `theme.json`, `defaults.json` y, opcionalmente, `assets/` y `migrations/`. Es el
árbol exacto de `docs/rediseno-plantillas/diseno/01-dominio-y-esquema.md` §2.1 — cualquier archivo
fuera de ese árbol hace fallar el registro (`TPL_PACKAGE_UNEXPECTED_FILE`).

**No edites estos ficheros a mano.** Se crean y se validan con el kit de autor
(`pnpm plantilla`, en `frontend/packages/template-kit`); un `sha256`/`bytes` escrito a mano en vez de
medido por el kit es exactamente el defecto que `check` existe para atrapar (P5). Cómo agregar una
plantilla nueva, con cada comando y sus errores: `docs/rediseno-plantillas/guias/como-agregar-una-plantilla.md`.
Checklist antes de darla por buena: `docs/rediseno-plantillas/guias/checklist-plantilla.md`.

## De dónde sale cada plantilla

- **`boda-clasica` y `xv-jardin`** son plantillas de **diseño**, escritas a mano a partir de los
  ejemplos de forma de `docs/rediseno-plantillas/diseno/ejemplos/`. Su arte lo genera
  `scripts/build-art.mjs` (SVG autoral → WebP) y sus digestos los cose `scripts/build-packages.mjs` —
  ninguno de los dos dibuja ni inventa contenido, sólo miden lo que ya existe.
- **`toga-y-sello` (graduación) y `cumple-retro` (cumpleaños)** nacieron de las dos **pruebas
  ciegas** del kit: las creó, con `pnpm plantilla` y sin ver el código, un agente que sólo tenía la
  guía y el checklist delante (`memoria/bitacora/4-5.md` y `4-5b.md`). Son la demostración de que
  agregar una plantilla no toca Kotlin: la segunda salió en 2 min 44 s. Su arte está pendiente, como
  el de las convertidas.
- **El resto** (`bautizo-elegante`, `boda-basica`, `boda-premium`, `boda-premium-2`,
  `comunion-elegante`, `confirmacion-elegante`, `cumpleanos-elegante`, `evento-elegante`,
  `xv-elegance`) son el resultado de **convertir el catálogo antiguo** con
  `frontend/packages/migration-legacy` (249 reglas de conversión, con sus propias pruebas y golden
  files). Ninguna trae imágenes propias: en el catálogo de origen las imágenes eran URLs externas que
  este entorno no puede alcanzar, así que sus huecos de imagen quedan pendientes.

## `scripts/` (este directorio)

Utilidades **aisladas a propósito** del workspace pnpm de `frontend/` (`templates/package.json` no
entra en `pnpm-workspace.yaml`, para no tocar el `pnpm-lock.yaml` del resto del frontend — ADR-3-2d-01).
No son parte del recorrido de "agregar una plantilla" de la guía; sirven para regenerar el arte y los
paquetes de las dos plantillas de diseño a partir de sus ejemplos de forma.

## Qué se toca aquí y qué no

Crear o editar una plantilla se hace con `pnpm plantilla` (ver la guía) o, para `boda-clasica` /
`xv-jardin`, con `scripts/build-art.mjs` + `scripts/build-packages.mjs` sobre los ejemplos de
`docs/rediseno-plantillas/diseno/ejemplos/`. **Nunca** se edita a mano un `sha256`, unos `bytes` ni un
`package_hash`, y **nunca** se pisa una versión ya publicada (`boda-clasica/1.0.0` está publicada y
sembrada: trabaja sobre `1.0.1` si necesitas cambiarla).
