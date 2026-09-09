# 12b · Mapa de producto de la fase 5 — recorridos, pantallas, wireframes y decisiones

Agente **5-0b-B** · 2026-09-09 · rama `claude/fase-5-cimientos-adenda-u150eq` · estado **propuesta**

Este documento es el **mapa de producto** de la fase 5: qué recorre cada rol, qué pantalla existe y
cuál hay que construir, cómo se ve cada una de las nueve pantallas nuevas, y las decisiones de
producto que el orquestador ya cerró y que aquí quedan escritas con su porqué.

**Qué NO está aquí.** El inventario del backend (qué endpoint se reutiliza tal cual, cuál se
endurece con hallazgo concreto y cuál se crea, modelo de datos, autorización, esquema Stripe) lo
escribe en paralelo el agente 5-0b-A en `_12a-inventario-backend.md`. Cuando aquí se nombra un
endpoint es para decir **de dónde salen los datos de una pantalla**, no para especificarlo; todo lo
que este documento marca como *supuesto para 5-0b-A* es una pregunta que ese inventario debe cerrar.

Fuentes que mandan sobre este documento: `memoria/decisiones-dueno.md` (D-01…D-08),
`docs/rediseno-plantillas/hoja-de-ruta.md`, `prompts/fase-5-producto-completo.md`,
`memoria/contratos.md §8` y `§13`, `guias/identidad-visual.md` y la skill `identidad-visual`.

---

## B1. Recorridos por rol

### Clienta nueva (la que todavía no ha comprado nada)

Llega a `/` por un enlace o por una búsqueda y lee la portada: qué es, cómo funciona en tres pasos,
para qué celebraciones sirve, y **cuánto cuesta** — esto último es nuevo: hoy la sección de planes de
la portada dice literalmente que los precios no se publican y remite a un contacto humano
(`frontend/apps/web/components/sitio/Planes.tsx:1-13`, `lib/i18n.ts:174-180`), porque cuando se
escribió no existía ningún extremo que sirviera precios. Con Stripe ya hay uno, así que la portada
lleva a `/precios`, donde se comparan los planes de verdad. Elige uno y, si no tiene sesión, cae en
`/acceso` (pestaña «Crear cuenta», registro en tres pasos ya construido) y vuelve a `/precios` con la
compra en curso; el pago se hace en Stripe Checkout, fuera de nuestro dominio, y regresa a `/pago`,
que es la pantalla honesta de espera: la compra no está confirmada hasta que llega el webhook, y
esta pantalla lo dice y espera en vez de mentir. Confirmado el pago, entra al asistente `/editor`
(cuatro pasos: tipo de evento, plantilla, datos básicos, listo) y de ahí al editor
`/editor/[invitationId]`. Con la invitación ya escrita se pasa a `/editor/[invitationId]/invitados`:
carga a su gente a mano o pegando una lista, reparte pases (adultos, jóvenes, niños) y obtiene el
enlace personal de cada invitado. Comparte desde ahí mismo por WhatsApp o correo, y ve las
confirmaciones llegar en esa misma pantalla. Su cuenta y su contraseña viven en `/perfil`; el plan y
el historial de pagos de **esa** invitación, en `/editor/[invitationId]/plan`.

Una clienta que llega **sin haber comprado** puede hacer casi todo: crear la invitación, elegir
plantilla, escribirla entera y previsualizarla. Lo único que no puede es **publicar y compartir**
(ADR-5-0B-01, más abajo). Cuando lo intenta no se encuentra un botón muerto: se encuentra la
pantalla del plan, con el precio y el botón de pago.

### Invitada (la que recibe el enlace)

Le llega un mensaje de WhatsApp de la novia con una frase escrita a mano y un enlace
`https://linoysello.com/r/<token>`. Lo abre con el pulgar, en un teléfono, probablemente con datos
móviles y sin cuenta de nada. Lo primero que ve es su propio nombre y cuántos lugares le apartaron,
sobre la portada de la invitación; abajo, la invitación completa (la misma composición que sirve
`/i/[publicToken]`, mismo `packages/sections`, mismos tokens `--inv-*`) y, al final y también fijo
al pie, la única decisión que se le pide: **confirmo** o **no podré ir**. Si confirma, ajusta cuántos
de sus lugares usará y manda. La pantalla le contesta con lo que quedó registrado y le dice, con
todas sus letras, que puede volver a este mismo enlace y cambiar de opinión cuando quiera. Si vuelve
tres días después, el enlace la reconoce y le enseña su respuesta actual con un botón para cambiarla.
Nunca ve a otros invitados, ni cuántos van, ni el teléfono de nadie.

### Administrador (MASTER/ADMIN)

Entra por `/acceso` con su cuenta y aterriza en `/admin`, que es un panel de lectura con acciones
puntuales: cuántas invitaciones se crearon, cuántas se publicaron, cuántas se pagaron y cuántas
confirmaciones han entrado esta semana; la lista de clientas con su estado; la lista de invitaciones
con su plan, su pago, su enlace y el interruptor de deshabilitar; la lista de pagos con su estado de
Stripe; y el catálogo de plantillas registradas, en solo lectura (las plantillas se dan de alta con
el kit de autor de la fase 4, nunca desde el panel). No edita invitaciones ajenas desde aquí: para
eso ya existe el editor y la jerarquía de roles que lo permite.

---

## B2. Tabla maestra pantalla × rol

**Sesiones de la fase 5** (el reparto de trabajo del orquestador):
**E2** invitados + RSVP + compartir · **E3** cuenta + marca + legal · **E4** pagos · **E5** admin.
Cada ruta **nueva** tiene exactamente una sesión dueña. Las rutas existentes llevan «existente» y,
entre paréntesis, la sesión que las retoca y **qué fichero** toca, para que dos sesiones no escriban
el mismo (ver el anexo de propiedad de ficheros al final de esta sección).

| ruta | rol | sesión dueña | qué se ve | vacío / error / carga | de dónde salen los datos |
|---|---|---|---|---|---|
| `/` | público | existente (E4 añade el enlace a `/precios` en `components/sitio/Planes.tsx`) | portada: héroe, tres pasos, tipos de evento, testimonios de muestra, planes, contacto, CTA | sin vacío; `error.tsx` del grupo `(sitio)`; sin carga (estático) | estático desde `lib/i18n.ts §sitio`; contacto desde `lib/contacto.ts` |
| `/acceso` | público | existente (E3 añade el aviso de verificación en `components/sitio/AsistenteAcceso.tsx`) | dos pestañas: entrar y crear cuenta en tres pasos; recuperar contraseña con respuesta genérica (N-01) | error de credenciales sin distinguir causa; estado «Entrando…» | `POST /auth/token`, `/auth/signup`, `/auth/request-password-reset` (`AuthController.kt:36,51,60`) |
| `/ayuda` | público | existente (E3 pone `soporte@` en `components/sitio/ContactoParaContratar.tsx`) | buscador de dudas y caja de contacto | «Ninguna duda coincide» con acción de volver a verlas todas | `components/sitio/dudas-ayuda.ts` |
| `/editor` | clienta | existente (E4 cambia el destino del estado vacío de `AYUDA_PLANES` a `/precios`) | asistente de cuatro pasos + «Mis invitaciones» | `EmptyState` «Todavía no tienes invitaciones» (`MisInvitaciones.tsx:40-48`) | `GET /editor/templates2/catalog`, lista de invitaciones de la clienta |
| `/editor/[invitationId]` | clienta | existente (E2 añade la barra de sub-navegación; ver anexo) | chrome del editor: secciones, campos, fotos, publicar y compartir | `loading.tsx`, `error.tsx`, `not-found.tsx` propios ya existentes | `GET /editor/invitations/{id}/document` (`EditorDocumentController.kt:53`) |
| `/editor/[invitationId]/invitados` | clienta | **E2** | lista de invitados con pases y estado en vivo, alta individual, pegado/CSV, búsqueda, exportación, enlace personal y compartir por invitado | vacío: «Todavía no tienes invitados» con las dos altas; error de importación por fila; esqueleto de tabla al cargar | invitados de la invitación (hoy solo hay ruta ADMIN: `AdminGuestsController.kt:40`; el equivalente de cliente lo define 5-0b-A) |
| `/editor/[invitationId]/plan` | clienta | **E4** | plan de **esta** invitación, qué incluye, estado del pago, historial de pagos, botón de pagar o de cambiar de plan | sin pago: tarjeta «Esta invitación todavía no tiene plan» con el precio y el botón; error de Stripe con reintento; «Preparando el pago…» | catálogo de planes y pagos de la invitación (`invitation.is_paid` / `total_amount`, `InvitationEntity.kt:47-51`; el catálogo con precio lo define 5-0b-A) |
| `/precios` | público | **E4** | comparación de planes con precio, qué incluye cada uno, preguntas frecuentes de compra, contacto | sin catálogo: se cae al bloque de contacto que ya existe, nunca a una tabla vacía; error de red con reintento; esqueletos de tarjeta | catálogo público de planes (nuevo; 5-0b-A) |
| `/pago` | clienta | **E4** | resultado de la compra: esperando confirmación, confirmada, o cancelada por la clienta | espera con explicación honesta y sondeo acotado; error con el contacto de soporte; nunca «pagado» sin webhook | sesión de Stripe Checkout por `session_id` + estado de pago del backend (5-0b-A) |
| `/r/[token]` | invitada | **E2** | su nombre, sus pases, la invitación completa, confirmar o declinar, cambiar de opinión | token inválido/caducado: una sola pantalla indistinguible (sin oráculo); error con reintento; esqueleto de portada | `GET /public/invitation/guest-info/{token}` (`PublicGuestInfoController.kt:58`) + render público de la invitación |
| `/i/[publicToken]` | público | existente (nadie la reescribe en la fase 5) | la invitación publicada, sin datos de invitado | `not-found.tsx`, `forbidden.tsx`, `error.tsx`, `loading.tsx` ya existentes | `GET /public/i/{publicToken}/render` (`PublicRenderController.kt:46`) |
| `/admin` | MASTER/ADMIN | **E5** | métricas, clientas, invitaciones, pagos, plantillas registradas (lectura) | cada tabla con su vacío propio; error por bloque, no por página; esqueletos de fila | `modules/admin/**` (`DashboardController`, `InvitationController.kt:68`, `AdminUsersController`) |
| `/perfil` | clienta (y admin) | **E3** | nombre, correo, cambio de contraseña, cerrar sesión en todos los dispositivos, borrar cuenta (solicitud) | sin datos no aplica; error por campo; «Guardando…» | perfil del usuario (`modules/profile`, `modules/admin/users/service/ProfileService.kt`) |
| `/contacto` | público | **E3** | WhatsApp click-to-chat, correo de ventas, correo de soporte, horario | sin variables configuradas: la frase honesta de `lib/contacto.ts`, nunca un botón muerto | `lib/contacto.ts` sobre las variables `NEXT_PUBLIC_CONTACTO_*` y `NEXT_PUBLIC_SOPORTE_CORREO` |
| `/legal` | público | **E3** | aviso de privacidad y términos, en dos secciones enlazables, marcados como borrador pendiente de revisión legal | sin vacío; sin error (estático) | texto estático en es-MX |
| `/design` y `/design/**` | interno | existente (nadie la toca en la fase 5) | galería viva del sistema de diseño | — | `packages/ui` `metadatos` |
| 404 raíz y 404 del chrome | público | existente | página no encontrada | es el estado vacío | — |

