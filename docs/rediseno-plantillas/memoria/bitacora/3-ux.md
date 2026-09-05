# 3-UX — revisión de experiencia de uso, sin instrucciones

**Quién soy en este documento.** No construí nada de esto y, a propósito, no leí una sola línea de
`diseno/04-frontend-y-editor.md`, de los handoffs ni del código de la interfaz antes de terminar el
recorrido y escribir los hallazgos. Me puse en el lugar de la persona que va a pagar el producto:
alguien que organiza su boda, sabe usar un teléfono y comprar por internet, y **no sabe** qué es un
bloque, una revisión, un token ni una plantilla versionada.

**Lo que intenté hacer, y nada más** (el criterio de terminado del dueño):
> entrar, elegir una plantilla, cambiar los nombres y la fecha, poner una foto propia, cambiar los
> colores, quitar una sección que no quiere, publicar la invitación y abrir el enlace como lo haría
> un invitado.

**Entorno.** Backend real en `127.0.0.1:6003` (sembrado con `scripts/seed-demo.sh`), frontend
compilado y servido en producción (`pnpm build && pnpm start`, puerto 3100), Chromium real conducido
por Playwright sobre CDP. `1440×900` para escritorio y `390×844` para móvil.
Marcas: `[V]` = lo viví ejecutándolo · `[I]` = inferido.

**Respuesta corta: no. No pude completar la tarea sin ayuda.** Me atasqué dos veces de forma
terminal y en ambas tuve que hacer algo que ninguna clienta puede hacer (llamar a la API con `curl`,
escribir en `sessionStorage`, teclear una URL con un id interno). Todo lo que evalúo después del
segundo atasco lo evalúo con una llave maestra que la clienta no tiene.

---

## 1. La narración, paso a paso

### 1.1 Entrar (00:00 – 03:00) — dos muros seguidos

Escribo la dirección del sitio y me sale **`404 · This page could not be found`**, en inglés, sobre
una página en blanco, sin logotipo, sin un enlace para seguir. `[V]` — evidencia `01-raiz.png`.
No es el fin del mundo (supongo que hay un sitio de marketing en otra parte), pero es el primer
contacto y está en otro idioma.

Voy a `/editor`. La página carga rápido y bonita: **«Elige una plantilla — Elige el punto de partida
para tu invitación.»**. Eso lo entiendo a la primera, sin pensar. Y justo debajo, una caja gris:

> **«Tu sesión no es válida o expiró. Inicia sesión de nuevo.»**

`[V]` — evidencia `02-editor-entrada.png`.

Y aquí me quedé quieta. **Me dice que inicie sesión de nuevo y no hay dónde.** No hay botón «Iniciar
sesión», no hay campo de correo, no hay «¿olvidaste tu contraseña?». Arriba a la derecha veo
«Ayuda» y «Mi cuenta»; hago clic en las dos. **Las dos son `href="#"`: no hacen absolutamente
nada.** `[V]` — `03-mi-cuenta.png`, `04-ayuda.png`. La URL solo gana una almohadilla.

Además el mensaje me acusa de algo que no hice: dice que mi sesión «expiró», y yo nunca inicié
sesión. Una persona lee eso y piensa «¿me borraron la cuenta?».

> **Aquí es donde una clienta de verdad cierra la pestaña.** Minuto 3. No hay ninguna salida.
> No existe pantalla de acceso en toda la aplicación: las rutas compiladas son `/editor`,
> `/editor/[invitationId]`, `/editor/[invitationId]/canvas`, `/i/[publicToken]` y
> `/preview/[invitationId]`. No hay `/login`. `[V]`

Para poder seguir evaluando hice lo que ninguna clienta puede hacer: pedí un token a
`POST /auth/token` con `curl` y lo escribí a mano en `sessionStorage` bajo la clave
`invitaciones.auth.token`. Dejo constancia de que **a partir de este punto ya no estoy midiendo el
producto que recibe una clienta**, sino el que recibe alguien con una llave maestra.

### 1.2 Elegir una plantilla (03:00 – 06:00) — el muro definitivo

Con la sesión inyectada, el catálogo aparece: dos tarjetas, «Boda clásica» y «XV Jardín», cada una
con su tipo de evento y su condición de plan, y un botón morado grande **«Elegir esta plantilla»**.
`[V]` — `05-catalogo-plantillas.png`.

Tres cosas me chirrían antes de tocar nada:

1. **No veo cómo son las plantillas.** El espacio de la imagen de cada tarjeta está ocupado por el
   iconito de imagen rota. Estoy en la pantalla que se llama «Elige una plantilla» y no puedo ver
   ninguna. `[V]` — *Honestidad: la causa aquí es del entorno*, Next 16 se niega a optimizar
   imágenes servidas desde una IP de bucle local (`upstream image … resolved to private IP`), y en
   producción sobre S3/HTTPS cargarían. **Lo que sí es del producto** es que cuando la vista previa
   falla no queda nada: el `alt` de esas imágenes está **vacío**, no hay color de reserva, ni el
   nombre de la plantilla sobre el hueco, ni un «vista previa no disponible». La tarjeta se degrada
   a un icono roto. `[V]`
2. **«Requiere el plan 2 o superior».** ¿Cuál es mi plan? ¿Soy el 1, el 2? Nadie me lo dice, ni hay
   enlace a «ver planes». Es un número interno puesto delante de la clienta.
3. Los dos filtros de arriba, **«Todas» e «Incluidas en mi plan», están desactivados de forma
   permanente** (`disabled`), pero pintados como píldoras de color que invitan a pulsarlas. `[V]`

Hago clic en **«Elegir esta plantilla»** de Boda clásica. Espero. Cuento cuatro segundos. No pasa
nada. Ni navegación, ni rueda de carga, ni mensaje, **ni una sola petición al servidor**. Pruebo con
la otra tarjeta, la que sí está incluida en todos los planes. Tampoco. Vuelvo a la primera. Nada.
`[V]` — `06-tras-elegir-plantilla.png`, `07-boton-inerte.png`.

