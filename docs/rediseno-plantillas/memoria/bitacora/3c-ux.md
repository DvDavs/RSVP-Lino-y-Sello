# 3C-UX — recorrido de experiencia sin instrucciones (cierre de la fase 3-C)

**Quién soy en este documento.** Una clienta que organiza los XV años de su hija. Sabe usar el
teléfono y comprar por internet. No sabe qué es una plantilla versionada, un bloque, un token ni una
revisión. **No leí una sola línea del código de la interfaz ni de `diseno/` antes de terminar el
recorrido**; leí `bitacora/3-ux.md §1`, `bitacora/3b-adv.md §8` (UX-N-01..03) y `handoffs/3c-8.md`
para saber qué se prometía cerrado, y después del recorrido bajé al código solo para dar
`archivo:línea` de lo que ya había visto en pantalla.

**Lo que intenté hacer, y nada más**: entrar, elegir tipo de evento y plantilla, poner mis datos,
cambiar dos textos y una foto, cambiar la paleta, publicar, copiar el enlace y abrirlo como invitada.

**Entorno.** Backend real en `127.0.0.1:6110` (`scripts/dev-backend.sh` + `scripts/seed-demo.sh`,
`TPL_DEV_DB=invitaciones_ux`), `apps/web` compilada y servida en producción (`pnpm run build` +
`next start`, puerto 3110), Chromium real (`/opt/pw-browsers/chromium-1194`) conducido por
Playwright. Móvil **390×844** (`isMobile`, táctil, `es-MX`, `America/Mexico_City`) y escritorio
**1440×900**. Capturas: `evidencia/fase-3c/cierre/ux/` (**64**: `m*` móvil, `e*` escritorio).
Marcas: `[V]` = lo viví ejecutándolo.

**Respuesta corta: NO. No completé el flujo sin ayuda.** Me atasqué dos veces de forma terminal
(§1.2 y §1.6) y en la segunda tuve que hacer algo que ninguna clienta puede hacer —insertar filas de
`invitation` por SQL— para poder seguir evaluando. Todo lo que evalúo a partir de §1.5 lo evalúo con
una llave maestra que la clienta no tiene.

---

## 1. La narración, paso a paso (móvil 390×844)

### 1.1 La portada (00:00 – 00:30) — bien, y es nuevo

Tecleo la dirección y **ya no hay un 404 en inglés**: sale una portada en español, «Tu invitación,
lista en una tarde.», con «Empezar mi invitación», «Ver cómo funciona», siete tarjetas de tipo de
evento, testimonios y planes. `[V]` HTTP 200, `lang="es-MX"`, `scrollWidth 390 = clientWidth 390`
(cero desbordamiento), carga en **0,88 s**. Capturas `m01-inicio.png`, `m01-inicio-completa.png`.
**UX-N-01 cerrada.** Entiendo qué venden a la primera y no tuve que pensar.

### 1.2 Entrar (00:30 – 01:30) — el primer muro

Toco «Empezar mi invitación» (350×52, el objetivo más grande de la pantalla, bien). Me lleva a
`/acceso?volver=%2Feditor`: **por fin existe una pantalla de acceso**, con pestañas «Entrar» y
«Crear cuenta», correo, contraseña y «¿Olvidaste tu contraseña?». `[V]` `m02-acceso.png`. Esto era
un muro terminal en la fase 3 y ya no lo es.

Entro con la cuenta que me dieron (`demo.boda@example.com`) en **1,77 s** y caigo en
`/editor`, «PASO 1 DE 4 · ¿Qué vamos a celebrar? · Elige uno; te mostramos solo las plantillas que
le van». **Y debajo no hay nada que elegir.** `[V]` `m05-paso1-tipo.png`:

> Mis invitaciones · Ana Sofía & Diego · Invitación n.º 3 · [Seguir editando]
> «Tu invitación ya tiene plantilla. Ábrela para seguir editándola; el diseño se cambia desde dentro.»
> **[Continuar]** ← inhabilitado, y lo está para siempre

