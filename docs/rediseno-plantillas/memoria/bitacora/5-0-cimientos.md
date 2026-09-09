# Bitácora — fase 5, sesión E1 (cimientos), 2026-09-09

Rama `claude/fase-5-cimientos-adenda-u150eq`, desde `origin/claude/fase-5-producto` (`6535114`).

## 0. Lo primero: la rama estaba mal

El entorno dejó la rama designada apuntando al HEAD del CI (`c4326e5`, `claude/ci-github-actions-jobs-9qyd9z`),
que no contiene los prompts de la fase 5 ni las decisiones del dueño. Se rebasó sobre
`origin/claude/fase-5-producto`, que es de donde la adenda del orquestador dice que nace la fase y a
donde tiene que aterrizar el commit de cimientos.

## 1. Lo que se hizo, con quién

Cinco agentes en paralelo sobre territorios disjuntos, más la siembra que hizo el orquestador:

- **5-0a** (Sonnet) — las seis skills de `.claude/skills/`.
- **5-0b-A** (Opus) — inventario del backend heredado.
- **5-0b-B** (Opus) — mapa de producto, wireframes, ADR de la puerta de publicación.
- **5-0c** (Opus) — esqueleto de `modules/product` y ADR del módulo nuevo.
- **5-0d** (Opus) — enganches del frontend.
- **5-0e** — siembra por área, hecha por el orquestador tras la caída de los agentes.

## 2. La incidencia, dicha entera

**Los cinco agentes de la primera ola murieron a la vez** por el límite de sesión de la API
(HTTP 429, «You've hit your session limit · resets 2am UTC»). Dejaron su trabajo en disco pero
ninguno llegó a escribir su bitácora, y **5-0d se cortó tras dejar 2 de las 9 rutas**.

El orquestador **no relanzó agentes**: el límite es de sesión y habrían vuelto a chocar. En su lugar:
verificó lo que había ejecutando las pruebas, escribió las 7 rutas que faltaban siguiendo las
convenciones que 5-0d había dejado establecidas, escribió la siembra, y ensambló el documento único.
Por eso esta bitácora es una sola y no cinco: `bitacora/5-0a.md`, `5-0b-B.md`, `5-0c.md` y `5-0d.md`
no existen, y su contenido está aquí y en `diseno/12-producto-completo.md`.

Sí sobrevivió `bitacora/5-0b-A.md`, que su agente alcanzó a escribir.

## 3. Correcciones que el orquestador hizo sobre la marcha

- **`NEXT_PUBLIC_SITIO_URL` no se crea.** Se detectó a tiempo que `NEXT_PUBLIC_SITE_URL` ya existe y
  está en uso probado (`lib/enlace-publico.ts`, `app/(public)/layout.tsx:32`, `playwright.config.ts`).
  Dos variables para el mismo origen habrían dado enlaces compartidos distintos según qué código los
  construyera, que es el defecto que cerró N-02. Aviso enviado a los dos agentes afectados.
- **El parámetro de ruta del editor es `[invitationId]`, no `[id]`** como decía el prompt.
- **`nav.test.ts` afirmaba que cada icono es una función.** Los 82 iconos se generan con
  `forwardRef`, que en React 19 devuelve un objeto: la prueba fallaba sobre iconos que existen y se
  pintan. Ahora comprueba que el nombre resuelve a algo que React sabe pintar.
- **Dos contradicciones entre agentes**, resueltas en `ADR-5-E1-01` (ruta del invitado) y
  `ADR-5-E1-02` (cuatro subpaquetes, no cinco). Están en `12-producto-completo.md §0`.

## 4. Lo que costó descubrir (verificado contra el backend real)

Salió al escribir la siembra, y las tres cosas son trabajo heredado para E2 y E3:

1. **Una clienta no puede dar de alta a sus propios invitados.** `POST /admin/invitations/{id}/guests/append`
   devuelve `403` con token de USER: `SecurityConfig.kt:42` reserva `/admin/**` a ADMIN y MASTER, y
   la gemela para USER vive en el módulo prohibido `modules/user/invitations`
   (`AdminGuestsController.kt:30-31`). Es trabajo de **E2** en `modules/product/guests`.
2. **El mensaje de error del teléfono miente**: el patrón real es `^\+52\d{10}$` (`Patterns.kt:56`) y
   el mensaje dice «10 digitos numéricos», omitiendo el prefijo obligatorio. Para **E3**.
3. **El teléfono es único y el registro lo dice**, que es un oráculo de enumeración equivalente al de
   correos que cerró N-01. Para **E3**.

## 5. Medido, con salida real

| Comando | Resultado |
|---|---|
| `pnpm -r typecheck` | 6/6 paquetes, sin errores |
| `pnpm --filter web test` | **598 pasan**, 1 falla (preexistente y ajeno); antes del andamio, 566 |
| `pnpm --filter web run build` | correcto; lista las 9 rutas nuevas |
| `./gradlew compileKotlin` | limpio |
| `./gradlew test --tests '*product*'` | **12/12** (3 por subpaquete) |
| rutas de salud contra el backend vivo | `401` sin token en las cuatro: `SecurityConfig` cierra por defecto, que es lo correcto |
| `scripts/seed/{invitados,cuenta,plan,admin}.sh` | los cuatro salen con 0 |
| 4 corridas simultáneas de `seed/invitados.sh` | 4 invitaciones distintas (ids 9, 10, 11, 12) |

**El rojo:** `components/sitio/portada.test.tsx` («la foto que falta queda REGISTRADA como
pendiente»). Falla desde `bfdcbaa`, que integró la imagen de portada sin ejecutar pruebas.
Comprobado con `git stash`: falla igual sin ninguno de los cambios de esta sesión. No se arregla
aquí porque su arreglo vive en la rama de las imágenes, que mergea E6.

## 6. Riesgos que quedan

- **La ADR de la puerta de publicación tiene una consecuencia que nadie ha implementado**: si editar
  es gratis, la invitación tiene que poder nacer sin pagar, y hoy la única alta es
  `POST /admin/invitations/create` con rol ADMIN. Sin esa ruta para USER, «editar gratis» no existe
  porque no hay nada que editar. Está dicho en la propia ADR; es lo primero que E4 (o E2) tiene que
  cerrar con E1 leído.
- **Los secretos en claro de `application.yml`** siguen ahí y solo el dueño puede rotarlos.
- **Ningún e2e nuevo se escribió en esta sesión**: los cimientos son andamio. La regla de aislamiento
  está escrita y la biblioteca de siembra probada, pero la primera prueba real que la use la escribe E2.
