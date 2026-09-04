# W — Investigación: aura.build, editor simple y almacenamiento de plantillas

> **Convenciones de evidencia.** Fecha de todas las consultas: **2026-09-03**.
> **VERIFICADO (fuente leída)** = abrí la URL y leí el contenido citado.
> **VERIFICADO (API)** = dato obtenido de una API pública (registry.npmjs.org, api.github.com) en esta sesión.
> **SECUNDARIO** = procede de un snippet de resultados de búsqueda, no de la fuente primaria leída íntegra.
> **NO VERIFICADO** = no pude comprobarlo; lo digo explícitamente.
> **INFERIDO** = deducción mía sobre evidencia verificada.
>
> **Limitación grave y declarada de entrada:** `aura.build` y `www.aura.build` están **bloqueados por el proxy de egreso de esta sesión** (respuesta `403 connect_rejected` del proxy; `EGRESS_BLOCKED` en WebFetch). También lo están `trustpilot.com`, `designmonks.co`, `toolify.ai`, `designcode.io`, `producthunt.com`, `builder.io`, `sanity.io`, `notion.com`, `figma.com`, `wix.com`, `canva.com`, `puckeditor.com`, `web.archive.org` y prácticamente todo lo que no sea `github.com` / `raw.githubusercontent.com` / `registry.npmjs.org`. ~~**Toda la sección 2 (aura.build) es, por tanto, SECUNDARIA**~~: reconstruida a partir de snippets de búsqueda web que citan páginas oficiales de aura.build. No pude leer una sola cabecera HTTP ni una sola etiqueta `<script>` del sitio. Lo marco caso por caso y no invento nada.
>
> **ACTUALIZACIÓN 2026-09-03 (posterior, mismo día):** el dueño del proyecto aportó un análisis técnico **PRIMARIO** del frontend público de aura.build (bundle, TypeScript, dependencias reales), guardado íntegro en `anexos/aura-build-analisis-frontend-2026-09-03.md`. Esa evidencia **confirma, corrige o amplía** buena parte de esta sección 2 — el detalle fila por fila está marcado en 2.1/2.2/2.3 y la síntesis accionable está en la nueva **2.4**. La limitación de red original sigue siendo cierta (no pude abrir el sitio yo mismo) y por eso el texto tachado arriba se conserva como trazabilidad: lo que antes era 100% secundario ahora es una mezcla de PRIMARIO (vía el anexo) y SECUNDARIO/NO VERIFICADO (todo lo que el anexo no trata, p. ej. precios, cifras de biblioteca, fundador).

---

## 1. Resumen ejecutivo (≤12 líneas)

1. **aura.build es un generador de sitios por IA cuyo documento nativo es HTML + clases de Tailwind**, no un JSON de bloques propietario; su "Design Mode" edita el DOM real: panel de capas con la estructura HTML, filtros por clase de Tailwind, overlays de medidas de margin/padding/gap y aplicación de clases al breakpoint (`sm: md: lg: xl: 2xl:`) que estés viendo (SECUNDARIO).
2. Eso explica exactamente la queja del dueño: **el editor es "demasiado profesional" porque su modelo de datos es profesional**. Si el documento es DOM+CSS, el editor acaba siendo un inspector de CSS. No se arregla con UI: se arregla cambiando el modelo de datos.
3. La lección replicable no es su editor sino su **flujo**: generar algo bonito y completo de entrada, y luego permitir retoques quirúrgicos sin regenerar la página.
4. **Recomendación de modelo de datos:** documento de bloques tipado y **sin CSS dentro**, en tres capas separadas — `theme` (tokens), `structure` (orden/visibilidad de secciones y variante elegida), `content` (datos del usuario) — más una cuarta capa relacional aparte para el negocio (RSVP/invitados).
5. Eso elimina de raíz el problema medido en la auditoría: hoy una plantilla de boda premium es "un contrato de ~1000 valores de CSS almacenados en MongoDB" (E§5). En el modelo propuesto el documento del usuario no contiene ni un solo valor de CSS.
6. **Recomendación de stack:** Next.js 16 + React 19 + TypeScript + Tailwind 4 + shadcn/ui; Zustand + Immer + zundo (undo/redo); dnd-kit sólo para reordenar; **Zod 4 como única fuente de verdad del esquema**; Vercel AI SDK 7 con salida estructurada.
7. **No usar Puck / Craft.js / GrapesJS como editor del usuario final**: los tres son editores de *layout libre*, justo lo que hay que evitar. Sí **adoptar el modelo de datos de Puck** (array tipado de `{type, props}` + registro de componentes), que es exactamente la forma correcta.
8. Puck sigue siendo candidato razonable para un **estudio interno de plantillas** (equipo de diseño), no para la novia.
9. **Versionado:** plantillas como paquete inmutable con semver; documento con `schemaVersion` + cadena de migraciones puras aplicadas *lazy on read*; publicación como *release* inmutable (snapshot) que es lo único que ve el invitado.
10. **Almacenamiento:** Postgres **JSONB** para las tres capas + tablas relacionales para el negocio. Mongo sobra en este módulo; hoy es la mitad del problema de desincronización descrito en E#12.
11. **Multi-evento por composición, no por copia**: catálogo de secciones + presets por tipo de evento. Ataca directamente el `eventTypeId == 1L` cableado del generador actual.
12. **IA (fase 2):** el modelo **nunca escribe el documento**. Devuelve una lista corta de *operaciones* validadas por Zod (`setText`, `setTheme`, `reorderSections`…) que se aplican en un reducer puro, se previsualizan como diff y se pueden deshacer.

---

## 2. aura.build: producto y tecnología

### 2.1 Qué ofrece

**Advertencia (vigente para lo no cubierto por el anexo):** salvo donde se anota lo contrario, esta sección sigue basada en snippets que citan `aura.build/learn/*`, `aura.build/pricing`, reseñas y cursos — el dominio siguió bloqueado en esta sesión. Las cifras que dan las fuentes secundarias **se contradicen entre sí** y las marco como no fiables.

> **ACTUALIZACIÓN 2026-09-03:** evidencia primaria en `anexos/aura-build-analisis-frontend-2026-09-03.md`. Columna "Estado tras el anexo" añadida a la derecha.

| Aspecto | Qué dicen las fuentes | Calidad | Estado tras el anexo |
|---|---|---|---|
| Categoría | Generador de landings/sitios por IA a partir de prompt de texto o de una imagen/captura | SECUNDARIO, consistente en 6+ fuentes | **SIGUE SIN VERIFICAR** por fuente primaria — el anexo describe arquitectura técnica, no el discurso comercial del producto |
| Salida | **HTML + Tailwind CSS + JavaScript "real"**, no formato propietario; el usuario se lleva el código | SECUNDARIO, consistente | **CONFIRMADO (parcial) / CORREGIDO (ampliado).** El anexo cita la documentación oficial de Aura ("HTML real, Tailwind CSS y JavaScript vanilla") para el **editor clásico** (anexo §1) — CONFIRMADO. Pero eso ya no es toda la verdad: el anexo revela un **segundo editor**, "Aura Code/Canvas" (anexo §2), cuyo artefacto es un **proyecto React** (React+Vite/CRA/Next detectados y normalizados), no HTML plano. La fila original describía sólo la mitad del producto |
| Exportación | Export a HTML/CSS/JS y **export a Figma** (frames) | SECUNDARIO, consistente | **PARCIALMENTE CONFIRMADO.** Export/descarga como ZIP vía `html2canvas` + `JSZip` — CONFIRMADO PRIMARIO (anexo §1, tabla stack). Integración con Figma sí existe (API REST `/v1/files`, `/v1/nodes`, `/v1/images`, `/v1/components` con token del usuario — anexo §9), pero el anexo la documenta como **import** (Figma → código) para el conversor de diseño, no confirma un export a frames de Figma → **SIGUE SIN VERIFICAR** ese sentido específico |
| Publicación | Subdominio de Aura, o dominio propio, o exportar y desplegar en Netlify/Vercel | SECUNDARIO | **PARCIALMENTE CONFIRMADO.** La app pública se sirve desde **Netlify** — CONFIRMADO PRIMARIO (anexo §8). La publicación React usa artefactos precompilados (`react-preview-bundler`), no "exportar y que el usuario despliegue" — CORREGIDO: la ruta principal es publicar dentro de Aura, con dominio propio soportado (documentación oficial citada en anexo §8), no un export manual a Netlify/Vercel por el usuario |
| Referencias en el prompt | Se pueden referenciar plantillas/componentes/snippets con `@`, hasta "~100.000 caracteres de contexto"; Shift-clic para referenciar varios | SECUNDARIO (designcode.io, bloqueado; sólo snippet) | **SIGUE SIN VERIFICAR** — el anexo no trata el prompt de referencia ni sus límites de contexto |
| Biblioteca | Cifras **contradictorias**: "1.700 plantillas / 1.400 componentes" vs "5.000+ plantillas / 2.800+ componentes / 30.000+ assets" vs "1.400+ componentes reemplazables" | **NO FIABLE** — tres cifras distintas en tres fuentes | **SIGUE SIN VERIFICAR** — el anexo no da cifras de catálogo, sólo nombres de tablas (`assets`, `components`, `design_systems`, anexo §5) |
| Usuarios | "189.000" en una fuente, "65.000" en otra | **NO FIABLE** | **SIGUE SIN VERIFICAR** — no tratado en el anexo |
| Precio | Pro 20 USD/mes con 120 prompts, hasta 100 páginas, export HTML+Figma, plantillas Pro, subdominio privado; Max 40 USD/mes; Ultra 100 USD/mes con 560 prompts | SECUNDARIO, **no verificado contra `aura.build/pricing`** | **SIGUE SIN VERIFICAR** — el anexo es un análisis técnico del bundle, no de la página de precios |
| Modelos de IA | Menciones a "Gemini 3.1 Pro", y en otra fuente "GPT-5, Claude y Gemini" | **NO FIABLE** — no confirmado por fuente primaria | **CORREGIDO (ampliado), PRIMARIO.** El anexo lista el catálogo real visible en el frontend (anexo §6): texto/código — OpenAI gpt-5.6/5.5/5.4/5.2/5, Anthropic Claude Opus/Sonnet (varias generaciones), Google Gemini 3.1 Pro/3 Pro/Flash, xAI Grok 4.3; imagen — GPT Image, Gemini Image, Flux 2 Pro, Ideogram V3 Remix, remove.bg, RemBG, Replicate; vídeo — Grok Imagine Video, Seedance 2.0. Es multi-proveedor real, no una lista de 2-3 nombres. El anexo aclara que son identificadores de frontend, no confirma qué modelo se selecciona por prompt ni el gateway |
| Fundador | Meng To (conocido por Design+Code) | SECUNDARIO, plausible y coherente con que designcode.io publique el curso oficial | **SIGUE SIN VERIFICAR** — no tratado en el anexo |

