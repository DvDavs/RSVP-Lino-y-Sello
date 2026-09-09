# 5-2-D — handoff de cierre (E2-D2)

**Estado: el encargo terminó completo en esta sesión.** No hubo que partirlo por presupuesto de
contexto. Se deja este fichero de todos modos, con el nombre pedido, para que el orquestador tenga
un registro explícito del cierre y del hallazgo del rojo 1 (que no era mío).

## Terminado y verificado

1. **Rojo 1 (`test/tokens-no-leak.test.ts`)** — investigado y descartado como mío: el `--ui-`
   infractor estaba en `components/invitados/TablaInvitados.tsx:63` (territorio prohibido, de otro
   agente), nunca en mi CSS (`pagina.module.css` ya solo usa `--inv-*`, verificado con grep antes de
   tocar nada). Ese otro agente lo cerró mientras yo trabajaba en los rojos 2 y 3; verificado de
   nuevo al final de la sesión: `pnpm --filter web exec vitest run test/tokens-no-leak.test.ts` →
   2 passed.
2. **Rojo 2** (`PantallaInvitado.test.tsx:162`, «confirmar → cambiar → declinar → cambiar →
   confirmar») — la prueba, no el componente: al reabrir el formulario tras declinar, esperaba
   encontrar el botón «Confirmar mi asistencia» sin haber marcado antes el radio «Sí» — pero
   `formularioDesdeInvitado` (componente) SIEMPRE pre-carga la ÚLTIMA respuesta real (igual que ya
   hace, sin objeción del test, al reabrir desde CONFIRMED con «Sí» premarcado). Arreglada la
   prueba: `PantallaInvitado.test.tsx:187-193`, ahora selecciona el radio «Sí» a mano antes de
   enviar, igual que ya hacía con «No» unas líneas arriba.
3. **Rojo 3** (`PantallaInvitado.test.tsx:256`, `GUEST_QUOTA_EXCEEDED`) — no era un fallo del
   componente (el `role="alert"` ya existía en `TarjetaDecision`, `PantallaInvitado.tsx`): era
   contaminación entre pruebas — el rojo 2, al fallar a mitad, dejaba una promesa/act() pendiente
   que rompía la prueba siguiente. Se resolvió solo al arreglar el rojo 2; confirmado corriendo el
   fichero entero (no solo el caso) 12/12 verde.
4. **Peso de `/r/[token]`** (no pedido como bloqueante, medido "si puedo"): con `pnpm run build`
   estaba en **238.9 KB gz**, muy por encima de los 150 KB de la ruta hermana. Encontrada la causa:
   `PantallaInvitado.tsx` importaba `getPublicRender`/`ApiError` de `lib/api-client.ts` (cuya
   cabecera arrastra `@invitaciones/schema`/`OperationBatch`) y `lib/invitados/rsvp.ts` importaba
   las clases de error de `@/lib/errors` (que arrastra `zod` completo, ~84 KB gz, solo para un
   schema que esta ruta no usa). Arreglado SIN tocar ningún fichero fuera de mi territorio:
   - `lib/invitados/rsvp.ts` — `ApiError`/`SessionError`/`UnknownApiError` y `getApiBaseUrl` ahora
     se DEFINEN localmente (misma forma pública), en vez de importarse.
   - `app/(public)/r/[token]/renderPublico.ts` (nuevo) — fetch mínimo de
     `GET /public/i/{publicToken}/render`, reutilizando las clases de arriba, sin pasar por
     `lib/api-client.ts`.
   - `PantallaInvitado.tsx` usa `obtenerRenderPublico` en vez de `getPublicRender`.
   - Peso final: **148.6 KB gz** (bajo el límite de 150 KB). Detalle abajo.

## A medias

Ninguno — no quedó nada sin terminar de mi encargo.

## Pendiente (no es mío, para que quede registrado)

- `apps/web/scripts/check-budget.mjs` no tiene entrada para `/r/[token]` en `LIMITES_BASE` (solo
  `/`, `/i/[publicToken]`, `/editor/[invitationId]`) — el script no lo mide por defecto. No lo toqué
  (fuera de mi territorio). El orquestador debería añadir la línea `"/r/[token]": 150 * 1024,`
  cuando alguien con permiso sobre ese script pase por ahí.
- Las 3 rojas de `PantallaInvitados.test.tsx` y la de `components/sitio/portada.test.tsx` siguen
  ahí (o ya las cerró el otro agente) — no son mías, no las toqué.

## Cómo verificar

```
cd /home/user/RSVP-Lino-y-Sello/frontend
pnpm --filter web run test          # 709 pruebas, 1 roja (portada.test.tsx, ajena)
pnpm -r run typecheck               # verde
pnpm run build                      # /r/[token] compila como ƒ (dinámica)
```
Peso (el script no cubre esta ruta; medido a mano con la misma lógica de `check-budget.mjs`):
runtime común 128.0 KB + JS propio 20.7 KB = **148.6 KB gz** (límite hermano 150 KB).
