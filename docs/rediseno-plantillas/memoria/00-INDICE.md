# Memoria compartida del rediseño del módulo de plantillas e invitaciones

Prompt maestro: `docs/analisis-plantillas/PROMPT-REDISENO-MODULO-PLANTILLAS.md` (secciones 1, 3, 7 y 10 son de lectura obligatoria para todo sub-agente).
Auditoría de partida: `docs/analisis-plantillas/` (informe final + `fases/`).
Rama de trabajo: `claude/agent-network-invitation-41nx5y` (sustituye a `claude/rediseno-plantillas` por instrucción del entorno).

## Cómo leer esta memoria en 5 minutos
1. Este índice: estado de la fase actual.
2. `decisiones.md`: solo las ADR con estado **aceptada**.
3. `contratos.md`: esquemas, API, stack y nombres vigentes.
4. `glosario.md`: vocabulario acordado.
5. `handoffs/` que indique tu brief.

## Archivos
| Archivo | Qué es |
|---|---|
| `decisiones.md` | Registro ADR append-only (propuesta / aceptada / rechazada) |
| `contratos.md` | Contratos vigentes (esquemas, interfaces, rutas, paquetes) |
| `glosario.md` | Vocabulario |
| `tablero.md` | Tareas por fase y estado |
| `preguntas-abiertas.md` | Preguntas para el dueño con el supuesto tomado |
| `bitacora/<fase>-<agente>.md` | Una entrada por sub-agente y tarea |
| `handoffs/<fase>-<agente>.md` | Resumen estructurado (≤ 60 líneas) para el siguiente agente |
| `../diseno/` | Entregables de diseño de la fase 1 |
| `../guias/` | Guías de uso (fase 6) |

## Estado actual
- **Fase 1 — Diseño: CERRADA el 2026-09-03.** Los 7 documentos de diseño existían desde una sesión anterior, pero los había escrito un solo agente Sonnet en secuencia, sin revisión independiente. La **ronda 1R** los revisó adversarialmente y los profundizó hasta grado de implementación: cuatro revisores Opus en paralelo sobre bloques disjuntos, un dirimidor Opus para las 16 contradicciones entre bloques, y una verificación mecánica. 44 objeciones altas encontradas y corregidas, 0 abiertas. 88 ADR aceptadas (34 originales, 15 de ellas con enmienda, más 54 de la ronda). El esquema Zod se verificó **ejecutándolo**, no leyéndolo.
- **Fase 2 — Backend del módulo nuevo: CERRADA el 2026-09-04.** Seis bloques (dos Sonnet con revisor Opus obligatorio, cuatro Opus) en worktrees aislados, integrados con `git merge --no-ff` y suite completa tras cada merge, más tres revisiones adversariales Opus. **1 186 pruebas Kotlin y 458 TypeScript, 0 fallos.** Las dos verificaciones que la fase 1 dejó pendientes quedaron resueltas **ejecutándolas**: networknt acepta el bundle con `$defs` sin salir a la red y valida 10/10 ejemplos, y el espejo Kotlin de las invariantes casa 102/102. 50 ADR aceptadas, ninguna rechazada.
- **Fase 3 — Frontend: I-01…I-12 CERRADAS el 2026-09-05 (fase 3-B). CIERRE FORMAL RETENIDO.**
  La fase 3 se agotó dejando la revisión adversarial con veredicto **NO CERRABLE** y cinco altas
  abiertas. La fase 3-B las cerró las cinco, más las doce issues numeradas, con **prueba ejecutada y
  verificada por el orquestador** —no por el reporte del sub-agente—: en la mayoría se saboteó el
  arreglo para ver la compuerta en rojo antes de aceptarla. Cifras en `contratos.md §12`.
  **Pero la fase no se declara cerrada**, y el motivo está en `handoffs/3b-adv.md`: la revisión
  adversarial repetida encontró **dos altas nuevas**. La grave es **N-01**, una toma de cuenta
  completa en dos peticiones por `POST /auth/request-password-reset`, que devuelve el token de
  recuperación sin autenticar para cualquier correo, incluida una cuenta MASTER. Vive en
  `modules/auth`, área que el dueño acotó a I-02 con un «NO tocar nada más», así que **necesita su
  autorización expresa**; el arreglo propuesto es de una línea y está en `preguntas-abiertas.md`.
  Rama: `claude/fase-3b-cierre-orquestacion-z0pd4g`.
