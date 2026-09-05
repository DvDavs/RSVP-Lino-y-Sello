# 3c-rev-3 · Revisión de coherencia de los 82 iconos (mitades A y B)
Árbol principal, rama `claude/fase-3c-identidad-visual-wqg0d2` (bloque 1 en `84b7747`). Sin commit.
Veredicto: **ACEPTAR con 14 correcciones aplicadas** (13 SVG + 1 línea de `scripts/generar.ts`).

## Comprobaciones mecánicas (0 diferencias)
- 82 ficheros en `svg/`; `diff` de nombres contra `11 §4.2` → idéntico, y lo mismo contra `inventario.json` (82) e `iconNames` de `src/index.ts` (82). `src/generated/` = 82 componentes.
- Raíz de los 82: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`, `linecap`/`linejoin` `round`; sin `width/height`, `style`, hex ni `fill-opacity`. Ningún hijo con otro `stroke-width`.
- Tinta medida en Chromium (SVG a 192 px sobre lienzo, ponderada por alfa y luminancia; `scratchpad/rev3/tinta.mjs`). **Antes**: A duo n=28 tinta 28,87 % · trazo 20,20 % · 18,75×17,75; B duo n=41 con `pie`, `comunion`, `cargando`, `confirmar`, `rechazar` fuera de banda. **Después**: A 28,87/20,20/18,75×17,75 vs **B 28,42/19,79/18,25×18,13**; desvío mediano |cx−12| 0,06 (A) vs 0,11 (B). Ningún icono pisa el margen de 1,5.

## Iconos corregidos (redibujados a mano, sin librerías)
1. `rsvp-confirmado` (A) — venía en un `<g scale(0.205)>` con `vector-effect="non-scaling-stroke"`: el trazo NO escalaba (a 48 px, la mitad de grosor que el resto; trazo medido 6,6 % frente a ~20 % del conjunto), contra `11 §4.1`. Transformación horneada en el `d` (factor 0,19 para que 1,75 quepa en el margen) y `<g>`+`vector-effect` fuera. Trazo 6,6 → 23,4 %. Deja de ser copia byte a byte del moodboard (anotado en `svg/ORIGEN.md`).
2. `pie` (B) — el recibo ocupaba solo la mitad superior (caja y 2,1–16,3; centro de tinta y=9,0). Redibujado a y 2,1–21,4, centro 11,5.
3. `comunion` (B) — 10,75 de ancho frente a 18,75 de mediana y la cruz inscrita se empastaba dentro de la hostia. Cáliz nuevo de 16,75 de ancho, hostia limpia.
4. `bautizo` (B) — festones colgantes ajenos a la gramática del sistema (se leía como medusa, se empastaban a 16 px). Concha de vieira con nervios.
5. `cargando` (B) — el punto de cabeza era la única pieza en `var(--tono)` **sin contorno** (`stroke="none"`), contra «contorno en `currentColor` + relleno suave».
6. `confirmar` y `rechazar` (B) — el segundo tono estaba en el puño (pieza accesoria) y la mano quedaba vacía. Relleno movido a la mano: tinta 20,5 → 28,3, ya en la mediana.
7. `entrar` (B) — la flecha salía de la puerta, misma lectura que `salir`. Invertida.
8. `nota` (B) — 0,75 a la izquierda (caja 4–18,5). Recentrada.
9. `aviso` (B) — 0,5 a la derecha y rozando el margen (2,74/22,26). Triángulo simétrico reescrito en coordenadas absolutas, como el resto del conjunto.
10. `ninos` (B) — cuadrado redondeado con estrella: quinta silueta igual a `pago`/`qr`/`corporativo`/`imagen-pendiente` y se leía «destacado». Globo con nudo y cuerda.
11. `copiar` (B) — misma silueta que `duplicar` (A) con distinto reparto de tonos (A tapa el cuadrado delantero con `--ui-surface-raised`, B lo dejaba transparente). Portapapeles.
12. `correo` (B) — indistinguible de `invitacion` (idéntico salvo el círculo del sello, invisible a 16 px). Sobre abierto con cumbrera y pliegue en V.
13. `scripts/generar.ts` — el componente emitía `{ ...style, "--tono": … }` y anulaba el `style` del consumidor; ADR-3C-3-01 fija el orden contrario para el «un color por categoría» de `11 §4.1`. Corregido a `{ "--tono": …, ...style }` y regenerados los 82 componentes.

## Salida literal de las compuertas
- `pnpm --filter @invitaciones/icons run test` → **Test Files 2 passed (2) · Tests 179 passed (179)** (incluye «lo generado coincide con lo commiteado» para los 82).
- `pnpm --filter @invitaciones/icons run lint` → sin hallazgos. `pnpm --filter web run typecheck` → sin errores. `pnpm --filter web run build` → 16 rutas, `/design/iconos` estática (el único aviso, `instrumentation.ts:35` `process.exit` en Edge, es previo y ajeno).
- Capturas a 1440 de `/design/iconos` (puerto 3122, servidor cerrado al terminar): `evidencia/fase-3c/bloque-1/iconos-revision-{antes,despues}.png` (12 389 px de alto, 1 312 SVG en página).

## No hecho / riesgos
- No toqué `packages/ui/src/{fonts,styles}` ni `design/tipografia` (otro revisor en paralelo).
- Radios de esquina sin regla: en rectángulos de 17–18 de ancho conviven 1,5/2/2,5/3/4 **dentro de la mitad A** (`escritorio`, `portada`, `galeria`, `vista-previa`); B se mueve en 2–3, dentro de ese rango. No es divergencia entre mitades: falta la regla en `11 §4.1`.
- La mitad B repite el par «path de relleno + path de trazo idénticos» donde bastaría un elemento (`fill="var(--tono)"` conserva el trazo heredado). Solo pesa en bytes; no lo toqué.
- `ninos` (globo) comparte familia de «cabeza redonda» con `buscar` y `lugar`; verificado a 16/24/32 que se distinguen, pero es el cambio más opinable de los 13.
