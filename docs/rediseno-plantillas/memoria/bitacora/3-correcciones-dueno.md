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
