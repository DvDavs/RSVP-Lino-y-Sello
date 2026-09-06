# Bitácora — CI real en GitHub Actions

Rama de trabajo: `claude/ci-github-actions-jobs-9qyd9z` (nace de `claude/ci-github-actions`, `253ebb7`,
que a su vez nace del cierre de la fase 3-C, `26f0d49`). Alcance tocado: `.github/workflows/ci.yml`,
`scripts/ci-backend.sh` (nuevo), `README.md` (nuevo) y esta memoria. **Cero cambios** en código de
producto, pruebas, `build.gradle.kts` o `frontend/**`.

## Corridas leídas (todas por las herramientas MCP de GitHub, ninguna inferida)

| # | Commit | Resultado | Qué enseñó |
|---|---|---|---|
| [19](https://github.com/DvDavs/RSVP---Lino-Sello/actions/runs/33952077339) | `2e1f175` (fase 3) | `backend` ✅ 5 m 11 s · `frontend` ✅ 3 m 36 s · `e2e` ❌ 0 s | el encargo decía que el CI «nunca se había ejecutado»: se había ejecutado 19 veces y nadie leyó el log. `e2e` moría en el primer paso de Playwright |
| [20](https://github.com/DvDavs/RSVP---Lino-Sello/actions/runs/34051080376) | `ef6c947` | `backend` ✅ · `frontend` ✅ · `e2e` ❌ | primera corrida en esta rama, con los tres jobs en paralelo. Confirma el mismo fallo de 0 s: `pnpm exec playwright` sin `--filter web` |

| [21](https://github.com/DvDavs/RSVP---Lino-Sello/actions/runs/34051529623) | `e897684` | `backend` ✅ · `frontend` ✅ · `design` ✅ 279/279 en 4 m 59 s · `e2e` ❌ 31/77 | el Chromium 1194 iguala el runner al entorno local: la galería pasa entera a la primera. El `e2e` cae por un fallo NUEVO y real: `e2e/preparar.ts` abre `psql` sin contraseña contra el servicio `postgres:16` (46 pruebas, el mismo error en todas). Backend arriba en 94 s, siembra en 4 s |

(la tabla se completa abajo con las corridas de esta rama)

## Decisiones tomadas
- **Los cuatro jobs corren en paralelo.** El `needs: [backend, frontend]` del job `e2e` solo servía
  para ahorrar minutos de runner cuando algo obvio falla; a cambio serializaba el reloj y, mientras
  `e2e` estuvo roto, impidió ver en la misma corrida los fallos de los tres. El encargo fija < 25 min
  de reloj y autoriza paralelizar.
- **La galería de diseño sale a un job propio (`design`).** No toca backend ni Postgres; sumada al
  job `e2e` metía un `next build` y 279 pruebas más en el job más largo.
- **Ninguna prueba se recorta ni se pone en cuarentena.** El único spec con historial de flakiness
  corre aparte con `--workers=1` y sigue siendo capaz de romper el job (`--fail-on-flaky-tests`).
