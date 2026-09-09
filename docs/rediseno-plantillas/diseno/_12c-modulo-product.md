# 12c — Módulo `product`: esqueleto del backend de la fase 5

Autor: sub-agente **5-0c** (esqueleto del módulo backend nuevo) · Fecha: 2026-09-09 · Rama `claude/fase-5-cimientos-adenda-u150eq`.

Este documento describe el **andamio** que la fase 5 usa como territorio del backend. No hay lógica de negocio: cuatro rutas de salud, tres objetos de configuración tipada y cuatro pruebas. Todo lo demás lo escriben E2, E3, E4 y E5 dentro de su subpaquete.

---

## 1. Árbol del módulo y dueño de cada subpaquete

Un subpaquete por sesión. **Ninguna sesión escribe fuera del suyo**, y los tres ficheros de la raíz del módulo quedan congelados por 5-0c para que ninguna de las cuatro tenga que abrirlos.

```
src/main/kotlin/mx/evolutiondev/invitaciones/modules/product/
├── ProductHealthResponse.kt      CONGELADO (5-0c) · cuerpo de las 4 rutas de salud: {module, status}
├── ProductPropertiesConfig.kt    CONGELADO (5-0c) · @EnableConfigurationProperties de las 3 clases
├── account/                      ← sesión E3 (cuenta, marca, legal)
│   ├── AccountHealthController.kt      GET /product/account/health
│   ├── ProductMailProperties.kt        producto.correo.*   (remitente de marca)
│   └── ProductContactProperties.kt     producto.contacto.* (correo, WhatsApp, soporte)
├── guests/                       ← sesión E2 (invitados, RSVP, compartir)
│   └── GuestsHealthController.kt       GET /product/guests/health
├── payments/                     ← sesión E4 (pagos con Stripe, planes)
│   ├── PaymentsHealthController.kt     GET /product/payments/health
│   └── ProductPaymentsProperties.kt    producto.pagos.stripe.*
└── admin/                        ← sesión E5 (administración del producto nuevo)
    └── ProductAdminHealthController.kt GET /product/admin/health

src/test/kotlin/mx/evolutiondev/invitaciones/modules/product/
├── account/AccountHealthControllerTest.kt         3 pruebas
├── guests/GuestsHealthControllerTest.kt           3 pruebas
├── payments/PaymentsHealthControllerTest.kt       3 pruebas
└── admin/ProductAdminHealthControllerTest.kt      3 pruebas
```

`ProductMailProperties` y `ProductContactProperties` viven en `account/` porque su dueña es E3, pero **E2 las inyecta tal cual** para los correos de invitados: inyectar no es escribir y no genera conflicto de fusión.

La clase del subpaquete `admin` se llama `ProductAdminHealthController`, no `AdminHealthController`, para que buscar por nombre no confunda el módulo nuevo con `modules/admin`, que es el administrativo viejo y sigue en pie hasta la fase 7.

### 1.1 Las cuatro rutas

| Ruta | Roles | Cuerpo |
|---|---|---|
| `GET /product/account/health`  | `USER`, `ADMIN`, `MASTER` | `{"module":"product.account","status":"ok"}` |
| `GET /product/guests/health`   | `USER`, `ADMIN`, `MASTER` | `{"module":"product.guests","status":"ok"}` |
| `GET /product/payments/health` | `USER`, `ADMIN`, `MASTER` | `{"module":"product.payments","status":"ok"}` |
| `GET /product/admin/health`    | `ADMIN`, `MASTER`         | `{"module":"product.admin","status":"ok"}` |

---

## 2. La decisión de seguridad, con la evidencia

**Las cuatro rutas son autenticadas, no públicas**, y no revelan nada más que el nombre del subpaquete y `ok`.

La configuración se leyó antes de decidir, en `src/main/kotlin/mx/evolutiondev/invitaciones/core/auth/security/SecurityConfig.kt:36-47`:

