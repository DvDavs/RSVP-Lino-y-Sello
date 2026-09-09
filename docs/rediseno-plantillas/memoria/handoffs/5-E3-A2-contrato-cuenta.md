# 5-E3-A2 · Contrato de cuenta y acceso (backend) → agente de frontend de `/perfil` y `/acceso`

Base `9a4cd56`, rama `claude/fase-5-cuenta-whlhhq`. Origen: `diseno/12-producto-completo.md §A2.1` y `§A6.4`.
Todo cuerpo es JSON. Rutas bajo `/auth/**` son públicas; las de `/user/**` exigen `Authorization: Bearer <accessToken>`.

## 1. Rutas endurecidas (contrato de forma **sin cambios**, salvo lo marcado)

| Verbo y ruta | Rol | Qué cambia para el frontend |
|---|---|---|
| `POST /auth/token/refresh` | público | Mismo payload `{refreshToken}` y misma respuesta `{accessToken, refreshToken, role, isSurveyAnswered}`, pero **el `refreshToken` que devuelve es NUEVO y el que enviaste deja de valer**. Guarda siempre el de la respuesta o el siguiente refresco dará `400`. **Desde el 2026-09-09 (agente 5-E3-C4, R1-07): reusar un token ya canjeado pasados 30 s revoca TODAS las sesiones de la cuenta** —es la firma de un token copiado—, así que el `400` puede significar «vuelve a entrar con la contraseña». Dos canjes casi simultáneos del mismo token (dos pestañas) siguen sin cerrar la sesión: uno gana, el otro recibe `400` y la sesión del que ganó sigue viva. **No reintentes un canje con el token viejo**: guarda el nuevo o manda a `/acceso`. |
| `POST /auth/reset-password` | público | Mismo payload `{resetToken, newPassword}`. Añade `429` al pasarse de intentos. Al cambiar la contraseña **se cierran todas las sesiones** de esa cuenta: tras un reset hay que volver a `POST /auth/token`. |
| `POST /auth/signup` | público | Mismo payload y misma respuesta (sesión iniciada de inmediato, **no se bloquea el acceso**). La cuenta nace con `emailVerified=false` y recibe el correo de verificación (desde el 2026-09-09, R2-02, ese envío pasa por un presupuesto por IP: si se agota, la cuenta se crea igual y **sin correo**, con la misma respuesta; la salida es el reenvío desde `/perfil`). Mensaje de teléfono corregido: pide `+52` + 10 dígitos con ejemplo. Un teléfono ya registrado **ya no da error**. |

> **Corrección de esta fila (5-E3-C1, hallazgo R1-01).** El alta pública **ya no reactiva cuentas
> deshabilitadas**. Antes, un correo de una cuenta dada de baja reactivaba la cuenta y le escribía la
> contraseña que viniera en el cuerpo: toma de control ajena desde una ruta pública sabiendo sólo el
> correo. Ahora un correo de una cuenta deshabilitada responde **exactamente igual** que un correo ya
> tomado por una cuenta viva: `400` con `{"errors":{"error":"Este correo no se encuentra disponible…"}}`,
> el mismo cuerpo letra por letra. Para la interfaz **no hay caso nuevo**: sigue siendo «ese correo no
> está disponible, prueba con otro».
>
> **Consecuencia para producto**: hoy una cuenta deshabilitada **sólo la reactiva un ADMIN/MASTER**. No
> existe vía de vuelta autoservicio; si el frontend ofrecía «vuelve a registrarte con tu correo de
> siempre», hay que quitarlo. Ver `preguntas-abiertas.md` y `ADR-5-E3-C1-01`.
| `GET /user/profile` | USER+ | La respuesta `Profile` gana un campo: `emailVerified: boolean`. Todo lo demás igual. **Es la ruta de estado de la pantalla `/perfil`**: no se creó ninguna ruta nueva de lectura. |
| `PUT /user/profile` | USER+ | **RUPTURA**: el campo `email` **ya no se acepta ni se guarda**. Payload nuevo: `{name, lastName, phone?, birthdate?, address?, city?, postalCode?, state?}`. Enviar `email` no rompe la petición (se ignora), pero **no cambia nada**. El correo se cambia por `POST /user/account/email`. |
> **Corrección de esta fila (5-E3-C1, hallazgo R1-09).** Cuando se publicó este contrato la frase
> «enviar `email` no rompe la petición (se ignora)» **era falsa**: el `ObjectMapper` de la aplicación es
> el estricto de `templates2` (`Templates2JsonConfig.kt:35-36`; no es `@Primary`, pero **es el único**,
> así que por `@ConditionalOnMissingBean` retira el de `JacksonAutoConfiguration` y el convertidor de
> Spring MVC se queda con él) y trae `FAIL_ON_UNKNOWN_PROPERTIES`, de modo que ese cuerpo respondía
> **`400`**. Desde `5-E3-C1` la frase es cierta: `UpdateProfileRequest` lleva
> `@JsonIgnoreProperties(ignoreUnknown = true)` y los cuatro DTO de `/user/account/**` y
> `/auth/verify-email**` también. Verificado contra el backend real: `PUT /user/profile` con `email`
> dentro responde `200`, guarda el resto y deja el correo de acceso intacto.


