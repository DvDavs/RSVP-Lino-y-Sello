# 5-E5-D-parcial — ensamblado de la pantalla `/admin`

Agente E5-D, sesión E5 (panel de administración), fase 5. Rama `claude/fase-5-admin-vq1fjm`, sin
commit ni push (los hace el orquestador). Checkpoint a mitad de encargo, antes de escribir pruebas.

## Contexto leído (orden del encargo)
`CLAUDE.md`, `identidad-visual/SKILL.md`, `ui-pantalla/SKILL.md`, README de `(chrome)/admin/`,
`12-producto-completo.md §B3.6` (líneas 1525-1560, el wireframe), `lib/admin/` entero (`tipos.ts`,
`cliente.ts`, `textos.ts`, `formato.ts`, `README.md`), los cinco componentes de
`_componentes/` de E5-C con sus pruebas, `5-E5-C.md`, el marcador `page.tsx`, y la ruta de
referencia `(chrome)/(sitio)/acceso/` + `(chrome)/editor/` (patrón de `page.tsx`/`loading.tsx`/
`error.tsx` y de manejo de `SessionError` en `AsistenteDeCreacion.tsx`).

## Hecho
- `frontend/apps/web/lib/admin/textos.ts` — ÚNICA excepción a «no tocar `lib/admin`», documentada
  en cada bloque añadido con un comentario `// Añadido por E5-D`. Detalle completo en la sección
  «Textos añadidos» más abajo.
- `frontend/apps/web/app/(chrome)/admin/page.tsx:1` — sustituye el marcador entero. Server
  Component, metadatos (`robots: {index:false, follow:false}` conservado), monta `ConsolaAdmin`.
- `frontend/apps/web/app/(chrome)/admin/loading.tsx:1` — esqueleto de la forma de la pantalla
  (cabecera + fila de métricas + tabla), Server Component.
- `frontend/apps/web/app/(chrome)/admin/error.tsx:1` — frontera de error de ESTA carpeta (no de la
  raíz del grupo), `"use client"`, `EmptyState` con `textosAdmin.pagina.errorInesperado`.
- `frontend/apps/web/app/(chrome)/admin/_componentes/ConsolaAdmin.tsx:1` — armazón: cabecera +
  `Tabs` del sistema (subruta directa) + puerta de sesión. `manejarSesionInvalida(statusCode)`:
  401 → `router.replace('/acceso?volver=/admin')`; 403 → sustituye TODAS las pestañas por el estado
  honesto `textosAdmin.sesion.sinPermiso` (un 403 no es «no hay clientas»).
- `frontend/apps/web/app/(chrome)/admin/_componentes/PanelResumen.tsx:1` — `obtenerMetricas()` →
  `FilaDeMetricas`, carga/error propios, nunca espera a las tablas.
- `frontend/apps/web/app/(chrome)/admin/_componentes/PanelClientas.tsx:1` — `listarClientas` sobre
  `Tabla`, buscador con retardo de 300 ms (`useValorConRetardo.ts`), paginación (`Paginador.tsx`).
- `frontend/apps/web/app/(chrome)/admin/_componentes/PanelInvitaciones.tsx:1` — `listarInvitaciones`
  sobre `Tabla`, filtros buscar/estado/pago (servidor) + plan (cliente, alimentado por
  `listarPlanes()`, degrada en silencio si falla), columna Enlace (`lib/enlace-publico.ts`),
  columna Acciones con `AccionDeFila` (deshabilitar, destructivo) o un `Button` simple (habilitar,
  no destructivo — `AccionDeFila` es solo para la acción destructiva, ver comentario de cabecera del
  fichero), banner `BloqueConError` propio para el fallo de `alternarEstadoInvitacion` (independiente
  del error de la tabla). Tras alternar, vuelve a pedir `listarInvitaciones` (el README de `lib/admin`
  advierte que la respuesta del `toggle-status` heredado no trae el nuevo estado).
- `frontend/apps/web/app/(chrome)/admin/_componentes/PanelPagos.tsx:1` — `listarPagos` sobre
  `Tabla`, filtro de estado, nota `textosAdmin.pagos.fuenteDatos` solo si `origen==="invitaciones"`.