El único elemento interactivo del cuerpo es «Seguir editando», que abre **la boda de otra persona**.
Yo vengo por unos XV años. Vuelvo a la portada y toco la tarjeta **«XV años»**, que promete «Elige el
tipo y te llevamos al asistente con las plantillas que le van»: me deja en
`/editor?tipo=xv-anos` **exactamente en la misma pantalla vacía** — el `tipo` de la URL se ignora en
silencio. `[V]` `m06-paso1-xv.png`.

> **Muro 1.** Con una cuenta cuyas invitaciones ya tienen plantilla, el asistente es una pregunta sin
> respuestas y un botón muerto. No hay «crear otra invitación» en ninguna parte.

### 1.3 Creo mi propia cuenta (01:30 – 03:00) — el alta está muy bien y el final es un círculo

Cierro sesión, pestaña «Crear cuenta»: tres pasos, un campo por paso (correo → contraseña → nombre y
apellidos), con la política de contraseña escrita como ayuda del campo y no como castigo. `[V]`
`m08`–`m10`. Se crea en **3,06 s** y me deja en `/editor`. Y ahí:

> **Todavía no tienes invitaciones**
> Tu invitación se crea cuando contratas un plan. En cuanto exista, aparece aquí y podrás elegirle
> una plantilla. **[Ver planes]**

`[V]` `m12-sin-invitaciones.png`. Toco «Ver planes» → `/ayuda#planes`: una página de **7 preguntas
frecuentes**. La que se llama como mi problema, «¿Cómo empiezo mi invitación?», responde «Tu
invitación se crea cuando contratas un plan» — la misma frase, sin decirme dónde se contrata. `[V]`
`m13`, `m14`. Al final: «¿No está tu duda aquí? **Escríbenos por el mismo medio por el que
contrataste tu invitación**» — pero yo no he contratado nada. **No hay teléfono, ni correo, ni
WhatsApp, ni formulario en todo el sitio.** La sección «Elige tu plan» de la portada dice «Los
precios se acuerdan con quien te atendió; todavía no se publican aquí» y su botón es «Entrar a mi
cuenta», que me devuelve al asistente vacío. `[V]`

> **Muro 2.** El botón principal de la portada lleva, en cuatro toques, a un circuito cerrado sin
> salida ni forma de preguntar. Una clienta que quiere **comprar** no tiene por dónde.

Para seguir evaluando hice lo que ninguna clienta puede hacer: `INSERT INTO invitation (…,
uses_templates2, …)` por SQL (lo mismo que hace `scripts/seed-demo.sh`, que documenta que **no
existe ruta HTTP** para ello, ADR-2-4-02). A partir de aquí ya no mido el producto que recibe una
clienta.

### 1.4 Elegir el tipo (03:00 – 03:40) — ahora sí, y con un defecto que lo estropeaba todo

Con una invitación sin plantilla, el paso 1 se abre entero: ocho tarjetas con icono propio, «Boda ·
1 plantilla», «XV años · 1 plantilla» **preseleccionada** y marcada, y seis tipos con «Todavía no hay
plantillas». `[V]` `m15-paso1-tipos.png`. La preselección es exactamente lo que quiero.

Pero la pantalla estaba rota de una forma que no se ve mirando, y sí tocando:

- `document.documentElement.scrollWidth` **421** frente a `clientWidth` **390**: **31 px de
  desplazamiento horizontal**. `[V]`
- El culpable: la insignia **«EL DE TU INVITACIÓN»**, 165 px de ancho dentro de una columna de
  tarjeta de 97 px, en la mono de 11 px que por contrato de diseño no parte línea. `[V]`
