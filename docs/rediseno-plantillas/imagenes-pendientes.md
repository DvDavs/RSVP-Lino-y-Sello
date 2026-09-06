# Imágenes pendientes del producto

Registro vivo de las fotografías que el producto NECESITA y todavía no existen. Nace en la fase 3-C,
bloque 3 (3C-5, web pública y acceso) a partir de `diseno/11-sistema-de-diseno.md §9`.

**Cómo funciona.** Mientras una imagen esté en esta tabla, su hueco se pinta con el **placeholder del
sistema** (`11 §3.3`): degradado de dos tonos `-soft`, icono de galería centrado y, en el HTML, un
`data-imagen-pendiente="<id>"` que permite encontrar todas las piezas pendientes con un solo `grep`
o un `querySelectorAll`. Nunca una caja gris, nunca una foto de banco, nunca texto sobre la foto.

```
# qué piezas están pintando hoy un placeholder, y con qué id (literal en el JSX)
grep -rho 'imageId="[^"]*"' frontend/apps/web | sort -u
```

Ese `grep` solo encuentra un `imageId` **literal** (`imageId="landing-hero"`). Un `imageId` que viaja
por dato (`imageId={tipo.imagenId}`, el caso del asistente: `components/asistente/tipos-de-evento.ts`)
no aparece así — hay que seguir la referencia a mano una vez, y por eso las ocho filas
`asistente/tipo-*` de abajo están anotadas explícitamente en vez de confiar solo en el `grep`.

**Estilo común de toda la lista** (`11 §9`): fotografía ultrarrealista, luz natural cálida, personas
reales en celebraciones mexicanas contemporáneas (sin folclor de cartón), saturación alta pero piel
natural, fondo con profundidad; **nunca texto dentro de la imagen**; espacio negativo suficiente para
que la máscara del sistema no corte una cara.

**Al añadir una imagen real:** se pasa `src` al componente `Image` del sistema (que ya aplica la
máscara), se comprueba que el `alt` sigue describiendo lo que se ve y se BORRA su fila de esta tabla.

---

## En uso hoy

| id | dónde se usa | máscara / proporción | tamaño | descripción | prompt sugerido |
|---|---|---|---|---|---|
| `asistente/tipo-boda` · **entregada 2026-09-06** | tarjeta de tipo de evento, paso 1 del asistente (`components/asistente/PasoTipoEvento.tsx`, `tipos-de-evento.ts`) | `radius-lg` · 4:3 | 1200 × 900 | detalle de manos con anillos sobre mantel de lino | «Primer plano de manos entrelazadas con anillos sobre mantel de lino crudo, flores de bugambilia desenfocadas, luz de ventana, fotografía de boda editorial» |
| `asistente/tipo-xv-anos` · **entregada 2026-09-06** | ídem, XV años | `radius-lg` · 4:3 | 1200 × 900 | quinceañera con vestido de color intenso bailando con su padre | «Quinceañera bailando el vals con su padre en un salón con luces cálidas, vestido color mango, movimiento, sonrisa, fotografía documental» |
| `asistente/tipo-bautizo` · **entregada 2026-09-06** | ídem, bautizo | `radius-lg` · 4:3 | 1200 × 900 | bebé en brazos con vela y padrinos | «Bautizo en una capilla luminosa, bebé de blanco en brazos, vela encendida, padrinos desenfocados, tonos hueso y añil suave» |
| `asistente/tipo-comunion` · **entregada 2026-09-06** | ídem, primera comunión | `radius-lg` · 4:3 | 1200 × 900 | niña con vestido blanco y ramo pequeño, exterior | «Niña de primera comunión con ramo pequeño en el atrio de una iglesia de cantera, mañana soleada, fotografía natural» |
| `asistente/tipo-confirmacion` | ídem, confirmación | `radius-lg` · 4:3 | 1200 × 900 | adolescente con vela encendida en un templo luminoso, madrina o padrino detrás | «Confirmación religiosa, adolescente mexicano sosteniendo una vela encendida en un templo con luz natural, padrino desenfocado detrás, tonos hueso y añil suave, fotografía documental» |
| `asistente/tipo-cumpleanos` | ídem, cumpleaños | `radius-lg` · 4:3 | 1200 × 900 | mesa de pastel con velas, niños y adultos soplando | «Cumpleaños en un patio mexicano, pastel con velas, niños y abuelos alrededor, guirnaldas de papel, luz cálida de noche» |
| `asistente/tipo-graduacion` | ídem, graduación | `radius-lg` · 4:3 | 1200 × 900 | graduada lanzando el birrete con amigas | «Graduada mexicana lanzando el birrete al aire con amigas, campus con jacarandas, día claro, fotografía de celebración» |
| `asistente/tipo-otra` | ídem, «Otra celebración» (`EventKind` `generic`, sin tipo específico) | `radius-lg` · 4:3 | 1200 × 900 | mesa festiva con globos, luces cálidas y detalles de papel picado, sin motivo de evento reconocible | «Mesa de celebración mexicana genérica con globos de colores, luces cálidas tipo bombilla, banderines de papel picado, noche, sin personas identificables, fotografía festiva neutra» |

