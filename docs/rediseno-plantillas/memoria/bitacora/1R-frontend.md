# Bitácora — 1R-frontend (ronda 1R, revisión independiente del bloque 04)

Fecha: 2026-09-03 · Rama: `claude/agent-network-invitation-41nx5y` · Sin commits (por brief).

## 1. Qué hice

1. Leí la memoria completa que indicaba el brief: `brief-comun.md`, `00-INDICE.md`, `contratos.md` (§1, §2, §4, §6, §7), `glosario.md`, `decisiones.md` (ADR-001…034, con atención a 017, 018, 019, 031 y de contexto 001-007, 013, 014), `handoffs/{1-aura-lecciones, 1-frontend, 0-inventario}.md`.
2. Leí como fuente (solo lectura) `diseno/01-dominio-y-esquema.md` (§2.6, §5), `diseno/03-api.md` completo, `diseno/06-pruebas-y-calidad.md` completo, `diseno/esquema/{common,blocks,manifest,document,operations,composed}.ts`, `diseno/ejemplos/boda-clasica-1.0.0/theme.json`.
3. Leí `docs/analisis-plantillas/investigacion-editor-y-tecnologias.md` §2.4/§3/§4, el anexo `aura-build-analisis-frontend-2026-09-03.md` (tabla de stack, §1, §3, §4) y el prompt maestro §3 (P1-P10), §7 y §8.
4. Ataqué adversarialmente `diseno/04-frontend-y-editor.md` (103 líneas) y lo reescribí en sitio hasta **1638 líneas** con 23 secciones, incluida la sección final obligatoria "Revisión independiente (1R-frontend)" con 25 objeciones (9 altas, 15 medias, 1 elevada de baja a media) y la tabla de versiones npm.
5. Verifiqué 36 paquetes npm contra `registry.npmjs.org` y comprobé rangos de `peerDependencies` para resolver el encargo pendiente sobre TypeScript 7.x.
6. Escribí 9 ADR propuestas (`ADR-1R-F-01…09`) y las añadí a `memoria/decisiones.md` con **un solo `cat tmp >> …`** (append atómico, había otros agentes escribiendo en paralelo). Igual con las 10 preguntas nuevas en `preguntas-abiertas.md`.

## 2. Salidas reales de `npm view` (2026-09-03, npm 10.9.7 / Node 22)

```
next|16.3.4                react|19.2.8               react-dom|19.2.8
typescript|7.0.2           zod|4.5.4                  zustand|5.0.15
immer|11.1.18              react-hook-form|7.87.0     @hookform/resolvers|5.9.1
@dnd-kit/core|6.3.1        @dnd-kit/sortable|10.0.0   @dnd-kit/accessibility|3.1.1
tailwindcss|4.3.3          @playwright/test|1.62.1    vitest|5.0.0
@vitejs/plugin-react|6.1.1 @testing-library/react|16.3.3  @testing-library/user-event|14.6.7
jsdom|30.0.1               @tiptap/react|3.31.2       turbo|2.10.12
react-image-crop|11.1.2    react-easy-crop|6.2.3      cropperjs|2.2.0
react-cropper|2.3.3        @axe-core/playwright|4.13.0  axe-core|4.13.0
jest-axe|11.0.0            next-themes|0.4.6          @next/bundle-analyzer|16.3.4
lighthouse|13.4.1          @lhci/cli|0.15.1           size-limit|13.0.3
ulid|3.0.2                 nanoid|6.0.1
```

Compatibilidades comprobadas (lo decisivo de esta ronda):
```
$ npm view next@16.3.4 peerDependencies
{ sass:'^1.3.0', react:'^18.2.0 || 19.0.0-rc-… || ^19.0.0', 'react-dom':'…',
  '@playwright/test':'^1.51.1', '@opentelemetry/api':'^1.1.0', 'babel-plugin-react-compiler':'*' }
   → next NO declara ningún rango de `typescript`.

$ npm view vitest@5.0.0 peerDependencies
{ vite:'^6.4.0 || ^7.0.0 || ^8.0.0', jsdom:'*', '@types/node':'^22.0.0 || >=24.0.0', … }
   → vitest tampoco declara `typescript`.  (vite último: 8.2.2 → dentro del rango)

$ npm view typescript dist-tags
{ latest:'7.0.2', rc:'7.0.1-rc', beta:'6.0.0-beta', next:'7.1.0-dev.20260903.1' }
$ npm view typescript time  → 5.9.3 (2025-09-30) · 6.0.2 (2026-03-23) · 6.0.3 (2026-04-16)
                              7.0.1-rc (2026-06-18) · 7.0.2 (2026-07-08)
   estables 5.x finales: 5.7.3, 5.8.2, 5.8.3, 5.9.2, 5.9.3 ; 6.x: 6.0.2, 6.0.3 ; 7.x: 7.0.2

$ npm view typescript-eslint version peerDependencies
version = '8.69.0'
peerDependencies = { eslint:'^8.57.0 || ^9.0.0 || ^10.0.0', typescript:'>=4.8.4 <6.1.0' }
   (idéntico en @typescript-eslint/parser@8.69.0)
   → CONCLUSIÓN: el obstáculo de TypeScript 7.x NO es Next ni Vitest, es la cadena de lint con
     información de tipos, que ADR-005 + 06 §5 hacen obligatoria. Se fija typescript 5.9.3.
     ADR-1R-F-01, evidencia en 04 §21.1.

Licencias y tamaños (elección de biblioteca de recorte):
$ npm view react-image-crop → 11.1.2 · ISC · unpackedSize 115 367 · dependencies: (ninguna)
                              peerDependencies { react: '>=16.13.1' }  → compatible con React 19
$ npm view react-easy-crop  → 6.2.3 · MIT · 281 101 · { normalize-wheel: '^1.0.1' }
$ npm view cropperjs        → 2.2.0 · MIT
$ npm view lucide-react     → 1.40.0 · ISC · unpackedSize 31 826 181 (importar icono a icono)
```