- **Fase 3-C — sistema de diseño e identidad visual del producto: CERRADA el 2026-09-06.**
  Rama `claude/fase-3c-identidad-visual-wqg0d2` (desde `claude/fase-3b-cierre-orquestacion-z0pd4g` en
  `62e3c84`). Bloque -1: N-01 y N-02 heredadas cerradas (`85ce3b6`). Bloque 0: dirección de arte
  (`diseno/11-sistema-de-diseno.md`, moodboard con tres paletas y tres parejas tipográficas; elegidas
  Bugambilia y Fraunces + Onest + Red Hat Mono). Bloque 1: `@invitaciones/tokens` (252 parejas AA
  verificadas por script, 0 fallos), tipografía autoalojada, `@invitaciones/icons` (82) y formas (14).
  Bloque 2: 25 componentes en `@invitaciones/ui` y galería `/design` con regresión visual, contraste
  sobre la pila renderizada y axe (279 pruebas sin backend). Bloque 3: portada, acceso, ayuda, 404,
  asistente de creación en cuatro pasos y chrome del editor sobre el sistema; e2e 70/70 contra
  backend real, presupuestos `/i` 142 KB y `/` 148 KB gz, LCP bajo 2,5 s. Cierre: revisión visual
  (CUMPLE tras 4 altas corregidas), adversarial (CERRABLE tras A-01/A-02) y recorrido de UX sin
  instrucciones (NO al llegar, seis graves; corregidas por UX-A/B/C, ver `handoffs/3c-ux.md`).
  Guía de 15 minutos en `guias/identidad-visual.md`; contrato en `contratos.md §13`. 24 ADR-3C
  aceptadas. Regla nueva del dueño: contexto por agente ≤ 300k con handoff parcial y relevo.
  Estado por bloque en `tablero.md`; arranque de la siguiente fase en `handoffs/3c-para-siguiente.md`.
- **Fase siguiente: 4 — kit de autor de plantillas.** Arranca leyendo `handoffs/3-para-fase-4.md` y
  `handoffs/3c-para-siguiente.md` (N-01 y N-02 ya están resueltas en la 3-C).
- **Rama de la fase 2: `claude/fase-2-backend-orchestration-ksyuzi`**, creada desde `claude/agent-network-invitation-41nx5y` en `88238b2` (fase 1 cerrada en `4681b2c` + el prompt de la fase 2). El entorno de esta sesión obliga a trabajar sobre una rama propia por fase; `contratos.md §1` y `brief-comun.md` siguen nombrando la rama de la fase 1, que es la base, no la de trabajo actual.
- Fases: 0 Preparación (cerrada) · 1 Diseño (cerrada) · 2 Backend (**cerrada**) · **3 Frontend (siguiente)** · 4 Plantillas y kit · 5 Migración · 6 Calidad y entrega.
- Nota de entorno: en este entorno los sub-agentes **no** pueden lanzar sub-agentes. El orquestador de cada fase lanza todos los agentes directamente (red de un solo nivel).