```
SecurityConfig.kt:37   /auth/**                        permitAll()
SecurityConfig.kt:38   /public/**                      permitAll()
SecurityConfig.kt:39   /error                          permitAll()
SecurityConfig.kt:40   /admin/dashboard                hasAnyRole ADMIN, MASTER, USER
SecurityConfig.kt:41   /admin/administrators/users/**  hasRole MASTER
SecurityConfig.kt:42   /admin/**                       hasAnyRole ADMIN, MASTER
SecurityConfig.kt:43   /user/**                        hasAnyRole USER, ADMIN, MASTER
SecurityConfig.kt:44   /master/**                      hasRole MASTER
SecurityConfig.kt:45   /api/whatsapp/**                hasAnyRole ADMIN, MASTER, USER
SecurityConfig.kt:46   /webhook                        permitAll()
SecurityConfig.kt:47   anyRequest()                    authenticated()
```

Consecuencias verificadas del prefijo `/product/`:

1. **No casa con ninguna regla**, así que cae en `anyRequest().authenticated()` (`SecurityConfig.kt:47`). La ruta **nace cerrada**: no hace falta tocar el núcleo, que está fuera del territorio de 5-0c. Es la misma situación en la que quedó `/editor/` en la fase 2 (`CatalogController.kt:16-20`).
2. **`/product/admin/health` NO hereda la regla de `/admin/**`** (`SecurityConfig.kt:42`): `requestMatchers("/admin/**")` casa por prefijo de ruta, y `/product/admin/health` no empieza por `/admin/`. Sin una anotación, una clienta con rol `USER` habría podido llamar a una ruta administrativa. Por eso ese controlador lleva `@PreAuthorize("hasAnyRole('ADMIN','MASTER')")`, la misma pareja de roles que el `/admin/**` del núcleo.
3. **`@PreAuthorize` de clase en los cuatro** como defensa en profundidad, posible porque `@EnableMethodSecurity` está activo (`SecurityConfig.kt:17`). Es el patrón que ADR-1R-B-10 fijó para `/editor/` y que `CatalogController.kt:22-25` implementa: si mañana alguien añadiera una regla que abriese `/product/**`, la anotación seguiría siendo la barrera. Cada prueba comprueba la anotación, porque una anotación borrada en un refactor no rompe ninguna prueba funcional.
4. **Cuerpo mudo a propósito.** Dos campos y nada más — sin versión, sin `commit`, sin estado de la base ni nombres de bean —, y hay una prueba por subpaquete que afirma que el JSON tiene **exactamente dos** claves. Una sonda que enumera dependencias es un mapa del sistema regalado a quien la consulte.
5. **Aviso escrito para E4**: el webhook de Stripe llega **sin** token de la aplicación y por tanto **no puede** colgar de `/product/payments/`, donde recibiría `401`. Los dos caminos legítimos —colgarlo de `/public/` + `**` verificando la firma `Stripe-Signature` con `producto.pagos.stripe.secreto-webhook`, o registrar una ADR para añadir una regla a `SecurityConfig`— quedan en el KDoc de `PaymentsHealthController.kt`.

---

## 3. Convenciones copiadas, con `fichero:línea`

Nada de esto se inventó: todo sale de código que ya está en el repositorio.

