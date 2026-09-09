# Issues de fase 4 — media/baja, no corregidas en este encargo

Convención: severidad **media** (afecta a la calidad/seguridad de una plantilla pero no permite saltar
autorización, romper la inmutabilidad del registro ni ejecutar nada) o **baja** (defecto cosmético o de
mensaje, sin impacto de seguridad). Las de severidad **alta** encontradas por 4-ADV-2 se corrigieron en
el propio encargo (ver `bitacora/4-adv.md` y `decisiones.md` ADR-4-ADV-01) y no están aquí.

## I-4ADV-01 — `check` no mira `template.json`: datos de tercero escritos ahí no los cacen las tres compuertas de marca/enlace/dato bancario

- **Severidad**: media.
- **Dónde**: `frontend/packages/template-kit/src/check.ts:459-461` (las tres llamadas reciben `crudoDefaults`, nunca `crudo` del manifiesto) y las funciones que de verdad recorren el árbol: `revisarMarcaAjena` (línea 1031), `revisarEnlaceTercero` (línea 1081), `revisarDatoBancario` (línea 1134) — las tres solo bajan por `crudoDefaults["content"]`.
- **Cómo reproducirla**: encontrada por el agente anterior, `evidencia/fase-4/4-adv/check-sabotaje.txt` (`b1-terceros-en-template`): se copia un paquete correcto y se escribe la MISMA cadena de marca ajena (o URL, o CLABE) en un campo de texto de `template.json` (p. ej. `sections[i].blocks[j].label`) en vez de en `defaults.json`. `plantilla check` sigue devolviendo `0 error(es)`.
- **Riesgo**: `template.json` también acaba en `tpl_template_version.manifest` (columna `jsonb`, servida al editor) — un `label`, `help` o `title` con la marca del proveedor anterior, un negocio real o un dato bancario real pasaría a producción sin que ninguna compuerta lo vea.
- **Arreglo propuesto**: las tres funciones (`revisarMarcaAjena`/`revisarEnlaceTercero`/`revisarDatoBancario`) ya son genéricas en la forma del nodo (recorren cualquier `string` anidado); basta con llamarlas también sobre `crudo` (el manifiesto) además de sobre `crudoDefaults`, con un tercer parámetro que diga de qué archivo salió el hallazgo (hoy `puntero(DEFAULTS, …)` está fijo; hace falta parametrizarlo con `MANIFIESTO` cuando corresponda). Cuidado con los `label`/`help` traducidos (`Record<locale, string>`): el recorrido ya baja por objetos genéricos, así que debería alcanzarlos sin cambios adicionales.

## I-4ADV-02 — `TPL_THIRD_PARTY_LINK` exige un esquema (`http(s)://`): una URL de tercero sin esquema no se detecta

- **Severidad**: media.
- **Dónde**: `frontend/packages/template-kit/src/check.ts:1048` — `const RE_URL = /https?:\/\/[^\s"]+/g;`.
- **Cómo reproducirla**: `evidencia/fase-4/4-adv/check-sabotaje.txt` (`b3-url-sin-esquema`): un texto de `defaults.json` con `"Síguenos en www.facebook.com/algo"` (sin `http://` ni `https://`) da `0 error(es)`. (El sabotaje hermano `b2-url-mayusculas`, con el MISMO enlace pero con esquema `HTTPS://…`, sí lo detecta — pero por la compuerta de MARCA conocida, `TPL_THIRD_PARTY_BRAND`, que reconoce el nombre "Marck Luga" en la URL, no por `TPL_THIRD_PARTY_LINK`.)
- **Riesgo**: cualquier enlace de demostración escrito "a lo humano" (sin protocolo, como la gente realmente teclea `www.instagram.com/...` en un campo de texto) atraviesa la compuerta genérica sin que haga falta que el dominio ya esté en la lista cerrada de marcas conocidas (`MARCAS_AJENAS`, check.ts:995-1002) — que es justo el caso que 6b (la compuerta genérica) existe para cubrir cuando 6a (la lista cerrada) no alcanza.
- **Arreglo propuesto**: ampliar `RE_URL` para además capturar `www\.[^\s"]+` sin esquema (y resolver el host anteponiendo `https://` antes de `new URL(...)`), o normalizar el texto candidato antes de aplicar la regex. Cuidado con falsos positivos: un dominio interno o una ruta de archivo con puntos no debería dispararla — conviene exigir al menos un TLD conocido o un `/` después del host.

## I-4ADV-03 — Una CLABE con puntos entre los dígitos no la detecta el patrón de "número largo"

