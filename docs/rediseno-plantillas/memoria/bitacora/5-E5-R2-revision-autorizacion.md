# 5-E5-R2 — Revisión adversarial de autorización (escalada de rol e IDOR, ruta por ruta)

- Sesión: **E5** (panel de administración), fase 5 · rama `claude/fase-5-admin-vq1fjm`
- Agente: **E5-R2**, revisor adversarial Opus de autorización. Compuerta de cierre.
- Fecha: 2026-09-10 · Backend real en `http://127.0.0.1:6003`, Postgres efímero de
  `scripts/dev-backend.sh`
- Alcance revisado: `modules/product/admin/**` (7 ficheros) y sus 6 pruebas; el endurecimiento de
  **S-03** en `modules/admin/invitations/service/InvitationAdminService.kt:121-124` y su
  **ADR-5-E5-01**; `frontend/apps/web/lib/admin/cliente.ts` en lo que toca a autorización y sesión.
- Método: **no se revisó leyendo**. Cada celda de la tabla, cada intento de IDOR y cada 400/500 de
  este documento salieron de un `curl` contra el backend real, con las cuentas sembradas por
  `scripts/seed/admin.sh` más un segundo ADMIN con jerarquía cruzada que ya existía en la base.

---

## Veredicto

> ## ACEPTADO CON CORRECCIONES

**El corazón del encargo está bien.** No conseguí ni una escalada de rol ni una sola fila ajena, en
ningún filtro, en ninguna página y en ninguna de las siete lecturas. El alcance por rol está **dentro
del `WHERE`** —lo comprobé donde se cae si no lo está: `total` y `pagina=1&tamano=1`—, los contadores
de `planes`, `plantillas` y `metricas` van acotados igual que el listado, y S-03 está de verdad
cerrado (403 medido para ADMIN ajeno, 200 para ADMIN dueño y para MASTER). No hay inyección SQL: todo
parámetro viaja vinculado.

**Hay una ALTA que bloquea el cierre**, y no es de alcance sino de superficie de error: un
`pagina` grande desborda el entero al calcular el desplazamiento y las tres rutas paginadas responden
**500 con 20 901 bytes de traza**, incluyendo el `SELECT` completo con nombres de tabla, de columna y
el propio predicado de alcance. Es exactamente el oráculo que **S-02** describe, y viola la regla dura
del contrato («un parámetro fuera de rango es 400 con cuerpo, nunca un 500»), que la bitácora
`5-E5-A.md §3.5` da por cumplida sin haber probado el extremo.

---

## 1. La tabla ruta × rol, medida por mí

`curl -i` contra `http://127.0.0.1:6003`, cuatro identidades reales con JWT emitido por
`POST /auth/token` (no `MockMvc`, no `principal()`):

| Ruta | anónimo | USER | ADMIN | MASTER |
|---|---|---|---|---|
| `GET /product/admin/metricas` | **401** | **403** | **200** | **200** |
| `GET /product/admin/clientas` | **401** | **403** | **200** | **200** |
| `GET /product/admin/invitaciones` | **401** | **403** | **200** | **200** |
| `GET /product/admin/pagos` | **401** | **403** | **200** | **200** |
| `GET /product/admin/planes` | **401** | **403** | **200** | **200** |
| `GET /product/admin/plantillas` | **401** | **403** | **200** | **200** |
| `GET /product/admin/health` (7.ª del subpaquete) | **401** | **403** | **200** | **200** |
| `PUT /admin/invitations/{id}/mark-as-paid` | **401** | **403** | **403** ajena / **200** propia | **200** |
| `PUT /admin/invitations/{id}/toggle-status` | **401** | **403** | **403** ajena / **200** propia | **200** |

```
RUTA                             | ANON | USER | ADMIN | MASTER
/product/admin/metricas          | 401  | 403  | 200   | 200
/product/admin/clientas          | 401  | 403  | 200   | 200
/product/admin/invitaciones      | 401  | 403  | 200   | 200
/product/admin/pagos             | 401  | 403  | 200   | 200
/product/admin/planes            | 401  | 403  | 200   | 200
/product/admin/plantillas        | 401  | 403  | 200   | 200
/product/admin/health            | 401  | 403  | 200   | 200
```

Cuerpos: el `401` es `{"errors":{"url":"Full authentication is required to access this resource"}}`
(`AuthEntryPointJwt`); el `403`, `{"errors":{"url":"Access Denied"}}`
(`InvitationsAccessDeniedHandler`). Coinciden con lo que `ProductAdminConsolaController.kt:28-30`
afirma.

### 1.1 Ninguna ruta nueva se escapa de la anotación

`git diff cfac3b2..HEAD -- src/main` filtrado por anotaciones de mapeo devuelve **exactamente** esto:

```
@RequestMapping("/product/admin")
@PreAuthorize("hasAnyRole('ADMIN','MASTER')")
    @GetMapping("/metricas") /clientas /invitaciones /pagos /planes /plantillas
```

Seis `@GetMapping` en una sola clase, la clase lleva la anotación, y `grep` de
`@PostMapping|@PutMapping|@DeleteMapping|@PatchMapping` sobre **todo** `modules/product/` no devuelve
nada. **La sesión no deja ninguna escritura nueva**, ni por descuido ni a propósito: el contrato dice
que todo es lectura y así es.

No hay clase hermana sin anotación: las dos clases del subpaquete
(`ProductAdminConsolaController.kt:42` y `ProductAdminHealthController.kt:27`) llevan la misma. Y la
observación de `12-producto-completo.md §0` es correcta y sigue viva: `/product/**` no casa con
ninguna regla de prefijo de `SecurityConfig.kt:37-46` y solo heredaría `authenticated()` (`:47`) —lo
comprobé al revés, quitando mentalmente la anotación no: comprobándolo con el 403 del USER, que solo
puede venir del `@PreAuthorize`, porque la cadena de prefijos habría dejado pasar a cualquiera
autenticado.

### 1.2 Intentos de elusión de ruta (todos fallidos)

| Camino | anónimo | USER |
|---|---|---|
| `//product/admin/metricas` | 400 | 400 |
| `/product/admin//metricas` | 400 | — |
| `/PRODUCT/ADMIN/METRICAS` | 401 | — |
| `/product/admin/metricas/` | 401 | 404 |
| `/product/admin/metricas;x=1` | 400 | 400 |
| `/product/./admin/metricas` | 401 | — |
| `/product/admin/%6detricas` | 401 | **403** |
| `/x/../product/admin/metricas` | 401 | — |

Ni un `200`. El caso interesante es `%6detricas`: Spring normaliza y **la anotación sigue
aplicando** (403 al USER), que es la propiedad que importa.

---

## 2. Revocabilidad: el rol se resuelve por fila en cada petición

`JwtTokenFilter.kt:47-68` relee la fila de `customer` en cada petición y construye la autoridad desde
`customer.role`. Lo comprobé cambiando la base **en caliente** con el mismo token en la mano:

| Cambio por SQL (token sin reemitir) | Respuesta a `GET /product/admin/metricas` |
|---|---|
| ADMIN(23) tal cual | **200** |
| `UPDATE customer SET is_enabled=false WHERE id=23` | **401** `{"errors":{"url":"El usuario asociado al token no existe"}}` (`JwtTokenFilter.kt:54-57`) |
| rehabilitado | **200** |
| `UPDATE customer SET is_banned=true WHERE id=23` | **403** `{"error":"Su cuenta ha sido bloqueada…","type":"USER_BANNED"}` (`:58-61`) |
| desbaneado | **200** |
| USER(24) promovido a `ADMIN`, **token viejo de USER** | **200**, y con el alcance del nuevo rol: `{"clientas":1,…}` |
| degradado de vuelta a `USER` | **403** |
| ADMIN(23) degradado a `USER`, **token viejo de ADMIN** | **403** |
| restaurado a `ADMIN` | **200** |

**Propiedad real, y hay que dejarla escrita porque es la que hace revocable la consola: el rol y la
habilitación son de la fila, no del token.** Degradar o deshabilitar a alguien surte efecto en la
petición siguiente sin esperar a que caduque el JWT (1 h, `application.yml:11`). El precio simétrico
es que **promover también es inmediato**: un token emitido cuando la cuenta era USER sirve como ADMIN
en cuanto la fila cambia. Es coherente y es lo correcto, pero conviene que el dueño lo sepa.

Estado de las filas 19/20/23/24 **restaurado** al terminar (`role`, `is_enabled`, `is_banned`).

---

## 3. IDOR y fuga por alcance — los intentos, uno por uno

Escenario. `scripts/seed/admin.sh` deja: MASTER(22), ADMIN(23), clienta propia 24 con invitación 7,
clienta ajena 25 con invitación 8. La base ya tenía además un **segundo ADMIN(19)** con su clienta 20
y su invitación 5, así que pude probar **jerarquías cruzadas de verdad** (ADMIN contra ADMIN), no solo
«ADMIN contra huérfano».