| Convención | De dónde | Cómo se aplicó |
|---|---|---|
| Paquete `mx.evolutiondev.invitaciones.modules.<módulo>.<subpaquete>` y escaneo automático desde `@SpringBootApplication` | `InvitationsApplication.kt:6-7` (raíz `mx.evolutiondev.invitaciones`) | `modules.product.*` se escanea sin registrar nada |
| `@RestController` + `@RequestMapping` de clase con el prefijo, `@GetMapping` con el resto de la ruta | `CatalogController.kt:22-23`, `DashboardController.kt:12-13` | `@RequestMapping("/product/account")` + `@GetMapping("/health")` |
| Tipo de retorno **directo** (no `ResponseEntity`) cuando siempre se responde `200` | `CatalogController.kt:42` (devuelve `CatalogResponse`) | `fun health(): ProductHealthResponse` |
| `@PreAuthorize` de clase como defensa en profundidad, con el KDoc que cita la línea de `SecurityConfig` | `CatalogController.kt:16-25`, `MasterTemplateRegistryController.kt:22-36` | Los cuatro controladores |
| **No** capturar errores en el controlador; excepciones tipadas y advice | `MasterTemplateRegistryController.kt:30-33`, `Templates2ExceptionHandler.kt:55` | No aplica todavía: las sondas no fallan. El advice de `templates2` está acotado con `basePackages = […templates2.api]` y **no alcanza** a `modules.product`; cuando E2–E5 necesiten errores tipados tendrán que declarar su propio advice acotado o caer en `GeneralExceptionHandler` |
| `data class` para el cuerpo de respuesta, en su propio fichero | `Templates2CatalogDtos.kt`, `MailerSendEmailStrategy.kt:20-29` | `ProductHealthResponse.kt` |
| `companion object` con las constantes del contrato | `CatalogController.kt:60-63` | `SUBPAQUETE`, `ESTADO_OK`, `MONEDA_POR_DEFECTO`, `NOMBRE_POR_DEFECTO` |
| Nombres de clase en **inglés**, comentarios y KDoc en **español de México** | Todo el repositorio (`CatalogController`, `DashboardController`, `MailerSendProperties`) | Igual |
| `@ConfigurationProperties(prefix=…)` sobre `data class` con valores por defecto + `@EnableConfigurationProperties` | `MailerSendEmailStrategy.kt:31-35` y `:40` | Las tres clases de propiedades, registradas en `ProductPropertiesConfig.kt` |
| Placeholder `${VAR:}` en `application.yml`, con comentario que explica qué significa el valor vacío | `application.yml`, bloque `templates2.assets` y `templates2.revalidate` | El bloque `producto:` |
| Pruebas de controlador con `MockMvcBuilders.standaloneSetup(...)`, sin contexto de Spring ni base de datos | `CatalogControllerTest.kt:28-32` | Las cuatro pruebas |
| Prueba que afirma el `@PreAuthorize` leyendo la anotación con `AnnotatedElementUtils` | `Templates2AnotacionesSeguridadTest.kt:24-40` | Tercer caso de cada una de las cuatro pruebas |
| Nombres de prueba en español entre acentos graves | `CatalogControllerTest.kt:35`, `:51` | Igual |

**Trampa encontrada y evitada** (queda escrita para quien venga detrás): en Kotlin los comentarios de bloque **anidan**, así que escribir `` `/product/**` `` dentro de un KDoc abre un comentario nuevo y el compilador falla con `Unclosed comment`. Por eso en todo el módulo se escribe `` `/product/` + `**` ``, que es exactamente la forma que ya usaban `CatalogController.kt:17` y `MasterTemplateRegistryController.kt:23`.

---

## 4. Variables de entorno añadidas

Bloque `producto:` **añadido al final** de `src/main/resources/application.yml` (26 líneas, cero modificaciones a lo existente: `git diff` da 26 inserciones y 0 borrados). `FRONTEND_URL` **no se toca**: ya existe como `app.frontend.url` y se reutiliza tal cual.

| Variable | Propiedad Spring | Quién la lee | ¿Obligatoria? | Qué pasa si falta |
|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | `producto.pagos.stripe.clave-secreta` | E4 (`ProductPaymentsProperties`) | Sí en producción, no en desarrollo | Vacía. `ProductPaymentsProperties.configurado` es `false` = **pagos desactivados**. E4 decide si falla al arrancar o degrada la compra; lo que **no** puede hacer es cobrar contra una clave adivinada |
| `STRIPE_WEBHOOK_SECRET` | `producto.pagos.stripe.secreto-webhook` | E4 | Sí si hay webhook | Vacío: no se puede verificar la firma `Stripe-Signature`, así que la ruta del webhook **no debe** aceptar nada |
| `STRIPE_MONEDA` | `producto.pagos.stripe.moneda` | E4 | No | Vale `MXN`. El producto vende en México (ADR-DUENO-02); es un valor de negocio, no un secreto |
| `MAIL_FROM` | `producto.correo.remitente` | E3, y E2 para los correos de invitados | Sí en producción | Vacío = **sin remitente**: no se manda correo con una dirección inventada |
| `MAIL_FROM_NOMBRE` | `producto.correo.remitente-nombre` | E3, E2 | No | Vale `Lino & Sello`. Entrecomillado en el YAML: aunque `&` a mitad de escalar no es ancla, la cadena empieza por `$` y el entrecomillado quita toda duda |
| `MAIL_RESPONDER_A` | `producto.correo.responder-a` | E3, E2 | No | Vacío: no se pone `Reply-To`. Previsto `hola@linoysello.com` (ADR-DUENO-02) |
| `CONTACTO_CORREO` | `producto.contacto.correo` | E3 | No | Vacío = **no se pinta ese contacto**. Un pie sin correo es aceptable; uno con un correo de ejemplo, no |
| `CONTACTO_WHATSAPP` | `producto.contacto.whatsapp` | E3 | No | Vacío: no se pinta el enlace `wa.me`. Es **solo click-to-chat**, sin API de WhatsApp Business (ADR-DUENO-02) |
| `SOPORTE_CORREO` | `producto.contacto.soporte` | E3 | No | Vacío: no se pinta. Previsto `soporte@linoysello.com` |

