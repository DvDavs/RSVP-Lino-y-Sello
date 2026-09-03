# Hotfix: Alta de mas templates (documentacion tecnica)

## 1. Objetivo del hotfix

Este hotfix no agrega plantillas via migraciones SQL directamente.
Su objetivo es **habilitar un flujo robusto y escalable para agregar mas templates** desde API, creando en una sola operacion:

- Registro de template en PostgreSQL (`invitation_template`)
- Configuracion visual en MongoDB (`default_visual_configs`)
- Configuracion de contenido en MongoDB (`default_content_configs`) o reutilizacion de una existente

Con esto se evita el alta manual fragmentada y se reduce el riesgo de inconsistencias entre Postgres y Mongo.

## 2. Alcance real del hotfix (diff `main..hotfix-add-template`)

Archivos modificados/agregados:

- `src/main/kotlin/mx/evolutiondev/invitaciones/modules/master/templates/presentation/MasterTemplatesController.kt` (modificado)
- `src/main/kotlin/mx/evolutiondev/invitaciones/modules/master/templates/service/MasterTemplatesService.kt` (modificado)
- `src/main/kotlin/mx/evolutiondev/invitaciones/modules/master/templates/presentation/model/CompleteTemplateRequest.kt` (nuevo)
- `src/main/kotlin/mx/evolutiondev/invitaciones/modules/master/templates/presentation/model/CompleteTemplateResponse.kt` (nuevo)
- `scripts/create_complete_template.sh` (nuevo)

## 3. Cambios implementados

### 3.1 Nuevo endpoint para alta completa de template

Se agrego el endpoint:

- `POST /master/templates/complete`

Controlador:

- Recibe `CompleteTemplateRequest`
- Requiere autenticacion (rol MASTER)
- Retorna `201 Created` con `CompleteTemplateResponse`

Archivo:

- `src/main/kotlin/mx/evolutiondev/invitaciones/modules/master/templates/presentation/MasterTemplatesController.kt`

### 3.2 Nuevo contrato de entrada (request)

`CompleteTemplateRequest` encapsula en una sola carga:

- Metadatos del template: `name`, `price`, `image`, `url`
- Relacion de negocio: `eventId`, `planId`
- Configuracion visual completa: `visualConfig` (obligatoria)
- Configuracion de contenido: `contentConfig` (opcional)
- Estrategia de contenido: `reuseExistingContent` (default `true`)

Validaciones clave:

- Campos obligatorios y positivos para IDs/precio
- Si no viene `contentConfig` y `reuseExistingContent=false`, se rechaza la solicitud

Archivo:

- `src/main/kotlin/mx/evolutiondev/invitaciones/modules/master/templates/presentation/model/CompleteTemplateRequest.kt`

### 3.3 Nuevo contrato de salida (response)

`CompleteTemplateResponse` devuelve trazabilidad de lo creado/reutilizado:

- `templateId` (PostgreSQL)
- `visualConfigId` (Mongo)
- `contentConfigId` (Mongo, si aplica)
- `contentReused` (boolean)
- `message` informativo

Archivo:

- `src/main/kotlin/mx/evolutiondev/invitaciones/modules/master/templates/presentation/model/CompleteTemplateResponse.kt`

### 3.4 Logica transaccional en servicio

En `MasterTemplatesService` se agrego `createCompleteTemplate(...)` con `@Transactional` para centralizar el alta:

1. Valida existencia y estado (`isEnabled`) de `eventType` y `plan`.
2. Crea template en PostgreSQL (`invitation_template`).
3. Enriquecimiento de `visualConfig`:
   - Inyecta `templateId`, `eventId`, `planId`, `invitationId=0`.
4. Convierte payload visual a `InvitationConfig` con `ObjectMapper`.
5. Persiste visual en `default_visual_configs`.
6. Maneja contenido por dos rutas:
   - Guarda un nuevo `contentConfig` si fue enviado.
   - O reutiliza uno existente por `(eventId, planId)` si `reuseExistingContent=true`.
7. Si no hay contenido disponible bajo la estrategia elegida, responde error validado.

Dependencias nuevas inyectadas en el servicio:

- `DefaultVisualConfigRepository`
- `DefaultContentConfigRepository`
- `ObjectMapper`

Archivo:

- `src/main/kotlin/mx/evolutiondev/invitaciones/modules/master/templates/service/MasterTemplatesService.kt`

### 3.5 Script de automatizacion operativa

Se agrega script utilitario para ejecucion rapida:

- `scripts/create_complete_template.sh`

Capacidades del script:

- Autenticacion contra `/auth/token`
- Construccion de request JSON con `jq`
- Soporte a dos modos:
  - Con `content_config_json_path` (crea contenido nuevo)
  - Sin `content_config_json_path` (reutiliza contenido existente)
- Invoca `POST /master/templates/complete`

Beneficio:

- Estandariza el proceso de carga de templates y minimiza errores manuales en ambientes QA/produccion.

