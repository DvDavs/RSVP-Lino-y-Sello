# Estado de la sesión E3 (cuenta, marca, contacto y legal) — fase 5

**Rama**: `claude/fase-5-cuenta-whlhhq`, desde el commit de cimientos `9a4cd56`.
**Última actualización**: 2026-09-09 15:15 UTC. **Sesión terminada.**
**Veredicto de seguridad: CERRABLE**, tras cuatro revisiones adversariales encadenadas
(`5-E3-R1-seguridad.md` → `R2` → `R3-verificacion.md` → `R4-cierre.md`) y seis tandas de corrección.
Queda abierto lo que no cierra ningún código: ver §4.

Este documento existe porque la sesión perdió agentes **dos veces** por el límite de uso de la API
(a las 07:00 y a las 12:00 UTC). Sirve para retomar sin depender del chat.

---

## 1. Qué está terminado, medido y empujado

| Bloque | Commit | Medido |
|---|---|---|
| Prompt íntegro con las dos adendas | `16c0be4` | — |
| S-01 parte 1: cuatro secretos fuera de `application.yml`, con compuerta de arranque | `8a16ebb` | 967 pruebas, 0 fallos |
| **5-1b**: `POST /product/invitations`, alta en borrador por USER + contrato | `075e8b0` | 61 pruebas `*product*`, 0 fallos; verificado con curl |
| **5-1**: registro, verificación de correo (V41), logout global, cambio de contraseña, rotación de refresh, oráculo del teléfono | `a3d982a` | 1343 pruebas, 0 fallos; recorrido curl completo |
| Transporte SMTP desde `application.yml` (R1-04) | `d138590` + `4d18df9` | 1351 pruebas, 0 fallos |
| **5-6**: marca, `/contacto`, `/legal` (+privacidad, +términos), `soporte@` en `/ayuda`, `robots.ts`, `sitemap.ts` | `d138590` + `799216c` | web test 615/616, typecheck 6/6, presupuestos dentro |
| Retirada del volcado `invitaciones.sql` | `d138590` | — |
| **Seis hallazgos de cuenta y acceso** (R1-01, 06, 08, 09, 10, 14) | `0fe3622` + `835b183` | 1414 pruebas, 0 fallos; curl contra backend real |
| S-01 parte 2: los dos tokens de WhatsApp + `docker-compose` (R1-03, R1-13) | `7efbc8f` | 1414 pruebas, 0 fallos; webhook verificado |

**Cifra de referencia buena del backend: 1414 pruebas, 0 fallos**, en pasada limpia sobre `7efbc8f`.
**Cifra de referencia del frontend: 615/616**, donde el único rojo es el conocido y **ajeno**
`components/sitio/portada.test.tsx` (desde `bfdcbaa`; lo cierra E6 al mergear las imágenes). Sin ese
fichero, 603/603.

## 2. Qué está a medias, empujado pero SIN verificar

- **`a2b7bf8` — correcciones del alta (R1-05, R1-11, R1-12, R1-15)**. Trae el limitador de caudal,
  la migración `V44` (filas puente por nombre en vez de por id, más las gemelas de plan 2) y tres
  pruebas nuevas (concurrencia, puente, limitador). **No se ha medido la suite sobre este estado.**
  Falta: cifra real de `./gradlew test`, la ráfaga concurrente de curl que demuestra que el tope ya
  no se pasa, y cerrar `handoffs/5-E3-C2-para-E4.md`.
- **`b6c23a9` y los `wip(...)`**: fotos intermedias. Los commits posteriores de cada bloque son los
  que traen el estado terminado y sus cifras.
- **Nota de higiene**: `d138590`, cuyo mensaje habla solo del volcado SQL, arrastra trabajo a medio
  hacer de los bloques de marca y de correo, porque el orquestador usó `git add -A` con agentes
  vivos. No es la entrega de esos bloques. (Repetido en `preguntas-abiertas.md`.)

## 3. Qué NO está empezado

