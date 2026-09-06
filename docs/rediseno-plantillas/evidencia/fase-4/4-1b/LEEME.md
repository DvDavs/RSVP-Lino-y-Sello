# Evidencia del bloque 4-1B — previsualizador y capturas del kit de autor

Todo lo de aquí está generado con los comandos del kit, sin retoques.

## Las capturas que pidió el dueño

| fichero | qué es |
|---|---|
| `bautizo-elegante@1.0.0-390.png` · `-768.png` · `-1280.png` | La plantilla **convertida real** (`frontend/templates/bautizo-elegante/1.0.0`). No tiene ni un asset ni `previewImage`, así que sus 15 huecos de imagen salen con el marcador «imagen pendiente». Es el esqueleto correcto, no arte final. |
| `boda-jardin@1.0.0-390.png` · `-768.png` · `-1280.png` | Un **andamio recién creado** con `pnpm plantilla nueva boda-jardin --evento wedding`, sin tocar ni un byte después. Cinco secciones, diez bloques, `check` en verde a la primera. |

Comando exacto y salida literal: `capturas.txt`. Los PNG son de página entera y a x2 (pantalla
densa): un `-390.png` mide 780 px de ancho.

## El previsualizador

| fichero | qué es |
|---|---|
| `consola-del-previsualizador.png` | La consola de `pnpm plantilla preview` sobre `bautizo-elegante`: móvil 390 y escritorio 1280 **a la vez**, cada uno en su propio marco, con las notas de lo que se está viendo que no está en el paquete. |
| `consola-paquete-roto.png` + `preview-paquete-roto.txt` | Un paquete con sólo `template.json`: el previsualizador enseña los dos `ERROR TPL_PACKAGE_MISSING_FILE` con las tres líneas del contrato (mismo texto que la terminal), **no** una página en blanco. |

## La recarga al guardar

`recarga-al-guardar.txt` es la transcripción con salida real: se edita `cover.title` en
`defaults.json` de un andamio y el texto nuevo aparece en el navegador en **83 ms**, con
`window.__marcaDeLaDemo` todavía viva — o sea, **sin recargar la página**. `recarga-1-antes.png` y
`recarga-2-despues.png` son el mismo marco de 390 px antes y después.