- Consecuencia real: Chromium ensancha el *layout viewport* a **421×909**, así que la barra fija de
  acción (`fixed inset-x-0 bottom-0`) resuelve su `bottom:0` **a 853 px, 9 px por debajo del borde
  visible de 844**. `[V]` El botón «Continuar con XV años» se dibuja recortado por la derecha y **el
  punto donde se toca no es el punto donde se ve**: mi toque sobre «XV años» seleccionó **«Primera
  comunión»**, y un toque sobre la píldora aterrizó en la tarjeta que hay detrás. `[V]`
  `m17-barra-inferior.png`, `m18-tras-toque-continuar.png`.

**Corregido** (§3.1): la insignia pasa a «Tu evento». Medido después: `scrollWidth 390 = clientWidth
390`, `innerWidth 390`, barra en `top 788 / bottom 832` dentro de los 844, y
`elementFromPoint(290, 805)` devuelve el botón. `[V]` `m50-paso1-arreglado.png`,
`m51-barra-arriba.png`.

Detalle menor: los seis tipos sin plantillas se pueden elegir igual y «Continuar» se habilita. No es
un callejón: el paso 2 responde con un estado vacío honesto («Todavía no hay plantillas para este
tipo · Estamos preparando más diseños» + «Elegir otro tipo» + «Atrás»). `[V]` `m19-paso2-vacio.png`.

### 1.5 Elegir la plantilla (03:40 – 04:10) — **UX-N-02 cerrada**

Paso 2: «Elige el punto de partida — **Solo plantillas de XV años.** Los colores y la tipografía los
cambias después, dentro del editor.» Un resultado: **XV Jardín**, con su vista previa **que ahora sí
carga** (`naturalWidth > 0`), su insignia «INCLUIDA EN TU PLAN» y «Usar esta plantilla» (308×44).
`[V]` `m20-paso2-plantillas.png`. Ninguna plantilla de boda a la vista. Sin desbordamiento.

### 1.6 Los datos básicos (04:10 – 06:00) — el segundo muro, y este es del producto

Paso 3: «¿Quiénes celebran? · **Quinceañera**», «¿Cuándo? · Fecha del evento (20 de marzo de 2027,
ya rellena) · Hora de inicio», «¿Dónde? · Dónde». Los rótulos son perfectos y la fecha viene puesta.
`[V]` `m21-paso3-datos.png`.

Escribo «Mariana Rivera» y «Jardín Los Encinos, Puebla», toco **Continuar** y sale en rojo:

> **No pudimos guardar estos datos. Puedes continuar: los escribes dentro del editor y no se pierde nada.**

`[V]` `m24-error-datos.png`. **Y «Continuar» no continúa.** Lo pulsé tres veces: tres veces el mismo
error, tres veces la misma pantalla. El aviso me dice que puedo seguir y el botón que me lo permitiría
es el que falla.

Capturé la llamada `[V]`:

```
POST http://127.0.0.1:6110/editor/invitations/4/document/operations  → 422
{"code":"TPL_OPERATION_INVALID",
 "message":"la operación 1 del lote no es aplicable: TPL_ITEM_UNKNOWN",
 "details":{"operations":[{"index":1,"code":"TPL_ITEM_UNKNOWN",
                           "path":"event.cards[01J8GDAN5TK4BMEJ4BV0CYKXVB]"}]}}
envío: {"baseRevision":0,"clientBatchId":"asistente-mtplu7sc","operations":[
  {"op":"setBlock","blockId":"honoree.person","value":{"kind":"person","name":"Mariana Rivera"}},
  {"op":"setItemBlock","groupId":"event.cards","itemId":"01J8GDAN5TK4BMEJ4BV0CYKXVB",
   "blockId":"place","value":{"kind":"location","name":"Jardín Los Encinos, Puebla"}}]}
```

**Aislado**: vaciando «¿Dónde?» el MISMO lote sale **200** y avanza al paso 4. `[V]` Es decir: el
único campo que rompe el paso 3 es el lugar. El lote es atómico, así que también se pierde el nombre.

