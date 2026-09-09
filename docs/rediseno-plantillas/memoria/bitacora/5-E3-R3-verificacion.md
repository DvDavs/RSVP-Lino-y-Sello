# Verificación final de seguridad · Fase 5 · E3-R3 · `472d245`

**Veredicto: CERRABLE CON CORRECCIONES.** Las **tres exigencias de R2 están cumplidas** y reproduje las tres contra un backend real: R1-07 (un solo token de una carrera de ocho; familia revocada al replicar fuera de gracia), R2-01 (cubos por operación; el borrado sobrevive al alta agotada; otra clienta no se bloquea) y R2-02 (las altas en cadena ya topan en `429`). Falta **exactamente** esto antes de cerrar: **(1) R3-01, MEDIA** — el arreglo de R2-02 deja el alta y el correo de verificación de **toda la plataforma** colgando de un cubo por IP que, sin proxy declarado, es el del proxy para todo el mundo: el mismo defecto que R2-01 denunció y que C4 corrigió en el otro freno, no aplicado aquí; **(2) R3-02, ALTA** — `application.yml` publica en el registro, en cada arranque real, el `emailVerificationToken`, el `resetToken`, el hash de la contraseña y los datos personales de cada clienta que Hibernate cargue. Sigue en pie la decisión del dueño sobre **R1-02** (§5), que no la cierra ningún código.

Convención: **[V]** reproducido por mí · **[I]** inferido de código · **[?]** sin comprobar. **Ningún valor de secreto ni dato personal aparece aquí: sólo `fichero:línea`.**

## 1 · Los quince de R1, hoy

| # | Estado | Evidencia |
|---|---|---|
| R1-01 | CERRADO | [I] `CustomerService.kt:125-128` intacto tras `472d245`; la única reactivación viva es la de ADMIN (`:216`→`:264`, `AdminUsersService.kt:129,335`). Ni un `isEnabled = true` sobre `customer` fuera de `/admin/**`. |
| R1-02 | **NO CERRADO** | [V] `V1__initial_schema.sql:885` y `:1215`; `V2__…sql:3,7,11,15` (cuatro cuentas privilegiadas con la contraseña en claro). `invitaciones.sql` sí salió del árbol (`d138590`). Decisión del dueño, §5. |
| R1-03 · 04 · 06 · 13 · 15 | CERRADOS | [I] Ningún fichero suyo cambia en `472d245`; sin cambios desde R2. S-01 sigue abierto por la rotación. |
| R1-05 | CERRADO | [V] La salida existe y **funciona con el alta agotada**: `DELETE /product/invitations/3 → 204` mientras `POST → 429`. |
| R1-07 | **CERRADO** con residuo | [V] §3; residuo declarado en R3-03. |
| R1-08 | CERRADO | [V] La red final sigue muda: JSON malformado → `400 CUENTA_DATOS_INVALIDOS`, sin texto de Jackson. |
| R1-09 | CERRADO | [V] `UpdateProfileRequest.kt:26` y `AccountRequests.kt:24,30,37,45` conservan `@JsonIgnoreProperties`. |
| R1-10 | CERRADO | [V] `findByPhone` no existe en `CustomerRepository.kt:22`; queda la gemela sin usar (R2-09). |
| R1-11 | CERRADO | [V] El doble clic devolvió la fila de la base (mismo `id=3` en veinte altas idénticas). |
| R1-12 | CERRADO con residuo | [I] Ninguna migración cambia en `472d245`; el residuo es R2-08. |
| R1-14 | **CERRADO** | [V] La mitad de la entropía existe (`SecretosObligatorios.kt:110-137`) y no suspende ninguna clave legítima: §3. |

## 2 · Los once de R2, hoy

