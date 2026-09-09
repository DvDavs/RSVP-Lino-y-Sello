# 5-E3-C2 → **E4**: qué tiene que hacer el cobro para que la invitación suba de plan

Autor: **5-E3-C2** · 2026-09-09 · ADR-5-E3-C2-04 (propuesta) · migración `V44__product_invitation_bridge_by_name_and_plan2.sql`.
Complementa `handoffs/5-1b-contrato-alta.md` §7 y `12-producto-completo.md §B4` (ADR-5-0B-01).

> **Lo que no puedes adivinar, en una frase:** poner `is_paid = true` **no** desbloquea las plantillas
> de plan 2. El `planTier` que ve `templates2` sale de la **fila puente** a la que apunta
> `invitation.template_id`, no del pago. Al cobrar hay que repuntar esa FK.

---

## 1. Por qué es así

`BusinessSnapshotReader` compone el `BusinessSnapshot` de una invitación uniendo
`invitation → invitation_template → event_type / invitation_plan`, y saca de ahí **las dos cosas**:

- `eventKind` ← `event_type` (`BusinessSnapshotReader.kt:69-86`)
- `planTier` ← `invitation_plan.is_premium` → `false` = 1, `true` = 2 (`:63`)

Una invitación de `templates2` no tiene plantilla antigua ninguna, así que `V42` sembró **ocho filas
puente** (una por `eventKind`) con plan **básico**. Por eso hoy toda invitación nueva es `planTier = 1`
y `:choose-template` bloquea con `PlanTierInsufficientException` las plantillas que exigen plan 2
(`EditorDocumentService.kt:121-128`). Eso es correcto y es la puerta de ADR-5-0B-01 funcionando: la
invitación nace sin pagar. Lo que faltaba era **la otra dirección**: cómo sube cuando sí paga.

`V44` la construye: por cada fila puente hay ahora una **gemela de plan 2**.

## 2. Las dieciséis filas puente, y cómo se nombran

| Marcador (`invitation_template.url`) | Plan | `planTier` que produce |
|---|---|---|
| `templates2:wedding` … `templates2:generic` (8 filas) | básico | 1 |
| `templates2:wedding:plan2` … `templates2:generic:plan2` (8 filas) | premium | 2 |

**Resuélvelas siempre por el marcador de `url`, nunca por id.** Los ids 901-908 que citaba la primera
versión del contrato son un detalle de `V42`; las gemelas los toman de la secuencia. Un índice único
parcial (`ux_invitation_template_puente_templates2`, `V42:66-68`) garantiza que cada marcador
identifica **como mucho una** fila. Todas nacen `is_enabled = false` y `price = 0`, así que no
aparecen en el catálogo antiguo ni inventan importes.

## 3. Lo que tienes que hacer al cobrar

En **la misma transacción** en la que marcas el pago (el manejador del webhook de Stripe):

```sql
UPDATE invitation i
   SET template_id = (SELECT g.id
                        FROM invitation_template g
                       WHERE g.url = (SELECT b.url FROM invitation_template b WHERE b.id = i.template_id)
                                     || ':plan2'),
       is_paid    = true,
       updated_at = NOW()
 WHERE i.id = :invitationId
   AND i.uses_templates2 IS TRUE
   AND EXISTS (SELECT 1 FROM invitation_template b
                WHERE b.id = i.template_id
                  AND b.url LIKE 'templates2:%'
                  AND b.url NOT LIKE '%:plan2');
```

- **Es idempotente.** Un webhook repetido no encuentra fila que cumpla el `EXISTS` (ya está en
  `:plan2`) y no cambia nada; el `is_paid = true` de la segunda vez tendrías que aplicarlo aparte si
  quieres que sea incondicional.
- **No toca las invitaciones del módulo antiguo** (`uses_templates2 IS TRUE`) ni las que apunten a una
  plantilla antigua de verdad (`url LIKE 'templates2:%'`): esas ya tienen su propio plan comprado y
  repuntarlas les cambiaría la plantilla real.