### 2.2 Stack detectado

~~**No pude detectar el stack.**~~ **ACTUALIZACIÓN 2026-09-03:** sí se pudo, vía el anexo primario (`anexos/aura-build-analisis-frontend-2026-09-03.md`, fuente: bundle real descargado — TypeScript, dependencias, chunks). El texto original decía que no había acceso a HTML, cabeceras, `robots.txt`, `sitemap.xml`, manifest ni scripts; eso seguía siendo cierto **para esta sesión**, pero el dueño del proyecto sí tuvo ese acceso y lo documentó. Tabla original conservada con estado añadido; fila nueva de discrepancia marcada explícitamente.

| Capa | Tecnología (afirmación original) | Evidencia (URL / cabecera / script) | Verificado / Inferido (original) | Estado tras el anexo |
|---|---|---|---|---|
| Formato del documento generado | **HTML + Tailwind CSS + JS vanilla** | Snippets de búsqueda citando `aura.build/learn/documentation` y `aura.build/learn/faq`: "Aura generates real HTML, Tailwind CSS, and JavaScript" | **SECUNDARIO** (consistente en ≥5 fuentes independientes) | **CONFIRMADO (parcial), PRIMARIO — pero incompleto.** Cierto para el editor clásico (anexo §1, §"Conclusión"). El anexo añade que existe un **segundo editor**, "Aura Code/Canvas", cuyo documento es un **proyecto React** completo (árbol de archivos, rutas, múltiples archivos), no HTML+JS vanilla — anexo §2 |
| Sistema responsive del documento | **Prefijos de breakpoint de Tailwind** (`sm: md: lg: xl: 2xl:`) | Snippet: "Aura automatically detects which Tailwind breakpoint you're viewing (sm:, md:, lg:, xl:, 2xl:) and applies classes to that specific breakpoint" | **SECUNDARIO** | **SIGUE SIN VERIFICAR el mecanismo exacto.** El anexo confirma que el editor clásico tiene "modos desktop, tablet y mobile" (anexo §1) — consistente con edición por breakpoint — pero no describe la escritura automática de prefijos `sm:/md:/…`; Tailwind como lenguaje de estilos sí es PRIMARIO (ver fila de abajo) |
| Modelo del editor | **Árbol DOM del HTML generado** (panel de capas = estructura HTML, filtrable por clase de Tailwind) | Snippet de `designcode.io/prompt-ui-design-mode-in-aura/` (dominio bloqueado): "view your complete HTML structure with collapsible sections, filter by element types, class names, or Tailwind utilities" | **SECUNDARIO** | **CONFIRMADO, PRIMARIO.** El anexo confirma selección de elementos del DOM, edición de texto/estilos/colores/fondos/efectos/espaciado, y un motor de operaciones (`addClass`, `removeClass`, selector CSS, `data-element-id`, índice, posición, nth) — anexo §1 |
| Interoperabilidad | Import/export **Figma** | Snippets consistentes | **SECUNDARIO** | **CONFIRMADO (parcial), PRIMARIO.** Integración con Figma REST API confirmada (`/v1/files`, `/v1/nodes`, `/v1/images`, `/v1/components`, token del usuario) — anexo §9. El algoritmo de conversión Figma→código no es público (anexo §9) |
| Frontend de la app (Next/Nuxt/Astro/Remix…) | — | Ninguna | **NO VERIFICADO** — dominio bloqueado, sin acceso a `/_next/`, `<meta generator>` ni cabeceras | **CORREGIDO, PRIMARIO.** La aplicación principal es **React 18.3.1 + React Router 6.30.3, bundle con Vite**, TypeScript 5.6.3 — **no Next.js** (anexo, tabla de stack). Esto corrige por extensión la sección 4.1 de este mismo informe, que recomendaba Next.js para nuestro proyecto por analogía implícita con "generadores de este tipo": la elección de Next.js sigue siendo válida por argumentos propios (§4.1), pero no debe justificarse citando a aura.build como precedente de stack, porque aura.build no usa Next |
| Hosting / CDN (Vercel, Cloudflare…) | — | Ninguna | **NO VERIFICADO** | **CONFIRMADO (parcial), PRIMARIO.** Netlify aloja la app pública (headers HTTP observados) — anexo §8. Cloudflare/Vercel: no mencionados, `SIGUE SIN VERIFICAR` |
| Backend / BaaS (Supabase, Convex, Firebase…) | — | Ninguna | **NO VERIFICADO** | **CONFIRMADO, PRIMARIO.** **Supabase** es el backend: Auth, PostgreSQL vía PostgREST, Storage, Edge Functions, Realtime (WebSockets) — anexo §5, con lista de tablas observadas (`chats`, `react_projects`, `cms_collections`, etc.) |
| Pagos (Stripe…) / analítica (PostHog…) | — | Ninguna | **NO VERIFICADO** | **Analítica: CONFIRMADO, PRIMARIO** — Google Analytics/GTM, Umami Analytics, Promotekit (anexo §9). **Pagos: SIGUE SIN VERIFICAR** — no evidenciado en el anexo |
| Editor de texto (TipTap/Lexical/ProseMirror) | — | Ninguna; **INFERIDO que probablemente no usa ninguno**, porque edita `contenteditable` sobre el DOM generado, no un documento rich-text | **INFERIDO, baja confianza** | **SIGUE SIN VERIFICAR.** El anexo no nombra ninguna librería rich-text; sí confirma `CodeMirror 6` para el **editor de código** (no de contenido) y `Prism` para resaltado de sintaxis (anexo, tabla de stack) — no contradice la inferencia original pero tampoco la confirma |

**Filas nuevas, sin equivalente en la tabla original (todas PRIMARIO, anexo):** editor de código = **Sandpack** (CodeSandbox) + **CodeMirror 6**, bundler `sandpack-bundler.codesandbox.io` (anexo §3); preview propio en **iframe con `postMessage`** (`SANDBOX_READY`, `UPDATE_MODULES`, `NAVIGATE`, `REFRESH`), Sandpack como *fallback*, no como preview principal (anexo §3); agente de programación en streaming tipo SSE vía Supabase Edge Function → transporte `direct_fly` → Fly Code Agent, ejecuciones de hasta ~30 min (anexo §4); CMS con atributos `data-cms-loop/-field/-type/-collection` en HTML y puente `postMessage` (`auraCms.js`) para proyectos React, sin exponer credenciales de Supabase al preview (anexo §7); publicación React vía artefactos precompilados (`react-preview-bundler`), no build-on-visit (anexo §8); capturas con `html2canvas` 1.4.1 y exportación ZIP con `JSZip` 3.10.1 (anexo, tabla de stack).