El `itemId` no está cableado: sale del documento compuesto
(`components/asistente/datos-basicos.ts:157`, `primerItem.itemId`). Lo que pasa es que un documento
**recién creado** tiene el `content` vacío —lo comprobé en `tpl_document`: la invitación 4 no tenía
ni una clave en `content`, y la boda sembrada tenía `event.cards` con el ULID
`01M1TZP0ZA201089VMJH83PD2N`, distinto del de `defaults.json`—, así que el compuesto ofrece el
`itemId` de los *defaults* de la plantilla y `setItemBlock` lo rechaza. **Le pasa al 100 % de las
invitaciones nuevas**, que es justo el caso del asistente.

### 1.7 El paso 4 y el editor (06:00 – 06:30) — muy bien

«Tu invitación ya tiene diseño — XV años · plantilla «xv-jardin». Dentro del editor cambias textos,
fotos y colores, y publicas cuando esté lista. **Nada se ve en internet hasta que tú lo publiques.**»
`[V]` `m25-paso4.png`. La promesa es clara y honesta; lo único que sobra es **«xv-jardin»**, que
parece un nombre de archivo. **Corregido** (§3.2): ahora dice «XV Jardín».

«Abrir mi invitación» → el editor en **3,0 s**. `[V]` `m26-editor.png`. A la izquierda **secciones de
XV años**: Portada, **La quinceañera**, **Mis papás y padrinos**, Itinerario, Galería, Mesa de
regalos, Código de vestimenta, Confirmación, Pie. **Ni «Los novios» ni «Nuestros padres y padrinos»
de boda: UX-N-02 cerrada también aguas abajo.** Arriba: volver, «Publicar», deshacer/rehacer, «Todo
guardado» y las pestañas «Editar / Vista previa» (el diseño de una columna que pedía la fase 3).

Pega: los nombres se cortan —«La quinc…», «Confirma…»— porque la insignia «SIEMPRE VISIBLE» se queda
con el sitio. En una lista donde lo que tengo que reconocer es el nombre, lo que se lee entero es la
etiqueta. `[V]` `m26-editor.png`.

### 1.8 Cambiar dos textos (06:30 – 07:00) — perfecto

Toco «Portada» y se abre un panel con rótulos que entiendo: *Nombre en portada, Subtítulo, Fecha del
evento, Foto de portada, Texto alternativo*. Cambio el subtítulo a «Mariana»: el indicador pasa a
«Sin guardar» y a **«Guardado 03:26 a.m.»** en 3,0 s, y la vista previa muestra mi texto. `[V]`
`m28`, `m29`. **En ningún momento dudé de si mi trabajo estaba guardado.**

Y **la fecha ya se puede cambiar**: bajo «20 de marzo de 2027» hay un botón **«Cambiar la fecha»** y
la frase «Se toma de los datos de tu invitación… y puedes cambiarla aquí», que abre un campo de fecha
con «Guardar la fecha» / «Cancelar». `[V]` `m30-cambiar-fecha.png`. Los cinco minutos perdidos de la
fase 3 se han vuelto un botón. Igual que el pie **«JPG, PNG o WebP · hasta 8 MB»** bajo «Elegir foto»,
que antes solo estaba en la galería.

### 1.9 Poner mi foto (07:00 – 07:20) — funciona, y se lleva por delante mi descripción

«Elegir foto» → recortador dentro del panel (imagen de 358×239) → «Usar esta foto» (**5,1 s**) → la
portada cambia y aparece «Punto focal · Horizontal / Vertical». `[V]` `m34`, `m35`.

Lo que nadie me dijo: **el «Texto alternativo» que había escrito antes se borró solo.** Volví a
mirar el campo tras aplicar la foto y estaba vacío (`v: ""`), sin aviso, y el rótulo de la foto es
«Foto de portada\*», obligatoria. `[V]` Es el defecto simétrico del de la fase 3 (allí el texto de la
foto anterior se quedaba pegado; aquí el mío desaparece).

### 1.10 Cambiar la paleta (07:20 – 07:40) — bien y a mano

