# 5-E5-R1 — revisión Opus de `frontend/apps/web/lib/admin/**` (entregable de E5-B)

Agente **E5-R1**, revisor Opus de la sesión E5, rama `claude/fase-5-admin-vq1fjm`. Revisado el
2026-09-10 contra `scratchpad/contrato-admin.md`, `lib/api-client.ts`, `lib/errors.ts`,
`identidad-visual/SKILL.md`, `CLAUDE.md` y `diseno/12-producto-completo.md` §A3 (S-13) y §B3-6.
Backend real levantado en `http://127.0.0.1:6003` durante toda la revisión: las afirmaciones sobre
el backend salen de `curl`, no de leer el fuente.

---

## VEREDICTO: **RECHAZADO**

Dos objeciones **ALTA**. Las dos son arreglos pequeños y acotados a ficheros de E5-B; el resto de la
capa está bien y no hay que rehacerla. La regla de la fase («ALTA = hay que arreglarlo antes de
aceptar») obliga a este veredicto aunque el cuerpo del trabajo sea sólido.

Cifras reales de lo que corrí (salida pegada en §5):

| Compuerta | Resultado |
|---|---|
| `vitest run lib/admin` | **3 ficheros, 41 pruebas, 41 pasan** |
| `tsc --noEmit` (apps/web) | 33 errores, **0 en `lib/admin`** (los 33 son de `app/(chrome)/admin/_componentes/**`, territorio de E5-C) |
| `eslint .` (apps/web) | 2 errores + 1 aviso — **uno de los dos errores es de E5-B** (`lib/admin/textos.test.ts:13`) |

---

## 1. Objeciones **ALTA** (bloquean la aceptación)

### ALTA-1 · Un 401/403 en `/admin` no marca la sesión como caducada ni tira el token muerto — y tres documentos afirman lo contrario

`peticionAdmin()` clasifica el 401/403 y lanza `SessionError`
(`frontend/apps/web/lib/admin/cliente.ts:88-90`), pero **no llama a `marcarSesionCaducada()`**, que es
lo que `peticion()` sí hace en la línea equivalente (`frontend/apps/web/lib/api-client.ts:277-279`).
`marcarSesionCaducada()` (`api-client.ts:94-100`) hace dos cosas que aquí no pasan: pone la bandera
que lee `haySesionCaducada()` y **borra el token que ya no vale** (`clearAuthToken()`).

Probado, no deducido. Prueba escrita fuera del repo
(`scratchpad/probe2/sesion.test.ts`), corrida con el vitest del proyecto contra los módulos reales:

```
  [api-client] haySesionCaducada() = true   getAuthToken() = null
  [lib/admin ] haySesionCaducada() = false  getAuthToken() = jwt-muerto
   Tests  2 passed (2)
```

Consecuencia concreta para la clienta: cuando su sesión caduca dentro de `/admin`, el token muerto
**se queda puesto**, así que cada petición siguiente vuelve a fallar igual, y la pantalla de acceso
—que decide con `getAuthToken() === null || haySesionCaducada()`, exactamente como hace
`app/(chrome)/editor/[invitationId]/page.tsx:198-201`— **cree que hay sesión válida**. Es la consola
muda: `textosAdmin.sesion.error.accion` («Iniciar sesión») lleva a una pantalla que no sabe que hay
que volver a entrar. Es justo el caso U-1 que documenta `api-client.ts:79-85`.

Lo que lo convierte en ALTA y no en MEDIA es que **la desviación va documentada como equivalencia**
en tres sitios:

- `lib/admin/cliente.ts:8-10`: «para que un 401 clasificado aquí y uno clasificado en el editor
  cuenten la misma historia (`haySesionCaducada` de `api-client.ts` sigue siendo la única fuente de
  verdad…)» — **falso**: nada de `lib/admin/**` escribe esa bandera.
- `lib/admin/README.md:37-40`: la misma frase.
- `ADR-5-E5-02` (`decisiones.md`), párrafo «Decisión»: «reutiliza … con la **MISMA** regla de
  clasificación». La regla de *clasificación* sí es la misma; el **efecto secundario sobre la sesión
  no**, y la ADR no lo menciona. Quien lea la ADR mañana creerá que hay paridad.

Arreglo propuesto (dos partes, la segunda necesita al orquestador):

1. **Dentro del territorio de E5-B, ahora mismo**: llamar a `clearAuthToken()` —que ya está
   exportado (`api-client.ts:134`)— en la rama 401/403 de `cliente.ts:88-90`, y sólo si
   `getAuthToken() !== null` antes de lanzar. Eso cierra el bucle de peticiones muertas.
2. **La bandera necesita una línea en `api-client.ts`**: exportar `marcarSesionCaducada` (hoy es
   privada, `api-client.ts:94`) y llamarla desde `peticionAdmin`. Tocar `api-client.ts` está vedado a
   E5-B por su encargo, así que **esto lo decide el orquestador de E5**: o autoriza el `export` de
   una línea, o acepta la divergencia. Lo que **no** vale es dejarla sin decidir.