## Fase 1 cerrada — qué leer para empezar la fase 2, en este orden
1. **`memoria/contratos.md`** — es el contrato vigente y manda sobre cualquier documento de `diseno/` que lo contradiga. Trae esquema, API, persistencia, pruebas, frontend, migración y contrato de IA, con el estado real del entorno de build.
2. `diseno/01-dominio-y-esquema.md` + `diseno/esquema/*.ts` + `diseno/ejemplos/**` — el contrato de datos completo, con firmas en TypeScript y Kotlin, pseudocódigo del merge y los hashes. Verificado ejecutándolo.
3. `diseno/02-persistencia-y-catalogo.md` — DDL final copiable (migraciones `V29`-`V37`) y el árbol de clases Kotlin nombradas una por una.
4. `diseno/03-api.md` — las 19 rutas con contrato completo, la matriz rol × ruta y los códigos `TPL_*`.
5. `memoria/preguntas-abiertas.md` — 63 supuestos agrupados por área que la fase 2 **no debe volver a decidir por su cuenta**.
6. `memoria/handoffs/1R-dirimidor.md` — qué se decidió en cada contradicción y por qué; evita reabrir debates ya cerrados.
7. `diseno/08-*.md` y `09-*.md` — el rastro adversarial: por qué el diseño es como es. No hacen falta para empezar, sí para no deshacer una corrección sin saberlo.
8. `diseno/04`, `05`, `06`, `07` — para las fases 3, 5, transversal de calidad y futura de IA. No bloquean el arranque del backend, salvo `06` (umbrales y CI, que la fase 2 debe implementar) y dos tareas que `04` deja para el backend: el webhook de revalidación y el CORS de las tipografías.

**Lo primero que debe hacer la fase 2**, antes de escribir código de negocio: arreglar el build (el toolchain Java 17 no compila hoy; ver `handoffs/0-build-jdk.md`), crear el `ci.yml` de `06 §9`, y comprobar lo único que quedó sin verificar por falta de JDK — que `com.networknt:json-schema-validator` acepte el bundle con `$defs` y que el espejo Kotlin de las invariantes case con el de TypeScript.


## Fase 2 cerrada — qué leer para empezar la fase 3, en este orden
1. **`memoria/handoffs/2-para-fase-3.md`** — cómo arrancar el backend, las 19 rutas que consume el editor, el JWT de prueba y lo que no se implementó.
2. **`memoria/contratos.md`**, en especial su **§11** (cierre de la fase 2) y las enmiendas de §1, §4, §5, §6 y §8.
3. `diseno/04-frontend-y-editor.md` — 1 624 líneas a grado de implementación; es el documento principal de la fase 3.
4. `memoria/preguntas-abiertas.md` — supuestos que la fase 3 **no** debe volver a decidir por su cuenta.
5. `memoria/bitacora/2-adv.md` — la revisión adversarial de cierre: qué quedó abierto y por qué.

**Lo primero que debe hacer la fase 3**: la compuerta medible **A1-A8** del lienzo en iframe (`contratos §8`, ADR-1R-F-02) — todo el editor depende de su resultado. Y, antes de poder levantar el backend, resolver el defecto **preexistente y ajeno** de `invitation_guest.graduates_name` (ADR-2-ORQ-02): hoy ningún entorno nuevo arranca la aplicación completa.

## CI en GitHub verificado el 2026-09-06
`.github/workflows/ci.yml` deja de ser papel: los cuatro jobs (`backend`, `frontend`, `e2e`, `design`)
corren de verdad en GitHub Actions y quedan en verde sobre esta rama: corrida
[34053300447](https://github.com/DvDavs/RSVP---Lino-Sello/actions/runs/34053300447) (`c835654`),
**10 min 15 s** de reloj — `backend` 5 m 57 s · `frontend` 6 m 04 s · `design` 6 m 09 s (279/279) ·
`e2e` 10 m 11 s (79/79 contra el backend real + LHCI). Antes de esta tarea el workflow
llevaba 19 corridas seguidas en rojo sin que nadie leyera el log: el job `e2e` moría en 0 s y ninguna
prueba de extremo a extremo se había ejecutado jamás en el runner. Correcciones, tiempos por job y lo
que quedó abierto: `handoffs/ci-github.md`, `bitacora/ci-github.md` e `issues-ci.md` (I-CI-01 e I-CI-02).
