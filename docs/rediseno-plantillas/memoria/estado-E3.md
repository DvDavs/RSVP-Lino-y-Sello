# Estado de la sesión E3 (cuenta, marca, contacto y legal) — fase 5

**Rama**: `claude/fase-5-cuenta-whlhhq`, desde el commit de cimientos `9a4cd56`.
**Última actualización**: 2026-09-09 12:15 UTC.
**Veredicto vigente de seguridad: NO CERRABLE** (`bitacora/5-E3-R1-seguridad.md`). Ver §4.

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
