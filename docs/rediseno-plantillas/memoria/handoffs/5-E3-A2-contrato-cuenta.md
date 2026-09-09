# 5-E3-A2 · Contrato de cuenta y acceso (backend) → agente de frontend de `/perfil` y `/acceso`

Base `9a4cd56`, rama `claude/fase-5-cuenta-whlhhq`. Origen: `diseno/12-producto-completo.md §A2.1` y `§A6.4`.
Todo cuerpo es JSON. Rutas bajo `/auth/**` son públicas; las de `/user/**` exigen `Authorization: Bearer <accessToken>`.

## 1. Rutas endurecidas (contrato de forma **sin cambios**, salvo lo marcado)

| Verbo y ruta | Rol | Qué cambia para el frontend |
|---|---|---|
| `POST /auth/token/refresh` | público | Mismo payload `{refreshToken}` y misma respuesta `{accessToken, refreshToken, role, isSurveyAnswered}`, pero **el `refreshToken` que devuelve es NUEVO y el que enviaste deja de valer**. Guarda siempre el de la respuesta o el siguiente refresco dará `400`. |
| `POST /auth/reset-password` | público | Mismo payload `{resetToken, newPassword}`. Añade `429` al pasarse de intentos. Al cambiar la contraseña **se cierran todas las sesiones** de esa cuenta: tras un reset hay que volver a `POST /auth/token`. |
| `POST /auth/signup` | público | Mismo payload y misma respuesta (sesión iniciada de inmediato, **no se bloquea el acceso**). La cuenta nace con `emailVerified=false` y recibe el correo de verificación. Mensaje de teléfono corregido: pide `+52` + 10 dígitos con ejemplo. Un teléfono ya registrado **ya no da error**. |
| `GET /user/profile` | USER+ | La respuesta `Profile` gana un campo: `emailVerified: boolean`. Todo lo demás igual. **Es la ruta de estado de la pantalla `/perfil`**: no se creó ninguna ruta nueva de lectura. |
| `PUT /user/profile` | USER+ | **RUPTURA**: el campo `email` **ya no se acepta ni se guarda**. Payload nuevo: `{name, lastName, phone?, birthdate?, address?, city?, postalCode?, state?}`. Enviar `email` no rompe la petición (se ignora), pero **no cambia nada**. El correo se cambia por `POST /user/account/email`. |

## 2. Rutas nuevas

| Verbo y ruta | Rol | Payload | Respuesta `200` |
|---|---|---|---|
| `POST /auth/verify-email` | público | `{"token": "<token del enlace>"}` | `{"message": "..."}` |
| `POST /auth/verify-email:resend` | público | `{"email": "..."}` | `{"message": "..."}` — **siempre igual**, exista o no la cuenta y esté o no verificada. Nunca revela nada. |
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
