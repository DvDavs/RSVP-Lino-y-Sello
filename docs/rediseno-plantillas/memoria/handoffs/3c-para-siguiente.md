# 3-C → siguiente fase · lo que hay que saber para empezar

## 0. Qué es la fase 3-C y qué NO es
Sistema de diseño e identidad visual del PRODUCTO (web pública, acceso, asistente de creación, chrome del
editor, publicación) sobre tres paquetes nuevos. **No toca** las plantillas de invitación (`packages/sections`,
tokens `--inv-*`): esas siguen con su propia dirección de arte y las diseñará otro modelo. Rama
`claude/fase-3c-identidad-visual-wqg0d2`, creada desde `claude/fase-3b-cierre-orquestacion-z0pd4g` (`62e3c84`).

## 1. Comando único para levantar todo (igual que en 3-B, con dos avisos nuevos)
```bash
scripts/dev-backend.sh start && scripts/seed-demo.sh          # backend :6003 + Postgres efímero + siembra
cd frontend && pnpm install --frozen-lockfile
NEXT_PUBLIC_E2E_HOOKS=1 pnpm run build && PORT=3000 pnpm --filter web run start
```
- `pnpm run build` (turbo) construye antes `packages/ui`, cuyo `build` copia los `.woff2` a `apps/web/public/fonts/`
  (ignorados por git). Sin ese paso todo el chrome cae a la fuente de reserva y las 279 capturas de la galería fallan.
- `NEXT_PUBLIC_E2E_HOOKS` se hornea en el build: los e2e del editor exigen que construya el `webServer` de
  Playwright; con un `next start` a mano fallan 11 specs (`window.__editorStore`).
- Nunca `./gradlew clean` con la demostración viva (borra el almacén de assets). `pkill -f "next start"` mata el
  propio shell: matar por PID o `fuser -k <puerto>/tcp`.

## 2. El sistema, en una pantalla
| Paquete | Entradas | Qué trae |
|---|---|---|
| `@invitaciones/tokens` | `.`, `/tokens.css`, `/tailwind.css` | paleta Bugambilia (Talavera como datos), 46 roles claro/oscuro por `data-theme`, escala tipográfica, espacio, radios, sombras, movimiento; `verify-contrast` (252 filas, 0 fallos) rompe el build |
| `@invitaciones/ui` | `.`, `/shapes`, `/historias`, `/estilos.css`, `/fonts/fonts.css`, `/componentes/componentes.css` | 25 componentes sobre Radix con aspecto propio, 14 formas deterministas, 3 ilustraciones, fuentes Fraunces + Onest + Red Hat Mono autoalojadas (177 KB) con metric override, registro de historias (solo cliente) y `metadatos` (servidor) |
| `@invitaciones/icons` | `.` | 82 iconos `Icono<Nombre>` en retícula 24, dos tonos por `--tono`, generados desde `svg/` con `scripts/generar.ts` |
Galería viva `/design` (`app/(chrome)/design/**`): tokens, tipografía, iconos, formas y 26 historias de componentes;
regresión visual + contraste sobre la pila renderizada + axe + objetivos en `playwright.design.config.ts` (279 pruebas,
sin backend). Guía de 15 minutos: `guias/identidad-visual.md`. Contrato: `contratos.md §13`.

## 3. Pantallas del producto (todas sobre el sistema)
`/` portada (antes 404) · `/acceso` entrar, crear cuenta en tres pasos, recuperar (respuesta genérica de N-01) ·
`/ayuda` · 404 raíz (Server Component sin JS de cliente: es límite de todas las rutas y pesaba en `/i`) y 404 rica
del chrome · `/editor` asistente de cuatro pasos con estado en la URL y catálogo filtrado por `eventKind` (cierra
UX-N-02) · `/editor/[id]` chrome completo (barra, secciones, bloque con 14 campos, presets del paquete de plantilla,
fotos, publicar y compartir, conflicto, móvil sin desborde). Textos en `lib/i18n.ts` (`sitio.*`, `acceso.*`,
`asistente.*`, `editor.*`); el emoji de `publicar.yaSeVe` desapareció.

## 4. Cifras finales medidas (3C-8, sobre la rama integrada)
e2e **79/79** contra backend real sobre el HEAD final (`0f68f4d`; antes 70/70 en 3C-8) · galería **279/279** · `smoke.sh` **19/19** · `a11y-producto` 0 violaciones ·
suite del monorepo 10/10 (schema 527 · sections 653 · tokens 55 · icons 179 · ui 654 · web 567) · presupuestos
`/i/[token]` **142,0 KB gz** · `/` **148,2 KB** · editor **419 KB** (límite 600) · LCP N=9 `/i` mediana
**1 998 ms** (1 975–2 014) · `/` **1 762 ms** (1 724–1 814) · greps emoji / `lucide-react` / shadcn antiguo **0/0/0**.
Capturas finales de las 18 pantallas en tres viewports: `evidencia/fase-3c/cierre/final/` (51). Cierre: visual CUMPLE tras 4 altas corregidas (`3c-cv.md`) · adversarial CERRABLE tras A-01/A-02 (`3c-adv.md`; e2e 71/71, 2 585 pruebas) · UX: NO al llegar (6 graves) y corregido por UX-A/B/C con e2e 8/8, 11/11 y 14/14 (`3c-ux.md`).

## 5. Deuda y decisiones que quedan para el dueño
- Capa de compatibilidad de `globals.css` (nombres viejos del chrome de la fase 3): la galería y `design/galeria.module.css`
  aún la usan; retirarla cuando el último consumidor migre (`handoffs/3c-5-parcial.md`).
- Vendor compartido (`tailwind-merge` + `react-slot`) que Turbopack atribuye a todas las rutas: la ruta pública
  quedó en 142 KB tras sacar el 404 raíz; margen de la portada 1,8 KB (`preguntas-abiertas.md § 3C-8`).
- `Toast` y `Tooltip` sin vitrina de estado visible en la galería; bandera para sacar `/design` de producción;
  tema oscuro solo por ajuste (sin `prefers-color-scheme`); nombre de marca y logotipo; imágenes reales
  (`imagenes-pendientes.md`, 11 entradas con prompt); bloqueo de cuenta como denegación de servicio (auth, fuera de alcance).
- Regla de trabajo nueva (instrucción del dueño): contexto por agente ≤ 300k, handoff parcial y relevo (`CLAUDE.md`, `brief-comun.md`).

## 6. Qué leer, y en qué orden
`contratos.md §13` → `guias/identidad-visual.md` → `handoffs/3c-0.md` y `diseno/11-sistema-de-diseno.md` →
`handoffs/3c-8.md` → `handoffs/3c-cv.md`, `3c-ux.md`, `3c-adv.md` → `preguntas-abiertas.md` (secciones «Fase 3-C»).
Los handoffs por bloque (`3c-1`, `3c-2`, `3c-3a`, `3c-4`, `3c-b2-f1/f2/f3`, `3c-5-parcial`, `3c-6-parcial`, `3c-7-parcial`)
solo si vas a tocar ese código.
