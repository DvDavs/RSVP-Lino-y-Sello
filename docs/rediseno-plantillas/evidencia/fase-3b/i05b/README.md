# I-05b — la portada, antes y después

Doce capturas de `CoverSection[data-variant="full"]` sobre la invitación publicada
`/i/pub_H1H36M2Y41J89TFYYMQKV12XHJ` (`boda-clasica@1.0.0`, paleta `blush`), Chromium 1194, DPR 1.

- `portada-{antes,despues}-{movil,tableta,escritorio}-lamina.png` — con la lámina del paquete. Es el
  par que responde a la pregunta de A1: **¿sigue viéndose la lámina?** Sí: filete completo sin un
  solo corte, cuatro florones, guirnalda superior, divisor con rombo y rama inferior. Lo que cambia
  es una zona de luz detrás del texto, sobre el panel que el ilustrador dejó vacío a propósito.
- `portada-{antes,despues}-{movil,tableta,escritorio}-negra.png` — con la fotografía de la clienta
  forzada a NEGRA, que es el peor caso real (`cover.image` es `editable` + `required`). En el
  "antes", `.dateRow` mide 1,87:1 y `.eyebrow` 4,20:1; en el "después", todo el texto cae sobre
  papel opaco y mide 4,62-12,33:1.

Medidas y método: `memoria/bitacora/3b-i05b.md` §§2-5. Decisión: `ADR-3-i05b-01`.