3. En cualquiera de los dos casos: **corregir las tres frases** de `cliente.ts:8-10`,
   `README.md:37-40` y la ADR para que digan lo que el código hace.

### ALTA-2 · `textos.test.ts` deja el `lint` del CI en rojo

```
/home/user/RSVP-Lino-y-Sello/frontend/apps/web/lib/admin/textos.test.ts
  13:86  error  Unexpected combined character in character class  no-misleading-character-class
```

La columna 86 es el `\u{FE0F}` metido dentro de la clase de caracteres de `RANGO_EMOJI`
(`lib/admin/textos.test.ts:13`). `pnpm -r lint` es compuerta del CI
(`.github/workflows/ci.yml:181`), así que este entregable rompe la rama.

Arreglo, **verificado con `eslint --stdin` y comprobado que no cambia una sola detección**: sacar el
selector de variación de la clase y ponerlo como alternativa.

```ts
const RANGO_EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}]|\u{FE0F}/u;
```

Las tres variantes que probé contra el eslint del proyecto:

| Variante | eslint |
|---|---|
| la actual (`…\u{2190}-\u{21FF}\u{FE0F}]/u`) | **error** |
| `…\u{2190}-\u{21FF}]\|\u{FE0F}/u` (la propuesta) | **limpia** |
| la actual con bandera `v` en vez de `u` | error (no sirve) |

Y la equivalencia de detección, corrida en node:

```
caso           A(actual)  B(propuesta)
"🎉"            true       true
"✅"            true       true
"▶️"            true       true
"🇲🇽"           true       true
"❤️"            true       true
"—"             false      false
"…"             false      false
"«»"            false      false
"¿?"            false      false
"Administración" false     false
```

**Ojo, no es de E5-B pero es la misma línea**: `app/(chrome)/admin/_componentes/reglas-duras.test.ts:20`
(E5-C) copió el mismo regex y tiene el mismo error. E6 tiene que arreglar los dos o el CI seguirá rojo.

---

## 2. Objeciones **MEDIA** (hay que arreglarlas, no bloquean el siguiente paso)

### MEDIA-1 · Un 2xx con cuerpo vacío devuelve `undefined` disfrazado del tipo de respuesta

`cliente.ts:71`: `return (textoCrudo.length > 0 ? (JSON.parse(textoCrudo) as T) : (undefined as T));`

`undefined as T` es la única aserción de este fichero que tapa un desajuste real: la firma promete
`Promise<MetricasAdmin>` y devuelve `undefined`. Probado:

```
  200 vacio -> valor: undefined | leer r.clientas lanza: Cannot read properties of undefined (reading 'clientas')
```

La pantalla no recibe un `SessionError`/`UnknownApiError` que sepa pintar con
`textosAdmin.resumen.error`, sino un `TypeError` crudo en pleno render. Y la prueba
`cliente.test.ts:222-226` **bendice** el comportamiento (`resolves.toBeUndefined()`) en vez de
denunciarlo, describiéndolo como «defensivo».

Arreglo: las siete rutas del contrato responden siempre JSON; un 2xx sin cuerpo es una anomalía, no
un caso normal. Lanzar `new UnknownApiError(respuesta.status, "")` y cambiar la prueba de
`resolves.toBeUndefined()` a `rejects.toBeInstanceOf(UnknownApiError)`.

### MEDIA-2 · Dos caminos de fallo salen sin clasificar, y ninguno tiene prueba

Probado con el vitest del proyecto sobre los módulos reales (`scratchpad/probe2/huecos.test.ts`):

```
  200+HTML  ->  SyntaxError | Unexpected token '<', "<html>502 "... is not valid JSON | clasificado: false
  red caida ->  TypeError  | Failed to fetch                                          | clasificado: false
```

- **200 con cuerpo que no es JSON** (HTML de un proxy delante del backend): `JSON.parse` de
  `cliente.ts:71` lanza un `SyntaxError` pelado, que no es ninguno de los tres tipos de `errors.ts`.
- **`fetch` que rechaza** (red caída): `TypeError` pelado.

Ninguno de los dos rompe una promesa literal del README (habla de «respuesta no-2xx»), pero una
pantalla que haga `catch (e) { if (e instanceof SessionError) … else pintarBloqueDeError() }` con un
`instanceof` sobre `ApiClientError` se queda sin pintar nada. `lib/api-client.ts:259` tiene el mismo
hueco: **es paridad, no una regresión de E5-B** — pero aquí sí hay margen para cerrarlo sin tocar
`api-client.ts`.