| # | Intento | Con qué | Resultado | ¿Rompe? |
|---|---|---|---|---|
| 1 | Listar clientas ajenas | ADMIN(23) `GET /clientas` | `total:2` → solo él (23) y su clienta (24). MASTER ve `total:22` | **no** |
| 2 | Listar invitaciones ajenas | ADMIN(23) `GET /invitaciones` | `total:1` → solo la 7. MASTER ve `total:8` | **no** |
| 3 | Contadores que delatan el sistema | ADMIN(23) `GET /metricas` | `{"clientas":2,"invitaciones":1,…}` frente a `{"clientas":22,"invitaciones":8,…}` del MASTER | **no** |
| 4 | Cruce ADMIN↔ADMIN | ADMIN(19) `GET /clientas` y `GET /invitaciones` | ve **solo** 19, 20 y la invitación 5; ni rastro de 23/24/7 | **no** |
| 5 | **Oráculo por `buscar`**: correo exacto de una clienta ajena | ADMIN(23) `buscar=cliente-ajeno-…@example.com` | `{"total":0,"elementos":[]}` — **idéntico** a `buscar=noexiste-zzz@example.com`. MASTER con el mismo término devuelve la fila | **no** |
| 6 | Oráculo cruzado en las dos direcciones | ADMIN(19) busca a la clienta de ADMIN(23) y viceversa | `total:0` en ambos sentidos | **no** |
| 7 | **`total` mentiroso / filtrado en memoria** | ADMIN(23) `clientas?tamano=1&pagina=0,1,2,3` | `total:2` constante; pág. 0 → id 24, pág. 1 → id 23, págs. 2 y 3 → `[]`. Nunca aparece una fila ajena ni una página corta | **no** |
| 8 | Ídem en invitaciones y pagos | `tamano=1` páginas 0..2 | `total:1`, una fila propia y luego vacío | **no** |
| 9 | Paginación profunda | `clientas?pagina=999999999&tamano=100` | `200` con `elementos:[]` y `total:2` | **no** |
| 10 | **`enlacePublico` de invitación no publicada** | monté `tpl_document` con `public_token` en la inv. 7 (propia) **y un `tpl_release` con `is_active=false`** | `enlacePublico: null`. El `CASE` de `ConsultasDeAdministracion.kt:285` lo mata en SQL: el token no sale de la base | **no** |
| 11 | **`enlacePublico` ajeno por combinación de filtros** | publiqué de verdad las invs. 5 y 8 (ajenas al ADMIN 23) y recorrí con ADMIN(23) las 13 combinaciones: sin filtro, `estado=` ×3, `pago=` ×2, `plan=` ×2, `tamano=100`, `tamano=1&pagina=0/1`, `buscar=pub_`, `buscar=boda` | ni un token en ninguna. `grep 'pub_'` sobre las **seis** respuestas del ADMIN: vacío. MASTER sí ve `pub_BBB…` y `pub_CCC…` | **no** |
| 12 | Contadores de `plantillas` como canal lateral | tres `tpl_document` (invs. 5, 7 y 8) sobre la misma versión | ADMIN(23) → `invitaciones:1`; ADMIN(19) → `invitaciones:1`; MASTER → `invitaciones:3`. El alcance va dentro de la subconsulta correlacionada (`:434`) | **no** |
| 13 | Contadores de `planes` | los mismos tokens | ADMIN → `Premium: 1`; MASTER → `Premium: 8` (`:398`) | **no** |
| 14 | `metricas.publicadas` como canal lateral | inv. 5 publicada (de ADMIN 19), inv. 7 no | ADMIN(19) → `publicadas:1`; ADMIN(23) → `publicadas:0`; MASTER → `2` | **no** |
| 15 | Filtro evaluado antes del predicado de rol | `plan=2` (existe) contra `plan=999` (no existe) | `plan` se valida contra el **catálogo del sistema**, sin alcance, y a propósito: `planExiste` (`:253`) mira `invitation_plan`, que `GET /public/invitations/plan` ya publica **sin autenticar**. No es oráculo de datos de nadie | **no** |
| 16 | Fugas de campos sensibles (S-13, contraseñas, secretos) | las 6 rutas con MASTER (superficie máxima), buscando `password/hash/token/secret/confirmationToken/cancellationToken/phone/createdBy/isBanned` | **ninguna coincidencia.** Las claves devueltas son exactamente las del contrato | **no** |

**Conclusión de la sección: el predicado `(:todo = 1 OR c.id = :yo OR c.created_by = :yo)`
(`AlcanceDeAdministracion.kt:46`) está en el `WHERE` de las siete consultas, en las de recuento
además de en las de listado, y no encontré forma de sacarle una fila, un contador ni un token ajeno.**

---

## 4. S-03 y la superficie de escritura

`mark-as-paid` y `toggle-status`, medidos con `curl -X PUT` contra el backend real:

| Caso | `mark-as-paid` | `toggle-status` |
|---|---|---|
| anónimo | **401** | **401** |
| USER(24), **dueña** de la invitación 7 | **403** `Access Denied` | **403** |
| ADMIN(19) sobre la inv. 7 (de la jerarquía de ADMIN 23) | **403** `{"access":"No tienes permisos para modificar esta invitación"}` | **403** |
| ADMIN(23) sobre la inv. 8 (clienta huérfana) | **403** | **403** |
| ADMIN(23) sobre la inv. 5 (de la jerarquía de ADMIN 19) | **403** | **403** |
| ADMIN(23) sobre la inv. 7 (**suya**) | **200** `is_paid` pasó a `t` en la base | **200** |
| MASTER sobre la inv. 8 (ajena a todos) | **200** | **200** |

- **S-03 está cerrado de verdad.** `InvitationAdminService.kt:121-124` llama a
  `hierarchyValidationService.validateInvitationAccess(updatedBy, id)` como primera sentencia, y el
  403 llega. MASTER sigue pudiendo todo, que es lo que ADR-5-E5-01 promete.
- **`toggle-status` sí comprueba jerarquía.** La afirmación del otro agente es correcta en el fondo
  y **equivocada en la línea**: la llamada está en `InvitationAdminService.kt:479-481`, no en
  `:461-463`. Verificado con `curl`, no leyendo (ver objeción BAJA-1 por las citas).
- **No hay vuelta por otra ruta del mismo servicio.** Repasé las cinco escrituras de
  `InvitationController.kt`: `PUT /{id}` (`updateInvitation`) valida jerarquía en
  `InvitationAdminService.kt:412`, y su cuerpo (`CreateInvitationRequest`) **no tiene campo
  `isPaid`**, así que no se puede pagar por ahí; `POST /create` exige `targetUser.createdBy ==
  creatorId` para un ADMIN. Los listados `GET /all` y `GET /unpaid` ya venían acotados: medido,
  ADMIN(23) ve `[7]` y `[7]` mientras el MASTER ve `[8,7,6,5,4,3,2,1]` y `[8,7,6,5,4,3,2]`.
- **Sin oráculo de existencia** (lo que ADR-5-E5-01 afirma): `mark-as-paid` con `id=8` (ajena),
  `id=999999` (inexistente) e `id=-1` responden **el mismo 403 con el mismo cuerpo**. También para el
  MASTER, que sobre un id inexistente recibe 403 en vez de 400 — coherente y no delata nada.

---

## 5. Inyección y parámetros

### 5.1 SQL nativo: todo vinculado

Revisé las siete consultas de `ConsultasDeAdministracion.kt`. Lo único que se **interpola** son
constantes de compilación del propio fichero —`PREDICADO` (`AlcanceDeAdministracion.kt:46`),
`filtroDeClienta` (`:113`), `desdeInvitacion` (`:185`), `filtroDeInvitacion` (`:212`), `filtroDePago`
(`:327`)—, ninguna de las cuales contiene nada que venga del cliente. Todo lo del cliente va por
`setParameter`: `patron`, `estado`, `pago`, `plan`, `tamano`, `desplazamiento`, `todo`, `yo`. **No
hay orden, dirección, nombre de columna ni `LIMIT` construidos con texto de la petición** — el `ORDER
BY` es fijo en las tres consultas paginadas. La traza del 500 de la sección 6 lo confirma desde fuera:
el SQL que llega al driver tiene `?` en cada punto variable, `LIMIT ? OFFSET ?` incluido.

Intentos por `buscar`, todos `200` y todos inofensivos:

```
buscar='                              200  {"total":0,…}
buscar=' OR '1'='1                    200  {"total":0,…}
buscar=%' OR 1=1 --                   200  {"total":0,…}
buscar=a%'; DROP TABLE customer; --   200  {"total":0,…}
buscar=\                              200  {"total":0,…}
buscar=ñÑ                             200  {"total":0,…}
buscar=<4000 caracteres>              200
SELECT count(*) FROM customer;        22   ← la tabla sigue ahí
```

También probé contaminación de parámetros (`estado=publicada&estado=zzz` → **400**;
`tamano=101&tamano=1` → **400**; `tamano=1&tamano=101` → **200 con `tamano:1`**): Spring vincula el
primer valor y la validación se aplica al valor vinculado. Sin bypass.

### 5.2 Parámetros: los 400 honestos que la bitácora promete

Confirmados uno a uno, todos con cuerpo `{"statusCode":400,"errors":{"error":"…"}}`:
`pagina=-1`, `tamano=0`, `tamano=101`, `tamano=abc`, `tamano=999999999999999999999`,
`estado=x`, `estado=publicada'`, `pago=x`, `plan=abc`, `plan=999`, `plan=0`, `plan=-1`,
`pagos?estado=xxx`. Y `pagos?estado=devuelto` → `200` con página vacía, como manda el contrato §5.
Ningún mensaje dice nada del estado de la base: son parámetros de quien llama. Bien resuelto.