Lo comprobé en el DOM: es un `<button type="submit">` **que no está dentro de ningún formulario**
(`form: false`) y no tiene manejador de clic. No es que falle: es que no puede hacer nada.

> **Este es el hallazgo que hunde el criterio de terminado.** El segundo verbo de la lista del dueño
> —«elegir una plantilla»— es literalmente imposible. Ninguna clienta llega más lejos que esta
> pantalla. Yo seguí escribiendo `/editor/3` a mano en la barra de direcciones, con un id de
> invitación que solo conozco porque me lo imprimió un script de siembra.

### 1.3 El editor (06:00 – 08:00) — y aquí el producto cambia de calidad

`/editor/3` carga en unos 5 s y **me gusta lo que veo**. `[V]` — `09-editor-invitacion.png`.
A la izquierda una lista de secciones con nombres que entiendo sin traducir: *Portada, Los novios,
Nuestros padres y padrinos, Itinerario, Galería, Nuestra historia, Mesa de regalos, Recomendaciones,
Amenidades, Código de vestimenta, Confirmación, Pie*. A la derecha, mi invitación de verdad,
grande. Arriba: deshacer, rehacer, «Escritorio / Móvil», **«Todo guardado»** y «Publicar».

Sé qué es cada cosa de un vistazo. **Esto se entendió a la primera y hay que decirlo.**

Lo único que sobra en esa cabecera es **«boda-clasica · versión 194»**. `boda-clasica` con guion y
sin acento parece un nombre de archivo, y «versión 194» me alarma: ¿hice 194 versiones? ¿estoy en la
buena? Es contabilidad interna puesta al lado de mi nombre de marca. `[V]`

También noto que **no hay ningún sitio donde vea «mis invitaciones»**. Si mañana vuelvo, ¿cómo
encuentro esta? `/editor` solo ofrece empezar de cero. `[V]`

No hay ninguna pista de que haya que hacer clic en una sección para editarla —ni un «Selecciona una
sección», ni un cursor distinto—, pero es lo bastante obvio: hago clic en **«Portada»**.

### 1.4 Cambiar los nombres (08:00 – 09:00) — perfecto

Se abre un panel con **«‹ Volver a secciones»**, el título «PORTADA» y campos con etiquetas que
entiende cualquiera: *Nombres en portada, Subtítulo, Fecha del evento, Foto de portada, Texto
alternativo, Punto focal, Texto del botón*. `[V]` — `10-panel-portada.png`.

Selecciono «Ana Sofía & Diego», escribo «Mariana & Rodrigo» y **el nombre cambia en la invitación
grande mientras tecleo**. Arriba, el indicador pasa de «Todo guardado» → «Sin guardar» → **«Guardado
03:21 a.m.»** en unos 2 s. `[V]` — `11-nombres-cambiados.png`.

**En ningún momento dudé de si mi trabajo estaba guardado.** Esto es lo mejor del producto.

### 1.5 Cambiar la fecha (09:00 – 14:00) — cinco minutos buscando algo que no existe

Bajo la vista al campo siguiente:

> **Fecha del evento** 🔒
> `18 de abril de 2027`
> *Se toma de los datos de tu invitación.*

Está bloqueado. Vale, ¿y dónde están «los datos de mi invitación»? **No hay enlace, ni botón, ni
nombre de pantalla.** La frase me dice que existe otro sitio y no me dice cuál. `[V]`

Me pongo a buscar. Abro **Los novios**: al final hay otro campo **«Fecha» 🔒** con exactamente el
mismo texto. Abro **Confirmación**: hay «Fecha límite para confirmar», que es otra cosa. Abro
**Itinerario**: ahí sí hay fechas editables, «Cuándo · Empieza / Termina» por cada momento del día.

Cambio la ceremonia del 18 de abril al 22 de mayo de 2027. Se guarda. Vuelvo a Portada:
**la portada sigue diciendo «18 de abril de 2027»** y nadie me avisa de que ahora mi invitación
tiene dos fechas distintas. `[V]` — `14-fecha-itinerario.png`, `15-portada-tras-cambiar-itinerario.png`.

> Esto es un accidente con consecuencias reales: los invitados leen la portada, se apuntan el 18 de
> abril, y la boda es el 22 de mayo. El producto no lo impide ni lo menciona al publicar.

**No conseguí cambiar la fecha de la boda. En todo el editor no hay ningún campo que la cambie.**
Tercer verbo del criterio de terminado, también imposible.

Un detalle más de esa pantalla del itinerario: al cambiar solo la hora de inicio salta en rojo
**«La hora de fin no puede ser antes que la de inicio.»** El mensaje está bien escrito, pero (a) lo
que se descuadró fue la *fecha*, no la «hora», y (b) el aviso sale bajo **«Empieza»**, que es el
campo que yo acabo de dejar bien, no bajo «Termina», que es el que habría que arreglar. Y mientras
el error está en pantalla, **arriba sigue diciendo «Guardado»** — así que no sé si mi cambio entró o
no. `[V]`

### 1.6 Poner una foto propia (14:00 – 17:00)

En «Foto de portada» hay un botón **«Cambiar foto»**. Lo pulso, elijo un JPG mío de 272 KB y
aparece, **dentro de la misma columna de 292 px**, un recortador: mi foto en miniatura con un
rectángulo de puntos y cuatro tiradores, y abajo «Usar esta foto» / «Cancelar». `[V]` —
`18-foto-subida.png`.

Los botones se entienden. El problema es el tamaño: **estoy encuadrando la foto que va a ocupar la
portada entera de mi invitación en una tira de tres centímetros**, sin lupa, sin «ver más grande»,
sin una sola frase que me diga qué estoy haciendo. Pulso «Usar esta foto» y funciona: la portada
cambia en el acto. `[V]` — `19-foto-aplicada.png`.

Y entonces veo lo que nadie tocó:

> **Texto alternativo:** «Lámina de papelería con una guirnalda de olivo dibujada a mano»