Agravante propio de esta capa: `textosAdmin` **no tiene ningún texto de «no hay conexión»**, mientras
que `lib/i18n.ts:28` sí (`sinRed: "No hay conexión. Vuelve a intentarlo cuando regrese el internet."`).
El fallo más común de una consola —el wifi— no tiene copia.

Arreglo: envolver el `JSON.parse` del camino 2xx y el `await fetch` en `try/catch` que reclasifiquen
a `UnknownApiError`; añadir `textosAdmin.comun.sinRed` calcado de `i18n.ts:28`; y dos pruebas, una
por camino.

### MEDIA-3 · `tamano` fuera de rango: el comentario dice «se acota», el backend devuelve 400

`tipos.ts:58`: «`tamano` se acota a `[1,100]` en el backend; aquí solo se omite si viene `undefined`.»

Contra el backend real, con token de MASTER:

```
clientas?tamano=500  -> 400 {"…","errors":{"error":"El parámetro 'tamano' está entre 1 y 100; se recibió 500"}}
clientas?tamano=0    -> 400 {"…","errors":{"error":"El parámetro 'tamano' está entre 1 y 100; se recibió 0"}}
clientas?tamano=-3   -> 400 …
clientas?pagina=-1   -> 400 {"…","errors":{"error":"El parámetro 'pagina' es un entero mayor o igual que 0; …"}}
```

**No acota: rechaza.** Un selector de tamaño de página con un valor malo no devuelve una página
recortada, devuelve un `UnknownApiError`, y el comentario le dice a quien escribe la pantalla lo
contrario. No hay ninguna prueba de este caso límite.

Arreglo: corregir el comentario de `tipos.ts:58` («valor fuera de `[1,100]` ⇒ 400, no se recorta») y
añadir a `cliente.test.ts` un caso `tamano=500` que compruebe que se lanza `UnknownApiError`. (Acotar
en el cliente también valdría, pero entonces la consola escondería un error de programación suyo;
prefiero el 400 visible.)

### MEDIA-4 · `formatearFechaEvento` se inventa fechas y deja pasar basura cruda

Corrido de verdad, importando el módulo (`scratchpad/probe/run.ts`, `node --experimental-strip-types`):

```
formatearFechaEvento("2026-13-45","18:00")       => "14 feb 2027, 18:00"      <-- fecha inventada
formatearFechaEvento("no-fecha","")              => "no-fecha"                <-- basura a pantalla
```

- (a) `formato.ts:59-69`: el regex `^(\d{4})-(\d{2})-(\d{2})$` valida la **forma**, no el **rango**, y
  `new Date(2026, 12, 45)` desborda en silencio a un `Date` válido. `Number.isNaN(...getTime())` nunca
  lo atrapa. Resultado: la consola enseña «14 feb 2027» con total aplomo para una fecha que no existe.
  Es peor que un guion, porque es creíble.
- (b) `formato.ts:55` + `:74`: si la cadena no casa el regex, `fechaFormateada` sigue siendo
  `fechaLimpia` y se devuelve **tal cual**. La cabecera del fichero (`formato.ts:1-6`) promete el guion
  largo «en vez de "Invalid Date" o cualquier otro texto en inglés»; devolver el crudo del backend no
  es ninguna de esas dos cosas, pero tampoco es lo prometido.

La prueba que debería cazar esto, `formato.test.ts:86-90`, es **tautológica**: sólo afirma
`not.toContain("Invalid")`, y pasa precisamente porque la función devuelve el eco de la entrada.

Arreglo: tras construir `fechaLocal`, comprobar que el ida y vuelta cuadra
(`fechaLocal.getFullYear() === Number(anio) && fechaLocal.getMonth() === Number(mes)-1 &&
fechaLocal.getDate() === Number(dia)`), y devolver `GUION_LARGO` cuando no cuadre **o** cuando la
cadena no case el regex. Y cambiar la prueba a `toBe(GUION_LARGO)`, que sí puede fallar.

### MEDIA-5 · La compuerta anti-emoji tiene bandas ciegas reales

Primero lo bueno, **comprobado como pedía el encargo**: contaminé una copia de `textos.ts` fuera del
repo (`scratchpad/probe/`) con `🎉`, `✅`, `▶️` y un texto vacío, y corrí la prueba de verdad con el
vitest del proyecto (`--root` al scratchpad). **Cae**:

```
FAIL textos.test.ts > … > ningún texto del objeto entero trae un emoji
  AssertionError: expected [ 'pagina.titulo', …(2) ] to deeply equal []
  + [ "pagina.titulo", "pagina.cerrarSesion", "comun.reintentar" ]
 Tests  2 failed | 4 passed (6)
```

La compuerta es real, no decorativa. Pero el rango deja fuera bandas de emoji que sí existen:

```
"⏰" -> SE COLARIA    "⌚" -> SE COLARIA    "⏳" -> SE COLARIA   (U+2300–U+23FF)
"▶"  -> SE COLARIA                                             (U+25A0–U+25FF sin FE0F)
"🀄" -> SE COLARIA    "🅰" -> SE COLARIA                        (U+1F000–U+1F2FF)
"ℹ"  -> SE COLARIA
```

Como es la **única** aplicación automática de una regla dura de `identidad-visual/SKILL.md`
(«Nunca emojis … rechazo automático en revisión»), los huecos importan.

Arreglo: añadir `\u{2300}-\u{23FF}` y `\u{1F000}-\u{1F2FF}` al rango (y valorar
`\u{25A0}-\u{25FF}`), aprovechando la misma edición del ALTA-2. Verificado que no produce falsos
positivos sobre los textos actuales: `—`, `…`, `«»`, `¿?` y los acentos siguen limpios.

### MEDIA-6 · `textos.ts` etiqueta un filtro que el contrato no acepta y el cliente no puede enviar

`textos.ts:103-104` define `filtros.plan: "Plan"` y `filtros.planTodos: "Todos los planes"`. El
wireframe los pide (`12-producto-completo.md`, §B3 pantalla 6: `[ Buscar ] [ Estado v ] [ Plan v ]`),
pero el **contrato §3** sólo admite `buscar`, `estado` y `pago`, e `InvitacionesQuery`
(`tipos.ts:105-111`) no tiene `plan`. Comprobado contra el backend real: `?plan=…` no es un
parámetro de esa ruta.

Es decir: quien pinte la pantalla encontrará la etiqueta de un desplegable que no tiene a dónde
mandar su valor. La discrepancia wireframe↔contrato es legítima y no la resuelve E5-B, pero
**entregarla en silencio sí es un defecto**: la capa la absorbe sin dejar rastro.

Arreglo: o quitar las dos claves, o dejarlas con un comentario que diga «el contrato §3 todavía no
acepta este filtro» y anotar la pregunta en `memoria/preguntas-abiertas.md` para el orquestador.

---

## 3. Objeciones **BAJA** (mejoras)

- **BAJA-1 · `formatearImporte` inventa un importe de cero.** Corrido:
  `formatearImporte(null, undefined) => "$0.00"`, `formatearImporte(NaN,"MXN") => "$0.00"`
  (`formato.ts:22`). En la columna «Importe» de la pestaña Pagos, «$0.00» y «dato ausente» son cosas
  distintas, y la primera se lee como «gratis». El contrato §3/§5 declara `importe` no nulo, así que
  el caso no debería darse; cuando se dé, el guion largo es más honesto que un cero. La decisión está
  documentada en `formato.ts:18-19`, así que es una discrepancia consciente, no un descuido.
- **BAJA-2 · Citas `fichero:línea` ya rancias.** `cliente.ts:130`, el bloque de la §4 y la ADR citan
  `InvitationAdminService.kt:461` para la comprobación de jerarquía de `toggleInvitationStatus`.
  **Eran correctas cuando se escribieron** (verificado: `git show HEAD:…:461` es exactamente esa
  línea), pero el cambio sin commitear de E5-A en ese mismo fichero (+18 líneas alrededor de
  `markAsPaid`) las corrió: hoy la comprobación está en **`:479`**, y la hermana citada como `:446-448`
  está en `:464-466`. No es culpa de E5-B; que E6 las repunte, o que se citen por nombre de función.
- **BAJA-3 · El guion largo se define dos veces.** `formato.ts:11` (`GUION_LARGO`) y
  `textos.ts:29` (`comun.sinDato`), las dos `"—"`. Que `formato.ts` importe el de `textos.ts`, que ya
  lo importa para las etiquetas.
- **BAJA-4 · «escribe a soporte» sin decir a dónde.** `textos.ts:214`. Es el único mensaje del fichero
  que no dice qué hacer de forma accionable; el resto del producto sí concreta (`i18n.ts:44`
  «mándanos el código de abajo»). Existe una pantalla `/contacto` (wireframe 8): apuntar ahí.
  Relacionado: los dos bloques `sesion.*` son los únicos que la prueba de forma de los errores
  (`textos.test.ts:193-210`) **no** revisa, y `sesion.sinPermiso` es el único sin `accion`.
- **BAJA-5 · Dos tipos son más estrictos que la respuesta real** (la falla está del lado de E5-A, ver
  §4): `ClientaAdmin.altaEn: string` y `InvitacionAdmin.enlacePublico: string | null` declaran claves
  **obligatorias** que el backend de hoy omite cuando el valor es nulo. Degrada bien
  (`formatearFechaCorta(undefined) => "—"`), pero lo honesto sería `altaEn?: string | null` y
  `enlacePublico?: string | null` mientras la serialización no cambie.
