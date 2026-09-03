# Resumen de auditoría para el rol "Punto de extensión para IA" (fase 1, sub-agente 7)

Fuente completa: `docs/analisis-plantillas/investigacion-editor-y-tecnologias.md` §6 (patrón recomendado, completo) y §2.3 (qué NO copiar de aura.build). Recordatorio del prompt maestro §1, objetivo 6: **diseñar el contrato ahora, no implementarlo**.

## Qué referentes se estudiaron y cuál es copiable (investigación §6, tabla completa)

| Producto | Qué produce la IA | ¿Copiable? |
|---|---|---|
| aura.build, v0, Bolt, Lovable | **Código libre** (HTML+Tailwind/React) | **No** — código generado no es validable, versionable ni migrable contra un esquema de plantilla |
| Framer (Wireframer) | Estructura de layout con placeholders | Parcial: solo la idea de generar *estructura*, no estilos |
| **Canva (Magic Design)** | Elige plantilla + coloca contenido del usuario + aplica paleta de marca | **Sí — es el patrón recomendado** |
| Wix (Harmony, no ADI) | Copiloto conversacional permanente dentro del editor | Sí, como modelo de interacción a futuro |

## Patrón recomendado (investigación §6, 7 puntos — resumen)

1. El modelo **nunca** escribe el documento ni código; devuelve un `EditProposal` con ≤10 operaciones de un **catálogo cerrado** (`setText`, `setTheme`, `setVariant`, `toggleSection`, `reorderSections`, `setFocalPoint`).
2. El catálogo **es el mismo esquema Zod** que valida el editor humano y (vía JSON Schema) el backend Kotlin — usar `Output.object()` del Vercel AI SDK, que valida pero **no repara** salidas malformadas (`AI_NoObjectGeneratedError` se trata como caso normal).
3. Doble validación: la operación debe apuntar a una sección/variante que exista en el **manifiesto de esa versión de plantilla**, y los valores de tema deben ser ids del catálogo de paletas/tipografías, nunca colores libres.
4. Se aplica con **el mismo reducer que usa la UI humana** — cero rutas de escritura paralelas; por construcción queda deshacible, versionable y auditable.
5. Diff previsualizable siempre, nunca autoaplicar.
6. Alcance por sección (un botón por sección), nunca un chat global sobre todo el documento.
7. Mayor valor/menor riesgo: redactar prosa (historia, mensajes). Mayor riesgo/menor valor: "maquetar", porque las plantillas ya están bien maquetadas — no darle a la IA control sobre estructura visual.

## Hallazgos H-xx que motivan cada regla del contrato

- **H-45** (`PUT .../config` sin `@Valid` ni límite de tamaño): la razón exacta por la que el catálogo de operaciones de IA debe ser **cerrado y validado por esquema** desde el primer día — no repetir "acepta cualquier JSON" con las salidas del modelo → informe §5.2 H-45.
- **H-13** (`_id` inyectable en el body): mismo principio — ninguna operación de IA debe poder direccionar un documento fuera de la invitación autorizada; validar pertenencia en el mismo punto que valida el resto de la API (P8) → §5.2 H-13.
- **H-01/H-02/H-03** (family/demo data): si la IA algún día propone contenido, debe operar sobre `content` por id de bloque explícito — nunca sobre posición ni sobre texto de título, exactamente el defecto que causa estos tres hallazgos → §5.2 H-01/H-02/H-03.
- **H-12** (campo silenciosamente descartado): recuerda que **cualquier** capa nueva (incluida la de IA) debe fallar ruidosamente ante un campo que no reconoce, nunca descartarlo (P1) → §5.2 H-12.

## Riesgo documentado a registrar como pregunta abierta si no hay ADR previa

Investigación §7, riesgo 6 y decisión 6: "¿Cuándo entra la IA?" — recomendación explícita de la investigación es **fase 2 del producto** (después de este rediseño) y **solo** para redacción de textos + sugerencia de paleta; "la IA sobre un modelo de datos que aún no está estabilizado multiplica el coste". El rol de este sub-agente es diseñar el contrato (`EditProposal`, catálogo de operaciones, validación), no implementarlo ni activarlo.

## 3 opciones de rediseño y su relación con el punto de extensión de IA (informe §9.2, 3 líneas)

- **Opción A**: sin esquema versionado de plantilla, no hay manifiesto contra el que validar una operación de IA — el contrato de IA no tiene dónde apoyarse.
- **Opción B**: el documento sigue siendo una composición en cada lectura; una operación de IA aplicada al `content` es viable, pero el estado "qué existe hoy en la plantilla vigente" puede cambiar entre la propuesta y la aplicación.
- **Opción C** (**la que habilita el patrón limpio**): plantilla como artefacto versionado con manifiesto explícito de secciones/variantes — es el único de los tres donde "la operación debe apuntar a algo que existe en el manifiesto de esa versión" (regla 3 del patrón) es una validación mecánica y no una suposición.