## 2. Rutas nuevas

| Verbo y ruta | Rol | Payload | Respuesta `200` |
|---|---|---|---|
| `POST /auth/verify-email` | público | `{"token": "<token del enlace>"}` | `{"message": "..."}` |
| `POST /auth/verify-email:resend` | público | `{"email": "..."}` | `{"message": "..."}` — **siempre igual**, exista o no la cuenta y esté o no verificada. Nunca revela nada. **No re-arma un cambio de correo pendiente** (ver nota). |
| `POST /user/account/logout` | USER, ADMIN, MASTER | (sin cuerpo) | `{"message": "..."}` — borra **todos** los tokens de refresco de quien llama. El `accessToken` sigue vivo hasta que caduque: el frontend debe borrarlo también. |
| `PUT /user/account/password` | USER, ADMIN, MASTER | `{"currentPassword": "...", "newPassword": "..."}` | `{"message": "..."}` — exige la actual, cierra todas las sesiones (hay que volver a entrar). |
| `POST /user/account/email` | USER, ADMIN, MASTER | `{"email": "<nuevo>", "password": "<la actual>"}` | `{"message": "..."}` — **respuesta genérica siempre**: no dice si el correo estaba tomado. El correo de acceso **no cambia** hasta que se abre el enlace y se confirma con `POST /auth/verify-email`. |

`newPassword` y la contraseña del alta usan la misma regla de fuerza de siempre: ≥8, mayúscula, minúscula y carácter especial.

## 3. Enlaces de los correos (los construye el backend con `FRONTEND_URL`)

- Verificación de correo y confirmación de cambio de correo: `${FRONTEND_URL}/verificar-correo?token=<token>`.
  **El frontend tiene que crear esa ruta**: toma el `token` de la cadena de consulta y llama a `POST /auth/verify-email`.
- Recuperación (ya existía): `${FRONTEND_URL}/login/reset-password/ChangePass?token=<token>`.
- El token de verificación vive **24 h**; el de recuperación, 15 min.

## 4. Errores

Las rutas nuevas y `POST /user/account/**` responden con `{"timestamp", "statusCode", "code", "message"}`.
`code` es estable; ordena la interfaz por `code`, **nunca** por `message`.