### Anexo · propiedad de ficheros compartidos (para que no choquen las sesiones)

Tres ficheros los tocarían las cuatro sesiones a la vez. Se reparten así, y el reparto es parte de
la decisión, no una sugerencia:

- **Sub-navegación del editor.** `/editor/[invitationId]`, `.../invitados` y `.../plan` comparten una
  barra («Invitación · Invitados · Plan»). La escribe **E2** en un fichero nuevo
  `components/editor/NavegacionDeInvitacion.tsx` **con las tres entradas ya puestas**, incluida la
  de «Plan», que apunta a una ruta que E4 creará después. E4 solo escribe la página `plan/page.tsx`;
  no toca la navegación. Si E4 llega antes que E2, la entrada existe igual y lleva a un 404 del
  chrome, que es un estado ya construido y honesto.
- **Textos (`lib/i18n.ts`, 672 líneas, un solo objeto).** Se parte en `lib/i18n/` con un fichero por
  área (`comun.ts`, `sitio.ts`, `acceso.ts`, `editor.ts`, `invitados.ts`, `rsvp.ts`, `pagos.ts`,
  `admin.ts`, `cuenta.ts`, `legal.ts`) y `lib/i18n.ts` queda como barril que los compone y conserva
  el export `es_MX` — ni un consumidor cambia. **La partición la hace la primera sesión que aterrice
  (E2)**, en un commit propio que no añade texto nuevo, para que el movimiento se revise solo. A
  partir de ahí cada sesión escribe únicamente su fichero.
- **Presupuestos (`apps/web/scripts/check-budget.mjs`, constante `LIMITES_BASE`).** Las nueve
  entradas nuevas las añade **E2 de una sola vez**, con los valores de §B7, en el mismo commit de la
  partición de textos. Ninguna otra sesión toca ese fichero; si una ruta no cabe, se arregla la ruta.

---

## B3. Wireframes de las nueve pantallas nuevas

Convenciones de los nueve dibujos (100 columnas):

- `[display-*]`, `[heading-*]`, `[text-*]`, `[label-*]` marcan la **voz tipográfica** exacta:
  `display`/`heading` son Fraunces, `text` es Onest, `label` es Red Hat Mono en mayúsculas
  (`guias/identidad-visual.md §2`). Nunca la fuente de cuerpo en un título.
- `«FORMA: …»` marca **la única forma protagonista del bloque** (`Rays`, `Blob`, `Seal`,
  `WaveDivider`, `Triangle`, `ColorShadow`…). Una por bloque, nunca detrás de texto, campo o botón.
- `VACÍO ▸` marca dónde vive el estado vacío de ese bloque.
- Sin emojis, aquí y en la interfaz. Los iconos son de `packages/icons` y se nombran por su fichero.

### 1 · `/r/[token]` — la pantalla de la invitada (la más importante)

Es la que ve más gente, casi siempre en un teléfono, entrando desde WhatsApp, sin cuenta y sin
paciencia. Todo lo demás de la fase se puede rehacer; esta no.

Móvil (390 px), primer pliegue y estado de decisión:

```
+--------------------------------------------------------------------------------------------------+
|                                    « FORMA: Seal (sello) »                                        |
|                            .-------------------------------.                                      |
|                            |   portada de la invitación    |   <- Image mask="seal", sin texto    |
|                            |   (foto con máscara, nunca    |      encima: la separación es la      |
|                            |    rectángulo duro)           |      tarjeta de abajo, no un velo     |
|                            '-------------------------------'                                      |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+ |
|  |  PARA TI                                                             [label-md, mayúsculas]  | |
|  |  María Fernanda Cruz                                                      [display-lg]       | |
|  |  Te apartamos 2 lugares de adulto y 1 de niño.                            [text-md]          | |
|  |  ------------------------------------------------------------------------------------------  | |
|  |  Boda de Ana y Luis  ·  sábado 14 de marzo, 17:00                         [text-sm, ink-muted]| |
|  +----------------------------------------------------------------------------------------------+ |
|      ^ tarjeta OPACA sobre la portada: así se lee el nombre, no con degradado ni text-shadow        |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+ |
|  |  ¿Nos acompañas?                                                          [heading-md]       | |
|  |                                                                                              | |
|  |   ( o ) Sí, ahí estaré                     ( ) No podré ir                 [text-md]         | |
|  |         RadioGroup del sistema, objetivo de toque >= 44 px, no un control nativo             | |
|  |                                                                                              | |
|  |   Cuántos vamos                                                            [label-md]        | |
|  |   Adultos   [ - ]  2  [ + ]   de 2                                         [text-md]         | |
|  |   Niños     [ - ]  1  [ + ]   de 1                                                           | |
|  |   Jóvenes   ...................... (solo si la invitación los permite)                       | |
|  |                                                                                              | |
|  |   [  Confirmar mi asistencia  ]                          Button variant="primario" size="lg" | |
|  |   Puedes volver a este enlace y cambiar tu respuesta cuando quieras.       [text-sm]         | |
|  +----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  ============================ la invitación completa, tal cual =============================        |
|  |  el mismo render de /i/[publicToken]: packages/sections, tokens --inv-*, sin chrome      |        |
|  |  (portada, historia, itinerario, lugar, vestimenta, mesa de regalos, galería…)           |        |
|  ============================================================================================        |
|                                                                                                    |
|  ---- barra fija al pie mientras no haya respuesta ------------------------------------------      |
|  |  Tu respuesta:  [ Confirmar ]   [ No podré ir ]                          [label-md]      |      |
|  ---------------------------------------------------------------------------------------------      |
+--------------------------------------------------------------------------------------------------+
```

Después de responder, la misma ruta, mismo token:

```
+--------------------------------------------------------------------------------------------------+
|  +----------------------------------------------------------------------------------------------+ |
|  |  « FORMA: ColorShadow bajo la tarjeta »                                                       | |
|  |  [icono confirmar]  Quedaste confirmada                                   [display-md]       | |
|  |  Apartamos 2 adultos y 1 niño a tu nombre.                                [text-md]          | |
|  |  Te mandamos el detalle a mafer@ejemplo.mx.                               [text-sm]          | |
|  |                                                                                              | |
|  |  [ Cambiar mi respuesta ]                              Button variant="secundario"           | |
|  +----------------------------------------------------------------------------------------------+ |
|  (debajo sigue la invitación completa, sin cambios)                                                |
+--------------------------------------------------------------------------------------------------+
```

Token que no resuelve — **una sola pantalla** para inexistente, caducado, rotado, invitación
despublicada o anfitrión deshabilitado, igual que ya hace `/i/[publicToken]`
(`app/(public)/i/[publicToken]/page.tsx:20-27`): distinguirlos sería un oráculo de enumeración.

```
+--------------------------------------------------------------------------------------------------+
|                              « FORMA: Blob de fondo, apagado »                                     |
|                     Este enlace ya no funciona                            [display-md]             |
|                     Pídele a quien te invitó que te mande el suyo otra vez. [text-md]              |
|                     VACÍO ▸ este ES el estado vacío de la ruta: no hay nada más que ofrecer,       |
|                     y no se ofrece «buscar tu invitación», que sería justo el oráculo.             |
+--------------------------------------------------------------------------------------------------+
```

Escritorio (>= 1024 px) — cambia de verdad: la tarjeta de identidad y la decisión se fijan a la
izquierda y la invitación se desplaza a la derecha, para no obligar a bajar dos pantallas:

```
+--------------------------------------------------------------------------------------------------+
|  +--------------------------------+  +--------------------------------------------------------+  |
|  |  PARA TI            [label-md] |  |                                                        |  |
|  |  María Fernanda   [display-lg] |  |     la invitación completa (render público)            |  |
|  |  2 adultos, 1 niño   [text-md] |  |     con su propio desplazamiento                       |  |
|  |  ----------------------------  |  |                                                        |  |
|  |  ¿Nos acompañas? [heading-md]  |  |                                                        |  |
|  |  ( o ) Sí   ( ) No podré ir    |  |                                                        |  |
|  |  Adultos [-] 2 [+]  de 2       |  |                                                        |  |
|  |  Niños   [-] 1 [+]  de 1       |  |                                                        |  |
|  |  [ Confirmar mi asistencia ]   |  |                                                        |  |
|  |  « FORMA: Seal, una sola »     |  |                                                        |  |
|  +--------------------------------+  +--------------------------------------------------------+  |
|         columna fija (sticky)                        columna que se desplaza                       |
+--------------------------------------------------------------------------------------------------+
```