Es la descripción de la **foto anterior**, pegada a la mía, que no tiene ninguna guirnalda. El
producto no la borra, no me pregunta, no la marca. Se publicará describiendo una imagen que ya no
existe. `[V]`

### 1.7 Cuando algo falla: la foto demasiado grande (17:00 – 19:00)

Pruebo con una foto de 27 MB (6000×4500), como las que salen de un móvil moderno. Pulso «Cambiar
foto», la elijo… **y no pasa nada visible.** El panel se queda exactamente igual. Ni recortador, ni
rueda, ni rojo. Lo intentaría otra vez con el mismo archivo. `[V]` — `21-foto-enorme-resultado.png`.

El mensaje **sí existe**, y es de los mejores del producto:

> «Esta foto pesa más de 8 MB. Elige otra o recórtala antes de subirla.»

Pero está pintado en `y = 928` con la ventana en 900: **28 píxeles por debajo del borde visible**, y
además **lejos del botón que falló**, encajado entre los deslizadores de «Punto focal» y «Texto del
botón». El panel no se desplaza solo hasta él. `[V]` — `22-error-8mb-tras-desplazar.png`.

Y hay una asimetría que explica la sorpresa: la **galería** sí avisa antes, en su zona de arrastre —
«JPG, PNG o WebP · hasta 8 MB · máximo 12 fotos» `[V]` (`27-clic-galeria.png`)— mientras que
**«Cambiar foto» de la portada no dice nada** de formatos ni de peso. `[V]`

### 1.8 Cambiar los colores (19:00 – 20:00) — bien, pero enterrado

Vuelvo a la lista y bajo. Al final de todo, tras las doce secciones, hay un bloque **APARIENCIA**
con **Paleta**: «Rosa empolvado», «Olivo y marfil», «Azul noche», cada una con su muestra de color;
y **Tipografía**: «Serif elegante» / «Moderna» con una «Aa» de muestra. `[V]` — `23-apariencia.png`.

**Los nombres son perfectos.** Ninguna clienta necesita saber qué es un `paletteId`. Pulso «Azul
noche» y la invitación entera cambia de color en la vista previa, y se guarda. `[V]` —
`24-paleta-azul-noche.png`.

La única pega: para cambiar los colores —una de las tres cosas que más quiere tocar cualquiera— hay
que desplazarse por debajo de doce secciones, hasta un encabezado gris pequeño en mayúsculas.

### 1.9 Quitar una sección (20:00 – 21:00) — inmediato

«Mesa de regalos» tiene un interruptor. Lo apago. Se guarda. `[V]` — `26-mesa-regalos-quitada.png`.
Las secciones que no se pueden quitar dicen **«Siempre visible»** en vez de tener interruptor, lo
cual explica la ausencia sin que yo tenga que preguntarme nada. Muy bien resuelto.

Dos matices: la fila apagada **queda igual que las demás** (solo cambia el interruptor), así que de
un vistazo no sé cuáles quité; y la vista previa se quedó en la portada, o sea que **no vi
desaparecer nada**. Cuando en cambio hago clic en el *nombre* de una sección, **la vista previa se
desplaza hasta ella**, que es exactamente lo que uno espera `[V]` (`27-clic-galeria.png`).

También probé la papelera roja de una foto de la galería: borra sin preguntar, pero **«Deshacer»
funciona y el botón hasta dice qué va a deshacer** («Deshacer: Quitar un elemento de Fotos»). `[V]`
— `28-foto-borrada.png`, `29-tras-deshacer.png`. Me parece bien resuelto; lo que falta es que, justo
al borrar, aparezca ahí mismo un «Foto quitada · Deshacer», porque el icono de arriba está lejos.

### 1.10 Publicar (21:00 – 23:00) — la mejor pantalla del producto, con una bomba dentro

Pulso «Publicar». Sale un diálogo: **«Publicar invitación — Antes de publicar revisamos tu
invitación: Todo listo para publicar.»** con «Cancelar» y «Publicar». `[V]` — `31-publicar-2.png`.
Me gusta que *revise* antes. Me habría gustado que me dijera qué va a pasar (¿lo ven ya todos?
¿puedo seguir editando?).

Confirmo, y sale la pantalla que mejor está hecha de todas `[V]` — `33-publicado.png`:

> **Tu invitación está en vivo**
> ✅ Tu invitación ya se puede ver en internet.
> `http://localhost/i/pub_FCTH3DCWGNP954PYK16F0XH5GV` · **Copiar enlace**
> **Ver como invitado ↗** · **Compartir por WhatsApp ↗**
> Publicada el 5 de septiembre, 03:29 a.m.
> *Despublicar · Generar un enlace nuevo*

Compartir por WhatsApp es exactamente el botón que quiere alguien en México. Y entonces leo el
enlace otra vez: **`http://localhost/...`**. Ese es el texto que «Copiar enlace» pone en mi
portapapeles y el que «Compartir por WhatsApp» mete en el mensaje
(`wa.me/?text=http%3A%2F%2Flocalhost%2F…`). `[V]` Si lo mando a doscientos invitados, **a ninguno le
abre**; y si yo misma pulso «Ver como invitado» tampoco me abre a mí. Lo comprobé:
`ERR_CONNECTION_REFUSED`. `[V]` — `36-enlace-localhost-invitado.png`.

Probé también los dos enlaces pequeños de abajo. **«Generar un enlace nuevo» no hace nada**: ni
petición, ni confirmación, ni cambio de token. **«Despublicar» tampoco**: la invitación sigue en
línea después de pulsarlo. `[V]` — `35-tras-generar-enlace.png`, `52-despublicado.png`,
`53-invitado-despublicada.png`. Son los mismos botones muertos del catálogo.

### 1.11 Abrir el enlace como un invitado (23:00 – 25:00) — y la invitación es la de antes