- **BAJA-6 · Pruebas tautológicas que conviene reescribir o borrar**, además de las ya citadas:
  `textos.test.ts:167-173` («el recorrido visitó más de 40 textos») prueba el recorrido, no la copia;
  `textos.test.ts:175-180` compara `Object.keys(textosAdmin.pestanas)` con la lista literal de sus
  propias claves — sólo protege el orden, y eso ya lo garantiza el objeto.

---

## 4. Lo que verifiqué y **NO** es un defecto

Esta sección es tan útil como la anterior: no hay que volver a mirar nada de esto.

**El token de sesión (P8, `contratos.md §8 C4`) — limpio, sin reservas.**
```
$ grep -rn "sessionStorage|localStorage|document.cookie|STORAGE_KEY|invitaciones.auth" lib/admin/
lib/admin/README.md:38:   directorio no lee ni escribe `sessionStorage` …   (comentario)
lib/admin/cliente.ts:6:  // lee ni escribe `sessionStorage` ni memoria propia … (comentario)
```
Cero accesos de código. El único punto de lectura del token es `getAuthToken()` importado
(`cliente.ts:24`, usado en `cliente.ts:64`), que es el accesor exportado de `api-client.ts:123`. No
hay constante de clave de almacenamiento, ni memoria propia, ni cookie. (El defecto ALTA-1 es de
*escritura* de la señal de caducidad, no de lectura del token: el accesor se respeta.)

**Fidelidad al contrato — las siete rutas cuadran con el backend real.** Contrastado con `curl` como
MASTER contra `127.0.0.1:6003`, respuesta a respuesta:

| Ruta | Respuesta real | Tipo de `tipos.ts` |
|---|---|---|
| `/product/admin/metricas` | `{"clientas":16,"invitaciones":4,"publicadas":0,"pagadas":1,"rsvpUltimos7Dias":0}` | `MetricasAdmin` — las cinco claves, ni una más |
| `/product/admin/clientas` | `{total,pagina,tamano,elementos:[{id,nombre,correo,rol,habilitada,invitaciones,altaEn}]}` | `PaginaClientas` / `ClientaAdmin` ✓ |
| `/product/admin/invitaciones` | `{…,elementos:[{id,evento,fecha,hora,clientaId,clienta,plan,pagada,importe,estado,usaTemplates2,creadaEn}]}` | `PaginaInvitaciones` / `InvitacionAdmin` ✓ |
| `/product/admin/pagos` | `{total,pagina,tamano,origen:"invitaciones",elementos:[{id:"inv-4",invitacionId,clientaId,clienta,plan,importe,moneda:"MXN",estado,fecha}]}` | `PaginaPagos` / `PagoAdmin` ✓ |
| `/product/admin/planes` | `{"elementos":[{"id":1,"nombre":"Básico","invitaciones":0},…]}` | `ListaPlanes` ✓ |
| `/product/admin/plantillas` | `{"total":0,"elementos":[]}` | `ListaPlantillas` ✓ (no hay versión sembrada hoy) |
| `PUT /admin/invitations/{id}/toggle-status` | `{"status":"success","message":"Invitación habilitada correctamente","invitation":{"id":3,"status":"paid","eventId":1,"event":"Boda","planId":2,"plan":"Premium","price":0.0,"currency":"MXN","date":"2027-04-18","time":"17:00"}}` | `AlternarEstadoInvitacionResponse` / `InvitacionHeredada` ✓ |

Las URL, los métodos y los nombres de parámetro que construye `cliente.ts` son los del contrato
(`cliente.ts:99,108,118,137,146,155,162`). La única ruta en inglés es la heredada de la §4, aislada en
tipos con sufijo `Heredado` y explicada en `tipos.ts:8-14` — es la decisión correcta, no un descuido.

**Uniones cerradas donde el contrato las exige, y sólo ahí.** `RolClienta` (`tipos.ts:36`),
`EstadoInvitacion` (`:72`), `FiltroPagoInvitacion` (`:75`), `EstadoPago` (`:152`), `OrigenPagos`
(`:168`), `EstadoPlantilla` (`:202`): las seis son uniones de literales, ninguna es `string`. Las tres
que quedan como `string` abierto están bien: `moneda` (sale de `application.yml`, contrato §5),
`tiposDeEvento: string[]` (catálogo abierto, contrato §7) y
`AlternarEstadoInvitacionResponse.status` (el Kotlin es `val status: String = ""`,
`InvitationResponse.kt:17`, y sólo lo llena el literal `"success"` del controlador — cerrarlo sería
inventar un contrato que el backend no da).
`InvitacionHeredada.status: "paid" | "pending_payment"` **sí** es una unión cerrada legítima:
verificado en `_InvitationResponseKtx.kt:11-15`, es un `if (isPaid) "paid" else "pending_payment"` y no
hay tercer valor posible.
Y `EstadoPago` incluye `"devuelto"` no por optimismo: el backend de hoy ya lo acepta como filtro
(`GET /product/admin/pagos?estado=devuelto` → **200**, lista vacía), mientras que un valor inventado
sí es 400 (`?estado=basura` → 400, `"El parámetro 'estado' admite pagado, pendiente, devuelto…"`).

