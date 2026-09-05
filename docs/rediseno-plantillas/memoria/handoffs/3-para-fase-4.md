# 3 → fase 4 · lo que hay que saber para empezar

## 0. ANTES DE NADA: una alta crítica sin arreglar
`POST /auth/request-password-reset` devuelve el **token de recuperación en el cuerpo**, sin
autenticar, para cualquier correo. Con él, `POST /auth/reset-password` cambia la contraseña: **dos
peticiones y la cuenta es tuya**, incluida una MASTER. Reproducido contra el backend real. No se
arregló porque el dueño acotó la excepción sobre `modules/auth` a I-02 («NO tocar nada más»), así que
**necesita su autorización expresa**. Arreglo propuesto, una línea: quitar `resetToken` de
`RecoveryPasswordSentResponse` (`ResetPasswordService.kt:52-55`) — el token ya viaja por correo.
Detalle en `preguntas-abiertas.md` § fase 3-B y en `handoffs/3b-adv.md` (N-01).

## 1. Comando único para levantar todo
```bash
scripts/dev-backend.sh start            # backend :6003 + Postgres efímero + Flyway  (~1 min)
scripts/seed-demo.sh                    # cuentas, plantillas, invitación publicada  (~30 s)
cd frontend && pnpm install --frozen-lockfile
cd apps/web && pnpm run build && PORT=3000 pnpm run start
```
- Editor `http://127.0.0.1:3000/editor` · invitación pública `http://127.0.0.1:3000/i/<publicToken>`
  (el `publicToken` lo imprime `seed-demo.sh`; **cambia en cada siembra**, no lo escribas a mano).
- Cuentas: `demo.boda@example.com` / `Demo1234!` · MASTER `demo.master@example.com` / `Demo1234!`.
- **Si usas otra base** (`TPL_DEV_DB`), expórtala también para `smoke.sh` y para el e2e:
  `e2e/preparar.ts` cae por defecto a `invitaciones_dev` y crea invitaciones donde nadie las lee.
- **Nunca `./gradlew clean` con la demostración viva**: borra `build/`, que es el almacén local de
  assets, y el render sigue respondiendo `200` con todas las imágenes rotas
  (`evidencia/fase-3/trampa-gradle-clean.md`).
- `scripts/dev-backend.sh stop` borra el clúster. Con varias sesiones, dale a cada una su
  `TPL_DEV_PORT`, su `TPL_TEST_STATE_DIR` y su `TPL_DEV_PIDFILE`.

## 2. Cómo se registra hoy una plantilla, y cuánto cuesta de verdad
Tres JSON (`template.json`, `theme.json`, `defaults.json`) más sus imágenes, por HTTP a
`POST /master/templates2/versions` con token MASTER, o con `scripts/dev-backend.sh register <dir>`.
Idempotente por hash (`ADR-008`) y **sin tocar Kotlin ni recompilar el frontend**: P4 se cumple.

**Medido, no estimado** (`evidencia/fase-3/i08-plantilla-minima/`): una plantilla mínima de
**5 secciones / 11 bloques** son **106 líneas de JSON** y costó **7 min 29 s** y **4 intentos**.
Referencia: `xv-jardin` 828 líneas / 9 secciones · `boda-clasica` 1.667 / 12. ~92 líneas por sección.

**Los tres intentos fallidos son el dato que importa**, porque dicen qué falta:
1. `422`, 164 violaciones — `role` es una **enumeración cerrada** de ~60 valores
   (`packages/schema/src/blocks.ts:83`). Inventé tres, ninguno existe.
2. `422`, 58 violaciones — el bloque `group` no usa `constraints` sino
   `min`/`max`/`reorderable`/`itemLabel`/`itemBlocks`. Con 14 ramas en el `oneOf`, «0 are valid» no
   dice cuál pretendías.
3. `422 TPL_PACKAGE_ASSET_MISMATCH` — `previewImage` debe estar entre los assets declarados, con
   `sha256` y `bytes` exactos, y subirse en el mismo multipart.

**Lo caro no son las 106 líneas: es el vocabulario cerrado**, que hoy sólo vive en `blocks.ts` y que
el validador señala sin poder sugerir. Eso es lo que el kit de autor tiene que resolver.

## 3. Qué necesita el kit de autor
- **Un vocabulario descubrible**: `role`, tipos de bloque y la forma exacta por rama del `oneOf`.
  Generarlo desde el esquema, no escribirlo a mano, o volverá a desincronizarse.
- **Errores que sugieran**: hoy `oneOf` dice «0 are valid»; debería decir «para `type:"group"` faltan
  `min`, `max`, `itemBlocks`».
- **Un andamio**: `nueva-plantilla <slug>` que emita los tres JSON válidos con una sección de cada
  tipo, y un `--check` local que valide **antes** de subir nada.
- **Los assets, calculados**: `sha256` y `bytes` los computa la herramienta; nadie debería teclearlos.
- **De `packages/sections`**: qué variantes admite cada tipo de sección y qué `role` espera cada
  hueco. Hoy hay que leerse `registry-data.ts`.
- **Del manifiesto**: `id` de asset ya es contrato (`ADR-3B-I09-01`), así que un paquete puede
  referenciar sus propias imágenes de demostración. Úsalo.

## 4. Qué queda fuera y hay que decidir
- **N-01** (arriba) y **N-02**: el origen del sitio y la CSP del lienzo se hornean en el build, así
  que el mismo artefacto en otro puerto rompe la vista previa y reparte enlaces al puerto equivocado.
  Es requisito de despliegue, no de código.
- **Bloqueo de cuenta como denegación de servicio**: 5 fallos dejan a la dueña fuera 15 min. Es
  inherente a los números que fijó el dueño; la salida habitual es un desafío al tercer fallo.
- **Márgenes estrechos**: JS 144,2 KB de 150 · LCP mediana 2.241 ms de 2.500. Cualquier sección
  nueva los toca. Mide con `scripts/measure-lcp.sh`, nunca con una corrida suelta.
- **Deuda de `ADR-3-2d-04`**: `diseno/ejemplos/` y `packages/schema/golden/` siguen con colores que
  no pasan AA. Si alguien arma un paquete desde ahí, entra sin AA.
- **Subir `boda-clasica` a `1.0.1`**: su contenido cambió en I-09 y una base con la `1.0.0` antigua
  da `409` — que es lo correcto, pero hay que versionar.

## 5. Qué leer, y en qué orden
`contratos.md §12` (cierre de la fase 3) → `handoffs/3b-adv.md` (las dos altas abiertas) →
`issues-fase-3.md` (qué se cerró y con qué prueba) → `preguntas-abiertas.md` § fase 3-B.
**No hace falta leer las bitácoras de los sub-agentes** salvo que vayas a tocar su código.