Al final de la lista, bajo **APARIENCIA**, hay **Paleta** («Jardín», «Lila», cada una con su «Aa»
tintada) y **Tipografía**. Toco «Lila» y la invitación entera cambia de color en la vista previa y se
guarda en 2,7 s. `[V]` `m31`, `m32`. Con nueve secciones el bloque queda casi a la vista; los nombres
siguen sin necesitar que nadie me explique qué es un `paletteId`.

### 1.11 Publicar (07:40 – 08:30) — la mejor pantalla, y la revisión mira poco

«Publicar» abre: «Antes de publicar revisamos tu invitación: **Sigue con el texto de ejemplo**
[Completar]» y «Todavía no se puede publicar…», con «Publicar» inhabilitado. `[V]`
`m37-dialogo-publicar.png`. Me gusta que revise. Dos peros:

1. **No dice qué texto ni de qué sección.** Tuve que adivinar (era «Nombre en portada»).
2. **«Completar» aparenta no hacer nada en móvil**: cierra el diálogo y me deja mirando la pestaña
   «Vista previa». Sí había abierto el panel de Portada por debajo, pero para verlo hay que tocar
   «Editar». `[V]` `m38-completar.png` / `m38-tras-completar.png`.

Arreglo el texto, vuelvo: «**Todo listo para publicar.**» `[V]` `m39-publicar-2.png`. Publico en
**5,0 s** y sale la mejor pantalla del producto `[V]` `m40-publicado.png`:

> **Tu invitación está en vivo**
> EL ENLACE DE TUS INVITADOS · `http://127.0.0.1:3110/i/pub_N8FW18CQQRANAMGJRAFR1QV5NG`
> [Copiar enlace] · Ver como invitado · **Compartir por WhatsApp**
> Publicada el 6 de septiembre, 03:32 a.m. · Despublicar · Generar un enlace nuevo

**El enlace ya no dice `localhost`**: es el origen real, el mismo por el que estoy navegando, y el de
WhatsApp también (`wa.me/?text=http%3A%2F%2F127.0.0.1%3A3110%2Fi%2F…`). `[V]` La U-6 de la fase 3
está cerrada. «Copiar enlace» copia de verdad (leí el portapapeles) y sale un aviso que dice qué hacer
con lo copiado: «Enlace copiado. **Ya puedes pegarlo en WhatsApp.**» `[V]` `m41-copiado.png`.

**Pero al cerrar ese panel, el enlace desaparece del producto.** «Mis invitaciones» lista la
invitación con «Seguir editando» y **no dice que esté publicada ni ofrece el enlace**; el editor
tampoco. `[V]` `e-08-mis-invitaciones.png`. Volver a pulsar «Publicar» muestra otra vez «Antes de
publicar revisamos tu invitación», **como si no estuviera publicada**, y hay que publicar una segunda
vez para recuperar el panel (mismo token, comprobado — pero yo eso no lo sé). `[V]`
`e-07-publicar-reabierto.png`, `e-09-republicado.png`.

### 1.12 Abrirlo como invitada (08:30 – 09:00) — bonito, y con dos cosas que no debería ver

Contexto nuevo, sin sesión: **HTTP 200 en 1,0 s**, `scrollWidth 390 = clientWidth 390`, las dos
imágenes cargan, cero peticiones fallidas. `[V]` `m42-invitada-portada.png`. La portada es preciosa:
mi foto detrás y el nombre sobre una **tarjeta de papel opaco**, nunca texto encima de la fotografía.

Y entonces leo mi propia invitación como la leería mi tía:

- **Portada: «20 DE MARZO DE 2027». Itinerario: «Misa · 14 DE NOVIEMBRE DE 2026, 5:00 PM ·
  Parroquia».** Dos fechas distintas, con más de cuatro meses de diferencia, y la revisión previa me
  había dicho «Todo listo para publicar». `[V]` `m43-invitada-completa.png`. El guardián existe
  (`apps/web/lib/i18n.ts` → `publicar.avisoFechasDistintas`, la U-4 de la fase 3) pero **no disparó**:
  mira el documento, y la fecha del itinerario venía de los *defaults* de la plantilla, que es de
  donde la lee el invitado.