**Nada de `any`, `as unknown as` ni `@ts-ignore`.** `grep -nE ":\s*any\b|<any>|as unknown as|@ts-ignore|@ts-expect-error"` sobre los cinco `.ts`: sin resultados. Las siete aserciones `as` del
directorio están todas justificadas menos una (la de MEDIA-1): tres son el ensanchado
`query as Record<string, string|number|undefined>` (`cliente.ts:109,120,147`), estructuralmente sano y
calcado de `api-client.ts:292`; dos son `switch (estado as EstadoInvitacion|EstadoPago)`
(`formato.ts:82,96`) con `default` que cubre lo desconocido; una es el `as const` de `textos.ts:217`.

**La afirmación de la ADR-5-E5-02 sobre el error heredado sin `code`: VERIFICADA contra el backend
real**, que es lo que se me pidió comprobar y no dar por bueno. Cuatro `curl` con el backend arriba:

```
sin token, GET /product/admin/metricas               -> 401  {"timestamp":"…","statusCode":401,"errorsListed":null,"errors":{"url":"Full authentication is required to access this resource"}}
token que no sirve, GET /product/admin/metricas      -> 401  {"timestamp":"…","statusCode":401,"errorsListed":null,"errors":{"url":"El token proporcionado no es válido"}}
rol USER, GET /product/admin/metricas                -> 403  {"timestamp":"…","statusCode":403,"errorsListed":null,"errors":{"url":"Access Denied"}}
MASTER, PUT /admin/invitations/999999/toggle-status  -> 400  {"timestamp":"…","statusCode":400,"errors":{"error":"La invitación con id 999999 no existe"}}
```

Ninguno de los cuerpos trae `code` ni `message`, así que `TplErrorResponseSchema.safeParse`
(`errors.ts:53-59`, `code` y `message` obligatorios) falla y el 401/403 cae a `SessionError` y el 400 a
`UnknownApiError` — exactamente lo que dice la ADR y lo que hacen `cliente.ts:81-92`. **La ADR no
mintió en este punto.** Las pruebas `cliente.test.ts:164-176`, `:198-208` y `:210-219` usan cuerpos
fieles a estos, no inventados.

**Datos personales — la capa no pide ni propaga nada de más.** Los únicos campos personales de todo
el directorio son `ClientaAdmin.nombre` y `ClientaAdmin.correo` (`tipos.ts:41,42`), los dos exigidos
por el contrato §2 y necesarios para el buscador («Buscar por nombre o correo», `textos.ts:68`). No
hay teléfono, dirección, fecha de nacimiento, `howKnow`, contraseña ni hash en ningún tipo, y el
backend real tampoco los manda (tabla de arriba).
**S-13 (`12-producto-completo.md:617`) no toca a esta capa**: `confirmationToken` y
`cancellationToken` son de `GuestResponseItem`, de los listados de **invitados**, y `lib/admin/**` no
tiene ni un tipo, ni una función, ni una ruta de invitados —
`grep -rn "confirmationToken\|cancellationToken" lib/admin/` no devuelve nada. El único secreto que
roza es `InvitacionAdmin.enlacePublico`, que es el `public_token` **de la invitación** (no del
invitado), y el contrato §3 lo condiciona a que haya release activo, es decir, a que ya sea un enlace
público por definición; el tipo lo documenta en `tipos.ts:92`. No es fuga.
El `README.md` no promete nada sobre datos que el código no cumpla; las promesas que sí incumple son
las de sesión (ALTA-1) y están señaladas allí.

**Cero agregados en el frontend.** `grep -nE "\.reduce\(|\+=|Math\.|\.sort\(|suma|count"` sobre los
cuatro `.ts` de fuente: ni un `reduce`, ni un `filter`, ni un `map`, ni una suma. Los `total` que
aparecen (`tipos.ts:52,99,171,216`) son claves de la respuesta del backend, y los `.length` de
`formato.ts:23,37,50,51` son comprobaciones de cadena vacía, no conteos. `formato.ts` sólo traduce
forma: moneda, fecha, etiqueta. **La regla dura se respeta.**

**Fugas de territorio: ninguna.** `git status --porcelain` sobre la rama, atribuido:

```
 M docs/rediseno-plantillas/memoria/decisiones.md        <- E5-B (ADR-5-E5-02, 50 líneas AÑADIDAS AL FINAL)
 M scripts/seed/admin.sh                                 <- E5-A (siembra de ADMIN + clienta propia)
 M src/main/kotlin/…/modules/admin/invitations/service/InvitationAdminService.kt  <- E5-A (S-03 / ADR-5-E5-01)
?? docs/…/bitacora/5-E5-{A,B,C}-parcial.md, 5-E5-B.md    <- cada agente el suyo
?? frontend/apps/web/lib/admin/                          <- E5-B (el entregable)
?? frontend/apps/web/app/(chrome)/admin/_componentes/    <- E5-C
?? src/main/kotlin/…/modules/product/admin/*.kt          <- E5-A
```

