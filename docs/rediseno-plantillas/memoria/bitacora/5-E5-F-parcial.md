# 5-E5-F-parcial — e2e de la consola de administración

Agente E5-F, sesión E5 (panel de administración), fase 5. Rama `claude/fase-5-admin-vq1fjm`, sin
commit ni push (los hace el orquestador). Checkpoint obligatorio: `admin-roles.spec.ts` ya corre en
verde con `--workers=4 --repeat-each=2`, antes de escribir `admin-consola.spec.ts`.

## Contexto leído (orden del encargo)
`.claude/skills/pruebas-producto/SKILL.md` entero · `docs/.../handoffs/5-0-cimientos.md §5` ·
`e2e/preparar.ts` y `e2e/preparar-panel.ts` (solo lectura) · `scripts/seed/admin.sh` +
`scripts/seed/comun.sh` + `scripts/seed/README.md` · `frontend/apps/web/app/(chrome)/admin/**`
(`page.tsx`, `README.md`, `ConsolaAdmin.tsx`, `PanelResumen.tsx`, `PanelInvitaciones.tsx`,
`PanelClientas.tsx`, `PanelPagos.tsx`, `PanelPlantillas.tsx`, `Tabla.tsx`,
`useValorConRetardo.ts`) · `frontend/apps/web/lib/admin/textos.ts` (íntegro) ·
`frontend/apps/web/lib/admin/cliente.ts` (para entender la clasificación de `SessionError`) ·
`docs/.../bitacora/5-E5-A.md` (rutas del backend, filtros, códigos por rol, `estado` derivado de
`tpl_document`/`tpl_release`) · `frontend/apps/web/e2e/a11y-producto.spec.ts` (para decidir si podía
tocarlo, ver más abajo) · `frontend/packages/ui/src/componentes/{Skeleton,EmptyState,Select}.tsx` y
`.../Select/Select.tsx` (para saber qué `role` ARIA expone cada pieza y poder afirmar sobre lo que
ve la persona, no sobre el HTML).

## Decisión sobre `e2e/a11y-producto.spec.ts`
El brief da dos instrucciones que chocan: la sección «TU ENCARGO» dice, en la frase que abre el
apartado de ficheros, **«Ficheros: solo `frontend/apps/web/e2e/admin*.spec.ts`. Ni uno más»**; la
sección «a11y» pide añadir `/admin` a `a11y-producto.spec.ts` «salvo que ese fichero sea de otra
sesión». Comprobado: `a11y-producto.spec.ts` NO está en la lista de `5-0-cimientos.md §3` («Lo que
NADIE de la fase 5 toca»: solo `e2e/preparar.ts`, `e2e/a11y-publico.spec.ts`,
`e2e/editor-3c-evidencia.spec.ts`) — por cabecera es del bloque 3C-8, anterior a la fase 5, sin dueña
de esta fase. Pero la restricción «Ni uno más» de mi propio encargo es más estricta que eso y la
tomo como la que manda: **no toco `a11y-producto.spec.ts`**. La comprobación de accesibilidad vive
dentro de mi propio spec (`admin-consola.spec.ts`, prueba «accesibilidad: axe sin violaciones»),
como el propio brief ofrece como alternativa cuando el fichero no se puede tocar.

## Hecho
- `frontend/apps/web/e2e/admin-roles.spec.ts` — la tabla ruta × rol **vista desde el producto**:
  4 pruebas (MASTER, ADMIN, USER, anónimo), cada una con su propia cuenta (`cuentaNueva()` +
  `UPDATE customer SET role=...` por SQL para MASTER/ADMIN, `pruebas-producto §3`). Ninguna crea
  invitación (no hace falta para medir el rol), así que no hay nada que limpiar en un `finally`.

## Hallazgo de la primera corrida (ya corregido)
`getByRole("alert")` y `getByRole("tablist")` SIN acotar por nombre son ambiguos en este árbol:
- Next.js App Router monta su propio anunciador de ruta (`__next-route-announcer__`) con
  `role="alert"` en TODA página, así que «no debe haber ningún `alert`» daba un falso rojo en
  MASTER/ADMIN (un `alert` sí existía, pero no era el de «sin permiso»).
- `/acceso` tiene sus propias pestañas (`Tabs` de «Entra a tu cuenta»/«Crear cuenta»,
  `a11y-producto.spec.ts:181`), así que `getByRole("tablist")` sin nombre también encontraba una
  coincidencia en la redirección del caso anónimo.

Corregido acotando SIEMPRE por nombre accesible o por contenido: `getByRole("tablist", { name:
textosAdmin.pagina.titulo })`, y el aviso de «sin permiso» con `.filter({ has: getByRole("heading",
{ name: textosAdmin.sesion.sinPermiso.titulo }) })`. Documentado en el propio spec para que quien lo
lea después no repita la misma prueba ingenua contra `alert`/`tablist` sin nombre en esta app.

## Verificado
```
$ pnpm --filter web exec playwright test e2e/admin-roles.spec.ts --workers=4 --repeat-each=2
Running 8 tests using 4 workers
  8 passed (15.5s)
```
Backend en `:6003` arriba (`scripts/dev-backend.sh status` → 0) y `scripts/seed-demo.sh` corrido una
vez para que `global-setup.ts` pueda obtener el token cacheado de la demo (no lo usa
`admin-roles.spec.ts`, pero lo exige el `globalSetup` de toda la suite).

## Pendiente (siguiente paso inmediato)
- `frontend/apps/web/e2e/admin-consola.spec.ts`: cinco pestañas con contenido, «el resumen no espera
  a las tablas» (con `page.route` retardando SOLO las otras cuatro rutas — no es un mock de datos,
  es retardar la respuesta real, para poder afirmar el orden sin esperas fijas prohibidas por
  ESLint `no-restricted-syntax` de `apps/web/e2e/**`), filtro de invitaciones (texto + estado),
  alcance de un ADMIN (anti-IDOR, cuenta propia + clienta ajena, ambas creadas por la prueba),
  catálogo de plantillas de solo lectura y sin cifra codificada, y la auditoría de axe.
- `pnpm --filter web exec playwright test e2e/admin-roles.spec.ts e2e/admin-consola.spec.ts
  --workers=4 --repeat-each=2` y `pnpm --filter web run lint`, con salida real pegada.
- `5-E5-F.md` final con la tabla ruta × rol, la evidencia y lo que no se pudo probar.
