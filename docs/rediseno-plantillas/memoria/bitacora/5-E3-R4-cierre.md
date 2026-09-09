# Verificación de cierre · Fase 5 · E3-R4 · `3f66cf2`

**Veredicto: CERRABLE CON CORRECCIONES.** Las dos exigencias de R3 están cerradas y las reproduje enteras contra un backend propio. Pero al buscar «¿queda otra vía por la que un secreto acabe en el registro?» —lo que el encargo pedía— encontré una abierta que la propia bitácora de C5 declara cerrada por inspección: **una contraseña en claro llega al registro por defecto** (R4-01, ALTA). Es una línea de código, no un rediseño. **[V]** reproducido · **[I]** leído · **[?]** sin comprobar. **Ningún valor de secreto ni dato personal aparece aquí: sólo `fichero:línea` y recuentos.**

## R3-02 · CERRADO en la vía que nombraba, con un agujero al lado

**[V] Comprobado arrancando, no leyendo el `yml`.** Backend propio `:6023`, base propia `invitaciones_r4`, tres arranques con el mismo alta / reenvío / recuperación / acceso:

| Arranque | hash bcrypt | token verificación | correo | `binding parameter` | `EntityPrinter` | DEBUG |
|---|---|---|---|---|---|---|
| **por defecto** (28 altas) | **0** | **0** | **0** | **0** | **0** | **0** |
| `LOG_HIBERNATE=debug` | **0** | **0** | **0** | **0** | **0** | 5 253 |
| las cuatro palancas a mano | 5 | 5 | 6 | 34 | 9 | sí |

La tercera fila es la que da valor a las dos primeras: los emisores **sí** hablan cuando se les enciende, así que el silencio por defecto lo produce el fijado de `application.yml:223-226`, no que el flujo no pase por ellos. Las cuatro palancas nacen apagadas y `LOG_HIBERNATE=debug` da diagnóstico (`Insert (0): insert into customer (…)`, con `?`) sin un solo valor [V].

**[V] El registrador del inventario es de Hibernate 5, como afirma C5.** Dentro del jar (`hibernate-core-6.6.4.Final`) no existe ningún `BasicBinder` bajo `org/hibernate/type/descriptor/sql/`; las clases que emiten son `type/descriptor/JdbcBindingLogging` y `JdbcExtractingLogging`, y sus constantes `NAME` son literalmente `org.hibernate.orm.jdbc.bind` y `…extract`. Fijar el nombre viejo habría dejado la fuga abierta.

**R4-01 · ALTA · Una contraseña en claro llega al registro en cualquier despliegue, por la validación.** `core/error/InternalExceptionHandler.kt:28` registra `ex.message` de `MethodArgumentNotValidException`, que **incluye los valores rechazados**; Spring reescribe lo mismo en su `WARN`. [V] Un alta con contraseña débil dejó **dos** líneas (ERROR + WARN) con la contraseña entera. Afecta a `UserRequest.password`, `UpdatePasswordResetRequest.newPassword` y `ChangePasswordRequest.newPassword` (`@StrongPassword`), y al correo y al teléfono en cuanto fallan de formato (`/auth/token`, `/auth/signup`, `…:resend`, y cualquier `@Valid` del producto: el manejador es global) [I]. Explotación: no hace falta atacar —lo genera la clienta que teclea una contraseña que no pasa el requisito de fortaleza, que suele ser una que usa en otro sitio—. Impacto: es exactamente la propiedad que R3-02 pedía. **La afirmación de `5-E3-C5.md §3` («ningún cuerpo de petición se escribe en el registro») es falsa** [V]. Arreglo: registrar `ex.bindingResult.fieldErrors.map { it.field }`, nunca `ex.message`.

**Otras vías, miradas y descartadas** [V]: `JwtTokenFilter.kt:32` registra el `HeaderWriterRequest` en cada petición, pero su `toString()` es el de `Object` (visto en el registro real: clase y hash, nada más). **¿Explotable hoy el `toString()` de `CustomerEntity`?** No: barrí `src/main` y no hay una sola interpolación de `customer`/`user` dentro de un `logger`, ni filtro de peticiones, ni `printStackTrace` en esta cadena, y la configuración ya no la vuelca. Es munición cargada, no un disparo; el riesgo es la línea que alguien escriba mañana, y la pregunta al orquestador (punto 5 de `preguntas-abiertas.md`) es la salida correcta. Apunte menor: el punto 4 de esa lista llama `println` a `MailerSendEmailStrategy.kt:61,72,79`, que son `logger` y sí registran el destinatario de cada correo — hoy inertes porque `application.yml:129` fija `email.provider: google`, pero se encienden con `mailersend` sin que nadie lo note.

## R3-01 · CERRADO

