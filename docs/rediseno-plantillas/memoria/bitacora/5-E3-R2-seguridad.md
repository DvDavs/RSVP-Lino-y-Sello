# Re-revisión adversarial de seguridad · Fase 5 · E3-R2

**Veredicto: CERRABLE CON CORRECCIONES.** La crítica (R1-01) está cerrada y la reproduje contra el backend real. Falta **exactamente** esto:
**(1) R1-07**, sin tocar (`RefreshTokenService.kt` no cambia desde `a3d982a`, y ninguna ADR lo refuta); **(2) R2-01**, el freno nuevo del
alta es —tras un proxy— un cubo único para todo el mundo y además **apaga el borrado**, que es la salida que R1-05 exigía; **(3) R2-02**,
`/auth/signup` sigue siendo amplificador de cuentas y de correo sin autenticar, la misma familia que R1-14 cerró en el reenvío; **(4)
R1-02**, que no lo cierra el código y hoy no tiene decisión escrita del dueño (§4).

Convención: **[V]** reproducido por mí · **[I]** inferido de código/esquema · **[?]** sin comprobar. **Aquí no hay ningún valor de secreto
ni ningún dato personal: sólo `fichero:línea`.**

## 1 · Los quince hallazgos de R1

| # | Estado | Evidencia |
|---|---|---|
| R1-01 | **CERRADO** | [V] `CustomerService.kt:125-128` ya no reactiva. Contra `:6003`, correo de cuenta viva y de cuenta deshabilitada: `400`, **cuerpo idéntico byte a byte**, mismo tiempo (5-8 ms), y tras el intento `is_enabled=f` y `deleted_by` intactos. Las dos ramas hacen el mismo trabajo (una consulta, un `registrarIntento`, la excepción): ni bcrypt, ni escritura, ni correo, ni contador distinto. No queda otra vía sin autenticar: los cuatro `isEnabled = true` sobre `customer` viven bajo `/admin/**` (`AdminUsersService.kt:129,335`, `CustomerService.kt:260`). |
| R1-02 | **NO CERRADO** | [V] `V1__initial_schema.sql:885` (9 filas de `customer` con hash y datos personales) y `:1215` (8 `refresh_tokens` en claro); `V2__…sql:2-17`, cuatro cuentas **MASTER/ADMIN con la contraseña en claro** pasada a `crypt()`. Retirar `invitaciones.sql` no sacó nada de esto. Ver §4. |
| R1-03 | **CERRADO en código** | [V] `application.yml:141-151`, `WhatsAppConfiguracion.kt:49-53`, sin defecto. Sin token **no hay ninguna llamada a Meta**: `WhatsAppService.kt:56-58`, `WhatsAppWebhookController.kt:37-40,56-59,86`. `GET /webhook?hub.verify_token=` → `503`, no `200` ni `403`: el token vacío no valida nada (`:73`). S-01 sigue abierto por la rotación. |
| R1-04 | **CERRADO** | [I] `MailConfig.kt` no existe; `application.yml:80-120` trae el transporte entero (SSL 465, `socketFactory.fallback:false`, depuración apagada) y las dos credenciales sin defecto. |
| R1-05 | **CERRADO** | [V] Comenté `ProductInvitationService.kt:64` y corrí la prueba: `expected: <3> but was: <8>`; restaurada, verde (`src/` limpio). El `FOR UPDATE` va sobre la fila correcta y en el mismo orden que el `FOR KEY SHARE` que el `INSERT` pide por la FK, así que no crea orden nuevo (ventana residual en R2-07). El `DELETE` **no es IDOR**: B contra la invitación de A y B contra un id inexistente dan el mismo `404 PRD_INVITATION_NOT_FOUND`, la fila sobrevive, A la borra con `204`; no borra pagado ni publicado (`:124-126`). |
| R1-06 | **CERRADO** | [V] `EmailVerificationService.kt:193-194` (con pendiente vivo el reenvío no manda nada) y `:230-238` (el pendiente muere con el token), llamado desde los dos caminos (`:110`, `:180`). Repasadas las demás rutas: sólo `AccountService.kt:111-145` arma un pendiente, y **exige contraseña**. 16 pruebas verdes. |
| R1-07 | **NO CERRADO** | [V] Último commit del fichero: `a3d982a`, el que R1 revisó. `rotateRefreshToken` (`:55-66`) sigue sin `@Transactional`, sin comprobar que el `delete` borró 1 y sin revocar la familia ante un canje repetido. Ninguna bitácora ni ADR lo menciona. |
| R1-08 | **CERRADO** | [V] Red final muda (`ProductAccountExceptionHandler.kt:85-87`) y captura del choque como error de dominio (`EmailVerificationService.kt:152-159`); `AccountRoutesContractTest`, 10 pruebas. Efecto colateral en R2-06. |
| R1-09 | **CERRADO** | [V] `UpdateProfileRequest.kt:26` y `AccountRequests.kt:24,30,37,45`. Ninguno de los cinco DTO tiene id, estado ni importe: lo ignorable es `email` y claves de formulario. `PerfilCuerpoDelFrontendTest` comprueba además que el mapper sigue siendo el estricto. Ver R2-10. |
| R1-10 | **CERRADO** | [V] `findByPhone` fuera de `CustomerRepository.kt:22-27`; sin comprobación en `CustomerService.kt:130-136,203-211,252-254` ni en `AdminUsersService.kt:85-91`. 4 pruebas. La misma trampa queda **sin usar** en otra entidad: R2-09. |
| R1-11 | **CERRADO** | [V] `ProductInvitationService.kt:135-148` devuelve la fila de la base; la igualdad del doble clic ya incluye los seis campos (`ProductInvitationRepository.kt:206-208`). |
| R1-12 | **CERRADO** con residuo | [V] `V44:39-102` resuelve por nombre y sólo inserta si falta; `:128-148` siembra las gemelas con marcador `…:plan2`. En la base: 8 + 8 filas, tipos correctos, gemelas `is_premium=t`/`is_enabled=f`. **No hay camino a plan 2 sin pagar**: `plantillaPuente` casa `url` **exacta** (`ProductInvitationRepository.kt:147`) y el índice único parcial de `V42:66-68` garantiza una sola fila; el alta que hice usó la 901, `is_premium=f`. Residuo en R2-08. |
| R1-13 | **CERRADO** | [V] `docker-compose.yml:60-70` define las cinco con `${VAR:?…}`; `SecretosObligatorios.kt:105-112` añade el interruptor explícito. Matiz en R2-11. |
| R1-14 | **CERRADO A MEDIAS** | [V] Cerrada la mitad del reenvío: `consumirEnvio` cuenta **envíos** por IP y se agota en silencio (`AuthThrottleService.kt:241-260`, `EmailVerificationService.kt:203`). Sin cerrar: nadie valida la **entropía** de `JWT_SECRET` (32 caracteres iguales pasan las dos puertas) y el mismo amplificador sigue abierto en el alta (R2-02). |
| R1-15 | **CERRADO** | [V] `V44:115-119,150-153`; en la base `invitation_template_id_seq` = 916 = `max(id)`, por encima de la banda 901-908. El único hueco que queda son los ids 11-900 sin usar, que es inocuo. |

