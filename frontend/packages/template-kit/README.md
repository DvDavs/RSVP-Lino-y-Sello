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
| `preview <dir>` · `capturas <dir>` | Reservados: los entrega el bloque 4-1B. |

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

No hace: imágenes (el andamio sale sin `assets/`; la miniatura la pondrá `preview`, bloque 4-1B),
ni diseño, ni textos de verdad, ni levanta el backend por ti (`doctor` dice cómo).

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