**Salvo uno**, que es la objeción ALTA.

---

## 6. Objeciones

### ALTA-1 · `pagina * tamano` desborda el entero: 500 con 20 KB de traza y el SQL entero

**Ficheros y líneas.** `ConsolaDeAdministracionService.kt:39` (`clientas`), `:77` (`invitaciones`) y
`FuenteDePagosDeAdministracion.kt:70` (`pagos`) calculan el desplazamiento como `p * t` con **dos
`Int`**. `ParametrosDeAdministracion.pagina` (`:46-49`) solo exige `valor >= 0`, así que `pagina`
admite hasta `2147483647`; multiplicado por cualquier `tamano ≥ 2` el producto desborda y sale
negativo. PostgreSQL rechaza el `OFFSET` negativo y la excepción sube sin traducir.

**Medido.** Umbral exacto con `tamano=100`:

```
/product/admin/clientas?pagina=21474836&tamano=100   200
/product/admin/clientas?pagina=21474837&tamano=100   500   ← 21474837*100 desborda
```

Las **tres** rutas paginadas caen igual:

```
/product/admin/clientas?pagina=2147483647&tamano=2      500
/product/admin/invitaciones?pagina=2147483647&tamano=2  500
/product/admin/pagos?pagina=2147483647&tamano=2         500
```

**Lo que devuelve.** `HTTP 500  bytes=20901`, con las claves
`['timestamp','status','error','trace','message','path']`:

```
message = "JDBC exception executing SQL [            SELECT c.id, c.name, c.lastname, c.email, c.role, c.is_enabled,
                   (SELECT count(*) FROM invitation i WHERE i.customer_id = c.id),
                   c.created_at
              FROM customer c
             WHERE (? = 1 OR c.id = ? OR c.created_by = ?)
AND (lower(coalesce(c.name, '') || ' ' || coalesce(c.lastname, '')) LIKE ?
     OR lower(c.email) LIKE ?)
             ORDER BY c.created_at DESC, c.id DESC
             LIMIT ? OFFSET ?] [ERROR: OFFSET must not be negative]"
trace   = org.springframework.dao.DataIntegrityViolationException: … (≈20 KB de pila)
```

**Por qué es ALTA y no MEDIA.** No es escalada de rol ni IDOR —hace falta ser ADMIN o MASTER—, y lo
digo con todas las letras. Es ALTA por otras tres razones, todas del encargo de esta sesión:

1. **Viola la regla dura del contrato**, la que `ParametrosDeAdministracion.kt:5-9` escribe como
   propósito del fichero: «un `pagina` negativo, un `tamano` fuera de `[1,100]` … responden **400 con
   cuerpo de error**». Aquí el parámetro está fuera del rango utilizable y responde 500.
2. **Es el oráculo de S-02 servido en bandeja**, desde una ruta que esta sesión acaba de escribir:
   `include-message: always` (`application.yml:6`) publica el `SELECT` completo con la tabla, las
   columnas, el `ORDER BY` y **el predicado de alcance**, más la pila de Spring/Hibernate con sus
   versiones. S-02 estaba catalogado como MEDIA para el backend heredado; código nuevo no debería
   añadirle superficie.
3. **La bitácora lo da por cubierto sin haberlo probado.** `5-E5-A.md §3.5` se titula «400 con
   cuerpo — nada se ignora en silencio» y lista seis casos; ninguno es el extremo del rango. La
   prueba `ProductAdminConsolaControllerTest.kt:294-308` tiene la misma laguna. Una compuerta de
   autorización que acepte esto deja pasar un 500 documentado como imposible.

**Arreglo concreto.** En `ParametrosDeAdministracion`, calcular y validar el desplazamiento en un
solo sitio, en `Long`, y que sea el servicio quien lo use:

```kotlin
/** Desplazamiento de la página, en Long: `pagina * tamano` en Int desborda y da un OFFSET negativo. */
fun desplazamiento(pagina: Int, tamano: Int): Int {
    val offset = pagina.toLong() * tamano.toLong()
    require(offset <= Int.MAX_VALUE) {
        "El parámetro 'pagina' es demasiado grande para el tamaño de página pedido; se recibió $pagina"
    }
    return offset.toInt()
}
```

y sustituir las tres apariciones de `p * t` (`ConsolaDeAdministracionService.kt:39`, `:77`,
`FuenteDePagosDeAdministracion.kt:70`) por `ParametrosDeAdministracion.desplazamiento(p, t)`.
Añadir a la lista de `ProductAdminConsolaControllerTest.kt:294` los tres casos
`clientas|invitaciones|pagos?pagina=2147483647&tamano=100` esperando **400**. Alternativa igual de
válida y más barata de razonar: acotar `pagina` a un máximo explícito del contrato (p. ej.
`0..1_000_000`) en `pagina()`; lo importante es que el 500 desaparezca y quede una prueba que lo
sujete.