**Intentos fallidos documentados (vigentes, esta sesión):** `https://aura.build` (WebFetch → `EGRESS_BLOCKED`), `https://www.aura.build/` (WebFetch → `EGRESS_BLOCKED`; `curl` → `CONNECT tunnel failed, response 403`, `connect_rejected` por política de la organización), `https://web.archive.org/web/2026/https://www.aura.build/` (WebFetch → "unable to fetch"), y las fuentes secundarias `trustpilot.com/review/aura.build`, `designmonks.co`, `toolify.ai`, `designcode.io` (las cuatro `EGRESS_BLOCKED`). No hay repositorio público de GitHub de la empresa localizado. Estos intentos siguen sin éxito **desde esta sesión**; lo que cambió es que el dueño del proyecto aportó por otra vía (fuera de esta sesión) el análisis del bundle real, que se trata aquí como PRIMARIO.

### 2.3 Cómo funciona su editor y su edición por IA

~~Reconstrucción **SECUNDARIA**, coherente entre fuentes:~~ **ACTUALIZACIÓN 2026-09-03:** cada punto de la lista original queda anotado con su estado tras leer el anexo primario (`anexos/aura-build-analisis-frontend-2026-09-03.md`). La corrección más importante de todo este informe está en el punto de "Edición por IA": lo que se afirmaba como el patrón dominante (regeneración de código, sin salida estructurada) **es la lectura equivocada** — el anexo documenta justo lo contrario, un patch engine estructurado con validación previa.

- **Dos modos.** Un modo *prompt* (chat/caja de prompt) que genera o regenera, y un **"Design Mode"** visual. La documentación citada lo vende justo como el puente: *"Design Mode elimina la brecha entre diseño y código. Puedes editar visualmente tu UI generada por IA sin necesidad de volver a promptear."*
  → **CORREGIDO (ampliado), PRIMARIO.** No son "dos modos" de un mismo editor: son **dos arquitecturas de editor superpuestas** (anexo, "Conclusión" y §1-§2): (1) el editor visual HTML/Tailwind/JS-vanilla clásico, con su propio modo visual y modo código; (2) "Aura Code/Canvas" (`/code`), un workspace de proyectos React con árbol de archivos, rutas, logs de build y agente de programación — arquitectura distinta, no una pestaña del primero.
- **Unidad de edición: el elemento HTML.** No bloques semánticos ni secciones de negocio. El panel de capas es la estructura HTML colapsable, con filtros por tipo de elemento, nombre de clase o utilidad Tailwind, e incluso gestión de elementos `<script>` y `<style>`.
  → **CONFIRMADO, PRIMARIO** (anexo §1: selección de elementos del DOM, `data-element-id`, selector CSS, índice/posición/nth).
- **Estilo = clases de Tailwind.** Al seleccionar un elemento se ven overlays de medidas (margin, padding, gap, posicionamiento absoluto) y cada medida es clicable para editarla.
  → **CONFIRMADO, PRIMARIO** (anexo §1: "edición de texto, estilos, colores, fondos, efectos y espaciado"; operaciones `addClass`/`removeClass` sobre Tailwind).
- **Responsive = breakpoints de Tailwind, semi-automático.** El editor detecta en qué breakpoint estás y escribe la clase con ese prefijo. Hay "auto-breakpoints".
  → **SIGUE SIN VERIFICAR** el mecanismo exacto de escritura de prefijos. El anexo sólo confirma "modos desktop, tablet y mobile" (anexo §1), consistente pero no idéntico a lo afirmado.
- **Composición.** Biblioteca grande de componentes "reemplazables" con drag & drop, y referencias `@` a plantillas/componentes dentro del prompt.
  → **SIGUE SIN VERIFICAR** — el anexo no trata la biblioteca de componentes ni las referencias `@` del prompt.
- **Edición por IA.** El patrón dominante es **regeneración de código** (prompt → HTML/Tailwind/JS), con la promesa explícita de que para retoques pequeños uses Design Mode en vez de regenerar. **No hay evidencia** de que aura.build use salida estructurada validada contra un esquema; su unidad de salida es código. **INFERIDO** a partir de que el artefacto es HTML.
  → **CORREGIDO, PRIMARIO — la afirmación central era incorrecta.** El anexo documenta un **patch engine sobre DOM** en el modo moderno de edición (anexo §1, "Edición incremental segura"): (1) analiza el HTML actual, (2) localiza selectores/elementos estables, (3) genera operaciones pequeñas (`addClass`, `removeClass`, selector CSS, `data-element-id`, índice, posición, nth), (4) **valida los selectores antes de aplicarlos**, (5) ejecuta un **dry run**, (6) aplica los cambios, (7) **si falla, intenta reparar la operación**, (8) sólo como último recurso regenera el HTML completo. Esto es, casi al pie de la letra, "salida estructurada validada + reparación", justo lo contrario de "regenera código sin validar contra esquema". La regeneración completa de código **sigue existiendo** (funciones `generate-html`/`generate-html-v2`, anexo §1) pero es el último recurso, no el patrón dominante.
- **Historial / versiones / autosave:** **NO VERIFICADO.** Busqué explícitamente y no obtuve evidencia.
  → **SIGUE SIN VERIFICAR** — el anexo tampoco trata historial de versiones ni autosave del documento del usuario.

**Lectura crítica (opinión mía).** El editor de aura.build es bueno para un diseñador y estructuralmente inadecuado para una novia, y la causa está en la capa de datos: **cuando tu documento es DOM + utilidades CSS, todo editor visual degenera en un inspector de estilos.** Aura ni siquiera hace nada mal; es que su público es otro. Copiar su UI simplificándola sería copiar el problema. Lo que hay que copiar es el *flujo*: (1) el usuario nunca parte de un lienzo en blanco, (2) el resultado inicial ya es publicable, (3) los retoques son quirúrgicos y no obligan a regenerar.
→ **Esta lectura crítica se sostiene y se refuerza con evidencia primaria** para el editor HTML clásico (documento = DOM + Tailwind → editor = inspector de estilos). Con un matiz que el anexo añade: Aura ya mitiga parte del dolor de "documento = DOM+CSS" con su patch engine (validar + dry-run + reparar antes de tocar el DOM), y lo evita del todo en su segundo editor moviéndose a un documento de proyecto React con CMS tipado (`data-cms-*`) en vez de DOM suelto. Es decir, la propia Aura parece estar migrando en la misma dirección que recomienda este informe (más estructura, menos "documento = presentación cruda") — ver 2.4.

### 2.4 Lecciones de aura.build para este rediseño (evidencia primaria)

Todo lo citado en esta subsección procede de `anexos/aura-build-analisis-frontend-2026-09-03.md` (PRIMARIO). Se traduce a nuestro documento de 4 capas (§5.2) y al patrón de IA (§6), no se copia literal.

**(a) Qué SÍ se adopta y cómo se traduce**

- **Patch engine con validación previa, dry-run y reparación** (anexo §1, "Edición incremental segura") → nuestro contrato de IA (§6) ya proponía un catálogo cerrado de operaciones validadas por Zod; el anexo confirma que ese patrón funciona en producción a escala real. Añadir explícitamente: (1) validar contra el manifiesto de la plantilla **antes** de aplicar (equivalente a "validar selectores"), (2) un **dry-run** que compute el documento resultante y lo valide de nuevo antes de persistir, (3) si una operación individual falla, **descartarla sola** (no todo el lote) — nuestro §6 punto 3 ya decía "se descarta en silencio, no rompe el lote"; el anexo confirma que es el patrón correcto, no una simplificación nuestra. Referencia: P1 (nada se descarta en silencio → aquí sí conviene registrar el descarte, no silenciarlo del todo) y P9.
- **Preview aislado en iframe con `postMessage`** (anexo §3) → separar físicamente el proceso del editor (chrome, estado, undo) del proceso que renderiza las secciones (`apps/site`/lienzo del editor), comunicados por mensajes tipados, nunca por acceso directo al DOM del otro. Reduce la superficie de bugs de "el editor rompe el render" y es aplicable ya en `apps/editor` de §4.4 aunque no usemos iframe (el principio es la frontera de mensajes, no la tecnología iframe en sí). Referencia: P7 (editor simple) y arquitectura de §4.4.
- **Publicación como artefactos precompilados, no build-on-visit** (anexo §8, `react-preview-bundler`) → confirma nuestra decisión de `InvitationRelease` inmutable + render estático/ISR (§5.2, §5.4): el invitado nunca dispara una compilación ni toca el editor. Referencia: H (hallazgo propio) §5.4 "el invitado no toca la base de datos ni ejecuta código de editor".
- **Puente de datos de negocio hacia el preview sin exponer credenciales** (anexo §7, `auraCms.js`: postMessage, caché, timeout ~15s, sin credenciales de Supabase en el preview) → si el editor necesita mostrar datos reales de negocio (p. ej. conteo de RSVP) dentro del lienzo, debe llegar por un canal intermediado por el backend propio, nunca exponiendo credenciales de Postgres/Spring al iframe/lienzo. Referencia: P8 (seguridad en el contrato: ids del servidor, propiedad comprobada).
- **Separación de tablas/dominios por tipo de editor** (anexo §5: editor HTML vs editor React vs Canvas vs CMS, cada uno con sus propias tablas) → confirma mantener el negocio (RSVP/invitados) en tablas relacionales aparte del documento JSONB (§5.2 capa "aparte Negocio"), en vez de mezclar dominios en una sola colección.
- **Streaming tipo SSE para trabajos largos del agente** (anexo §4: SSE + polling de recuperación, ejecuciones de hasta ~30 min) → si la "Mejorar con IA" de §3.1 punto 11 evoluciona a tareas más largas que una operación puntual (p. ej. reescribir toda una sección con varias iteraciones), el patrón a copiar es streaming con recuperación por *polling* ante cortes, no una llamada síncrona bloqueante. Aplica sólo si fase 2 crece más allá de operaciones cortas; de entrada §6 ya asume operaciones ≤10 y rápidas.
- **Reparación automática de operaciones inválidas antes de rendirse** (anexo §1 paso 7) → matiza §6 punto 2 (el AI SDK lanza `AI_NoObjectGeneratedError` y no repara): a nivel de **operación individual** dentro de un lote sí es razonable un intento de reparación (p. ej. reintento con el error como contexto) antes de descartarla, no sólo descartar en el primer fallo. Detalle de implementación para fase 2, no cambia el catálogo cerrado de operaciones.

