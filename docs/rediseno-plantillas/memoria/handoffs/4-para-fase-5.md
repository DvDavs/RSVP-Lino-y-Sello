# Fase 4 → fase 5 (producto): lo que necesitas del catálogo de plantillas

## Los endpoints que consume el producto
- **`GET /editor/templates2/catalog`** — el catálogo del cliente. Devuelve **una entrada por slug, con
  su versión más alta** (no una por versión). Roles `USER`, `ADMIN` o `MASTER`
  (`api/CatalogController.kt:23-24,36`). Filtro opcional **`?eventKind=<tipo>`**.
- **`POST /master/templates2/versions`** — alta de una versión. **Solo rol `MASTER`**
  (`api/MasterTemplateRegistryController.kt:35-36`). Es el camino del kit (`pnpm plantilla registrar`)
  y no hay otra vía de alta. `201 created` / `200 noop_same_hash` / `409` si ese `slug@version` ya está
  publicado con otro contenido. Detalle completo en `contratos.md §14.4`.
- **`POST /master/templates2/versions/{templateVersionId}:deprecate`** — retirar una versión del
  catálogo sin borrarla.
- El resto del editor y el render público no cambian con la fase 4.

## Cómo se siembran las plantillas en un entorno nuevo
`scripts/seed-demo.sh` registra **solo dos**: `boda-clasica` y `xv-jardin` (las de diseño, las que usa
la invitación de demostración). Las otras once **no las siembra nadie**: hay que registrarlas
explícitamente, y es una línea desde `frontend/`:

```bash
for d in ../frontend/templates/*/1.*/; do pnpm plantilla registrar "$d"; done   # idempotente
```

Es seguro repetirlo: cada paquete ya registrado responde `200 noop_same_hash`. **Si el catálogo de un
entorno nuevo aparece con dos plantillas, no está roto: le falta ese bucle.** Conviene que la fase 5
lo meta en el arranque del entorno de desarrollo.

## Los ocho `eventKind` y su plantilla
| `eventKind` | plantillas |
|---|---|
| `wedding` | `boda-clasica`, `boda-basica`, `boda-premium`, `boda-premium-2` |
| `quince` | `xv-jardin`, `xv-elegance` |
| `baptism` | `bautizo-elegante` |
| `communion` | `comunion-elegante` |
| `confirmation` | `confirmacion-elegante` |
| `birthday` | `cumpleanos-elegante` |
| `graduation` | `toga-y-sello` |
| `generic` | `evento-elegante` |

**Los ocho tipos del esquema tienen al menos una plantilla**: el asistente de creación no puede
quedarse sin catálogo para ningún tipo de evento.

## Sobre los identificadores de versión
El `templateVersionId` (1, 2, 4…13 en la sesión de registro de `handoffs/4-7.md`) **es de la base
donde se registró**, no del paquete: en un entorno nuevo se numeran solos, en el orden en que se
registren. **No los codifiques en ningún sitio.** La identidad estable de una plantilla es
`slug@version`, y su huella es el `package_hash` que imprime `pnpm plantilla check`. Los
`package_hash` publicados en `handoffs/4-6.md` y `4-7.md` **están desactualizados**: cambiaron al
limpiar marcas y datos de terceros (4-8, 4-9) y al reetiquetar el andamio (4-1C).

## Lo que el producto no debe hacer
- No dar de alta plantillas desde el frontend del cliente: el alta es `MASTER` y pasa por el kit.
- No pisar una versión publicada. Para cambiar una plantilla se publica una versión nueva.
- No copiar presentación al backend (P3): colores, tipografías y tamaños viven en el paquete.
