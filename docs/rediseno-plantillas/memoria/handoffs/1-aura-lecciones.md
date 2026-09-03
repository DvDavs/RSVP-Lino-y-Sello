# Handoff: lecciones de aura.build (evidencia primaria) — sub-agente 1-aura

Para: **1-frontend** (arquitectura del editor), **1-ia** (contrato de edición por IA), **1-api** (publicación/render), y verificadores adversariales.

Fuente: `docs/analisis-plantillas/anexos/aura-build-analisis-frontend-2026-09-03.md` (PRIMARIO, aportado por el dueño, no obtenido por esta sesión — analiza el bundle real de aura.build). Integración completa en `docs/analisis-plantillas/investigacion-editor-y-tecnologias.md` §2.1-§2.4 (tabla fila por fila con estado CONFIRMADO/CORREGIDO/SIGUE SIN VERIFICAR) y §7 riesgo 1 (resuelto parcialmente).

## Lecciones accionables

1. **Patch engine con validación previa + dry-run + reparación de operación individual (anexo §1).** Qué hacer: en el contrato de IA (1-ia), antes de persistir un lote de operaciones, validar cada una contra el manifiesto de plantilla, simular el resultado (dry-run) y sólo entonces aplicar; si una operación individual falla, intentar un reintento acotado antes de descartarla sola (nunca aborta el lote completo).
2. **Preview aislado, comunicado por mensajes tipados, nunca por acceso directo al DOM/estado del otro proceso (anexo §3).** Qué hacer: 1-frontend separa el "chrome" del editor (estado, undo, formularios) del componente que renderiza secciones, con una interfaz de mensajes explícita entre ambos aunque no se use iframe.
3. **Publicación = artefactos precompilados, nunca build-on-visit (anexo §8).** Qué hacer: 1-api confirma `InvitationRelease` inmutable + render estático/ISR servido desde CDN; el invitado jamás dispara compilación ni toca el editor ni la base de datos transaccional.
4. **Puente de datos de negocio hacia el preview sin exponer credenciales (anexo §7, `auraCms.js`).** Qué hacer: si el lienzo del editor necesita datos reales (conteo RSVP, etc.), pasan por un endpoint propio intermediado por el backend, nunca por credenciales de Postgres expuestas al cliente/iframe.
5. **Descartar-y-continuar, no fallar-todo (anexo §1 paso 7-8).** Qué hacer: 1-ia trata una operación inválida como caso normal (se descarta y se registra, se sigue con el resto del lote), y sólo como último recurso ofrece regenerar la sección completa — la regeneración total es el último recurso, no el camino principal.
6. **Separación de tablas por dominio (anexo §5).** Qué hacer: 1-api mantiene negocio (invitados/RSVP) en tablas relacionales aparte del documento JSONB de la invitación; no mezclar dominios en una sola colección aunque Aura mezcle varios editores con sus propias tablas.
7. **Streaming SSE con recuperación por polling, sólo si la IA crece a tareas largas (anexo §4).** Qué hacer: 1-ia no lo implementa en fase 2 base (operaciones ≤10, síncronas); queda como patrón de referencia si "mejorar con IA" evoluciona a tareas multi-paso.

## Anti-patrones a evitar (confirmados en aura.build, no replicar)

- **DOM + clases Tailwind como documento editable del usuario final.** Es la causa raíz de que el editor de Aura degenere en inspector de CSS (anexo §1 + lectura crítica §2.3). Nuestro documento (§5.2) no lleva ni un valor de CSS.
- **Breakpoints manuales/semiautomáticos como control expuesto al usuario.** Sección de nuestro editor ya los excluye (§3.2); el anexo lo confirma como rasgo de editor-para-diseñador.
- **Editor de código (Sandpack/CodeMirror) para el usuario final.** Fuera de alcance del producto; como mucho, herramienta interna de plantillas (mismo estatus que el spike de Puck).
- **Fragmentar en dos arquitecturas de editor sin unificar.** Aura tiene HTML clásico + Aura Code/Canvas como sistemas distintos porque sirve casos muy heterogéneos; nosotros tenemos un solo tipo de documento (invitación) — un editor único y coherente.
- **BaaS de terceros (Supabase) en lugar del Postgres/Spring propio.** Ya decidido en `contratos.md`; el anexo no cambia esto, sólo confirma que Aura sí lo hace así (no es un motivo para nosotros).
- **Multi-proveedor de IA (7+ proveedores) antes de estabilizar el esquema.** Aura lo soporta; nosotros fijamos un proveedor vía AI SDK hasta que el contrato estructurado esté probado (riesgo #6 de la investigación §7).

## Para los verificadores adversariales

Al revisar diseños de 1-frontend/1-ia/1-api, comprobar que cada "SÍ se adopta" cite la sección del anexo (§1-§9) o el H-xx/P-xx correspondiente — está trazado en `investigacion-editor-y-tecnologias.md` §2.4. Cualquier mención de aura.build como precedente de **stack** (Next.js, etc.) es incorrecta: el anexo confirma React+Vite+React Router, no Next — ver §2.2 fila "Frontend de la app".