- **Severidad**: media.
- **Dónde**: `frontend/packages/template-kit/src/check.ts:1099` — `const RE_NUMERO_LARGO = /\d[\d\s-]*\d/g;` (la clase de caracteres admite dígito, espacio y guion, pero NO el punto).
- **Cómo reproducirla**: `evidencia/fase-4/4-adv/check-sabotaje.txt` (`b4-clabe-con-puntos`): `"CLABE: 1104.1234.5678"` da `0 error(es)` — el punto rompe el número largo en tres tiradas de 4 dígitos, ninguna llega a los 10 dígitos mínimos que exige `pareceDatoBancario` (línea 1101). El sabotaje hermano `b6-clabe-partida` (dígitos seguidos, sin puntos: `"110412345678"`) SÍ lo detecta, confirmando que el punto es exactamente el carácter que se cuela.
- **Riesgo**: una CLABE, cuenta o tarjeta real con el separador que casi todo el mundo usa al escribirla a mano (puntos cada 4 dígitos) pasa la compuerta pensada exactamente para atraparla.
- **Arreglo propuesto**: añadir `.` a la clase de caracteres de `RE_NUMERO_LARGO` (`/\d[\d\s.-]*\d/g`) — coherente con que `pareceDatoBancario` ya limpia todo lo que no sea dígito (`m.replace(/[^\d]/g, "")`) antes de contar, así que el único cambio es dejar que la regex NO corte la tirada en el punto.

## I-4ADV-04 — Un asset SVG con `<script>` dentro pasa `check` limpio; el kit solo mide su digesto

- **Severidad**: media (el previsualizador y `capturas` corren en un navegador local sin datos de usuario reales, así que el impacto práctico hoy es acotado; sería alta si el SVG llegara a servirse embebido — no `<img>` — en una superficie con sesión, algo que hoy no hace `packages/sections`, pero conviene cerrarlo en el propio formato de paquete).
- **Dónde**: `frontend/packages/template-kit/src/check.ts:597-644` (`revisarAssets`) — mide `sha256`/`bytes`/`contentType` (por extensión) de cada asset declarado y corrige el manifiesto si no coinciden (`TPL_ASSET_DIGEST_MEDIDO`, línea 632), pero nunca abre el contenido de un `.svg` para buscar `<script>`, `on*=` u otro vector activo.
- **Cómo reproducirla**: `evidencia/fase-4/4-adv/check-sabotaje.txt` (`b10-svg-con-script`): un `assets/fondo.svg` con `<script>alert(1)</script>` dentro del propio SVG da `0 error(es) · 1 corregido(s)` — el "corregido" es solo que el kit re-mide el digesto (que ahora sí coincide con el archivo saboteado) y lo escribe en el manifiesto, dándolo por bueno.
- **Riesgo**: un SVG es XML activo; si en algún momento se sirve con `Content-Type: image/svg+xml` fuera de un `<img>` (un `<object>`, un `background` en modo inline, o abierto directamente por el navegador — que es exactamente lo que hace `/__preview/asset/`, servido con ese mismo content-type), el script se ejecuta en el origen que lo sirve. Hoy `packages/sections` lo consume como `<img>` (que no ejecuta scripts SVG) — pero el paquete no impone esa garantía él mismo, y el registro tampoco.
- **Arreglo propuesto**: en `revisarAssets` (o antes, en un paso 6d hermano de 6a-6c), cuando `contentType === "image/svg+xml"`, decodificar los bytes como UTF-8 y rechazar (`TPL_ASSET_SVG_ACTIVE_CONTENT` o similar) si aparece `<script`, `on[a-z]+\s*=` en un atributo, o `<foreignObject`. Aplicar el mismo control en el backend (`TemplatePackageParser.comprobarAssets`, que ya mira el número mágico con `MagicBytes` — sería el sitio natural para añadir la comprobación de contenido activo del lado servidor, no solo del lado kit).

## I-4ADV-05 — El registro admite una versión SEMVER menor que la ya publicada del mismo slug, sin aviso

- **Severidad**: baja.
- **Dónde**: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/templates2/persistence/TemplateRegistrar.kt:190-196` (`comprobarDiff` compara siempre contra `versions.findLatestPublished` — la de mayor `(major, minor, patch)` — nunca contra "la última registrada por orden temporal", así que registrar una versión más baja después no lo detecta como anómalo).
- **Cómo reproducirla**: `evidencia/fase-4/4-adv/registro-auditoria.txt` §5c — con un slug fresco (`adv4-version-menor`) se registra `1.0.0` (`201`) y LUEGO `0.9.0` (`201` también, con `structuralDiff` vacío porque el contenido es idéntico). El catálogo queda con las dos versiones `published`; `GET /master/templates2/versions?slug=…` las lista ambas.
- **Riesgo**: bajo — nada se pisa ni se pierde (P1 sigue cumpliéndose: cada versión es su propia fila inmutable) y el catálogo sigue ofreciendo la de mayor versión a los documentos nuevos. Pero un typo humano de versión (`0.9.0` en vez de `1.9.0`, por ejemplo) se acepta sin ninguna señal más que un `201` silencioso — nadie avisa de que el slug ya tenía una versión más alta.
- **Arreglo propuesto**: en `TemplateRegistrar.register`, tras el paso 4 (idempotencia), si `versions.findLatestPublished(plantilla.id)` existe y su versión es MAYOR que la que se está registrando, añadir un aviso (`WARNING`, no bloqueante — no hay base para prohibirlo, un slug puede legítimamente recibir una versión histórica) en la respuesta y en la fila de auditoría, del estilo `"se registra 0.9.0 después de que 1.0.0 ya estuviera publicada"`. No amerita un código de error nuevo ni bloquear el alta.
