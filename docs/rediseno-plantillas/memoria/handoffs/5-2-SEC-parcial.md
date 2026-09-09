# 5-2-SEC parcial · revisión adversarial de invitados y RSVP (agente E2-SEC2)

Rama `claude/fase-5-invitados`. **Ningún comando de git que escriba o mueva el árbol.** Territorio:
`modules/product/guests/**` y, con cambio mínimo, `modules/shared/guests/**`.

Esta bitácora se escribió **con los doce ataques ya dictaminados y antes de aplicar los arreglos**,
que es justo lo que se perdió en el intento anterior, y se completó al terminar. Toda evidencia es **medida** contra
el backend vivo en `http://127.0.0.1:6003` (siembra `scripts/seed/invitados.sh`, más `tpl_document` +
`tpl_release` insertados a mano sobre la invitación 5 porque la siembra no publica).

## Tabla de dictámenes

| # | Ataque | Dictamen | Dónde | Evidencia medida |
|---|---|---|---|---|
| 1 | Enumeración de tokens (cuerpo, código, cabeceras, **tiempo**) | **No explotable** | `PublicRsvpService.kt:71-76`, `RsvpGuestReader.kt:83-108` | Cuerpo, código y cabeceras idénticos byte a byte en los cuatro motivos probados. Tiempo **sí** difiere: `GET` válido mediana 7,97 ms vs inexistente 6,60 ms (n=30, distribuciones solapadas: mín. válido 4,65 < mediana inexistente); mal formado 4,79 ms (se salta la consulta). `PUT` válido 26,7 ms vs inexistente 10,6 ms (n=15), diferencia clara. Con 128 bits (§S-12) no hay candidato que clasificar: **no se arregla**, ver «Lo que no se arregla». |
| 2 | Cambiar la respuesta de otro invitado | **No explotable** | `PublicRsvpController.kt:57-74`, `RsvpUpdateRequest` | No hay ningún id, parámetro ni cabecera en la superficie pública: el token de la ruta **es** el selector. En el panel, un `guestId` ajeno da `404 GUEST_NOT_FOUND` (ver #6). |
| 3 | Fuga de datos personales en el JSON real | **No explotable** | `RsvpPublicDtos.kt`, salida real de las dos rutas | `GET` devuelve exactamente `fullName`, cupos, confirmados, `status`, `hasEmail`, `publicToken`, permisos y `closed`. Ni correo, ni teléfono, ni mesa, ni ids, ni tokens, ni nada de otro invitado. Errores tipados con texto fijo (`GUEST_INVALID`, `GUEST_QUOTA_EXCEEDED`, `RSVP_LINK_NOT_FOUND`). *Matiz*: `POST /public/r/{token}` da `405` con el cuerpo de la plataforma (`about:blank` + `instance` con el token en la URI); no revela nada que el emisor no tuviera ya y no lo puede capturar un `@RestControllerAdvice` (no hay controlador resuelto). |
| 4 | El `429` como denegación de servicio | **EXPLOTABLE** | `RsvpThrottleService.kt:59`, `:103-107` | Medido: cuatro peticiones más sobre un token ya usado → `429` sostenido durante 15 min. Cualquiera que vea una captura del enlace deja a la invitada fuera de su propio RSVP con 40 peticiones. **Se arregla** (ver abajo). |
| 5 | El puente SQL mapeado por posición | **No concluyente como ataque, riesgo real** | `RsvpGuestReader.kt:114-135` | No es alcanzable por un atacante, pero catorce columnas se mapean por índice sin ninguna prueba contra base real: un `SELECT` reordenado cruzaría columnas en silencio (p. ej. `hasEmail` con `childrenAllowed`). **Se arregla**: mapeo por nombre + prueba de integración contra el Postgres efímero. |
| 6 | IDOR del panel (S-04, S-05) | **No explotable — cerrados** | `InvitationGuestsService.kt:200-208`, `:162-168` | Clienta A pidiendo el `guestId` de la invitación de B: `404 GUEST_NOT_FOUND` en `link`, `PUT` y `DELETE`, con el **mismo** cuerpo que un id inexistente; invitación ajena e inexistente dan el mismo `404 INVITATION_NOT_FOUND`. Sin oráculo. |
| 7 | Reactivación de invitados sin filtrar por invitación | **EXPLOTABLE** | `InvitationGuestsService.kt:67-89` | Medido con rol MASTER: alta en la invitación **7** → se sobrescribió el invitado **12 de la invitación 6** (otra clienta): nombre, cupos, `is_enabled` de `false` a `true`, estado a `PENDING` y **`confirmation_token` rotado** (`k7_Blqkc…` → `k7Fs3wjW…`), destruyendo su enlace personal. La invitación de destino quedó con **0 filas** y la ruta devolvió `500`. Con rol USER hoy **no** ocurre, pero **no por diseño**: `HibernateFilterAspect.kt:26-36` activa `enabledFilter` para USER y para anónimo y lo **desactiva para ADMIN/MASTER**, así que la consulta sale como `where is_enabled = true and … and not(is_enabled)` (extraída del log de Hibernate), contradictoria y por eso vacía. Es un accidente, no una defensa. **Se arregla.** |
| 8 | La ruta del enlace personal | **No explotable** | `GuestPanelService.kt:258-275`, `GuestShareLinkBuilder.kt` | Defendida por propiedad (ver #6). `shareText` lleva solo el **primer nombre** del propio invitado y la URL; `whatsappUrl` solo aparece con teléfono propio. Ningún dato de terceros, ninguna fecha, ningún nombre de anfitrión. |
| 9 | Inyección de fórmulas en el CSV | **EXPLOTABLE** | `GuestCsvWriter.kt:51-55` | Medido dos veces: un invitado llamado `=cmd\|'/c calc'!A1` sale **crudo** en el CSV; y —peor— un **invitado anónimo** metió `=HYPERLINK("http://evil.example/x","Felicidades")` por el `message` del `PUT /public/r/{token}` y aparece en la columna «Mensaje» del CSV que descarga la clienta. Es una escalada de anónimo a ejecución en la máquina de la clienta al abrir Excel. **Se arregla.** |
| 10 | El analizador del pegado | **EXPLOTABLE (agotamiento de recursos)** | `GuestPasteReader.kt:30-64`, `GuestPanelService.kt:353-362` | No hay tope de renglones. Medido: `:preview` con **200 000** renglones (3,9 MB) responde `200` con **12,9 MB** de JSON; `:import` de **1 500** renglones ocupa **26,6 s** de un hilo de petición, porque `recienGuardado` relee **todos** los invitados de la invitación en cada renglón (coste cuadrático). Un cuerpo JSON de 40 MB se acepta y se analiza. **Se arregla** con tope de renglones y de longitud. |
| 11 | `FAIL_ON_UNKNOWN_PROPERTIES` en toda la aplicación | **Confirmado, fuera de territorio** | `Templates2JsonConfig.kt:35-36` (comentario contradicho en `:16-19`) | Medido: `POST /auth/token` con `{"campoDeMas":1}` → `400` con `Unrecognized field "campoDeMas" (class …auth.presentation.model.request.AuthRequest)` y **la lista de propiedades conocidas** dentro del cuerpo. **No se toca** (dueño de `templates2`). Redactado para `preguntas-abiertas.md` en el reporte. Ninguna ruta nueva de E2 depende de ese comportamiento: `RsvpUpdateRequest` lleva `@JsonIgnoreProperties(ignoreUnknown = true)` y se comprobó que `{"attending":false,"loQueSea":1}` responde `200`. |
| 12 | Datos personales en los logs | **EXPLOTABLE, casi todo fuera de territorio** | `application.yml:132`; `EmailGuestNotifier.kt:187` | Medido: con `logging.level.org.hibernate: debug`, `EntityPrinter` vuelca la entidad entera del invitado en cada flush — **`cancellationToken` y `confirmationToken` completos, correo, nombre y teléfono** (31 líneas con tokens de invitado y 395 con correos en una sesión de 10 minutos). El arreglo es una línea en `application.yml`, **prohibido**: queda para el orquestador. En territorio sí hay uno: `EmailGuestNotifier.notifySingle` imprime el correo del invitado con `println`. **Se arregla ese.** |

## Lo que se arregló, y qué prueba lo vigila

Cada arreglo se comprobó **dos veces**: la prueba cae si se deshace el arreglo (verificado revirtiendo
los cuatro cambios a la vez: 7 pruebas en rojo) y el ataque se repitió contra el backend vivo ya con
el código nuevo.

| # | Arreglo | Fichero | Prueba que lo vigila | Re-verificado en vivo |
|---|---|---|---|---|
| 7 | Reactivar solo dentro de **la misma invitación** y solo con clave de contacto real | `InvitationGuestsService.kt:67-70`, `:reactivable` | `EndurecimientoDeInvitadosTest` — «un alta no reactiva un invitado dado de baja de otra invitación», «sin correo ni teléfono no se reactiva nada», «una baja de la misma invitación con correo sí se reactiva» | Sí: MASTER dando de alta en la invitación 4 ya **no** toca la baja de la 3, ni con clave vacía ni con correo y teléfono coincidentes; y el alta se crea donde se pidió (`201`, antes `500`) |
| 9 | Neutralizar `=`, `+`, `-`, `@` y tabulador al principio de celda | `GuestCsvWriter.kt:59-76` | `GuestCsvWriterTest` (4 pruebas, incluida la del `message` que escribe el invitado anónimo) | Sí: `'=cmd\|'/c calc'!A1` y `"'=HYPERLINK(…)"` salen ya neutralizados en las dos columnas |
| 4 | El cubo del token pasa a ser por **(token, IP)** | `RsvpThrottleService.kt:55-77`, `:170-177` | `RsvpThrottleServiceTest` — «agotar un enlace desde una IP no bloquea a su dueña, que llega desde otra» y «el mismo origen sigue limitado» | Sí: 45 peticiones desde `127.0.0.2` acaban en `429` para **ese** origen y la dueña, desde `127.0.0.1`, sigue recibiendo `200` en el mismo enlace |
| 10 | Tope de 500 renglones y 200 000 caracteres, con un problema que lo explica | `GuestPasteReader.kt:30-64`, `:MAX_RENGLONES` | `GuestPasteReaderTest` (3 pruebas, incluida «una lista real cabe de sobra») | Sí: el pegado de 200 000 renglones pasó de `12,9 MB` en 1 s a `31 KB` en 0,11 s |
| 5 | Mapeo **por nombre** de columna, con alias explícitos | `RsvpGuestReader.kt:83-147` | `RsvpPuenteRealTest` (**nueva, contra el Postgres efímero**): siembra el grafo entero, ejecuta el SQL literal, mapea con la función real y comprueba catorce valores distintos entre sí, los catorce alias del `ResultSet` y el caso sin release | La ruta pública sigue devolviendo el cuerpo del contrato |
| 12 | Fuera el correo del invitado de la salida estándar; `println` → `log.warn` sin datos | `EmailGuestNotifier.kt:29`, `:190-195`, `:246`, `:315` | — (ver «Lo que no se arregla») | Sí: ningún rastro con dirección en el log tras ejercitar el envío |

**`RsvpPuenteRealTest` siembra dentro de una transacción que siempre termina en `rollback`**: el
clúster efímero es compartido con las pruebas de persistencia de `templates2`, y dejar ahí un
`event_type` vacío les rompía siete pruebas (comprobado y corregido).

## `POST …/guests/{guestId}:send-email`, construida

Ya no responde `501`. `202` cuando se acepta; el correo sale en segundo plano, como el resto de los
avisos del backend. Cuatro puertas antes de tocar el correo, en este orden: propiedad de la
invitación · pertenencia del invitado a esa invitación (`getGuest`, que es donde vive S-04: sin él
`:send-email` sería el IDOR con acuse de recibo) · que el invitado tenga correo y la invitación
tenga release activo, si no `409 RSVP_CLOSED` con el motivo · tope por invitación y día.

- `panel/GuestLinkMailer.kt` — interfaz + emisor sobre `core/email` (`sendCustomEmail`), texto es-MX
  cálido, **sin emojis**, marca «Lino & Sello», y **sin el nombre ni el correo de ningún otro
  invitado**. El enlace lo arma `GuestShareLinkBuilder` con `app.frontend.url`: es el mismo
  `<frontendUrl>/r/<confirmationToken>` del arreglo de S-08 y **no hay ningún dominio en el código**.
- `panel/GuestEmailGuard.kt` — `GuestReleaseReader` (consulta nativa de solo lectura sobre
  `tpl_release`) y `GuestEmailDailyLimit` (50 por invitación y día, defecto en código).
- Pruebas: `GuestSendEmailTest` (9 pruebas, con doble del emisor) y dos en `GuestPanelControllerTest`.
- Verificado en vivo: sin release `409 RSVP_CLOSED`; con release `202`; invitado de otra invitación
  `404 GUEST_NOT_FOUND`.

**Variable de entorno que hace falta en producción** (solo el nombre): `MAIL_FROM`, que ya existe
declarada (`producto.correo.remitente`) y hoy nace vacía = función desactivada. El **transporte** es
aparte y sigue siendo el hallazgo S-01: `MailConfig.kt:23-30` declara el `JavaMailSender` con la
cuenta escrita en el código, así que ni siquiera `SPRING_MAIL_PASSWORD` se respeta hasta que ese
hallazgo se arregle. Por eso **no se inventa ningún envío falso**: la ruta funciona contra la
interfaz y las pruebas la ejercitan con un doble.

## Tres desviaciones del contrato, declaradas

1. **§2, límite de intentos**: la dimensión «por token» pasa a ser «por token y origen». Motivo
   medido arriba (ataque 4). El límite por IP no cambia.
2. **§0.6, catálogo de códigos**: `RSVP_CLOSED` (409) lo produce ahora también el panel, que es lo
   que el propio §1 pide para `:send-email`.
3. `GUEST_EMAIL_UNAVAILABLE` (501) queda declarado pero **ya no lo produce ninguna ruta**.

## Entrada redactada para `preguntas-abiertas.md`

> **P-5-E2-01 · `FAIL_ON_UNKNOWN_PROPERTIES` está activo en toda la aplicación y nadie lo decidió.**
> `Templates2JsonConfig.kt:35-36` declara un bean `ObjectMapper` —el estricto de `templates2`
> (`Templates2Json.kt:29`)— y eso desactiva por `@ConditionalOnMissingBean` el que Spring Boot habría
> creado, de modo que el convertidor HTTP de **todas** las rutas acaba siendo el estricto. El
> comentario de `Templates2JsonConfig.kt:16-19` afirma por escrito que eso no pasa porque el bean no
> está marcado `@Primary`; **no basta**.
> *Evidencia medida* (backend vivo, 2026-09-09): `POST /auth/token` con `{"email":"x@y.z",
> "password":"x","campoDeMas":1}` responde `400` con `"Unrecognized field \"campoDeMas\" (class
> mx.evolutiondev.invitaciones.modules.auth.presentation.model.request.AuthRequest), not marked as
> ignorable (2 known properties: \"password\", \"email\")"` **dentro del cuerpo**: nombre de clase,
> nombre de campo y lista de propiedades conocidas. Es un amplificador del hallazgo S-02 en el módulo
> antiguo, en una ruta **sin autenticar**.
> *Quién decide*: el dueño de `templates2`. Las opciones son marcar el mapper del módulo como
> `@Qualifier` y no como bean único, o declarar uno de aplicación tolerante. **E2 no lo tocó**:
> `modules/templates2` está fuera de su territorio y el cambio afecta a todo el producto.
> *Comprobado*: **ninguna ruta nueva de E2 depende de ese comportamiento**. `RsvpUpdateRequest` lleva
> `@JsonIgnoreProperties(ignoreUnknown = true)` y `PUT /public/r/{token}` con un campo de más responde
> `200`, que es lo que exige el contrato §2.

> **P-5-E2-02 · Los logs llevan los dos tokens de cada invitado, su correo, su nombre y su teléfono.**
> `application.yml:132` fija `logging.level.org.hibernate: debug`, y `EntityPrinter` vuelca la entidad
> completa en cada flush. *Evidencia medida*: en diez minutos de uso normal, 31 líneas con
> `confirmation_token` o `cancellation_token` completos y 395 con direcciones de correo; una línea de
> ejemplo trae `cancellationToken=LgJLvwZLi5fw0SVb…` de 171 caracteres. Cualquiera con acceso al log
> —o cualquier servicio al que se envíen los logs— puede responder el RSVP de cualquier invitado.
> *Arreglo*: una línea en `application.yml`, fichero **prohibido** para E2. Decide el orquestador.

## Lo que NO se arregla, y por qué

- **#1 (canal temporal)**: existe y está medido, pero clasificar un token exige tener un candidato, y con
  128 bits de `SecureRandom` no lo hay. Igualar el tiempo obligaría a escribir y mandar correo también
  para tokens inexistentes —es decir, a construir un amplificador de correo— o a introducir un retardo
  fijo que empeora la ruta para todas las invitadas reales. Cuesta más de lo que vale.
- **#11** y la parte de **#12** que vive en `application.yml`: fuera de territorio por encargo.
- El coste cuadrático de `:import` (`recienGuardado`) se **acota** con el tope de renglones, no se
  rediseña: cambiar cómo se lee de vuelta el invitado recién creado toca la firma del motor compartido.

## Cómo verificar

```bash
cd /home/user/RSVP-Lino-y-Sello
./gradlew compileKotlin compileTestKotlin
./gradlew test     # 1407 pruebas, 0 fallos (la referencia de hoy eran 1383; +24 de esta revisión)
```

Nunca `./gradlew clean`. Para el backend vivo: `scripts/dev-backend.sh stop && scripts/dev-backend.sh start`.