E5-B tocó **exactamente** `lib/admin/**` y sus dos ficheros de memoria. `git diff` de `decisiones.md`
confirma que el bloque de la ADR va **añadido al final**, sin modificar ni una línea previa. **No
tocó** `lib/i18n.ts`, `lib/api-client.ts`, `lib/errors.ts`, `lib/panel/**`, `packages/**` ni
`scripts/check-budget.mjs`.

**Identidad en `textos.ts` — cumple.** Repasadas las 219 líneas: cero emojis (y la compuerta lo
sostiene, ver MEDIA-5), cero textos vacíos, cero «algo salió mal» a secas. **Tuteo consistente en todo
el fichero** («Inténtalo de nuevo», «Revisa tu conexión», «Tu sesión no es válida o expiró», «Si crees
que es un error»), que es el mismo registro que `lib/i18n.ts` (`:24,:25,:28,:64,:261`) — no hay ni un
«usted» ni una mezcla. Los siete bloques de error tienen título + cuerpo + acción, y el cuerpo dice
qué hacer, no sólo que falló. No encontré calcos del inglés: «Obsoleta» por *deprecated*, «Sin
clasificar» por el estado desconocido, «Alta» por *created at*, «Enlace» por *link*. Las cinco
pestañas y los estados vacíos por tabla cuadran con el wireframe (`§B3` pantalla 6, «VACÍO ▸ por
tabla, no por página»). La decisión de no tocar `lib/i18n.ts` (`textos.ts:4-10`, README punto 2) es la
correcta: E2 está partiendo ese fichero en paralelo.

**`formato.ts` aguanta los casos límite que se le pidieron** — comprobado **ejecutándolo**, no
leyéndolo (`node --experimental-strip-types` sobre una copia en el scratchpad):

```
formatearFechaEvento("","")                      => "—"
formatearFechaEvento("2026-11-14","")            => "14 nov 2026"
formatearFechaEvento("","18:00")                 => "18:00"
formatearFechaCorta("")                          => "—"
formatearFechaCorta("basura")                    => "—"
formatearFechaCorta("2026-03-02T10:00:00Z")      => "2 mar 2026"
formatearImporte(0,"MXN")                        => "$0.00"
formatearImporte(undefined,"")                   => "$0.00"
formatearImporte(1490,"NO-ES-MONEDA")            => "1490.00 NO-ES-MONEDA"
formatearImporte(1490,"usd")                     => "USD 1,490.00"
etiquetaEstadoInvitacion("desconocido")          => "Sin clasificar"
etiquetaEstadoPago(undefined)                    => "Sin clasificar"
```

Ninguna lanzó, ninguna escribió «Invalid Date» ni «NaN», la moneda desconocida no revienta la fila y
el estado desconocido cae a la etiqueta genérica. Los dos huecos que sí encontré están en MEDIA-4 y
BAJA-1; el resto del comportamiento prometido se cumple.

**Ninguna función se traga un error ni devuelve `null` en lugar de lanzar.** Las siete devuelven lo
que da el backend o lanzan; no hay un solo `catch` que devuelva array vacío, `null` o un valor por
defecto; el único `catch` silencioso es el de `JSON.parse` del cuerpo de error (`cliente.ts:77-79`),
que es exactamente lo que hace `api-client.ts:267-269` y termina igualmente en un `throw` con el
cuerpo crudo conservado. La única salida sin excepción y sin dato es la de MEDIA-1.

**La duplicación de `peticionAdmin()` está bien acotada.** Comparadas línea a línea, `peticionAdmin`
(`cliente.ts:60-93`) es un subconjunto honesto de `peticion` (`api-client.ts:206-283`): misma
construcción de URL, misma `construirQuery` (idéntica, `cliente.ts:43-52` ≡ `api-client.ts:171-180`),
mismo `Accept`, mismo `Authorization` condicionado a `getAuthToken()`, mismo `cache: "no-store"`,
mismo orden de clasificación (`TplErrorResponseSchema` + prefijo `TPL_` → `ApiError`; 401/403 →
`SessionError`; resto → `UnknownApiError` con cuerpo crudo). Lo que falta —`jsonBody`, `quitarNulos`,
límites de bytes, `ETag`/`If-None-Match`, 304, 204, `formBody`, `rawBody`, `next`— **no lo necesita
ninguna de las siete rutas**, que son seis GET y un PUT sin cuerpo. **La única diferencia de conducta
en todo el pipeline es la llamada ausente a `marcarSesionCaducada()`**, que es el ALTA-1. Sin ese
agujero, la duplicación sería aceptable y la ADR estaría bien argumentada.