**Cómo funciona `/r/[token]` y por qué no se puede enumerar.** El servidor resuelve el token contra
el invitado (`InvitationGuestEntity.confirmationToken`, `InvitationGuestEntity.kt:60`), que hoy se
genera con `SecureRandom` de **128 bytes** en base64url (`core/auth/jwt/JwtUtil.kt:59-64`): 1024
bits de entropía, muy por encima de cualquier umbral razonable, y el problema real no es adivinarlo
sino su longitud en una URL de WhatsApp (ver §B8). El token va en la **ruta**, no en la cadena de
consulta, por dos motivos medibles: una `?g=` viaja en el `Referer` hacia cualquier recurso externo
que la página cargue, y se queda en los registros de los intermediarios con más facilidad que un
segmento de ruta; y el enlace de la invitada tiene un **modelo de caché distinto** del de
`/i/[publicToken]` (que es ISR de 300 s, `page.tsx:26`), porque su contenido es personal y no puede
compartir entrada de caché con nadie. Con una ruta propia, `/r/[token]` se declara dinámica y
`no-store` sin tocar el render público, que sigue cacheándose para todos. La página **no expone**
nunca la lista de invitados, ni el total de confirmados, ni el `cancellationToken` de nadie; la
respuesta para un token que no resuelve es idéntica a la de un token caducado, y el intento se
limita por tasa en el backend (5-0b-A). El `publicToken` de la invitación no se deriva del token del
invitado ni al revés: quien tenga uno no puede construir el otro.

### 2 · `/editor/[invitationId]/invitados` — la lista de la clienta

Escritorio:

```
+--------------------------------------------------------------------------------------------------+
| Lino & Sello                                                    [Ayuda]  [Cerrar sesión]           |
+--------------------------------------------------------------------------------------------------+
| Boda de Ana y Luis            ( Invitación )  ( Invitados )  ( Plan )        NavegacionDeInvitacion|
+--------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  Invitados                                                                    [display-md]         |
|  Reparte los pases y manda a cada quien su enlace.                            [text-md]            |
|                                                                                                    |
|  +----------------+  +----------------+  +----------------+  +----------------+                    |
|  | CONFIRMADOS    |  | PENDIENTES     |  | NO ASISTEN     |  | LUGARES        |   [label-md]       |
|  | 34             |  | 12             |  | 3              |  | 61 de 80       |   [display-md]     |
|  +----------------+  +----------------+  +----------------+  +----------------+                    |
|      « FORMA: ColorShadow bajo la fila de contadores, una sola vez »                               |
|                                                                                                    |
|  [ Buscar por nombre ]              [ Todos v ]        [ Agregar invitado ]  [ Pegar una lista ]   |
|                                                          primario              secundario          |
|                                                                                    [ Exportar ]    |
|  +----------------------------------------------------------------------------------------------+ |
|  | Nombre              Pases        Estado        Enlace                Compartir               | |
|  |----------------------------------------------------------------------------------------------| |
|  | María Fernanda C.   2A 1N 0J     Confirmada    [Copiar] [Ver]        [WhatsApp] [Correo]     | |
|  |                     usa 2A 1N    hace 2 días                                                 | |
|  | Rocío Delgado       2A           Pendiente     [Copiar] [Ver]        [WhatsApp] [Correo]     | |
|  | Jorge Luis Pérez    1A           No asiste     [Copiar] [Ver]        [WhatsApp] [Correo]     | |
|  +----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  VACÍO ▸ sin invitados, en lugar de la tabla:                                                      |
|  +----------------------------------------------------------------------------------------------+ |
|  |  « ilustración del sistema »   Todavía no tienes invitados       [heading-md]                 | |
|  |  Agrégalos de uno en uno o pega tu lista de WhatsApp.            [text-md]                    | |
|  |  [ Agregar invitado ]   [ Pegar una lista ]                                                   | |
|  +----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  CARGA ▸ Skeleton de seis filas con la misma altura que las reales (sin salto de maquetación).     |
|  ERROR ▸ tarjeta danger-soft sobre la tabla con «Reintentar»; la tabla anterior no se borra.       |
+--------------------------------------------------------------------------------------------------+
```

Móvil: la tabla no existe. Cada invitado es una tarjeta apilada, y las acciones de compartir viven
dentro de un `Sheet` por invitado (una acción a la vez, pulgar abajo):

```
+------------------------------------------------------------+
|  Invitados                              [display-md]        |
|  34 confirmados · 12 pendientes         [text-sm]           |
|  [ Buscar ]                        [ Todos v ]              |
|  +------------------------------------------------------+  |
|  | María Fernanda Cruz              [heading-sm]         |  |
|  | 2 adultos · 1 niño               [text-sm]            |  |
|  | Confirmada                       [Badge success]      |  |
|  | [ Compartir ]  [ Editar ]                             |  |
|  +------------------------------------------------------+  |
|  | Rocío Delgado                                         |  |
|  | 2 adultos · Pendiente            [Badge neutro]       |  |
|  | [ Compartir ]  [ Editar ]                             |  |
|  +------------------------------------------------------+  |
|  [ Agregar invitado ]        botón fijo al pie             |
+------------------------------------------------------------+
```

Pegado de lista (el `Sheet` de importación), con los errores **por fila** y sugiriendo la corrección,
nunca un «formato inválido» a secas:

```
+--------------------------------------------------------------------------------------------------+
|  Pega tu lista                                                             [heading-md]           |
|  Un invitado por renglón: nombre, adultos, niños, jóvenes, teléfono.       [text-md]              |
|  +----------------------------------------------------------------------------------------------+ |
|  | María Fernanda Cruz, 2, 1, 0, 9511234567                                                     | |
|  | Rocío Delgado, 2                                                                             | |
|  | , 3                                                          <- renglón 3                    | |
|  +----------------------------------------------------------------------------------------------+ |
|  Vista previa: 2 invitados listos, 1 con problema                          [label-md]             |
|  Renglón 3: falta el nombre. Escríbelo antes de la primera coma.           [text-sm, danger-text] |
|  [ Agregar los 2 que están bien ]   [ Volver a la lista ]                                         |
+--------------------------------------------------------------------------------------------------+
```

### 3 · `/editor/[invitationId]/plan` — el plan de esta invitación

```
+--------------------------------------------------------------------------------------------------+
| Boda de Ana y Luis            ( Invitación )  ( Invitados )  ( Plan )                              |
+--------------------------------------------------------------------------------------------------+
|  Plan de esta invitación                                                   [display-md]           |
|                                                                                                    |
|  --- SIN PAGO (VACÍO ▸ este es el estado vacío de la pantalla) --------------------------------    |
|  +----------------------------------------------------------------------------------------------+ |
|  |  « FORMA: Triangle en la esquina, una sola »                                                  | |
|  |  Esta invitación todavía no tiene plan                                    [heading-lg]        | |
|  |  Puedes escribirla y verla completa sin pagar. Para publicarla y                              | |
|  |  mandarla a tus invitados necesitas un plan.                              [text-md]           | |
|  |                                                                                              | |
|  |  Plan Fiesta            $ ___ MXN, pago único            [display-sm] + [label-md]           | |
|  |  Hasta 150 invitados · confirmaciones ilimitadas · enlace propio          [text-sm]           | |
|  |                                                                                              | |
|  |  [ Pagar y publicar ]  primario        [ Ver todos los planes ]  terciario -> /precios        | |
|  +----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  --- CON PAGO ---------------------------------------------------------------------------------    |
|  +----------------------------------------------------------------------------------------------+ |
|  |  Plan Fiesta   [Badge success: Pagado]                                    [heading-lg]        | |
|  |  Pagado el 3 de marzo de 2026 · $ ___ MXN                                 [text-md]           | |
|  |  Hasta 150 invitados · llevas 46                                          [text-sm]           | |
|  |  [ Ver mi comprobante ]                                                                       | |
|  +----------------------------------------------------------------------------------------------+ |
|  Pagos de esta invitación                                                  [heading-md]           |
|  | 3 mar 2026   Plan Fiesta    $ ___ MXN   Pagado      [Comprobante]  |                           |
|  VACÍO ▸ «Todavía no hay pagos registrados.»                                                       |
|  CARGA ▸ Skeleton de la tarjeta grande + dos filas.  ERROR ▸ tarjeta con reintento y soporte.      |
+--------------------------------------------------------------------------------------------------+
```

### 4 · `/precios`

```
+--------------------------------------------------------------------------------------------------+
| Lino & Sello        Cómo funciona    Precios    Ayuda                      [ Entrar ]              |
+--------------------------------------------------------------------------------------------------+
|                              « FORMA: Rays detrás del bloque de título »                           |
|   PLANES                                                                   [label-md]             |
|   Un pago por invitación. Sin mensualidades.                               [display-xl]           |
|   Escribes y ves tu invitación gratis; pagas cuando la quieras mandar.     [text-lg]              |
|                                                                                                    |
|  +---------------------------+  +---------------------------+  +---------------------------+      |
|  | SENCILLO      [label-md]  |  | FIESTA        [label-md]  |  | GRANDE        [label-md]  |      |
|  | $ ___ MXN   [display-lg]  |  | $ ___ MXN   [display-lg]  |  | $ ___ MXN   [display-lg]  |      |
|  | pago único    [text-sm]   |  | pago único    [text-sm]   |  | pago único    [text-sm]   |      |
|  | ------------------------- |  | ------------------------- |  | ------------------------- |      |
|  | hasta 60 invitados        |  | hasta 150 invitados       |  | sin límite de invitados   |      |
|  | confirmaciones            |  | confirmaciones            |  | confirmaciones            |      |
|  | enlace propio             |  | enlace propio             |  | enlace propio             |      |
|  |                           |  | galería de fotos          |  | galería y música          |      |
|  | [ Elegir Sencillo ]       |  | [ Elegir Fiesta ]         |  | [ Elegir Grande ]         |      |
|  |   secundario              |  |   primario (recomendado)  |  |   secundario              |      |
|  +---------------------------+  +---------------------------+  +---------------------------+      |
|         « la tarjeta recomendada lleva ColorShadow; las otras dos, no »                            |
|                                                                                                    |
|  Preguntas de compra                                                       [heading-lg]           |
|  ¿Puedo probar antes de pagar? · ¿Puedo cambiar de plan? · ¿Qué pasa si cancelo?   [text-md]      |
|                                                                                                    |
|  ¿Prefieres que te lo expliquemos?                                         [heading-md]           |
|  [ Escribir por WhatsApp ]   [ Escribir por correo ]      (bloque ContactoParaContratar existente) |
|                                                                                                    |
|  VACÍO ▸ sin catálogo del backend NO se pinta una tabla vacía: se enseña solo el bloque de         |
|          contacto con «Escríbenos y te pasamos los precios», que es lo que hoy hace la portada.    |
|  CARGA ▸ tres Skeleton con la altura exacta de las tarjetas.                                       |
|  ERROR ▸ misma salida que el vacío, más un «Reintentar» discreto: el contacto nunca falla.        |
+--------------------------------------------------------------------------------------------------+
```

