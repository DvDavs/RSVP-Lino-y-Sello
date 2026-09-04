# Notas del golden file `boda-clasica-1.0.0`

Los `.json` de esta carpeta son **golden files**: no llevan claves de comentario (`_comentario`),
porque todo esquema del paquete es `z.strictObject` y una clave desconocida los invalidaría
(verificado en la ronda 1R: `additionalProperties: false` en el JSON Schema emitido).
Las explicaciones que antes vivían dentro del JSON están aquí.

## `compuesto.json`

Salida esperada de compose(pkg, documento.json, business, 'es-MX') para boda-clasica@1.0.0. BusinessSnapshot asumido: {invitationId:4821, date:'2026-12-12', time:'16:30', hashtag:'#CamilaYAntonio2026', coverPhotoUrl:null, childrenAllowed:true, youngAllowed:true, eventKind:'wedding', planTier:2, timezone:'America/Mexico_City'}. Este archivo + documento.json + template.json + defaults.json + theme.json son el primer golden file de 06-pruebas-y-calidad.md §4. Se muestran las 9 reglas: R1 (order=orden del manifiesto, story visible:false conservado), R2 (tres escalones: user/default/empty — ver rsvp.deadline y footer.music, ambos null), R3 (provenance en cada bloque), R4 (cover.date/couple.date/gallery.hashtag/rsvp.childrenAllowed = business, nunca desde content), R6 (misma fecha formateada igual en cover y couple: formatDate(2026-12-12, 'long', es-MX) = '12 de diciembre de 2026', resuelve H-27), R7 (itemId preservado en grupos), R8 (theme.olive != defaultPaletteId, sin fallback porque existe), R9 (esta salida es canónica y determinista: mismas entradas -> mismos bytes).

## `documento.json`

Documento de una invitación real (capas 2-4) sobre boda-clasica@1.0.0. Ilustra R1 (story oculta explícitamente aunque el manifiesto la trae visible por defecto), R2 (cover.subtitle NO está en content -> cae a defaults.json en la composición), R4 (cover.date/couple.date NO pueden escribirse aquí: son business), R7 (itemId estable en event.cards) y R8 (theme distinto del default de la plantilla).

