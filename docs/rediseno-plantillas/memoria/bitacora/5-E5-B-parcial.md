# 5-E5-B — parcial (capa de datos y textos de `/admin`)

Agente E5-B, rama `claude/fase-5-admin-vq1fjm`. Checkpoint obligatorio tras `tipos.ts` y
`cliente.ts`, antes de pruebas (regla de presupuesto de `CLAUDE.md`).

## Hecho
- `frontend/apps/web/lib/admin/tipos.ts` — los siete tipos del contrato
  (`scratchpad/contrato-admin.md`), más `InvitacionHeredada`/`AlternarEstadoInvitacionResponse`
  para la §4 (ruta heredada, tipos en inglés a propósito, ver cabecera del fichero).
- `frontend/apps/web/lib/admin/cliente.ts` — las siete funciones (`obtenerMetricas`,
  `listarClientas`, `listarInvitaciones`, `alternarEstadoInvitacion`, `listarPagos`,
  `listarPlanes`, `listarPlantillas`). Token vía `getAuthToken()`/`getApiBaseUrl()` importados de
  `../api-client.ts` (cero almacenamiento propio). Errores vía `ApiError`/`SessionError`/
  `UnknownApiError` de `../errors.ts`, mismo pipeline que `peticion()` de `api-client.ts`
  (`cliente.ts:64-92`, función interna `peticionAdmin`).
- Verificado leyendo el fuente (sin backend levantado en este entorno, no hay Postgres arrancado
  para un curl real) que `PUT /admin/invitations/{id}/toggle-status`
  (`InvitationController.kt:127-141`) no pide cuerpo y SÍ comprueba jerarquía
  (`InvitationAdminService.kt:461`, `hierarchyValidationService.validateInvitationAccess`) — no es
  un hallazgo, está anotado como comentario en `cliente.ts:122-131`.

## A medias
- Ninguno todavía en código; lo que sigue está sin empezar (ver «Pendiente»).

## Pendiente
- `frontend/apps/web/lib/admin/textos.ts` — objeto `textosAdmin` es-MX completo (pestañas,
  columnas, vacíos por tabla, errores por bloque, filtros, etiquetas de estado/pago).
- `frontend/apps/web/lib/admin/formato.ts` — `formatearImporte`, `formatearFechaCorta`,
  `formatearFechaEvento`, `etiquetaEstadoInvitacion`, `etiquetaEstadoPago`.
- `frontend/apps/web/lib/admin/README.md`.
- Pruebas: `cliente.test.ts`, `formato.test.ts`, `textos.test.ts`.
- Correr `pnpm --filter web run test` y `pnpm -r run typecheck`, pegar salida real en
  `5-E5-B.md` final (excluyendo el rojo conocido y ajeno de `components/sitio/portada.test.tsx`).
- ADR de las decisiones de diseño (candidata: `ADR-5-E5-02`, sobre reimplementar un
  `peticionAdmin()` propio en vez de tocar `api-client.ts`, y la clasificación de errores de la
  ruta heredada sin `code` TPL_*) — pendiente de redactar con `cat >>`.

## Cómo verificar lo hecho hasta ahora
```bash
cd /home/user/RSVP-Lino-y-Sello/frontend
pnpm --filter web exec tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -i "lib/admin" || echo "sin errores en lib/admin"
```
(No hay pruebas todavía que correr sobre estos dos ficheros — llegan en el siguiente tramo.)