Regla común: **ningún secreto se escribe en el YAML ni se registra en un log**, y **vacío significa función desactivada**, nunca "usa el valor de siempre". Es la misma disciplina de `templates2.assets.bucket` (ADR-2-ORQ-03), suavizada en un punto: allí la ausencia impide arrancar porque el único defecto natural era el bucket de producción; aquí no hay ningún defecto peligroso, así que la aplicación arranca con pagos y correo desactivados y es cada sesión la que decide su compuerta.

---

## 5. ADR-5-0C-01

## ADR-5-0C-01 — Módulo nuevo `modules/product` con cuatro subpaquetes disjuntos, en vez de extender `modules/templates2`
- Fecha: 2026-09-09 · Estado: propuesta · Autor: 5-0c (esqueleto del módulo backend de la fase 5)
- Contexto: la fase 5 la escriben **cuatro sesiones en paralelo** (E2 invitados/RSVP/compartir, E3 cuenta/marca/legal, E4 pagos, E5 admin) sobre un backend que ya tiene un módulo nuevo (`modules/templates2`, fases 1–3) y un montón de módulos viejos. ADR-DUENO-02 levantó la prohibición sobre `auth`, `guests`, `admin` y pagos para construir el producto completo; ADR-DUENO-01 fijó que no hay migración y que el módulo antiguo se retira en la fase de cierre. La pregunta abierta era **dónde** escribe ese código nuevo. Evidencia de lo que `templates2` es hoy, leída en el árbol: sus siete subpaquetes son `api`, `catalog`, `composition`, `domain`, `migration`, `persistence` y `schema`, y su superficie HTTP está **cerrada por una prueba de inventario** — `Templates2RouteInventoryTest.kt:19-46` afirma «las 20 rutas de `03 §2`, ninguna más y ninguna menos», con el argumento explícito de que «una ruta añadida sin contrato es superficie de ataque que nadie revisó». Además, `contratos.md §4` prohíbe `require`/`check`/`error()` en **todo** el código de producción de `templates2`, y `NoRequileOrCheckArchitectureTest` lo comprueba recorriendo el árbol de fuentes del módulo. Es decir: `templates2` no es una carpeta, es un módulo con contratos y compuertas propias.
- Decisión: se crea `modules/product` con cuatro subpaquetes **disjuntos** —`account`, `guests`, `payments`, `admin`—, uno por sesión, más tres ficheros congelados en la raíz (`ProductHealthResponse.kt`, `ProductPropertiesConfig.kt`) que 5-0c entrega cerrados. Cada subpaquete estrena con un controlador de salud bajo `/product/<subpaquete>/health`, autenticado, con cuerpo mudo y una prueba que lo ejerce y afirma su `@PreAuthorize`. Las propiedades de entorno se exponen como tres `@ConfigurationProperties` tipadas para que **nadie tenga que reabrir `application.yml`**. Y se fija por escrito la regla de territorio: **`modules/user/invitations`, `modules/master/templates` y `MongoDataInitializer` siguen prohibidos para toda la fase 5; se retiran en la fase 7** (ADR-DUENO-01). Ninguna sesión de la fase 5 los lee, los edita ni depende de ellos.
- Alternativas descartadas y por qué:
  - **(a) Extender `modules/templates2` con subpaquetes nuevos.** `templates2` es el módulo de **plantillas e invitaciones-como-documento**: esquema (`schema`), composición (`composition`), catálogo y registro de paquetes (`catalog`), publicación y render público (`api`). Cuenta, invitados, pagos y administración son **otro dominio**: hablan de personas, dinero y permisos, no de documentos. Meterlos ahí obliga además a romper dos compuertas vivas: `Templates2RouteInventoryTest` tendría que pasar de 20 rutas a 20 + N y dejaría de significar «la superficie que el contrato revisó», y la prohibición de `require`/`check`/`error()` de `contratos.md §4` se extendería a código de pagos que no la ha acordado. La fase 7 quiere dejar una superficie limpia y auditable; mezclar los dos dominios en un módulo la ensucia justo antes de la limpieza.
  - **(b) Un módulo nuevo por sesión (`modules/account`, `modules/guests`, `modules/payments`, `modules/admin2`).** Da el mismo aislamiento, pero cuatro módulos hermanos sin techo común no comparten ni la configuración ni el prefijo de ruta, y `modules/admin2` junto a `modules/admin` es un nombre que nadie querrá explicar en la fase 7. Un solo módulo con cuatro subpaquetes da el mismo aislamiento **y** un sitio natural para lo compartido.
  - **(c) Repartir el código nuevo por los módulos viejos** (`modules/user/invitations` para invitados, `modules/admin` para administración). Choca de frente con ADR-DUENO-01: esos módulos se retiran; todo lo que se escriba ahí hay que volver a mudarlo o se pierde. Y `modules/user/invitations`, `modules/master/templates` y `MongoDataInitializer` están prohibidos por decisión del dueño.
  - **(d) Sin subpaquetes: `modules/product` plano.** Cuatro sesiones en paralelo sobre un mismo paquete es conflicto de fusión garantizado en cada fichero de configuración, de rutas y de pruebas. Los subpaquetes disjuntos son precisamente el mecanismo que hace que las cuatro puedan escribir a la vez.
  - **(e) Rutas de salud públicas.** Se descartó: aunque el cuerpo sea mudo, una ruta pública confirma qué módulos existen y a quién puede escanearlos le sirve. `anyRequest().authenticated()` (`SecurityConfig.kt:47`) ya las cierra sin tocar el núcleo, así que abrirlas habría sido trabajo extra para tener menos.