Abro la invitación con la URL que sí funciona en este entorno. **La página del invitado es preciosa
y funciona.** `[V]` — `37-invitado-portada.png`, `45-movil-invitado.png`. Tipografía cuidada, se lee
perfecta en móvil (390 px sin desbordes), las imágenes llevan descripciones de verdad
(«Lámina de papelería con una guirnalda de olivo dibujada a mano», «Estudio botánico 1 de la
papelería de Ana Sofía y Diego»), hay enlaces «Ver en el mapa».

Pero el nombre que aparece **no es el que acabo de publicar**. Lo medí en frío: publiqué
«Paulina & Emilio», el diálogo me dijo «✅ Tu invitación ya se puede ver en internet», y a los
0 s, 2 s, 5 s y 10 s el enlace público seguía sirviendo **«Mariana & Rodrigo»**, la versión
anterior. `[V]`

```
página del invitado ANTES: {"titulo":"Mariana & Rodrigo","cache":"HIT"}
--- publico "Paulina & Emilio" ---
  t+0s  -> {"titulo":"Mariana & Rodrigo","cache":"HIT"}
  t+2s  -> {"titulo":"Mariana & Rodrigo","cache":"HIT"}
  t+5s  -> {"titulo":"Mariana & Rodrigo","cache":"HIT"}
  t+10s -> {"titulo":"Mariana & Rodrigo","cache":"HIT"}
```

La causa se ve en las cabeceras: `Cache-Control: s-maxage=300, stale-while-revalidate=31535700`,
`x-nextjs-stale-time: 300`. Publicar **no invalida** la página del invitado; hay una ruta
`/api/revalidate` en la aplicación, pero **nadie la llama al publicar** (cero peticiones a
`/api/revalidate` en todo el registro del servidor) y el arranque documentado no fija
`REVALIDATE_SECRET`. `[V]` Al cabo de los 300 s la página sí se puso al día.

> La consecuencia para la clienta: publica, el producto le jura que ya está en internet, manda el
> WhatsApp, y **los primeros invitados —y ella misma— ven durante cinco minutos la invitación
> anterior**. Si en esos cinco minutos corrigió el nombre de su suegra, la ven mal.

### 1.12 Cuando algo falla: sin conexión (25:00 – 27:00) — lo mejor y lo peor, a diez centímetros

Simulo quedarme sin internet (como en el metro) y sigo escribiendo. Arriba aparece:

> **«Sin conexión — tus cambios se guardarán cuando vuelva»**

`[V]` — `40-sin-conexion.png`. Es tranquilizador, está en mi idioma y me dice exactamente lo que
necesito. Y cumple: al volver la conexión, se guardó solo. `[V]`

Con la misma conexión caída pulso «Publicar». El diálogo dice:

> **Failed to fetch**  ·  [Reintentar]

`[V]` — `42-publicar-sin-conexion.png`. En inglés, en jerga de programador, en la misma pantalla en
la que el aviso de al lado estaba impecable.

### 1.13 Publicar bloqueado: lo que no me dijo

Quise ver qué pasa cuando falta algo obligatorio. Borré «Nombres en portada*». El campo avisa en
rojo: **«Escribe al menos 1 caracteres.»** (así, en plural, y con la voz de una restricción técnica
en vez de una instrucción: «Escribe los nombres de los novios» diría lo mismo mejor). `[V]`

Con el campo vacío en pantalla y el error en rojo, pulso «Publicar» y el diálogo me contesta
**«Todo listo para publicar.»** `[V]` — `38-campo-obligatorio-vacio.png`, `39-publicar-bloqueado.png`.
La comprobación previa da `canPublish: true` porque el valor inválido nunca llegó a guardarse —
correcto por dentro, **contradictorio por fuera**: la pantalla me dice a la vez que falta algo y que
no falta nada. Si publico, sale con el nombre viejo y nadie me avisa de que lo que estaba
escribiendo se descartó.

En esa misma respuesta el servidor dice `sameAsActiveRelease: true` («no hay nada nuevo»), y aun así
el diálogo ofrece publicar como si hubiera cambios.

**Nunca llegué a ver un publicado bloqueado de verdad**, así que no puedo juzgar si la lista de
«qué te falta y dónde» está bien redactada: con la clienta editando normalmente, los valores
inválidos no se guardan y la comprobación previa nunca encuentra nada. Eso hace que el mecanismo de
bloqueo, exista o no, no le llegue nunca a la persona.

### 1.14 En el teléfono (27:00 – 29:00)

Abro el editor en un iPhone (390×844) y **no se puede usar**. `[V]` — `44-movil-editor.png`.

- La página mide `scrollWidth = 572` con `clientWidth = 390`: **desborda 182 px a lo ancho**.
- El botón **«Publicar» está en `x = 481`, fuera de la pantalla**. No puedo publicar desde el móvil
  sin arrastrar la página de lado.
- La **vista previa no se ve en absoluto**: solo hay lista de secciones.
- Los iconos de deshacer/rehacer se **encabalgan sobre la palabra «Invitaciones»**, y «Todo
  guardado» queda cortado en «Toc…».
- No hay un diseño de móvil: es el de escritorio estrujado.

La **página del invitado**, en cambio, va perfecta en 390 px (`scrollWidth = clientWidth = 390`).
`[V]` — `45-movil-invitado.png`.

A 320 px, sin sesión, el editor enseña un mensaje **distinto** del de `/editor`:
**«Sesión inválida o token ausente/expirado.»** con un botón «Reintentar». `[V]` —
`46-320-editor.png`. Dos cosas: la palabra **«token»** delante de la clienta, y un «Reintentar» que
no puede funcionar nunca porque no hay forma de iniciar sesión.

---

## 2. El recorrido solo con teclado

Lo hice entero desde `/editor/3`, sin ratón. **Se puede terminar la tarea** (dentro de lo que el
producto deja terminar): abrir una sección, escribir los nombres, apagar una sección, cambiar la
paleta y abrir el diálogo de publicar. `[V]` — `47-teclado-foco.png`, `48-teclado-paleta.png`,
`49-teclado-dialogo.png`.

**Lo que está bien, y es bastante:**

- **Todos los controles reciben foco y todos muestran un anillo de 3 px bien visible.** No encontré
  ni una trampa de foco ni un control inalcanzable.