- **«Nombre de la mamá» / «Nombre del papá»**, literales, publicados. Y «Galería» y «Mesa de
  regalos» con su título y nada debajo. La revisión previa solo miró la portada. `[V]`

## 2. Escritorio 1440×900

Recorrido equivalente `[V]` (`e-01`…`e-09`). **Cero desbordamiento horizontal en todas las
pantallas** (`scrollWidth 1440 = clientWidth 1440`: portada, acceso, asistente, editor, panel de
sección e invitación publicada). El asistente gana los nombres de los pasos («TIPO DE EVENTO ·
PLANTILLA · DATOS BÁSICOS · LISTO»), que en móvil son solo números. «Mis invitaciones» lista bien las
dos invitaciones de la cuenta y distingue «Seguir editando» de «Elegir plantilla». El editor pasa a
dos columnas con «Escritorio / Móvil» y «Ver vista previa». Las fricciones **G-01, G-02, G-03, G-04,
G-05 y G-06 se reproducen igual en escritorio**; las de tamaño (M-07, M-13, B-14) son solo de móvil.

## 3. Lo que corregí yo (con las compuertas en verde)

1. **F-04 · el desbordamiento de 31 px del paso 1** — `apps/web/lib/i18n.ts`,
   `asistente.evento.tuTipo`: «El de tu invitación» → **«Tu evento»**. La insignia pasa de 165 px a
   93 px y cabe en la columna de 97 px. Con ello desaparecen los tres síntomas: el desplazamiento
   horizontal, la barra de acción fuera de la pantalla y los toques que caían en la tarjeta
   equivocada. Antes: `scrollW 421 / clientW 390 / innerW 421`, barra en `top 853` con `innerHeight
   844`. Después: `scrollW 390 / clientW 390 / innerW 390`, barra en `top 788 / bottom 832`,
   `elementFromPoint(290,805)` → el botón. `[V]` Pruebas actualizadas:
   `components/asistente/PasoTipoEvento.test.tsx:48`, `e2e/asistente.spec.ts:68`.
2. **F-08 · el `slug` en el paso 4** — `components/asistente/AsistenteDeCreacion.tsx`: nueva función
   `nombreDePlantilla(slug, catalogo)` y `nombreDeLaPlantilla` sale del catálogo ya cargado. «XV años
   · plantilla «xv-jardin»» → «XV años · plantilla «XV Jardín»». Prueba actualizada:
   `components/asistente/AsistenteDeCreacion.test.tsx:257`.
3. **F-09 · tres frases seguidas diciendo lo mismo al publicar** — `apps/web/lib/i18n.ts`,
   `publicar.descripcionExito`: «Tu invitación ya está en línea.» → «Comparte el enlace con tus
   invitados. Puedes seguir editando y volver a publicar cuando quieras.», que contesta lo que la
   clienta sí se pregunta (¿puedo seguir editando?) y que la fase 3 ya había pedido.

**Compuertas re-ejecutadas después de los tres cambios, salida real** `[V]`:
`pnpm run test` **10/10 tareas — web 517/517 (64 ficheros), ui 654/654, sections 653/653, schema
527/527, icons 179/179, tokens 55/55** · `pnpm run typecheck` **10/10** · `pnpm run lint` **6/6, 0
errores, 1 aviso preexistente y ajeno** (`campoFoto` sin usar) · `pnpm run build` **verde**.

## 4. Tabla de fricciones

