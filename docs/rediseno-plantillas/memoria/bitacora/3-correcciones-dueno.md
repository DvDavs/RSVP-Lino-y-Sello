# Correcciones visuales del dueño — fase 3

Registro append-only. Cada entrada: qué pidió el dueño, cómo se interpretó, a quién se
delegó, y con qué evidencia se cerró. Regla del prompt de la fase: una corrección visual
del dueño es instrucción de máxima prioridad.

---

## C-01 · 2026-09-04 · Referencia de estilo: `www.gigsalad.com`

**Literal del dueño:** «Me gusta cómo se ve esta web como para adoptar un estilo así, por si
te sirve y si es en donde estamos.»

**Lo que NO pude verificar [V de la limitación, no del contenido]:** el sitio no se puede
abrir desde este entorno — `WebFetch` a `https://www.gigsalad.com` responde
`EGRESS_BLOCKED: Access to www.gigsalad.com is blocked by the network egress proxy`. Es el
mismo bloqueo que impide llegar a Unsplash/Wikimedia (ver `preguntas-abiertas.md`). Por
tanto **no hay medición de sus colores, tipografías ni radios**: lo que sigue es
interpretación `[I]`, y se marca como tal.

**Interpretación tomada `[I]`:** GigSalad es un *marketplace* de servicios para eventos
(música en vivo, animación, proveedores). Su lenguaje visual es el de un SaaS de consumo
moderno: fondo claro, tarjetas con esquinas redondeadas y sombra suave, mucho aire, una
sola familia sans-serif con jerarquía marcada, un acento cálido de alta saturación
reservado a la acción principal, y **fotografía grande como protagonista** en las tarjetas
del catálogo.

**Dónde se aplica y dónde NO — y por qué.** Esta fase tiene DOS superficies visuales que
`contratos.md §8` y `diseno/04 §19` obligan a mantener **duramente separadas**:

1. **El *chrome* del editor** (`apps/web`: catálogo de plantillas, editor de dos paneles,
   diálogo de publicación, indicadores de guardado). Es producto SaaS, se pinta con
   Tailwind + shadcn/ui. **AQUÍ SÍ se adopta la referencia**: es exactamente la misma
   familia de producto y hoy no había ninguna dirección de arte para el chrome más allá de
   "shadcn por defecto", que es genérico.
2. **La invitación** (`packages/sections`, pintada solo con los tokens `--inv-*` del
   paquete de plantilla). **AQUÍ NO se aplica**, y no es una preferencia: una invitación de
   boda o de XV que se vea como un marketplace de servicios sería un mal producto, y
   además P3 y `04 §19` prohíben que el chrome alcance a las secciones (por eso
   `packages/sections` ni siquiera declara `tailwindcss` como dependencia). La invitación
   sigue su propia dirección de arte, la del bloque 3-2d.

**Delegación:** inyectada en vuelo al bloque 3-1 (andamiaje del chrome) con `SendMessage`, y
programada una pasada dedicada de identidad visual del chrome con revisor Opus y capturas,
para que el dueño corrija sobre algo real y no sobre esta interpretación.

**Estado:** aplicada al chrome; pendiente de confirmación del dueño sobre capturas.

### C-01 · actualización — la referencia se midió con un agente local

El dueño encargó la extracción a un agente con acceso de red. Entregó
`diseno/arte-chrome.md` (150 líneas, commit `63c0520`) y 11 capturas en
`evidencia/fase-3/referencia-chrome/`. **La interpretación `[I]` de arriba queda
sustituida por medición `[V]`.** Calidad del informe: alta — midió *ausencias*
(que la tarjeta no tiene hover, que la cabecera no es fija, que nunca hay texto
sobre foto), detectó un factor de escala ≈0.917 en el árbol y corrigió a nominal,
y corrigió por su cuenta los colores que no pasaban AA dejando el original
anotado.

**Revisión del orquestador — cinco objeciones, ninguna del informe en sí, todas de
aplicabilidad al repositorio:**

1. **ALTA · licencia.** La referencia sirve `Garnett` peso 600 autoalojada.
   Garnett es una tipografía **comercial**: copiar sus `.woff2` sería infracción.
   Sustitución verificada disponible en npm (Google Fonts está bloqueado por el
   proxy, así que autoalojar por npm es además la única vía): `Inter` por
   `@fontsource-variable/inter@5.3.0` (SIL OFL) y, para el papel de *display*,
   `@fontsource-variable/bricolage-grotesque@5.3.0` o
   `@fontsource-variable/outfit@5.3.0`. Se pide captura comparativa para que
   decida el dueño; `--ui-font-display` queda como única indirección.
2. **MEDIA · geometría de la tarjeta.** La medida `314×720` con foto **1:1** es de
   una ficha de artista. Nuestra tarjeta muestra la vista previa de una
   **invitación vertical**: un recorte cuadrado la destroza. Se adopta el sistema
   (radio 20, sombra tintada sin borde, onda con `clipPath`, CTA en píldora) y se
   cambia la media a proporción vertical con altura dictada por el contenido.
3. **MEDIA · metadatos.** `ciudad → categoría → precio` no existe aquí; se mapea a
   `tipo de evento → plan mínimo`, mismo tratamiento, sin inventar un precio.
4. **MEDIA · cabecera.** `position: static` vale para el catálogo, **no** para
   `/editor/[invitationId]`: sin barra fija el cliente pierde de vista el
   indicador de guardado y el botón de publicar. Divergencia deliberada, a
   documentar en el handoff de 3-1.
5. **BAJA · foco.** El propio informe declara el foco de teclado como el punto más
   flojo de la referencia. No se copia: WCAG 2.2 AA 2.4.11 es requisito duro, así
   que se pone aro propio verificado con axe.

**Regla que sí se copia entera:** nunca texto sobre fotografía; la legibilidad se
resuelve por separación. Es también lo que hace que el contraste "texto sobre
imagen" no aplique en la referencia.

**Sin medir en origen y asumido:** estado deshabilitado (no había ninguno en las
vistas públicas) y modo oscuro (no existe). Se diseñarán aquí y se marcarán como
decisión propia, no como herencia de la referencia.

**Estado:** inyectada en vuelo a 3-1 con `SendMessage`. Pendiente: captura del
catálogo real para que el dueño confirme, y elección de la familia de display.