Móvil: las tres tarjetas se apilan, la recomendada primero, y el precio queda siempre por encima del
pliegue.

### 5 · `/pago`

Tres estados, una sola ruta. El estado que manda es el del **backend**, no el `success_url` de
Stripe: volver de Checkout no es haber pagado.

```
+--- esperando ------------------------------------------------------------------------------------+
|                            « FORMA: ProgressRing del sistema, sin girar si                        |
|                              prefers-reduced-motion »                                             |
|   Estamos confirmando tu pago                                              [display-md]           |
|   Tu banco ya nos contestó; falta que el cobro quede registrado. Esto      [text-md]              |
|   suele tardar unos segundos. No cierres esta página.                                             |
|   Si tarda más de un minuto, escríbenos: soporte@…                         [text-sm]              |
+--------------------------------------------------------------------------------------------------+

+--- confirmado -----------------------------------------------------------------------------------+
|   « FORMA: Seal »   [icono exito]                                                                 |
|   Listo, tu plan está activo                                               [display-lg]           |
|   Plan Fiesta para «Boda de Ana y Luis». Te mandamos el comprobante        [text-md]              |
|   a ana@ejemplo.mx.                                                                                |
|   [ Ir a mi invitación ]  primario     [ Ver mi plan ]  secundario                                |
+--------------------------------------------------------------------------------------------------+

+--- cancelado por la clienta ---------------------------------------------------------------------+
|   No completaste el pago                                                   [display-md]           |
|   No te cobramos nada. Tu invitación sigue guardada tal como la dejaste.   [text-md]              |
|   [ Volver a intentar ]  primario      [ Ver los planes ]  terciario                              |
|   VACÍO ▸ este estado ES el vacío de la ruta: sin sesión de pago que mirar, se llega aquí.         |
+--------------------------------------------------------------------------------------------------+
```

### 6 · `/admin`

```
+--------------------------------------------------------------------------------------------------+
| Lino & Sello · Administración                                     admin@…    [ Cerrar sesión ]     |
+--------------------------------------------------------------------------------------------------+
| ( Resumen )  ( Clientas )  ( Invitaciones )  ( Pagos )  ( Plantillas )        Tabs del sistema     |
+--------------------------------------------------------------------------------------------------+
|  Resumen                                                                   [display-md]           |
|  +--------------+ +--------------+ +--------------+ +--------------+ +--------------+             |
|  | CLIENTAS     | | INVITACIONES | | PUBLICADAS   | | PAGADAS      | | RSVP 7 DÍAS  | [label-md]  |
|  | 128          | | 141          | | 96           | | 103          | | 412          | [display-md]|
|  +--------------+ +--------------+ +--------------+ +--------------+ +--------------+             |
|      « FORMA: Stripes como banda bajo la fila de métricas, una sola vez »                          |
|                                                                                                    |
|  Invitaciones                                          [ Buscar ]   [ Estado v ]   [ Plan v ]      |
|  +----------------------------------------------------------------------------------------------+ |
|  | Invitación         Clienta        Plan      Pago      Estado      Enlace     Acciones        | |
|  |----------------------------------------------------------------------------------------------| |
|  | Boda Ana y Luis    Ana Torres     Fiesta    Pagado    Publicada   [Abrir]    [Deshabilitar]  | |
|  | XV de Sofía        M. Cruz        —         —         En edición  —          [Deshabilitar]  | |
|  +----------------------------------------------------------------------------------------------+ |
|  VACÍO ▸ por tabla, no por página: «Todavía no hay invitaciones», «Ningún pago con ese filtro».    |
|  CARGA ▸ Skeleton por bloque; el resumen no espera a las tablas ni al revés.                       |
|  ERROR ▸ por bloque: si «Pagos» falla, «Clientas» sigue en pantalla con su dato bueno.             |
|                                                                                                    |
|  Plantillas registradas (solo lectura; el alta es con el kit de autor)     [heading-md]            |
|  | boda-clasica 1.2.0   registrada 2 mar 2026   12 invitaciones la usan |                         |
+--------------------------------------------------------------------------------------------------+
```

Móvil: tabs arriba, tarjetas apiladas y **sin acciones destructivas** (deshabilitar una invitación
pide pantalla ancha; en móvil el control se enseña deshabilitado con la razón, nunca escondido).

### 7 · `/perfil`

```
+--------------------------------------------------------------------------------------------------+
|  Tu cuenta                                                                 [display-md]           |
|  +----------------------------------------------------------------------------------------------+ |
|  |  « FORMA: Pill detrás del avatar, una sola »                                                  | |
|  |   ( AT )   Ana Torres                                                     [heading-lg]        | |
|  |            ana@ejemplo.mx   [Badge: correo sin verificar]  [ Reenviar ]   [text-sm]           | |
|  +----------------------------------------------------------------------------------------------+ |
|  Tus datos                                                                 [heading-md]           |
|  Nombre     [ Ana                    ]      Apellidos  [ Torres          ]                        |
|  Correo     [ ana@ejemplo.mx         ]      (cambiarlo pide verificar de nuevo)   [text-sm]       |
|  [ Guardar cambios ]                                                                              |
|                                                                                                    |
|  Contraseña                                                                [heading-md]           |
|  Actual [ •••••••• ]   Nueva [ •••••••• ]   Repite [ •••••••• ]                                   |
|  Al menos 8 caracteres, con mayúscula, minúscula y símbolo.                [text-sm]              |
|  [ Cambiar contraseña ]                                                                            |
|                                                                                                    |
|  Sesiones                                                                  [heading-md]           |
|  Si usaste tu cuenta en un equipo prestado, ciérralas todas.               [text-md]              |
|  [ Cerrar sesión en todos los dispositivos ]   secundario                                         |
|                                                                                                    |
|  Tu información                                                            [heading-md]           |
|  [ Pedir que borren mi cuenta ]  terciario, con diálogo de confirmación                           |
|  VACÍO ▸ no aplica (siempre hay datos). CARGA ▸ Skeleton por campo.                                |
|  ERROR ▸ por campo, junto al campo, diciendo qué corregir; nunca un banner genérico arriba.       |
+--------------------------------------------------------------------------------------------------+
```

### 8 · `/contacto`

```
+--------------------------------------------------------------------------------------------------+
|                          « FORMA: WaveDivider entre el título y las tarjetas »                     |
|   HABLEMOS                                                                 [label-md]             |
|   ¿Te ayudamos a decidir?                                                  [display-xl]           |
|   Contestamos personas, no un robot.                                       [text-lg]              |
|                                                                                                    |
|  +-------------------------------------+  +-------------------------------------+                  |
|  | [icono chat]  WhatsApp  [heading-md]|  | [icono correo] Correo  [heading-md] |                  |
|  | +52 951 470 9685        [text-md]   |  | hola@linoysello.com     [text-md]   |                  |
|  | Para precios y para contratar.      |  | Para lo que prefieras por escrito.  |                  |
|  | [ Escribir por WhatsApp ]           |  | [ Escribir por correo ]             |                  |
|  +-------------------------------------+  +-------------------------------------+                  |
|                                                                                                    |
|  ¿Ya eres clienta y algo no funciona?                                      [heading-md]           |
|  Escríbenos a soporte@linoysello.com y dinos el nombre de tu invitación.   [text-md]              |
|                                                                                                    |
|  VACÍO ▸ sin variables configuradas NO se pinta ninguna tarjeta con enlace: sale la frase          |
|          honesta que ya existe (`lib/i18n.ts:200`, `sitio.contactar.sinContacto`). Es el mismo     |
|          criterio de `lib/contacto.ts`: un botón que no lleva a nadie es peor que su ausencia.     |
+--------------------------------------------------------------------------------------------------+
```

### 9 · `/legal`

```
+--------------------------------------------------------------------------------------------------+
|   Avisos legales                                                           [display-lg]           |
|   Borrador pendiente de revisión legal. Última actualización: 9 sep 2026.  [text-sm, warning-text]|
|                                                                                                    |
|  +--------------------------+  +--------------------------------------------------------------+   |
|  |  En esta página          |  |  Aviso de privacidad                         [heading-lg]    |   |
|  |  · Aviso de privacidad   |  |  Qué datos guardamos, para qué y por cuánto  [text-md]       |   |
|  |    Qué guardamos         |  |  tiempo. Los nombres y teléfonos de tus                       |   |
|  |    Tus invitados         |  |  invitados son tuyos: nosotros solo los                       |   |
|  |    Tus derechos          |  |  guardamos para que puedas mandarles su enlace.               |   |
|  |  · Términos              |  |                                                              |   |
|  |    Qué incluye tu plan   |  |  Términos del servicio                       [heading-lg]    |   |
|  |    Devoluciones          |  |  Qué incluye tu plan, qué pasa si cancelas… [text-md]        |   |
|  |  (índice fijo, sticky)   |  |                                                              |   |
|  +--------------------------+  +--------------------------------------------------------------+   |
|      « FORMA: ninguna. Es una página de lectura larga: la única disciplina es la medida de línea   |
|        (max 70ch) y el ritmo vertical. Meterle una forma sería ruido. »                            |
|  Móvil: el índice se convierte en una lista al principio, no en una barra fija.                    |
+--------------------------------------------------------------------------------------------------+
```