**Migraciones** [V]: `V41`, `V42`, `V44` con `success = t`; `V43` no existe y Flyway acepta el salto. `V44` es idempotente (`IS DISTINCT
FROM` en el `UPDATE`, `NOT EXISTS` en el `INSERT`, y en la segunda pasada el tipo creado se halla por nombre exacto). El caso que importaba
—base donde `V42` ya se aplicó con el catálogo torcido— lo cubre `ProductInvitationPuenteV44Test`, verde.

## 2 · Hallazgos nuevos

**R2-01 · MEDIA · El freno nuevo del alta es, tras un proxy, un cubo único para todos — y apaga el borrado.**
`ProductInvitationThrottle.kt:34,63-68,90-102`. `confiar-en-x-forwarded-for` es `false` por defecto y `application.yml` no fija
`server.forward-headers-strategy`: `remoteAddr` es el del proxy **para todo el mundo**, y este cubo por IP no lo limpia nadie nunca (no hay
`registrarExito`, a diferencia de `AuthThrottleService.kt:220-223`). Explotación: 60 escrituras en 15 min —de una clienta o del conjunto— y
**toda** la plataforma recibe `429` en `POST /product/invitations` **y en `DELETE …/{id}`**, que es la salida que R1-05 exigió. Arreglo:
cubo aparte para el borrado y no aplicar el cubo por IP mientras `confiarEnXff` sea `false` (o fijar `forward-headers-strategy` al
desplegar).

**R2-02 · MEDIA · `/auth/signup`, amplificador de cuentas y de correo sin autenticar.** `AuthThrottleService.kt:220-223` +
`CustomerService.kt:159-173`. Un alta correcta llama a `registrarExito(REGISTRO, …)`, que **borra el contador de IP**: las altas con éxito
no se acumulan nunca y el techo de 20/IP sólo frena tanteos fallidos. Cada alta escribe una fila de `customer` y encola **dos** correos
sobre el mismo canal SMTP gratuito que R1-14 vino a proteger, y `consumirEnvio` no se aplica aquí. [V] 5 cuentas desde la misma IP en menos
de dos minutos, ni un `429`. Arreglo: pasar los dos envíos por `consumirEnvio` y que el éxito limpie sólo el cubo de cuenta, no el de IP.

