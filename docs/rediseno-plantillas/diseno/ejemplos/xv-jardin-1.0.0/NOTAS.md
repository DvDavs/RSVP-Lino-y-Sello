# Notas del golden file `xv-jardin-1.0.0`

Los `.json` de esta carpeta son **golden files**: no llevan claves de comentario (`_comentario`),
porque todo esquema del paquete es `z.strictObject` y una clave desconocida los invalidaría
(verificado en la ronda 1R: `additionalProperties: false` en el JSON Schema emitido).
Las explicaciones que antes vivían dentro del JSON están aquí.

## `documento.json`

Documento sobre xv-jardin@1.0.0. Ilustra R5 (family no está en structure -> se añade con sus valores por defecto del manifiesto, ya que no es required=true tampoco es forzada visible=false: toma defaultVisible=true) y R2 (family.godparents queda vacío -> ese grupo se compone con items:[] y provenance=user, no default, porque el usuario SÍ escribió una lista vacía a propósito distinta del [] de defaults.json).