---

## B4. ADR-5-0B-01 — Puerta de publicación: editar gratis, publicar con plan pagado

## ADR-5-0B-01 — La puerta de pago está en publicar, no en editar, y se comprueba en el backend
- Fecha: 2026-09-09 · Estado: propuesta · Autor: 5-0b-B
- Contexto: la fase 5 introduce cobro (D-05: Stripe Checkout + webhook) sobre un producto cuyo valor
  solo se ve **después** de trabajar un rato en él: elegir plantilla, escribir los datos y verla
  compuesta. Poner el cobro antes de eso obliga a pagar a ciegas. Hay además tres hechos del código
  que condicionan dónde puede vivir la puerta. (1) La invitación **no la crea el módulo nuevo**:
  `templates2` aplica una plantilla a una invitación que ya existe (`MisInvitaciones.tsx:3-7`,
  ADR-2-4-02) y la única alta es hoy `POST /admin/invitations/create`, con rol ADMIN
  (`InvitationController.kt:52`). (2) El modelo ya tiene el estado de pago:
  `InvitationEntity.isPaid` y `totalAmount` (`InvitationEntity.kt:47-51`) y un
  `PUT /admin/invitations/{id}/mark-as-paid` (`InvitationController.kt:42`). (3) La publicación ya
  tiene un punto de estrangulamiento único y **ya tiene el concepto de bloqueo**:
  `POST /editor/invitations/{id}/release` y su gemelo de solo lectura
  `GET /editor/invitations/{id}/release/preflight`, que devuelve
  `PreflightResponse{canPublish, blockers[], warnings[]}` (`EditorReleaseController.kt:36-50`,
  `Templates2EditorDtos.kt:192-208`), con la comprobación de bloqueos compartida entre los dos
  (`ReleaseService.kt:64-92`). El riesgo conocido de cualquier puerta de pago dibujada solo en la
  interfaz es que se salte con una petición directa; y el riesgo de una puerta mal contada es el
  botón muerto que ya destapó G-01 en la fase 3-C (`lib/contacto.ts:1-12`): un camino que promete
  una salida que no existe.
- Decisión:
  1. **Editar y previsualizar son gratis.** Crear la invitación, elegir plantilla, escribir todos los
     campos, subir fotos, deshacer, ver el lienzo y `/preview/[invitationId]` no exigen pago.
  2. **Publicar y compartir exigen plan pagado en esa invitación.** La comprobación vive en el
     **backend**, dentro de `ReleaseService`, y se expresa como un `blocker` más del preflight con
     código propio (`TPL_PLAN_UNPAID`), de modo que `GET …/release/preflight` devuelve
     `canPublish=false` y `POST …/release` responde `402` con ese mismo código. La interfaz **no es**
     la puerta: es su reflejo.
  3. Con la puerta cerrada, el reparto de enlaces también lo está: sin release activo no hay
     `publicToken` publicado, y `/r/[token]` de un invitado de una invitación sin publicar responde
     con la misma pantalla indistinguible que un token inválido.
  4. La pantalla **nunca** enseña un botón muerto: «Publicar» sigue existiendo y sigue siendo
     pulsable; al pulsarlo, el diálogo de publicar enseña el bloqueo «Falta el plan» con el precio y
     un botón que lleva a `/editor/[invitationId]/plan`, que es la pantalla que sí puede resolverlo.
  5. **Consecuencia obligatoria** de (1): la invitación tiene que poder nacer **sin pagar**, así que
     la fase 5 necesita un alta de invitación para el rol USER (hoy solo hay la de ADMIN), que la
     cree con `is_paid = false`. Especificarla es de 5-0b-A; sin ella, «editar gratis» es imposible
     porque no habría nada que editar antes de pagar.
- Alternativas descartadas y por qué:
  - **Cobrar antes de crear la invitación** (la forma que el producto tiene hoy de facto: la
    invitación nace de una compra). Se descarta porque obliga a comprar sin haber visto nada y
    porque contradice el objetivo de negocio de la fase, que quiere a la clienta dentro del editor
    cuanto antes. Además deja el asistente y el editor sin ningún recorrido para quien todavía duda.
  - **Poner la puerta solo en la interfaz** (ocultar el botón de publicar). Se descarta porque no es
    una puerta: `POST …/release` seguiría aceptando la publicación de cualquiera con una sesión
    válida, y el producto cobraría solo a quien no sabe usar la consola del navegador.
  - **Poner la puerta en el render público** (publicar libre, pero `/i/[publicToken]` responde 402 si
    no está pagado). Se descarta por tres motivos: le da la mala noticia al **invitado**, que no
    tiene nada que ver; ensucia una ruta pública que hoy tiene exactamente tres estados bien
    definidos (`page.tsx:20-27`); y deja rastro en la caché de la CDN de algo que sí llegó a estar
    publicado.
  - **Marca de agua en la invitación gratuita en lugar de puerta.** Se descarta para esta fase: es
    una decisión de producto y de arte que nadie ha tomado (no hay logotipo todavía, D-02) y
    convierte el criterio binario «está pagada / no lo está» en una negociación estética. Queda
    anotada como pregunta abierta por si el dueño la prefiere más adelante.
  - **Límite por número de invitados en vez de por publicación.** Se descarta como puerta principal:
    el valor que la clienta compra es «mandarla», no «apuntar gente», y un límite de invitados
    castiga justo el trabajo que ella ya hizo. Sí se conserva como **diferencia entre planes**.
- Matriz de capacidades:

  | Acción | Sin plan pagado | Con plan pagado |
  |---|---|---|
  | Crear la invitación desde `/editor` | Sí | Sí |
  | Elegir y cambiar de plantilla | Sí | Sí |
  | Escribir contenido, subir fotos, deshacer | Sí | Sí |
  | Ver el lienzo y `/preview/[invitationId]` | Sí | Sí |
  | `GET …/release/preflight` | Sí; devuelve `canPublish=false` con `TPL_PLAN_UNPAID` | Sí |
  | `POST …/release` (publicar) | **No** · `402 TPL_PLAN_UNPAID` | Sí |
  | Rotar el enlace público | **No** (no hay enlace que rotar) | Sí |
  | Agregar invitados y repartir pases | Sí | Sí |
  | Ver el enlace personal de un invitado | Sí, pero marcado «se activa al publicar» | Sí |
  | Compartir por WhatsApp / correo desde la lista | **No** · el botón abre el plan | Sí |
  | `/r/[token]` para un invitado | Pantalla indistinguible de token inválido | Funciona |
  | Exportar la lista de invitados | Sí (sus datos son suyos) | Sí |
  | `/editor/[invitationId]/plan` | Sí; es la pantalla que resuelve el bloqueo | Sí |

- Qué pasa si el pago caduca o se reembolsa:
  - **Caducidad.** Con pago único por invitación (la recomendación del prompt maestro, bloque 5-4) no
    hay caducidad: se paga una vez y la invitación queda publicable para siempre. Si el dueño
    prefiere suscripción, hace falta una fecha de vigencia por invitación, y entonces el vencimiento
    se comporta igual que un reembolso pero avisando **antes** (dos correos: 7 días y 1 día). Es
    pregunta abierta P-5-0B-3.
  - **Reembolso o contracargo** (`charge.refunded`, `charge.dispute.created`): el webhook pone
    `is_paid = false`, **retira el release activo** (equivalente a `DELETE …/release`: el enlace deja
    de servir de inmediato en origen, con la ventana de 300 s de la CDN que ya está documentada en
    `contratos.md §8`), y avisa por correo a la clienta con la razón y el camino para volver a pagar.
    En `/editor/[invitationId]/plan` el estado pasa a «Pago devuelto» con el botón de pagar otra vez;
    la invitación **no se borra** y los invitados **no se borran**: al volver a pagar y publicar, los
    mismos enlaces personales vuelven a funcionar. El panel `/admin` lo ve en la lista de pagos.
  - **Pago disputado y luego resuelto a favor:** vuelve a `is_paid = true` pero **no republica sola**;
    la clienta pulsa publicar. Republicar en nombre de alguien sin que lo pida es una acción visible
    para terceros que el sistema no debe tomar por su cuenta.
- Consecuencias por pantalla:
  - `/editor/[invitationId]`: el diálogo de publicar gana un bloqueo nuevo, con el mismo aspecto que
    los que ya pinta (los de contenido de demostración sin sustituir); el texto dice qué falta y el
    botón lleva al plan. El resto del editor no cambia.
  - `/editor/[invitationId]/plan`: es la pantalla que **resuelve** el bloqueo y por eso su estado
    vacío es la oferta, no un mensaje de error.
  - `/editor/[invitationId]/invitados`: los botones de compartir están presentes y deshabilitados con
    una razón visible («Se activan cuando publiques»), nunca ocultos; «Copiar enlace» sigue copiando
    para que la clienta pueda probarlo ella misma, con el aviso de que todavía no abre para nadie más.
  - `/precios` y `/pago`: son el camino de salida del bloqueo y por eso la ruta `/precios` acepta un
    parámetro con la invitación de origen, para volver a ella tras pagar.
  - `/admin`: la columna «Pago» de la lista de invitaciones es la misma verdad que la puerta; un
    ADMIN que marque una invitación como pagada la habilita, y eso queda registrado.
  - `/r/[token]` y `/i/[publicToken]`: no cambian. Un invitado nunca ve nada de esto.

---

## B5. Correo transaccional

