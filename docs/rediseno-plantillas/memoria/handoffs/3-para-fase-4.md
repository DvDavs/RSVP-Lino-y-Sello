# 3 → fase 4 · lo que hay que saber para empezar

## 0. ANTES DE NADA: una alta crítica sin arreglar
`POST /auth/request-password-reset` devuelve el **token de recuperación en el cuerpo**, sin
autenticar, para cualquier correo. Con él, `/auth/reset-password` cambia la contraseña: **dos
peticiones y la cuenta es tuya**, incluida una MASTER. Reproducido contra el backend real. No se
arregló porque el dueño acotó la excepción sobre `modules/auth` a I-02 («NO tocar nada más»):
**necesita su autorización expresa**. Arreglo propuesto, una línea: quitar `resetToken` de
`RecoveryPasswordSentResponse` (`ResetPasswordService.kt:52-55`); el token ya viaja por correo.
Detalle en `handoffs/3b-adv.md` (N-01) y `preguntas-abiertas.md`.

## 1. Comando único para levantar todo
```bash
scripts/dev-backend.sh start      # backend :6003 + Postgres efímero + Flyway   (~1 min)
scripts/seed-demo.sh              # cuentas, plantillas, invitación publicada    (~30 s)
cd frontend && pnpm install --frozen-lockfile
cd apps/web && pnpm run build && PORT=3000 pnpm run start
```
Editor `http://127.0.0.1:3000/editor` · invitación `http://127.0.0.1:3000/i/<publicToken>` (lo
imprime `seed-demo.sh`; **cambia en cada siembra**). `demo.boda@example.com` / `Demo1234!`, MASTER
`demo.master@example.com` / `Demo1234!`.

Tres trampas que cuestan una medición:
- **Nunca `./gradlew clean` con la demostración viva**: borra `build/`, que es el almacén de assets;
  el render sigue dando `200` con todas las imágenes rotas (`evidencia/fase-3/trampa-gradle-clean.md`).
- Si usas otra base, **exporta `TPL_DEV_DB` también para el e2e**: `e2e/preparar.ts` cae por defecto
  a `invitaciones_dev` y crea invitaciones donde nadie las lee.
- Varias sesiones a la vez: cada una con su `TPL_DEV_PORT`, `TPL_TEST_STATE_DIR` y `TPL_DEV_PIDFILE`.

## 2. Cuánto cuesta hoy una plantilla — MEDIDO
Tres JSON más imágenes, por HTTP a `POST /master/templates2/versions` con token MASTER. Idempotente
por hash, **sin tocar Kotlin ni recompilar**: P4 se cumple.
Una plantilla mínima de **5 secciones / 11 bloques** = **106 líneas** y costó **7 min 29 s** y
**4 intentos** (`evidencia/fase-3/i08-plantilla-minima/`). Referencia: `xv-jardin` 828 líneas /
9 secciones, `boda-clasica` 1.667 / 12 → ~92 líneas por sección.

**Los tres fallos son el dato que importa:** (1) `role` es una **enumeración cerrada** de ~60 valores
(`packages/schema/src/blocks.ts:83`) imposible de adivinar; (2) el bloque `group` no usa
`constraints` sino `min`/`max`/`reorderable`/`itemLabel`/`itemBlocks`, y con 14 ramas en el `oneOf`
el «0 are valid» no dice cuál pretendías; (3) `previewImage` debe estar entre los assets declarados
con `sha256` y `bytes` exactos. **Lo caro no son las 106 líneas: es el vocabulario cerrado**, que
sólo vive en `blocks.ts` y que el validador señala sin poder sugerir.

## 3. Qué necesita el kit de autor
- Vocabulario **descubrible y generado desde el esquema** (roles, tipos, forma por rama del `oneOf`).
- Errores que **sugieran**: «para `type:"group"` faltan `min`, `max`, `itemBlocks`».
- Un andamio `nueva-plantilla <slug>` con `--check` local que valide antes de subir nada.
- `sha256`/`bytes` calculados por la herramienta, nunca tecleados.
- De `packages/sections`: qué variantes admite cada sección y qué `role` espera cada hueco (hoy hay
  que leerse `registry-data.ts`). Del manifiesto: el `id` de asset ya es contrato
  (`ADR-3B-I09-01`), así que un paquete puede referenciar sus imágenes de demostración.

## 4. Qué queda fuera y hay que decidir
- **N-01** (arriba) y **N-02**: el origen del sitio y la CSP del lienzo se hornean en el build, así
  que el mismo artefacto en otro puerto rompe la vista previa y reparte enlaces al puerto errado.
- **Bloqueo de cuenta como DoS**: 5 fallos dejan a la dueña fuera 15 min; la salida habitual es un
  desafío al tercer fallo en vez de bloqueo duro.
- **Márgenes estrechos**: JS **144,2 KB de 150** · LCP mediana **2.241 ms de 2.500**. Cualquier
  sección nueva los toca. Mide con `scripts/measure-lcp.sh`, nunca con una corrida suelta.
- **Deuda de `ADR-3-2d-04`**: `diseno/ejemplos/` y `golden/` siguen con colores que no pasan AA.
- **Subir `boda-clasica` a `1.0.1`**: cambió de contenido en I-09 y una base con la `1.0.0` antigua
  da `409` — que es lo correcto, pero hay que versionar.

## 5. Qué leer, y en qué orden
`contratos.md §12` → `handoffs/3b-adv.md` → `issues-fase-3.md` → `preguntas-abiertas.md` § 3-B.
No hace falta leer las bitácoras de los sub-agentes salvo que vayas a tocar su código.
