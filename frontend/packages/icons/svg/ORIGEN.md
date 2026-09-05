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
