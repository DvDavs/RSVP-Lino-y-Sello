# Origen de los SVG (mitad B, nombres 42-82 del inventario `11 §4.2`)

Ninguno de los 41 iconos de esta mitad parte de Lucide, Phosphor ni de ninguna biblioteca externa:
todos son dibujo original a la retícula 24×24 del sistema (`11 §4.1`, ADR-3C-0-04).

## Copiados sin retocar del moodboard

Los 10 iconos siguientes ya estaban dibujados en
`docs/rediseno-plantillas/evidencia/fase-3c/moodboard/partes/05-iconos.html`
(`.icono .pareja svg`, mismo repositorio, fase 3-C bloque 0) y se copiaron literalmente a
`svg/<nombre>.svg` — mismo `viewBox`, mismo trazo, mismo `d`, sin cambios:

`vestimenta`, `lugar`, `chispa`, `compartir`, `enlace`, `boda`, `xv-anos`, `cumpleanos`,
`graduacion`, `invitacion`.

Dos de ellos (`lugar`, `invitacion`) llevan un `<circle fill="var(--ui-surface-raised)">` heredado
del original: no es un color suelto sino el token de superficie, usado a propósito para simular un
"agujero" que muestra el fondo de la tarjeta (pin de mapa / sello de cera). Se conserva tal cual
por ser copia literal.

## Dibujo original de este agente (31)

`historia`, `pie`, `reloj`, `exito`, `aviso`, `error`, `info`, `cargando`, `candado`,
`imagen-pendiente`, `confirmar`, `rechazar`, `invitados`, `mesa`, `nota`, `alergia`, `ninos`,
`copiar`, `chat`, `descargar`, `qr`, `correo`, `telefono`, `cuenta`, `plan`, `pago`, `salir`,
`entrar`, `bautizo`, `comunion`, `corporativo`.

Convención: retícula 24×24, margen 1,5; trazo 1,75 `currentColor` con esquinas y terminaciones
redondeadas; relleno de la pieza principal en `fill="var(--tono)"` (segundo token, nunca
`fill-opacity`); acentos puntuales en `fill="currentColor" stroke="none"`. Reutilizan motivos ya
establecidos por los iconos copiados cuando hay relación semántica (p. ej. `imagen-pendiente`
retoma la montaña + sol de `galeria`, en trazo discontinuo, para leerse como "pendiente" y no como
una fotografía llena).

## Ilustraciones de estados vacíos (`svg/ilustraciones/`)

`sin-invitaciones.svg` reproduce el modelo «Todavía no tienes invitaciones» del mismo
`05-iconos.html`, con el marcador `{{SELLO:12:5}}` resuelto a coordenadas reales
(`moodboard/construir.mjs#sello(12, 5, R=44, cx=50, cy=50)`, 240 pasos) porque el generador de la
plantilla del moodboard no corre fuera de esa página. `sin-fotos.svg` y `error-generico.svg` son
composiciones nuevas con la misma gramática (mismo sello de fondo, misma tarjeta de 84×68, misma
sombra desplazada 7/7, mismo acento `chispa` en la esquina) descrita en `11 §4.3`.