Todo sobre `core/email`: `EmailService.sendEmail(to, templateName, variables)`
(`EmailService.kt:13`) y `EmailContentGenerator.generate` (`EmailContentGenerator.kt:14`), que hoy
resuelve nueve plantillas por nombre: `welcome`, `invitation`, `admin-invitation-notification`,
`password-reset`, `guest-notification`, `guest-confirmation-success`, `guest-decline-confirmation`,
`host-guest-confirmed-notification`, `host-guest-declined-notification`
(`EmailContentGenerator.kt:15-24`). El envío tiene dos estrategias, Google SMTP y MailerSend,
elegidas por la propiedad `email.provider` (`application.yml:71-72`).

| # | correo | a quién | qué dice (una línea, es-MX) | qué lo dispara | enlace | variables de entorno |
|---|---|---|---|---|---|---|
| 1 | Bienvenida | clienta recién registrada | «Tu cuenta de Lino & Sello está lista: entra y empieza tu invitación.» | alta correcta en `POST /auth/signup` (`AuthController.kt:51`) | `FRONTEND_URL/editor` | `FRONTEND_URL`, `MAIL_FROM`, `MAIL_FROM_NOMBRE`, `MAIL_RESPONDER_A` |
| 2 | Verificación de correo | clienta recién registrada | «Confirma que este correo es tuyo: aquí te mandaremos el enlace de tu invitación.» | mismo alta que (1), en el mismo commit | `FRONTEND_URL/acceso?verificar=<token>` | `FRONTEND_URL`, `MAIL_FROM`, `MAIL_FROM_NOMBRE` |
| 3 | Recuperación de contraseña | quien la pidió | «Cambia tu contraseña con este enlace; caduca pronto y solo sirve una vez.» | `POST /auth/request-password-reset` (`AuthController.kt:60`) | `FRONTEND_URL/acceso?recuperar=<token>` | `FRONTEND_URL`, `MAIL_FROM`, `MAIL_FROM_NOMBRE` |
| 4 | Confirmación de pago | clienta que pagó | «Recibimos tu pago del plan Fiesta: tu invitación ya se puede publicar.» | webhook de Stripe, evento de pago completado, **después** de marcar `is_paid` | `FRONTEND_URL/editor/{invitationId}/plan` | `FRONTEND_URL`, `MAIL_FROM`, `MAIL_FROM_NOMBRE`, `MAIL_RESPONDER_A`, `STRIPE_MONEDA` |
| 5 | Aviso de RSVP a la clienta | dueña de la invitación | «María Fernanda confirmó: 2 adultos y 1 niño. Llevas 34 de 80 lugares.» | `PUT /public/invitation/{confirmationToken}/attend` (`InviteAttendingController.kt:20`) y su gemelo de cancelación | `FRONTEND_URL/editor/{invitationId}/invitados` | `FRONTEND_URL`, `MAIL_FROM`, `MAIL_FROM_NOMBRE`, `SOPORTE_CORREO` |

**Qué ya existe y qué no** (lo que sigue son supuestos y hallazgos para 5-0b-A, no especificación):

- (1) y (3) **ya tienen plantilla** (`welcome`, `password-reset`); solo hay que revisar el texto para
  la marca «Lino & Sello» (D-02) y para es-MX.
- (5) **ya tiene plantilla** (`host-guest-confirmed-notification`,
  `host-guest-declined-notification`) — lo que hay que revisar es a qué enlace manda.
- (2) **no existe**: no hay ninguna columna ni servicio de verificación de correo en el backend (una
  búsqueda de `emailVerified` / `is_verified` sobre `src/main/kotlin` no devuelve nada relacionado).
  **Supuesto para 5-0b-A**: si añadir la columna y su token resulta caro para esta fase, la
  alternativa conservadora es que el registro funcione sin verificar y el correo sin verificar se
  marque en `/perfil` con su reenvío, sin bloquear ninguna capacidad. Bloquear el uso del producto
  detrás de una verificación que todavía no se puede probar de punta a punta sería peor.
- (4) **no existe**: no hay plantilla de pago. Es plantilla nueva (`payment-confirmation`).
- **Hallazgo, y es grave para el correo del invitado**: `EmailGuestNotifier.buildInvitationUrl`
  ignora el `frontendUrl` que recibe y devuelve una URL con el **dominio de producción del sistema
  antiguo**, escrito a mano: `EmailGuestNotifier.kt:68` retorna
  `https://invitaciones-digitales-agape.cloud/invitaciones/{id}/{slug}/{nombres}?token=…`, con la
  versión configurable justo debajo, comentada (`:69`). Todo correo de invitación que salga hoy lleva
  a un producto que no es este. Es exactamente el mismo defecto que U-6 corrigió en la interfaz
  (`lib/enlace-publico.ts:1-12`) y aquí sigue vivo en el correo.
- **Hallazgo**: `ResetPasswordService.kt:82` construye
  `"$frontendUrl/login/reset-password/ChangePass?token=$resetToken"`, una ruta que **no existe** en
  `apps/web` (el árbol de `app/**` no tiene `/login`). El correo de recuperación, hoy, lleva a un
  404. La ruta viva es `/acceso` con su pestaña de recuperación (`lib/i18n.ts:76-88`).
- **Hallazgo**: el remitente está fijado en `application.yml:56-57` (`spring.mail.username`, una
  cuenta de Gmail del sistema anterior) y en `mailersend.fromEmail` (`application.yml:75`). Ninguna
  de las dos es una dirección de Lino & Sello. De ahí salen `MAIL_FROM`, `MAIL_FROM_NOMBRE` y
  `MAIL_RESPONDER_A` (§B6): el transaccional sale de `no-responder@linoysello.com` y **responde a**
  `soporte@linoysello.com`, para que una respuesta de una clienta no se pierda (D-03).
- Regla común a los cinco: **sin emojis** también en el correo (skill `identidad-visual`), es-MX, y
  ningún correo transaccional lleva datos de otros invitados. El aviso de RSVP (5) nombra a un solo
  invitado, el que acaba de responder, y su cuenta de lugares; nunca una lista.

---

## B6. Catálogo de variables de entorno de la fase 5

Sin valores en claro. Las direcciones y el número los fija `memoria/decisiones-dueno.md` D-03
(`hola@linoysello.com` contacto/ventas, `soporte@linoysello.com` ayuda,
`no-responder@linoysello.com` transaccional) y D-04 (WhatsApp **+52 951 470 9685**, solo
click-to-chat, sin API de Meta).

### Frontend (`frontend/apps/web/lib/env.ts` — **fichero nuevo**: hoy no existe)

Hoy cada variable se lee donde hace falta (`lib/contacto.ts:110`, `app/(public)/layout.tsx:32`,
`lib/enlace-publico.ts:62`). `lib/env.ts` centraliza la **lectura y la validación**, y cada módulo
sigue exponiendo su función de dominio; el patrón a imitar es el de `lib/contacto.ts`: funciones
puras sobre un mapa de entorno, probadas caso por caso sin tocar `process.env` global.