## 3. Objeciones de severidad alta encontradas (detalle en `04 §23.1`)

| Id | Qué estaba mal | Por qué es alta |
|---|---|---|
| O-01 | `event.origin === window.location.origin` para validar mensajes de un iframe de **origen opaco** | Los mensajes del lienzo llegan con `origin === "null"`: la comprobación los descarta todos y el editor no funciona |
| O-05 | Sin reenvío de atajos desde el lienzo | Ctrl+Z deja de funcionar en cuanto el cliente hace clic en la vista previa |
| O-08 | «la inversa de `setBlock` es `setBlock` con el valor previo» | Sobre un bloque en `provenance: default`, deshacer **promueve contenido de demostración a contenido de usuario** y desactiva el bloqueo de publicación de `03 §6` — reabre H-03 desde el editor |
| O-11 | El `idMap` (`tmp:`→ULID) de `03 §3.3` no aparecía en `04` | Undo, cola y selección quedan apuntando a ids que el servidor ya no reconoce |
| O-13 | El `409 TPL_REVISION_CONFLICT` no se trataba en ningún punto | Sin política ni interfaz: fase 3 improvisaría un rebase silencioso con pérdida de escrituras |
| O-14 | Reordenar solo por arrastre | Incumple **WCAG 2.2 AA 2.5.7 Dragging Movements**, exigido por el brief |
| O-15 | Sin `noindex` en `/i/[publicToken]` | Una invitación indexada expone nombre, dirección y fecha del evento de un cliente |
| O-16 | Las tipografías no se trataban | Único recurso del lienzo que depende del origen: sin CORS la vista previa pinta con la fuente de reserva y **miente** sobre lo que verá el invitado |
| O-17 | CSP del lienzo sin especificar | `'self'` no coincide con nada en un origen opaco: una CSP escrita del modo habitual bloquea los propios scripts del lienzo |

## 4. Veredicto sobre el iframe sin `allow-same-origin` (ADR-031)

**Practicable, no impracticable** — pero solo bajo cinco condiciones que el diseño no enunciaba. El razonamiento completo está en `04 §8`. Resumen: nada de lo que el lienzo necesita depende de su origen (no persiste, no autentica, no llama a la API, no navega, no envía formularios), y el único recurso que sí depende —las fuentes— se resuelve con una cabecera CORS. Click-to-select, scroll-sync y medición funcionan porque el JS corre *dentro* del iframe; la captura de miniatura **no** es posible y se sustituye por `previewImage` del manifiesto y por `opengraph-image` del servidor. Como el juicio se apoya en la especificación (marcado `[I]`, sin ejecución en esta sesión), ADR-1R-F-02 convierte el juicio en una **compuerta medible** (A1-A8) al inicio de fase 3, con contingencia preaprobada (origen dedicado `lienzo.<dominio>` con `allow-scripts allow-same-origin`, que **no** reabre S-03 porque el origen difiere del embebedor). Shadow DOM se descarta razonadamente.

## 5. Qué no pude determinar / no hice

- **No ejecuté nada del navegador**: no hay `frontend/` (fase 1 es diseño y el brief prohíbe crearlo), así que todas las afirmaciones sobre origen opaco, CORS de fuentes, CSP `'self'` y `next/font` están marcadas `[I]` y quedan sujetas a la compuerta A1-A8.
- No verifiqué el comportamiento real de `z.toJSONSchema` (ya lo hizo 1-dominio; no lo repetí por economía y porque no es de mi bloque).
- No pude comprobar si existe una ruta de catálogo público de plantillas: `03 §2` no la lista (H-F-01).
- No toqué `esquema/**`, ni ningún otro `diseno/*.md`, ni `contratos.md`, ni `tablero.md`, ni `00-INDICE.md`, ni código del repositorio, ni creé `frontend/`.

## 6. Riesgos que dejo señalados

1. **La compuerta de aislamiento puede fallar** (A2/A4). Está mitigada con contingencia preaprobada, pero implica un coste de infraestructura (DNS + certificado) que nadie ha confirmado.
2. **ADR-1R-F-06 (invariante de contraste `I-24`) depende del bloque 01**, que es de solo lectura para mí. Si no se acepta, una plantilla registrada en producción puede incumplir AA sin compuerta mecánica.
3. **El catálogo de `Operation` tiene un hueco** (`clearItemBlock`): hay una entrada de undo no expresable. Es menor pero real, y lo correcto es que lo dirima el bloque 01, no yo.
4. **Dirección de dependencia nueva** backend → frontend (webhook de revalidación). Si la infraestructura no lo permite, la alternativa es aceptar hasta 300 s de desactualización en el peor momento (justo al compartir el enlace).
5. **El presupuesto de JS de 150 KB gz es exigente** con React 19 + App Router. La medición (`check-budget.mjs`) lo hará evidente pronto; el documento fija el orden de actuación para no improvisar, y exige ADR para subir el límite.
6. Las 25 objeciones se corrigieron **en el propio documento**; ninguna quedó abierta. Las que dependen de otros bloques (contraste, catálogo de plantillas, `clearItemBlock`, retirada de release, recorte no destructivo) están elevadas como contradicciones o preguntas, no resueltas unilateralmente.
