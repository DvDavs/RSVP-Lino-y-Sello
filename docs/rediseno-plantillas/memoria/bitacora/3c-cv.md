# 3c-cv — Revisión de calidad visual del cierre de la fase 3-C

Worktree `/home/user/wt-3c/cv`, rama `wt/cv` desde `1a81b7e` (bloques 1-3 cerrados + 3C-8/3C-8b).
**Sin commit ni push.** Agente independiente: no escribí ninguna de las pantallas que juzgo.

## 1. Cómo se levantó y qué se miró

```
TPL_DEV_PORT=6109 TPL_DEV_DB=invitaciones_cv TPL_TEST_STATE_DIR=/tmp/pg-cv \
  TPL_DEV_PIDFILE=/tmp/cv.pid scripts/dev-backend.sh start
TPL_DEV_BASE=http://127.0.0.1:6109 <mismas variables> scripts/seed-demo.sh   # invitationId 3
cd frontend && NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:6109 NEXT_PUBLIC_E2E_HOOKS=1 pnpm run build
PORT=3109 NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:6109 \
  NEXT_PUBLIC_CDN_ORIGIN=http://127.0.0.1:6109 pnpm --filter web run start
cd apps/web && TPL_TEST_STATE_DIR=/tmp/pg-cv TPL_DEV_DB=invitaciones_cv \
  NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:6109 node scripts/capturas-cierre-3c.mjs --port 3109
```

`frontend/apps/web/scripts/capturas-cierre-3c.mjs` es **nuevo** (mismo papel que `capturas-sitio.mjs`
de 3C-5: generador reproducible, no una prueba). Produce **51 PNG** en
`docs/rediseno-plantillas/evidencia/fase-3c/cierre/visual/`: 18 pantallas × 390 / 768 / 1440
(a 390 el editor no tiene panel de bloque ni diálogo de publicar: en su lugar van las pestañas
Editar/Vista previa). Las capturas del repositorio son las de DESPUÉS de las correcciones; las cifras
y descripciones de «antes» de la tabla salen de la primera pasada, que miré una a una.

Pantallas: `/` · `/acceso` (entrar, error de credenciales, crear cuenta, recuperar) · `/ayuda` y
`/ayuda` sin resultados · 404 · `/editor` pasos 1-4 · `/editor/3` (secciones, panel de bloque, gestor
de fotos, publicar antes y después) · error del editor. **Tema oscuro: no existe en el producto** —
`app/(chrome)/layout.tsx:42` fija `data-theme="light"` como elección deliberada y documentada; el
único sitio conmutable es la galería `/design` (`marco-de-tema.tsx`), que sí se revisa en claro y
oscuro por sus 279 capturas de regresión. No es un hallazgo mío: está escrito.

Además de mirar: greps de emojis (`0` en `apps/web`, `packages/{ui,icons,tokens}`), de hex sueltos en
componentes (`0` en `packages/ui/src`; los 3 de `apps/web` están fuera del chrome, ver B-6), de
`outline:none` sin sustituto (`0`: las 20 apariciones van siempre con `focus-visible:ring-[3px]`) y
de tipografía genérica en el chrome (`0`: `system-ui` solo aparece como último recurso de la pila de
`packages/ui/src/styles/typography.css`, detrás de Onest y su cara de respaldo con `metric-override`).

## 2. Tabla de objeciones