- **No cambia el `eventKind`**: la gemela cuelga del mismo `event_type` que su hermana, por
  construcción (`V44` la deriva con un `SELECT` de la fila de plan 1).
- Comprueba **cuántas filas actualizó**. Cero significa una de tres: la invitación no existe, no es de
  `templates2`, o ya estaba en plan 2. Regístralo; no lo trates como éxito silencioso.

## 4. Y al reembolsar o perder un contracargo

ADR-5-0B-01 dice que un reembolso pone `is_paid = false` y retira el release activo. Añade a eso
**quitar el sufijo**, o la clienta se queda con las plantillas de plan 2 elegibles sin haber pagado:

```sql
UPDATE invitation i
   SET template_id = (SELECT b.id
                        FROM invitation_template b
                       WHERE b.url = replace((SELECT g.url FROM invitation_template g WHERE g.id = i.template_id),
                                             ':plan2', '')),
       is_paid    = false,
       updated_at = NOW()
 WHERE i.id = :invitationId
   AND i.uses_templates2 IS TRUE
   AND EXISTS (SELECT 1 FROM invitation_template g
                WHERE g.id = i.template_id AND g.url LIKE 'templates2:%:plan2');
```

**Ojo con el documento ya compuesto.** Bajar el tier **no** deshace una plantilla de plan 2 que la
clienta ya hubiera elegido: `:choose-template` comprueba el tier al elegir, no en cada lectura. Lo que
la puerta de publicación tiene que impedir es **publicar** sin pago, y eso ya lo hace por `is_paid`.
Si quieres además forzar que vuelva a una plantilla de plan 1, es una decisión de producto que hay que
escribir aparte: aquí no está tomada.

## 5. Lo que **no** debes hacer

- **No escribas ids de plantilla en Kotlin.** Ni 901-908 ni los de las gemelas. Marcador de `url`.
- **No pongas `invitation_plan_id` a mano en `invitation`**: esa columna no existe en `invitation`; el
  plan vive en la plantilla, y por eso el mecanismo es repuntar la FK.
- **No añadas una novena fila puente «premium genérica»**: perderías el `eventKind` justo al pagar,
  que es el peor momento para perderlo.
- **No cambies `BusinessSnapshotReader`** para que lea `is_paid`. Sería más limpio, sí, pero lo
  consumen la elección de plantilla y el preflight de publicación; si el dueño quiere ese cambio, va
  con su propia ADR y con las pruebas de `templates2` delante. Anotado en `preguntas-abiertas.md`.
- **No edites `V42` ni `V44`**: ya están aplicadas. Lo que falte, en una migración nueva.

## 6. Cómo lo compruebas sin creerme

```sql
-- ¿qué plan ve templates2 para la invitación N?
SELECT i.id, i.is_paid, t.url, p.is_premium AS plan_tier_2
  FROM invitation i
  JOIN invitation_template t ON t.id = i.template_id
  JOIN invitation_plan p     ON p.id = t.invitation_plan_id
 WHERE i.id = :invitationId;
```

`plan_tier_2 = true` es lo que hace que `:choose-template` acepte una plantilla de `minPlanTier = 2`.

Las pruebas que ya cubren esto por tu lado del muro: `ProductInvitationPuenteV44Test` («existe la
gemela de plan 2 de cada puente y es premium», «las ocho filas puente deducen el eventKind que les
toca»). Si el cobro rompe algo de esto, esas pruebas se ponen rojas antes que ninguna tuya.

## 7. Y una cosa que no es de plan pero te toca

El alta y el borrado del borrador tienen ahora **freno de caudal** (`429 PRD_TOO_MANY_REQUESTS`, 20
por cuenta y 60 por IP cada 15 min). Si el flujo de pago llama a `POST /product/invitations` en algún
reintento automático, cuéntalo: el `429` es un estado nuevo que el frontend del pago tiene que saber
tratar (esperar, no reintentar en bucle). Está en §4 del contrato del alta.