| # | Estado | Evidencia |
|---|---|---|
| R2-01 | **CERRADO** | [V] Cubos por operación y por `customer_id` (`ProductInvitationThrottle.kt:105-115`). Agoté el alta de A (`#21 → 429`), A **borró** (`204`), su alta siguió agotada, y **B creó sin problema** (`201`). No es oráculo: el `customerId` sale del token, así que nadie llena el cubo de otra. El barrido (`:135-144`) sólo borra ventanas con `ahora >= hasta`: **no puede tirar un cubo vivo** [I]. |
| R2-02 | **CERRADO** (abre R3-01) | [V] 20 altas desde `127.0.0.1` y la siguiente `429`; antes eran ilimitadas. Y `consumirEnvio(REGISTRO)` (`CustomerService.kt:169`) pone los dos correos tras un presupuesto, en silencio. |
| R2-03 | ABIERTO, declarado | [I] Fuera de alcance por `ADR-3C-N01-01`, anotado en `preguntas-abiertas.md`. Decisión del dueño. |
| R2-04 | **CERRADO** | [V] Es la mitad del cupo compartido, cerrada con R2-01 (arriba). |
| R2-05 | ABIERTO | [I] `ProductInvitationRepository.kt:168` cuenta borrador por release **activo** y `:293` rechaza el borrado por **cualquier** release: una publicada y retirada ocupa hueco para siempre. |
| R2-06 | **CERRADO A MEDIAS** | [V] `/auth/verify-email` con `text/plain` → `415` (antes `500`). El gemelo sigue igual: `/product/invitations` con sesión y `text/plain` → `500 PRD_INTERNAL` (`ProductInvitationsExceptionHandler.kt:97-106`). El cuerpo del `415`, en R3-04. |
| R2-07 · 08 · 10 · 11 | ABIERTOS / aceptados | [I] Sin cambios: interbloqueo sólo alcanzable por la dueña contra sí misma; `BusinessSnapshotReader.kt:81-86` sigue mapeando por nombre; `email` se ignora en silencio; la compuerta se acepta. |
| R2-09 | ABIERTO | [V] `InvitationGuestsRepository.kt:20` sigue declarada y **no la llama nadie** (sólo la nombra `TelefonoSinUnicidadTest.kt:142`). |

**Ningún hallazgo de R1 ni de R2 se ha reabierto por las correcciones.** Verificado lo que el encargo señalaba: `createOrUpdateRefreshToken` (`RefreshTokenService.kt:68-81`) pasa a borrar en bloque y **no deja a nadie sin sesión donde antes no**: la versión vieja buscaba con `findByCustomer` y borraba **esa** fila, así que el producto siempre tuvo **una sola** sesión de refresco por cuenta; lo que cambia es que dos filas —las que la carrera de R1-07 sabía producir— ya no dan un `500`. `findByCustomer` no la usaba nadie más [V], `CustomerEntity.kt:94` (`refreshTokens`) no se lee en ninguna parte y ningún servicio de esa cadena es `@Transactional` [V], así que el borrado en bloque no deja contexto de persistencia rancio.

## 3 · Las tres exigencias, en detalle

**R1-07 · la ventana de gracia, atacada.** Reproduje los dos órdenes contra `:6013` con reloj real. *Ladrón primero*: canjea `R0` → `200`; la víctima replica `R0` a +8 s (dentro) → `400` **y el ladrón sigue dentro** (`200`); la víctima reintenta a +34 s (fuera) → `400` y **el token del ladrón muere** (`400`). *Víctima primero*: el ladrón que llega dentro de la ventana no obtiene nada —el `DELETE … WHERE token = ?` ya devolvió 0— y se queda fuera. **La ventana no le regala nada al ladrón**: sólo aplaza la revocación, y ninguna de las dos salidas de la víctima la evita (reintentar fuera de gracia revoca; entrar con la contraseña borra la familia igual). El argumento de C4 para **no** poner `@Transactional` es cierto: `canjeSinFila` (`:192-205`) revoca y **después** se lanza, y una transacción de método revertiría ese borrado —el repositorio es `REQUIRED` (`RefreshTokenRepository.kt:42-45`)—; el `AuthController` no abre transacción, así que hoy la revocación commitea sola, y lo comprobé viendo morir el token del ladrón. La única escritura a medias posible es que falle el `save` tras el borrado: se pierde la sesión y hay que volver a entrar. Sin agujero.

