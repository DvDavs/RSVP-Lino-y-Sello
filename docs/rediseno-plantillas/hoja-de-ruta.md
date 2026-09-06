# Hoja de ruta de Lino & Sello (reescrita el 2026-09-06 tras `memoria/decisiones-dueno.md`)

Estado: fases 0–3 (diseño, backend, editor, identidad visual) cerradas. Fase 4 en curso.

| Fase | En palabras sencillas | Alcance | Estado |
|---|---|---|---|
| **4 — Kit de autor** | La herramienta para crear plantillas nuevas en ~30 min sin programar. | CLI (`nueva`, `check` con errores que sugieren, `preview`, `registrar`, `capturas`), vocabulario descubrible, guía, y una plantilla nueva creada por un agente ajeno al kit. **Sin conversión de plantillas legadas.** | En curso |
| **5 — Producto completo** (sustituye a la migración) | Todo lo que un cliente y el administrador necesitan además del editor. | Inventario de lo que ya existe en backend; registro y acceso; panel del cliente (mis invitaciones, invitados, RSVP en vivo, compartir por WhatsApp/correo); página pública de confirmación del invitado sobre el render nuevo; **pagos con Stripe** (planes → Checkout → webhook → invitación habilitada); panel de administración (plantillas, clientes, invitaciones, planes, pagos); contacto (WhatsApp click-to-chat, correo); correo transaccional; todo sobre el sistema de diseño y con e2e. | Pendiente |
| **6 — Arte de plantillas e imágenes** | Vestir las plantillas y el sitio. | Con otro modelo, usando el kit: 6–8 plantillas premium (boda, XV, bautizo, comunión, cumpleaños, graduación, evento) con su arte; integración de las 11 imágenes generadas; logotipo. | Pendiente |
| **7 — Cierre y lanzamiento** | Apagar lo viejo, encender lo nuevo. | Retiro del módulo antiguo y de Mongo; revisión final de seguridad, rendimiento y accesibilidad; CI verde en GitHub; despliegue (Next + Spring + Postgres + S3 + dominio + correo); PR a `main`; reporte final. | Pendiente |
| Después | Edición asistida por IA (contrato listo), envío automático por WhatsApp (Meta Cloud API), tema oscuro. | | Pendiente |

Tarea paralela en curso: **CI real en GitHub Actions** (`claude/ci-github-actions`).