- **`/perfil`, `/acceso` y `/verificar-correo`** (frontend de cuenta). **`/verificar-correo` es
  urgente**: el backend ya manda correos a esa ruta y hoy quien pulse el enlace cae en un 404.
- **Conectar el asistente al alta de 5-1b** (`components/asistente/**` salvo `tipos-de-evento.ts`,
  y `app/(chrome)/editor/page.tsx`), que hoy depende de una llave de ADMIN.
- **e2e de registro y cuenta** con `fullyParallel` y 4 workers (ADR-5-E1-03).
- **Capturas al dueño** de las pantallas nuevas en tres anchos (390, 768, 1280). **No se ha enviado
  ninguna todavía.**
- **Re-revisión Opus de seguridad**: obligatoria antes de cerrar. El veredicto vigente es NO
  CERRABLE y solo una revisión nueva puede levantarlo.

## 4. Lo que impide cerrar la sesión

1. **La re-revisión no se ha hecho.** Los doce hallazgos de código están corregidos, pero quien los
   corrigió no puede declararse conforme a sí mismo.
2. **R1-02 sigue ABIERTO, y es peor de lo que parecía.** Retirar `invitaciones.sql` **no sacó los
   datos personales del árbol**: `V1__initial_schema.sql` los trae dentro (9 personas reales con sus
   hashes, 8 tokens de refresco en claro) y `V2__…sql` trae la contraseña en claro de cuatro cuentas
   MASTER/ADMIN, **viva**. Una migración aplicada no se puede editar sin romper la suma de Flyway,
   así que es una decisión del dueño con consecuencias de despliegue.
3. **S-01 no se puede dar por cerrado**: todo lo de código está hecho, pero los seis secretos siguen
   en el histórico de git y **siguen siendo válidos**. Solo cierra la **rotación**, que hace el dueño.
   Tabla de rotaciones y qué rompe cada una: al final de `preguntas-abiertas.md`.

## 5. Cómo retomar

```bash
git fetch origin claude/fase-5-cuenta-whlhhq && git checkout claude/fase-5-cuenta-whlhhq
scripts/dev-backend.sh start          # backend :6003 + Postgres efímero
cd frontend && pnpm install --frozen-lockfile
./gradlew test -Pkotlin.daemon.jvmargs=-Xmx3g   # el demonio de Kotlin se queda sin memoria a ratos
```
Leer, en este orden: `bitacora/5-E3-R1-seguridad.md` (el acta) → los contratos publicados
`handoffs/5-1b-contrato-alta.md` y `handoffs/5-E3-A2-contrato-cuenta.md` → las bitácoras
`5-E3-A1…A4`, `B1`, `C1`, `C2`, `C3`.

## 6. Lo que E6 tiene que saber al mergear

- **Contratos publicados que consumen otras sesiones**: `handoffs/5-1b-contrato-alta.md` (E2 y E4) y
  `handoffs/5-E3-C2-para-E4.md` (qué tiene que hacer E4 al cobrar para subir la invitación de plan).
- **Conflictos previsibles**: `lib/i18n.ts` (esta sesión añadió marca, contacto, legal, ayuda y
  cuenta), `application.yml` (excepción concedida a E3: secretos), y `decisiones.md` /
  `preguntas-abiertas.md`, donde **solo se ha añadido al final**.
- **Migraciones tomadas por E3**: `V41`, `V42` y `V44`. `V43` quedó reservada y sin usar.
- **Deuda que se deja dicha**: `/editor/[invitationId]` bloquea el rastreo por `robots` pero su
  `<meta>` sigue diciendo `index,follow` (es de otra sesión); no hay auditoría de quién da de baja
  una cuenta; el limitador de intentos es en memoria y se divide entre instancias; la reactivación
  autoservicio de una cuenta deshabilitada no existe (hoy solo un ADMIN).

---

# ACTUALIZACIÓN FINAL (2026-09-09, 15:15 UTC) — la sesión termina aquí

Lo escrito arriba es de media sesión y se conserva como registro. Esto lo corrige.

