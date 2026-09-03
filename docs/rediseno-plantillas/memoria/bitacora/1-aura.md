# Bitácora — sub-agente 1-aura (fase 1, integración de evidencia primaria de aura.build)

## Qué hice

1. Leí el anexo primario `docs/analisis-plantillas/anexos/aura-build-analisis-frontend-2026-09-03.md` (aportado por el dueño, análisis del bundle público real de aura.build — no obtenido por esta sesión, que sigue con el proxy de egreso bloqueado hacia aura.build).
2. Edité `docs/analisis-plantillas/investigacion-editor-y-tecnologias.md`:
   - Advertencia inicial (línea ~10): añadida nota de actualización, texto original tachado con `~~…~~` (no borrado) para trazabilidad.
   - §2.1 (tabla "qué ofrece", 10 filas): añadida columna "Estado tras el anexo" a cada fila. Resultado: 4 confirmadas (parcial o total), 2 corregidas/ampliadas (Salida, Modelos de IA), 6 siguen sin verificar (categoría, referencias `@`, biblioteca, usuarios, precio, fundador — el anexo no trata discurso comercial ni cifras de negocio).
   - §2.2 (tabla stack, 9 filas): añadida columna "Estado tras el anexo" a cada fila + 6 filas nuevas sin equivalente previo (editor de código, preview iframe/postMessage, agente de programación SSE, CMS `data-cms-*`, publicación con artefactos precompilados, capturas/export). Resultado: 6 confirmadas (parcial o total), 1 corregida de forma importante (frontend de la app: React+Vite+React Router, **no Next.js** — se aclaró que esto no invalida la recomendación propia de Next para nuestro proyecto en §4.1, sólo que no debe justificarse citando a aura.build como precedente), 2 siguen sin verificar (mecanismo exacto de breakpoints, editor de texto rich).
   - §2.3 (7 afirmaciones sobre editor/IA): cada una anotada. La corrección más relevante: la afirmación original "el patrón dominante es regeneración de código, sin evidencia de salida estructurada validada" **era incorrecta** — el anexo documenta un patch engine con validación previa, dry-run y reparación (anexo §1, "Edición incremental segura"). También se corrigió "dos modos de un editor" → "dos arquitecturas de editor superpuestas" (HTML clásico vs Aura Code/React).
   - Añadida §2.4 "Lecciones de aura.build para este rediseño (evidencia primaria)": 7 puntos de qué SÍ se adopta (con traducción concreta a nuestro documento/contrato) y 6 de qué NO se adopta y por qué, cada uno citando sección del anexo y P1-P10/H-xx/§ del propio informe.
   - §7: riesgo 1 marcado como resuelto parcialmente (tachado + nota), severidad bajada de Alta a Baja/Media, mitigación reescrita.
   - §8: añadida fila de fuente primaria (el anexo) en la tabla de fuentes VERIFICADO; actualizado el párrafo final de "cifras que no pude verificar" para tachar "stack de frontend, hosting y backend" (ya confirmado) y mantener el resto.
3. Escribí `docs/rediseno-plantillas/memoria/handoffs/1-aura-lecciones.md` (28 líneas) dirigido a 1-frontend, 1-ia, 1-api y verificadores adversariales: 7 lecciones accionables con "qué hacer" y 6 anti-patrones a evitar, todos con referencia a sección del anexo.

## Evidencia

Todas las citas de sección (`anexo §1`…`§9`) verificadas releyendo `anexos/aura-build-analisis-frontend-2026-09-03.md` línea por línea antes de escribir cada afirmación. Ninguna cifra o afirmación nueva se inventó fuera de lo que el anexo dice explícitamente; donde el anexo no trata un tema (precio, cifras de usuarios, fundador, referencias `@`, mecanismo exacto de breakpoints, historial/autosave), se mantuvo como "SIGUE SIN VERIFICAR" en vez de inferir.

## Qué no pude hacer / limitaciones

- No abrí aura.build yo mismo: el proxy de egreso de esta sesión sigue bloqueándolo (no reintenté, ya está documentado como fallo persistente en §2.2/§8 del archivo editado). Toda la integración se basa exclusivamente en el anexo aportado.
- No toqué las secciones 1, 3, 4, 5, 6 del informe (fuera del alcance de mi tarea) salvo la mención puntual en §2.2 que aclara que la recomendación de Next.js en §4.1 no debe apoyarse en aura.build como precedente — es una nota dentro de la fila de la tabla, no una edición de §4.1 en sí.
- No creé ADR: no tomé ninguna decisión de diseño nueva, sólo corregí/confirmé evidencia y escribí el handoff con recomendaciones ya derivadas de decisiones existentes en `contratos.md`.

## Riesgos

- Ninguno nuevo. El riesgo de "sección 2 secundaria" queda parcialmente mitigado; sigue pendiente de verificación independiente todo lo que el anexo no cubre (ver lista en §7 riesgo 1 actualizado).

## Archivos tocados

- `docs/analisis-plantillas/investigacion-editor-y-tecnologias.md` (editado)
- `docs/rediseno-plantillas/memoria/handoffs/1-aura-lecciones.md` (nuevo)
- `docs/rediseno-plantillas/memoria/bitacora/1-aura.md` (este archivo, nuevo)

No se tocó el anexo (`anexos/aura-build-analisis-frontend-2026-09-03.md`): no requirió corrección de formato.