- El orden de tabulación sigue el orden visual, fila a fila:
  `Invitaciones → Escritorio → Móvil → Publicar → (Reordenar · nombre · interruptor · Más opciones)×12 → APARIENCIA`.
- Los interruptores se accionan con **Espacio** y su nombre accesible **cambia de estado**:
  «Ocultar Amenidades» → «Mostrar Amenidades». `[V]`
- El **diálogo de publicar atrapa el foco correctamente** (Cerrar → Cancelar → Publicar → vuelta a
  empezar), **Escape lo cierra** y **el foco vuelve al botón «Publicar» que lo abrió**. Esto es de
  manual y está bien hecho. `[V]`
- El recortador de fotos **se maneja con las flechas**. `[V]`
- `axe-core` (WCAG 2.0/2.1/2.2 A + AA) da **0 violaciones** en el editor, en el catálogo y en la
  página del invitado. `[V]`

**Lo que falla:**

- **Al pulsar Enter sobre el nombre de una sección, el foco se cae a `<body>`.** El panel se abre y
  quien navega con teclado o lector de pantalla se queda al principio del documento, sin aviso, y
  tiene que tabular a ciegas hasta encontrarlo. `[V]` (WCAG 2.4.3, 4.1.3)
- **No hay enlaces de salto.** Cada sección cuesta 3–4 paradas: medí **32 tabulaciones** para llegar
  al interruptor de «Amenidades» y **13 más** para la paleta, ~45 desde arriba para cambiar los
  colores. Y desde la paleta, tabulando hacia delante, **nunca volví a «Publicar»**; tuve que
  reponer el foco al principio. `[V]` (WCAG 2.4.1)
- Las instrucciones accesibles del recortador **están en inglés**: «Use the arrow keys to move the
  crop selection area», «…the north west drag handle…». Quien no ve la foto recibe indicaciones en
  otro idioma y con puntos cardinales. `[V]` (WCAG 3.1.2)
- El desbordamiento horizontal de 390 px del editor (§1.14) incumple **WCAG 2.2 AA 1.4.10 Reflow**,
  que exige no tener que desplazarse en dos ejes a 320 px. `[V]`

---

## 3. Tabla de hallazgos

Gravedad: **alta** = impide o hace abandonar · **media** = confunde y cuesta tiempo · **baja** = roce.