**R2-03 · MEDIA · Bloqueo de cuenta ajena en `/auth/token`.** `AuthThrottleService.kt:192-196,206-213`. [V] Cinco intentos con contraseña
**bien formada** pero incorrecta contra un correo conocido y la dueña, con la contraseña buena, recibe `429`: quince minutos de bloqueo por
cinco peticiones de un tercero. Preexistente y deliberado (`ADR-3C-N01-01`), pero sin mitigación y sin decirse como riesgo asumido; mismo
patrón en `VERIFICACION`. Arreglo posible sin rehacerlo: dejar pasar el acierto de contraseña aunque el cubo esté lleno, o retrasar en vez
de rechazar.

**R2-04/05 · BAJA · Dos huecos que la clienta no puede liberar.** Crear y borrar comparten cupo (`ProductInvitationService.kt:59` y `:120`,
mismo `comprobarYRegistrar`), así que quien agote sus 20 escrituras **no puede borrar** para hacer sitio con el tope de tres puesto. Y
`ProductInvitationRepository.kt:167-169` cuenta como borrador lo que no tiene release **activo**, mientras `:293` y
`ProductInvitationService.kt:125` rechazan el borrado si existe **cualquier** release: una invitación publicada y luego retirada ocupa hueco
para siempre y vuelve a hacer falta un MASTER.

**R2-06 · BAJA · La red final de R1-08 convierte 4xx de Spring en `500`.** [V] `POST /auth/verify-email` con `Content-Type: text/plain`
responde **`500 CUENTA_ERROR_INTERNO`** en vez de `415`: `ProductAccountExceptionHandler.kt:85-87` (y su gemelo
`ProductInvitationsExceptionHandler.kt:97-106`) se traga `HttpMediaTypeNotSupportedException`. **No filtra nada** —el cuerpo es mudo— y el
`401`/`403` sí están a salvo ([V] sin token las tres rutas nuevas dan `401`; `AccessDeniedException` se relanza en `:70-71`). Arreglo:
declarar los 4xx de Spring MVC antes de la red final.

**R2-07 · BAJA · Ventana de interbloqueo.** `eliminar` toma `customer` → `invitation` → (cascada) `tpl_document`; publicar toma
`tpl_document` (`ReleaseStore.kt:28-30`, `FOR UPDATE`) → `tpl_release`, que pide `FOR KEY SHARE` sobre `invitation`. Orden inverso en las
dos últimas: PostgreSQL aborta una y sale `500 PRD_INTERNAL`. Sólo alcanzable por la dueña contra sí misma.

**R2-08 · BAJA · `V44` cambió el acoplamiento de id a nombre, y el nombre lo edita la administración.** `V44:44-101` resuelve al migrar,
pero `BusinessSnapshotReader.kt:81-86` sigue mapeando **por nombre en cada lectura**: renombrar «Graduación» después devuelve `GENERIC` en
silencio. Y los patrones pueden llevar dos `eventKind` a la misma fila («Bautizo y Comunión» casa `%bautizo%` y `%comuni%`). R1-12 queda
cerrado para la colisión de ids que denunció, no para el acoplamiento.

**R2-09/10/11 · BAJA e INFO.** `InvitationGuestsRepository.kt:20` es la misma derivada de resultado único que R1-10 retiró, ahora sobre
`invitation_guest.phone` (sin índice único); **no la llama nadie** [V], conviene borrarla con la otra. `UpdateProfileRequest.kt:26` ignora
`email` **en silencio**: el frontend publicado que lo siga mandando recibe `200` y ningún cambio (decisión correcta de R1-09, pero la
respuesta afirma algo que no ocurrió hasta que el frontend se actualice). Y `SecretosObligatorios.kt:105-112` deja apagar la compuerta desde
fuera (`SECRETOS_OBLIGATORIOS_EXIGIR=false`): sólo puede hacerlo quien ya controla el entorno y, aun apagada, la aplicación **no arranca**
sin `JWT_SECRET` (`application.yml:17` no tiene defecto). Se acepta.

## 3 · Qué reproduje y qué sólo leí

