# Origen de los SVG (ADR-3C-3-01, brief 3C-3 · Reparto §1)

Ninguno de los SVG de este directorio parte de Lucide, Phosphor ni de ninguna otra librería de
iconos: todos son dibujos propios para este sistema (retícula 24, trazo 1,75, dos tonos vía
`var(--tono)`), redactados a mano siguiendo `diseno/11-sistema-de-diseno.md` §4.

- **5 copiados sin retocar** del moodboard de evidencia (`evidencia/fase-3c/moodboard/partes/05-iconos.html`,
  cada `.icono .pareja svg`, un único ejemplar por nombre): `deshacer.svg`, `evento-fecha.svg`,
  `galeria.svg`, `mesa-de-regalos.svg`, `rsvp-confirmado.svg`. El relleno de `rsvp-confirmado`
  (el sello festoneado) es la salida literal de `sello(10, 4.5)` de `moodboard/construir.mjs`
  (mismo PRNG/fórmula, ya resuelta en el HTML publicado): no se recalculó, se copió el `d` ya
  emitido para no introducir un redondeo distinto al de la evidencia.
- **36 dibujados para esta tarea** (resto de la mitad A: navegación, edición y las 6 secciones de
  invitación que caen en los primeros 41 nombres del inventario): geometría propia en la misma
  retícula, mismo trazo y misma convención de dos tonos que los 5 anteriores.

Convención de capas usada en los 36 nuevos (visible también en los 5 copiados): el `<svg>` raíz fija
`fill="none" stroke="currentColor"`, así que por defecto cualquier hijo es solo trazo. Para dar el
segundo tono a la pieza principal basta con poner `fill="var(--tono)"` en ESE elemento (conserva el
trazo heredado); para un detalle sólido sin aro (un punto, una chispa) se añade `stroke="none"`
además; para un «troquelado» de papel (el centro de un pin, una carta boca abajo) se usa
`fill="var(--ui-surface-raised)"`. Ningún elemento lleva un hex ni `fill-opacity` (ADR-3C-0-04: el
segundo tono es un token, no una opacidad sobre `currentColor`).

Mitad B añade aquí sus propios SVG y, si alguno parte de una librería de terceros, su nota de
origen correspondiente.
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

# Revisión de coherencia entre mitades (3c-rev-3, sobre la rama de fase ya integrada)

Al comparar las dos mitades en `/design/iconos` (captura a 1440 y medida de tinta por icono en
Chromium) se redibujaron 13 SVG. Detalle y cifras en `memoria/bitacora/3c-rev-3.md`.

- `rsvp-confirmado.svg` **deja de ser copia literal del moodboard**: el original venía dentro de un
  `<g transform="translate(12 12) scale(0.205) translate(-50 -50)">` con
  `vector-effect="non-scaling-stroke"`, así que el trazo NO escalaba con el icono (a 48 px se veía a
  la mitad de grosor que el resto, contra `11 §4.1`). Se horneó la transformación en las
  coordenadas del `d` (factor 0,19 en vez de 0,205 para que el trazo real de 1,75 quepa en el margen
  de 1,5) y se quitaron el `<g>` y el `vector-effect`. El dibujo del sello es el mismo; solo cambian
  la escala y el sistema de coordenadas.
- Redibujados de la mitad B por incoherencia óptica o de gramática: `pie`, `comunion`, `bautizo`,
  `cargando`, `entrar`, `confirmar`, `rechazar`, `nota`, `aviso`, `ninos`, `copiar`, `correo`.
  Ninguno de ellos estaba en la lista de copias literales del moodboard.