**(b) Qué NO se adopta y por qué**

- **DOM + clases Tailwind como documento editable del usuario** (anexo §1, confirmado PRIMARIO) → es exactamente lo que §5.2 evita a propósito: "ni una gota de CSS en el documento del usuario". Adoptarlo reproduciría el problema medido en la auditoría (E§5: ~1000 valores CSS por plantilla). Referencia: P3, P7, §3.2 fila "CSS libre, HTML libre".
- **Breakpoints manuales/semiautomáticos como control del usuario** (anexo §1, "modos desktop/tablet/mobile" editables) → nuestro §3.2 ya lo excluye ("la plantilla es responsive por construcción; el usuario sólo previsualiza"). El anexo no cambia esto, lo confirma como un rasgo de editor-para-diseñador, no para el cliente final.
- **Editor de código con Sandpack + CodeMirror 6** (anexo §3) → fuera de alcance: nuestro editor no expone código al usuario final (P7); es apto, como mucho, para una futura herramienta interna de plantillas, en la misma categoría de "spike opcional" que Puck (§4.4).
- **Supabase como backend** (anexo §5) → decisión ya tomada y reafirmada en `contratos.md`: Postgres/Spring propios, no un BaaS de terceros. La consistencia transaccional negocio+documento (P6, §5.4) es más fácil de garantizar con nuestro propio Postgres que integrando un BaaS externo.
- **Catálogo multi-proveedor de IA (7+ proveedores de texto/imagen/vídeo)** (anexo §6) → fuera de alcance de fase 1/2: nuestro contrato de IA (§6) fija un modelo/proveedor por vía del AI SDK con salida estructurada; multiplicar proveedores antes de estabilizar el esquema (riesgo #6 de §7) sería repetir el error que la propia auditoría señala como coste, no beneficio.
- **Dos arquitecturas de editor superpuestas y sin unificar** (anexo, "Conclusión": editor HTML clásico + Aura Code/Canvas como sistemas distintos) → para nuestro producto, con un solo tipo de documento (invitación, no "cualquier sitio"), mantener un único editor coherente es preferible; la fragmentación de Aura es consecuencia de servir casos de uso muy distintos (landing genérica vs proyecto de software), que no es nuestro caso.

---

## 3. Propuesta de editor simple (modelo de interacción)

**Principio rector: el usuario edita *su boda*, no *su página*.** Ningún control del editor debe nombrar un concepto de maquetación. No hay "padding", no hay "breakpoint", no hay "capa". Hay "la foto de portada", "la hora de la misa", "los padrinos".

### 3.1 Lo que sí hace

| # | Interacción | Cómo se siente | Qué toca por debajo |
|---|---|---|---|
| 1 | **Vista previa siempre viva, a pantalla completa** | El editor *es* la invitación. No hay "vista previa" como pestaña aparte | Render del mismo paquete de secciones que verá el invitado |
| 2 | **Clic directo sobre el texto → se edita ahí mismo** | Como escribir en un papel | `content.<seccion>.<campo>` (string). Sin fuente, sin tamaño, sin color |
| 3 | **Clic sobre una foto → "Cambiar foto"**; arrastrar una foto desde el escritorio sobre el hueco la sustituye | Reemplazo, nunca posicionamiento | `content.<seccion>.images[i].assetId` + `focalPoint {x,y}` para el encuadre |
| 4 | **Barra lateral con la lista de secciones**: arrastrar para reordenar, interruptor para mostrar/ocultar | 12 filas, iconos grandes | `structure.sections[]` (orden + `visible`) |
| 5 | **"Estilo"**: 6-10 **paletas** con nombre ("Blanco y verde olivo") y 4-6 **parejas tipográficas** con nombre ("Clásica", "Moderna") | Se elige una foto de conjunto, no un color | `theme.paletteId`, `theme.typeSetId` — nunca un hex ni un `px` |
| 6 | **Interruptor Móvil / Escritorio** | Sólo para *ver* | Nada. El responsive lo resuelve la plantilla |
| 7 | **Deshacer / Rehacer** (botón visible + Ctrl/Cmd+Z) | Red de seguridad psicológica | Pila local de estados (zundo) |
| 8 | **Autosave con indicador "Guardado"** | Nunca hay botón "Guardar" que se pueda olvidar | PATCH con debounce ~800 ms + versión optimista |
| 9 | **Publicar** como acción explícita y separada de guardar | "Tu invitación está en vivo" | Crea un *release* inmutable |
| 10 | **Variantes de sección** (2-4 por sección: "Portada con foto grande" / "Portada con marco floral") | Elegir entre miniaturas | `structure.sections[i].variant` |
| 11 | **"Mejorar con IA" por sección** (fase 2) | Botón discreto dentro de cada sección, no un chat global | Propuesta de operaciones → diff previsualizable → aceptar/descartar |

### 3.2 Lo que se deja fuera **a propósito** (y hay que defenderlo en cada reunión)

| Se deja fuera | Por qué |
|---|---|
| Posicionamiento libre / arrastrar elementos por el lienzo | Es la fuente nº 1 de invitaciones rotas en móvil. La plantilla decide la posición, siempre |
| Colores y tipografías libres (color picker, lista de 900 fuentes) | El 90 % de los usuarios elige mal. Paletas curadas garantizan contraste y elegancia; además son un token, no un valor suelto |
| Tamaños de fuente, márgenes, `lineHeight` por breakpoint | Es literalmente lo que hoy se guarda 149 veces por plantilla en `md/sm/xs` (E§5). Suprimirlo es el 80 % del beneficio del rediseño |
| CSS libre, HTML libre, `<script>` | Superficie de ataque y de soporte, cero valor para el usuario |
| Panel de capas / árbol de elementos | Concepto de diseñador. Su equivalente aceptable es la lista de 12 secciones |
| Breakpoints manuales | La plantilla es responsive por construcción; el usuario sólo *previsualiza* |
| Añadir bloques arbitrarios en cualquier sitio | El catálogo de secciones es cerrado y semántico (portada, evento, galería…). Añadir = activar una sección del catálogo |
| Colaboración en tiempo real multi-cursor | Dos novios editando a la vez es un caso raro y caro. Basta bloqueo suave + "alguien más está editando" |

### 3.3 Sobre el "arreglar con IA"

Debe entrar **como un asistente por sección, no como un chat que reescribe la página**. Tres razones: (a) el usuario común no sabe escribir un prompt de diseño; (b) un cambio global es imposible de revisar y aterrador de aceptar; (c) acotado a una sección, el conjunto de operaciones posibles es pequeño y se puede validar por esquema. Botones concretos, no caja de texto vacía: *"Escribe un texto bonito para nuestra historia"*, *"Acorta esto"*, *"Sugiere una paleta a partir de mi foto de portada"*.

---

## 4. Evaluación tecnológica

Todas las versiones y fechas: **VERIFICADO (API)** vía `registry.npmjs.org` el 2026-09-03. Estrellas y último push: **VERIFICADO (API)** vía la API de búsqueda de GitHub el 2026-09-03.

### 4.1 Framework base

| Opción | Versión / fecha | Encaje con "editor simple" | Riesgo de lock-in | Veredicto |
|---|---|---|---|---|
| **Next.js (App Router)** | `next` **16.3.4** (2026-08-31), MIT, 142.079 ★ | Alto. Un solo proyecto sirve el **editor** (cliente) y el **render del invitado** (servidor/estático) reutilizando *los mismos componentes de sección*. ISR/SSG para la invitación pública, que es tráfico de lectura masiva y cacheable | Medio-bajo. El App Router acopla algo; despliegue fuera de Vercel es posible pero menos cómodo | **RECOMENDADO** |
| **Vite SPA** (React) | `vite` **8.2.2** (2026-08-20), MIT | Bueno para el editor, **malo para el invitado**: la invitación pública sería una SPA con TTFB pobre y SEO/preview de WhatsApp mediocres. Habría que montar un segundo proyecto para el render | Bajo | Sólo si se acepta mantener **dos** aplicaciones |
| **Astro (islands)** | `astro` **7.2.10** (2026-08-31), MIT, 62.250 ★ | Excelente para el **render del invitado** (HTML casi puro), pobre para un editor con estado rico | Bajo | Alternativa válida *para la parte pública* si se quiere máximo rendimiento; añade una tecnología más al equipo |

**Decisión:** Next.js 16. El argumento decisivo no es la moda: es que **el paquete de secciones debe renderizarse igual en el editor y en la invitación publicada**, y eso sólo sale gratis si viven en el mismo proyecto.

### 4.2 Editores de bloques / páginas

| Opción | Madurez (verificada 2026-09-03) | Licencia | Encaje con "editor simple" | Lock-in | Veredicto |
|---|---|---|---|---|---|
| **Puck** | **Renombrado**: `@measured/puck` quedó congelado en **0.20.2** (2025-09-05); el paquete vivo es **`@puckeditor/core` 0.23.0 (2026-08-07)**. Repo `measuredco/puck` **13,2k ★** (leído en la página del repo, no por API). Sigue en **0.x** | MIT | **Su modelo de datos es exactamente el correcto** (array tipado `{type, props}` + registro de componentes + `<Render>` desacoplado del editor). **Su editor, no**: es un page-builder de arrastrar y soltar para gente técnica | Bajo — "los datos son tuyos", MIT, el `Data` es JSON plano tuyo | **Adoptar el MODELO, no el editor de usuario final.** Candidato serio para el **estudio interno de plantillas**. Ojo: 0.x + rebranding reciente ⇒ *breaking changes* esperables |
| **Craft.js** | `@craftjs/core` **0.2.12 (2025-02-14)**; último push al repo **2025-02-14**; **227 issues abiertos**; 8.738 ★ | MIT | Framework para *construir* editores, no un editor. Potente y flexible | Bajo | **NO.** Año y medio sin publicar. Se estaría adoptando un proyecto en pausa para una pieza crítica |
| **GrapesJS** | **0.23.6 (2026-08-25)**, 26.183 ★, activo | BSD-3-Clause (npm); GitHub reporta licencia "Other/NOASSERTION" — **conviene revisión legal** | Editor "tipo Dreamweaver": HTML/CSS libre, gestor de estilos, selectores CSS. **Exactamente el editor demasiado profesional que se quiere evitar** | Medio (formato propio de proyecto) | **NO** para el usuario final |
| **Builder.io SDK** | `@builder.io/sdk-react` **5.2.10 (2026-09-03)**, repo 8.821 ★, MIT | MIT (SDK) / SaaS de pago (plataforma) | Bueno como CMS visual, pero el editor vive en su nube | **Alto**: el contenido y el editor son suyos; su modelo cuesta dinero por seat y por tráfico | **NO** — es justo el tipo de dependencia que un negocio de invitaciones no quiere en su núcleo |
| **Plasmic** | `@plasmicapp/loader-nextjs` **2.0.26 (2026-08-27)**, repo 6.985 ★, MIT, push 2026-09-03 | MIT + SaaS | Igual que Builder: potente, editor en su nube, orientado a equipos de producto | Alto | **NO** para el núcleo. Aceptable como herramienta interna de diseño si se quisiera |
| **Webstudio** | 8.891 ★, push 2026-09-02, muy activo | **AGPL-3.0** | Es un Webflow abierto: CSS completo, editor de diseñador | **Licencia AGPL**: incorporarlo a un SaaS obliga a publicar el código derivado. Riesgo legal real | **NO** |
| **Tiptap** | `@tiptap/core` **3.31.0 (2026-09-01)**, 38.240 ★, MIT | MIT (núcleo); extensiones Pro de pago | Sólo relevante si se quiere **negrita/cursiva/enlaces** dentro de un texto. Para campos de una línea (nombres, fechas) es sobreingeniería | Bajo | **Sólo si** se decide texto enriquecido en 2-3 campos largos (historia, mensaje). Si no, `contenteditable` plano |
| **Lexical** | **0.50.0 (2026-09-02)**, 23.825 ★, MIT | MIT | Igual que Tiptap, más bajo nivel y aún pre-1.0 tras 5 años | Bajo | **NO** — Tiptap gana en ergonomía si hace falta rich text |

### 4.3 Estado, formularios, esquema, IA

| Pieza | Opción recomendada | Versión / fecha (verificada) | Por qué |
|---|---|---|---|
| Estado del documento | **Zustand** + **Immer** | `zustand` 5.0.15 (2026-08-13), 58.639 ★; `immer` 11.1.18 (2026-08-19), 28.981 ★ | Un store, actualizaciones inmutables legibles. Jotai (2.20.3, 2026-08-24) es igual de bueno pero atomiza el estado, lo que complica el *undo global* y el autosave del documento entero |
| Undo / Redo | **zundo** | 2.3.0 (**2024-11-17**), 888 ★ | Middleware de ~700 bytes sobre Zustand, hace exactamente esto. **Aviso honesto: 2 años sin publicar y sólo 888 ★.** Es código pequeño y auditable; si se prefiere, la pila de undo son ~60 líneas propias. **Decisión del equipo** |
| Reordenar secciones/fotos | **dnd-kit** | `@dnd-kit/core` **6.3.1 (2024-12-05)**; `@dnd-kit/react` **0.5.0 (2026-06-11)**; 17.595 ★, push 2026-07-13 | Accesible (teclado + lector de pantalla), sin dependencias. **Aviso: el paquete estable lleva ~21 meses sin release y el sucesor sigue en 0.x.** Para "arrastrar 12 filas de una lista" el riesgo es asumible |
| Formularios de sección | **react-hook-form** + resolver Zod | 7.87.0 (2026-08-30), 44.846 ★ | No re-renderiza el preview en cada tecla. Encaja con la validación por esquema |
| Esquema | **Zod 4** | `zod` **4.5.4 (2026-08-29)**, 43.781 ★ | **Pieza central.** Un solo esquema define: tipos de TS, validación en el editor, validación en la API y el contrato de salida de la IA |
| UI del chrome del editor | **shadcn/ui + Tailwind** | CLI `shadcn` 4.20.1 (2026-09-02), repo 122.854 ★; `tailwindcss` 4.3.3 (2026-07-16) | Código copiado al repo, no dependencia opaca. Cero lock-in. **Ojo: es para el *chrome* del editor, no para las plantillas de invitación**, que deben tener su propio sistema de tokens |
| IA | **Vercel AI SDK** | `ai` **7.0.91 (2026-09-02)**, Apache-2.0, 26.559 ★; `@ai-sdk/anthropic` 4.0.49 | Salida estructurada validada por Zod (`Output.object()`), y proveedor intercambiable. Ver §6 |
| Colaboración / CRDT | **Yjs — NO, todavía no** | `yjs` 13.6.32 (2026-08-04), 22.741 ★ | Excelente librería y problema equivocado. Aquí hay 1-2 editores no concurrentes. Un CRDT compra fusión sin conflictos y **cuesta** un modelo de datos opaco, historial binario y depuración difícil. Alternativa correcta: versión optimista + bloqueo suave. Reevaluar si algún día hay coedición real |

### 4.4 Recomendación única

> **Monorepo TypeScript con Next.js 16 (App Router) + React 19 + Tailwind 4.**
> **`packages/schema`**: los esquemas **Zod 4** del documento, del tema y del manifiesto de plantilla — fuente de verdad única, de la que se genera JSON Schema para que **el backend Kotlin valide con el mismo contrato**.
> **`packages/sections`**: los ~12 componentes de sección, cada uno con sus 2-4 variantes; **se usan tal cual en el editor y en la página del invitado**.
> **`apps/editor`**: editor a medida (Zustand + Immer + zundo, react-hook-form + Zod, dnd-kit sólo para reordenar, shadcn/ui para el chrome). **Sin librería de page-builder.**
> **`apps/site`**: render del invitado, estático/ISR desde el *release* publicado.
> **Puck** entra por una sola puerta: un *spike* acotado para el **estudio interno de plantillas** del equipo de diseño. Si no convence en dos semanas, se descarta y las plantillas se definen en código, que para 12 secciones es perfectamente sostenible.

**Trade-off honesto de "editor a medida".** Cuesta más al principio que instalar Puck: hay que escribir el lienzo, la selección, la edición inline y el undo. Se compensa en tres frentes: (1) es la única forma de que la superficie de edición sea *pequeña* — con Puck el usuario tendrá siempre a un clic un panel de props que no debería ver; (2) no se hereda el ritmo de *breaking changes* de un proyecto 0.x en la pieza más crítica del producto; (3) el editor a medida es exactamente lo que después consume la IA (§6), porque sus operaciones son las mismas de la UI.

---

## 5. Modelo de datos y almacenamiento de plantillas

### 5.1 Cómo lo hacen los referentes

| Referente | Patrón | Qué copiar | Evidencia |
|---|---|---|---|
| **Puck** | `Data = { content: ComponentData[], root: {props}, zones }`, donde cada elemento es `{ "type": "HeadingBlock", "props": { "id": "...", "title": "Hello, world" } }`. Los tipos se resuelven contra un `config` de componentes. Las `zones` **se están deprecando** en favor de campos `slot` | **El documento es una lista de instancias tipadas con props, y la presentación vive en el código del componente, no en el documento.** También: que la deprecación se gestione con guía de migración | **VERIFICADO (fuente leída)**: `github.com/measuredco/puck/blob/main/apps/docs/pages/docs/api-reference/data-model/data.mdx` |
| **Sanity / Portable Text** | JSON agnóstico de marcado: `block` con `children` (`span` con `text` y `marks`) y `markDefs` para anotaciones referenciadas por `_key`. Objetivo declarado: *"an agnostic abstraction of rich text that can be serialized into pretty much any markup language"* | **Separar el contenido de su serialización.** El mismo documento produce HTML hoy y otra cosa mañana sin migrar datos | **VERIFICADO (fuente leída)**: `raw.githubusercontent.com/portabletext/portabletext/main/README.md` |
| **Notion** | Todo es un `block` con UUID, `type`, propiedades, puntero al padre y lista ordenada de hijos. Almacenado en **PostgreSQL** (RDS), particionado por workspace | **Un solo tipo de entidad, tipada por `type`, y Postgres como almacén de documentos.** Que Notion, el producto-documento por excelencia, esté sobre Postgres desactiva el argumento "los documentos exigen Mongo" | **SECUNDARIO** (snippets de `notion.com/blog/data-model-behind-notion` y análisis derivados; dominio bloqueado) |
| **Figma** | El fichero es `Map<ObjectID, Map<Property, Value>>` — un árbol de objetos con propiedades. Multiplayer "inspirado en CRDTs" pero simplificado: todos los clientes de un fichero van al mismo servidor y se resuelve *last-writer-wins* **a nivel de propiedad** | **Granularidad de propiedad, no de documento**, para diffs y merges. Y la lección de humildad: incluso Figma evitó el CRDT distribuido completo | **SECUNDARIO** (snippets de `figma.com/blog/how-figmas-multiplayer-technology-works/`; dominio bloqueado) |
| **Builder.io** | Entrada de contenido con `blocks` (lista de componentes con opciones), elementos marcados con `"@type": "@builder.io/sdk:Element"`, un campo **`"@version"`** en el JSON y estado `published`/`draft` | **Versión del esquema dentro del propio documento** y separación borrador/publicado como estados de primera clase | **SECUNDARIO** (snippets de `builder.io/c/docs/write-api` y `how-builder-works-technical`; dominio bloqueado) |
| **Canva (Magic Design)** | La IA **no dibuja**: elige plantillas ya hechas que se adaptan al contenido aportado y **aplica la paleta de marca guardada** | El patrón exacto que queremos: **contenido del usuario + plantilla curada + tokens de marca**, en vez de generación libre | **SECUNDARIO** (snippets de `canva.com/help/use-magic-design/`) |
| **Wix** | ADI (cuestionario rígido → sitio, y luego la IA se retira) fue **retirado el 2024-11-10**; el builder actual ("Harmony") deja seguir conversando y refinando dentro del editor | **La IA como copiloto permanente, no como generador de arranque.** Y la advertencia: el modelo "asistente que construye y se va" fracasó y hubo que jubilarlo | **SECUNDARIO** (snippets de `support.wix.com` y `wix.com/blog/wix-artificial-design-intelligence`) |
| **Zola / The Knot** | Producto: catálogo grande de plantillas, secciones semánticas predefinidas (viaje, hoteles, transporte), y personalización acotada a **fuentes, colores y fotos** | Es exactamente el techo de libertad correcto para este público, validado por los dos líderes del mercado | **SECUNDARIO** (snippets de `zola.com/faq/customwebsite` y `theknot.com/content/best-wedding-websites`). **Su almacenamiento interno: NO VERIFICADO** (no es público) |

### 5.2 Propuesta: cuatro capas, y ni una gota de CSS en el documento del usuario

| Capa | Qué contiene | Quién la escribe | Dónde vive |
|---|---|---|---|
| **A. Paquete de plantilla** (inmutable, con semver) | `manifest` (id, versión, tipos de evento compatibles, secciones disponibles y sus variantes), esquema de contenido, **tokens por defecto**, presets de paleta y tipografía, assets de demo | Equipo de diseño, **en Git** | Tabla `template_version` + assets en S3/CDN. **Una versión publicada nunca se modifica** |
| **B. Tema** | `paletteId`, `typeSetId` y, como mucho, un puñado de overrides con nombre. **Nunca hex sueltos ni px** | Usuario (eligiendo entre opciones) | `invitation_document.theme` (JSONB) |
| **C. Estructura** | Lista de secciones: `key`, `variant`, `visible`, `order` | Usuario (reordenar / ocultar) | `invitation_document.structure` (JSONB) |
| **D. Contenido** | Textos, referencias a assets, fechas, lugares, personas | Usuario | `invitation_document.content` (JSONB) |
| **(aparte) Negocio** | Invitados, RSVP, códigos, aforo, mesas | Sistema | **Tablas relacionales normales.** Jamás dentro del documento |

**Esquema ilustrativo (TypeScript/Zod-style, 46 líneas):**

```ts
// packages/schema — fuente de verdad única (Zod 4). De aquí se genera JSON Schema para Kotlin.
type InvitationDocument = {
  schemaVersion: 3;                       // versión del ESQUEMA del documento (migraciones)
  template: { id: "aurora"; version: "2.1.0" };  // referencia inmutable al paquete
  locale: "es-MX";

  theme: {                                 // capa B — sólo referencias a tokens
    paletteId: "olivo-marfil";
    typeSetId: "clasica";
    overrides?: { accent?: TokenRef };     // TokenRef = "palette.accent", nunca "#3F5B3A"
  };

  structure: {                             // capa C — orden y visibilidad, nada más
    sections: Array<{
      key: "cover"|"couple"|"event"|"gallery"|"giftRegistry"|"family"
         |"amenities"|"suggestions"|"story"|"dressCode"|"countdown"|"footer";
      variant: string;                     // debe existir en el manifest de la plantilla
      visible: boolean;
    }>;                                    // el ORDEN del array ES el orden en la página
  };

  content: {                               // capa D — datos del usuario, sin presentación
    cover:   { title: string; subtitle?: string; imageAssetId?: string };
    event:   { items: Array<{ id: string; kind: "ceremony"|"reception"|"other";
                              startsAt: string; place: PlaceRef; note?: string }> };
    family:  { groups: Array<{ id: string; role: "parentsA"|"parentsB"|"godparents";
                               names: string[] }> };   // ← ROL EXPLÍCITO, no posición ni texto
    gallery: { assetIds: string[]; hashtag?: { text: string; network: "ig"|"fb" } };
    // …resto de secciones
  };
};

// Publicar congela una foto inmutable de todo lo anterior:
type InvitationRelease = {
  releaseId: string; invitationId: number; publishedAt: string;
  document: InvitationDocument;            // copia por valor
  templateVersion: "2.1.0";                // qué código la renderiza
  resolvedTheme: Record<string, string>;   // tokens ya resueltos (auditoría/regresión visual)
  contentHash: string;                     // dedupe y caché en CDN
};
```

**Las tres decisiones que arreglan los fallos concretos de la auditoría:**

1. **`role: "parentsA" | "parentsB" | "godparents"` en vez de emparejar por el texto del título o por el índice del array.** Mata de una vez los modos de fallo #5a (títulos que deben contener "Padre"/"Padrino", 5 de 6 plantillas no-boda incumplen), #5b y #5c (padres intercambiados por posición).
2. **El documento no contiene presentación.** Cambiar la escala tipográfica o la librería de iconos pasa a ser un despliegue del paquete de plantilla, no una migración de los ~1000 valores CSS de cada documento existente (E§5, punto 2).
3. **`InvitationRelease` inmutable.** Un cambio en Postgres (fecha, nombres) invalida el release y obliga a re-publicar: la desincronización silenciosa del modo #12 deja de ser posible porque el sistema *sabe* que el release está obsoleto.

### 5.3 Versionado y migraciones

- **Plantillas: semver estricto.** *patch* = corrección visual sin cambio de datos; *minor* = campos nuevos opcionales o variantes nuevas; *major* = cambio incompatible del contenido. **Las invitaciones ya publicadas se quedan clavadas en su versión**; migrar a una major es una acción explícita, previsualizable y reversible. Esto es lo que hoy no existe y por eso "v2 de la plantilla X" se convirtió en las plantillas 11 y 12 con su propia rama de código (E§5, punto 1).
- **Documento: `schemaVersion` entero + cadena de funciones `up()` puras**, aplicadas **lazy on read** (si `schemaVersion < actual`, se migra al leer y se reescribe) y con un job de barrido en batch para no arrastrar migraciones eternamente. Es el patrón estándar de *schema versioning* documentado para documentos JSON/BSON (**SECUNDARIO**: `oneuptime.com/blog/post/2026-03-31-mongodb-how-to-implement-the-schema-versioning-pattern-in-mongodb/view`, y `github.com/lerenn/lazy-schema-migration` como implementación de referencia).
- **Snapshots y undo.** Undo en el cliente = pila en memoria (zundo). Historial persistente = **snapshots del documento** cada N cambios o cada publicación, no un log de operaciones. Para 12 secciones, un JSONB completo pesa kilobytes; guardar las últimas ~20 versiones es trivial y hace posible "restaurar la versión de ayer" sin CRDT.
- **Multi-evento por composición, no por copia.** Hoy añadir un tipo de evento cuesta 6 tablas de catálogo y, si es "tipo boda", editar el generador (E§3b). En el modelo propuesto una plantilla declara en su manifiesto `eventTypes: ["boda","xv","bautizo"]` y las secciones se parametrizan por *rol* (`celebrants: 1 | 2`), no por `eventTypeId == 1L`.

### 5.4 Almacenamiento: Postgres JSONB, y retirar Mongo de este módulo

| Criterio | Postgres JSONB | MongoDB |
|---|---|---|
| Transaccionalidad con el negocio (invitación, invitados, plan) | **Misma transacción**. El alta parcial del modo #8 (revierte Postgres, el `save` de Mongo ya es definitivo) deja de ser posible | Dos sistemas, sin transacción común en instancia standalone |
| Integridad referencial plantilla↔documento | **FK real** a `template_version` | Hoy: sin FK, sin validación cruzada, en ningún sentido (E§4c) |
| Consultas sobre el documento | GIN sobre JSONB, suficiente y sobrado a esta escala | Buenas, pero irrelevante aquí |
| Precedente de frontera | **Notion sobre PostgreSQL** para 200.000 millones de bloques (SECUNDARIO) | — |
| Coste operativo | **Un sistema menos** que respaldar, indexar y vigilar | Dos |

**Servido al invitado:** el `InvitationRelease` se renderiza a **HTML estático / ISR** y se sirve desde CDN, cacheado por `contentHash`. El invitado no toca la base de datos ni ejecuta código de editor. El editor, en cambio, es dinámico y autenticado. Esta separación es la que convierte el pico de tráfico del día de la boda en un problema de CDN y no de base de datos.

---

## 6. Edición asistida por IA: patrón recomendado

**Qué hace cada referente (y qué NO copiar):**

| Producto | Qué produce la IA | ¿Copiable aquí? |
|---|---|---|
| aura.build | **Código** (HTML + Tailwind + JS) | **No.** Código generado = documento no validable, no versionable contra plantilla, no migrable |
| v0 / Bolt / Lovable | **Código** (React/Next, proyectos completos). Lovable añade "Visual Edits" como capa aparte | **No** para el núcleo, por lo mismo. La lección de Lovable sí: la edición visual va *aparte* de la generación |
| Framer (Wireframer) | **Estructura de layout** (secciones responsive con placeholders) a partir del prompt | Parcialmente: generar *estructura*, no estilos |
| **Canva (Magic Design)** | **Elige plantilla + coloca el contenido del usuario + aplica su paleta de marca** | **Sí. Es el patrón.** |
| **Wix (ADI → Harmony)** | ADI: cuestionario → sitio, y la IA se retira (**retirado 2024-11-10**). Harmony: conversación continua dentro del editor | **Sí**, la versión nueva: copiloto permanente, no generador de arranque |

**Patrón recomendado: "propuesta de operaciones estructuradas, validada por esquema".**

1. **El modelo nunca escribe el documento ni código.** Devuelve un objeto `EditProposal` con una lista **corta** (≤10) de operaciones de un catálogo cerrado: `setText`, `setTheme`, `setVariant`, `toggleSection`, `reorderSections`, `setFocalPoint`. Nada más. Si necesita algo que no está en el catálogo, no puede pedirlo.
2. **El catálogo es un esquema Zod**, el mismo que valida el editor y (vía JSON Schema generado) el backend Kotlin. Se pasa como `Output.object()` del AI SDK: *"the schema is also used to validate the generated data, ensuring type safety and correctness"* (**VERIFICADO (fuente leída)**: `raw.githubusercontent.com/vercel/ai/main/content/docs/03-ai-sdk-core/10-generating-structured-data.mdx`). El SDK **no repara** salidas malformadas: lanza `AI_NoObjectGeneratedError`, así que hay que tratar el fallo como caso normal, no excepcional.
3. **Doble validación.** Además del esquema: (a) toda operación debe apuntar a una sección y variante que **existan en el manifiesto de esa versión de plantilla**; (b) los valores de tema deben ser IDs de paleta/tipografía del catálogo, nunca colores libres. Una operación que no pase se descarta en silencio, no rompe el lote.
4. **Se aplica con el mismo reducer que la UI.** Cero rutas de escritura paralelas: la IA es un usuario más pulsando los mismos botones. Esto es lo que hace que el resultado sea deshacible, versionable y auditable por construcción.
5. **Diff previsualizable, siempre.** Antes/después lado a lado, "Aplicar" / "Descartar". Nunca autoaplicar.
6. **Alcance por sección.** Un botón dentro de cada sección, con acciones concretas. Nada de chat global.
7. **La IA para escribir prosa** (historia, mensajes, texto de dress code) es el caso de uso de mayor valor y menor riesgo. La IA para *maquetar* es el de mayor riesgo y menor valor, porque las plantillas ya están bien maquetadas.

**Por qué este patrón y no "que la IA genere el JSON completo":** un documento completo generado no es revisable por un humano, es indistinguible de una alucinación parcial, y rompe el undo (el "antes" es todo el documento). Una lista de 5 operaciones se lee en 3 segundos y se revierte con una tecla.

---

## 7. Riesgos y decisiones que debe tomar el equipo

**Riesgos**

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| 1 | ~~**La sección 2 de este informe es secundaria.** aura.build está bloqueado por política de red de la sesión~~ — **RESUELTO PARCIALMENTE, 2026-09-03.** El dueño aportó evidencia primaria del bundle real (`anexos/aura-build-analisis-frontend-2026-09-03.md`), integrada en 2.1-2.4. Sigue bloqueado **desde esta sesión** y siguen sin verificar: precio exacto, cifras de biblioteca/usuarios, fundador, referencias `@` del prompt, mecanismo exacto de breakpoints, historial/autosave del documento del usuario | **Baja** para lo ya cubierto por el anexo; **Media** para lo que sigue sin verificar (nada de eso es bloqueante para nuestras decisiones de diseño) | Ya no es necesario para el stack/arquitectura (cubierto). Si se quiere cerrar del todo: alguien con acceso abra `aura.build/pricing` y confirme precio y cifras comerciales — no es información que cambie ninguna decisión técnica de este informe |
| 2 | Puck está en **0.x** y acaba de renombrarse (`@measured/puck` → `@puckeditor/core`) | Media | No exponerlo al usuario final. Si entra, que sea sólo en la herramienta interna, donde un breaking change cuesta horas y no clientes |
| 3 | **dnd-kit estable lleva ~21 meses sin release** (6.3.1, 2024-12-05) y el sucesor está en 0.5.0 | Baja-media | Se usa para una lista de 12 filas; encapsular tras un componente propio `<SortableList>` para poder sustituirlo en un día |
| 4 | **zundo: 2 años sin publicar, 888 ★** | Baja | Es sustituible por ~60 líneas propias. Decidir a la primera fricción |
| 5 | **El esquema vive en TypeScript (Zod) y el backend es Kotlin** | **Alta si no se decide bien** | Generar **JSON Schema** desde Zod en CI y validar en Kotlin con un validador estándar. Si no se hace, se acaba con dos definiciones divergiendo, que es la enfermedad actual del proyecto |
| 6 | Migrar los documentos existentes de `invitation_configs` (con ~1000 valores CSS cada uno) al modelo nuevo | **Alta** | Escribir un *extractor* que lea el config viejo y produzca `content` + `theme`, descartando la presentación. No es reversible; hay que aceptarlo y probarlo con regresión visual sobre las 8 plantillas sembradas |
| 7 | Tentación de reintroducir libertad ("¿y si dejamos elegir el color?") | **Alta**, es la más probable de todas | Escribir §3.2 en el documento de producto y exigir una decisión explícita del dueño para cada excepción |
| 8 | GrapesJS declara BSD-3 en npm y "NOASSERTION" en GitHub | Baja (si se descarta) | No aplica si se sigue la recomendación |

**Decisiones que el equipo debe tomar (no puedo tomarlas yo)**

1. **¿Se retira MongoDB de este módulo?** Recomiendo sí. Es la decisión de mayor impacto y la más política.
2. **¿Dónde vive el esquema?** Recomiendo Zod → JSON Schema generado → Kotlin. Alternativa: definirlo en Kotlin y generar TypeScript. Lo inaceptable es mantener dos a mano.
3. **¿Texto enriquecido sí o no?** Si "historia" y "mensaje" admiten negrita/cursiva/enlaces → Tiptap. Si no → `contenteditable` plano y una dependencia menos.
4. **¿Cuánta libertad de tema?** Recomiendo paletas y parejas tipográficas cerradas y con nombre. Si comercialmente se exige "color de marca", que sea **un** color de acento que el sistema deriva a una paleta completa, nunca N colores sueltos.
5. **¿Estudio interno de plantillas: Puck o código?** Recomiendo un spike de 2 semanas con Puck; si no convence, plantillas en código.
6. **¿Cuándo entra la IA?** Recomiendo fase 2, y sólo redacción de textos + sugerencia de paleta. La IA sobre un modelo de datos que aún no está estabilizado multiplica el coste.
7. **¿Qué se hace con las invitaciones ya publicadas?** ¿Se migran, se congelan en el sistema viejo hasta que pase su fecha, o conviven ambos renders? Es una decisión de negocio, no técnica.

---

## 8. Fuentes consultadas

**Consultadas y leídas (VERIFICADO), 2026-09-03**

| Fuente | Para qué |
|---|---|
| `docs/analisis-plantillas/anexos/aura-build-analisis-frontend-2026-09-03.md` | **PRIMARIO**, aportado por el dueño del proyecto (no obtenido por esta sesión). Análisis técnico del bundle público de aura.build: stack real (React 18.3.1 + Vite + React Router, no Next), dos editores (HTML clásico vs Aura Code/React), patch engine sobre DOM con dry-run y reparación, preview en iframe con postMessage, backend Supabase, publicación con artefactos precompilados, CMS con `data-cms-*`. Integrado en 2.1-2.4 de este informe |
| `https://github.com/measuredco/puck/blob/main/apps/docs/pages/docs/api-reference/data-model/data.mdx` | Modelo de datos de Puck (`content`/`root`/`zones`, deprecación de `zones`) |
| `https://raw.githubusercontent.com/measuredco/puck/main/README.md` | Qué es Puck, licencia MIT |
| `https://github.com/measuredco/puck` | 13,2k ★, MIT, 2.105 commits |
| `https://github.com/measuredco/puck/releases` | Cadencia de releases; última v0.23.0 (7 de agosto) |
| `https://raw.githubusercontent.com/portabletext/portabletext/main/README.md` | Especificación Portable Text y ejemplo JSON |
| `https://raw.githubusercontent.com/vercel/ai/main/content/docs/03-ai-sdk-core/10-generating-structured-data.mdx` | `Output.object()/array()/choice()`, validación por Zod, `AI_NoObjectGeneratedError` |
| `https://raw.githubusercontent.com/design-tokens/community-group/main/README.md` | DTCG: estable 2025.10 (28-10-2025), formato de tokens, alias |
| `https://registry.npmjs.org/*` (API directa) | Todas las versiones y fechas de §4; descubrimiento del rename `@measured/puck` → `@puckeditor/core` |
| `api.github.com` vía MCP (`search_repositories`) | Estrellas, licencias y último push de: grapesjs, webstudio, craft.js, plasmic, builder, zustand, zod, tiptap, lexical, yjs, dnd-kit, vercel/ai, shadcn-ui/ui, next.js, astro, immer, react-hook-form, zundo |
| `/tmp/.../fases/E-riesgos.md` §§4-6 y `src/main/.../editor/EditorModels.kt` | Contrato implícito actual, acoplamiento con el frontend, 221 campos / 79 de presentación |

**Consultadas sólo vía snippets de búsqueda (SECUNDARIO), 2026-09-03** — la página no pudo abrirse:
`aura.build/`, `aura.build/learn`, `aura.build/learn/documentation`, `aura.build/learn/faq`, `aura.build/learn/prompt-for-ui`, `aura.build/pricing`; `designcode.io/prompt-ui-design-mode-in-aura/`; `notion.com/blog/data-model-behind-notion`; `figma.com/blog/how-figmas-multiplayer-technology-works/`; `builder.io/c/docs/write-api` y `/how-builder-works-technical`; `canva.com/help/use-magic-design/`; `framer.com/academy/lessons/wireframer`; `support.wix.com/en/article/adi-sites-no-longer-supported`; `wix.com/blog/wix-artificial-design-intelligence`; `zola.com/faq/customwebsite`; `theknot.com/content/best-wedding-websites`; `lovable.dev/guides/lovable-vs-bolt-vs-v0`; `oneuptime.com/blog/post/2026-03-31-mongodb-how-to-implement-the-schema-versioning-pattern-in-mongodb/view`; `github.com/lerenn/lazy-schema-migration`.

**Intentos FALLIDOS (bloqueo del proxy de egreso), 2026-09-03**

| URL | Error |
|---|---|
| `https://aura.build` | `EGRESS_BLOCKED` (WebFetch) |
| `https://www.aura.build/` | `EGRESS_BLOCKED` (WebFetch); `curl` → `CONNECT tunnel failed, 403` / `connect_rejected` |
| `https://web.archive.org/web/2026/https://www.aura.build/` | "unable to fetch" |
| `https://www.trustpilot.com/review/aura.build` | `EGRESS_BLOCKED` |
| `https://www.designmonks.co/case-study/aura-build-ai-powered-ui-design` | `EGRESS_BLOCKED` |
| `https://www.toolify.ai/tool/aura-build` | `EGRESS_BLOCKED` |
| `https://designcode.io/prompt-ui-design-and-code-with-aura-introduction/` | `EGRESS_BLOCKED` |
| `https://puckeditor.com/docs` | `EGRESS_BLOCKED` |
| `https://www.sanity.io/docs/block-content`, `https://portabletext.org/` | `EGRESS_BLOCKED` |
| `https://www.builder.io/c/docs/content-structure` | `EGRESS_BLOCKED` |
| `https://www.npmjs.com/package/@measured/puck` | HTTP 403 (protección anti-bot de npm; resuelto usando `registry.npmjs.org`) |
| `craft.js.org`, `grapesjs.com`, `plasmic.app`, `webstudio.is`, `tiptap.dev`, `lexical.dev`, `dndkit.com`, `ui.shadcn.com`, `sdk.vercel.ai`, `framer.com`, `wix.com`, `canva.com`, `figma.com`, `notion.com`, `producthunt.com`, `news.ycombinator.com` | Todos `EGRESS_BLOCKED` / sin conexión (`curl` → `000`) |

**Cifras que NO pude verificar y que no debe citarse como hechos:** número real de plantillas/componentes/usuarios de aura.build (tres cifras contradictorias en fuentes secundarias); su precio exacto; ~~los modelos de IA que usa; su stack de frontend, hosting y backend~~ (esto último **ya está confirmado por fuente primaria** desde 2026-09-03, ver 2.2 y 2.4: React+Vite+Tailwind+Sandpack/CodeMirror+Supabase+Netlify); si tiene historial de versiones/autosave del documento del usuario (sigue sin verificar); y el almacenamiento interno de Zola/The Knot/Canva/Wix (no es información pública).
