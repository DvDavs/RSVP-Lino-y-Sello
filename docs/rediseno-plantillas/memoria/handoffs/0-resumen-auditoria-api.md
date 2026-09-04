# Resumen de auditoría para el rol "API del editor y render público" (fase 1, sub-agente 3)

Fuente completa: `docs/analisis-plantillas/ANALISIS-GENERACION-PLANTILLAS.md` §2.3 (secuencia GET/PUT), §5.2 (hallazgos altos de seguridad/errores). Detalle: `fases/D-consumo.md` (endpoints, autorización, validación, errores).

## Hallazgos H-xx relevantes

- **H-13**: el `_id` de Mongo viaja en el body del `PUT .../config` y permite **reemplazar la configuración de otra invitación** — el servidor debe generar/validar ids, nunca aceptarlos del cliente (P8) → informe §5.2 H-13, `fases/D-consumo.md` hallazgo 1.
- **H-14**: excepciones tipadas de plantilla (`DefaultVisualTemplateNotFoundException` etc.) las traga un `catch(Exception)` en la ruta de guardado; el cliente recibe un 500 genérico sin `ErrorMessage` estructurado → §5.2 H-14.
- **H-39**: un `PUT` antes del primer `GET` se salta la generación desde plantilla por completo — el orden de operaciones no está garantizado por el contrato de API → §5.2 H-39.
- **H-40**: la URL del correo al invitado está hardcodeada, ignora `frontendUrl` configurado y calcula un `templateId` que ni siquiera usa → §5.2 H-40.
- **H-44**: carrera al retirar el `ReentrantLock` por invitación; el lock es **por JVM**, no distribuido — relevante si el módulo nuevo escala horizontalmente → §5.2 H-44.
- **H-45**: `PUT .../config` no tiene `@Valid`, ni Bean Validation, ni límite de tamaño de body — acepta cualquier JSON → §5.2 H-45.
- **H-46**: `GET`/`PUT /user/template/{invitationId}` son *stubs*: responden 200 y no persisten nada — patrón a **no repetir** en la API nueva → §5.2 H-46.
- **H-48**: credenciales en texto plano en `application.yml` (JWT secret, AWS keys) y en `scripts/create_complete_template.sh` — relevante para diseñar cómo el editor/registro de plantillas maneja secretos → §5.2 H-48.
- **H-52**: la misma situación de "sin permiso" devuelve 403 o 400 según la capa que valide — el contrato de errores no es uniforme → §5.2 H-52.

## Contrato de acceso actual (a reusar, ver handoff de persistencia y `core/auth/**`)

`JwtTokenFilter` puebla `Authentication`; los controladores reciben `Authentication` como parámetro y extraen el `userId`; `HierarchyValidationService.validateInvitationAccess(requesterId, invitationId)` es el único punto de autorización sobre invitaciones (MASTER siempre, ADMIN si creó al customer, USER si es la suya) — **evidencia**: `core/auth/service/HierarchyValidationService.kt:41-55`, uso en `modules/user/invitations/service/InvitationConfigService.kt:49,116`. El manejo de errores global vive en `core/error/GeneralExceptionHandler.kt` (`@RestControllerAdvice`) y **no tiene handler para `IllegalStateException`** (la causa exacta de H-14).

## Enlace público actual (referencia para el render público nuevo)

`GET /public/invitation/guest-info/{token}` (`modules/all/invitations/presentation/PublicGuestInfoController.kt:52-60+`) resuelve invitado→invitación **directo de Postgres**, sin auth, sin caché. No existe hoy una ruta pública que sirva el documento renderizable completo (`InvitationConfig`) — es una ruta a diseñar desde cero para el módulo nuevo (P8: caché, idempotencia, sin exponer ids internos innecesarios).

## 3 opciones de rediseño (informe §9.2, 3 líneas — con foco en API)

- **Opción A** (1×): añadir `@Valid`, forzar `id=null` en el `PUT`, mapear `IllegalStateException` — corrige la superficie de ataque más barata sin cambiar el modelo de operaciones del editor.
- **Opción B** (4×–6×): la API pasa a operar sobre "anulaciones por campo" en vez de reemplazo total; permite operaciones más finas (undo, autoguardado parcial) pero exige componer el documento en cada `GET`.
- **Opción C** (10×+, **la que fija el prompt**): API separa claramente edición (autenticada, versión de trabajo) de publicación (`InvitationRelease` inmutable) — el render público lee el release, nunca el documento en edición; contrato de errores y autorización explícitos por operación (contratos.md §4, pendiente de fase 1).
