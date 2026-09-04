# Anexo: análisis del frontend público de aura.build (3 de septiembre de 2026)

> Aportado por el dueño del proyecto. Texto original sin editar; la integración en la investigación está en `../investigacion-editor-y-tecnologias.md`.

## Conclusión

Aura.build no utiliza un único editor. Actualmente parece tener dos arquitecturas superpuestas:

1. Un editor visual basado en HTML, Tailwind CSS y JavaScript vanilla.
2. Un editor más nuevo, "Aura Code/Canvas", orientado a proyectos React, código, rutas, CMS y agentes de programación.

La propia documentación de Aura describe su salida tradicional como "HTML real, Tailwind CSS y JavaScript vanilla", sin runtime propietario para esas páginas exportadas.

La siguiente investigación corresponde al frontend público descargable el 3 de septiembre de 2026.

## Stack tecnológico detectado

| Capa | Tecnologías observadas |
|---|---|
| Aplicación principal | React 18.3.1, React Router 6.30.3, bundle generado con Vite |
| Estilos | Tailwind CSS en los artefactos generados; CSS propio para el editor |
| Componentes UI | Lucide React 0.462.0, Iconify Web Component 2.1.0, componentes tipo Radix UI |
| Animaciones | Librería de motion/animaciones incluida en el bundle; el paquete exacto no está expuesto |
| Editor de código | Sandpack de CodeSandbox y CodeMirror 6 |
| Compilación TypeScript | TypeScript 5.6.3 |
| Preview | Iframe propio con postMessage, hot updates y caché de archivos |
| HTML | Parser/formateador integrado, Prism para resaltado y edición DOM |
| Capturas/exportación | html2canvas 1.4.1 y JSZip 3.10.1 |
| Backend | Supabase: Auth, PostgreSQL, Storage, Edge Functions y Realtime |
| Hosting visible | Netlify para la aplicación pública |
| IA | OpenAI, Anthropic, Google Gemini, xAI, Black Forest Labs, Ideogram, Replicate y otros proveedores |
| Publicación React | Artefactos precompilados mediante una función llamada react-preview-bundler |

Fuentes técnicas: bundle principal, TypeScript, Sandpack/CodeMirror, html2canvas y JSZip.

## 1. Editor visual HTML

El editor clásico trabaja sobre documentos HTML completos. Sus capacidades observables incluyen:

- Preview dentro de iframe.
- Modo visual y modo código.
- Selección de elementos del DOM.
- Edición de texto, estilos, colores, fondos, efectos y espaciado.
- Modos desktop, tablet y mobile.
- Capturas mediante html2canvas.
- Descarga/exportación como ZIP.
- Syntax highlighting mediante Prism.
- Formateo/parsing HTML integrado.

El chunk público del editor contiene funciones para: `generate-html`, `generate-html-v2`, `generate-edits`, `generate-edits-v2`, `continue-generation`, `describe-image`, `generate-image`, `generate-video`, `upscale-image`.

### Edición incremental segura

Una característica especialmente interesante es que Aura no siempre regenera toda la página. En su modo moderno de edición:

1. Analiza el HTML actual.
2. Localiza selectores y elementos estables.
3. Genera operaciones pequeñas sobre el DOM.
4. Valida los selectores antes de aplicarlos.
5. Ejecuta una especie de "dry run".
6. Aplica clases, estilos o cambios concretos.
7. Si falla, intenta reparar la operación.
8. Como último recurso, regenera el HTML completo.

El bundle expone operaciones como: `addClass`, `removeClass`, selección mediante CSS selector, `data-element-id`, índice, posición y nth, validación de selectores.

Esto sugiere una arquitectura de edición parecida a un patch engine sobre DOM, en lugar de depender únicamente de reescrituras completas por IA.

## 2. Aura Code y editor React