| # | Gravedad | Qué esperaba / qué pasó | Heurística · WCAG | Evidencia | Arreglo propuesto |
|---|---|---|---|---|---|
| U-1 | **alta** | Esperaba poder entrar. El editor dice «Inicia sesión de nuevo» y **no existe ninguna pantalla de acceso**; «Ayuda» y «Mi cuenta» son `href="#"`. | N1 visibilidad · N9 recuperación | `02`,`03`,`04` | Añadir la pantalla de acceso y convertir el aviso en un botón **«Iniciar sesión»** que lleve a ella; quitar o cablear los dos enlaces de la cabecera. |
| U-2 | **alta** | Esperaba empezar mi invitación. **«Elegir esta plantilla» no hace nada** (es `type="submit"` fuera de todo formulario, sin manejador) en las dos tarjetas. | N1 · N5 prevención | `06`,`07` | Cablear el botón a la creación de la invitación y navegar a `/editor/{id}`; mientras tanto, estado de carga y error visibles. |
| U-3 | **alta** | Esperaba cambiar la fecha de la boda. **No hay ningún campo que la cambie**: sale bloqueada en Portada y en Los novios con «Se toma de los datos de tu invitación», sin decir dónde están esos datos. | N6 reconocer > recordar · N7 | `10`,`12-losnovios` | Convertir ese texto en un enlace **«Cambiar la fecha del evento →»** que lleve a la pantalla que sí la edita; si no existe, exponer el campo aquí. |
| U-4 | **alta** | Cambié la ceremonia al 22 de mayo en el itinerario y **la portada siguió diciendo 18 de abril**, sin ningún aviso, y así se publica. | N5 prevención de errores | `14`,`15` | En la comprobación previa a publicar, bloquear/avisar cuando la fecha de la portada no coincida con la del primer momento del itinerario. |
| U-5 | **alta** | Publiqué y el diálogo dijo «✅ ya se puede ver en internet», pero **el enlace sirvió la versión anterior durante ~5 min** (`s-maxage=300`, sin invalidación; `/api/revalidate` no se llama nunca al publicar). | N1 visibilidad del estado | §1.11 (medición) | Invalidar la ruta `/i/[publicToken]` al publicar (llamar a `/api/revalidate`); hasta entonces, no afirmar que ya se ve. |
| U-6 | **alta** | El enlace que «Copiar enlace» y «Compartir por WhatsApp» entregan es **`http://localhost/i/…`**; no abre para nadie, ni para la novia con «Ver como invitado». | N1 · N9 | `33`,`36` | Construir el enlace público con el origen público del sitio, no con el `publicUrl` que devuelve el servidor; validar en el arranque que no sea `localhost`. |
| U-7 | **alta** | Subí una foto de 27 MB y **no vi nada**. El mensaje existe y es bueno, pero se pinta 28 px por debajo del borde visible y lejos del botón que falló. | N1 · N9 · WCAG 3.3.1 | `21`,`22` | Mostrar el error **pegado al botón «Cambiar foto»** y desplazar el panel hasta él; y anunciar el límite antes, como ya hace la galería. |
| U-8 | **alta** | En el teléfono (390×844) el editor **desborda 182 px** y **«Publicar» queda fuera de pantalla**; la vista previa no se ve. | WCAG 2.2 AA **1.4.10** | `44` | Diseño de una columna por debajo de ~900 px: lista y vista previa en pestañas, cabecera apilada y «Publicar» siempre visible. |
| U-9 | media | Al publicar sin conexión el diálogo dice **«Failed to fetch»** en inglés, a diez centímetros del impecable «Sin conexión — tus cambios se guardarán cuando vuelva». | N9 · es-MX | `42` | Traducir los fallos de red del publicado con el mismo tono: «No hay conexión. Vuelve a intentarlo cuando regrese el internet.» |
| U-10 | media | Cambié la foto de portada y **el «Texto alternativo» siguió describiendo la foto anterior** («guirnalda de olivo»); así se publica. | WCAG 1.1.1 · N5 | `19` | Al reemplazar la imagen, vaciar el texto alternativo y marcarlo como pendiente («Describe tu nueva foto»). |
| U-11 | media | El campo obligatorio vacío avisa en rojo mientras el diálogo dice **«Todo listo para publicar»**; y lo que escribí se descarta sin decírmelo. | N1 · N9 | `38`,`39` | Que el diálogo lea también los errores del formulario abierto; y avisar «Este cambio no se guardó» cuando un valor inválido se descarta. |
| U-12 | media | «Despublicar» y «Generar un enlace nuevo» **no hacen nada**; y son acciones destructivas sin ninguna explicación de sus consecuencias. | N1 · N5 | `34`,`35`,`52`,`53` | Cablearlas con confirmación explícita: «Los enlaces que ya compartiste dejarán de funcionar». |
| U-13 | media | **No veo cómo es ninguna plantilla**: la vista previa falla y no queda nada (alt vacío, sin color ni nombre de reserva). | N6 · WCAG 1.1.1 | `05` | Reserva visible: fondo con el color de la plantilla + su nombre, y `alt` = «Vista previa de {plantilla}». (El fallo concreto aquí es del entorno; la ausencia de reserva no.) |
| U-14 | media | El error del itinerario dice «La **hora** de fin no puede ser antes que la de inicio» cuando lo descuadrado es la **fecha**, y sale bajo «Empieza», no bajo «Termina». | N9 | `14` | Redactar «El final debe ser posterior al inicio» y anclarlo al campo «Termina». |
| U-15 | media | Recorto la foto de la portada **en una tira de 292 px**, sin lupa, sin ampliar y sin una frase que explique qué hace el rectángulo. | N6 · N8 | `18` | Abrir el recortador en un diálogo grande, con una línea: «Arrastra para elegir qué parte se ve». |
| U-16 | media | Las instrucciones accesibles del recortador están **en inglés** («Use the arrow keys… north west drag handle»). | WCAG 3.1.2 | §2 | Traducir las etiquetas de la librería de recorte al es-MX. |
| U-17 | media | Al abrir una sección con Enter **el foco cae a `<body>`**; y no hay enlaces de salto (≈45 tabulaciones para llegar a los colores). | WCAG 2.4.3 · 2.4.1 | §2 | Llevar el foco al encabezado del panel al abrirlo; añadir «Saltar a apariencia» / «Saltar a publicar». |
| U-18 | media | «boda-clasica · versión 194» al lado de la marca: nombre de archivo y contabilidad interna delante de la clienta, que sube con cada tecleo. | N2 lenguaje del usuario | `09`,`11` | Mostrar «Boda clásica» y quitar el número de versión (o dejarlo en un «Historial»). |
| U-19 | media | **No hay «Mis invitaciones»** en ninguna parte: si vuelvo mañana no sé cómo encontrar la mía. | N6 | `05` | Lista de invitaciones como pantalla de entrada de `/editor`, con «Crear una nueva». |
| U-20 | media | «Requiere el **plan 2** o superior» y los filtros «Todas / Incluidas en mi plan» **desactivados** pero pintados como pulsables. | N2 · N1 | `05` | Nombrar los planes como los nombra la clienta y enlazar a «ver planes»; ocultar los filtros hasta que funcionen. |
| U-21 | media | El botón de la portada dice **«Save the date»**, en inglés, y está 🔒 bloqueado: «lo define el diseño de la plantilla y no se puede editar». | N2 · es-MX | `10`,`45` | Traducir el texto por defecto a «Reserva la fecha» y permitir cambiarlo. |
| U-22 | baja | «Escribe al menos **1 caracteres**» (plural mal) y con voz de restricción técnica. | N2 | `38` | «Escribe los nombres de los novios.» |
| U-23 | baja | La sección apagada **queda igual que las demás**; y la vista previa no se mueve, así que no veo desaparecer nada. | N1 | `26` | Atenuar la fila y etiquetarla «Oculta»; desplazar la vista previa al punto donde estaba. |
| U-24 | baja | La papelera de una foto borra sin preguntar; **«Deshacer» existe y funciona muy bien**, pero está lejos, arriba del todo. | N3 control y libertad | `28`,`29` | Un aviso momentáneo junto a la galería: «Foto quitada · Deshacer». |
| U-25 | baja | «Más opciones» abre un menú que **solo mueve** la sección (Subir/Bajar/Al principio/Al final). | N2 | `43` | Llamarlo «Mover». |
| U-26 | baja | «APARIENCIA» está por debajo de doce secciones, en gris pequeño. | N6 | `23` | Subirlo o duplicar el acceso a los colores en la cabecera. |
| U-27 | baja | La raíz del sitio devuelve el 404 por defecto de Next, **en inglés** y sin salida. | N9 · WCAG 3.1.1 | `01` | Página 404 propia en es-MX con un enlace a la aplicación. |

### Lo que funciona y hay que dejar como está

No inflo la lista: estas cosas se entendieron a la primera y merecen constar.

- **El guardado automático.** «Todo guardado» → «Sin guardar» → «Guardado 03:21 a.m.» en ~2 s.
  **En ningún momento del recorrido dudé de si mi trabajo estaba a salvo.** `[V]`
- **El aviso de sin conexión**: «Sin conexión — tus cambios se guardarán cuando vuelva», y cumple.
- **La vista previa en vivo**: escribo y el nombre cambia en la invitación mientras tecleo; y al
  elegir una sección **la vista previa se desplaza hasta ella**.
- **Los nombres de todo**: secciones («Los novios», «Mesa de regalos», «Código de vestimenta»),
  paletas («Rosa empolvado», «Olivo y marfil», «Azul noche»), tipografías («Serif elegante»).
  Cero jerga. `[V]`
