# Evidencia D3 (bloque 3-7) — LCP: las 106 corridas de Lighthouse, crudas

Todas sobre la **invitación publicada real** (`boda-clasica@1.0.0`, `invitationId=3`,
`publicToken=pub_FCTH3DCWGNP954PYK16F0XH5GV`, sembrada con `scripts/seed-demo.sh`), con
`@lhci/cli@0.15.1` + `lighthouse@12.6.1`, perfil móvil (Moto G Power, 412×823, DPR 1,75),
`next build` + `next start` de PRODUCCIÓN, **puerto propio 3007** y Chromium
`/opt/pw-browsers/chromium-1194`. Umbral de `contratos §8`: **LCP < 2 500 ms**.

El elemento LCP es el mismo en las 106: `p.CoverSection-module__heroName` — el nombre de la
portada. `Load Delay` y `Load Time` son 0 en todas (es texto, no carga ningún recurso propio);
todo el coste está en `TTFB` + `Render Delay`.

---

## 1. El estado de partida (`throttlingMethod: simulate`, el de por defecto)

### 1.1 Primera medición limpia de este bloque — reproduce a 3-6, no a 3-3

`pnpm --filter web run lhci` con la configuración heredada de 3-3 (5 corridas), en puerto propio:

```
LCP: 3216.7 · 3309.5 · 3210.4 ms   (2 corridas NO_LCP)   ->  MEDIANA 3210 ms   NO CUMPLE
```

### 1.2 Por qué las dos medidas anteriores discrepaban: la métrica es BIMODAL

15 corridas seguidas, MISMO build, MISMA URL, MISMO servidor, animación desactivada para que las
15 den valor:

```
2014.5  2014.8  2130.9  2156.7  2212.0  2217.1  2217.7  2234.6  2284.0  2317.2  2569.9
                                    ·  hueco limpio  ·
3210.7  3210.9  3230.7  3326.0
```

11 valores en 2 015-2 317 ms y 4 en 3 211-3 326 ms, **sin nada que los separe**: TTFB 456-464 ms en
todas, arranque de JS 268-350 ms, hilo principal 790-926 ms, mismo elemento LCP, trazas casi
idénticas. El escalón de ~1 000 ms lo introduce el modelo de Lantern (`simulate`), que unas veces
cuelga los cuatro `.woff2` del grafo de dependencias del texto de portada y otras no.

**Con 5 corridas la mediana cae en un modo o en el otro por azar.** Y los dos modos aparecen en las
corridas crudas de AMBOS bloques anteriores: 3-3 registró un `1215`, y 3-6 un `1560,8`.

### 1.3 El sesgo del `NO_LCP`

`cover-rise` arrancaba en `opacity: 0` y Chrome no registra como candidato a LCP un elemento
invisible, así que muchas corridas no emitían **ningún** evento y Lighthouse devolvía `NO_LCP`.
Las corridas que sí lo emitían eran sistemáticamente las rápidas, de modo que la mediana se
calculaba sobre una submuestra **sesgada a la baja**:

| Configuración | corridas válidas | mediana |
|---|---|---|
| animación activa (la de 3-3/3-6) | 1 y 4 de 5 | 1 527 y 1 909 ms *(sesgada)* |
| animación apagada, mismas 15 corridas | 15 de 15 | **2 235 ms** |

Es decir: la compuerta anterior no solo podía SUSPENDER por azar, también podía **APROBAR con un
número que no era el de la página**.

---

## 2. Las tipografías: sospechosa principal descartada como causa

`publico.css` importa 4 `.woff2` (`latin`, con `unicode-range` correcto desde 3-3): 95,5 KB.
Colgaban del CSS, que cuelga del HTML — cadena crítica de profundidad 3, `longestChain 700 ms`.

| Variante (3 corridas c/u, `simulate`) | mediana |
|---|---|
| tal cual | 3 240 ms |
| quitando los 4 `@import` de `@fontsource` | **2 020 ms** |

Parecía la causa. Pero el remedio que prescribe `04 §16.1` (**`<link rel="preload">` de la pareja
tipográfica**, que se implementó y se midió) **empeoró la métrica**, porque el preload le roba ancho
de banda al CSS que sí bloquea el render:

| Variante (15 corridas c/u, `simulate`, animación apagada) | mediana |
|---|---|
| sin preload | **2 235 ms** |
| con preload de los 4 `.woff2` | 2 789 ms |

**El preload se revirtió.** No se conserva código que empeora lo que dice arreglar.

---

## 3. La causa real, con estrangulamiento de verdad (`throttlingMethod: devtools`)

`devtools` aplica el 4G lento y la CPU ×4 **de verdad** y publica el LCP **observado**, en vez de
correr casi sin estrangular y simularlo después. Sobre el mismo build es unimodal y con ±40 ms de
dispersión — deja de haber contradicción que resolver:

| Variante (8 corridas c/u salvo la primera, 15) | valores crudos | mediana |
|---|---|---|
| animación apagada (`prefers-reduced-motion`) | 1363 · 1984 · 1991 · 1992 · 1993 · 1994 · 2000 · 2010 · 2011 · 2012 · 2023 · 2039 · 2050 · 2072 · 2147 | **2 010 ms** |
| animación activa, `cover-rise` **con** `opacity` | 3527 · 3530 · 3541 · 3557 · 3573 · 3576 · 3636 · 3640 | **3 565 ms** |
| animación activa, `cover-rise` **sin** `opacity` (la corrección) | 1950 · 1978 · 1992 · 2002 · 2004 · 2005 · 2005 · 2031 | **2 003 ms** |

Distribuciones que no se solapan. **La aparición desde `opacity: 0` costaba 1 562 ms de LCP**, el
44 % de la métrica, y era la causa entera del incumplimiento. La coincidencia entre «animación
apagada» (2 010) y «animación sin opacidad» (2 003) confirma que la opacidad era TODO el coste: el
movimiento (`translateY`) no cuesta nada, porque no oculta el texto.

---

## 4. Medición final — la compuerta tal y como queda

`pnpm --filter web run lhci`, sin banderas extra, 3 ejecuciones de 5 corridas:

```
Ejecución 1: 1679.4 · 1974.7 · 2027.1 · 2030.3 · 2061.4  ->  MEDIANA 2027 ms   CUMPLE
Ejecución 2: 2024.5 · 2045.4 · 2066.9 · 2082.5 · 2118.2  ->  MEDIANA 2067 ms   CUMPLE
Ejecución 3: 1981.8 · 2053.8 · 2061.8 · 2137.7 · 2140.9  ->  MEDIANA 2062 ms   CUMPLE

CLS mediana 0.033 (umbral 0,1)  CUMPLE   en las tres
`lhci autorun` código de salida 0        en las tres
5 de 5 corridas válidas                  en las tres  (cero NO_LCP)
```

El umbral NO se tocó: sigue siendo 2 500 ms.

---

## 5. Lo que empeora al medir de verdad, y no se oculta

`total-blocking-time` está declarado como `warn` (no `error`) en `lighthouserc.cjs`, y con
`devtools` **lo incumple**:

```
Ejecución 1: 214.8 · 408.4 · 415.3 · 409.5 · 467.4 ms
Ejecución 2: 434.6 · 443.9 · 464.3 · 513.8 · 523.0 ms
Ejecución 3: 287.8 · 425.8 · 481.3 · 523.2 · 626.1 ms
```

Objetivo de `04 §16.1`: **INP < 200 ms**. Con `simulate` este valor salía en 99-160 ms; con la CPU
estrangulada de verdad son 215-626 ms. No es una regresión de este bloque —es el mismo código
medido mejor—, pero es un dato nuevo y va a `preguntas-abiertas.md`, no a la basura.

---

## 6. Riesgo de medición corregido: el puerto

`startServerCommand` era `pnpm run start`, que sin `PORT` escucha en el 3000. Verificado en esta
sesión: **el 3000 y el 3100 estaban ocupados por los `next start` de otras dos sesiones de agente**
(`agent-ac3cc8d03be3994a3` y `agent-aeb1499c44ce1879c`, leído en `/proc/<pid>/cwd`).

Cadena completa del fallo, verificada paso a paso:

1. `PORT=3000 pnpm run start` en esta sesión → `Error: listen EADDRINUSE 0.0.0.0:3000`, y **nunca**
   imprime `Ready in`, que es el `startServerReadyPattern`.
2. `@lhci/cli@0.15.1`, `src/collect/collect.js:171-177`: si el patrón no casa, **imprime un aviso y
   SIGUE**. No aborta.
3. La URL responde 200 igualmente — servida por el proceso ajeno.

Resultado: Lighthouse mide **la aplicación de otra sesión**, otro build y otra caché, y lo llama
resultado propio. `lighthouserc.cjs` ahora toma `LHCI_PORT` y **rompe con un mensaje explícito** si
el puerto está ocupado. 3-5 y 3-6 documentaron procesos `next start` ajenos en el 3000 durante sus
propias mediciones.

---

## 7. Otra contaminación observada, no corregible desde aquí

A mitad de las mediciones el nombre de la portada de la invitación de demostración cambió de
`Paulina & Emilio` a `Teclado & Sololo`: otra sesión de agente estaba corriendo e2e contra la MISMA
fila sembrada. Es el mismo problema de aislamiento que 3-6 mitigó con `conLockDeInvitacionSembrada`
dentro de una corrida de Playwright, pero que no cubre a un proceso ajeno como LHCI. No altera las
conclusiones (el elemento LCP y su tamaño son equivalentes, y las comparaciones A/B de §3 se
hicieron todas después del cambio, sobre el mismo contenido), pero queda anotado.