## 4. Como mejora y cumple el requerimiento

Requerimiento: **anadir mas templates de forma segura, repetible y sin romper consistencia**.

Este hotfix lo cumple porque:

- El alta deja de depender de pasos sueltos entre BD relacional y Mongo.
- La API garantiza que un template nuevo tenga su configuracion visual asociada desde el inicio.
- Permite reutilizar contenido existente por combinacion `(eventId, planId)`, evitando duplicidad innecesaria.
- Cuando no existe contenido reusable y no se envia uno nuevo, falla de forma explicita y controlada (no deja datos incompletos).
- El script reduce friccion operativa para alta masiva o frecuente de templates.

## 5. Flujo tecnico resultante (to-be)

1. Operador/master prepara JSON visual (y opcionalmente JSON de contenido).
2. Invoca script o endpoint directo.
3. Backend valida plan/evento habilitados.
4. Backend crea template en Postgres.
5. Backend persiste visual default en Mongo referenciando el nuevo template.
6. Backend persiste o reutiliza contenido default segun estrategia.
7. Respuesta entrega IDs y estado de reutilizacion para trazabilidad.

## 6. Contexto funcional relacionado (ya existente en main)

La base funcional de "mas templates" ya contemplaba:

- Nuevos tipos de evento y templates en migraciones SQL (p. ej. `V24`, `V25`, `V26`).
- Carga de defaults visuales y de contenido en `MongoDataInitializer`.

Este hotfix complementa lo anterior con una **via de alta unificada por API**, para que agregar futuros templates sea mas rapido y menos propenso a errores.

## 7. Riesgos/consideraciones tecnicas

- `@Transactional` cubre Postgres; Mongo no participa en la misma transaccion distribuida. Si falla Mongo despues de crear en Postgres, puede requerir compensacion manual.
- El script depende de `curl` y `jq` disponibles en el host.
- En el script hay credenciales por defecto para uso local; se recomienda inyectarlas por variables de entorno en entornos reales.

## 8. Recomendaciones de validacion (QA)

- Caso 1: crear template con `contentConfig` nuevo y validar registros en Postgres + Mongo.
- Caso 2: crear template sin `contentConfig` y con `reuseExistingContent=true` donde exista contenido.
- Caso 3: crear template sin `contentConfig` donde no exista contenido y validar error esperado.
- Caso 4: validar rechazo cuando `eventId` o `planId` estan deshabilitados.
- Caso 5: validar que `visualConfig` queda persistido con `templateId/eventId/planId` correctos.

## 9. Ajuste adicional en URL de confirmacion para correos a invitados

Se aplico un ajuste en el backend para el enlace del boton **"Responder Invitacion"** enviado en correos de invitados.

### 9.1 Cambio de formato de URL

Formato anterior:

- `invitaciones/{invitationId}/{nombreEvento}/{pareja}?token={token}#started`

Formato nuevo:

- `invitaciones/{invitationId}/{nombreEvento}/{templateId}/{pareja}?token={token}#started`

El objetivo es incluir `templateId` en la ruta para que frontend pueda resolver correctamente la plantilla visual asociada al evento desde el enlace del correo.

### 9.2 Implementacion tecnica

Se modifico la construccion de URL en:

- `src/main/kotlin/mx/evolutiondev/invitaciones/modules/shared/guests/notifier/EmailGuestNotifier.kt`

Dentro del metodo `buildInvitationUrl(...)`:

- Se agrega `val templateId = invitation.template.id`
- Se incorpora `/$templateId/` en el path de la URL generada

### 9.3 Impacto funcional

- Aplica a los correos que usan la variable `confirmationUrl` (incluyendo el template de invitacion de invitados).
- No cambia el mecanismo actual de token (continua enviandose como query param `?token=...`).

## 10. Script operativo versionado para templates 11 y 12 (local)

Para evitar pasos manuales fuera de Git en entorno local Docker, se agregan scripts versionados:

- `scripts/apply_template_11_12_local.sh`
- `scripts/upsert_template_11_12.js`

Que ejecutan:

1. Ajuste en PostgreSQL de `invitation_template` para:
   - id `11` -> Boda Premium 2 (evento 1, plan 2)
   - id `12` -> XV Premium 2 (evento 2, plan 2)
2. Upsert en Mongo (`default_visual_configs` y `default_content_configs`) con los payloads:
   - `src/main/resources/data/mongo/payload-template-2.json`
   - `src/main/resources/data/mongo/payload-template-xv-2.json`
3. Deshabilita duplicados operativos `16` y `17` (si existen).

Ejecucion:

```bash
chmod +x scripts/apply_template_11_12_local.sh
./scripts/apply_template_11_12_local.sh
```

Variables opcionales:

- `POSTGRES_CONTAINER` (default `postgres-db`)
- `MONGO_CONTAINER` (default `mongo-db`)
- `POSTGRES_DB` (default `invitaciones`)
- `POSTGRES_USER` (default `evolution`)