| # | Gravedad | Qué | Dónde | Estado |
|---|---|---|---|---|
| A-1 | **ALTA** | `tone="mono"` rellenaba la pieza principal con `currentColor`: ~30 de los 82 iconos se veían como siluetas macizas sin dibujo. `ayuda` = disco sin interrogación en la cabecera de `/editor`; `agregar` = disco sin cruz en «Agregar» del gestor de fotos; `borrar` = bote macizo que se lee como menú, sobre cada miniatura; `exito`/`error`/`info` = discos sin marca (indicador «Todo guardado», errores de campo, palomita de la paleta activa); `vista-previa`/`portada`/`qr`/`pie`/`pago`/`paleta`/`reloj`/`ver` = cuadrados negros. 50 llamadas en 5 áreas. Rompe `11 §4.1` y `10 §1` pr. 2 | `packages/icons/scripts/generar.ts:186` (plantilla) + 82 `src/generated/*.tsx` | **CORREGIDO** · ADR-3C-CV-01 (`--tono: transparent`) |
| A-2 | **ALTA** | Panel de secciones del editor a ≥768: el nombre de las secciones `required` se truncaba a una o dos letras («P…», «L…», «It…», «C…») porque la insignia «SIEMPRE VISIBLE» (125 px) se comía la fila de un panel de 340 px. El usuario no puede distinguir sus secciones | `app/(chrome)/editor/[invitationId]/page.tsx:384` | **CORREGIDO** (panel `minmax(280px,340px)` → `minmax(300px,400px)`) |
| A-3 | **ALTA** | `WizardProgress`: las etiquetas no caían bajo su propio círculo (media línea a la derecha) y `break-words` partía «CONTRASEÑA» en «CONTRASEÑ / A» a 768 y 1440. Afecta a `/acceso` (crear cuenta) y a los 4 pasos de `/editor` | `packages/ui/src/componentes/WizardProgress/WizardProgress.tsx:72,100` | **CORREGIDO** · ADR-3C-CV-02 |
| A-4 | **ALTA** | La pantalla de error del editor pintaba `error.message` crudo como ÚNICO texto: con la red caída eso es «Failed to fetch», en inglés, sin código y sin la frase del sistema. Es exactamente el defecto U-9 que `errores.sinRed` ya cerró en `PublishDialog`, `AsistenteAcceso` y `traducir-errores.ts` | `lib/store.ts:706` y `app/(chrome)/editor/[invitationId]/page.tsx:203` | **CORREGIDO** (`TypeError` ya no propaga mensaje; la tarjeta pone «Algo salió mal…» de titular y el detalle aparte y secundario, `11 §7`) |
| M-1 | MEDIA | Gestor de fotos: 3 controles de 36 px sobre miniaturas de ~85 px (4 columnas en el panel) tapaban la foto entera y el tercero se salía por el borde derecho | `components/editor/PhotoManager.tsx:128,261` | **CORREGIDO** (3 columnas siempre, controles a 32 px —sigue por encima del objetivo de 24 px de 2.5.8—, `gap-0.5`) |
| M-2 | MEDIA | Diálogo de publicación: tres frases seguidas diciendo lo mismo — título «Tu invitación está en vivo», descripción «Tu invitación ya está en línea.» y estado «Tu invitación ya se puede ver en internet.» | `lib/i18n.ts:541` | **CORREGIDO** (la descripción pasa a ser el paso siguiente: «Copia el enlace y mándalo a tus invitados por WhatsApp.»; el estado es la región `role="status"` de U-5 y está fijado por contrato) |
| M-3 | MEDIA | `/acceso` no tiene forma protagonista: `11 §7` pide «ondas de dos capas» y la pantalla es un formulario suelto sobre papel, arriba del todo, con ~350 px de vacío hasta el pie a 1440×900. Es la segunda pantalla del embudo | `components/sitio/AsistenteAcceso.tsx`, `app/(chrome)/(sitio)/acceso/page.tsx` | Listada (composición, no acotada) |
| M-4 | MEDIA | `/ayuda`: los «rayos» de la cabecera se cortan contra el borde derecho del viewport, desligados del bloque (`11 §3.4` R3: «se recorta al contenedor y nunca sale del bloque»); y a 1440 el acordeón mide 1130 px mientras el buscador mide 450, así que cada fila es una línea larguísima con el chevron a 1100 px del título | `app/(chrome)/(sitio)/ayuda/page.tsx`, `components/sitio/BuscadorAyuda.tsx` | Listada |
| M-5 | MEDIA | Asistente paso 1 con la cuenta demo: el título «¿Qué vamos a celebrar?» y el intro «Elige uno; te mostramos solo las plantillas que le van» se pintan **sin ninguna opción que elegir** (la rejilla de tipos se oculta cuando la única invitación ya tiene plantilla), y «Continuar» queda deshabilitado con su explicación 350 px más arriba — `11 §5`: «nunca un control mudo» | `components/asistente/AsistenteDeCreacion.tsx` | Listada |
| M-6 | MEDIA | Ritmo vertical: `/editor` (asistente), 404 y `/acceso` anclan el contenido arriba y dejan 400-700 px de papel vacío a 1440×900. El 404 raíz además no lleva cabecera ni pie (deuda consciente de 3C-8b por presupuesto) | varias | Listada |
| M-7 | MEDIA | Portada a 1440: el bloque «Elige tu plan» es una tarjeta de 390 px sola en una fila de 1130 | `components/sitio/Planes.tsx` | Listada |
| B-1 | BAJA | Portada: el primer testimonio lleva sombra de color jade + borde casi negro y se lee como «seleccionado» junto a dos tarjetas planas | `components/sitio/Testimonios.tsx` | Listada |
| B-2 | BAJA | Portada: `eyebrow` en «Cómo funciona» y «Planes», pero no en «Para cada celebración» ni en «Lo que cuentan…» (esta última con motivo escrito en el código; la otra no) | `components/sitio/{TiposDeEvento,Testimonios}.tsx` | Listada |
| B-3 | BAJA | Registro: «Continuar» se alinea a la derecha a ≥768 mientras «Iniciar sesión» ocupa el ancho completo — dos primarios del mismo formulario con dos tratamientos | `components/sitio/AsistenteAcceso.tsx` | Listada |
| B-4 | BAJA | Error de credenciales: el mensaje no lleva icono y los dos campos no reciben borde `danger` ni `aria-invalid` (`11 §5`, fila Input). El texto es correcto y es el portador del significado, así que no incumple `§1.5` R4 | `components/sitio/AsistenteAcceso.tsx` | Listada |
| B-5 | BAJA | Gestor de fotos: aun a 3 columnas, los controles ocupan el tercio superior de cada miniatura | `components/editor/PhotoManager.tsx` | Listada (mejorado por M-1) |
| B-6 | BAJA | `app/(canvas)/layout.tsx:52-53` usa `system-ui` y hex sueltos (`#4b4640`, `#7a2f2f`, `#fdf2f2`) para el texto de respaldo del lienzo. Está DENTRO del `<iframe>` de la invitación, fuera de los tokens del chrome — deliberado, pero es el único texto del producto con tipografía del sistema | `app/(canvas)/layout.tsx` | Listada |
| B-7 | BAJA | `/editor?paso=listo` sin `&plantilla=` deja un título («Tu invitación ya tiene diseño») sobre una pantalla vacía. `PasoListo.tsx` está bien hecho (tarjeta + palomita + «Abrir mi invitación»); es el enrutado por URL el que no reconduce | `components/asistente/AsistenteDeCreacion.tsx` | Listada |

