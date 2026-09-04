# Bitácora — 1-frontend (fase 1)

## Qué hice
Diseñé `diseno/04-frontend-y-editor.md`: estructura exacta del monorepo `frontend/` (una sola app Next.js `apps/web` con rutas `/editor/...` y `/i/...`, ADR-017 — corrección explícita del stack por defecto del prompt maestro §7, pedida por el brief de esta orquestación), modelo de interacción de dos paneles sincronizados (lienzo de solo selección + panel de formularios curados, nunca edición directa del DOM), lienzo como iframe aislado con 7 tipos de mensaje `postMessage` tipados (ADR-018, lección de aura.build), modelo de estado/undo/autoguardado (ADR-019, pila propia en vez de zundo), 4 flujos de usuario completos en texto, reglas de accesibilidad y presupuesto de Core Web Vitals para el render público. Registré ADR-017…019.

## Evidencia
`handoffs/0-resumen-auditoria-frontend.md`; `handoffs/1-aura-lecciones.md` (las 7 lecciones y 6 anti-patrones, cité las que aplican a frontend: preview aislado, DOM+Tailwind como anti-patrón, breakpoints manuales como anti-patrón); `03-api.md` para los contratos HTTP exactos que el store consume.

## Decisión que se desvía del prompt maestro por defecto
ADR-017 reemplaza `apps/editor`+`apps/site` (stack por defecto, prompt §7) por una sola app `apps/web`, siguiendo instrucción explícita del brief de esta orquestación ("una sola app... salvo ADR"). Documenté el motivo (tamaño actual del producto) y la condición de reversión (si el render público necesita escalar independiente del editor).

## Qué no pude hacer / limitaciones
No hay frontend en el repo (confirmado por el resumen del rol): todo el diseño es sin código ejecutable en esta fase, section 1 ya lo advertía. No definí la biblioteca de recorte de imagen (fuera del contrato de datos, no bloquea nada — registrado como pendiente).

## Riesgos
Edición desde móvil del propio cliente (no solo vista previa) no está resuelta — supuesto desktop-first para el editor, en `preguntas-abiertas.md`.

## Archivos tocados
`diseno/04-frontend-y-editor.md`, `memoria/decisiones.md` (ADR-017…019), este archivo.
