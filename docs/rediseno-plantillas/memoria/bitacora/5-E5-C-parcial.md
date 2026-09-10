# 5-E5-C — parcial

Agente E5-C, sesión E5 (panel de administración), fase 5. Rama `claude/fase-5-admin-vq1fjm`, sin
commit ni push (los hace el orquestador). Encargo: componentes de presentación de `/admin`, **solo**
en `frontend/apps/web/app/(chrome)/admin/_componentes/` — ni `packages/**`, ni `lib/**`, ni
`page.tsx`.

## Hecho
- Leído el contexto obligatorio completo (CLAUDE.md, `identidad-visual`, `10-identidad-visual.md`,
  `ui-componente`, wireframe `12-producto-completo.md §B3.6` líneas 1525-1560, README de `/admin`,
  inventario de `packages/ui/src/componentes/index.ts` + `index.ts`, y dos referencias de
  `components/sitio/CtaFinal.tsx` y `components/editor/PublishDialog.tsx` para estilo de código e
  import).
- `frontend/apps/web/app/(chrome)/admin/_componentes/clases.ts` — combinador de clases mínimo, sin
  dependencias (mismo patrón que `EmptyState.tsx` de `packages/ui`).
- `frontend/apps/web/app/(chrome)/admin/_componentes/BloqueConError.tsx` — bloque de error POR
  BLOQUE (título, cuerpo, una sola acción `onReintentar`). Envuelve `Button` de
  `@invitaciones/ui/componentes/Button/index.ts`. Server Component (sin `"use client"`).
- `frontend/apps/web/app/(chrome)/admin/_componentes/FilaDeMetricas.tsx` — fila de 5 tarjetas
  (`<dl>`/`<dt>`/`<dd>` sobre `Card as="div"`), `Stripes` de `@invitaciones/ui/shapes` una sola vez
  debajo. `estado: "cargando" | "error" | "listo"`; en `"error"` sustituye toda la fila por
  `BloqueConError` (prop `error` obligatoria). En `"cargando"` las ETIQUETAS de `metricas` se
  enseñan de inmediato (son estáticas) y solo el valor se sustituye por `Skeleton` — así la fila no
  cambia de tamaño al terminar de cargar. Server Component.
- `frontend/apps/web/app/(chrome)/admin/_componentes/Tabla.tsx` — `Tabla<T>` tipada con genéricos.
  `<table>` real + `<caption>` (`sr-only` por defecto, visible con `tituloVisible`), `<th scope="col">`.
  Contenedor propio `overflow-x-auto` + `tabIndex={0}` para el desbordamiento horizontal (la página
  nunca se desplaza). Móvil (`sm:hidden`/`hidden sm:block`, breakpoint 640 px de Tailwind): tarjetas
  apiladas, una por fila, etiqueta+valor por columna — coexiste en el DOM con la tabla de escritorio,
  mismo patrón responsive que ya usa `components/editor/PublishDialog.tsx` (`ed:hidden`/`hidden
  ed:inline`). `estado: "cargando" | "error" | "vacio" | "listo"`; `"cargando"` pinta `Skeleton` por
  fila (nunca «Cargando…» suelto), `"vacio"` pinta `EmptyState`, `"error"` pinta `BloqueConError`.
  Regla añadida (no estaba en el pedido literal, la exige la lista de pruebas): con `filas.length
  === 0` y `estado === "listo"` se trata como `"vacio"` (nunca una tabla con cabecera y cero filas).
  Prop añadida sobre el pedido literal: `claveFila` (clave de React estable por fila, no el índice).
  Server Component.

## Hecho (además de lo de arriba, escrito también antes de este parcial)
- `frontend/apps/web/app/(chrome)/admin/_componentes/EtiquetaDeEstado.tsx` — unión discriminada
  `familia: "invitacion" | "pago"` sobre `Badge` de `packages/ui`; tono fijo por familia+estado
  (tabla `Record`), texto siempre por props (`Badge` ya garantiza texto visible, nunca solo color).
  Server Component.

## A medias
- `AccionDeFila.tsx` — diseñado (dos `Button` "peligro" en el DOM a la vez, uno `hidden
  sm:inline-flex` que es el `trigger` de un `Dialog` de confirmación controlado, y uno permanente
  `sm:hidden` siempre deshabilitado con la razón visible al lado — nunca ausente en móvil, regla
  literal del wireframe) pero no escrito todavía. `"use client"` (estado de apertura/confirmación
  del `Dialog`).

## Pendiente
- Escribir `EtiquetaDeEstado.tsx` y `AccionDeFila.tsx`.
- `*.test.tsx` de los cinco componentes (cuatro estados donde aplique, casos concretos del encargo:
  `scope="col"`, vacío por texto, error con reintento, 0 filas ⇒ vacío, control de `AccionDeFila`
  presente-y-deshabilitado en el caso estrecho, texto siempre en `EtiquetaDeEstado`).
- Prueba de compuerta: recorrer la carpeta y caer si algún fichero contiene emoji o hex.
- Correr `pnpm --filter web run test` y `pnpm -r run typecheck`, pegar salida real (excluyendo el
  rojo ya conocido de `components/sitio/portada.test.tsx` desde `bfdcbaa`, ajeno a esta fase).
- ADR-5-E5-03 en `docs/rediseno-plantillas/memoria/decisiones.md` (`cat >>`, al final).
- Bitácora final `5-E5-C.md` con evidencia.

## Cómo verificar lo hecho hasta ahora
```bash
cd /home/user/RSVP-Lino-y-Sello/frontend
pnpm --filter web run typecheck
```
(las pruebas de estos cuatro ficheros aún no existen; el typecheck ya debería pasar sobre ellos solos
salvo por los dos ficheros que aún faltan y que otros ya no referencian todavía).
