# Bitácora 5-4 · orquestador de la sesión E4 (planes y pagos con Stripe) · 2026-09-09

Rama `claude/fase-5-pagos-hmb028` desde `9a4cd56` (cimientos). Prompt con adendas en
`prompts/fase-5/E4-pagos-stripe.md`. Contrato previo a los agentes: `handoffs/5-4-contrato-pagos.md`.
Handoff para E6: `handoffs/5-4-para-E6.md`.

## Reparto y veredictos
| Agente | Modelo | Encargo | Resultado | Bitácora |
|---|---|---|---|---|
| 5-4-A | Opus | backend `modules/product/payments`, V42–V44, puerta `TPL_PLAN_UNPAID`, stripe-java 29.5.0 | aceptado; `./gradlew check` 1337/0 en su entrega | `5-4-A.md`, `handoffs/5-4-A.md` |
| 5-4-B1 | Sonnet | `lib/pagos` + `/precios` | aceptado con correcciones de R1 | `5-4-B1.md` |
| 5-4-B2 | Sonnet | `/editor/[id]/plan`, bloqueo en `PublishDialog`, `PasoListo` | aceptado con correcciones de R1 | `5-4-B2.md` |
| 5-4-B3 | Sonnet | `/pago` (esperando, confirmado, cancelado) | aceptado con correcciones de R1 | `5-4-B3.md` |
| 5-4-R1 | Opus | revisión de B1–B3 | 3 altas y 8 medias corregidas en sitio; bajas anotadas | `5-4-R1.md` |
| 5-4-E | Sonnet | e2e `pagos-puerta`, `pagos-compra`, `preparar-pagos` | 16/16 con 4 workers y repeat-each=2 | `5-4-E.md` |
| 5-4-ADV | Opus | revisión adversarial | **CERRABLE**; 7 medias/bajas corregidas con prueba; A-01 (S-03) abierta para E5 | `5-4-adv.md` |
| 5-4-CAP | Sonnet | 21 capturas con backend real | 21/21 verificadas; 2 defectos visuales anotados | `evidencia/fase-5/e4/README.md` |
| 5-4-V | Sonnet | los 2 defectos visuales | corregidos (`HistorialDePagos.tsx`, `PantallaPago.tsx`) | README de evidencia |

Máximo tres agentes en paralelo en todo momento. Incidencia: 5-4-ADV y 5-4-CAP murieron a la vez por
el límite de sesión de la API (429, reinicio 12:00 UTC) con el trabajo en disco; se reanudaron los
mismos agentes 13 minutos después y terminaron. El contenedor se reinició en ese intervalo (backend y
Postgres caídos): se relevantaron con el mismo secreto de webhook efímero y la demo se volvió a sembrar.
La suite e2e completa que corrió 5-4-E sobrescribió capturas de las fases 3 y 3-C (`editor-3c-evidencia.spec.ts`);
el orquestador las revirtió con `git checkout` antes de commitear.

## Cifras finales medidas por el orquestador sobre el árbol final
- `pnpm -r run typecheck`: 6/6 paquetes `Done`, 0 errores.
- `pnpm --filter web test`: **667 pasan / 668** (77/78 ficheros). El único rojo es `components/sitio/portada.test.tsx`,
  preexistente desde `bfdcbaa` y ajeno (lo cierra E6 con las imágenes). Antes de E4: 598.
- `pnpm --filter web run lint`: 0 errores, 1 aviso ajeno (`e2e/flujo-principal.spec.ts:94`).
- `./gradlew check` (medido por 5-4-ADV sobre el backend final): **1351 pruebas, 0 fallos**; `*product*` + `*Release*`: 94/0.
- e2e de pagos contra el backend endurecido (`STRIPE_WEBHOOK_SECRET` efímero exportado, `PW_PORT=3260`):
  `pagos-puerta` + `pagos-compra` con `--workers=4 --repeat-each=2` → **16 passed (30.0s)**.
- Suite e2e completa (medida por 5-4-E, 4 workers): 86/87; el rojo es `clienta-sin-sesion.spec.ts` (timeout de UI, ajeno).

## Decisiones del orquestador (no ADR)
- `formatearImporte` se queda en `$899.00` (Intl es-MX) sin sufijo `MXN` mientras solo se venda en pesos.
- `PublishDialog.tsx` y `PasoListo.tsx` se tocan fuera del territorio literal porque ADR-5-0B-01 §4 exige que el
  bloqueo enseñe la salida al plan y ningún botón muerto; diffs mínimos y aditivos, anotados para E6.
- `frontend/apps/web/AGENTS.md` y `CLAUDE.md` los genera `next dev`/`next build` (Next 16); no se commitean.

## Lo que no se hizo y por qué
- No hay cuenta de Stripe en el entorno: `CheckoutService.crearSesion` nunca corrió contra Stripe real; todo el
  flujo posterior al checkout se probó con el webhook firmado.
- Correos de pago (transporte de E3), `mark-as-paid` sin jerarquía (E5), alta de invitación para USER (E3).