- **«Siempre visible»** en lugar de un interruptor apagado: explica la ausencia sin que preguntes.
- **La ayuda del texto alternativo**: «Describe la foto para quien no puede verla, p. ej. «Ana y Luis
  abrazados frente al mar»». Enseña accesibilidad sin nombrarla.
- **La zona de arrastre de la galería**: «JPG, PNG o WebP · hasta 8 MB · máximo 12 fotos».
- **Deshacer/Rehacer**, que además **nombran la acción** («Deshacer: Quitar un elemento de Fotos»).
- **La pantalla de publicado**: «Copiar enlace», «Ver como invitado», **«Compartir por WhatsApp»** —
  el canal correcto para México—, fecha de publicación. Salvo el `localhost`, es excelente.
- **El teclado**: anillo de foco visible en todo, orden lógico, trampa de foco correcta en el
  diálogo, Escape cierra y devuelve el foco al botón que lo abrió.
- **La página del invitado**: bonita, rápida, responsiva a 390 px y con textos alternativos
  descriptivos de verdad.
- **`axe-core` AA: 0 violaciones** en las tres pantallas.

---

## 4. Contraste contra `04-frontend-y-editor.md` §6 y §7

*(Leído y escrito **después** de terminar el recorrido y la tabla anterior, tal y como pide el
encargo. Hasta este punto no había abierto el documento.)*

La primera sorpresa al leerlo es agradable: **el diseño había previsto casi todo lo que eché de
menos.** La mayoría de mis hallazgos altos no son huecos de diseño; son promesas escritas que la
implementación no cumplió. Eso cambia el arreglo: no hay que decidir nada nuevo, hay que terminar.

### 4.1 Lo que el diseño prometía y sí está

| Promesa | Qué encontré |
|---|---|
| §7.1 p.8 — «`PREVIEW_THEME` **al pasar el ratón** (sin escribir nada)» | **Cumplido y medido.** Al pasar el ratón por «Azul noche» el lienzo cambia; al salir, vuelve exacto. Capturas `55`/`57` idénticas (md5 `3d20867aaa6d`), `56` distinta. `[V]` |
| §7.1 p.9 — «el interruptor no existe … la fila dice **“siempre visible”**» | Cumplido, palabra por palabra. `[V]` |
| §7.4 — «conmutador … es un **`radiogroup` de dos opciones**, no un `checkbox` sin nombre» | Cumplido: `role="radio"` en «Escritorio» y «Móvil». `[V]` |
| §6.4 — zona de soltar con «JPG, PNG o WebP · hasta 8 MB · máximo 12 fotos» y «GALERÍA — 6 de 12 fotos» | Cumplido, literal. `[V]` |
| §6.2 — asa de arrastre «con alternativa de teclado y de un solo puntero» | Cumplido: «Reordenar X» + menú Subir/Bajar/Al principio/Al final. `[V]` |
| §6.6 — invitado: `lang="es-MX"`, `noindex`, secciones con `aria-labelledby`, cero JS de edición | Cumplido. `[V]` |
| §7.1 p.7 — «*Esta foto pesa más de 8 MB, elige otra o recórtala*» | La cadena está, exacta. Lo que falla es **dónde se pinta** (U-7). |
| §6.5 — panel de publicado con «Copiar», «Ver como invitado ↗», «Compartir por WhatsApp ↗», fecha | Cumplido (salvo el `localhost`, U-6). `[V]` |
| §12 — indicador «Guardando…» → «Guardado 12:41» | Cumplido y mejorado con el estado de sin conexión. `[V]` |

### 4.2 Divergencias — y de quién es la culpa