| nombre | dónde se lee | para qué | quién la necesita | obligatoria | si falta |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_CONTACTO_WHATSAPP` | `lib/env.ts` → `lib/contacto.ts` | número E.164 para `wa.me` de ventas | `/`, `/ayuda`, `/contacto`, `/precios` | opcional | no se pinta la tarjeta de WhatsApp; sale la frase honesta (`sitio.contactar.sinContacto`) |
| `NEXT_PUBLIC_CONTACTO_CORREO` | `lib/env.ts` → `lib/contacto.ts` | correo de ventas para `mailto:` | igual que la anterior | opcional | igual: sin tarjeta de correo, con frase honesta |
| `NEXT_PUBLIC_SOPORTE_CORREO` | `lib/env.ts` | correo de ayuda a clientas ya compradas | `/ayuda`, `/contacto`, `/pago` (estado de espera), `/perfil` | opcional | el bloque de soporte no se pinta y `/pago` remite al contacto de ventas |
| `NEXT_PUBLIC_SITE_URL` | ya se lee en `app/(public)/layout.tsx:32` y `lib/enlace-publico.ts:62`; la fase 5 la centraliza en `lib/env.ts` | origen público del sitio: metadatos y `og:image`, y **la base absoluta del enlace que la clienta reparte** cuando no hay `window` | `(public)/layout.tsx`, `lib/enlace-publico.ts`, y `/r/[token]` cuando E2 construya el enlace personal de cada invitada | **obligatoria en despliegue real** | ya hay dos compuertas de arranque que lo impiden: `motivoDeArranqueInvalido` (`lib/enlace-publico.ts:100-117`) cuando la API es remota y el origen no está declarado o es local, y `motivoDeOrigenDesalineado` (`:160`) cuando el artefacto se horneó para otro origen |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `lib/env.ts` | clave **pública** de Stripe para el cliente | `/precios`, `/pago` | obligatoria si hay pagos | `/precios` no ofrece pagar: enseña los planes y el bloque de contacto, y registra el motivo en consola. Nunca un botón «Pagar» que no puede pagar |
| `NEXT_PUBLIC_E2E_HOOKS` | ya se lee en `app/(chrome)/editor/[invitationId]/page.tsx:128` y `lib/manifest.ts:74`; la fija `playwright.config.ts:86` | expone ganchos de prueba (`window.__editorStore`, fixtures) | solo Playwright | opcional | nada: en producción no está definida y no se expone ningún gancho. **Nunca** se define en un despliegue real |

**Por qué el origen del sitio se reutiliza y no se renombra** (corrección del orquestador, 2026-09-09).
Un primer borrador de este catálogo traía una variable nueva, `NEXT_PUBLIC_SITIO_URL`, para lo que ya
hace `NEXT_PUBLIC_SITE_URL`. Se retira. La variable existente está en uso real y probado —35
referencias, entre ellas `app/(public)/layout.tsx:32`, `lib/enlace-publico.ts:62`,
`lib/enlace-publico.test.ts` y el `webServer` de `playwright.config.ts`— y **es la base del enlace que
la clienta manda a sus invitadas**, con el orden de resolución que fijó N-02 / `ADR-3C-N02-01`
(`window.location.origin` primero, la variable después, el `publicUrl` del servidor como último
recurso: `lib/enlace-publico.ts:19-30`). Tener **dos** variables para el mismo origen produciría
enlaces compartidos distintos según qué trozo de código los construyera, que es exactamente el
defecto que N-02 cerró tras medirlo (`bitacora/3b-adv.md §6.2`: enlaces al puerto del build mientras
la clienta navegaba en otro). Una sola fuente para el origen, y `/r/[token]` construye el enlace
personal de cada invitada sobre esa misma.

Frontend, entonces: **cuatro variables existentes que se reutilizan** (`NEXT_PUBLIC_CONTACTO_WHATSAPP`,
`NEXT_PUBLIC_CONTACTO_CORREO`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_E2E_HOOKS`) y **dos nuevas**
(`NEXT_PUBLIC_SOPORTE_CORREO`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`).

Variables vecinas que la fase 5 **no toca** y que conviene no confundir con las de arriba:
`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_EDITOR_ORIGIN`, `NEXT_PUBLIC_CDN_ORIGIN`,
`NEXT_PUBLIC_BUILD_ID`, `EDITOR_ORIGIN`, `PERMITIR_ORIGEN_LOCAL`, `PERMITIR_ORIGEN_DESALINEADO`.

### Backend (`src/main/resources/application.yml`)

| nombre | dónde se lee | para qué | quién la necesita | obligatoria | si falta |
|---|---|---|---|---|---|
| `FRONTEND_URL` | `application.yml:80` → `app.frontend.url` | **se reutiliza, no se inventa otra**: base absoluta de los enlaces de todos los correos y de las URLs de retorno de Stripe Checkout (`success_url`, `cancel_url`) | `core/email` y sus consumidores, `EditorDocumentService.kt:804`, el servicio de Checkout | **obligatoria en despliegue real** | hoy cae a `http://localhost` y los enlaces salen inservibles (es U-6, ya medida). La fase 5 la hace obligatoria: sin ella el arranque falla, por la misma razón que `templates2.assets.bucket` no tiene valor por defecto |
| `STRIPE_SECRET_KEY` | `application.yml` (`stripe.secret-key`) | llamar a la API de Stripe (crear sesiones de Checkout, leer pagos) | módulo de pagos | **obligatoria si se aceptan pagos** | **el arranque falla ruidosamente**, ver la regla al final |
| `STRIPE_WEBHOOK_SECRET` | `application.yml` (`stripe.webhook-secret`) | verificar la firma del webhook antes de creer nada de lo que llega | módulo de pagos | **obligatoria si se aceptan pagos** | **el arranque falla ruidosamente** |
| `STRIPE_MONEDA` | `application.yml` (`stripe.moneda`) | moneda de los importes (`mxn`), en un solo sitio y no repartida por el código | módulo de pagos, correo (4) | opcional con valor por defecto `mxn` | se usa `mxn`, que es la moneda del producto (D-02: dominio y mercado en México) |
| `MAIL_FROM` | `application.yml` (`mail.from`) | remitente de todo el transaccional (`no-responder@…`, D-03) | `core/email`, las dos estrategias | obligatoria si se manda correo | el arranque falla si el correo está activo: hoy el remitente cae a la cuenta de Gmail del sistema anterior (`application.yml:56`), y mandar correo de Lino & Sello desde otra marca es peor que no mandarlo |
| `MAIL_FROM_NOMBRE` | `application.yml` (`mail.from-nombre`) | nombre visible del remitente («Lino & Sello») | `core/email` | opcional | se usa la parte local de `MAIL_FROM`; el correo sale sin nombre bonito pero llega |
| `MAIL_RESPONDER_A` | `application.yml` (`mail.responder-a`) | `Reply-To` hacia `soporte@…`, para que responder a un transaccional no caiga en el vacío | `core/email` | opcional | no se pone `Reply-To`; responder al correo llega a `no-responder@`, que es exactamente el problema que esta variable evita |
| `CONTACTO_CORREO` | `application.yml` (`contacto.correo`) | dirección de ventas que el backend cita en correos y en respuestas de error de pago | módulo de pagos, `core/email` | opcional | el correo omite la línea de contacto en vez de inventar una dirección |
| `CONTACTO_WHATSAPP` | `application.yml` (`contacto.whatsapp`) | número de ventas que el backend cita en correos | `core/email` | opcional | igual: se omite la línea |
| `SOPORTE_CORREO` | `application.yml` (`soporte.correo`) | dirección de ayuda que el backend cita en avisos a clientas | `core/email`, módulo de pagos | opcional | se omite la línea, nunca se sustituye por otra dirección |

**La regla, y por qué es asimétrica.** Si falta una variable **opcional**, la interfaz es **honesta**:
no pinta el camino que no puede recorrer, y lo dice — es exactamente lo que ya hace `lib/contacto.ts`
(«el contacto se publicará aquí en cuanto esté configurado», `lib/i18n.ts:200`), y el motivo está
escrito en su cabecera: un botón que no lleva a nadie es peor que su ausencia. Si falta una variable
**obligatoria de pagos** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`), **el arranque falla y
explica qué poner**, con el mismo patrón que ya usa `templates2.assets.bucket`
(`application.yml:100-107`: sin valor por defecto a propósito, «sin esta propiedad la aplicación NO
arranca y explica qué poner»). La asimetría no es capricho: un canal de contacto ausente degrada la
experiencia de una persona que puede escribir por otro medio; un `STRIPE_WEBHOOK_SECRET` ausente
significa **aceptar webhooks sin verificar la firma**, es decir, permitir que cualquiera declare
pagada cualquier invitación. Un sistema que cobra a medias es peor que uno que no cobra: cobra sin
entregar, o entrega sin cobrar, y en los dos casos alguien pierde dinero en silencio. Fallar al
arrancar es la única forma de que ese fallo se vea antes de que haya una clienta detrás.

Total documentado en esta fase: **16 variables** (6 de frontend, 10 de backend, de las cuales
`FRONTEND_URL` se reutiliza y las otras nueve son nuevas).

---

## B7. Presupuesto de peso y accesibilidad de lo nuevo

### Cómo se mide hoy

`apps/web/scripts/check-budget.mjs` pesa el **JS de primera carga por ruta** (comunes + los chunks
propios de la ruta, sin los polyfills `nomodule`, que tienen techo aparte de 64 KB) sobre el `.next`
que acaba de construir Playwright, y **rompe con código 1** si excede. Los límites vigentes están en
la constante `LIMITES_BASE` (`scripts/check-budget.mjs:47-56`): `/i/[publicToken]` **150 KB gz**, `/`
**150 KB gz**, `/editor/[invitationId]` **600 KB gz**. La compuerta corre además como prueba, con
una prueba negativa que verifica que de verdad falla (`e2e/presupuesto.spec.ts:32-44`), y una tercera
que verifica que mide el JS **propio** de cada ruta y no solo el runtime común (`:46-59`). Cifras
medidas al cierre de la fase 3-C: `/i/[publicToken]` 142,0 KB, `/` 148,2 KB (margen de 1,8 KB), editor
419 KB (`handoffs/3c-para-siguiente.md §4`). Subir un límite exige ADR (`contratos.md §8`).

### Qué hereda cada ruta nueva

| ruta | límite propuesto | por qué |
|---|---|---|
| `/r/[token]` | **150 KB gz** | es ruta **pública y móvil**, se abre desde un enlace de WhatsApp con datos móviles: mismo trato que `/i/[publicToken]`, sin excepción. Es el mismo render más una tarjeta y un formulario pequeño; si no cabe, lo que sobra es el chrome que se coló, no el presupuesto |
| `/precios` | 150 KB gz | pública y de primera impresión, exactamente el argumento con el que la portada entró en la compuerta (`check-budget.mjs:50-53`) |
| `/contacto` | 150 KB gz | pública, y es poco más que dos tarjetas: debería sobrar mucho margen |
| `/legal` | 150 KB gz | pública y de puro texto |
| `/pago` | 150 KB gz | la abre una clienta que viene de fuera del dominio, a veces en móvil, y es la pantalla en la que menos se puede permitir un tiempo de espera largo |
| `/perfil` | 300 KB gz | chrome autenticado, formularios del sistema, sin lienzo, sin `zustand`, sin `dnd-kit` |
| `/editor/[invitationId]/invitados` | 300 KB gz | chrome autenticado con tabla, búsqueda e importación; **no** carga el lienzo ni el store del editor |
| `/editor/[invitationId]/plan` | 300 KB gz | chrome autenticado, dos tarjetas y una tabla |
| `/admin` | 300 KB gz | chrome autenticado con tablas y filtros |

El 300 KB no es una medición, es un techo deliberado: la mitad del que tiene el editor, que es la
ruta más pesada del producto por razones conocidas y aceptadas. Si una de estas cuatro rutas se
acerca a él, la respuesta es partir la pantalla o cargar bajo demanda, **nunca** subir el número: la
compuerta existe precisamente porque «un presupuesto que solo avisa se ignora»
(`check-budget.mjs:2-3`). La primera medición real de cada ruta va a la bitácora de su sesión.

### Qué exige axe (y qué no basta)

- Toda ruta nueva entra en una compuerta de accesibilidad con el criterio **estricto** de
  `e2e/a11y-producto.spec.ts`: `violations` **vacío de cualquier impacto** (no solo grave/crítico), e
  `incomplete` **no se ignora** — la única entrada tolerada siempre es `color-contrast`, porque axe la
  devuelve en cuanto hay un degradado y no significa nada (`a11y-producto.spec.ts:1-27`). Con un
  `Dialog` modal abierto se tolera además `aria-hidden-focus`, y solo ahí, por el `FocusScope` de
  Radix; aplica al `Sheet` de compartir y al de importación de `/invitados`, y al diálogo de
  confirmación de `/perfil`.
- **`axe` no vale como compuerta de contraste.** El contraste se mide sobre la **pila renderizada**
  con `medirContraste` (`e2e/util/contraste.ts`), umbral por tamaño computado (4,5 normal / 3,0 texto
  grande). Se exige en las pantallas nuevas con fondo compuesto o foto: `/r/[token]` (tarjeta opaca
  sobre la portada), `/precios` (tarjetas sobre `Rays`) y `/perfil` (formulario denso). Las demás las
  cubre la galería `/design`, que usa los mismos componentes y los mismos tokens.
- Objetivo de toque **>= 24 px** y foco no obstruido (`e2e/design-objetivos.spec.ts`). En
  `/r/[token]` se sube el listón a **44 px** para los controles de respuesta y los `+`/`-` de pases:
  es una pantalla de pulgar, y 24 px es un mínimo legal, no un objetivo de diseño.
- Movimiento sobrio y apagado con `prefers-reduced-motion`: afecta al `ProgressRing` de `/pago` y a
  cualquier `breathe` de las formas de fondo de `/precios` y `/contacto`.
- **`noindex`** en `/r/[token]`, exactamente igual que en `/i/[publicToken]`: lleva el nombre de una
  persona y sus lugares apartados. Se pone en las **tres** capas que ya existen para la ruta pública
  (metadatos de la página, metadatos del layout del grupo para que lo hereden `not-found`/`error`, y
  la cabecera `X-Robots-Tag` de `next.config.ts`), por el motivo escrito en
  `app/(public)/layout.tsx:16-21`: el `generateMetadata` de la página solo corre cuando la página se
  renderiza. Además, `/r/[token]` es **dinámica y sin caché compartida**: su contenido es personal.
  `/perfil` y `/admin` también van con `noindex`; `/precios`, `/contacto` y `/legal` sí se indexan.
- Ficheros de prueba **uno por sesión**, para que no choquen: `e2e/a11y-invitados-rsvp.spec.ts` (E2),
  `e2e/a11y-cuenta-legal.spec.ts` (E3), `e2e/a11y-pagos.spec.ts` (E4), `e2e/a11y-admin.spec.ts` (E5).
  Ninguna sesión edita `a11y-producto.spec.ts`, que es la compuerta de las pantallas ya cerradas.
- LCP: `/r/[token]` hereda el objetivo de `/i/[publicToken]`, **< 2,5 s en móvil**, medido igual (3
  corridas, mediana). La referencia de la fase 3-C es 1 998 ms para `/i`
  (`handoffs/3c-para-siguiente.md §4`); `/r` añade una tarjeta y un formulario sobre el mismo render,
  así que un LCP peor que ese señala que se coló algo que no debía.

---

## B8. Preguntas abiertas

Formato de `memoria/preguntas-abiertas.md`. **Van escritas aquí, no en ese fichero**: las añade el
orquestador.

- [Fase 5 · 5-0b-B] **P-5-0B-1.** El catálogo cerrado de la fase nombra `NEXT_PUBLIC_SITIO_URL`, pero
  el código ya usa `NEXT_PUBLIC_SITE_URL` en 35 lugares, incluidas dos compuertas que impiden
  arrancar un despliegue mal configurado (`lib/enlace-publico.ts:100`, `:160`) y sus pruebas.
  **Supuesto tomado:** `lib/env.ts` acepta las dos y prefiere `NEXT_PUBLIC_SITIO_URL`; el resto del
  código pasa a pedirle el valor a `lib/env.ts`. Así manda el nombre nuevo sin romper ningún
  despliegue ni ninguna compuerta existente. Renombrar en seco y de golpe es la alternativa que se
  descartó por riesgo, no por gusto.
- [Fase 5 · 5-0b-B] **P-5-0B-2.** ¿El pago es único por invitación o suscripción? El prompt maestro
  recomienda pago único y `InvitationEntity` solo tiene `is_paid`/`total_amount`
  (`InvitationEntity.kt:47-51`), sin fecha de vigencia. **Supuesto tomado:** pago único por
  invitación, sin caducidad. Es lo que el modelo ya soporta sin migración y lo que hace que la
  matriz de ADR-5-0B-01 no necesite un estado «vencida».
- [Fase 5 · 5-0b-B] **P-5-0B-3.** Si el dueño quisiera suscripción, ¿con cuánta antelación se avisa
  del vencimiento y qué pasa con una invitación publicada que vence **el día del evento**?
  **Supuesto tomado:** no se implementa vencimiento en esta fase; si se implementara, dos avisos (7
  días y 1 día) y **nunca** despublicar dentro de las 72 h previas a la fecha del evento, porque
  dejar sin invitación a los invitados el día de la boda es un daño desproporcionado frente al
  importe en juego.
- [Fase 5 · 5-0b-B] **P-5-0B-4.** Los tokens de invitado tienen 128 bytes en base64url
  (`JwtUtil.kt:59-64`): 171 caracteres. Un enlace `https://linoysello.com/r/<171 caracteres>` es
  larguísimo para pegarlo en WhatsApp y se ve mal en la vista previa del mensaje. **Supuesto
  tomado:** no se toca la generación en esta fase (cambiarla afecta a los tokens ya emitidos y es
  territorio de 5-0b-A); se registra que 32 bytes (43 caracteres) siguen siendo 256 bits, sobra para
  cualquier umbral, y darían un enlace legible. Decidirlo es de 5-0b-A con ADR.
- [Fase 5 · 5-0b-B] **P-5-0B-5.** `GET /public/invitation/guest-info/{token}`
  (`PublicGuestInfoController.kt:58`) devuelve hoy dos cosas que `/r/[token]` no debería recibir: el
  `cancellationToken` del invitado (un segundo secreto, que si viaja al navegador se puede filtrar
  por captura de pantalla o por historial) y `invitationDetail`, la invitación **entera** del módulo
  antiguo (`:77` y `:100`). **Supuesto tomado:** `/r/[token]` se diseña contra una respuesta
  recortada —nombre, pases, estado, reglas del evento y nada más— y la invitación se pinta desde el
  render nuevo, no desde ese campo. El endurecimiento del endpoint es de 5-0b-A.
- [Fase 5 · 5-0b-B] **P-5-0B-6.** No hay ninguna ruta de invitados para el rol USER: todas cuelgan de
  `/admin/invitations/**` (`AdminGuestsController.kt:34`). **Supuesto tomado:** hace falta el
  equivalente de cliente, y `/editor/[invitationId]/invitados` se diseña contra él; qué forma tiene y
  si se endurece el existente o se crea uno nuevo lo decide 5-0b-A.
- [Fase 5 · 5-0b-B] **P-5-0B-7.** `invitation_plan` solo tiene `name` e `is_premium`
  (`InvitationPlanEntity.kt:13-24`): **no hay precio, ni moneda, ni límite de invitados, ni
  identificador de precio de Stripe**. `/precios` y `/editor/[invitationId]/plan` no se pueden pintar
  con lo que hay. **Supuesto tomado:** los wireframes se dibujan con los campos que el producto
  necesita (nombre, precio, moneda, qué incluye, tope de invitados, recomendado sí/no) y el catálogo
  real lo define 5-0b-A; mientras no exista, las dos pantallas caen a su estado vacío honesto, que es
  el bloque de contacto que ya funciona hoy.
- [Fase 5 · 5-0b-B] **P-5-0B-8.** ¿Cuántos planes hay y cómo se llaman? En los wireframes aparecen
  tres («Sencillo», «Fiesta», «Grande») y los precios van como `$ ___ MXN`. **Supuesto tomado:** son
  nombres de relleno para dibujar, no una propuesta comercial; los fija el dueño. Un precio inventado
  en una pantalla es exactamente el error que `Planes.tsx:3-8` se negó a cometer.
- [Fase 5 · 5-0b-B] **P-5-0B-9.** El registro no verifica el correo y no existe columna para ello en
  el backend. **Supuesto tomado:** si la verificación no cabe en la fase, el producto funciona sin
  ella y `/perfil` enseña el estado «sin verificar» con reenvío, sin bloquear nada. Bloquear detrás
  de una verificación que no se puede probar de punta a punta dejaría a la clienta fuera de su propia
  cuenta.
- [Fase 5 · 5-0b-B] **P-5-0B-10.** ¿Marca de agua en la invitación sin pagar, en vez de puerta de
  publicación? **Supuesto tomado:** no. No hay logotipo todavía (D-02) y convierte un criterio
  binario en una negociación estética. Queda registrada por si el dueño la prefiere.
- [Fase 5 · 5-0b-B] **P-5-0B-11.** `/legal` como una sola página con dos secciones, o `/legal/privacidad`
  y `/legal/terminos` por separado. **Supuesto tomado:** una sola página con dos secciones
  enlazables por ancla: es menos superficie, un solo presupuesto y un solo `noindex` que decidir, y
  partirla después no rompe ningún enlace si las anclas se conservan.
- [Fase 5 · 5-0b-B] **P-5-0B-12.** ¿La clienta puede borrar su cuenta sola? El wireframe de `/perfil`
  dibuja «Pedir que borren mi cuenta», no un borrado inmediato. **Supuesto tomado:** solicitud, no
  borrado automático: hay invitaciones publicadas e invitados con enlaces vivos detrás, y un borrado
  en caliente los tumbaría sin avisar a nadie. El borrado real lo ejecuta un administrador.
- [Fase 5 · 5-0b-B] **P-5-0B-13.** `lib/i18n.ts` es un solo objeto de 672 líneas y las cuatro sesiones
  necesitan añadirle texto. **Supuesto tomado:** se parte en `lib/i18n/` con un fichero por área y un
  barril que conserva el export `es_MX`, y la partición la hace la primera sesión en aterrizar, en un
  commit propio sin texto nuevo. Si el orquestador prefiere no moverlo, la alternativa es que cada
  sesión escriba su propio módulo y que él resuelva los conflictos a mano en cada merge.
