# 3c-cv → orquestador · revisión de calidad visual del cierre de la fase 3-C

Worktree `/home/user/wt-3c/cv`, rama `wt/cv` desde `1a81b7e`. **Sin commit ni push, sin procesos
vivos.** Detalle y tabla completa de objeciones: `bitacora/3c-cv.md`. ADR: `ADR-3C-CV-01` y
`ADR-3C-CV-02` (ambas **propuesta**).

## Veredicto

**NO CUMPLE** el estándar tal y como llegó (4 objeciones ALTA, todas de iconos y maquetación, no de
identidad). **CUMPLE tras las correcciones de esta revisión**, con 5 objeciones MEDIA de composición
listadas y sin tocar. La identidad —paleta, tres voces tipográficas, formas, separación
chrome/plantilla, foco, fotos con máscara, cero emojis— es sólida y consistente; lo que fallaba era
ejecución.

## Qué se corrigió (todo con pruebas en verde y referencias regeneradas)

1. **`tone="mono"` de `@invitaciones/icons`: `currentColor` → `transparent`** (ADR-3C-CV-01). Con
   `currentColor`, ~30 de los 82 iconos se rellenaban del mismo color que su trazo y perdían el
   dibujo: `ayuda` era un disco sin interrogación en la cabecera del editor, `agregar` un disco sin
   cruz, `borrar` un bote macizo que parecía un menú sobre cada foto, `exito`/`error`/`info` discos
   sin marca, `vista-previa`/`portada`/`qr`/`pie`/`paleta`/`reloj`/`ver` cuadrados negros. 50
   llamadas afectadas en cabecera del sitio y del editor, filas de sección, gestor de fotos, diálogo
   de publicar, `components/fields/**`, `Toast`, portada y `Planes`. Un valor en
   `packages/icons/scripts/generar.ts`; los 82 componentes se **regeneran con el generador**
   (`node --experimental-strip-types scripts/generar.ts` desde `packages/icons/`), ninguna llamada
   cambia.
2. **`WizardProgress`** (ADR-3C-CV-02): columnas iguales con el círculo centrado y el conector
   absoluto (la etiqueta ya cae bajo SU círculo, no media línea a la derecha) y `break-normal` en
   lugar de `break-words` (se acabó «CONTRASEÑ / A»).
3. **Panel de secciones del editor** `minmax(280px,340px)` → `minmax(300px,400px)`: los nombres de
   las secciones `required` ya no se truncan a una letra («P…», «L…», «It…», «C…»).
4. **Error del editor sin inglés**: `lib/store.ts` deja de propagar el `message` de un `TypeError` de
   red («Failed to fetch») y la tarjeta pone «Algo salió mal. Inténtalo de nuevo.» de titular con el
   detalle técnico aparte y secundario (`11 §7`).
5. **Gestor de fotos**: 3 columnas en todos los anchos (eran 4 en el panel) y controles de 32 px —los
   tres cabían fuera de la miniatura y tapaban la foto entera.
6. **Diálogo de publicar**: `publicar.descripcionExito` deja de repetir el título por tercera vez y
   pasa a ser el paso siguiente («Copia el enlace y mándalo a tus invitados por WhatsApp.»).

## API pública que cambia

Ninguna firma. **Cambia la semántica de `tone="mono"`**: ya no es «silueta maciza» sino «sin segundo
tono» (dibujo de línea que hereda el color por `currentColor`). Quien quiera de verdad una silueta
tiene que pasar `style={{ "--tono": "currentColor" }}` y justificarlo.

## Evidencia

- `docs/rediseno-plantillas/evidencia/fase-3c/cierre/visual/` — **51 PNG**: 18 pantallas × 390 / 768 /
  1440, estado DESPUÉS de las correcciones.
- Generador nuevo y reproducible: `frontend/apps/web/scripts/capturas-cierre-3c.mjs` (no es una
  prueba; mismo papel que `capturas-sitio.mjs`). Comando exacto en `bitacora/3c-cv.md §1`.
- 8 referencias de `/design` regeneradas: `iconos-{light,dark}` y
  `componente-wizard-progress-{light,dark}`, a 390 y a 1440.

## Cifras (re-ejecutadas al final, con el código corregido)

`pnpm run test` **10/10** (tokens 55 · icons 179 · schema 527 · ui 654 · sections 653 · web 517/517) ·
`typecheck` **10/10** · `lint` **6/6, 0 errores** (1 aviso preexistente y ajeno) · `build` **5/5**,
39 páginas · `check-budget.mjs` **dentro de presupuesto** (salida 0) · galería `design`
**279/279** con `--update-snapshots` y **279/279** otra vez sin actualizar · e2e completo contra el
backend real (`--project=chromium`, backend :6109) **70/70**.

## Lo que queda (no lo toqué: es composición, no defecto acotado)

| ref | qué | dónde |
|---|---|---|
| M-3 | `/acceso` sin forma protagonista (`11 §7` pide «ondas de dos capas») y anclada arriba con ~350 px de vacío a 1440 | `components/sitio/AsistenteAcceso.tsx` |
| M-4 | `/ayuda`: los rayos se cortan contra el borde del viewport (`11 §3.4` R3) y el acordeón mide 1130 px frente a un buscador de 450 | `app/(chrome)/(sitio)/ayuda/page.tsx` |
| M-5 | Asistente paso 1: título «¿Qué vamos a celebrar?» sin nada que elegir cuando la única invitación ya tiene plantilla, y «Continuar» deshabilitado con la explicación a 350 px | `components/asistente/AsistenteDeCreacion.tsx` |
| M-6 | 400-700 px de papel vacío bajo el contenido en `/editor`, 404 y `/acceso` a 1440×900 | varias |
| M-7 | Portada 1440: «Elige tu plan» es una tarjeta de 390 px sola en una fila de 1130 | `components/sitio/Planes.tsx` |

Siete objeciones BAJA más en `bitacora/3c-cv.md §2` (B-1 a B-7), con fichero cada una.

**Tema oscuro del producto: no existe** y no es un olvido —`app/(chrome)/layout.tsx:42` fija
`data-theme="light"` a propósito—, así que no hay pantalla oscura que juzgar fuera de `/design`. Si
`10 §1` pr. 3 («versión oscura del chrome como token, no como excepción») se quiere vivo, es tarea
aparte: los tokens ya están, falta el conmutador y la persistencia.