| # | Lo que §6/§7 prometía | Lo que viví | Culpa |
|---|---|---|---|
| D-1 | §7.1 p.1: «**401 → redirección a login**» | Aviso inerte «Inicia sesión de nuevo» sin ningún acceso, y no existe ruta de login en el `build`. | **Implementación.** El diseño lo tenía resuelto en una línea. (U-1) |
| D-2 | §7.1 p.2: «Pulsa “Elegir” → `POST …/document:choose-template`; botón en `aria-busy`, resto de tarjetas inertes» + tres errores nombrados | El botón **no está cableado a nada**: `type="submit"` fuera de formulario, cero peticiones. | **Implementación.** El flujo estaba especificado entero. (U-2) |
| D-3 | §6.3, textual: «Fecha `[12/12/2026]` 🔒 … *Se toma de los datos de tu invitación.* **`[Editar allí]`**» | Está la frase; **falta el botón `[Editar allí]`**. Eso es exactamente lo que me dejó cinco minutos dando vueltas. | **Implementación.** El diseño había previsto justo mi problema. (U-3) |
| D-4 | §6 (tabla de rutas): «`/api/revalidate` — **Webhook que el backend llama al publicar**» y `/i/[publicToken]` con «ISR + `revalidateTag`» | La ruta existe; **el backend no la llama nunca** (0 peticiones) y el arranque no fija `REVALIDATE_SECRET`. El invitado ve la versión anterior ~5 min. | **Implementación / integración.** El contrato estaba escrito. (U-5) |
| D-5 | §6.5: lista de bloqueos con **`→ [Completar]` / `[Editar]` por línea**, ✗ que bloquea vs ⚠ que no, y «`[Publicar]` ← **deshabilitado** mientras haya ✗» | Con un campo obligatorio vacío en pantalla, el diálogo dijo «Todo listo para publicar» y **«Publicar» seguía habilitado**. Nunca conseguí ver la lista de bloqueos. | **Implementación**, con un hueco de **diseño** detrás: §6.5 sólo contempla bloqueos del servidor y no dice qué hacer cuando el formulario abierto tiene un error que el servidor no ve. (U-11) |
| D-6 | §6.2: la cabecera muestra «**Boda de Ana y Luis**» — el nombre de la invitación | Muestra «**boda-clasica · versión 194**»: una babosa técnica y un contador interno. | **Implementación.** El diseño ponía un nombre humano. (U-18) |
| D-7 | §6.1: la tarjeta bloqueada por plan «**no** es un botón deshabilitado sin explicación» y lleva **`[Mejorar plan]`** en vez de `[Elegir]`; filtros desplegables y «12 resultados» | La tarjeta de plan superior ofrece el mismo «Elegir esta plantilla»; los filtros están **deshabilitados** con aspecto de pulsables; no hay contador. | **Implementación.** (U-20) |
| D-8 | §6.1: cabecera con «`[? Ayuda]`» y «`[Mi cuenta ▾]`» como controles reales | Los dos son `href="#"`. | **Implementación.** (U-1) |
| D-9 | §6.3: la foto lleva **dos** controles, «Cambiar» **y** «Recortar» | Sólo hay «Cambiar foto»; para reencuadrar hay que volver a subir el archivo. | **Implementación.** `[V]` |
| D-10 | §7.1 p.5: «el panel abre `TextField` **con foco**» | Al abrir una sección con Enter **el foco cae a `<body>`**. | **Implementación.** (U-17) |
| D-11 | §7.1 p.7: «**Barra de progreso por archivo**; miniatura optimista» | No vi barra de progreso ni en la portada ni en la galería; con un archivo grande **no hay ninguna señal** de que algo esté pasando. | **Implementación.** (U-7) |
| D-12 | §7.1 p.9: «la sección se **atenúa en el lienzo**» | La sección desaparece del lienzo, pero **la fila del panel queda idéntica** a las visibles. | **Diseño**: §6.2 no dice cómo se ve una fila apagada en la lista. (U-23) |
| D-13 | §6.5: enlace `https://invitaciones.mx/i/01J8ZC…` (origen público real) | Se entrega el `publicUrl` del servidor tal cual: **`http://localhost/i/…`**, también en el mensaje de WhatsApp. | **Implementación/configuración**: el diseño daba por hecho un origen público correcto y no fija quién construye la URL. Hueco menor de diseño, fallo mayor de implementación. (U-6) |
| D-14 | §6.5: el panel posterior a publicar **no contempla** «Despublicar» ni «Generar un enlace nuevo» | Ambos están en pantalla y **ninguno hace nada**. | **Implementación**: se añadió superficie fuera del diseño y se dejó muerta. (U-12) |
| D-15 | §7.5 Flujo E: banner «Tenías cambios sin guardar del 3 de septiembre a las 12:39. `[Aplicarlos] [Descartarlos]`» desde `localStorage["tpl:pending:{id}"]` | No hay ninguna clave `tpl:pending:*`; `localStorage` está vacío. Y como **la sesión vive en `sessionStorage`**, al cerrar la pestaña se pierde el acceso y —sin pantalla de login— el banner no se podría alcanzar nunca. `[V]` clave ausente, `[I]` el resto. | **Implementación.** |
| D-16 | §6.2 es un wireframe de dos paneles a lo ancho; **§7.4 sólo cambia el ancho del `<iframe>`** | En un teléfono real (390 px) **el editor desborda 182 px y «Publicar» queda fuera de la pantalla**. | **Diseño.** No hay ningún wireframe del editor en móvil: §6 sólo dibuja el escritorio y §7.4 confunde «vista previa móvil» con «editar desde un móvil». Es el hueco de diseño más caro del documento. (U-8) |
| D-17 | §6.1: `previewImage` en cada tarjeta | Cuando la vista previa falla no queda **nada**: `alt` vacío, sin color ni nombre de reserva. | **Diseño**: §6.1 no define el estado de fallo de `previewImage` (§7.1 p.1 sólo cubre el fallo de *todo* el catálogo). (U-13) |
| D-18 | §7.1 p.6 remite a «§12.5 (tabla completa de errores de guardado)» y p.10 a «Fallo de red → *No pudimos revisar tu invitación*» | Publicar sin red muestra **«Failed to fetch»** en inglés. | **Implementación**: la cadena en castellano estaba escrita en el diseño. (U-9) |
| D-19 | §6.3: insignia «**⚠ contenido de ejemplo**» cuando `provenance === "default"` | No la vi. **No concluyente**: la invitación sembrada tiene todo el contenido personalizado, así que no había ningún bloque en `default` que la disparara. `[I]` | — |

### 4.3 Lo que ni el diseño ni la implementación cubren

Tres cosas que viví y que **§6-§7 no menciona en absoluto**, así que son huecos de diseño puros:

1. **Coherencia entre la fecha de la portada y la del itinerario** (U-4). §6.3 bloquea la fecha
   «de negocio» y §6.4/§7.1 permiten editar `datetime-local` por momento, pero nadie comprueba que
   las dos digan lo mismo. Es el error más caro que puede cometer una novia y el producto lo deja
   pasar sin decir nada.
2. **El texto alternativo huérfano al reemplazar la foto** (U-10). §6.3 marca el texto alternativo
   como obligatorio, pero no dice qué pasa con él cuando la imagen cambia; el resultado es que se
   publica describiendo una foto que ya no existe.
3. **Dónde vive «mis invitaciones»** (U-19). §6 sólo define `/editor` como catálogo. No hay ninguna
   ruta para volver a una invitación empezada, y el diseño no la echa de menos.

### 4.4 Conclusión del contraste

**Lo que el diseño prometía en §6-§7 es, en lo esencial, un buen producto**, y las partes que se
construyeron completas —el guardado, la vista previa en vivo, la vista previa de paleta al pasar el
ratón, el vocabulario, la pantalla de publicado, el teclado— están a la altura de lo que promete.

Las cuatro fricciones que impiden la tarea (U-1 sin login, U-2 botón inerte, U-3 fecha sin salida,
U-5 invitado desactualizado) son **cuatro líneas del documento que no se cablearon**, no cuatro
decisiones de diseño equivocadas. Y el único hueco de diseño realmente grave es **D-16**: el
documento nunca dibujó el editor en un teléfono, y por eso hoy no se puede usar en uno.