*(Nota para el dueño, fuera del alcance de esta sesión: independientemente del arreglo, el perfil de
producción debería llevar `server.error.include-message: never` y `include-stacktrace: never`. Es el
arreglo que S-02 ya pedía y que ninguna sesión ha tomado todavía.)*

---

### MEDIA-1 · El cliente web confunde «403 no tienes permiso» con «tu sesión caducó» y tira el token

**Fichero y líneas.** `frontend/apps/web/lib/admin/cliente.ts:113-116`:

```ts
if (respuesta.status === 401 || respuesta.status === 403) {
  marcarSesionCaducada();
  throw new SessionError(respuesta.status, textoCrudo);
}
```

`marcarSesionCaducada()` (`frontend/apps/web/lib/api-client.ts:94-100`) llama a `clearAuthToken()`.

**El problema.** Ese mismo camino atiende `alternarEstadoInvitacion`
(`cliente.ts:162-164` → `PUT /admin/invitations/{id}/toggle-status`), cuya negativa de **autorización**
es precisamente un **403** con `{"errors":{"access":"No tienes permisos para modificar esta
invitación"}}` —lo acabo de medir en la sección 4—. Es decir: la respuesta que el endurecimiento de
S-03 y la comprobación de jerarquía producen cuando alguien toca una invitación que no le
corresponde **cierra la sesión de un administrador cuyo token es perfectamente válido**, y la consola
lo manda a `/acceso` diciéndole que caducó. Ni caducó, ni el token estaba mal: es que esa fila no era
suya. El 403 de autorización y el 401 de autenticación cuentan historias distintas y aquí se
funden en una.

En la práctica el listado ya viene acotado, así que el administrador no debería ver una fila
intocable; pero basta una carrera (la clienta cambia de `created_by`, la invitación se mueve, dos
pestañas abiertas) para expulsar a alguien de la consola sin motivo. Y como efecto de segundo orden,
esconde el hallazgo: quien pruebe un IDOR desde la interfaz verá «sesión caducada» en vez de
«prohibido», que es justo la señal que un panel de administración debe dejar ver.

**Arreglo concreto.** Separar los dos casos en `peticionAdmin`:

```ts
if (respuesta.status === 401) {
  marcarSesionCaducada();
  throw new SessionError(401, textoCrudo);
}
if (respuesta.status === 403) {
  // 403 = autorización denegada con sesión válida (jerarquía, rol). NO se toca el token.
  throw new UnknownApiError(403, textoCrudo);   // o un `ForbiddenError` propio en ./errors.ts
}
```

Matiz que conviene conservar: un **403 de las seis rutas de lectura** sí puede significar «te
degradaron a USER» y ahí cerrar la sesión es razonable. Si se quiere afinar, distínganse por cuerpo
—el `{"errors":{"access":…}}` del servicio heredado frente al `{"errors":{"url":"Access Denied"}}` de
la cadena de filtros— o, más simple y más honesto, trátense todos los 403 como «prohibido» y déjese
que la propia pantalla decida si conviene reautenticar. Hay que ajustar también
`frontend/apps/web/lib/admin/cliente.test.ts`, que hoy fija el comportamiento actual.

---

### BAJA-1 · Dos citas de línea equivocadas apuntan a la comprobación de jerarquía de `toggle-status`

- `ProductAdminConsolaController.kt:17` dice «ya comprueba jerarquía en el servicio
  (`InvitationAdminService.kt:461-463`)».
- `frontend/apps/web/lib/admin/cliente.ts:155` dice «`InvitationAdminService.kt:461` llama
  `hierarchyValidationService.validateInvitationAccess`».

La llamada de `toggleInvitationStatus` está en **`:479-481`**; `:461-463` cae dentro de
`getInvitationById`. ADR-5-E5-01 (`decisiones.md:2048`) **sí** cita bien `:479-481` y `:464-466`, con
lo que el documento de decisión y los dos comentarios se contradicen. Es documentación, no
comportamiento —el 403 llega igual—, pero una cita que apunta al método vecino es exactamente lo que
hace que el siguiente revisor «verifique» la función equivocada. **Arreglo**: corregir las dos citas
a `:479-481`.

*(La cita de `cliente.ts:153` — «verificado leyendo el fuente, sin backend levantado» — ya no hace
falta: este documento lo verifica con `curl`.)*

