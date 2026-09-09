# Orquestación — 2026-09-09 (b): evaluación de A (cierre fase 4) y C (E1) y prompts E2–E5

## Evaluación

**A — Cierre de la fase 4: ACEPTADO.** Verificado en `origin/claude/fase-4-kit-de-autor` = `a660088`
(20 commits sobre `d4cb633`): `contratos.md §14`, `00-INDICE` con «Fase 4 CERRADA el 2026-09-09»,
`handoffs/4-para-fase-6.md`, `4-para-fase-5.md`, `bitacora/4-cierre.md`, `issues-fase-4.md`,
`boda-clasica/1.0.2`, `cumple-retro`. Prueba ciega ronda 2: 2 min 44 s, veredicto sí. Adversarial:
1 alta (preview servía cualquier fichero del disco) corregida y verificada revirtiéndola.
Pendientes que heredan otros: I-4CIERRE-06 (e2e del asistente con localizador sin acotar) → E6;
I-4ADV-04 (SVG con `<script>` pasa `check`) → fase 6/7 con nota de seguridad.

**C — Fase 5 E1 cimientos: ACEPTADO con desviaciones anotadas.** `origin/claude/fase-5-producto` =
`9a4cd56` (5 commits). Existen los 6 skills, `diseno/12-producto-completo.md`, `handoffs/5-0-cimientos.md`
(83 líneas: aceptado, la tabla de territorio vale más que el tope), `modules/product/{account,guests,
payments,admin}` con salud, `lib/panel/nav.ts`, `lib/env.ts`, `scripts/seed/{comun,cuenta,invitados,
plan,admin}.sh`. Una bitácora de sesión en vez de una por agente: aceptado por causa mayor (los 5
agentes murieron a la vez por límite de la API); regla nueva: máximo 3 agentes en paralelo y
bitácora parcial a mitad de trabajo.

Hallazgos de E1 que cambian el reparto:
1. **Secretos en claro en `application.yml` y en el histórico** (clave JWT, credenciales AWS,
   contraseña de correo). Acción del dueño: **rotar** las tres hoy. Acción del repo: E3 los sustituye
   por `${VAR}` sin valor por defecto (excepción concedida sobre `application.yml`). No se reescribe
   el histórico: con 17 ramas es más riesgo que beneficio, y la rotación deja muertos los valores.
2. **Alta de invitación por USER no existe** y la puerta «editar gratis» la exige → tarea nueva
   **5-1b** asignada a E3, con contrato publicado en su primer commit para que E2 y E4 lo consuman.
3. **Alta de invitados por USER no existe** → E2, trabajo mayor de lo previsto.

**B — I-CI-01: reporte pendiente.** La rama ya muestra I-CI-01 cerrada pero «el CI se queda en 1
worker por reloj» y una I-CI-03 nueva (flake de axe en la galería). Se evaluará contra el criterio
(≥ 2 workers, dos corridas verdes) cuando llegue el reporte.

## Decisiones del dueño acumuladas (supuesto por defecto entre paréntesis)
- Q-1 Las 9 convertidas se quedan como catálogo de partida (sí). `migration-legacy` se retira en la fase 7 (sí).
- Q-5 Dos nombres de lugar real que quedan como texto en 8 plantillas: ¿cuándo? (fase 6, al vestirlas).
- Q-6 ¿Mecanismo para corregir contenido de una versión registrada? (no: la corrección es una versión patch nueva, como hizo 1.0.2).
- Q-7 Rotar clave JWT, credenciales AWS y contraseña de correo (acción tuya, hoy).

## Modelos para lanzar los orquestadores de chat
- **Fable 5.1**: E4 pagos (dinero, webhook, firma, idempotencia) y, después, E6 integración y cierre (merges de 7 ramas + adversarial global).
- **Opus 5**: E2 invitados/RSVP, E3 cuenta/seguridad/marca, E5 admin.
- Nunca Sonnet como orquestador. Dentro de cada sesión el orquestador reparte: Opus para arquitectura, seguridad, revisión y código entrelazado; Sonnet para pantallas desde skills, formularios, pruebas desde especificación y textos; Haiku para verificaciones mecánicas.

## Adenda común a E2–E5 (se pega debajo del prompt del repositorio)
Ver `2026-09-09-b-adendas.md`.

## Evaluación B — I-CI-01 (reporte recibido después)
**ACEPTADO con el paralelismo NO conseguido y documentado.** Head `acc83fa`. Aislamiento cerrado
(axe con cuenta e invitación propias; capturas con la sembrada bajo mutex por razones medidas;
`a11y-publico` ya no purga la caché ISR compartida). Dos corridas verdes consecutivas (34306781190,
34308150542) con `--fail-on-flaky-tests`, 79 pruebas, pero con **1 worker**: el criterio de ≥ 2
workers no se cumplió por una causa distinta y medida tres veces (el lienzo no pinta bajo
contención de CPU en el runner dentro de los presupuestos de la config y de otros ficheros), fuera
del territorio del encargo → **I-CI-03** con tres salidas propuestas. Disparadores ampliados a
`claude/fase-4-kit-de-autor` y `claude/fase-5-producto`. Se acepta la retirada porque es honesta,
con evidencia y sin cuarentena. I-CI-03 pasa a la fase 7 (o a E6 si le sobra presupuesto).
**No cambia los prompts E2–E5**: la regla 8 (4 workers) se verifica en local, donde la suite pasa
en 1,3 min; el CI sigue en 1 worker hasta cerrar I-CI-03. Para E6: mergear `acc83fa` o posterior,
no subir `workers` en `playwright.config.ts`.
