# Resumen de auditoría para el rol "Arquitectura del frontend y del editor" (fase 1, sub-agente 4)

Fuente completa: `docs/analisis-plantillas/investigacion-editor-y-tecnologias.md` §3–5 (propuesta de editor, evaluación tecnológica, modelo de datos). El backend actual **no tiene frontend en este repositorio** — todo lo que sigue es lo que el backend actual asume implícitamente de un consumidor que no se puede verificar.

## Hallazgos H-xx relevantes (restricciones que el backend impone hoy a cualquier frontend)

- **H-12**: `itemsSinglePlace` nunca llega poblado al frontend (Jackson lo descarta); si el frontend antiguo tenía UI para "todos los eventos en un solo lugar", nunca pudo funcionar. El módulo nuevo no hereda esta limitación (P1: nada se descarta en silencio) → informe §5.2 H-12.
- **H-25**: los ids de galería (`g1`…`g6`) se reescriben como `gallery-N`; un frontend que dependiera de los ids originales de la plantilla los perdería → §5.2 H-25.
- **H-27**: fechas sin formatear de forma consistente entre secciones — cualquier frontend nuevo debe formatear en el cliente o exigir un formato canónico del backend → §5.2 H-27.
- **Preguntas abiertas #8/#9** (informe §8.1): "¿cómo interpreta el frontend `templateId` dentro de `InvitationConfig`?" y "¿cuál es el impacto visual real de los fallos silenciosos?" son **NO DETERMINABLES** desde este repositorio — el frontend antiguo no está aquí. El diseño nuevo no debe asumir compatibilidad con ningún consumidor legado.

## Contrato implícito relevante a frontend (informe §6, resumen)

El backend actual decide **presentación** (P3, a revertir): 14 literales de FontAwesome, arrays RGBA, `fontFamily = "Poppins"` hardcodeado, geometría 100×100 por defecto, URL de S3 embebida — todo esto debe pasar a vivir en la plantilla/tema que consume el frontend, no en Kotlin. Ver investigación §5.2 ("cuatro capas, ni una gota de CSS en el documento del usuario").

## Stack y decisiones ya fijadas (prompt maestro §7, `contratos.md` §2 — punto de partida, cambiable solo por ADR)

Monorepo TypeScript (pnpm+turbo) con `packages/schema`, `packages/sections`, `apps/editor`, `apps/site` · Next.js App Router + React + Tailwind · Zod fuente única → JSON Schema para Kotlin · **editor a medida, sin librería de page-builder** (Puck/Craft.js/GrapesJS/Builder.io/Plasmic/Webstudio descartados para el usuario final — motivo: layout libre, proyecto parado, licencia AGPL o lock-in SaaS; investigación §4.2) · Zustand+Immer, undo con zundo o pila propia (~60 líneas), react-hook-form+Zod, dnd-kit solo para reordenar · Tiptap solo si se decide para 2-3 campos largos · shadcn/ui para el *chrome* del editor (nunca mezclado con el sistema de tokens de las invitaciones) · documento de 4 capas: paquete de plantilla inmutable (semver) → theme (solo ids) → structure (secciones con key/variant/visible/orden) → content (con roles explícitos, p. ej. `parentsA/parentsB/godparents`) · `InvitationRelease` inmutable servido por CDN, ISR/estático · sin colaboración en tiempo real (versión optimista + bloqueo suave).

## Riesgos de librerías (investigación §7, a registrar como decisión o mitigación)

dnd-kit 6.3.1 estable sin release reciente (verificar versión exacta en `0-inventario.md` §7 de esta fase); zundo con historial de publicación escaso — considerar pila de undo propia; Puck solo aceptable como *spike* interno de 2 semanas para plantillas, nunca expuesto al usuario final.

## 3 opciones de rediseño (informe §9.2, 3 líneas — impacto en frontend)

- **Opción A**: sin cambio de arquitectura de backend — el frontend nuevo tendría que replicar el merge posicional actual o quedar desacoplado de un backend que sigue sirviendo un blob de ~1000 valores de CSS.
- **Opción B**: backend compone en cada lectura — el frontend recibe siempre el documento final, pero la composición puede variar entre peticiones si cambia la plantilla vigente (riesgo de UI inconsistente durante edición).
- **Opción C** (**la adoptada por el prompt**): backend custodia solo contenido+estructura; **el frontend aplica el tema/estilo** desde la plantilla versionada — es la única opción compatible con "editor simple sin CSS" (P7) y con el sistema de 4 capas ya fijado.