- Consecuencias:
  - Cada sesión tiene un territorio con frontera comprobable: `git diff --stat` debe caer entero dentro de su subpaquete. Los tres ficheros de la raíz están congelados y, si alguien necesita registrar una clase de propiedades nueva, es un cambio de una línea en `ProductPropertiesConfig.kt` que hay que anunciar al orquestador.
  - El `@RestControllerAdvice` de `templates2` está acotado con `basePackages = ["…modules.templates2.api"]` (`Templates2ExceptionHandler.kt:55`) y **no alcanza** a `modules.product`: hoy los errores del módulo nuevo saldrían por `GeneralExceptionHandler`, sin `code` tipado. Quien necesite errores tipados en la fase 5 tendrá que declarar su propio advice acotado a su subpaquete, y eso merece su propia ADR.
  - `templates2` conserva intactas sus dos compuertas (inventario de 20 rutas y prohibición de `require`/`check`), porque el código nuevo no entra en su árbol.
  - La retirada de la fase 7 queda acotada: `modules/user/invitations`, `modules/master/templates`, `modules/master/*`, `MongoDataInitializer` y `modules/admin` se borran sin que nada de `modules/product` ni de `modules/templates2` dependa de ellos. Verificable por búsqueda: ningún fichero de `modules/product` los importa.
  - Coste asumido: durante la fase 5 conviven un módulo administrativo viejo (`modules/admin`) y uno nuevo (`modules/product/admin`). Se mitiga con el nombre `ProductAdminHealthController` y con esta ADR; se resuelve en la fase 7.
