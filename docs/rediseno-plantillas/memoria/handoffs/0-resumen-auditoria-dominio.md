# Resumen de auditoría para el rol "Dominio y esquema de plantilla" (fase 1, sub-agente 1)

Fuente completa: `docs/analisis-plantillas/ANALISIS-GENERACION-PLANTILLAS.md` §3 (anatomía sección por sección), §6 (contrato implícito) y §9.1 (invariantes a preservar). Detalle sección por sección en `fases/C1-generacion-parte1.md` y `fases/C2-generacion-parte2.md`.

## Hallazgos H-xx que definen el dominio actual (uno por línea)

- **H-01**: familia empareja grupos por *texto* del título (`"Padre"/"Padrino"`); sin id estable, 5/6 plantillas no-boda pierden los datos del usuario → ampliar en informe §5.2 H-01, `fases/C2-generacion-parte2.md` hallazgo 7.
- **H-02**: familia en boda empareja por *posición* (`items[0]`=novio, `[1]`=novia, `[2..]`=padrinos) y escribe sobre campos que pueden ser `null` → §5.2 H-02.
- **H-11**: plantillas 12 y 14 tienen ramas de dominio codificadas por `templateId` mágico (no por capacidad declarada de la plantilla) → §5.2 H-11.
- **H-12**: anotación mal puesta borra `itemsSinglePlace` también al deserializar; una funcionalidad entera de dominio (evento en un solo lugar) está maquetada y muerta → §5.2 H-12, `fases/H-hipotesis.md` §5 (prueba de control causal, metodología reutilizable).
- **H-20**: `eventTypeId == 1L` es la única definición de "boda"; existe `event_type.is_wedding` sin usar → §5.2 H-20.
- **H-25**: galería descarta ids/estilos de la plantilla; el número de ítems lo dicta el número de fotos del usuario, no la estructura → §5.2 H-25.
- **H-27**: fechas sin formatear consistentemente entre secciones (couple vs. cover) → §5.2 H-27.
- **H-28 / H-30**: ids duplicados en mesa de regalos; body de banco truncado/alargado sin criterio de dominio → §5.2 H-28/H-30.
- **H-31 / H-32**: títulos de sección y etiquetas (padre/madre) hardcodeados en español/inglés, ignorando lo declarado en la plantilla → §5.2 H-31/H-32.
- **H-33**: amenities/suggestions colapsan `body` a un elemento — el dominio no soporta listas heterogéneas por ítem → §5.2 H-33.
- **H-49**: `itinerary[]` no admite `locationButton`/`locationDatetime` aunque el modelo de tarjeta sí los tiene → §5.2 H-49.
- **H-51**: dress code ignora todas las filas salvo la primera → §5.2 H-51.

## Contrato implícito de plantilla (resumen de §6 del informe)

El documento visual (`default_visual_configs`) exige, sin validarlo nunca: (1) `templateId` debe existir en `invitation_template`; (2) ninguna clave desconocida en 10 clases sin `@JsonIgnoreProperties`; (3) `sectionEvent.itemsSinglePlace` no puede poblarse (Jackson lo descarta); (4) cada sección debe existir para generarse — si falta, se pierde sin traza; (5) `visibility` es irrelevante, se fuerza `true`; (6) familia exige título con "Padre"/"Padrino" (no-boda) o posición fija 0/1/2+ (boda) con `label`/`text` no nulos; (7) gifttable exige `type` único por ítem y ≥9 `body` en el ítem banco; (8) galería solo usa el estilo de `items[0]`. El documento de contenido (`default_content_configs`) exige `eventTypeId`/`planId` no nulos, permite claves desconocidas, y tiene una lista cerrada de claves `texts` reconocidas — todo lo demás es dato muerto (`story`, `giftRegistry`, `parents.*.names`). **Ninguna de estas reglas está escrita en ningún esquema: es el comportamiento observado del generador.** Detalle completo con evidencia línea a línea en informe §6.1–6.3.

## 3 opciones de rediseño (informe §9.2, 3 líneas)

- **Opción A** (1×): endurecer el contrato tácito en el mismo diseño (dos almacenes, merge posicional) — arregla fallos silenciosos pero no toca invitaciones ya generadas ni reduce el acoplamiento de presentación en el backend.
- **Opción B** (4×–6×): separar plantilla de contenido editado; la config pasa a ser un conjunto de anulaciones por ruta de campo compuesto en cada lectura — propaga correcciones, pero exige migrar cada documento existente sin metadato de qué es del usuario.
- **Opción C** (10×+): plantilla como artefacto versionado con esquema declarado; el backend deja de custodiar presentación (tipografías/colores/iconos) y el documento se reduce a contenido+estructura — es el rediseño real (y el que este prompt maestro ya adopta como base, prompt §1 y §7).

## Qué preservar (informe §9.1, para no perder al rediseñar)

Disciplina anti-NPE del generador (cero `!!`); el contrato "plantilla nula → sección nula" (nunca fabricar contenido de la nada); resolución visual estricta (fallar ruidoso, no silencioso); `bodyFromTemplate` como patrón de fallback en 3 escalones a imitar; `formatEventDate` como formateo determinista entre entornos.
