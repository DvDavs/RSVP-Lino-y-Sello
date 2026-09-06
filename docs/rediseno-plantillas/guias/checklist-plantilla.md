# Checklist antes de dar una plantilla por buena

Una página. Cada punto es algo que se **comprueba** (un comando, algo que se ve en pantalla o en el
navegador) — nada que haya que dar por supuesto. Sirve igual para quien la crea (márcalo tú mismo
antes de pedir revisión) y para quien la revisa (repite el comando, no te fíes de que "ya lo hice").
Guía completa, con cada comando y sus errores: `guias/como-agregar-una-plantilla.md`.

## Entorno
- [ ] `cd frontend && pnpm install` hecho en esta copia del repositorio (sin él `pnpm plantilla` no
      arranca; el propio comando te lo dice con `FALTA Dependencias instaladas`).
- [ ] `pnpm plantilla doctor` no imprime ningún `FALTA` (los `AVISO` de cuenta MASTER y base
      sembrada son normales si ya sembraste antes).

## El paquete en sí
- [ ] El directorio vive fuera de `frontend/templates/` mientras lo editas (`--destino` a un
      temporal) — evita tumbar la suite de `sections`, que parsea todo `frontend/templates/*/*/`.
- [ ] `pnpm plantilla check <dir>` termina con `0 error(es)` (los avisos, si quedan, están
      entendidos y son intencionales — anótalos al pedir revisión).
- [ ] La última línea de `check` imprime un `package_hash = sha256:…`: si no aparece, `check` no
      llegó a terminar de validar y hay que mirar el error de arriba.
- [ ] Ningún texto de `defaults.json` es el de relleno que trae el andamio (frases del tipo "Nombre
      o título principal de la portada"): todos son textos reales del ejemplo.
- [ ] `check` no reportó ningún `AVISO TPL_LABEL_DE_ANDAMIO`: ningún `label` de `template.json` se
      quedó con la frase con la que el catálogo describe el hueco. Repásalos igualmente uno por uno
      leyendo `template.json` — en las secciones de familia el `label` se PUBLICA (título del grupo,
      parentesco bajo cada nombre), así que ahí es texto de cara al invitado, no un rótulo interno.
- [ ] Cada hueco que no sea un texto suelto (`richText`, `location`, `date`, grupos) se rellenó con
      la forma que da `pnpm plantilla bloque <tipo>`, no a ojo.
- [ ] Toda imagen obligatoria (las que `pnpm plantilla secciones <tipo>` marca `obligatorio`) tiene
      un archivo real en `assets/` y una entrada en `defaults.json` — no un hueco vacío.

## Revisión visual
- [ ] `pnpm plantilla preview <dir>` abre sin ningún `ERROR` en la consola del navegador (si el
      paquete no pasa `check`, `preview` enseña el mismo diagnóstico de tres líneas, no una página
      en blanco — si ves eso, vuelve al punto de `check`).
- [ ] Revisada en los dos marcos a la vez (390 y 1280 px) — no sólo el de escritorio.
- [ ] En la captura no aparece ningún texto que suene a instrucción para quien edita («Lista
      repetible de…», «Título de la sección») en un sitio donde lo vería un invitado.
- [ ] `pnpm plantilla capturas <dir>` produce 3 PNG (390/768/1280) **fuera** de `<dir>`, en
      `<slug>/capturas/` — ábrelos y compáralos con el previsualizador.
- [ ] Ninguna captura muestra texto sobre foto sin separación (papel, banda, tarjeta) ni un
      rectángulo duro de foto sin máscara ni forma (identidad visual, regla dura).

## Contraste y tipografía
- [ ] `check` no reportó ningún `TPL_PALETTE_CONTRAST_BELOW_AA` (si lo reportó y lo corregiste,
      vuelve a correr `check` para confirmar que ya no sale).
- [ ] `check` no reportó ningún `TPL_FONT_NOT_SELF_HOSTED`: toda familia de `theme.json` está en la
      lista autoalojada que el propio error te da.

## Registro
- [ ] `pnpm plantilla registrar <dir>` devolvió `201 created` (primera vez) o `200 noop_same_hash`
      (si ya la habías registrado con el mismo contenido) — nunca un `4xx`/`5xx` sin explicar.
- [ ] La plantilla aparece en `GET /master/templates2/versions` (o en el catálogo del editor) con el
      `slug`/`version` esperados.
- [ ] Si es una versión nueva de una plantilla ya publicada (no la primera): el bump de versión es
      **mayor** si cambiaste o quitaste algo estructural (secciones, bloques, roles) — un `MigrationPlan`
      no salva un bump menor o de parche con diff estructural no vacío (`TemplateRegistrar.kt:196-203`,
      ADR-028).

## Antes de mover el directorio a `frontend/templates/`
- [ ] El directorio final es exactamente `frontend/templates/<slug>/<version>/` (nunca dentro de él
      ninguna carpeta `capturas/` ni ningún archivo fuera del árbol de `01 §2.1`).
- [ ] Tras mover el directorio, `pnpm plantilla check frontend/templates/<slug>/<version>` sigue en
      `0 error(es)` desde su ubicación final (las rutas relativas de assets no dependen de dónde
      estaba antes).