| `code` | Estado | Cuándo |
|---|---|---|
| `CUENTA_TOKEN_INVALIDO` | 400 | El token de verificación no existe o ya se usó. Ofrece reenviar. |
| `CUENTA_TOKEN_CADUCADO` | 400 | El token de verificación pasó de 24 h. Ofrece reenviar. |
| `CUENTA_PASSWORD_INCORRECTA` | 400 | `currentPassword` (o `password` del cambio de correo) no coincide. |
| `CUENTA_CORREO_NO_DISPONIBLE` | 409 | Solo al **confirmar** un cambio de correo: alguien tomó esa dirección mientras tanto. |
| `CUENTA_DATOS_INVALIDOS` | 400 | El payload no valida (campo ausente, contraseña débil, correo mal formado). `message` trae el detalle. |
| `CUENTA_DEMASIADOS_INTENTOS` | 429 | Límite de intentos: reenvío de verificación, cambio de contraseña, cambio de correo. Cuerpo constante, no dice cuánto falta. |
| `CUENTA_ERROR_INTERNO` | 500 | **Nuevo en 5-E3-C1 (R1-08)**. Algo se rompió por dentro. Cuerpo **constante y mudo**: no dice qué pasó. Trátalo como «vuelve a intentarlo»; nunca lo enseñes tal cual ni lo interpretes. |

Las rutas heredadas (`/auth/token`, `/auth/signup`, `/auth/token/refresh`, `/auth/reset-password`, `/user/profile`)
**no llevan `code`**: mantienen el cuerpo de siempre `{"timestamp", "statusCode", "errors": {...}}`.
Ahí el frontend sigue leyendo por estado: `400` datos, `401` credenciales, `429` demasiados intentos.
El `401` por token ausente o caducado y el `403` por rol los escribe la cadena de seguridad y **tampoco llevan `code`**
(`SecurityConfig.kt:34-35`): trátalos como «vuelve a entrar» y «no tienes permiso», sin mirar el cuerpo.

## 5. Notas de comportamiento que la interfaz tiene que reflejar

1. **La verificación NO bloquea nada hoy** (decisión de producto pendiente, `§A2.1`). `/perfil` enseña el estado
   `emailVerified` y un botón «reenviar»; ninguna ruta responde `403` por estar sin verificar.
2. Las cuentas **anteriores** a esta entrega nacen verificadas (`email_verified DEFAULT true`, `§A6.4`), así que
   `emailVerified=false` solo lo verás en cuentas nuevas y en cuentas con un cambio de correo a medias.
3. Cambiar la contraseña, cambiar el correo (al confirmarlo) y el reset **invalidan el `refreshToken`**: tras cualquiera
   de ellos, la sesión guardada deja de refrescar y hay que mandar a `/acceso`.
4. El reenvío de verificación y el cambio de correo están limitados: encadena el botón a un estado deshabilitado tras
   la primera pulsación y trata `429` como «espera unos minutos», sin contador (el backend no dice cuánto falta).
5. **El reenvío no re-arma un cambio de correo pendiente** (5-E3-C1, R1-01/R1-06). Mientras haya un cambio de correo sin
   confirmar, `POST /auth/verify-email:resend` responde su mensaje de siempre pero **no manda nada**: reenviar el enlace
   de un cambio exige probar quién eres, y eso sólo lo hace `POST /user/account/email`, que pide la contraseña. En la
   pantalla de `/perfil`, si hay un cambio pendiente, el botón que hay que ofrecer es «volver a pedir el cambio»
   (con contraseña), **no** «reenviar verificación».
6. **El cambio pendiente caduca.** Pasadas las 24 h del token, `email_pending` se borra solo la primera vez que se toca
   la cuenta (al abrir un enlace viejo o al pedir un reenvío). Un enlace caducado que ya se limpió responde
   `CUENTA_TOKEN_INVALIDO` en vez de `CUENTA_TOKEN_CADUCADO` si se vuelve a pulsar: los dos ofrecen lo mismo —pedir uno
   nuevo—, así que la interfaz puede tratarlos igual.
7. **Un reenvío puede no mandar correo aunque responda `200`** (5-E3-C1, R1-14). Hay un techo de envíos por IP y ventana
   que se agota **en silencio**, a propósito: avisar delataría qué direcciones existen. La interfaz no puede prometer
   «te lo acabamos de mandar»; el texto correcto es el condicional que ya devuelve el backend
   («si el correo corresponde a una cuenta sin verificar…»).
8. **El teléfono no es único** (5-E3-C1, R1-10). Ninguna ruta —pública ni administrativa— rechaza ya un número repetido.
   El alta administrativa que antes respondía «este número no se encuentra disponible» ya no lo hace.