## Todo lo de §3 «qué NO está empezado» quedó hecho
`/perfil`, `/acceso` y `/verificar-correo` (`7d4b8e4`) · asistente conectado al alta (`ecdea48`) ·
e2e con 4 workers · **25 capturas enviadas al dueño** (`5691fd3`).

## Cifras finales, medidas por el orquestador y no por los agentes
- **Kotlin: 1443 pruebas · 0 fallos · 0 errores · 0 saltadas**, sobre 107 XML (`./gradlew cleanTest test`).
- **Web: 713/714.** El único rojo es `components/sitio/portada.test.tsx`, **ajeno**: verificado con
  `git log 9a4cd56..HEAD` que ni esa prueba ni `Hero.tsx` se tocaron en esta rama. Lo cierra E6 al
  mergear las imágenes. Sin ese fichero, 713/713.
- **`typecheck` 6/6.** **e2e**: `cuenta.spec.ts` 9/9 (verificado `--workers=4 --repeat-each=2` → 18/18),
  `registro-alta.spec.ts` 4/4 con 4 workers, suite completa **90/90**.

## Las cuatro revisiones, y por qué importan
Cada una encontró algo real **después** del visto bueno parcial de la anterior:
R1 (15 hallazgos, NO CERRABLE) → R2 (CERRABLE CON CORRECCIONES; 11 nuevos, y detectó que el
orquestador había omitido R1-07 al repartir) → R3 (2 nuevos, uno de ellos causado por un arreglo
anterior) → R4 (R4-01 ALTA, que además **falsificaba una afirmación de una bitácora**).
Los 26 hallazgos de código están cerrados con prueba en rojo antes y verde después.

## §4 se sustituye por esto: lo que queda, y NO lo cierra ningún código
1. **Datos personales en `V1` y `V2`.** Retirar `invitaciones.sql` no bastó: `V1` trae nueve
   personas reales con sus hashes y ocho tokens de refresco, y **`V2` cuatro contraseñas en claro de
   cuentas MASTER/ADMIN, vivas**. Recomendación de R2, por orden: (a) hoy, cambiar esas cuatro
   contraseñas desde la aplicación, que es lo único que corta el acceso; (b) un `V45` que borre los
   tokens y anonimice las filas; (c) solo con fecha, reescribir el histórico junto con los secretos
   de S-01, con `flyway repair` en cada entorno. Editar `V1`/`V2` sin (c) no saca nada del histórico
   y deja los entornos nuevos sin MASTER de arranque.
2. **Rotación de S-01.** Los seis secretos están fuera del código pero **siguen en el histórico y
   siguen siendo válidos**. Tabla de qué rotar y qué se rompe al rotar cada uno, en `preguntas-abiertas.md`.
3. **Revisión legal** del aviso de privacidad y los términos: son borradores y lo dicen en pantalla.
4. **Decisiones de despliegue**: `forward-headers-strategy` (sin proxy declarado, el techo global del
   registro es una denegación de servicio barata: 0,33 pet/s cierran el alta para todos), el
   limitador en memoria si se despliega más de una instancia, y el proveedor de correo (hoy un Gmail
   personal por SMTP con cuota de cuenta gratuita).
5. **Anotados y sin arreglar, por severidad**: R2-03 (bloqueo de cuenta ajena con contraseñas malas,
   deuda declarada fuera de alcance desde la fase 3-C), R4-02 (bcrypt sin techo en `/auth/token`),
   R4-03 y R3-03/R3-04 (BAJA), y que `CustomerEntity` es una `data class` cuyo `toString()` arrastra
   hash y tokens — **verificado que hoy no es explotable**, pero es munición cargada.

## Para E6, además de §6
Migraciones de E3: **`V41`, `V42`, `V44`**. **`V43` nunca existió: la siguiente debe ser `V45`**, o
una `V43` posterior quedaría pendiente y sin aplicar.
Contratos publicados que consumen otras sesiones: `handoffs/5-1b-contrato-alta.md` (E2 y E4) y
`handoffs/5-E3-C2-para-E4.md` — **al cobrar hay que repuntar `template_id`; `is_paid` por sí solo no
desbloquea plan 2**.
