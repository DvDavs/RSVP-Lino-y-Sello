# 09 — Verificación adversarial: persistencia, API y seguridad

Autor: fase 1, rol `1-adv-seguridad` (ronda 2). Objetivo: romper `02-persistencia-y-catalogo.md`, `03-api.md` y `04-frontend-y-editor.md` (superficie iframe/postMessage): autorización, fallo parcial, ids inyectables, límites.

Método: para cada control de seguridad que el diseño afirma tener (P8), se buscó el punto exacto del pipeline donde se aplicaría y se verificó si de verdad cierra el caso o solo lo cierra en apariencia.

---

## Casos que SÍ están cubiertos (verificado, no objeción)

- **`_id` inyectable (H-13)**: `invitationId` siempre viene de la ruta, nunca del body; `itemId`/`assetId` los genera el servidor — verificado en `03 §1`, `esquema/common.ts` (`AssetId`/`Ulid` regex), `esquema/operations.ts` (`TempId` solo se resuelve a `Ulid` del lado servidor). Cerrado correctamente para el caso original de H-13.
- **Autorización uniforme**: `HierarchyValidationService` reusado en toda ruta `/editor/**` (`03 §1`, ADR-015) — un solo punto, no una autorización paralela que pueda divergir.
- **Contrato de errores uniforme**: tabla `TPL_*` (`03 §5`) — mata H-52 (403 vs. 400 inconsistente) al fijar un código por caso.
- **Fallo parcial en el registro de plantillas**: transacción única + tabla de auditoría append-only (`02 §4`) — un intento fallido no deja fila huérfana en `tpl_template`/`tpl_template_version` (verificado contra el flujo de 4 pasos).
- **Body sin límite (H-45)**: límite explícito de 256 KiB + `operations ≤ 50` (`03 §8`) — ver S-05 más abajo para una inconsistencia de cálculo, pero el control en sí existe.

## Objeciones

### S-01 (ALTA) — `assetId` no se valida por propiedad: un usuario autorizado puede referenciar el asset de OTRA invitación
**Documento/sección atacada**: `03-api.md` §3.3 (`setBlock`/`setItemBlock` con `ImageValue`/`AudioValue`), §5 (tabla de errores — no existe un código para este caso); `02-persistencia-y-catalogo.md` §2.3 (`tpl_asset`, sin verificación de pertenencia documentada en ningún punto del pipeline de escritura de `03`).

**Ataque**: `POST .../assets` (`03 §3.4`) sube un asset y devuelve `assetId` — hasta aquí, correcto (`tpl_asset.invitation_id = invitationId` de la ruta autorizada). Pero cuando ese `assetId` se usa después dentro de una `Operation` (`setBlock {blockId: "cover.image", value: {kind:"image", assetId: "as_...", ...}}`), el pipeline de validación descrito (`03 §3.3`: "cada Operation se valida contra el manifiesto... antes de aplicar") solo valida **forma** (`AssetId` regex, `01 §3.2`/`esquema/common.ts`) — no valida que ese `assetId` pertenezca a `tpl_asset` con `invitation_id = invitationId` (o `template_version_id` de la plantilla vigente, para assets propios de la plantilla). Un usuario A con acceso legítimo a su invitación 100, que en algún momento vio (por captura de red, por ser ADMIN con acceso jerárquico a otra invitación, o por casualidad de un enlace compartido) el `assetId` de una foto de la invitación 200 de otro cliente, puede escribir ese `assetId` en su propio documento. La composición (`compose()`) resolvería igualmente la URL (pertenece a un bucket público, `S3Buckets.kt`/`ASSETS`, según `03 §7`) — el resultado visible es que la foto privada de otro cliente aparece en la invitación del atacante. Es la misma familia de riesgo que H-13 (referenciar un recurso ajeno por id), reintroducida en un punto que el diseño no cubrió.

**Consecuencia real**: fuga de fotos entre clientes (menor severidad que el H-13 original porque no permite ESCRIBIR sobre la invitación ajena, pero sí exponer/reutilizar su contenido — sigue siendo una violación de P8 y potencialmente de privacidad de datos de otro cliente).

**Corrección propuesta**: en el paso de validación de cada `Operation` que porta un `assetId` (`03 §3.3`, antes de aplicar), añadir una comprobación de pertenencia: `SELECT 1 FROM tpl_asset WHERE public_id = ? AND (invitation_id = ? OR template_version_id = ?)` (invitationId de la ruta, template_version_id vigente del documento) — si no hay fila, `422 TPL_ASSET_NOT_OWNED`. Añadir esta comprobación también al pipeline de IA (`07 §4`, que ya declara el principio pero no el mecanismo concreto — esta es la implementación de ese principio).

### S-02 (MEDIA) — La ruta de registro de plantillas no está en la tabla de rutas de la API
**Documento/sección atacada**: `03-api.md` §2 (tabla de rutas — no incluye ninguna ruta de registro); `02-persistencia-y-catalogo.md` §4 (menciona "CLI o endpoint MASTER" en prosa, sin ruta ni verbo HTTP exactos).

**Ataque conceptual**: no es un ataque ejecutable, es una omisión de especificación que un implementador de fase 2 tendría que resolver por su cuenta — exactamente el tipo de ambigüedad que el criterio de terminado de esta fase ("concreto para que Sonnet implemente sin volver a diseñar") prohíbe. Sin una ruta fija con su exigencia de rol explícita en la MISMA tabla que el resto de la API, hay riesgo de que se implemente sin la verificación de rol MASTER que `02 §4` da por sentada pero no ata a un control de Spring Security concreto.

