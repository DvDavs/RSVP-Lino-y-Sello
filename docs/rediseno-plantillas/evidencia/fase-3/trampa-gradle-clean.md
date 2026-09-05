# Trampa de entorno: `./gradlew clean` borra el almacén de assets y deja la base mintiendo

**La pisó el orquestador de la fase 3-B durante la re-verificación.** Se documenta porque no es obvia,
porque contaminó una suite entera de e2e y porque quien retome esto la va a pisar igual.

## Qué pasa

`scripts/dev-backend.sh` arranca el backend en modo de assets **local** (ADR-3-0a-02, porque en este
entorno no hay bucket de S3 utilizable) y fija:

```
TEMPLATES2_ASSETS_LOCAL_DIR = $RAIZ/build/templates2-assets
```

Es decir: **el almacén de ficheros vive dentro de `build/`**. Y `./gradlew clean` borra `build/`
entero. Las filas de `tpl_asset` siguen en Postgres con su `s3_key`, el `composed` congelado en
`tpl_release` sigue trayendo las URL, pero **los ficheros ya no están**.

## Cómo se manifiesta (medido)

```
GET /public/i/<token>/render                                        → HTTP 200   (la base responde)
GET /public/templates2-assets/templates2/invitation/3/ebaf…webp     → HTTP 404   (el fichero no está)
```

La invitación «existe», el JSON del render está completo, el enlace público responde 200 — y sin
embargo **ninguna imagen carga**. En la suite e2e eso salió como **10 pruebas fallidas** con
`TimeoutError: page.waitForFunction`, repartidas por specs que no tienen nada que ver entre sí
(`a11y-publico`, `clienta-sin-sesion`, `flujo-principal`, `render-publico`, `editor-nucleo`,
`publicar`, `cambiar-fecha`). Ninguna decía «falta una imagen»: todas parecían un fallo de la
aplicación.

Peor: `./gradlew clean` **también borra `build/dev/backend.log` y `build/dev/backend.pid`** con el
backend en marcha. El proceso sobrevive, pero se queda sin log y `dev-backend.sh` pierde su PID, así
que `stop` ya no sabe a quién matar.

## Por qué no basta con volver a sembrar

`scripts/seed-demo.sh` registra el paquete por HTTP y el registro es **idempotente por hash**
(ADR-008): si la versión ya está registrada responde `noop_same_hash` y **no vuelve a subir los
ficheros**. La base cree que los tiene. Hay que forzar un registro de verdad.

## Qué hacer

- **Preferible: no ejecutar `./gradlew clean` con una demostración sembrada viva.** Para cifras
  limpias de la suite basta con `./gradlew test` (o `--rerun-tasks`), que no toca `build/dev/` ni
  `build/templates2-assets/`.
- **Si ya la pisaste**: levanta la demostración sobre una base nueva, que fuerza el registro completo
  y vuelve a subir los assets. Sin destruir nada:
  ```
  TPL_DEV_DB=invitaciones_<nueva> scripts/dev-backend.sh start
  TPL_DEV_DB=invitaciones_<nueva> scripts/seed-demo.sh
  ```
  El enlace público cambia: el `publicToken` es nuevo. Actualiza lo que dependa de él.
- **Comprobación de sanidad antes de creerte cualquier medida de render, WCAG, contraste o LCP**:
  ```
  URL=$(curl -sS "$BASE/public/i/<token>/render" | jq -r '[.. | objects | select(.kind=="image") | .url] | .[0]')
  curl -sS -o /dev/null -w '%{http_code}\n' "$URL"      # tiene que dar 200
  ```

## Arreglo de fondo, no hecho aquí

Sacar `TEMPLATES2_ASSETS_LOCAL_DIR` de `build/` (por ejemplo a `.dev/templates2-assets/`, fuera del
alcance de `clean`) lo evitaría de raíz. No se hace en la fase 3-B por disciplina de alcance: es un
cambio de utillaje que nadie pidió y la fase estaba cerrándose. Queda en `preguntas-abiertas.md`.
