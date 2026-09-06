# Imágenes pendientes del producto

Registro vivo de las fotografías que el producto NECESITA y todavía no existen. Nace en la fase 3-C,
bloque 3 (3C-5, web pública y acceso) a partir de `diseno/11-sistema-de-diseno.md §9`.

**Cómo funciona.** Mientras una imagen esté en esta tabla, su hueco se pinta con el **placeholder del
sistema** (`11 §3.3`): degradado de dos tonos `-soft`, icono de galería centrado y, en el HTML, un
`data-imagen-pendiente="<id>"` que permite encontrar todas las piezas pendientes con un solo `grep`
o un `querySelectorAll`. Nunca una caja gris, nunca una foto de banco, nunca texto sobre la foto.

```
# qué piezas están pintando hoy un placeholder, y con qué id
grep -rho 'imageId="[^"]*"' frontend/apps/web | sort -u
```

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
| `landing-hero` | `/` héroe (`components/sitio/Hero.tsx`), sobre `Rays` | `seal` · 1:1 | 1600 × 1600 | pareja de treintañeros riendo con confeti de papel picado al fondo, jardín al atardecer | «Fotografía editorial, pareja mexicana joven riendo al aire libre en una boda en un jardín de hacienda al atardecer, confeti de papel picado de colores en el aire, luz dorada natural, lente 50 mm f/2, fondo desenfocado, sin texto» |

## Pendientes de que exista la pantalla que las usa

Estas piezas están especificadas pero todavía no tienen sitio en el producto: la portada de la fase
3-C usa **iconos** para los tipos de evento (no fotos) y **avatares con iniciales** para los
testimonios, que es su estado diseñado y no un hueco. Se mantienen aquí para que quien construya el
catálogo de plantillas, la ficha de tipo de evento o los testimonios reales no tenga que volver a
inventarlas.

| id | uso previsto | proporción | tamaño | descripción | prompt sugerido |
|---|---|---|---|---|---|
| `evento-boda` | ficha o banda del tipo de evento | 4:3 | 1200 × 900 | detalle de manos con anillos sobre mantel de lino | «Primer plano de manos entrelazadas con anillos sobre mantel de lino crudo, flores de bugambilia desenfocadas, luz de ventana, fotografía de boda editorial» |
| `evento-xv` | ídem | 4:3 | 1200 × 900 | quinceañera con vestido de color intenso bailando con su padre | «Quinceañera bailando el vals con su padre en un salón con luces cálidas, vestido color mango, movimiento, sonrisa, fotografía documental» |
| `evento-bautizo` | ídem | 4:3 | 1200 × 900 | bebé en brazos con vela y padrinos | «Bautizo en una capilla luminosa, bebé de blanco en brazos, vela encendida, padrinos desenfocados, tonos hueso y añil suave» |
| `evento-comunion` | ídem | 4:3 | 1200 × 900 | niña con vestido blanco y ramo pequeño, exterior | «Niña de primera comunión con ramo pequeño en el atrio de una iglesia de cantera, mañana soleada, fotografía natural» |
| `evento-cumpleanos` | ídem | 4:3 | 1200 × 900 | mesa de pastel con velas, niños y adultos soplando | «Cumpleaños en un patio mexicano, pastel con velas, niños y abuelos alrededor, guirnaldas de papel, luz cálida de noche» |
| `evento-graduacion` | ídem | 4:3 | 1200 × 900 | graduada lanzando el birrete con amigas | «Graduada mexicana lanzando el birrete al aire con amigas, campus con jacarandas, día claro, fotografía de celebración» |
| `evento-corporativo` | ídem | 4:3 | 1200 × 900 | brindis en una cena de empresa en terraza | «Brindis en una cena corporativa en una terraza urbana de noche, luces cálidas, copas, personas de negocios relajadas, sin logotipos» |
| `testimonio-1` · `testimonio-2` · `testimonio-3` | retrato del avatar de los testimonios de `/`, cuando haya clientas reales que hayan dado permiso | 1:1 | 400 × 400 | retratos de clientas reales, fondo neutro cálido | «Retrato de mujer mexicana de 32 años sonriendo, fondo hueso, luz suave de estudio, mirada a cámara, fotografía de perfil» |
| `paso-1` · `paso-2` · `paso-3` | «Cómo funciona» de `/`, si algún día se ilustra con fotos en vez de con números | `blob` · 4:5 | 1000 × 1250 | pantalla del teléfono con el editor y manos escribiendo; el enlace compartido en WhatsApp; invitados confirmando | «Manos sosteniendo un teléfono con una invitación digital colorida en pantalla, mesa de madera con flores, luz natural, sin texto legible» |
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