El módulo `/code` es considerablemente diferente. Está construido como un workspace de proyectos React con: árbol de archivos, archivos múltiples, logs de compilación, preview interactivo, rutas y páginas, modo código/preview/diseño, conversión de diseño HTML hacia React, reparación automática del proyecto y un agente especializado de programación. El chunk principal es `Code-BS4rxJNF.js`.

### Frameworks soportados

El código detecta y normaliza proyectos React + Vite, Create React App, Next.js y React Router (BrowserRouter, HashRouter, RouterProvider, Routes y Route; rutas de Next mediante `app/**/page.*` y `pages/**`). Reconoce convenciones como `src/App.*`, `src/main|index.*`, `src/pages/*`, `app/layout.tsx`, `next.config.js`.

El módulo de conversión incluye dependencias fallback: Vite 5.4.10, React 18.3.1, Tailwind CSS 3.4.1, PostCSS 8.4.38, Autoprefixer 10.4.19, lucide-react, @iconify/react, clsx, tailwind-merge, class-variance-authority, @radix-ui/react-slot. Estas versiones aparecen en `sandpackUtils`; son configuraciones generadas por Aura y no necesariamente el `package.json` final de todos los proyectos.

## 3. Sistema de preview

Aura utiliza dos rutas de preview.

**Preview propio.** El preview moderno carga `/preview-sandbox-v2.html`. El componente `CustomPreviewContainer` muestra que el iframe recibe mensajes `SANDBOX_READY`, `UPDATE_MODULES`, `NAVIGATE`, `REFRESH`; la aplicación padre envía actualizaciones con `window.postMessage(...)`. El sistema mantiene caché de archivos, actualización diferencial, hot reload de módulos, navegación entre rutas, comunicación con CMS y estado de disponibilidad del sandbox.

**Sandpack como fallback o preview alternativo.** Integra Sandpack de CodeSandbox y CodeMirror 6 (bundler `https://sandpack-bundler.codesandbox.io`), configurado con recarga automática, recompilación inmediata, ejecución automática, tema oscuro, archivo activo y lista de archivos visibles.

Por tanto, no es correcto describir Aura como "solo Sandpack": preview propio de Aura → Sandpack como fallback o modo compatible.

## 4. Agente de programación

El cliente `codeAgentClient` revela: en desarrollo local espera un agente en `http://127.0.0.1:3000/v1/code-agent`; en producción solicita autorización a una Supabase Edge Function y recibe un transporte denominado `direct_fly`; el stream se ejecuta contra un endpoint directo del agente; el navegador procesa eventos tipo SSE; hay recuperación mediante polling si el stream se interrumpe; las ejecuciones pueden durar hasta ~30 minutos. Arquitectura: Browser → Supabase authorization → Fly Code Agent stream. No se puede confirmar el lenguaje interno del agente ni cómo implementa sus herramientas.

## 5. Backend y persistencia

Supabase como backend principal: Auth, PostgreSQL vía PostgREST, Storage, Edge Functions, Realtime (WebSockets). Tablas/recursos observados: `chats`, `messages`, `react_projects`, `react_project_files`, `react_project_messages`, `code_sessions`, `canvas_workspaces`, `canvas_items`, `canvas_project_groups`, `design_systems`, `assets`, `components`, `skills`, `user_files`, `cms_collections`, `cms_fields`, `cms_items`, `shared_code`, `shared_react_projects`, `organization_members`, `chat_invites`. Buckets de Storage para assets, componentes, imágenes de preview, avatares y miniaturas de chats.

Separación lógica aparente:
- Editor HTML → chats + messages + shared_code
- Editor React → react_projects + code_sessions + react_project_files
- Canvas → canvas_workspaces + canvas_items + historial
- Biblioteca → assets + components + design_systems
- Contenido → cms_collections + cms_fields + cms_items

Deducido de las consultas del frontend; no representa necesariamente el esquema completo.

## 6. Modelos de IA

