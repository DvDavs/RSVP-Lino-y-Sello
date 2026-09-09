# 5-2-B parcial · superficie pública del RSVP (agente E2-B)

Bitácora de mitad de encargo. Rama `claude/fase-5-invitados`. **No he ejecutado ningún comando de git.**

## Terminado y verificado

- **Puente `publicToken` (§A4.4), la pieza que no existía.** `modules/product/guests/rsvp/RsvpGuestReader.kt`:
  consulta nativa de solo lectura, patrón de `Templates2EditorQueryRepositories.kt:149-172`. Une
  `invitation_guest → invitation → customer → tpl_document → tpl_release` con `JOIN` **internos**, así
  que los seis motivos de fallo dan cero filas y son indistinguibles.
- **`GET /public/r/{token}`** y **`PUT /public/r/{token}`** en pie (`PublicRsvpController.kt`), sin
  `@PreAuthorize` (deliberado y probado), bajo el prefijo `permitAll` de `SecurityConfig.kt:38`.
- **Límite de intentos** por IP y por token con ámbito propio: `RsvpThrottleService.kt`.
- **Advice acotado** a `…modules.product.guests.rsvp`: `RsvpExceptionHandler.kt`, mensajes fijos, jamás
  el `message` de la excepción original (S-02).
- **S-07 cerrado** en `GuestAttendanceService.kt:32-44`: el bloque que guardaba `request.email` ya no
  existe; el campo se ignora sin error. No había ninguna prueba de `modules/shared/guests` ni de
  `modules/all` que romper (cero clases de prueba en ambos árboles).
- **S-08 cerrado** en `EmailGuestNotifier.kt:58-98`: sin dominio escrito en el código; con
  `uses_templates2 = true` el enlace es `<frontendUrl>/r/<confirmationToken>`.
- **`event.closed` sin duplicar la regla**: se extrajo `GuestAttendanceService.eventoCerrado(...)` al
  `companion object` y la usan tanto el rechazo del `PUT` como el booleano del `GET`.
- **38 pruebas propias, 0 fallos** en 5 clases (`rsvp/`).
- **Verificación manual contra el backend vivo: hecha.** Backend reiniciado (queda ARRIBA en
  `http://127.0.0.1:6003`). `GET` de un invitado publicado devuelve el cuerpo del contrato; el mismo
  invitado **sin** `tpl_release` activo, un token inventado y uno mal formado devuelven los tres el
  mismo `404` byte a byte. `PUT` con `email` en el cuerpo: `200` y el correo **no cambia** en la base
  de datos. La siembra de `scripts/seed/invitados.sh` no publica, así que hay que insertar
  `tpl_document` + `tpl_release` a mano (lo hice sobre la invitación 3 del último sembrado).

## Hallazgo nuevo, para el orquestador

**`FAIL_ON_UNKNOWN_PROPERTIES` está activo en TODA la aplicación, sin que nadie lo quisiera.**
`Templates2JsonConfig.kt:35-36` declara un bean `ObjectMapper` (el estricto de `templates2`,
`Templates2Json.kt:29`) y eso desactiva por `@ConditionalOnMissingBean` el que Spring Boot habría
creado, así que el convertidor HTTP de todas las rutas acaba siendo el estricto.
`Templates2JsonConfig.kt:16-19` afirma por escrito que evita ese efecto no marcándolo `@Primary`; no
basta. Medido contra el backend vivo: `POST /auth/token` con un campo de más responde `400` con **el
nombre de la clase y del campo** dentro del cuerpo — un amplificador de S-02 en el módulo antiguo. El
RSVP se protege con `@JsonIgnoreProperties(ignoreUnknown = true)` en su DTO de entrada, que es lo que
el contrato §2 exige; arreglarlo de raíz es del dueño de `templates2`.

## No empezado (fuera de encargo)

Panel autenticado del §1 del contrato (es de E2-A) · frontend `/r/[token]` (es de E4).

## Decisiones tomadas

1. **Un `404` sin excepciones**: `RsvpException.LinkNotFound` no tiene constructor con parámetros, así
   que es imposible filtrar un detalle por ahí.
2. **El límite se comprueba antes de la consulta y antes de validar el formato**, para que el `429`
   cueste lo mismo exista o no el token.
3. **Clave del cubo por token = SHA-256 del token**, no el token: fuera de volcados de memoria.
4. **Topes por defecto en código** (40/token, 240/IP, ventana 15 min): `application.yml` es compartido y
   no se toca. Las claves `producto.rsvp.throttle.*` ya están escritas por si el orquestador las quiere.
5. **`RSVP_INTERNAL`** es un código que **no** está en el catálogo del contrato §0.6; se añadió para que
   ningún `500` salga sin `code` y con el mensaje dentro.
6. **`409 RSVP_CLOSED`** para el `PUT` sobre un evento pasado: el contrato §2 no fija el estado, se copió
   el de `:send-email` del §1.
7. **La validación de cupos se comprueba dos veces** (aquí para decidir el `code`, y en el servicio
   compartido, que sigue mandando). Documentado en `PublicRsvpService.validarCuerpo`.

## Comandos exactos para verificar

```bash
cd /home/user/RSVP-Lino-y-Sello
./gradlew compileKotlin compileTestKotlin
./gradlew test --tests '*product.guests*' --tests '*shared.guests*' --tests '*modules.all*'
```

Nunca `./gradlew clean`. Última corrida conjunta con E2-A: **103 pruebas, 0 fallos**.