**R1-14 · la entropía no suspende claves legítimas.** [V] La de `dev-backend.sh` arranca (el backend levantó dos veces). Apliqué el criterio de `:110-137` a formatos reales: hex de 32, `openssl rand -base64 32` y `-base64 48`, 32 alfanuméricos al azar y una frase de paso **pasan todos**. Lo único que rechaza es una clave de **32 dígitos** al azar (2000/2000), que mide 102 bits por el criterio y ~106 reales: está de verdad por debajo del umbral, y el mensaje dice cómo generar una buena. El mensaje **no imprime la clave** ni sugiere valor alguno; sí revela su longitud y su número de caracteres distintos en el registro de arranque (INFO).

## 4 · Hallazgos nuevos

**R3-01 · MEDIA · El freno del alta de cuentas es, tras un proxy, un cubo único para toda la plataforma — y el del correo también.** `AuthThrottleService.kt:343-358` (`ipCliente`), `:202-220`, `:259-278`; consumidores en `CustomerService.kt:105,169,193`. `confiar-en-x-forwarded-for` es `false` por defecto y `application.yml` no fija `server.forward-headers-strategy`, así que `remoteAddr` es **el del proxy para todo el mundo**. Antes de C4 esto no mordía porque cada alta con éxito limpiaba el contador; el arreglo de R2-02 lo quitó, y ahora: **(a)** 20 peticiones a `/auth/signup` desde una IP dejan a **todo el mundo** sin poder registrarse durante 15 minutos — [V] tras agotar el cubo, un alta legítima con otro correo recibió `429`; **(b)** peor, el presupuesto de envíos es de **5 por IP y ventana** (`:152`) y se agota **en silencio**: a partir del sexto alta las clientas nuevas se quedan sin correo de bienvenida ni de verificación, con `200` y sin que nadie se entere. Es el defecto que R2-01 denunció en `ProductInvitationThrottle` y que C4 corrigió allí (`ProductInvitationThrottle.kt:111`), no aplicado aquí. Arreglo coherente con lo ya decidido: no contar el cubo por IP mientras `confiarEnXff` sea `false` —dejando la defensa dura en el cubo por cuenta y el presupuesto de correo por **destinatario**, no por IP—, o fijar `forward-headers-strategy` al desplegar.

**R3-02 · ALTA · El registro de la aplicación publica tokens vivos, hashes y datos personales de cada clienta.** (Preexistente; no lo trae C4.) `application.yml:53` (`show-sql: true`) y `:198` (`org.hibernate: debug`), sin perfil que lo apague: es el **único** `application.yml` del repositorio [V]. Con eso, `EntityPrinter` vuelca la `CustomerEntity` entera en cada carga y en cada descarga: lo vi en el registro con el `emailVerificationToken` **en claro**, el hash bcrypt de la contraseña, el correo y el resto de campos personales; el mismo volcado lleva `resetToken` cuando no es nulo, que es la credencial de recuperación. Quien lea los registros —operación, un agregador, un servicio de errores— puede tomar cualquier cuenta con una verificación o una recuperación en curso. Arreglo: `org.hibernate: info` y `show-sql: false` fuera de desarrollo.

**R3-03 · BAJA · La detección de reutilización del refresco se pierde al reiniciar, y con más de una instancia.** `RefreshTokenService.kt:51` (`consumidos`, `ConcurrentHashMap` in-process). [V] Reproducido: canje de `R0`, reinicio del backend, réplica de `R0` muy pasada la gracia → `400` **sin revocar**, y el token del ladrón **seguía vivo** (`200`). Con N instancias la detección sólo salta si la réplica cae en la misma. Está declarado en el KDoc (`:42-47`) y falla hacia el lado seguro —nunca revoca de más, y entrar con la contraseña sigue echando al ladrón—, pero conviene decirlo en el contrato: la revocación por reutilización es **oportunista**, no garantizada. Las dos propiedades duras (un solo token por carrera; el canje repetido siempre falla) las sostiene la base de datos y sobreviven al reinicio [V].

