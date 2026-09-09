# Hoja de ruta de Lino & Sello (reescrita el 2026-09-06 tras `memoria/decisiones-dueno.md`)

Estado: fases 0–3 (diseño, backend, editor, identidad visual) cerradas. Fase 4 en curso.

| Fase | En palabras sencillas | Alcance | Estado |
|---|---|---|---|
| **4 — Kit de autor** | La herramienta para crear plantillas nuevas en ~30 min sin programar. | CLI (`nueva`, `check` con errores que sugieren, `preview`, `registrar`, `capturas`), vocabulario descubrible, guía, y una plantilla nueva creada por un agente ajeno al kit. **Sin conversión de plantillas legadas.** | En curso |
| **5 — Producto completo** (sustituye a la migración) | Todo lo que un cliente y el administrador necesitan además del editor. | Inventario de lo que ya existe en backend; registro y acceso; panel del cliente (mis invitaciones, invitados, RSVP en vivo, compartir por WhatsApp/correo); página pública de confirmación del invitado sobre el render nuevo; **pagos con Stripe** (planes → Checkout → webhook → invitación habilitada); panel de administración (plantillas, clientes, invitaciones, planes, pagos); contacto (WhatsApp click-to-chat, correo); correo transaccional; todo sobre el sistema de diseño y con e2e. | Pendiente |
| **6 — Arte de plantillas e imágenes** | Vestir las plantillas y el sitio. | Con otro modelo, usando el kit: 6–8 plantillas premium (boda, XV, bautizo, comunión, cumpleaños, graduación, evento) con su arte; integración de las 11 imágenes generadas; logotipo. | Pendiente |
| **7 — Cierre y lanzamiento** | Apagar lo viejo, encender lo nuevo. | Retiro del módulo antiguo y de Mongo; **retiro de `frontend/packages/migration-legacy`** (ver la nota de abajo); revisión final de seguridad, rendimiento y accesibilidad; CI verde en GitHub; despliegue (Next + Spring + Postgres + S3 + dominio + correo); PR a `main`; reporte final. | Pendiente |
| Después | Edición asistida por IA (contrato listo), envío automático por WhatsApp (Meta Cloud API), tema oscuro. | | Pendiente |

Tarea paralela en curso: **CI real en GitHub Actions** (`claude/ci-github-actions`).

## `packages/migration-legacy`: retirar en la fase 7 (decidido al cerrar la fase 4)

`frontend/packages/migration-legacy` es la herramienta que convirtió las 9 plantillas del catálogo
antiguo al formato de paquete. **Ya hizo su trabajo**: las nueve están convertidas, integradas,
limpias y registradas. La decisión D-01 del dueño (no hay nada que migrar) le quita el motivo de
existir, pero **borrarla ahora no ahorra nada y sí pierde algo**: es la única forma de reproducir esas
nueve plantillas si alguna hubiera que rehacer, y sus 249 reglas de conversión documentan de dónde
salió cada campo.

Medido al cerrar la fase 4: su suite son **89 pruebas en 16,2 s** de reloj (bajo carga de tres
agentes trabajando en paralelo). **No añade ni un minuto** a `pnpm -r test`, y menos aún en un
recorrido que ejecuta los paquetes en paralelo. No hay ninguna prisa por quitarla.

**Se retira en la fase 7**, junto con el módulo antiguo y Mongo, que es cuando desaparece lo que
convertía. Hasta entonces se queda como está, sin tocarla.