| # | Gravedad | Dónde | Qué pasa | Evidencia |
|---|---|---|---|---|
| G-01 | **grave** | `/` → `/acceso` → `/editor` → `/ayuda#planes` | Quien quiere comprar no puede: el asistente dice «contrata un plan», «Ver planes» lleva a unas preguntas frecuentes sin precio, y el único contacto es «escríbenos por el mismo medio por el que contrataste», que no existe si nunca contrataste. Circuito cerrado en 4 toques. | `m11`–`m14` |
| G-02 | **grave** | `/editor` paso 1 | Si todas las invitaciones de la cuenta ya tienen plantilla, el paso 1 es una pregunta sin respuestas y «Continuar» queda inhabilitado para siempre. `?tipo=xv-anos` de la portada se ignora. | `m05`, `m06` |
| G-03 | **grave** | asistente paso 3, «¿Dónde?» | Rellenar el lugar rompe el guardado: `422 TPL_ITEM_UNKNOWN` en `event.cards[<itemId de los defaults>]`, 3/3 repetible, y «Continuar» no continúa pese a decir «Puedes continuar». Vaciando el campo, 200. Le pasa a toda invitación nueva. | `m24`, §1.6 |
| G-04 | **grave** | publicar → invitada | Se publica con dos fechas distintas (portada 20-mar-2027, itinerario 14-nov-2026) y la revisión dice «Todo listo para publicar». El guardián U-4 no ve las fechas que vienen de los *defaults*. | `m43` |
| G-05 | **grave** | publicar → invitada | Se publica con «Nombre de la mamá», «Nombre del papá» y secciones vacías con título. La revisión solo mira la portada. | `m43` |
| G-06 | **grave** | tras publicar | Cerrado el panel, el enlace público no está en ninguna pantalla. Hay que volver a publicar para recuperarlo, y el diálogo no dice que ya esté publicada. | `e-07`–`e-09` |
| M-07 | media | paso 1, 390 px | 31 px de desplazamiento horizontal → barra de acción fuera de pantalla y toques en la tarjeta equivocada. **CORREGIDO** | `m17`, `m18`, `m50` |
| M-08 | media | diálogo de publicar | «Sigue con el texto de ejemplo» no dice qué campo ni de qué sección. | `m37` |
| M-09 | media | diálogo de publicar, móvil | «Completar» deja la pestaña en «Vista previa»: parece que no hace nada. | `m38` |
| M-10 | media | Portada | Subir una foto borra sin avisar el «Texto alternativo» ya escrito. | §1.9 |
| M-11 | media | lista de secciones, móvil | Nombres truncados («La quinc…», «Confirma…») porque «SIEMPRE VISIBLE» se queda el espacio. | `m26` |
| M-12 | media | acceso | Una contraseña que no cumple la política responde «Algo salió mal. Inténtalo de nuevo.» en vez de «El correo o la contraseña no coinciden». | `m52`, `m53` |
| B-13 | baja | todo el producto, móvil | Objetivos táctiles de 36 px de alto en acciones secundarias («Volver a secciones» 170×36, «Cambiar la fecha» 165×36, «Elegir foto» 123×36, «Usar esta foto» 149×36, «Copiar enlace» 145×36, «Despublicar» 99×36, «Generar un enlace nuevo» 186×36) e interruptores de sección de 48×28. | `m27`, `m40` |
| B-14 | baja | paso 4 | Mostraba el `slug` «xv-jardin». **CORREGIDO** | `m25` |
| B-15 | baja | panel de publicado | Tres frases seguidas afirmando lo mismo. **CORREGIDO** | `m40` |
| B-16 | baja | crear cuenta | «Tres datos y ya» pero son cuatro campos en tres pasos. | `m08` |
| B-17 | baja | acceso | «Usa el mismo correo y la misma contraseña con los que **contrataste** tu invitación» le habla a quien ya compró; quien llega desde «Empezar mi invitación» no ha contratado nada. | `m02` |
| B-18 | baja | paso 1 | Las ocho tarjetas llevan un icono de fotografía sobre un degradado, que se lee como «imagen rota» ocho veces en la pantalla que pide elegir. | `m15` |
| B-19 | baja | URL | Identificadores internos en inglés a la vista: `?paso=plantilla&tipo=quince&inv=4&plantilla=xv-jardin`, `tipo=baptism`. | §1.4 |
| B-20 | baja | vista previa del editor | Una foto de la plantilla (`alt="Valentina"`) no carga en el lienzo aunque el mismo fichero responde 200 y sí carga en la invitación publicada. | §1.9 |