**R3-04 · BAJA · El `415` nuevo sale por `BasicErrorController` y arrastra S-02.** `ProductAccountExceptionHandler.kt:93`. Al relanzar el `ErrorResponse`, la respuesta la fabrica la plataforma y no el advice, así que hereda `include-message: always` (`application.yml:6`). [V] El cuerpo trae `error`, `message` y —con `spring-boot-devtools` en el classpath— **la traza de pila completa**. En producción no debería aparecer (`build.gradle.kts:42` la declara `developmentOnly` [V]) y el `message` sólo repite el `Content-Type` que mandó quien llama, así que **no filtra dato ajeno**: es una razón más para cerrar S-02, no un hallazgo propio de esta ruta. Nota de camino: `472d245` arrastra 34 capturas PNG ajenas al arreglo.

## 5 · Lo que queda en manos del dueño y no lo cierra ningún código

- **R1-02.** Las cuatro cuentas MASTER/ADMIN de `V2` con la contraseña en claro (cambiarlas hoy), los datos de nueve personas y ocho refrescos de `V1`, y la decisión sobre reescribir el histórico. La recomendación de R2 §4 sigue siendo la buena; no la repito.
- **S-01.** La rotación de los cinco secretos (JWT, par de AWS, buzón, token de Meta y `verify_token`): ningún agente puede hacerla.
- **R2-03.** Bloqueo por cuenta *o* denegación contra ella en `/auth/token`; no hay tercera opción gratis.
- **`server.forward-headers-strategy`** el día que haya proxy delante, sin la cual R3-01 y todos los límites por IP no significan nada.
- **S-06 y S-09** (pasarela de WhatsApp y webhook sin firma): hoy sólo los contiene el apagado por defecto.

## 6 · Qué reproduje y qué sólo leí

**[V]** `./gradlew test` sobre `472d245`: **1428 pruebas, 0 fallos, 0 errores, 0 saltadas** (recuento sobre los 105 XML de `build/test-results/test/`; coincide con la cifra declarada en `5-E3-C4.md §8`). Contra un backend **propio** en `:6013` con base propia `invitaciones_r3`: los dos órdenes del ataque a la ventana de gracia, ocho canjes simultáneos del mismo token (un `200` y siete `400`; un único token emitido y válido), la pérdida de la detección tras reiniciar, el cubo de alta agotado con el borrado vivo y otra clienta sin bloquear, veinte altas y el `429`, ese `429` alcanzando a una clienta legítima distinta, el `415` nuevo y el `500` del gemelo, el `400` mudo del JSON malformado, y el volcado de `CustomerEntity` en el registro. **Al terminar maté mi propio PID (nunca el `stop` del script), borré la base `invitaciones_r3` y mis ficheros de registro; el backend ajeno de `:6003` quedó intacto y el árbol de git está limpio.** **[I]** El comportamiento con más de una instancia; la reversión que provocaría un `@Transactional` (razonada sobre la propagación `REQUIRED`; lo que sí medí es que hoy la revocación commitea); R1-01/03/04/06/13/15 y R2-05/07/08/10/11, sin cambios desde R2. **[?]** No medí tiempos de respuesta en ningún camino.

## 7 · Lo que dejé sin mirar

- **Todo `frontend/**`**: sigue sin comprobar que el cliente borre el `accessToken` al cerrar sesión (el hallazgo BAJA que R1 aceptó).
- **R1-01 contra una cuenta deshabilitada de verdad**: no pude escribir en la base (permiso denegado), así que lo doy por cerrado por lectura de código, no por reproducción, a diferencia de R2, que sí lo midió.
- **El correo real**: el SMTP de desarrollo es falso, así que la mitad «no sale ningún correo» de R2-02 y de R3-01(b) la sostienen la prueba de unidad y el código, no un buzón.
- **S-02 barrido entero**, `V44` contra una copia de producción, y el salto de v18 a v19 de la API de Meta.