Las ocho tarjetas de tipo de evento llevan **icono + foto** (`11 §7` solo preveía icono; el paso 1
real del asistente, `3C-6`, añadió también el placeholder de fotografía en máscara `radius-lg` sobre
cada tarjeta): el icono identifica el tipo sin ambigüedad y la foto le da calidez. Los ids usan el
prefijo `asistente/tipo-*`, no `evento-*` (nomenclatura fijada por `components/asistente/tipos-de-evento.ts`).
`corporativo` no es uno de los ocho `EventKind` del asistente (supuesto de `3C-6`,
`preguntas-abiertas.md § Fase 3-C · 3C-6`): su fila queda abajo, pendiente de pantalla.

## Pendientes de que exista la pantalla que las usa

Estas piezas están especificadas pero todavía no tienen sitio en el producto: **avatares con
iniciales** para los testimonios de la portada es su estado diseñado y no un hueco. Se mantienen aquí
para que quien construya el catálogo de plantillas, una ficha de tipo de evento aparte de la tarjeta
del asistente, o los testimonios reales, no tenga que volver a inventarlas.

| id | uso previsto | proporción | tamaño | descripción | prompt sugerido |
|---|---|---|---|---|---|
| `evento-corporativo` | ficha o banda de tipo de evento, si el catálogo llega a distinguir «corporativo» de `generic` | 4:3 | 1200 × 900 | brindis en una cena de empresa en terraza | «Brindis en una cena corporativa en una terraza urbana de noche, luces cálidas, copas, personas de negocios relajadas, sin logotipos» |
| `testimonio-1` · `testimonio-2` · `testimonio-3` | retrato del avatar de los testimonios de `/`, cuando haya clientas reales que hayan dado permiso | 1:1 | 400 × 400 | retratos de clientas reales, fondo neutro cálido | «Retrato de mujer mexicana de 32 años sonriendo, fondo hueso, luz suave de estudio, mirada a cámara, fotografía de perfil» |
| `paso-1` · `paso-2` · `paso-3` | «Cómo funciona» de `/`, si algún día se ilustra con fotos en vez de con números (hoy `components/sitio/PasosComoFunciona.tsx` usa un `Seal` y el número, a propósito) | `blob` · 4:5 | 1000 × 1250 | pantalla del teléfono con el editor y manos escribiendo; el enlace compartido en WhatsApp; invitados confirmando | «Manos sosteniendo un teléfono con una invitación digital colorida en pantalla, mesa de madera con flores, luz natural, sin texto legible» |
| `ayuda-hero` | cabecera de `/ayuda` (opcional; hoy lleva rayos, no foto) | 3:2 | 1200 × 800 | persona atendiendo con auriculares, sonriendo | «Persona de soporte sonriendo con auriculares en una oficina luminosa con plantas, fondo cálido, fotografía natural» |

## Lo que NO lleva foto, por decisión

- **Estados vacíos, 404 y error**: llevan las ilustraciones del sistema (`11 §4.3`,
  `@invitaciones/ui` → `SinInvitaciones`, `SinFotos`, `ErrorGenerico`). Una fotografía en un estado
  de error es ruido: lo que hace falta ahí es una salida.
- **Chrome del editor**: sin fotografía y sin formas decorativas (`11 §3.4` R9). La protagonista es
  la invitación de la clienta.
- **Testimonios de la portada mientras sean de ejemplo**: van con avatar de iniciales y `Badge`
  «Ejemplo». Poner un retrato —real o generado— junto a un testimonio inventado sería hacerlo pasar
  por verdadero.

## Restricción del entorno

El proxy de este entorno **bloquea los bancos de imágenes y Google Fonts** (`brief-comun`, entorno).
Ninguna imagen de esta lista se puede descargar desde aquí: entran al repositorio por el dueño, ya
optimizadas (WebP/AVIF, con su versión 1x y 2x), o se generan fuera y se suben.