**Corrección propuesta**: añadir a `03 §2`: `POST /master/templates2/versions` (rol `MASTER` exclusivamente, verificado por el mismo mecanismo de roles que protege hoy `modules/master/**` — no `HierarchyValidationService`, que es para invitaciones, sino el chequeo de rol simple ya usado en el resto de `modules/master`), body = paquete completo (manifest+theme+defaults+assets en base64 o multipart), respuesta según `02 §4` (created/noop/rejected).

### S-03 (MEDIA) — `sandbox="allow-scripts allow-same-origin"` anula buena parte del aislamiento real del iframe
**Documento/sección atacada**: `04-frontend-y-editor.md` §3.

**Ataque conceptual**: `allow-scripts` + `allow-same-origin` juntos en un `<iframe sandbox>` es un patrón de sandbox-bypass conocido: el contenido del iframe, al considerarse "mismo origen", puede en principio manipular su propio atributo `sandbox` o acceder al `document` del padre si hay algún punto de contacto adicional no anticipado — el sandboxing deja de aportar una barrera real, solo una separación cosmética. El propio diseño (ADR-018) ya decidió comunicarse EXCLUSIVAMENTE por `postMessage`, sin necesitar acceso directo al DOM del padre — es decir, **no hay ninguna razón funcional para `allow-same-origin`** en este iframe.

**Consecuencia real**: si en el futuro `packages/sections` introdujera una vulnerabilidad de renderizado (p. ej. al añadir un tipo de bloque que sí requiera HTML enriquecido, o un bug real en el mapeo de `RichDoc`), el sandbox actual no contendría el impacto tanto como debería, precisamente porque ya está debilitado por `allow-same-origin`.

**Corrección propuesta**: quitar `allow-same-origin` del `sandbox` del iframe (`04 §3`): `sandbox="allow-scripts"` a secas. Verificar en fase 3 que ningún flujo real dependa de acceso same-origin (no debería, dado que todo pasa por `postMessage`); si `next/image` u otro mecanismo interno de Next.js resultara necesitar same-origin dentro del iframe, es una señal de que la arquitectura de canvas necesita revisarse, no de que haya que restaurar el flag débilmente.

### S-04 (referencia, ya cerrado en ronda 1) — Patrón de `blockId`/`sectionKey` sin acotar
Ya identificado y corregido proactivamente por 1-dominio como ADR-020 (`01 §2.2`) antes de esta ronda adversarial — se cita aquí solo para que el registro quede completo y trazable, no es una objeción abierta.

### S-05 (MEDIA) — Límites de tamaño inconsistentes entre esquema y transporte
**Documento/sección atacada**: `03-api.md` §8 (límite de body 256 KiB) vs. `esquema/operations.ts` (`OperationBatch.operations ≤ 50`) + `esquema/blocks.ts` (`RichTextSpec.constraints.maxLength` hasta 8000 caracteres).

**Ataque**: un lote legítimo de 50 operaciones `setBlock` sobre bloques `richText` cercanos al máximo (8000 caracteres cada uno) pesa, solo en el campo `value`, del orden de 50 × 8 KB ≈ 400 KB antes de contar el resto del JSON (estructura de `RichDoc`, escapes) — supera holgadamente el límite de transporte de 256 KiB propuesto. El esquema permite construir un lote que la capa HTTP rechazaría igual, aunque cada operación individual sea válida.

**Corrección propuesta**: elevar el límite de body HTTP a 768 KiB (margen sobre el cálculo anterior con overhead de JSON) **o** documentar explícitamente que el límite de transporte es intencionalmente más bajo que el máximo teórico del esquema, y que el cliente (`04 §4`, autoguardado) debe trocear un lote que se acerque al límite antes de enviarlo. Se recomienda la primera opción (subir el límite) por ser más simple de implementar y no reduce ninguna protección real (256 KiB vs. 768 KiB no cambia la naturaleza del límite, solo evita rechazar tráfico legítimo).

### S-06 (BAJA) — Sin límite de tasa explícito en el render público
**Documento/sección atacada**: `03-api.md` §7.

**Corrección propuesta**: no bloqueante — anotar en `03 §7` que la capa de despliegue (CDN/reverse proxy, fuera de alcance de este módulo) debe aplicar un límite de tasa básico por IP sobre `/public/i/**` como defensa en profundidad, aunque `publicToken` no sea adivinable por fuerza bruta en la práctica (26 caracteres Crockford base32 ≈ 130 bits de entropía).

### S-07 (BAJA) — Restricción de implementación no explícita contra XSS vía `richText`
**Documento/sección atacada**: `04-frontend-y-editor.md` §1/§6 (no menciona explícitamente cómo debe renderizarse `RichDoc`).

**Corrección propuesta**: añadir una frase explícita en `04 §6`: el renderer de `RichTextBlock` mapea nodos de `RichDoc` a elementos React directamente (`<strong>`, `<em>`, `<a href>` con la misma validación `HttpUrl` que el resto del esquema) — **nunca** serializar a string HTML ni usar `dangerouslySetInnerHTML`. El esquema (`esquema/blocks.ts`, `RichSpan`/`RichParagraph`/`RichDoc`) ya está diseñado para hacer esto natural (marcas cerradas, sin HTML libre); falta decirlo como restricción de implementación explícita para que fase 3 no lo reintroduzca por comodidad.

---

## Resumen de severidad

| Severidad | Cantidad | IDs |
|---|---|---|
| Alta | 1 | S-01 |
| Media | 3 | S-02, S-03, S-05 |
| Baja | 2 | S-06, S-07 |
| Ya cerrado (referencia) | 1 | S-04 |