## 3. Lo que SÍ cumple, dicho con nombre (no todo es objeción)

- **Tres voces tipográficas inconfundibles y bien repartidas**: Fraunces en todos los títulos, Onest en
  cuerpo, Red Hat Mono en versalitas de antetítulo, paso e insignia. Ni una sola vez la fuente de
  cuerpo en un título; ni rastro de Inter/Bricolage/Outfit/system-ui en el chrome.
- **Foco visible correcto en todas partes**: anillo de 3 px `focus` (añil) con halo de 2 px `surface`,
  tal cual `11 §1.4`. Se ve literalmente en `03-acceso-error-1440.png`.
- **Fotos siempre con máscara** (sello, radio grande, miniaturas redondeadas) y **cero texto sobre
  fotografía**: los controles del gestor de fotos van sobre pastilla `surface-raised` opaca, no sobre
  velo (`11 §3.4` R5).
- **Chrome y plantilla separados de verdad**: el lienzo pinta la invitación con `--inv-*` y el rosa
  bugambilia no se cuela dentro; `ThemePicker` dibuja cada muestra con `palette.tokens` de la
  plantilla, no con tokens del chrome.
- **Estados diseñados, no `alert`**: el 404 y el vacío de «Todavía no tienes invitaciones» llevan
  ilustración propia (sello + tinta gruesa + sombra de color jade + chispa mango) y una sola salida.
- Campo de solo lectura del editor («Fecha del evento») con su explicación al lado y un botón
  secundario que sí funciona: el patrón de `11 §5` para deshabilitados, bien resuelto.

## 4. Correcciones: ficheros tocados