### BAJA-2 · `buscar` no escapa `%`, `_` ni `\` antes de construir el `LIKE`

`ParametrosDeAdministracion.patron` (`:100`) hace `"%" + buscar.trim().lowercase() + "%"` sin escapar
los comodines. Medido: `buscar=%` y `buscar=_` se comportan como comodines y devuelven todo **el
alcance de quien pregunta** (`total:2` para el ADMIN, no 22). **No es una fuga** —el predicado de rol
sigue en el `AND`— y no es inyección; es semántica de búsqueda: un correo que contenga `_` no se
puede buscar literalmente. **Arreglo** (opcional, cosmético): `ESCAPE '\'` en las tres cláusulas
`LIKE` y un `replace` de `\`, `%` y `_` en `patron()`.

### BAJA-3 · La matriz automatizada no cubre las identidades que solo existen en vivo

`MatrizRutaRolProductAdminTest` es una buena prueba —levanta una cadena de seguridad real con los
beans de producción `AuthEntryPointJwt` e `InvitationsAccessDeniedHandler`, y prueba que la anotación
**surte efecto**, no que esté escrita—, pero cubre 6 rutas × 4 identidades y **deja fuera**:

- `/product/admin/health`, la séptima ruta del subpaquete (la cubre
  `ProductAdminHealthControllerTest`, pero solo con la anotación, no con la cadena).
- Las identidades **deshabilitada** y **baneada**, que no existen en esa prueba porque no reproduce
  `JwtTokenFilter`. La decisión está justificada en su KDoc (`:58-60`) y la acepto; queda medido en
  vivo en la sección 2 de este documento, y ese es el sitio donde vive esa garantía hoy.

**Arreglo mínimo**: añadir `/product/admin/health` a `RUTAS` (4 celdas más) y, si se quiere cerrar la
otra mitad, una prueba de `JwtTokenFilter` con una fila deshabilitada. No bloquea.

### BAJA-4 · Una invitación **deshabilitada pero publicada** sigue devolviendo su `enlacePublico`

Medido: con la invitación 5 en `is_enabled=false` y un `tpl_release` activo, su propio administrador
recibe `(5, 'deshabilitada', 'pub_CCC…')`. Dentro del alcance —un ADMIN ajeno sigue viendo `total:0`,
así que **no es IDOR**—, pero el contrato dice que `enlacePublico` sale «solo cuando hay release
activo» y no se pronuncia sobre qué pasa cuando la invitación está deshabilitada. Si deshabilitar
también apaga el enlace público de cara al invitado, la consola está enseñando un enlace muerto; si
no lo apaga, está bien así. **Arreglo**: no tocar código todavía; anotarlo en `preguntas-abiertas.md`
para el dueño, junto con la aproximación ya declarada de `rsvpUltimos7Dias`.

---

## 7. Pruebas Kotlin — corrida propia

```
$ ./gradlew test --tests '*product*' --tests '*Admin*'
BUILD SUCCESSFUL in 39s
(nunca `./gradlew clean`)