**La §4 del contrato está bien resuelta, y el hallazgo que pedía verificar no existe.** El contrato
mandaba comprobar si `toggle-status` comprueba jerarquía. Sí la comprueba
(`InvitationAdminService.kt:479` hoy, `:461` en `HEAD`): llama a
`hierarchyValidationService.validateInvitationAccess(loggedInUserId, invitationId)` y lanza
`UnauthorizedAccessException` → 403. E5-B lo reportó correctamente como «no es un hallazgo». No se
creó ninguna ruta nueva: `cliente.ts:137` pega contra la heredada tal cual, y la prueba
`cliente.test.ts:109-118` lo blinda con un `expect(url).not.toContain("/product/admin")`, que es una
buena prueba de comportamiento.

---

## 5. Salida real de las compuertas que corrí

```
$ cd /home/user/RSVP-Lino-y-Sello/frontend && pnpm --filter web exec vitest run lib/admin

 RUN  v5.0.0 /home/user/RSVP-Lino-y-Sello/frontend/apps/web

 Test Files  3 passed (3)
      Tests  41 passed (41)
   Start at  05:36:14
   Duration  3.24s
```

```
$ cd frontend/apps/web && pnpm exec tsc --noEmit
total errores: 33
en lib/admin: 0
ficheros afectados: sólo app/(chrome)/admin/_componentes/**  (AccionDeFila, BloqueConError,
EtiquetaDeEstado, FilaDeMetricas, Tabla — todos `TS2339: Property 'toBeInTheDocument' does not exist`,
es decir, falta el `expect.extend` de jest-dom en la configuración de pruebas de E5-C)
```
`pnpm -r run typecheck` falla por esos 33, no por `lib/admin`. **No es de E5-B**; queda apuntado para
E5-C / E6.

```
$ cd frontend/apps/web && pnpm exec eslint . --config ../../eslint.config.mjs

app/(chrome)/admin/_componentes/reglas-duras.test.ts
  20:68  error  Unexpected combined character in character class  no-misleading-character-class   <- E5-C
e2e/flujo-principal.spec.ts
  94:11  warning  'campoFoto' is assigned a value but never used                                  <- preexistente (0f68f4d)
lib/admin/textos.test.ts
  13:86  error  Unexpected combined character in character class  no-misleading-character-class   <- E5-B (ALTA-2)

✖ 3 problems (2 errors, 1 warning)
```

`components/sitio/portada.test.tsx`: **no lo corrí**; está rojo desde `bfdcbaa` por una razón ajena a
esta sesión, tal y como advertía el encargo. Sólo corrí `vitest run lib/admin`.

Backend usado para los `curl`: el que ya estaba arriba en `127.0.0.1:6003` (PID 7732, Postgres
efímero en `/tmp/templates2-pg`). Toqué el estado compartido una sola vez —dos `PUT toggle-status`
sobre la invitación 3, uno para ver la respuesta real y otro para **devolverla a su estado anterior**
(`is_enabled` = `f`, comprobado por SQL antes y después)—. Las cuentas que sembré para probar los
403 (`rev-*`, `revmaster-*`, `revtog-*`, `revrest-*`, `revq-*`, `revz-*`) llevan sufijo único y no
pisan datos de nadie.

---

## 6. Resumen para quien siga

Lo que hay que arreglar antes de aceptar: **ALTA-1** (la sesión caducada: o se llama a
`clearAuthToken()` y se corrigen las tres frases, o el orquestador autoriza exportar
`marcarSesionCaducada`) y **ALTA-2** (sacar `\u{FE0F}` de la clase de caracteres para desatascar el
lint del CI — y de paso el mismo arreglo en el fichero de E5-C).

Lo que **no** hay que volver a revisar: el token (P8) está limpio, el contrato se cumple ruta por ruta
contra el backend real, los tipos son uniones cerradas donde toca, no hay `any` ni aserciones que
tapen desajustes salvo la de MEDIA-1, no hay datos personales de más ni relación con S-13, no hay ni
un agregado en el frontend, no hay fugas de territorio, y la afirmación de la ADR sobre el
`ErrorMessage` heredado es cierta —la comprobé con `curl`, no con la ADR—.

Para E5-A / E6 (no es de E5-B, pero lo vi al contrastar): `RespuestasDeAdministracion.kt:42` y `:69`
declaran `altaEn` y `enlacePublico` como `String?`, y la serialización **omite la clave** cuando el
valor es nulo, mientras el comentario de `:30` dice que el contrato quiere `"enlacePublico": null` y
no «sin la clave». Verificado: las clientas 11 y 3 (con `created_at` nulo en la base) vuelven sin
`altaEn`, y ninguna invitación devuelve `enlacePublico` hoy.