Catálogo visible en el frontend. Texto y código: OpenAI gpt-5.6/5.5/5.4/5.2/5; Anthropic Claude Opus y Sonnet de distintas generaciones; Google Gemini 3.1 Pro, 3 Pro y Flash; xAI Grok 4.3. Imágenes: OpenAI GPT Image, Gemini Image, Flux 2 Pro, Ideogram V3 Remix, remove.bg, RemBG y upscaling vía Replicate. Vídeo: Grok Imagine Video, Seedance 2.0 de BytePlus. Son identificadores del frontend: pueden existir modelos en rollout o limitados por plan; no se puede confirmar qué modelo se selecciona por prompt ni el gateway.

Patrón de generación: prompt o imagen → Supabase Edge Function → proveedor/modelo de IA → respuesta streaming → preview/editor → guardado en Supabase. Funciones expuestas: `generate-html`, `generate-edits`, `generate-reasoning`, `generate-cms-content`, `generate-components`, `html-to-component`, `code-agent`.

## 7. CMS y contenido dinámico

**HTML tradicional.** Atributos `data-cms-loop`, `data-cms-field`, `data-cms-type`, `data-cms-collection`. El editor genera un plan de operaciones para insertar o modificar contenido CMS y permite revisarlo antes de aplicarlo.

**React.** El módulo `reactCmsRuntime` inyecta `src/lib/auraCms.js`, que solicita colecciones al editor padre mediante postMessage, mantiene caché, controla solicitudes simultáneas, tiene timeout de ~15 s y evita exponer credenciales de Supabase en el preview generado. Los proyectos React no consultan el CMS directamente: atraviesan un puente iframe ↔ Aura.

## 8. Publicación

La app pública se sirve con Netlify (headers HTTP). Para React existe la función `react-preview-bundler`. El sistema guarda/publica archivos del proyecto, módulos precompilados, módulo principal, rutas, SEO, imágenes de preview, datos de dominio personalizado y configuración de analytics. La publicación React usa un runtime de preview con módulos ya compilados, en lugar de instalar y compilar el proyecto en cada visita. La documentación oficial confirma publicación, dominios personalizados, SEO y controles de CMS.

## 9. Integraciones externas

Figma REST API (`/v1/files`, `/v1/nodes`, `/v1/images`, `/v1/components`, con token personal del usuario), GitHub export, Google DNS para verificar dominios, Google Analytics/GTM, Umami Analytics, Promotekit, Iconify CDN, Spline, Unicorn Studio, YouTube, Vimeo y recursos 3D externos. El algoritmo de conversión Figma → código no es público.

## 10. Lo que Aura parece hacer especialmente bien

- Separar diseño visual y edición de código.
- Mantener previews aislados en iframes.
- Comunicar editor y preview mediante postMessage.
- Aplicar ediciones pequeñas al DOM en lugar de regenerar siempre todo.
- Validar y reparar código generado.
- Convertir proyectos CRA/Next/Vite a un entorno de preview común.
- Mantener un puente propio para CMS.
- Ejecutar agentes de código mediante streams largos.
- Precompilar artefactos React para publicación.
- Utilizar Supabase como núcleo de autenticación, persistencia, almacenamiento y funciones.

## Lo que no puede confirmarse públicamente

El código fuente privado del backend; los prompts de sistema completos; la lógica exacta de selección de modelos; las políticas RLS de Supabase; el contenido exacto de las Edge Functions; la versión exacta de Sandpack, Motion y Prettier; el sistema interno de despliegue del agente; si cada proyecto React publicado contiene o no un runtime propio completo; los límites, costes y cuotas internas por modelo.

**En resumen:** Aura combina React + Vite + Tailwind + Sandpack/CodeMirror + iframes propios + Supabase + Edge Functions + agentes de código en streaming + múltiples proveedores de IA. Su elemento más distintivo no es solamente el generador de HTML, sino la combinación de edición visual con patches DOM seguros, preview aislado, conversión a React y publicación de artefactos precompilados.
