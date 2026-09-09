# 5-2-SEC parcial · revisión adversarial de invitados y RSVP (agente E2-SEC2)

Rama `claude/fase-5-invitados`. **Ningún comando de git que escriba o mueva el árbol.** Territorio:
`modules/product/guests/**` y, con cambio mínimo, `modules/shared/guests/**`.

Esta bitácora se escribe **con los doce ataques ya dictaminados y antes de aplicar los arreglos
grandes**, que es justo lo que se perdió en el intento anterior. Toda evidencia es **medida** contra
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
| 7 | Reactivación de invitados sin filtrar por invitación | **EXPLOTABLE** | `InvitationGuestsService.kt:67-89` | Medido con rol MASTER: alta en la invitación **7** → se sobrescribió el invitado **12 de la invitación 6** (otra clienta): nombre, cupos, `is_enabled` de `false` a `true`, estado a `PENDING` y **`confirmation_token` rotado** (`k7_Blqkc…` → `k7Fs3wjW…`), destruyendo su enlace personal. La invitación de destino quedó con **0 filas** y la ruta devolvió `500`. Con rol USER hoy **no** ocurre, pero **no por diseño**: `HibernateFilterAspect.kt:26-36` activa `enabledFilter` para USER y para anónimo y lo **desactiva para ADMIN/MASTER`, así que la consulta sale como `where is_enabled = true and … and not(is_enabled)` (extraída del log de Hibernate), contradictoria y por eso vacía. Es un accidente, no una defensa. **Se arregla.** |
| 8 | La ruta del enlace personal | **No explotable** | `GuestPanelService.kt:258-275`, `GuestShareLinkBuilder.kt` | Defendida por propiedad (ver #6). `shareText` lleva solo el **primer nombre** del propio invitado y la URL; `whatsappUrl` solo aparece con teléfono propio. Ningún dato de terceros, ninguna fecha, ningún nombre de anfitrión. |
| 9 | Inyección de fórmulas en el CSV | **EXPLOTABLE** | `GuestCsvWriter.kt:51-55` | Medido dos veces: un invitado llamado `=cmd\|'/c calc'!A1` sale **crudo** en el CSV; y —peor— un **invitado anónimo** metió `=HYPERLINK("http://evil.example/x","Felicidades")` por el `message` del `PUT /public/r/{token}` y aparece en la columna «Mensaje» del CSV que descarga la clienta. Es una escalada de anónimo a ejecución en la máquina de la clienta al abrir Excel. **Se arregla.** |
| 10 | El analizador del pegado | **EXPLOTABLE (agotamiento de recursos)** | `GuestPasteReader.kt:30-64`, `GuestPanelService.kt:353-362` | No hay tope de renglones. Medido: `:preview` con **200 000** renglones (3,9 MB) responde `200` con **12,9 MB** de JSON; `:import` de **1 500** renglones ocupa **26,6 s** de un hilo de petición, porque `recienGuardado` relee **todos** los invitados de la invitación en cada renglón (coste cuadrático). Un cuerpo JSON de 40 MB se acepta y se analiza. **Se arregla** con tope de renglones y de longitud. |
| 11 | `FAIL_ON_UNKNOWN_PROPERTIES` en toda la aplicación | **Confirmado, fuera de territorio** | `Templates2JsonConfig.kt:35-36` (comentario contradicho en `:16-19`) | Medido: `POST /auth/token` con `{"campoDeMas":1}` → `400` con `Unrecognized field "campoDeMas" (class …auth.presentation.model.request.AuthRequest)` y **la lista de propiedades conocidas** dentro del cuerpo. **No se toca** (dueño de `templates2`). Redactado para `preguntas-abiertas.md` en el reporte. Ninguna ruta nueva de E2 depende de ese comportamiento: `RsvpUpdateRequest` lleva `@JsonIgnoreProperties(ignoreUnknown = true)` y se comprobó que `{"attending":false,"loQueSea":1}` responde `200`. |
| 12 | Datos personales en los logs | **EXPLOTABLE, casi todo fuera de territorio** | `application.yml:132`; `EmailGuestNotifier.kt:187` | Medido: con `logging.level.org.hibernate: debug`, `EntityPrinter` vuelca la entidad entera del invitado en cada flush — **`cancellationToken` y `confirmationToken` completos, correo, nombre y teléfono** (31 líneas con tokens de invitado y 395 con correos en una sesión de 10 minutos). El arreglo es una línea en `application.yml`, **prohibido**: queda para el orquestador. En territorio sí hay uno: `EmailGuestNotifier.notifySingle` imprime el correo del invitado con `println`. **Se arregla ese.** |

## Lo que se va a arreglar (en este orden)

1. **#7** `InvitationGuestsService.appendGuest`: reactivar solo dentro de **la misma invitación** y solo con clave de contacto real (correo **o** teléfono no vacíos); con los dos vacíos la clave `("","")` casa con cualquier baja anónima del sistema.
2. **#9** `GuestCsvWriter.celda`: neutralizar `=`, `+`, `-`, `@`, tabulador y retorno al principio de celda.
3. **#4** `RsvpThrottleService`: el cubo por token pasa a ser por **(token, IP)**. Motivo en el KDoc: a 128 bits el cubo por token no protege nada y sí es un arma contra la dueña del enlace.
4. **#10** `GuestPasteReader`: tope de renglones y de longitud del texto.
5. **#5** `RsvpGuestReader`: mapeo **por nombre** de columna + prueba de integración contra el Postgres efímero (`PgTestCluster`).
6. **#12** `EmailGuestNotifier`: fuera el correo del `println`.
7. **`:send-email`**, la ruta que quedó en `501`.

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
./gradlew test                     # referencia de hoy: 1383 pruebas, 0 fallos
```

Nunca `./gradlew clean`. Para el backend vivo: `scripts/dev-backend.sh stop && scripts/dev-backend.sh start`.