AccountHealthControllerTest                   tests=  3 fallos=0 errores=0 omit=0
ConsultasDeAdministracionIntegrationTest      tests= 11 fallos=0 errores=0 omit=0
EndurecimientoMarkAsPaidS03Test               tests=  3 fallos=0 errores=0 omit=0
MatrizRutaRolProductAdminTest                 tests= 24 fallos=0 errores=0 omit=0
ProductAdminConsolaControllerTest             tests= 17 fallos=0 errores=0 omit=0
ProductAdminHealthControllerTest              tests=  3 fallos=0 errores=0 omit=0
GuestsHealthControllerTest                    tests=  3 fallos=0 errores=0 omit=0
PaymentsHealthControllerTest                  tests=  3 fallos=0 errores=0 omit=0
TOTAL tests=67 fallos=0 errores=0 omitidos=0
```

**Coinciden exactamente con lo que la bitácora `5-E5-A.md §4` declara (67/67).** La cifra es verdad.

¿Prueban lo que dicen? Sí, con dos matices ya recogidos arriba:

- `ConsultasDeAdministracionIntegrationTest` **sí es una prueba de IDOR de verdad**: contra
  PostgreSQL real, siembra el par «clienta propia / clienta ajena» y comprueba el caso ajeno en las
  **tres** superficies que hacen falta —listado, contador y `metricas`— más los recuentos de `planes`
  y `plantillas` (`:137-181`). No compara contra cifras absolutas del sistema, que sería frágil, sino
  contra el alcance sembrado. Es la prueba que había que escribir.
- `MatrizRutaRolProductAdminTest` mide efecto, no presencia de anotación. Laguna en BAJA-3.
- `ProductAdminConsolaControllerTest:294-308` cubre seis casos de 400 y **ninguno del extremo del
  rango**: es la laguna que deja pasar ALTA-1.

---

## 8. Lo que intenté y **no** rompí

Para que la sesión de integración no lo repita. Todo lo de esta lista se probó contra el backend
real y **aguantó**:

1. Las 7 rutas del subpaquete con anónimo, USER, ADMIN y MASTER. Sin sorpresas: 401/403/200/200.
2. Ocho variantes de camino (doble barra, mayúsculas, barra final, `;x=1`, `%6d`, `./`, `../`) como
   anónimo y como USER. Ni un 200.
3. Token de cuenta **deshabilitada** (401), **baneada** (403) y **degradada en caliente** (403). La
   revocación es inmediata porque el rol se relee de la fila en cada petición.
4. Alcance ADMIN↔ADMIN con jerarquías cruzadas reales, no solo «ADMIN contra huérfano»: ningún
   administrador ve nada del otro, en ninguna de las seis lecturas.
5. `total` y paginación con `tamano=1` recorriendo hasta pasar el final, en `clientas`,
   `invitaciones` y `pagos`: `total` coherente, sin páginas cortas, sin filas ajenas. **No se filtra
   en memoria.**
6. Oráculo por diferencia con `buscar=<correo de una clienta ajena>` frente a `buscar=<correo
   inventado>`: **respuestas idénticas** (`total:0`), en las dos direcciones del cruce ADMIN↔ADMIN.
7. Filtros `estado`, `pago` y `plan` como canal lateral: todos van dentro del mismo `WHERE` que el
   predicado de rol; `plan` se valida contra un catálogo que ya es público sin autenticar.
8. `enlacePublico`: no publicada → `null`; con release **inactivo** → `null`; publicada **ajena** →
   invisible en las 13 combinaciones de filtro y página que probé. `grep 'pub_'` sobre las seis
   respuestas del ADMIN: vacío.
9. Contadores de uso de `plantillas`, `planes` y `metricas.publicadas` como canal lateral para
   inferir el volumen de otros: acotados, verificados con tres identidades.
10. Barrido de campos sensibles en las seis respuestas con MASTER: sin `password`, sin
    `confirmationToken`/`cancellationToken` (S-13 no toca esta superficie), sin secretos, sin
    teléfonos, sin correos de más.
11. Inyección SQL por `buscar` (comilla, `%`, `_`, `\`, `--`, `DROP TABLE`, 4000 caracteres), por
    `estado`, por `pago`, por `plan` y por la paginación. Nada. `customer` sigue con sus 22 filas.
12. Contaminación de parámetros duplicados en `estado` y `tamano`: se vincula el primero y la
    validación se aplica igual.
13. `mark-as-paid` y `toggle-status` con ADMIN ajeno (dos jerarquías distintas), ADMIN dueño, USER
    dueño de la invitación, MASTER y anónimo. La matriz sale entera.
14. Vuelta por otra ruta del mismo servicio para pagar sin permiso: `PUT /{id}` valida jerarquía y
    su cuerpo no tiene `isPaid`; `POST /create` exige que la clienta sea del propio ADMIN.
15. Oráculo de existencia en `mark-as-paid`: id ajeno, id inexistente e id negativo devuelven el
    mismo 403 con el mismo cuerpo.
16. `grep` de `@PostMapping|@PutMapping|@DeleteMapping|@PatchMapping` sobre todo `modules/product/`:
    **cero**. La sesión no deja ninguna escritura nueva.

---

## 9. Estado del entorno

**Devuelto como lo encontré.** Lo que toqué y cómo lo deshice:

- `scripts/seed/admin.sh` (una corrida): dejó las cuentas 22-25 y las invitaciones 7 y 8. **Se
  quedan**: es lo que el script existe para hacer, es aditivo por diseño y cada corrida crea datos
  nuevos.
- `customer` 19, 20, 23 y 24: cambié `role`, `is_enabled` e `is_banned` en caliente para la sección 2
  y los **restauré** (`23|ADMIN|t|f`, `24|USER|t|f`, `19|ADMIN|t|f`, `20|USER|t|f`).
- `invitation` 5, 7 y 8: `is_paid`, `is_enabled`, `updated_by` y `deleted_by` **restaurados** a
  `f|t|null|null` (la 1 sigue con `is_paid=t`, como estaba antes de mi revisión).
- `tpl_template`, `tpl_template_version`, `tpl_document`, `tpl_release`: monté los fixtures de los
  intentos 10-14 y los **borré todos**. Las cuatro tablas vuelven a estar en **0 filas**, que es como
  estaban al empezar.
- No cambié de rama, no hice commit, no hice push y no arreglé nada: este documento es el único
  fichero que escribo.