[V] Lo de R3, reproducido igual: **veinte altas seguidas desde esta IP → veinte `200`**, la clienta 21 con otro correo → `200` (antes `429`), la 22 → `200`. [V] **Sigue habiendo freno**: la petición **301** del ámbito `registro` recibió el primer `429` (23 + 277 = 300 exactos), y a partir de ahí también una clienta legítima nueva. [V] **No se derrama**: con el alta cerrada, `/auth/token` y `/auth/request-password-reset` seguían en `200`. [V] El `WARN` del presupuesto de correo salió **una sola vez**, tras el envío 60. El arranque dice «SIN proxy de confianza declarado» [V].

**Juicio sobre el techo global.** Mejora real (antes bastaban 20 peticiones; ahora 300 y hay que sostenerlas), pero **no es un freno**: mis 300 altas tardaron ~35 s con un solo `curl` en serie, o sea que 0,33 peticiones/segundo mantienen el registro cerrado para todos indefinidamente. Y hay una palanca más barata y **silenciosa**: 60 peticiones (~7 s) agotan el presupuesto de correo del ámbito y durante quince minutos ninguna clienta nueva recibe su verificación, con un `200` en la mano. Acota la catástrofe —que es lo que C5 dice que hace— pero no defiende. Lo acepto para cerrar **porque el arreglo de verdad es de despliegue** y está anotado (puntos 1-3 del bloque C5), con una corrección: el riesgo es vivo y reproducible, no teórico.

**Juicio sobre dejar `/auth/token` sin techo global.** La decisión es la correcta: 300 fallos son segundos y apagarían el acceso del producto entero, daño peor y más fácil. Pero el precio es mayor que el declarado. [V] 40 intentos contra 40 cuentas distintas → 40 `401`, ningún `429`: la pulverización no topa con nada (esto sí está declarado). Lo que no está declarado:

**R4-02 · MEDIA · `/auth/token` ya no acota el trabajo de bcrypt de nadie.** `AuthThrottleService.kt:316` (cubo por IP sólo con proxy) más el hash señuelo (`:434`, `SecurityConfig.kt:54`, coste 10) dejan cada petición sin autenticar costando un bcrypt sin ningún techo: [V] 48 peticiones con 8 en paralelo consumieron 1,21 s de las 4 CPU de esta máquina (~40/s; latencia media 185 ms frente a 3,8 ms de una ruta sin bcrypt). Antes lo acotaba el cubo por IP —mal, porque era el apagón de plataforma—; ahora nada. Impacto: agotamiento de CPU barato desde fuera. No pido reabrir la decisión: pido que la pregunta 1 del bloque C5 diga también esto, porque cambia el peso de su opción (c).

**R4-03 · BAJA · El presupuesto de correo no cubre la recuperación** (preexistente, no lo trae C5). `ResetPasswordService.kt:78-88` manda el correo **sin** `consumirEnvio`; sólo lo llaman `CustomerService.kt:171` y `EmailVerificationService.kt:206` [V]. El ataque que el KDoc de `maxEnviosGlobales` dice parar —una lista de direcciones reales, una petición por dirección— sigue abierto ahí: hasta 300 correos por ventana a buzones de clientas reales, frente a 60 en el alta.

## Lo demás

- **[V] `./gradlew test` sobre `3f66cf2`: 1438 pruebas, 0 fallos, 0 errores, 0 saltadas**, recontadas sobre los **106** XML de `build/test-results/test/` tras `cleanTest` (la primera pasada salió `UP-TO-DATE`; la cifra de C5 no valía sin rehacerla). Coincide con lo declarado.
- **[V] R3-03 y R3-04 siguen anotados y sin tocar**: `preguntas-abiertas.md`, bloque «Del agente E3-C4», puntos **2** (rastro de refresco en memoria) y **4** (el `415` por `BasicErrorController`). `3f66cf2` sólo **añade** el bloque de C5 al final de ese fichero.
- **[V] Barrido del árbol**: `git status` limpio; ni claves de AWS, ni claves privadas, ni tokens de Meta/Slack. Los únicos hashes bcrypt son los de `V1` y los truncados de `bitacora/5-E3-C1.md:321,332` y `3b-i02.md:318` (cuentas de prueba). **V1 y V2 siguen como estaban**: decisión del dueño, no la repito como hallazgo.
- **Limpieza**: maté sólo mis PID de `:6023` (nunca el `stop` del script), borré la base `invitaciones_r4` y mis ficheros. **No paré ningún clúster**: el de `:58489` lo usa el backend ajeno de `:6003`, que quedó respondiendo `200` [V].

## Lo que dejé sin mirar

Los 26 hallazgos de R1/R2/R3 (doy por buena la tabla de R3 §1-2). Todo `frontend/**`. El correo real: el SMTP es falso, así que «no sale el correo» lo sostienen el código y el `WARN`, no un buzón. El comportamiento con más de una instancia de los cuatro mapas in-process [I]. R4-01 fuera de `/auth/**` [I]. Tiempos de respuesta salvo el bcrypt de R4-02, y el ataque distribuido de verdad: medí desde una sola máquina [?].