**[V]** `./gradlew test --rerun`: **1414 pruebas, 0 fallos, 0 saltadas** sobre `HEAD` (la cifra de `estado-E3.md` era de `7efbc8f`; ésta ya
incluye `bc8c171`). Concurrencia con el bloqueo comentado: `expected: <3> but was: <8>`; restaurado, verde. Contra `:6003` (ya estaba en
marcha desde las 12:36; no lo arranqué yo y lo dejo como lo encontré): alta viva vs. deshabilitada, `DELETE` ajeno vs. inexistente, borrado
propio, plan de la fila puente, `401` sin token, `415`→`500`, webhook apagado, bloqueo de cuenta ajena, 5 altas seguidas sin `429`;
consultas a la base para `V41/V42/V44`, las 16 filas puente y las dos secuencias. Todas las filas que creé están borradas. **[I]** R1-04 (no
levanté un SMTP), la cadena del mapper estricto (la respalda su prueba), el interbloqueo de R2-07 (razonado, no provocado) y `V44` sobre un
catálogo torcido (lo respalda su prueba). **[?]** El salto de v18 a v19 de Meta: `/messages` con plantilla es compatible y la URL es
sobrescribible con `WHATSAPP_API_URL`; inocuo, no verificado.

## 4 · R1-02 · Mi recomendación al dueño

**El riesgo, por orden.** (1) `V2:2-17` siembra **cuatro cuentas MASTER/ADMIN con la contraseña en claro**: quien tenga el repositorio de
cualquier fecha entra como MASTER si no se han cambiado en la base. No es una fuga de datos, es una credencial de administración publicada,
y es lo único urgente. (2) `V1:885` y `:1215` publican datos de nueve personas reales más ocho tokens de refresco en claro: los tokens
caducaron, los datos personales no caducan y su publicación es un incidente con obligaciones legales, no un defecto técnico.

**Opciones y coste.** *Editar `V1`/`V2` + `flyway repair`*: único camino que quita los datos del árbol; `repair` hay que correrlo en
**cada** entorno antes del siguiente despliegue o Flyway aborta por suma de comprobación, un entorno nuevo se queda sin cuenta MASTER de
arranque (hace falta siembra sustituta) y **no borra nada del histórico**. *Migración posterior `V45`*: coste bajo, sin romper sumas
—cambiar el hash de las cuatro privilegiadas, borrar los ocho refresh, anonimizar las nueve filas—; arregla la **base**, no el árbol ni el
histórico. *Dejarlo y rotar*: coste cero, datos publicados para siempre.

**Recomiendo, en este orden.** (a) **Hoy**: cambiar la contraseña de las cuatro cuentas MASTER/ADMIN desde la aplicación —eso, y sólo eso,
corta el acceso— y comprobar si siguen existiendo y habilitadas. (b) **Esta semana**: `V45`; barata, no rompe Flyway y limpia la base aunque
el repositorio siga sucio. (c) **Con fecha**: reescribir el histórico (`git filter-repo`) sobre `V1`, `V2`, `invitaciones.sql` y los seis
secretos de S-01 **a la vez** —invalida todos los clones, así que se hace una vez para todo—, con `flyway repair` en cada entorno el mismo
día. Si (c) se descarta, hay que asumirlo por escrito: repositorio privado y los datos de esas nueve personas tratados como comprometidos.

**S-01.** En código está cerrado y lo comprobé extremo por extremo. Queda **sólo la rotación**, que no puede hacer un agente: clave del JWT
(cierra todas las sesiones: avisar antes), par de AWS (crear el nuevo y **desactivar el viejo en IAM**), contraseña del Gmail (ya sin
precondición técnica desde `ADR-5-E3-A4-01`), token de Meta y `verify_token` del webhook.

## 5 · Lo que dejé sin mirar

- **Todo `frontend/**`**: hay un agente escribiendo ahí. No miré el manejo del `accessToken` en el cliente, que es donde cierra el hallazgo
  BAJA que R1 aceptó (sobrevive al logout): **nadie ha comprobado que se borre**.
- **S-06 y S-09** (pasarela abierta de `/api/whatsapp/send-masivo`, webhook sin firma): abiertos y declarados en
  `WhatsAppController.kt:12-19` y `WhatsAppWebhookController.kt:17-21`; hoy sólo los contiene el apagado por defecto.
- **S-02** (`application.yml:5`): sigue puesto; `/auth/**` y `/user/profile` salen por `GeneralExceptionHandler` y no barrí qué mensajes
  salen por ahí.
- **Los tiempos de `POST /user/account/email`** (la nota **[?]** de R1) y **`V44` contra una copia de producción**: sin medir y sin probar.