```
frontend/packages/icons/scripts/generar.ts            plantilla: mono → transparent
frontend/packages/icons/src/tipos.ts                  documentación del mecanismo + por qué
frontend/packages/icons/src/generated/*.tsx           82 ficheros regenerados con el generador
frontend/packages/icons/test/{svg.test.ts,componentes.test.tsx}   las 2 pruebas que fijaban currentColor
frontend/packages/ui/src/componentes/WizardProgress/WizardProgress.tsx
frontend/apps/web/app/(chrome)/editor/[invitationId]/page.tsx     ancho del panel + tarjeta de error
frontend/apps/web/lib/store.ts                        el TypeError de red ya no propaga «Failed to fetch»
frontend/apps/web/components/editor/PhotoManager.tsx  3 columnas, controles de 32 px
frontend/apps/web/components/sitio/TiposDeEvento.tsx  comentario (el porqué de `mono` cambió)
frontend/apps/web/lib/i18n.ts                         publicar.descripcionExito
frontend/apps/web/scripts/capturas-cierre-3c.mjs      NUEVO (generador de las 51 capturas)
frontend/apps/web/e2e/design.spec.ts-snapshots/**     8 referencias regeneradas (iconos ×4, wizard ×4)
docs/rediseno-plantillas/evidencia/fase-3c/cierre/visual/*.png    51 capturas
```

Ni una línea en `src/` (backend), RSVP, invitados, auth, pagos, módulo antiguo, `packages/sections`
ni `packages/schema`.

La pasada de e2e reescribió, como ya avisaban los handoffs de 3C-6/3C-7/3C-8, la evidencia de
`evidencia/fase-3/**` y `evidencia/fase-3c/bloque-3/3c-7/**`, que no es mía: **revertida** con
`git checkout --` (mi evidencia vive solo en `evidencia/fase-3c/cierre/visual/`).

## 5. Cifras literales (todas re-ejecutadas al final, con el código ya corregido)

- `pnpm run test` — **10/10 tareas**: tokens 55/55 · icons 179/179 · schema 527/527 · ui 654/654 ·
  sections 653/653 · web 517/517 (64 ficheros).
- `pnpm run typecheck` — **10/10**. `pnpm run lint` — **6/6, 0 errores**, 1 aviso preexistente y
  ajeno (`e2e/flujo-principal.spec.ts:94`, `campoFoto` sin usar). `pnpm run build` — **5/5**,
  39 páginas.
- `node scripts/check-budget.mjs` — **dentro de presupuesto**, código de salida 0.
- Galería `/design` (`playwright.design.config.ts`, `PW_DESIGN_PORT=3119`): **279/279** con
  `--update-snapshots` (8 referencias reescritas) y **279/279** en la pasada siguiente sin actualizar.
- e2e completo contra el backend real (`--project=chromium`, `PW_PORT=3129`, backend :6109):
  **70/70 en verde**, 2,2 min.
- Greps: emojis 0 · hex sueltos en `packages/ui/src` 0 · `outline:none` sin anillo 0 ·
  `lucide-react` 0.

## 6. Riesgos y lo que no pude hacer

- **No pude juzgar el tema oscuro del producto** porque no existe: el chrome es claro por decisión
  (`app/(chrome)/layout.tsx:42`). Lo único oscuro revisable es `/design`, cubierto por sus 279
  referencias. Si el dueño quiere el oscuro como token vivo (`10 §1` pr. 3, «versión oscura del chrome
  como token, no como excepción»), es una tarea aparte: los tokens ya están, falta el conmutador.
- **No pude reproducir el diálogo de conflicto** con datos sembrados: exige dos sesiones escribiendo a
  la vez, que es lo que hace `e2e/conflicto.spec.ts` (verde, 2/2). Queda cubierto por prueba, no por
  captura.
- **M-3 a M-7 son composición**, no defectos acotados: tocarlos habría sido rediseñar pantallas ajenas
  en una revisión. Van listadas con fichero para quien las tome.
- Riesgo de A-1: `mono` cambia de significado para todo el árbol. El respaldo es que los 82 iconos se
  compararon uno a uno en las tres variantes (hoja generada a partir de los SVG fuente) antes de
  tocar nada, y que las 8 referencias de la galería que cambian son exactamente las esperadas.
- Riesgo de A-2: el panel de secciones pasa de 340 a 400 px máximos; el lienzo pierde 60 px a 1440.
  Medido: la invitación sigue entrando entera y `editor-movil`/`teclado-editor`/`secciones` siguen en
  verde. «Confirmación de asistencia» y «Nuestros padres y padrinos» siguen truncándose, ahora a
  12-20 caracteres en vez de a 1.