**Tiempos y toques medidos (móvil, hasta abrir el enlace como invitada)**: **59 toques**, ~**40 s**
de espera real de máquina repartidos así `[V]`: portada 0,88 s · acceso 1,77 s · alta de cuenta
3,06 s · paso 1→2 2,0 s · paso 2→3 2,5 s · paso 3→4 2,5 s · abrir editor 3,0 s · abrir panel 1,5 s ·
guardar texto 3,0 s · subir foto 3,6 s · aplicar recorte 5,1 s · abrir «Publicar» 2,5 s · publicar
5,0 s · copiar 1,2 s · invitada 1,0 s. El tiempo humano no está acotado por estas cifras sino por los
dos muros: en G-01 y G-02 **no hay tiempo que medir, porque no hay salida**.

## 5. Las tres verificaciones pedidas

- **UX-N-01 · cerrada.** `GET /` responde 200 con una portada en `es-MX`, con marca, navegación,
  «Empezar mi invitación», tipos de evento, planes y pie. Cero desbordamiento a 390 y a 1440. `[V]`
- **UX-N-02 · cerrada, y por partida doble.** El paso 2 dice «Solo plantillas de XV años» y devuelve
  **1 resultado (XV Jardín)**; «Boda clásica» no aparece. El editor de la invitación resultante trae
  «La quinceañera» y «Mis papás y padrinos», **ninguna sección de boda**. `[V]` `m20`, `m26`.
- **UX-N-03 · cerrada en lo que importaba, con una arista nueva.** La política de contraseñas ya no
  se publica en el formulario de entrada: aparece como ayuda del campo en «Crear cuenta», que es su
  sitio. Pero el `400` de una contraseña que no cumple la política se muestra ahora como **«Algo salió
  mal. Inténtalo de nuevo.»**, mientras que una credencial mal escrita que sí cumple la política da el
  mensaje bueno («El correo o la contraseña no coinciden»). Para la clienta las dos situaciones son
  la misma. Anotado como M-12. `[V]` `m52`, `m53`.

## 6. Lo que no pude hacer, y dos avisos sobre el arranque

- **No pude recorrer el flujo como clienta de verdad**: sin la inserción SQL de `invitation` el
  recorrido termina en el paso 1 (G-01/G-02).
- **No pude guardar el lugar del evento** en el asistente (G-03); lo dejé vacío para poder seguir.
- No probé la foto de más de 8 MB ni el RSVP del invitado: quedaron fuera por presupuesto de
  contexto.

Dos cosas del arranque que **no son fricciones del producto** pero cuestan una hora a quien las pise:

1. `pnpm --filter web run build` **no** ejecuta el `build` de `@invitaciones/ui`, que es quien copia
   los `.woff2` a `apps/web/public/fonts/` (`packages/ui/scripts/copiar-fuentes-publicas.ts`). Con esa
   receta el sitio arranca con las tres voces tipográficas en **404** y cae a las fuentes del sistema
   —justo lo que la fase prohíbe— sin ningún error visible. `[V]` La compuerta buena es `pnpm run
   build` desde `frontend/` (turbo respeta `^build`).
2. Con el backend en un puerto distinto de 6003 hay que exportar **también**
   `NEXT_PUBLIC_CDN_ORIGIN`: la CSP del lienzo se arma en `apps/web/proxy.ts:107` con
   `img-src … http://127.0.0.1:6003` por defecto y **bloquea todas las imágenes de la vista previa
   del editor** (`m29`, `m32` son de ese momento). `apps/web/next.config.ts:55` fija además el puerto
   6003 en `images.remotePatterns`, y eso no depende de ninguna variable. `[V]`

Sin commit ni push. Backend parado y sin procesos vivos al terminar.