- `frontend/apps/web/app/(chrome)/admin/_componentes/PanelPlantillas.tsx:1` — `listarPlantillas`
  sobre `Tabla`, SOLO LECTURA (sin controles de alta), sin paginación (el contrato §7 no la trae),
  `claveFila` es `slug@version` (no hay `id` en `PlantillaAdmin`).
- `frontend/apps/web/app/(chrome)/admin/_componentes/Paginador.tsx:1` y
  `.../useValorConRetardo.ts:1` — piezas de ensamblado auxiliares (no pedidas por nombre, necesarias
  para cumplir «filtros con paginación» del encargo).

## Textos añadidos a `lib/admin/textos.ts` (documentar para el revisor)
1. `pagina.errorInesperado` `{titulo, cuerpo, accion}` — frontera de error de la ruta (`error.tsx`),
   no existía ningún texto de página completa.
2. `comun.cancelar` — «Cancelar», para el diálogo de `AccionDeFila`.
3. `comun.sinResultados` — «Nada que mostrar», título genérico de `EmptyState` para toda tabla vacía
   (el cuerpo sigue siendo el texto propio de cada tabla, `<tabla>.vacio.sinFiltro/conFiltro`).
4. `comun.paginador` `{etiqueta, anterior, siguiente, paginaDe(pagina,total)}` — no existía ningún
   texto de paginación.
5. `invitaciones.confirmacionDeshabilitar` / `.confirmacionHabilitar` `{titulo, descripcion,
   confirmando}` — el diálogo de `AccionDeFila` pide título/descripción propios, distintos del
   texto del botón (`acciones.deshabilitar`/`.habilitar`, que sí existían).
6. `pagos.fuenteDatos` — nota sobre `origen: "invitaciones"` (contrato §5), pedida explícitamente
   por el encargo («si quieres reflejarlo, hazlo con un texto de `textos.ts`»).
7. `sesion.sinPermiso.accion` — «Ir a mis invitaciones»: el estado honesto de un 403 no tenía
   ninguna acción de salida.

Cada bloque lleva su propio comentario `// Añadido por E5-D` en el fichero, con el porqué.

## A medias
- Ninguna prueba de componente escrita todavía (siguiente paso inmediato: `PanelResumen.test.tsx`,
  `PanelClientas.test.tsx`, `PanelInvitaciones.test.tsx`, `PanelPagos.test.tsx`,
  `PanelPlantillas.test.tsx`, `ConsolaAdmin.test.tsx` — carga/vacío/error/listo de cada uno, más la
  prueba de que el error de un bloque no tumba los demás).
- `pnpm --filter web run test`, `pnpm -r run typecheck`, `pnpm --filter web run build` y
  `node scripts/check-budget.mjs` (o medición manual si `/admin` no tiene entrada propia todavía) sin
  correr aún.
- No se ha probado contra el backend real (`http://127.0.0.1:6003`) por bloqueo del entorno al
  intentar obtener un JWT por `curl` con contraseña en la línea de comandos (clasificador de
  permisos del entorno); se construyó contra el contrato documentado (`tipos.ts`/`cliente.ts`) y se
  verificó `GET /product/admin/metricas` sin token devuelve 401 con cuerpo no-TPL (confirma la
  clasificación `SessionError` de `cliente.ts`).

## Pendiente
- Escribir las pruebas de componente.
- Correr test/typecheck/build/presupuesto y pegar salida real.
- ADR-5-E5-04 en `decisiones.md` (filtro de plan resuelto en cliente vía `listarPlanes()`; ilustración
  `sin-invitaciones` reutilizada para toda tabla vacía del panel, dado que el catálogo solo tiene 3;
  `AccionDeFila` reservado a la acción destructiva, `habilitar` como botón simple no destructivo).
- `5-E5-D.md` final con evidencia.

## Cómo verificar lo hecho hasta aquí
```bash
cd /home/user/RSVP-Lino-y-Sello/frontend
pnpm --filter web run typecheck
```
