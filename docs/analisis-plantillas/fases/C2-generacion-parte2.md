# C2 — Núcleo de generación, parte 2 (líneas 829–2743)

Archivo auditado: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt` (2743 líneas + línea 2744 sin salto final).
Tramo leído íntegro por bloques: 820–1060, 1060–1300, 1300–1520, 1520–1740, 1740–1960, 1960–2210, 2210–2440, 2440–2670, 2664–2744. Además se leyó `mergeConfiguration` (90–181) y `mergeSettings/mergeCoverSection/mergeCoupleSection` (183–420) sólo como contexto.

Convención: **VERIFICADO** = leído en el código y/o contrastado con los JSON semilla del repo. **INFERIDO** = deducción lógica sobre código verificado. **NO DETERMINABLE** = depende del estado real de la BD (Mongo/Postgres) o de historia de cambios inexistente.

Nota transversal sobre historia: `git rev-list --count HEAD` = **1** (commit `d142778 feat: initial commit of Invitaciones backend`). **No es determinable** cuándo se comentó ningún bloque, quién lo hizo ni si la versión viva sustituyó a la comentada o al revés. Cualquier afirmación temporal sobre el código muerto queda fuera de alcance.

---

## 1. Resumen (≤10 líneas)

1. Toda la clase va de la línea 17 a la 2744: **nada de lo que parece "top-level" lo es**; `mergeGiftTableSection` (979), `createDefaultFamilyItem` (1828) y `createDefaultFamilyGroup` (1837) están en columna 0 pero siguen dentro de la clase (verificado contando llaves), así que acceden a los repositorios inyectados sin recibirlos por parámetro.
2. ~556 de las 1915 líneas del tramo (≈29%) son código comentado: tres funciones enteras duplicadas (gift table, family, suggestions) más un bloque alternativo de bank.
3. La `mergeGiftTableSection` viva **eliminó el fallback a `contentTemplate.giftRegistry`**: si el usuario no capturó mesa de regalos, la sección se emite **vacía y visible**.
4. `mergeFamilySection` viva empareja grupos por el **texto** del título (`contains("Padre")`). En los 5 JSON no-boda con `title.content = null` (bautizo, comunión, confirmación, cumpleaños, evento) **nunca empareja** y los padres/padrinos del usuario se descartan en silencio.
5. En bodas escribe sobre `templateItem.label`/`.text`, que en `default_visual_boda_premium.json` (tid 5) son `null` a nivel de grupo → los nombres de los padres tampoco se escriben; además asume `items[0]=novio` cuando ese JSON tiene `items[0]="(Padres de la Novia)"`.
6. `mergeStorySection` y `mergeFamilySection` devuelven la plantilla con **datos de demo** (la historia de "Santiago", "Raul Estrada Santiago", "Maria Gomez") cuando el usuario no capturó nada.
7. `mergeDressCodeSection` tiene ~110 líneas duplicadas byte a byte entre `"predefined"` y `"standard"`, y ~55 líneas inalcanzables tras el early-return de la 2281.
8. `usesSplitBankLayout` (1025) decide entre dos ramas **idénticas** (verificado por diff); su resultado es irrelevante.
9. `mergeConfiguration` fuerza `visibility = true` en las 11 secciones (líneas 103–177), pisando el `visibility:false` deliberado de `default_visual_boda_basico.json`.
10. Hardcodeos masivos: textos en español, `"fas fa-copy"`, `fontFamily = "Poppins"`, colores RGBA, una URL de S3 y magic numbers `templateId == 12L`.

---

## 2. Estructura del tramo: qué está dentro y fuera de la clase

Método de verificación: script de conteo de llaves ignorando comentarios y literales de cadena. La profundidad de anidación vuelve a 0 **una sola vez, en la línea 2744**. Por tanto `class DefaultConfigGeneratorService` (línea 17) abarca 17–2744 y **no hay ninguna función top-level en el archivo**. La `}` de la línea 1298 cierra el cuerpo de `mergeGiftTableSection` (profundidad 2→1), no la clase.

| Función | Líneas | Dentro/fuera de la clase | Viva/comentada | Llamada desde (archivo:línea) | Evidencia |
|---|---|---|---|---|---|
| `mergeGiftTableSection` | 829–976 | dentro (comentada) | **COMENTADA** | nadie | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:829` (`// private fun`), cierre en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:976` |
| `mergeGiftTableSection` | 979–1298 | **dentro** (indentada a col. 0, pero prof. de llaves = 1 al entrar) | **VIVA** | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:119` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:979` decl.; `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1298` cierre; script de llaves: `line 979: depth_before=1` |
| `normalizeGiftType` | 990–998 | local dentro de `mergeGiftTableSection` | viva | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1074` (`normalizeGiftType(item.type)`) | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:990` |
| `inferTemplateType` | 1000–1023 | local | viva | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1031`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1041` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1000` |
| `usesSplitBankLayout` | 1025–1027 | local | viva pero **inocua** | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1156` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1025`; ver §4 |
| `resolveTemplate` | 1029–1049 | local | viva | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1075` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1029` |
| `bodyFromTemplate` | 1057–1075 | local dentro del `mapIndexed` | viva | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1116,1125,1135,1141,1158-1219,1258` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1057` |
| `mergeFamilySection` | 1302–1636 | dentro (comentada) | **COMENTADA** | nadie | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1302`, cierre `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1636` |
| `getSubItemTemplate` | 1331–1333 | comentada | comentada | nadie | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1331` |
| `getGroupTemplate` | 1335 | comentada | comentada | nadie | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1335` |
| `mergeFamilySection` | 1639–1825 | dentro | **VIVA** | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:148` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1639` |
| `createDefaultFamilyItem` | 1828–1835 | **dentro** (col. 0, prof. 1) | viva pero **nunca llamada desde código vivo** | sólo `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1353,1362,1380,1389,1434,1471,1511,1566,1587` (todas comentadas) | grep completo sobre `src/main/kotlin` |
| `createDefaultFamilyGroup` | 1837–1842 | **dentro** (col. 0) | **nunca llamada desde código vivo** | sólo `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1442,1479,1521,1604,1621` (comentadas) | grep completo |
| `getFallbackFamilyText` | 1844–1850 | dentro | **nunca llamada, en ningún sitio** | — | grep en todo `src/main/kotlin`: 1 sola ocurrencia (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1844`, la definición) |
| `mergeAmenitiesSection` | 1852–1955 | dentro | VIVA | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:166` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1852` |
| `mergeSuggestionsSection` | 1957–2060 | dentro (comentada) | **COMENTADA** | nadie | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1957`, cierre `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2060` |
| `mergeSuggestionsSection` | 2062–2202 | dentro | **VIVA** | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:157` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2062` |
| `buildSecondBody` | 2074–2111 | local | viva pero condicionada a `templateId == 12L` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2130,2157,2178` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2074` |
| `mergeStorySection` | 2203–2269 | dentro | VIVA | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:130` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2203` |
| `mergeDressCodeSection` | 2271–2662 | dentro | VIVA | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:139` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2271` |
| `mergeStartedSection` | 2664–2691 | dentro | VIVA | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:173` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2664` |
| `createDefaultImageProperties` | 2693–2699 | dentro | VIVA | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:442,443,444` (mergeGallerySection, tramo C1) y `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2704-2706` | grep |
| `createDefaultEditImage` | 2701–2707 | dentro | VIVA | ver §4 (lista completa) | grep |
| `createDefaultTextProperties` | 2709–2718 | dentro | VIVA | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2725,2726,2727` únicamente | grep |
| `createDefaultEditText` | 2720–2728 | dentro | VIVA | ver §4 | grep |
| `createDefaultIconProperties` | 2730–2735 | dentro | VIVA | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2740,2741,2742` únicamente | grep |
| `createDefaultEditIcon` | 2737–2743 | dentro | VIVA | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:505` únicamente (tramo C1) | grep |

**Respuesta directa a la sospecha del brief**: la `mergeGiftTableSection` de la línea 979 **no** es una función top-level. La indentación a columna 0 es puramente cosmética; sigue siendo miembro de la clase y por eso puede usar `invitationGiftRegistryRepository` (línea 987) sin recibirlo por parámetro. Lo mismo aplica a `createDefaultFamilyItem`/`createDefaultFamilyGroup`. **VERIFICADO**.

---

## 3. Tabla sección × regla de merge

Nota común: **las 7 funciones abren con `if (visualX == null) return null`** (985, 1644, 1857, 2067, 2208, 2276, 2669). La plantilla visual es siempre condición necesaria; nunca se fabrica una sección desde cero.

| Sección | Entradas (visual / contenido / datos reales) | Regla de precedencia por campo | Dependencia posicional | Menos/más ítems | Comportamiento con `null` | Hardcodeos (resumen) | Riesgo | Evidencia |
|---|---|---|---|---|---|---|---|---|
| **GiftTable** `mergeGiftTableSection` | visual: estructura + estilos de `items`; contenido: **sólo `texts["giftTableTitle"]`**; real: `invitation_gift_registry` | **título de sección**: contenido → literal `"Mesa de Regalos"`. El `title.content` de la plantilla **ya no se consulta** (la versión comentada sí lo hacía, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:972`). **ítems**: 100% datos reales; la plantilla sólo aporta estilo (`body[i]` como base tipográfica) e `id`. El contenido por defecto **no participa**: `contentTemplate.giftRegistry` no aparece en ninguna línea viva del archivo. | `resolveTemplate` (1029) empareja **por tipo** con `firstOrNull`, y sólo cae a `items.getOrNull(index)` (1048) si nada empareja. `bodyFromTemplate` usa `template.body.getOrNull(bodyIndex) ?: template.body.firstOrNull()` (1066–1068). | **Menos datos que plantilla**: los ítems sobrantes de la plantilla **se pierden** (la salida tiene exactamente `userGiftRegistry.size` ítems, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1071`). **Cero datos**: `mapIndexed` sobre lista vacía → `items = emptyList()` y la sección se emite **visible y vacía**. **Más datos que plantilla**: se reutiliza el mismo template por tipo → **ids duplicados** (ver §9-3). | `visualGiftTable == null` → sección omitida (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:985` + `?.copy` en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:119-125`) | 9 literales `"msjN"`, `"Banco:"`, `"Titular:"`, `"Cuenta CLABE:"`, `"Número de tarjeta:"`, `"fas fa-copy"`, `"fa-solid fa-link"`, `"fa-solid fa-gift"`, `"MESA DIGITAL"`, `"DEPÓSITO O TRANSFERENCIA"`, `"LLUVIA DE SOBRES"`, `"Mesa de Regalos"` | **ALTO** | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:979-1298`; grep `contentTemplate.giftRegistry` → sólo líneas comentadas |
| **Family** `mergeFamilySection` | visual: grupos/ítems + `intro`; contenido: sólo **imágenes** de fallback (`parents.*.image`, `images.parents`, `images.godparents`); real: `invitation_parent`, `invitation_godparent`, frases `family_intro_*` | **intro**: frases reales → intro de la plantilla (con id inyectado). **nombres/labels**: reales → (nada). **fotos**: real → `contentTemplate.parents.*.image` → `contentTemplate.images.parents[...]` → `""`. Los `names` de `contentTemplate.parents` **nunca se usan** (sólo en `getFallbackFamilyText`, muerta). | **No-boda** (1683–1723): empareja por **texto** `title.content.contains("Padre"/"Padrino")`; dentro del grupo, `items?.getOrNull(index) ?: items?.firstOrNull()`. **Boda** (1747–1821): `items[0]`=novio, `items[1]`=novia, `drop(2)`=padrinos — **posicional puro**. | **Menos ítems en plantilla que padrinos**: `getOrNull(index) ?: firstOrNull()` (1802) reusa el primero → estilos repetidos. **Más ítems en plantilla**: en boda, `familyItems` sólo se llena con los grupos que hay datos, los demás se pierden salvo el `else if` de 1769/1795 que copia el ítem tal cual (placeholder de demo). | `visualFamily == null` → sección omitida (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1644`) | `"family_intro_"`, `"intro-$index"`, `"p-$index"`, `"gp-$index"`, `"f${2+index}"`, `"Padres de $groomName"`, `"la pareja"`, `"male"/"female"`, `"groom_mother"…`, `" & "` | **ALTO** | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1639-1825` |
| **Amenities** `mergeAmenitiesSection` | visual: `items` + `title`; contenido: `amenities[]` (rico) o `images.amenities[]`; real: `invitation_activity` | **título**: `texts["amenitiesTitle"]` → `visualAmenities.title.content` → `"Amenidades"`. **ítems**: reales → `contentTemplate.amenities` → `contentTemplate.images.amenities` → `visualAmenities.items` sin tocar (1945). | `items.getOrNull(index) ?: items.firstOrNull()` (1864, 1910, 1934); `body?.firstOrNull()` (1894, 1923) | La salida tiene tantos ítems como la **fuente ganadora**; el resto de la plantilla se descarta. El `body` se **colapsa a 1 elemento** (1894–1901, 1923–1926) aunque la plantilla traiga varios. | `visualAmenities == null` → omitida (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1857`) | `"Tel: "`, `" | "`, `"amenities-N"`, `"amenities-default-N"`, `"amenities-img-N"`, `"Amenidad"`, `"Amenidades"` | MEDIO | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1852-1955` |
| **Suggestions** `mergeSuggestionsSection` | igual que amenities pero con `recommendations` / `invitation_recommendation` | idéntica cadena; título → `"Recomendaciones"` | mismos `getOrNull(index) ?: firstOrNull()` (2116, 2150, 2172) | igual; **además** si `templateId == 12L` se **añade** un segundo body sintético (2129–2133, 2156–2160, 2177–2181) con estilos hardcodeados | omitida (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2067`) | `"msj-2"`, `"Ver recomendación"`, `"#"`, colores RGBA, `fontSize 16.0`, `templateId == 12L` | MEDIO-**ALTO** por el `12L` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2062-2202` |
| **Story** `mergeStorySection` | visual: `items`; contenido: `story[]` + `images.story[]`; real: `invitation_story` | En la práctica **sólo dos resultados**: si hay filas reales, gana el usuario campo a campo; si no hay, **devuelve la plantilla intacta** (2213) o `null`. La rama de `contentTemplate.story` (2240–2263) es **inalcanzable**. | `visualStory.items.getOrNull(index)` (2219) | Más filas que ítems de plantilla → `template = null` → `createDefaultEditImage/Text` (estilo genérico "Poppins" gris). Menos filas → ítems de plantilla **descartados**. | `visualStory == null` → omitida (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2208`). Si `visibility == false` **y** no hay filas → `null` (2213) | ninguno propio salvo los `createDefault*` | **ALTO** (fuga de datos de demo) | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2203-2269` |
| **DressCode** `mergeDressCodeSection` | visual: `items` (2 en todos los JSON) + `title`; contenido: `dressCode.women/men`; real: `invitation_dress_code` (**`.firstOrNull()`**, 2279) | **título**: `userDressCode.name` → `visualDressCode.title.content` → `texts["dressCodeTitle"]` → `"Código de Vestir"` (2329–2338). **ítems**: según `type` (`"link"`, `"predefined"`, `"standard"`, else). En `predefined`/`standard`: foto y descripción del usuario, título **hardcodeado** `"Mujeres"`/`"Hombres"`. | `visualDressCode.items.getOrNull(0)` = mujer, `getOrNull(1)` = hombre — **posicional puro**, repetido 16 veces | `"link"` genera **1 solo ítem** → si la plantilla tiene 2, el segundo desaparece. `predefined`/`standard` generan 1 o 2 según qué descripciones existan. Un `type` desconocido → `visualDressCode.items` sin tocar (2605). | `visualDressCode == null` → omitida (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2276`). Sin fila de usuario y `visibility == false` → `null` (2326) | `"Mujeres"`, `"Hombres"`, `"Código de Vestir"`, `"Código de Vestimenta"`, `"Haz clic en el botón para ver más detalles"`, **URL de S3** | **ALTO** | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2271-2662` |
| **Started** `mergeStartedSection` | visual: todo; contenido: `texts["rsvpTitle"]`, `rsvp["message"]`, `rsvp["note"]`, `images.backgrounds["rsvpBg"]`; real: **ninguno** | contenido → visual → literal. Es la única sección donde **el contenido por defecto gana siempre sobre la plantilla visual**. | ninguna | n/a (no hay listas) | omitida (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2669`) | `"Confirma tu asistencia"`, `"Por favor confirma tu asistencia antes del evento."` | BAJO | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2664-2691` |

### Datos de contraste usados (JSON semilla del repo)

`jq` sobre `src/main/resources/data/mongo/`:

| Archivo | templateId | gift | family | amen | sugg | story | dress |
|---|---|---|---|---|---|---|---|
| `default_visual_boda_basico.json` | 4 | 2 | 3 | 1 | 3 | 3 | 2 |
| `default_visual_boda_premium.json` | 5 | 4 | 3 | 1 | 3 | 3 | 2 |
| `default_visual_xv_premium.json` | 6 | 4 | 2 | 1 | 4 | **null** | 2 |
| `default_visual_bautizo.json` | 7 | 2 | 2 | 1 | 3 | **null** | 2 |
| `default_visual_comunion.json` | 8 | 2 | 2 | 1 | 3 | **null** | 2 |
| `default_visual_confirmacion.json` | 9 | 2 | 2 | 1 | 3 | **null** | 2 |
| `default_visual_cumpleanos.json` | 10 | 2 | 2 | 1 | 3 | **null** | 2 |
| `default_visual_boda_premium_2.json` | 11 | 3 | 2 | 4 | 4 | 4 | 2 |
| `default_visual_evento.json` | 13 | 2 | 2 | 1 | 3 | **null** | 2 |

`visibility` declarada en los JSON: todas `true` salvo `default_visual_boda_basico.json`, que trae `sectionDresscode:false, sectionSuggestions:false, sectionAmenities:false, sectionFamily:false, sectionStory:false`.

No existe JSON semilla con `templateId` 12 ni 14, y `default_visual_boda_premium_2.json` (tid 11) **está comentado** en el cargador (`src/main/kotlin/mx/evolutiondev/invitaciones/core/data/MongoDataInitializer.kt:36` y `src/main/kotlin/mx/evolutiondev/invitaciones/core/data/MongoDataInitializer.kt:48`).

---

## 4. Código muerto y duplicados

### 4.1 Inventario completo de bloques comentados del tramo

Detectado con script (bloques contiguos de ≥3 líneas que empiezan por `//`):

| Líneas | Tamaño | Qué es |
|---|---|---|
| 829–976 | 136 líneas comentadas | `mergeGiftTableSection` versión antigua completa |
| 1077–1079, 1083–1085, 1104–1106, 1109–1111, 1152–1154, 1253–1255 | 3+3+3+3+3+3 | banners decorativos (`// ====`), inofensivos |
| **1221–1248** | 28 líneas | layout de bank alternativo de 4 líneas (`"Banco: ${item.bank}"` concatenado), dentro de la rama `else` de `usesSplitBankLayout` |
| 1302–1636 | 297 líneas | `mergeFamilySection` versión antigua completa, con `getSubItemTemplate` (1331) y `getGroupTemplate` (1335) |
| 1957–2060 | 95 líneas | `mergeSuggestionsSection` versión antigua completa |

Total ≈ **556 líneas comentadas sobre 1915** del tramo (≈29%). Fuera del tramo hay además `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:58-68` (`contentTemplate` antiguo).

### 4.2 `mergeGiftTableSection`: comentada (829–976) vs viva (979–1298)

**Se ejecuta la viva** (979). `mergeConfiguration` la llama en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:119`. Ambas están **dentro de la clase**; ninguna recibe repositorios por parámetro, las dos usan `invitationGiftRegistryRepository` del constructor (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:836` comentada, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:987` viva).

| Aspecto | Comentada (829–976) | Viva (979–1298) | Evidencia |
|---|---|---|---|
| Fuente de ítems si el usuario **no** capturó nada | `contentTemplate.giftRegistry.mapIndexed{…}` — genera ítems con las mesas por defecto del JSON de contenido | **nada**: `userGiftRegistry.mapIndexed` sobre lista vacía → `emptyList()` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:899` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1071` |
| Fallback del título de sección | `texts["giftTableTitle"] ?: visualGiftTable.title.content ?: "Mesa de Regalos"` | `texts["giftTableTitle"] ?: "Mesa de Regalos"` — **pierde el título de la plantilla** | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:972` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1293-1294` |
| Emparejamiento plantilla↔ítem | posicional puro: `visualGiftTable.items.getOrNull(index)` | por tipo inferido (`resolveTemplate`, 1029), con caída a posicional | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:840` / `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:900` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1029-1049` |
| Tipos reconocidos | `"cash","bank","deposit"` → icono `copy`; `"store","link"` → icono `open` | `"bankaccount","cuenta","bank"→bank`; `"fisico","physical"→fisico`; `"digital"→digital`; **cualquier otro → body vacío** | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:848-852` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:990-998` + `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1265` (`else -> emptyList()`) |
| Estructura del body de banco | 1 body con el mensaje del usuario | **9 bodies fijos** (`msj1..msj9`) con etiquetas y datos separados | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:855-880` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1155-1223` |
| `type` del ítem generado | `template?.type` (el de la plantilla) | `type` **normalizado del usuario** | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:884` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1283` |
| `linkHref` | `item.giftRegistryUrl ?: template?.linkHref` | **siempre `null`** (comentario `// ❌ eliminado completamente`) | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:894` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1286-1287` |
| Imagen | `item.photo?.takeIf{isNotBlank} ?: ""` | `if (item.photo == "otro") "" else item.photo ?: ""` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:890` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1080-1081` |

**Rama `usesSplitBankLayout` inocua**: se comprobó por diff (normalizando espacios) que el `listOf(...)` de `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1157-1185` y el de `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1189-1220` son **idénticos byte a byte**. `usesSplitBankLayout(template)` (1025, `body.size >= 6`) se calcula y su resultado no cambia nada. **VERIFICADO**.

### 4.3 `mergeFamilySection`: comentada (1302–1636) vs viva (1639–1825)

**Se ejecuta la viva** (1639), llamada desde `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:148`. Ambas dentro de la clase.

| Aspecto | Comentada (1302–1636) | Viva (1639–1825) | Evidencia |
|---|---|---|---|
| Sin padres ni padrinos | **Construye** grupos con `contentTemplate.parents.bride/groom.names` y las imágenes por defecto | `return visualFamily.copy(visibility = true, intro = mergedIntro)` — **devuelve los placeholders de demo de la plantilla** | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1338-1403` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1676-1678` |
| Etiquetas de padre/madre (no-boda) | `when(type){"mother"->"Madre";"father"->"Padre"}` | `parent.type.replaceFirstChar{uppercase}` → **"Mother"/"Father" en inglés** | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1505-1509` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1697` |
| Emparejamiento de grupos (no-boda) | posicional: `visualFamily.items.getOrNull(0)` padres, `getOrNull(1)` padrinos | **por texto del título**: `title.content.contains("Padre"/"Padrino")` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1491`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1618` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1685`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1703` |
| Títulos de grupo | los reescribe (`"Mis Padres"`, `"PADRES DEL NOVIO"` si `templateId==11L`) | **no toca `title`** en la rama no-boda; en boda escribe `label`, no `title` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1350,1445,1524` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1701,1719,1763,1789` |
| Padrinos "pareja" | separa `names.split("|")` en varios ítems y genera títulos "Padrino/Madrina/Padrinos de X" según `gender` | **ignora `gender` y `isCouple`**: un solo ítem con `names` completo | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1552-1600` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1801-1821` |
| Intro | `phrases["intro"]` / `texts["familyIntro"]`, sólo sustituye el índice 0 | frases `family_intro_N` ordenadas, `mapIndexed` completo + inyección de `id` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1317-1328` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1649-1674` |
| `title` de la sección | fuerza `"Mi familia"` si falta | **no toca** `visualFamily.title` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1631-1633` vs (ausente) |
| Helpers | usa `createDefaultFamilyItem`/`createDefaultFamilyGroup` | **no los usa** → quedan huérfanos | grep §2 |

### 4.4 `mergeSuggestionsSection`: comentada (1957–2060) vs viva (2062–2202)

**Se ejecuta la viva** (2062), llamada desde `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:157`. Ambas dentro de la clase.

| Aspecto | Comentada | Viva | Evidencia |
|---|---|---|---|
| Diferencia funcional principal | ninguna en la cadena de precedencia | **añade `buildSecondBody`** (botón "Ver recomendación") **sólo si `templateId == 12L`** | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2129-2133`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2156-2160`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2177-2181` |
| Fallback por imágenes | `body = templateItem?.body ?: emptyList()` (conserva el body de la plantilla) | `firstBody.copy(content = "", url = null)` — **vacía el texto** del body de la plantilla | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2045` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2173-2174` |
| id en fallback rico | `"rec-default-${index+1}"` | igual | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2017` / `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2163` |

El resto (bodyParts, `"Tel: "`, `" | "`, títulos) es idéntico. La versión comentada es esencialmente la viva **menos** el parche de `templateId == 12L`.

### 4.5 Funciones definidas y nunca llamadas (grep sobre todo `src/main/kotlin`)

| Función | Línea | Estado |
|---|---|---|
| `getFallbackFamilyText` | 1844–1850 | **0 llamadas en todo el proyecto**. Muerta total. |
| `createDefaultFamilyItem` | 1828–1835 | 9 referencias, **todas dentro de comentarios**. Muerta. |
| `createDefaultFamilyGroup` | 1837–1842 | 5 referencias, **todas dentro de comentarios**. Muerta. |
| `usesSplitBankLayout` | 1025–1027 | 1 llamada (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1156`) pero **ambas ramas idénticas** → efecto nulo. |
| `buildSecondBody` | 2074–2111 | 3 llamadas, todas tras `templateId == 12L`; **inalcanzable con los datos semilla del repo** (no hay visual config con tid 12). NO DETERMINABLE en producción. |
| parámetro `id` de `createDefaultEditText(content, id = null)` | 2720 | **ningún call-site lo pasa** (verificado con grep de las 60 ocurrencias). Parámetro muerto. |
| valor por defecto `id: String = "msj${bodyIndex+1}"` de `bodyFromTemplate` | 1062 | **ningún call-site lo omite**. Default muerto. |

### 4.6 Duplicación masiva dentro de `mergeDressCodeSection`

- Ramas `"predefined"` (2379–2491) y `"standard"` (2492–2603): **idénticas byte a byte** una vez normalizados espacios, comentarios y el nombre de la variable local (`predefinedItems`/`standardItems`). Verificado con `diff`. ≈110 líneas duplicadas para nada; el `when` no distingue nada entre esos dos valores.
- Bloque de fallback a `contentTemplate.dressCode` (2 `DressCodeItem` mujer/hombre) aparece **cuatro veces**: 2285–2313, 2444–2484, 2556–2596, 2609–2656.

### 4.7 Código inalcanzable (no comentado, pero muerto por flujo)

| Líneas | Por qué es inalcanzable | Evidencia |
|---|---|---|
| 2240–2266 (`else if (contentTemplate.story != null)` y su `else`) | el early-return de `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2212` ya cubrió `userStory.isEmpty()`, así que `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2217 userStory.isNotEmpty()` es **siempre true** | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2212-2214` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2217`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2240`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2264` |
| 2608–2659 (`else if (contentTemplate.dressCode != null)` y su `else`) | el early-return de `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2281` ya cubrió `userDressCode == null`; el smart-cast hace `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2341 if (userDressCode != null)` **siempre true** | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2281-2327` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2341`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2608`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2657` |
| ~55 líneas en dresscode + ~27 en story | — | — |

Consecuencia práctica: **`contentTemplate.story` no se usa nunca** en generación, y `contentTemplate.dressCode` sólo se usa en la rama "sin fila de usuario" (2285) y en el título.

**No es determinable desde cuándo existen estas duplicaciones**: el repositorio tiene un único commit (`git rev-list --count HEAD` = 1), `git log`/`git blame` no aportan historia.

---

## 5. Visibilidad forzada

No hay ni un solo `visibility = false` en el archivo (grep). Sí hay 12 forzados a `true`.

| Línea | Sección | Expresión | Qué pisa |
|---|---|---|---|
| `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:103` | Cover | `?.copy(visibility = true)` | (tramo C1) |
| `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:110` | Couple | `?.copy(visibility = true)` | (tramo C1) |
| `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:117` | Gallery | `?.copy(visibility = true)` | (tramo C1) |
| `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:120` | Event | `?.copy(visibility = true)` | (tramo C1) |
| **`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:127`** | **GiftTable** | `?.copy(visibility = true)` | Pisa `visibility` de la plantilla. Combinado con `items = emptyList()` (§9-1) produce una sección **visible y vacía**. |
| **`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:135`** | **Story** | `?.copy(visibility = true)` | Redundante en el camino "sin datos" (allí ya se filtró por `visibility == true` en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2213`), pero pisa la plantilla en el camino "con datos". |
| **`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:144`** | **DressCode** | `?.copy(visibility = true)` | Igual: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2282` ya filtró, pero fuerza `true` cuando sí hay fila de usuario aunque la plantilla dijera `false`. |
| **`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:153`** | **Family** | `?.copy(visibility = true)` | Pisa `sectionFamily.visibility:false` de `default_visual_boda_basico.json`. |
| **`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:162`** | **Suggestions** | `?.copy(visibility = true)` | Pisa `sectionSuggestions.visibility:false` del básico. |
| **`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:171`** | **Amenities** | `?.copy(visibility = true)` | Pisa `sectionAmenities.visibility:false` del básico. |
| **`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:177`** | **Started** | `?.copy(visibility = true)` | Sección RSVP: siempre visible. |
| **`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1677`** | **Family** (dentro de la propia función) | `visualFamily.copy(visibility = true, intro = mergedIntro)` | **Doble forzado**. Es el que hace que en el plan Básico (tid 4, `sectionFamily.visibility:false`) la sección de familia aparezca **con los nombres de demo** aunque la plantilla la ocultara y el usuario no capturara nada. |

**Asimetría verificada de política "sin datos del usuario"**, misma situación tratada de tres formas distintas:
- Family (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1676-1678`): devuelve la plantilla y **fuerza visible**.
- Story (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2212-2214`): devuelve la plantilla **sólo si** la plantilla ya era visible; si no, `null`.
- DressCode (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2281-2327`): devuelve datos de contenido **sólo si** la plantilla era visible; si no, `null`.
- Amenities/Suggestions (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1905-1947`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2147-2194`): siempre devuelven algo, sin consultar `visibility`.

**Casos donde se fuerza `false`**: ninguno explícito. El equivalente funcional (`null` → la sección desaparece del JSON) ocurre en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2213`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2326` y en las 5 puertas de módulos extra de `mergeConfiguration`.

---

## 6. Módulos extra

**Dónde entran.** `mergeConfiguration` (src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:96) lee `invitation.extraModulesIncluded` (columna de `InvitationEntity` (src/main/kotlin/mx/evolutiondev/invitaciones/modules/admin/invitations/repository/model/InvitationEntity.kt:87)). Cinco secciones del tramo quedan detrás de una puerta:

| Sección | Puerta | Línea |
|---|---|---|
| Story | `extraModules.contains(ExtraModuleType.OUR_STORY)` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:129` |
| DressCode | `…DRESS_CODE` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:138` |
| Family | `…PARENTS_AND_GODPARENTS` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:147` |
| Suggestions | `…RECOMMENDATIONS` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:156` |
| Amenities | `…AMENITIES_AND_ACTIVITIES` | `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:165` |

**GiftTable (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:118`) y Started (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:172`) NO están detrás de ninguna puerta.**

**Quién rellena `extraModulesIncluded`.** `ExtraModuleHelper.resolveExtraModules` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModuleHelper.kt:9`), invocado en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/admin/invitations/service/InvitationAdminService.kt:156` y `src/main/kotlin/mx/evolutiondev/invitaciones/modules/admin/invitations/service/InvitationAdminService.kt:410` y en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationService.kt:62`. Su primera regla (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModuleHelper.kt:10-14`):

```kotlin
val isPremiumPlan = template?.invitationPlan?.isPremium == true
if (isPremiumPlan) { return ExtraModuleType.values().toList() }
```

Con `src/main/resources/db/migration/V1__initial_schema.sql:1091-1093` (plan 2 = "Premium", `is_premium = t`), **toda invitación de plan Premium recibe los 5 módulos**, contrate lo que contrate el cliente. Sólo el plan Básico (id 1) usa la lógica opt-in de `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModuleHelper.kt:16-25`.

**`ExtraModulesHandler`** (`ExtraModulesHandler.kt`) no participa en la generación: sólo **persiste** en Postgres lo que el cliente envió (`save`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModulesHandler.kt:21-218`) y lo lee de vuelta para la API de detalle (`getExtraModulesOrNull`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModulesHandler.kt:221`). El generador vuelve a leer esas mismas tablas por repositorio. Dos detalles relevantes que fija el handler y que el tramo consume:
- `type` de padres: `"mother"`/`"father"` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModulesHandler.kt:89`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModulesHandler.kt:99`) o `"bride_mother"`/`"bride_father"`/`"groom_mother"`/`"groom_father"` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModulesHandler.kt:112,122,135,145`). Esto es lo que `mergeFamilySection` (src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1697) acaba pintando como **"Mother"/"Father"**.
- El dress code `"predefined"` ya se resuelve **al guardar** contra `masterDressCodeRepository` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModulesHandler.kt:181-200`), copiando `womanDescription/womanImage/manDescription/manImage` a `invitation_dress_code`. Por eso `mergeDressCodeSection` **no necesita** `modules/master/dresscodes/**` ni `DressCodeKtx.kt` — y en efecto no los importa (verificado en los imports `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1-14` del generador). `DressCodeKtx.toDressCodeMap` es de la capa de presentación, ajena a este tramo.

**Módulo contratado pero la plantilla no trae la sección** → `mergeXSection` devuelve `null` en su primera línea, el `?.copy(visibility=true)` cortocircuita y el campo queda `null` en `InvitationConfig`. **Se omite en silencio, no revienta.** Caso real y masivo: `sectionStory` es `null` en los JSON de tid 6, 7, 8, 9, 10 y 13 — todos plan Premium, es decir **todos con `OUR_STORY` incluido por `resolveExtraModules`**. El cliente "tiene" el módulo Nuestra Historia y la sección nunca se genera. VERIFICADO contra los JSON semilla; NO DETERMINABLE si el Mongo de producción tiene esos documentos parcheados.

**Plantilla trae la sección pero el módulo no está contratado** → `mergeConfiguration` pone `null` directamente (ramas `else null` de `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:136, 145, 154, 163, 172`). Se **descarta toda la sección de la plantilla**, incluida su maquetación. Es el caso del plan Básico (tid 4), cuyo JSON sí trae `sectionStory` con 3 ítems, `sectionFamily` con 3, etc.

**Interacción no evidente**: como las secciones se pierden en la generación y `InvitationConfigService.getConfig` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationConfigService.kt:136-165`) sólo genera **una vez** y luego devuelve el documento guardado sin regenerar, **contratar un módulo extra después de la primera lectura del editor no hace aparecer la sección**. Sólo `saveOrUpdateConfig` reescribe, y lo hace con lo que mande el frontend. VERIFICADO (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationConfigService.kt:138-151`).

---

## 7. Inventario de hardcodeos

Extraído con script sobre las líneas 829–2743 excluyendo comentarios. `mergeDressCodeSection` inventariada íntegra.

### 7.1 GiftTable (979–1298)

| Línea | Tipo | Valor | Sección | Consecuencia si cambia la plantilla |
|---|---|---|---|---|
| 993 | when-string | `"bankaccount","cuenta","bank" -> "bank"` | gift | tipos nuevos en Postgres caen al `else` y generan body vacío |
| 994 | when-string | `"fisico","physical" -> "fisico"` | gift | ídem |
| 995 | when-string | `"digital" -> "digital"` | gift | ídem |
| 1009 | heurística texto | `listOf("banco","titular","clabe","tarjeta","cuenta")` | gift | si la plantilla traduce/reescribe el body, el tipo inferido cambia y se empareja mal |
| 1013 | heurística texto | `listOf("lluvia","sobre","obsequio","regalo")` | gift | ídem |
| 1018–1020 | when | `"bank"/"digital"/"fisico"` | gift | — |
| 1025 | umbral numérico | `body.size >= 6` | gift | irrelevante: ambas ramas iguales |
| 1032 | id/tipo | `"otro"` | gift | sólo alcanzable si un template declara `type:"otro"`; ninguno lo hace |
| 1062 | id | `"msj${bodyIndex+1}"` (default muerto) | gift | — |
| 1081 | centinela | `"otro"` (foto) | gift | si el front deja de mandar `"otro"`, la foto se copia literalmente |
| 1089, 1113 | centinela | `"otro"` (nombre) | gift | — |
| 1090, 1092 | texto | `"MESA DIGITAL"` | gift | se cuela en el título (ver §9-4) |
| 1094 | texto | `"Mesa de $name"` | gift | genera `"Mesa de MESA DIGITAL"` |
| 1097 | texto | `"DEPÓSITO O TRANSFERENCIA"` | gift | ignora el `title.content` de la plantilla |
| 1099 | texto | `"LLUVIA DE SOBRES"` | gift | ídem |
| 1122,1129,1139,1146 | id | `"msj1"`, `"msj2"` | gift | el front depende de estos ids |
| 1144 | icono FA | `"fa-solid fa-link"` | gift | pisa el icono de la plantilla (`fas fa-external-link-alt` en tid 4) |
| 1159,1192 | texto | `"Banco:"` | gift | idioma fijo |
| 1162,1195 | texto | `"Titular:"` | gift | idioma fijo |
| 1171,1204 | texto | `"Cuenta CLABE:"` | gift | idioma fijo |
| 1180,1213 | texto | `"Número de tarjeta:"` | gift | idioma fijo, **y repite `accountNumber`** (§9-6) |
| 1160,1167,1176,1185,1193,1200,1209,1218 | icono FA | `"fas fa-copy"` | gift | pisa el icono de la plantilla |
| 1158–1219 | ids | `"msj1"`…`"msj9"` | gift | **estructura fija de 9 bodies** aunque la plantilla tenga 4 (tid 4, tid 11) |
| 1262 | icono FA | `"fa-solid fa-gift"` | gift | pisa el icono de la plantilla |
| 1260 | id | `"msj1"` | gift | — |
| 1287 | valor fijo | `linkHref = null` | gift | anula el `linkHref:"#"` de tid 11 |
| 1294 | texto | `"Mesa de Regalos"` | gift | pisa `"MESA DE REGALOS"` de tid 11 |

### 7.2 Family (1639–1825)

| Línea | Tipo | Valor | Consecuencia |
|---|---|---|---|
| 1651, 1653 | prefijo id | `"family_intro_"` | acoplado a `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModulesHandler.kt:75` |
| 1661, 1672 | id | `"intro-$index"` | acoplado a `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModulesHandler.kt:292` |
| 1680 | magic number | `eventTypeId == 1L` (boda) | si se añade otro tipo tipo-boda hay que tocar código |
| **1685** | **matching por texto** | `title.content.contains("Padre", ignoreCase)` | **rompe con títulos `null` o en otro idioma** (5 plantillas afectadas) |
| **1703** | **matching por texto** | `title.content.contains("Padrino", ignoreCase)` | ídem |
| 1690, 1691 | claves de mapa | `"mother"`, `"father"` | acoplado a las claves de `images.parents` del JSON de contenido |
| 1694, 1712 | id | `"p-$index"`, `"gp-$index"` | pisan el id de la plantilla sólo si el template no tiene id |
| **1697** | **género/idioma** | `parent.type.replaceFirstChar{uppercase}` → **"Mother"/"Father"** | etiqueta en inglés en un producto en español |
| 1715 | dato crudo | `godparent.type` sin formatear | muestra el tipo tal cual lo escribió el usuario |
| 1727, 1728 | género | `"male"` / `"female"` | acoplado a `InvitationPersonEntity.gender` |
| 1730–1733 | tipos | `"groom_mother"`, `"groom_father"`, `"bride_mother"`, `"bride_father"` | acoplado a `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModulesHandler.kt:112-145` |
| 1738, 1743 | separador | `" & "` | idioma/estilo fijo |
| 1747, 1769 | índice | `visualFamily.items[0]` = padres del novio | **contradice el orden real de tid 5** (§9-2) |
| 1773, 1795 | índice | `visualFamily.items[1]` = padres de la novia | ídem |
| 1749, 1775 | texto | `"la pareja"` | fallback si no hay persona con `gender` male/female |
| 1753–1756, 1779–1782 | claves | `"groom_mother"`, `"groom_father"`, `"mother"`, `"father"` | ninguna existe en los JSON de contenido salvo `mother`/`father` |
| 1763, 1789 | texto | `"Padres de $groomName"` / `"Padres de $brideName"` | idioma fijo |
| 1799 | índice | `visualFamily.items.drop(2)` = padrinos | posicional puro |
| 1813 | id | `"f${2 + index}"` | acoplado al esquema de ids `f0,f1,f2…` de tid 5 |
| 1834 | valor fijo | `showImage = true` (en `createDefaultFamilyItem`, muerta) | — |
| 1695, 1713, 1766, 1792, 1817 | valor fijo | `showImage = true` | fuerza mostrar imagen; los JSON no-boda traen `showImage:null` a nivel de grupo |
| 1846, 1847 | when-index | `0 -> bride.names`, `1 -> groom.names` | en función muerta; **además invertido** respecto a `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1747` |

### 7.3 Amenities (1852–1955)

| Línea | Tipo | Valor | Consecuencia |
|---|---|---|---|
| 1872 | texto | `"Tel: ${activity.phone}"` | idioma fijo |
| 1877, 2123 | separador | `" | "` | el front recibe los tres campos concatenados en un único texto |
| 1880 | id | `"amenities-${index+1}"` | **pisa siempre el id de la plantilla** (distinto criterio que suggestions, §9-9) |
| 1911 | id | `"amenities-default-${index+1}"` | ídem |
| 1917 | texto | `"Amenidad"` (si `item.type` es null) | idioma fijo |
| 1935 | id | `"amenities-img-${index+1}"` | ídem |
| 1939 | texto | `"Amenidad"` | ídem |
| 1951 | texto | `"Amenidades"` | último fallback del título |

### 7.4 Suggestions (2062–2202)

| Línea | Tipo | Valor | Consecuencia |
|---|---|---|---|
| **2069, 2129, 2156, 2177** | **magic number** | `templateId == 12L` | **rama de layout específica de una plantilla identificada por id numérico**; no hay JSON semilla con tid 12 |
| 2079 | id | `"msj-2"` (nota: guion, no como `"msjN"` de gift) | inconsistencia de convención de ids en el mismo archivo |
| 2080 | icono | `icon = ""` | borra el icono de la plantilla |
| 2081 | texto | `"Ver recomendación"` | idioma fijo |
| 2082 | url | `"#"` | **botón que no lleva a ninguna parte**, aunque `recommendation.url` exista |
| 2084, 2093, 2102 | estilo | `fontAlign = "center"` | pisa el alineado de la plantilla |
| 2085, 2094, 2103 | estilo | `fontStyle = emptyList()` | borra negritas/cursivas de la plantilla |
| 2086, 2095, 2104 | tamaño | `fontSize = 16.0` | pisa el tamaño de la plantilla en md/sm/xs |
| 2087 | tamaño | `lineHeight = 27.0` (md) | ídem |
| 2096, 2105 | tamaño | `lineHeight = 18.0` (sm/xs) | ídem |
| 2088, 2097, 2106 | margen | `listOf(10.0, 0.0, 10.0, 0.0)` | ídem |
| 2089, 2098, 2107 | **color** | `listOf(192.0, 223.0, 250.0, 1.0)` | color de marca de una plantilla concreta, en Kotlin |
| 2090, 2099, 2108 | **color** | `listOf(65.0, 84.0, 116.0, 1.0)` | fondo de marca, en Kotlin |
| 2121 | texto | `"Tel: "` | idioma fijo |
| 2163 | id | `"rec-default-${index+1}"` | — |
| 2165, 2186 | texto | `"Recomendación"` | idioma fijo |
| 2198 | texto | `"Recomendaciones"` | último fallback del título |

### 7.5 Story (2203–2269)

Sin literales propios. Sólo hereda los de `createDefaultEditImage/Text`.

### 7.6 DressCode (2271–2662) — inventario íntegro

| Línea | Tipo | Valor | Consecuencia |
|---|---|---|---|
| 2279 | selección | `.firstOrNull()` sobre `findAllByInvitationId` | **si hubiera más de una fila de dress code, todas menos la primera se ignoran** (no lanza) |
| 2282 | condición | `visibility == true` | comparación redundante: `SectionDressCodeData.visibility` es `Boolean` no nulo (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/model/editor/EditorModels.kt:461`) |
| 2288–2311 | when-index | `items.getOrNull(0)`=mujer, `getOrNull(1)`=hombre | posicional puro |
| 2322 | texto | `"Código de Vestir"` | idioma fijo |
| 2330 | safe-call inútil | `userDressCode?.name` tras el early-return de 2281 | ruido |
| 2336 | texto | `"Código de Vestir"` | duplicado del 2322 |
| 2341 | condición | `if (userDressCode != null)` | **siempre true** por smart-cast → 2608–2659 inalcanzable |
| 2343 | when-string | `"link"` | acoplado a `DressCodeModule.type` del request |
| 2346, 2360, 2367 | when-index | `items.getOrNull(0)` | el ítem 1 de la plantilla se pierde en `"link"` |
| **2357** | **URL de S3** | `"https://invitacionesdigitales.s3.us-east-2.amazonaws.com/wedding/demo/premium-new/DRESSCODE-LINK.jpg"` | **URL de un bucket concreto embebida en Kotlin**; si se rota el bucket o se borra el objeto, imagen rota en producción |
| 2353–2356 | ruta de datos | `contentTemplate.dressCode?.women?.image` como imagen de un dress code de tipo *link* | semánticamente incorrecto: usa la foto "de damas" para una tarjeta genérica de enlace |
| 2364 | texto | `"Código de Vestimenta"` | idioma fijo |
| 2373 | texto | `"Haz clic en el botón para ver más detalles"` | idioma fijo |
| 2379 | when-string | `"predefined"` | — |
| 2382, 2411 | when-index | `getOrNull(0)`=mujer, `getOrNull(1)`=hombre | posicional |
| 2401 | **género** | `"Mujeres"` | **pisa el título de la plantilla**; ignora `contentTemplate.dressCode.women.title` |
| 2430 | **género** | `"Hombres"` | ídem |
| 2447–2483 | when-index | `getOrNull(0)`/`getOrNull(1)` | 4.ª copia del bloque de fallback |
| 2486, 2598 | fallback | `visualDressCode.items` | placeholders de la plantilla |
| 2492 | when-string | `"standard"` | rama **idéntica** a `"predefined"` |
| 2495, 2524 | when-index | `getOrNull(0)`/`getOrNull(1)` | posicional |
| 2514 | **género** | `"Mujeres"` | duplicado del 2401 |
| 2543 | **género** | `"Hombres"` | duplicado del 2430 |
| 2559–2595 | when-index | `getOrNull(0)`/`getOrNull(1)` | 3.ª copia del bloque de fallback |
| 2604–2606 | fallback | `else -> visualDressCode.items` | un `type` desconocido devuelve los placeholders |
| 2611–2655 | when-index | `getOrNull(0)`/`getOrNull(1)` | **bloque inalcanzable** (§4.7) |

### 7.7 Started y `createDefault*` (2664–2743)

| Línea | Tipo | Valor | Consecuencia |
|---|---|---|---|
| 2673 | clave | `texts["rsvpTitle"]` | — |
| 2675 | texto | `"Confirma tu asistencia"` | idioma fijo |
| 2678 | clave + cast | `rsvp["message"] as? String` | si el JSON trae un objeto en vez de String, cae silenciosamente al fallback |
| 2680 | texto | `"Por favor confirma tu asistencia antes del evento."` | idioma fijo |
| 2683 | clave + cast | `rsvp["note"] as? String` | ídem |
| 2687 | clave | `images.backgrounds["rsvpBg"]` | — |
| 2695, 2696 | tamaño | `width = 100.0`, `height = 100.0` | toda imagen creada por defecto sale 100×100 |
| 2697, 2698 | estilo | `alignHorizontal/Vertical = "center"` | — |
| 2711 | estilo | `fontAlign = "center"` | — |
| 2712 | estilo | `fontStyle = emptyList()` | — |
| 2713 | tamaño | `fontSize = 16.0` | — |
| 2714 | tamaño | `lineHeight = 18.0` | — |
| 2715 | margen | `listOf(0.0, 0.0, 0.0, 0.0)` | — |
| 2716 | **color** | `listOf(130.0, 130.0, 130.0, 1.0)` (gris) | texto gris en cualquier plantilla |
| 2717 | **color** | `listOf(255.0, 255.0, 255.0, 0.0)` | — |
| **2724** | **fontFamily** | `"Poppins"` | **cualquier texto creado por defecto usa Poppins**, aunque la plantilla use "Sacramento" o "Work Sans" (verificado en `default_visual_boda_premium.json`) |
| 2733 | **color** | `listOf(0.0, 0.0, 0.0, 1.0)` | iconos negros |
| 2734 | **color** | `listOf(255.0, 255.0, 255.0, 0.0)` | — |

---

## 8. Puntos de excepción potencial

Se buscaron con script `!!`, `.first()`, `.last()`, `.single(`, `[N]`, `requireNotNull`, `checkNotNull` en las líneas vivas del tramo. **Resultado: no hay ni un `!!`, ni un `.first()`, ni un `.single()` en código vivo del tramo.** Los únicos accesos por índice son cuatro y los cuatro están guardados.

| Línea | Expresión | Condición que la dispara | Impacto |
|---|---|---|---|
| 1748 | `visualFamily.items[0]` | ninguna: guardado por `visualFamily.items.size > 0` en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1747` | **ninguno** |
| 1770 | `visualFamily.items[0]` | guardado por `visualFamily.items.size > 0` en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1769` | **ninguno** |
| 1774 | `visualFamily.items[1]` | guardado por `visualFamily.items.size > 1` en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1773` | **ninguno** |
| 1796 | `visualFamily.items[1]` | guardado por `visualFamily.items.size > 1` en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1795` | **ninguno** |
| 2678, 2683 | `(contentTemplate.rsvp?.get("message") as? String)` | valor no-String en Mongo | **ninguno**: `as?` devuelve null y cae al fallback (silencioso, ver §9-14) |
| 1690, 1691, 1753–1756, 1779–1782 | `contentTemplate.images.parents?.get(k) as? String` | — | **ninguno**; el `as? String` es redundante porque `parents` ya es `Map<String,String>?` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/model/defaults/DefaultContentConfig.kt:156`) |
| 2292, 2452, 2564, 2616 | `contentTemplate.dressCode.women.image` | — | **ninguno**: smart-cast tras `!= null`; `women` es no-nula (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/model/defaults/DefaultContentConfig.kt:285`) |
| **fuera del tramo, pero afecta a todo** | `DefaultContentConfig` exige `images`, `phrases`, `itinerary`, `giftRegistry`, `music` **no nulos** (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/model/defaults/DefaultContentConfig.kt:41,47,52,57,62`) | un documento de `default_content_configs` sin alguno de esos campos | **excepción de deserialización de Jackson** al leer el contenido por defecto, capturada en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationConfigService.kt:158` y convertida en `IllegalStateException` |

**Conclusión de la pregunta 1 sobre excepciones**: el tramo 829–2743 **no lanza** por índices ni por `!!`. Los fallos que produce son **silenciosos** (secciones vacías, textos perdidos, ids duplicados), que es un modo de fallo peor de detectar.

---

## 9. Hallazgos

**1. `mergeGiftTableSection` genera una sección de mesa de regalos vacía y visible cuando el usuario no capturó nada.** `val items = userGiftRegistry.mapIndexed {…}` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1071`) sobre una lista vacía produce `emptyList()`, y `mergeConfiguration` (src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:127) fuerza `visibility = true`. La versión comentada tenía un `else` que rellenaba desde `contentTemplate.giftRegistry` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:899`). `contentTemplate.giftRegistry` **no aparece en ninguna línea viva del archivo** (grep). Además `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/model/CreateInvitationRequest.kt:22-23` sólo valida `@NotNull` sobre la lista, no `@NotEmpty`, así que una lista vacía es aceptada.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1071`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1291-1296`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:127`; `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/model/CreateInvitationRequest.kt:22`.
Estado: **VERIFICADO** (que ocurra en producción depende de que existan invitaciones sin filas de gift registry: NO DETERMINABLE).

**2. En bodas, `mergeFamilySection` escribe los nombres de los padres en `label`/`text` de un ítem que en la plantilla real es un *grupo* con esos campos a `null`, y además asume un orden invertido.** Líneas `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1763-1764` y `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1789-1790` usan `templateItem.label?.copy(...)` / `templateItem.text?.copy(...)`: si el campo es `null`, el safe-call devuelve `null` y **el nombre no se escribe**. En `default_visual_boda_premium.json` (templateId 5, el único visual de boda premium que el cargador siembra) los tres ítems de `sectionFamily` tienen `label: null` y `text: null` a nivel de grupo — los nombres viven en `items[].items[]`. Encima, ese JSON tiene `items[0].title = "(Padres de la Novia)"` mientras el código trata `items[0]` como los padres del **novio** (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1747-1768`).
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1747-1797`; `src/main/resources/data/mongo/default_visual_boda_premium.json` (`jq '.config.sectionFamily.items[] | {id,title:.title.content,label:.label.content,text:.text.content}'` → `{"id":"f0","title":"(Padres de la Novia)","label":null,"text":null}`).
Estado: **VERIFICADO** contra la semilla del repo; **NO DETERMINABLE** si el documento de Mongo en producción sigue teniendo esa forma.

**3. `resolveTemplate` produce ids duplicados cuando el usuario registra dos mesas del mismo tipo.** `visualGiftTable.items.firstOrNull { inferTemplateType(it) == itemType }` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1030-1034`) devuelve **siempre el primer** template de ese tipo, y el id del ítem generado es `template?.id` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1281`). `default_visual_boda_premium.json` tiene dos ítems `type:"digital"` (`s1` y `s4`): dos mesas digitales del usuario generan **dos `GifttableItem` con `id = "s1"`**, y `s4` nunca se usa. Los ids son la clave con la que el editor y `InvitationConfigService.syncGiftRegistryTitles` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationConfigService.kt:186-188`, emparejamiento **posicional** ítem↔fila) operan sobre la lista.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1030-1034`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1281`; `default_visual_boda_premium.json` (items `s1` y `s4` con `type:"digital"`).
Estado: **VERIFICADO**.

**4. El título de las mesas digitales es incorrecto en los dos caminos posibles.** `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1086-1095`:
```kotlin
"digital" -> {
    val name = if (item.name == "otro") { item.customName ?: "MESA DIGITAL" }
               else { item.name ?: "MESA DIGITAL" }
    item.name ?: "Mesa de $name"
}
```
- Si `item.name != null` la expresión devuelve `item.name` y `val name` se calcula y se **descarta**. Para el caso "otro" eso significa que el título mostrado es el literal `"otro"` en vez del `customName` que el usuario escribió.
- Si `item.name == null`, `name` vale `"MESA DIGITAL"` y el resultado es `"Mesa de MESA DIGITAL"`.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1086-1095`; el centinela `"otro"` es real y `customName` se usa igual en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/model/_InvitationEntityKtx.kt:64`.
Estado: **VERIFICADO**.

**5. El comentario `// ⚠️ aquí no tienes customName en backend` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1090`) es falso.** `InvitationGiftRegistryEntity.customName` existe (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/admin/invitations/repository/model/InvitationEntity.kt:264-265`, columna `custom_name`, creada por `V27__add_custom_name_column.sql`) y se lee en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/model/_InvitationEntityKtx.kt:64`. Comentario que contradice el código.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1090` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/admin/invitations/repository/model/InvitationEntity.kt:265`.
Estado: **VERIFICADO**.

**6. El bloque de banco escribe `item.accountNumber` dos veces con etiquetas distintas.** `msj7` = "Cuenta CLABE" → `item.accountNumber` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1174-1177` y `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1207-1210`) y `msj9` = "Número de tarjeta" → **`item.accountNumber` otra vez** (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1183-1186` y `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1216-1219`). La entidad no tiene campo de tarjeta (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/admin/invitations/repository/model/InvitationEntity.kt:259-286`), así que la CLABE se publica bajo la etiqueta "Número de tarjeta:".
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1180-1186`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1213-1219`; `src/main/kotlin/mx/evolutiondev/invitaciones/modules/admin/invitations/repository/model/InvitationEntity.kt:267-269`.
Estado: **VERIFICADO**.

**7. `mergeFamilySection` empareja grupos por el texto del título y falla en 5 de las 9 plantillas semilla.** `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1685` y `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1703` usan `groupTemplate.title?.content?.contains("Padre"/"Padrino", ignoreCase = true) == true`. En `default_visual_bautizo.json`, `comunion`, `confirmacion`, `cumpleanos` y `evento` (templateIds 7, 8, 9, 10, 13 — todos con `eventTypeId != 1`, es decir rama no-boda) los dos grupos tienen `title.content = null`. El `?.` propaga `null`, `null == true` es `false`, ambas ramas fallan y se cae al `else -> groupTemplate` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1721`): **los padres y padrinos capturados por el usuario se descartan en silencio** y se publica la plantilla con sus placeholders vacíos. Sólo `default_visual_xv_premium.json` (títulos "Mis Padres"/"Mis Padrinos") funciona.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1685,1703,1721`; `jq '[.config.sectionFamily.items[] | .title.content]'` sobre los 5 JSON → `[null,null]`.
Estado: **VERIFICADO** contra la semilla; **NO DETERMINABLE** para el Mongo de producción.

**8. Las etiquetas de padre/madre salen en inglés.** `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1697` hace `parent.type.replaceFirstChar { it.uppercase() }`. `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModulesHandler.kt:89` y `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModulesHandler.kt:99` guardan `type = "mother"` / `"father"`. Resultado: **"Mother"** y **"Father"** en una invitación en español. La versión comentada sí traducía (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1505-1509`: `"mother" -> "Madre"`). Además, en `default_visual_xv_premium.json` los sub-ítems traen `label` = *nombre* y `text` = *rol*, mientras el código escribe `label` = rol y `text` = nombre: los estilos quedan intercambiados.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1697-1698` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1505-1509` (comentada) y `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModulesHandler.kt:89,99`; `default_visual_xv_premium.json` subs `{"label":"Maria Gomez","text":"Madre"}`.
Estado: **VERIFICADO** (el intercambio label/text es **INFERIDO** en cuanto a su efecto visual: depende del front).

**9. Cuando no hay datos del usuario, Story y Family publican los datos de demo de la plantilla.** `mergeStorySection` (src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2212-2214) devuelve `visualStory` tal cual, que en `default_visual_boda_premium.json` contiene la historia de una pareja ficticia ("Inicio de nuestro noviazgo", "JUNIO 7, 2012", "…gracias a dios ella aceptó…", "Santiago decidió proponerme matrimonio"). `mergeFamilySection` (src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1676-1678) hace lo mismo con "Raul Estrada Santiago", "Teresa Lopez", "Maria Gomez", "Eduardo Castellanos". Como `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModuleHelper.kt:10-14` incluye los 5 módulos en **todo** plan Premium, esto le ocurre a cualquier cliente premium que no rellene esas secciones.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2212-2214`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1676-1678`; `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModuleHelper.kt:10-14`; `src/main/resources/db/migration/V1__initial_schema.sql:1091-1093` (plan 2 `is_premium = t`); contenido de `default_visual_boda_premium.json`.
Estado: **VERIFICADO**.

**10. Módulos extra "incluidos" cuya sección no existe en la plantilla se pierden sin traza.** `sectionStory` es `null` en los JSON de templateIds 6, 7, 8, 9, 10 y 13, todos plan Premium y por tanto con `OUR_STORY` en `extraModulesIncluded`. `mergeStorySection` (src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2208) devuelve `null` y `mergeConfiguration` (src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:130-136) deja el campo a `null`. No hay log, ni excepción, ni marca.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2208`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:129-136`; `jq '.config.sectionStory'` → `null` en los 6 archivos; `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModuleHelper.kt:12-14`.
Estado: **VERIFICADO**.

**11. `usesSplitBankLayout` decide entre dos ramas idénticas.** Diff normalizado (sin espacios ni comentarios) de `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1157-1185` contra `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1189-1220`: idénticos. La única diferencia entre las dos ramas del `if` es un bloque de 28 líneas **comentado** (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1221-1248`).
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1025-1027`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1156-1251`.
Estado: **VERIFICADO**.

**12. Las ramas `"predefined"` y `"standard"` de `mergeDressCodeSection` son idénticas.** Diff normalizado de `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2380-2490` contra `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2493-2602` (sustituyendo `predefinedItems`↔`standardItems` y quitando comentarios): idénticos. ~110 líneas duplicadas.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2379-2603`.
Estado: **VERIFICADO**.

**13. ~82 líneas de `mergeStorySection` y `mergeDressCodeSection` son inalcanzables por el early-return previo.** En story, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2212` retorna si `userStory.isEmpty()`, así que `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2217 if (userStory.isNotEmpty())` es siempre verdadero y `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2240-2266` está muerto. En dress code, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2281` retorna si `userDressCode == null`, así que `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2341 if (userDressCode != null)` es siempre verdadero (smart-cast) y `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2608-2659` está muerto. Consecuencia funcional: **`contentTemplate.story` no se usa jamás en la generación**, pese a que `default_content_boda_basico.json` y `default_content_evento.json` sí lo traen.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2212,2217,2240,2264,2281,2341,2608,2657`; grep `contentTemplate.story` → sólo `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2240-2241`.
Estado: **VERIFICADO**.

**14. `mergeStartedSection` recibe `invitation` y no lo usa nunca.** El parámetro `invitation: InvitationEntity` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2665`) no aparece en el cuerpo `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2669-2690` (verificado con grep sobre ese rango: única coincidencia, la declaración). El generador consulta 14 repositorios pero la sección de RSVP no usa ni la fecha ni la hora ni el límite de confirmación de la invitación: el "límite" sale de `contentTemplate.rsvp["message"]` o de un literal.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2664-2691`.
Estado: **VERIFICADO**.

**15. `mergeStorySection` recibe `contentTemplate` y sólo lo usa en código inalcanzable.** Ver hallazgo 13. Parámetro efectivamente muerto.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2206`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2240-2243`.
Estado: **VERIFICADO**.

**16. Tres funciones definidas y nunca llamadas desde código vivo.** `getFallbackFamilyText` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1844`) tiene **cero** referencias en todo `src/main/kotlin`. `createDefaultFamilyItem` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1828`) y `createDefaultFamilyGroup` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1837`) sólo se referencian desde bloques comentados. Además `getFallbackFamilyText` tiene el mapeo índice→padres **invertido** respecto a la función viva: `0 -> bride`, `1 -> groom` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1846-1847`) frente a `items[0]` = novio en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1747`.
Evidencia: grep de los tres nombres sobre `src/main/kotlin`.
Estado: **VERIFICADO**.

**17. El parámetro `id` de `createDefaultEditText` y el default del `id` de `bodyFromTemplate` están muertos.** `createDefaultEditText(content: String?, id: String? = null)` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2720`): las ~60 llamadas pasan sólo `content`. `bodyFromTemplate(..., id: String = "msj${bodyIndex+1}")` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1062`): las 15 llamadas pasan `id` explícito.
Evidencia: grep de ambos nombres en el archivo.
Estado: **VERIFICADO**.

**18. `templateId == 12L` es un parche de layout identificado por número mágico sobre una plantilla que no está sembrada.** `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2069, 2129, 2156, 2177`. Los `INSERT` de `invitation_template` de Flyway sólo llegan hasta el id 10 (`src/main/resources/db/migration/V24__add_new_event_types_and_xv_template.sql:17` → `setval(...,6)`, `src/main/resources/db/migration/V25__add_remaining_templates.sql:10` → `setval(...,10)`); los ids 11–14 los asigna la secuencia en tiempo de ejecución vía el API de administración. Igual ocurre con `templateId == 11L` en la `mergeFamilySection` comentada (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1350, 1377, 1445, 1482`).
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2069`; `src/main/resources/db/migration/V25__add_remaining_templates.sql`; `src/main/kotlin/mx/evolutiondev/invitaciones/core/data/MongoDataInitializer.kt:33-43` (no hay archivo con tid 12).
Estado: **VERIFICADO** en cuanto a que el 12 no está sembrado; **NO DETERMINABLE** a qué plantilla corresponde en producción.

**19. El bloque de banco emite 9 elementos de body sobre plantillas diseñadas con 4.** `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1157-1220` construye siempre `msj1..msj9`; `bodyFromTemplate` (src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1066-1068) cae a `template.body.firstOrNull()` para los índices que la plantilla no tiene. `default_visual_boda_basico.json` (tid 4, ítem `s1`) y `default_visual_boda_premium_2.json` (tid 11, ítem `s2`) tienen **4** bodies, con el formato ya concatenado ("Banco: SANTANDER" en una sola línea). El generador produce 9 líneas separadas ("Banco:", "SANTANDER", "Titular:", …) con el estilo del primer body repetido 5 veces.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1155-1223`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1066-1068`; `jq '.config.sectionGifttable.items[] | {id, bodyLen:(.body|length)}'` sobre ambos JSON.
Estado: **VERIFICADO**.

**20. Un `type` de mesa de regalos no reconocido genera un ítem con body vacío.** `normalizeGiftType` (src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:996) (`else -> normalized`) más `bodyList` `else -> emptyList()` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1265`). `GiftRegistryRequest.type` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/model/CreateInvitationRequest.kt:74-75`) sólo valida `@NotBlank`: no hay enum ni whitelist. Los tipos que el resto del sistema reconoce son `"digital"`, `"bankAccount"`, `"cuenta"`, `"physical"`, `"fisico"` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/model/_InvitationEntityKtx.kt:61-89`), todos cubiertos por `normalizeGiftType`; cualquier otro valor que llegue por API produce un ítem con título y **sin cuerpo**.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:996`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1265`; `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/model/CreateInvitationRequest.kt:74`; `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/model/_InvitationEntityKtx.kt:61-89`.
Estado: **VERIFICADO** en el código; **NO DETERMINABLE** si hay filas así en la BD.

**21. `mergeConfiguration` fuerza `visibility = true` en secciones que la plantilla del plan Básico marca explícitamente como ocultas.** `default_visual_boda_basico.json` (templateId 4, plan 1) trae `sectionDresscode:false, sectionSuggestions:false, sectionAmenities:false, sectionFamily:false, sectionStory:false`. `mergeConfiguration` (src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:127,135,144,153,162,171) y `mergeFamilySection` (src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1677) lo pisan. Family es el caso más claro porque no tiene ninguna comprobación de `visibility` (a diferencia de Story `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2213` y DressCode `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2282`): en el plan Básico con `PARENTS_AND_GODPARENTS` contratado y sin datos, la sección aparece con los placeholders de la plantilla aunque la plantilla la ocultara.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:127-177`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1677`; `jq` sobre `default_visual_boda_basico.json`.
Estado: **VERIFICADO**.

**22. Política inconsistente de ids entre Amenities y Suggestions, dos funciones casi gemelas.** Amenities **siempre** sobreescribe el id (`"amenities-${index+1}"`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1880`; `"amenities-default-…"`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1911`; `"amenities-img-…"`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1935`). Suggestions **conserva** el de la plantilla (`templateItem?.id ?: UUID.randomUUID()`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2136`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2184`) salvo en el fallback rico (`"rec-default-…"`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2163`). En la misma sección de gift table se usa `"msjN"` y en suggestions `"msj-2"` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2079`).
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1880,1911,1935,2079,2136,2163,2184`.
Estado: **VERIFICADO**.

**23. Amenities y Suggestions colapsan el `body` de la plantilla a un solo elemento y concatenan tres campos con `" | "`.** `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1894-1901` y `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2125-2126` construyen `listOf(firstBody.copy(content = bodyContent))` donde `bodyContent = bodyParts.joinToString(" | ")` con dirección, `"Tel: …"` y descripción (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1867-1877`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2119-2123`). Cualquier maquetación multilínea de la plantilla se pierde y el separador visual queda cableado.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1867-1901`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2119-2133`.
Estado: **VERIFICADO**.

**24. `buildSecondBody` fabrica un botón que no lleva a ninguna parte y machaca la tipografía de la plantilla.** `url = "#"` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2082`) aunque `recommendation.url` esté disponible (se usa en `firstBody`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2126`); `fontSize`, `lineHeight`, `margin`, `color` y `background` se sobreescriben en `md`, `sm` y `xs` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2083-2109`) con valores de marca concretos, y `fontStyle = emptyList()` borra negritas/cursivas de la plantilla.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2074-2111`.
Estado: **VERIFICADO** (sólo se ejecuta con `templateId == 12L`, ver hallazgo 18).

**25. El título de la mesa de regalos ya no respeta la plantilla.** `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1293-1294` es `contentTemplate.texts?.get("giftTableTitle") ?: "Mesa de Regalos"`. La versión comentada (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:972`) intercalaba `?: visualGiftTable.title.content`. Los JSON de contenido de boda (`default_content_boda_premium.json`, `_basico`, `_premium_2`) **no tienen `texts`**, así que el título siempre acaba siendo el literal `"Mesa de Regalos"`, pisando el `"MESA DE REGALOS"` en mayúsculas de `default_visual_boda_premium_2.json`.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1293-1294` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:972`; `jq '.texts' default_content_boda_premium.json` → `null`; `jq '.config.sectionGifttable.title.content' default_visual_boda_premium_2.json` → `"MESA DE REGALOS"`.
Estado: **VERIFICADO**.

**26. Una URL de S3 concreta embebida en Kotlin.** `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2357`, `"https://invitacionesdigitales.s3.us-east-2.amazonaws.com/wedding/demo/premium-new/DRESSCODE-LINK.jpg"`, como imagen por defecto de un dress code de tipo `link`. Además la ruta de fallback previa (`contentTemplate.dressCode?.women?.image`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2353-2356`) usa la foto "de damas" para una tarjeta genérica de enlace.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2352-2358`.
Estado: **VERIFICADO**.

**27. `mergeDressCodeSection` ignora todas las filas de dress code menos la primera.** `invitationDressCodeRepository.findAllByInvitationId(invitation.id).firstOrNull()` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2279`). `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModulesHandler.kt:202` hace `save` (no `deleteAll` previo), así que una segunda edición de módulos extra podría dejar dos filas y la generación tomaría la más antigua según el orden de la consulta (sin `ORDER BY`).
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2278-2279`; `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModulesHandler.kt:202-216`; `InvitationRepository.kt` (`findAllByInvitationId` sin orden).
Estado: **VERIFICADO** en el código; **NO DETERMINABLE** si hay invitaciones con más de una fila.

**28. Riesgo acoplado fuera del tramo: `syncGiftRegistryTitles` empareja por posición ítem↔fila.** `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationConfigService.kt:186-188` recorre `sectionGiftTable.items` por índice contra `existingGiftRegistry[index]`. La generación produce los ítems en el mismo orden que las filas (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1071`), así que inicialmente cuadra; pero cualquier reordenación o borrado de ítems en el editor escribe el título/mensaje **en la fila equivocada** de Postgres. Se apunta aquí porque el contrato de orden lo fija `mergeGiftTableSection`.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationConfigService.kt:176-211` vs `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1071`.
Estado: **VERIFICADO** (el archivo pertenece a otro tramo; se reporta por acoplamiento directo).

**29. `?: null` redundante que oculta la intención en Amenities y Suggestions.** `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1886-1887` y `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2138`: `content = activity.photoUrl?.takeIf { it.isNotBlank() } ?: null`. El elvis no hace nada; el efecto real es que **la imagen de la plantilla se sustituye por `null`** cuando el usuario no subió foto, en vez de conservarse.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1884-1888`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2137-2139`.
Estado: **VERIFICADO**.

**30. Comentario que contradice al código en Amenities.** `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1940`: `body = templateItem?.body ?: emptyList(), // Esto dejará el null si el template es null`. Deja una **lista vacía**, no `null`; `SuggestionItem.body` es `List<ModelEditText>` no nulo (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/model/editor/EditorModels.kt:356`), así que `null` sería imposible.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1940`; `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/model/editor/EditorModels.kt:356`.
Estado: **VERIFICADO**.

**31. `visibility == true` sobre un `Boolean` no nulo.** `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2213` y `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2282` comparan con `== true` campos declarados `val visibility: Boolean` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/model/editor/EditorModels.kt:437` y `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/model/editor/EditorModels.kt:461`). No es un bug, pero sugiere que quien escribió esas líneas creía que el campo era nullable, lo que encaja con el resto de suposiciones no verificadas del tramo.
Evidencia: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2213,2282`; `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/model/editor/EditorModels.kt:437,461`.
Estado: **VERIFICADO**.

**32. `~29%` del tramo es código comentado.** 556 líneas comentadas (829–976, 1221–1248, 1302–1636, 1957–2060) sobre 1915. Tres de esas versiones antiguas son funciones completas que conviven con su reemplazo a pocas líneas de distancia y difieren en la **regla de precedencia**, no sólo en el estilo — es decir, leer la comentada da una idea equivocada de cómo se comporta el sistema.
Evidencia: script de detección de bloques; ver §4.1.
Estado: **VERIFICADO**. **NO DETERMINABLE** desde cuándo (un solo commit).

---

## 10. Lo que está bien resuelto

1. **Ninguna excepción por índice en todo el tramo vivo.** Los cuatro accesos `visualFamily.items[0]`/`[1]` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1748, 1770, 1774, 1796`) están precedidos por su comprobación de `size` en la línea inmediatamente anterior (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1747, 1769, 1773, 1795`). No hay `!!`, ni `.first()`, ni `.single()`. Es una disciplina consistente que conviene no romper.

2. **El contrato "plantilla visual nula → sección nula" es uniforme.** Las siete funciones abren igual (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:985, 1644, 1857, 2067, 2208, 2276, 2669`) y `mergeConfiguration` propaga con `?.copy(...)`. No hay ni un caso donde una sección se fabrique de la nada, lo que evita publicar secciones sin maquetación.

3. **`bodyFromTemplate` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1057-1075`) es el patrón de fallback más limpio del archivo**: `getOrNull(bodyIndex) ?: firstOrNull() ?: createDefaultEditText("")`. Degrada en tres escalones sin lanzar y conserva el estilo de la plantilla; el mismo patrón se repite bien en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1687`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1705`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1802`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1864`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1910`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1934`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2116`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2150`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2172`.

4. **La reconstrucción del `intro` de familia (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1649-1674`) está bien pensada.** Ordena las frases por el sufijo numérico de `family_intro_N` con `toIntOrNull() ?: Int.MAX_VALUE` (tolerante a datos corruptos), y el `else` de `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1671-1673` se preocupa de inyectar `id` también cuando no hay frases, con un comentario que **sí** describe lo que hace. Es además consistente con `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModulesHandler.kt:285-295`, que genera los mismos ids.

5. **`resolveTemplate` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1029-1049`) resuelve un problema real**: emparejar mesas de regalo por *tipo* en vez de por posición, que era lo que hacía la versión comentada. La idea es correcta; lo que falla es el `firstOrNull` con plantillas que repiten tipo (hallazgo 3), no el enfoque.

6. **La sincronización de tipos entre capas es coherente.** `normalizeGiftType` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:990-998`) cubre exactamente el conjunto de valores que el resto del sistema produce y consume (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/model/_InvitationEntityKtx.kt:61-89`), incluida la variante `"bankAccount"` en camelCase gracias al `lowercase()` previo.

7. **`mergeStartedSection` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:2664-2691`) es la única función del tramo con una cadena de precedencia legible de un vistazo**: contenido → visual → literal, cuatro campos, sin ramas. Es el modelo a seguir para el resto.

8. **La generación es idempotente por diseño en la capa de arriba**: `InvitationConfigService.getConfig` protege con `ReentrantLock` por invitación (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationConfigService.kt:132-172`), sólo genera si no existe documento, y captura el fallo de generación registrándolo antes de reintentar la lectura (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationConfigService.kt:158-164`). El generador no tiene que preocuparse de concurrencia.

---

## 11. Preguntas que no pude responder y por qué

1. **Si los bugs de emparejamiento (hallazgos 2, 7) se manifiestan en producción.** Todo el análisis contrasta contra los JSON semilla de `src/main/resources/data/mongo/`, que `MongoDataInitializer` carga al arrancar. Los documentos reales de `default_visual_configs` pueden haber sido editados por el API de administración (`MasterTemplatesService`) después de la siembra. **NO DETERMINABLE** sin acceso a la base Mongo.

2. **A qué plantilla corresponde `templateId == 12L`** (y `11L`, `14L`). Flyway sólo siembra hasta el id 10 (`src/main/resources/db/migration/V25__add_remaining_templates.sql:10`); los siguientes los asigna la secuencia en tiempo de ejecución. **NO DETERMINABLE** sin la tabla `invitation_template` real.

3. **Desde cuándo existe cada bloque comentado y cuál sustituyó a cuál.** El repositorio tiene un único commit (`git rev-list --count HEAD` = 1, `d142778 feat: initial commit`). `git log` y `git blame` no aportan nada. **NO DETERMINABLE**, como advertía el brief.

4. **Qué hace el frontend con los campos que este código produce.** Varias conclusiones sobre el impacto visual (intercambio `label`/`text` en §9-8, `showImage = true` forzado, `linkHref = null`, ids duplicados) dependen de cómo los interprete el renderizador. El repositorio es sólo backend; no hay frontend que inspeccionar. Se han marcado esos puntos como **INFERIDO** en lugar de VERIFICADO.

5. **Si existen filas de `invitation_gift_registry` con `type` fuera del conjunto reconocido, o invitaciones con más de una fila de `invitation_dress_code`** (hallazgos 20 y 27). El código lo permite (`@NotBlank` sin enum; `save` sin borrado previo), pero comprobarlo exige consultar Postgres. **NO DETERMINABLE**.

6. **Si `mergeDressCodeSection` usa `modules/master/dresscodes/**` o `DressCodeKtx.kt`.** Verifiqué que **no**: los imports del generador (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:1-14`) no incluyen ninguno de los dos, y la resolución de un dress code `"predefined"` contra `DressCodeRepository` ocurre antes, al guardar, en `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/ExtraModulesHandler.kt:181-200`. La pregunta queda respondida en negativo, pero la anoto aquí porque el brief la planteaba como condicional.

7. **No audité las secciones settings/cover/couple/event/gallery** (líneas 183–828), tal y como indicaba el brief; sólo leí `mergeConfiguration` (90–181) y hojeé 183–420 para entender el estilo de precedencia y localizar los call-sites de `createDefault*` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:442-444`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:496`, `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt:505`). Cualquier hallazgo sobre esas funciones corresponde a C1.
