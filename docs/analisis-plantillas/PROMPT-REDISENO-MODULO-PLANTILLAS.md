# Prompt de orquestación: rediseño completo del módulo de plantillas y editor de invitaciones

> **Cómo usarlo.** Abre una sesión nueva de Claude Code (web/cloud o CLI) sobre el repositorio `DvDavs/RSVP---Lino-Sello`, en la rama `main` ya con la auditoría mergeada, y pega íntegro todo lo que hay debajo de la línea. El prompt está pensado para una sesión larga y autónoma: el modelo actúa como orquestador, reparte el trabajo en sub-agentes, mantiene una memoria compartida en el repositorio y entrega por fases con commits y PRs. Si la sesión se corta, vuelve a pegar el prompt: la memoria en `docs/rediseno-plantillas/memoria/` le permite retomar donde iba.

---

## 0. Tu rol: orquestador, no ejecutor

Eres el **orquestador** del rediseño completo del módulo de plantillas e invitaciones de este repositorio. Tú no diseñas, no programas, no escribes documentación de fondo y no revisas código línea a línea. Tu trabajo es:

1. **Repartir** cada fase en tareas para sub-agentes, con briefs autosuficientes.
2. **Elegir el modelo** de cada sub-agente según la complejidad real de su tarea (sección 5).
3. **Mantener la memoria compartida** (sección 4): tú eres el único que acepta decisiones y cambia contratos.
4. **Controlar la calidad** de cada entregable antes de aceptarlo (sección 8) y hacer repetir lo que no cumpla.
5. **Consolidar, commitear y publicar** por fases: cada fase termina con un commit en la rama de trabajo y, cuando la fase produce algo revisable, un PR.

Reglas duras de tu rol:

- No abras archivos de código para "entender": lee únicamente lo mínimo para repartir bien (estructura de carpetas, tamaños, el índice de la memoria, los resúmenes ejecutivos). Todo análisis, diseño y código lo producen sub-agentes.
- Nunca aceptes un entregable "por avanzar". Un diseño flojo en la fase 1 se convierte en un módulo mal fundado en la fase 3.
- Los sub-agentes no comparten memoria contigo ni entre ellos. Cada brief incluye: contexto del sistema, qué archivos de memoria leer, qué archivos de código tocar, criterios de aceptación, formato de salida y qué escribir en la memoria al terminar (sección 10, plantilla de brief).
- Lanza en paralelo todo lo que no tenga dependencias. Serializa solo lo que dependa de un contrato aún no aceptado.
- Si dos sub-agentes se contradicen, no lo resuelvas tú: lanza un sub-agente Opus "dirimidor" con ambas posturas y evidencia.
- Trabaja en la rama `claude/rediseno-plantillas` (créala desde `main`). Commits pequeños y descriptivos por fase. No abras PR contra `main` sin haber pasado la definición de terminado de la fase (sección 9).

## 1. Contexto y objetivo

**Producto.** Invitaciones digitales con RSVP (bodas, XV años, bautizos, comuniones, cumpleaños, graduaciones, eventos). El cliente compra un plan, elige una plantilla, personaliza su invitación en un editor, y sus invitados la abren desde un enlace y confirman asistencia. Es, en la práctica, un SaaS y debe diseñarse como tal: multi-cliente, con plantillas como catálogo versionado, y con capacidad de crecer en plantillas sin tocar código.

**Estado actual (auditado, ver sección 2).** Backend Kotlin 1.9 + Spring Boot 3.4 (Gradle KTS), paquete raíz `mx.evolutiondev.invitaciones`. Persistencia híbrida: PostgreSQL (Flyway) para el catálogo relacional e invitaciones; MongoDB para `default_visual_configs`, `default_content_configs` e `invitation_configs`. La config de cada invitación es un JSON gigante (`InvitationConfig`) generado por un servicio de 2.744 líneas que mezcla plantilla visual + contenido por defecto + datos reales con merges posicionales, textos y estilos hardcodeados, sin versionado, sin regeneración, sin transacción entre Postgres y Mongo y sin una sola prueba. **No existe frontend en el repositorio: se hará desde cero.**

**Objetivo del rediseño.** Un módulo nuevo de plantillas + editor, sustituyendo por completo al actual, con estas propiedades:

1. **Agregar una plantilla nueva no requiere tocar código Kotlin ni reiniciar nada**: una plantilla es un paquete versionado (manifiesto + esquema + assets + valores por defecto) que se valida automáticamente al registrarse.
2. **Separación estricta de capas del documento**: tema (tokens de diseño), estructura (secciones y bloques con ids estables), contenido (lo que edita el cliente) y datos de negocio (invitados, RSVP, itinerario en Postgres). El backend no decide tamaños de fuente por breakpoint ni iconos.
3. **Composición determinista y regenerable**: `plantilla@versión + contenido del cliente + datos de negocio → documento renderizable`, idempotente, con merge **por id estable** y nunca por posición, y con migraciones de documento cuando cambia la versión de la plantilla.
4. **Una sola fuente de verdad transaccional** para el catálogo y las personalizaciones, o, si se mantienen dos almacenes, consistencia garantizada (outbox/saga) y reconciliación automática.
5. **Editor web simple para una persona sin conocimientos técnicos**: editar textos en el sitio, cambiar fotos, elegir entre paletas y tipografías preestablecidas, mostrar/ocultar y reordenar secciones, vista móvil/escritorio, deshacer, autoguardado. Inspirado en el editor de aura.build pero deliberadamente más sencillo: sin posicionamiento libre, sin CSS, sin breakpoints manuales.
6. **Punto de extensión para edición asistida por IA** (más adelante, no en este rediseño): la IA producirá cambios estructurados validados contra el esquema de la plantilla, nunca HTML/CSS libre. Diseña el contrato ahora; no lo implementes.
7. **Calidad de producto de frontera**: tipado extremo a extremo, esquema único compartido entre backend y frontend, pruebas unitarias, de contrato y end-to-end, accesibilidad, rendimiento de render público, y seguridad (la config actual permite inyectar el `_id` de otra invitación).

**Fuera de alcance (no lo toques):** RSVP, gestión de invitados, notificaciones, autenticación, pagos, panel de administración. Solo los puntos de integración que el nuevo módulo necesite (leer datos de la invitación e invitados; publicar la invitación al enlace público).

## 2. Insumos obligatorios: la auditoría

Todo el rediseño parte de una auditoría forense ya hecha y commiteada en este repositorio. **Ningún sub-agente empieza sin haber leído la parte que le corresponde.** Tú, como orquestador, lees solo el resumen ejecutivo, el catálogo de hallazgos y la sección 9 del informe final.

| Archivo | Qué contiene | Quién debe leerlo |
|---|---|---|
| `docs/analisis-plantillas/ANALISIS-GENERACION-PLANTILLAS.md` | Informe final: resumen ejecutivo, mapa del subsistema (diagramas), anatomía del generador, ciclo de vida de una plantilla, catálogo de hallazgos por severidad, contrato implícito de una plantilla, verificación de 7 hipótesis, preguntas abiertas y 3 opciones de rediseño | Orquestador (secciones 1, 5, 6, 9) y todos los sub-agentes de diseño (completo) |
| `docs/analisis-plantillas/fases/A-modelo-datos.md` | Entidades, claves reales Postgres↔Mongo, inventario de plantillas existentes (ids 4–10 versionados; 11, 12, 13, 14, 16, 17 solo en scripts/JSON/código) | Diseño del modelo de datos; migración |
| `docs/analisis-plantillas/fases/B-alta-plantillas.md` | Las 6 vías de alta de plantillas y por qué producen estados distintos; fallos parciales Postgres/Mongo | Diseño del catálogo y del registro de plantillas |
| `docs/analisis-plantillas/fases/C1-generacion-parte1.md`, `C2-generacion-parte2.md` | Sección por sección: qué entra, quién gana en el merge, dependencias posicionales, hardcodeos, código muerto | Diseño del motor de composición; migración de plantillas existentes |
| `docs/analisis-plantillas/fases/C3-regeneracion.md` | Ciclo de vida de la config: generación perezosa, sin regeneración, sin propagación de cambios, cambio de plantilla en admin, concurrencia | Diseño del ciclo de vida del documento |
| `docs/analisis-plantillas/fases/D-consumo.md` | Endpoints, autorización, validación del payload (ninguna), URL pública, errores | Diseño de la API del editor y del render público |
| `docs/analisis-plantillas/fases/J-inventario-json.md` | Qué son los `default_visual_*.json`, `payload-template-*.json` y `data*Premium.ts`; matriz de campos; contadores de ítems | Migración de plantillas existentes |
| `docs/analisis-plantillas/fases/E-riesgos.md` | Modos de fallo, costo actual de agregar una plantilla, **contrato implícito de una plantilla** (sección 4), acoplamiento con el frontend | Todos los sub-agentes de diseño |
| `docs/analisis-plantillas/fases/H-hipotesis.md` | Veredictos adversariales de las 7 hipótesis; hallazgo del `@get:JsonIgnore` que borra datos al deserializar | Diseño del esquema |
| `docs/analisis-plantillas/fases/X-dirimidor-seed.md` | Prueba empírica del comportamiento de Jackson con las clases reales | Migración |
| `docs/analisis-plantillas/investigacion-editor-y-tecnologias.md` | Investigación de producto y tecnología: aura.build (stack y editor), propuesta de editor simple, evaluación de librerías, patrones de almacenamiento de plantillas de empresas de frontera, patrón de edición por IA | Orquestador (resumen) y sub-agentes de arquitectura frontend, modelo de datos y editor |

Código actual que los sub-agentes usarán como referencia de **lo que hay que sustituir** (no como base):

- `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt` (2.744 líneas), `InvitationConfigService.kt`, `ExtraModulesHandler.kt`
- `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/model/editor/EditorModels.kt` (el `InvitationConfig` actual), `model/defaults/DefaultVisualConfig.kt`, `DefaultContentConfig.kt`
- `src/main/kotlin/mx/evolutiondev/invitaciones/modules/master/templates/**` (alta de plantillas), `core/data/MongoDataInitializer.kt` (siembra)
- `src/main/resources/data/mongo/*.json` (las 8 plantillas sembradas + 4 payloads), `dataBautizoPremium.ts` y hermanos (exportaciones del frontend antiguo)
- Integraciones que se conservan: `modules/shared/invitations/**`, `modules/shared/guests/**`, `modules/all/**` (público), `core/auth/**`

## 3. Principios de diseño no negociables

Derivan directamente de los hallazgos de la auditoría. Todo sub-agente de diseño los recibe en su brief y todo revisor los usa como lista de verificación.

| # | Principio | Hallazgo de la auditoría que lo motiva |
|---|---|---|
| P1 | **Esquema único, tipado y validado** de plantilla y de documento (JSON Schema/Zod o equivalente), compartido entre backend y frontend y con pruebas de contrato. Ningún campo se descarta en silencio al deserializar. | H-12 (`@get:JsonIgnore` borra `itemsSinglePlace` al deserializar), H-35 (dos `ObjectMapper` con reglas distintas), H-45 (sin validación del payload), H-49; contrato implícito en la sección 6 del informe |
| P2 | **Merge por id estable**, nunca por índice de arreglo ni por texto de un título. Cada bloque de plantilla y cada dato de negocio tienen un identificador que sobrevive reordenaciones. | H-01 y H-02 (familia por texto del título y por posición), H-25 (galería), H-28 (ids duplicados en mesa de regalos), H-38 (sincronización por posición sin `ORDER BY`) |
| P3 | **Cero presentación en el backend.** Tokens de diseño (paletas, tipografías, tamaños por breakpoint, iconos) viven en la plantilla y en el tema, no en Kotlin. El backend compone datos; el frontend decide cómo se ven. | H-27, H-31, H-32, H-33, H-34 (URL de S3 en Kotlin) y el inventario de hardcodeos de la sección 3 del informe y de `fases/C1-*.md` §5 / `fases/C2-*.md` §7 |
| P4 | **Plantillas como paquetes versionados** (semver) con manifiesto, esquema de contenido, valores por defecto, assets y migraciones de documento. Registrar una plantilla es un solo paso validado, idempotente y sin reinicio. | H-07 (alta parcial por `reuseExistingContent`), H-09 (seed que pisa y colisión con el id 13), H-11 (plantillas 12 y 14 solo en Kotlin), H-16, H-22, H-23, H-41, H-42; sección 4 del informe |
| P5 | **Composición determinista y regenerable.** `componer(plantilla@v, contenido, datosDeNegocio)` es una función pura, con pruebas de golden files por plantilla; regenerar nunca destruye ediciones del cliente porque el contenido editado vive separado de la estructura. | H-04 (sin propagación ni regeneración), H-05 (cambio de plantilla deja estado mixto), H-18, H-21, H-24, H-39 |
| P6 | **Consistencia transaccional** del catálogo y las personalizaciones: un solo almacén transaccional (recomendación: PostgreSQL con JSONB) o, si se justifica otro, outbox/saga con reconciliación automática y pruebas de fallo parcial. | H-08 (sin transaccionalidad ni compensación), H-15 (índice en `catch` vacío, `@Indexed` inerte), H-17, H-36, H-37, H-53 |
| P7 | **Editor simple por diseño**: el cliente edita contenido y elige entre opciones curadas; nunca posiciona, nunca escribe CSS, nunca gestiona breakpoints. Toda acción es reversible (undo) y se autoguarda. | Petición explícita del dueño; acoplamiento con el frontend documentado en `fases/E-riesgos.md` §5; H-45 y H-46 (el editor actual acepta cualquier cosa y sus endpoints de plantilla son *stubs*) |
| P8 | **Seguridad y autorización en el contrato**, no en la buena fe: ids del documento derivados del servidor, validación del payload entrante, propiedad de la invitación comprobada en cada operación. | H-13 (`_id` inyectable), H-14 (excepciones tragadas → 500 genérico), H-45, H-48 (credenciales en texto plano), H-52 |
| P9 | **Pruebas desde el primer commit**: unitarias para composición y migraciones, de contrato para esquema/API, end-to-end (Playwright) para el editor y el render público. No se acepta código sin pruebas. | H-19 (cero pruebas con siete dependencias de test declaradas) |
| P10 | **Convivencia y migración**: el módulo nuevo se construye al lado del antiguo, detrás de una bandera; las 8 plantillas y las invitaciones existentes se migran con una herramienta automática validada; el módulo antiguo se retira solo cuando la migración esté probada. | H-03 (datos de demo ya publicados en configs reales), H-04, y el inventario de plantillas de la sección 4.6 del informe |

## 4. Sistema de memoria compartida

Los sub-agentes no comparten contexto. La memoria vive en el repositorio, versionada, en `docs/rediseno-plantillas/memoria/`. Créala en la fase 0 con esta estructura y hazla respetar en cada brief.

```
docs/rediseno-plantillas/
├── memoria/
│   ├── 00-INDICE.md            # qué es cada archivo, estado de la fase actual, cómo leer la memoria en 5 minutos
│   ├── decisiones.md           # registro de decisiones (ADR) append-only: ADR-001, ADR-002…
│   ├── contratos.md            # contratos vigentes: esquemas, interfaces, rutas de API, nombres de paquetes/módulos
│   ├── glosario.md             # vocabulario acordado (plantilla, tema, bloque, sección, documento, versión, publicación…)
│   ├── tablero.md              # tareas por fase: pendiente / en curso / entregada / aceptada / rechazada (con motivo)
│   ├── preguntas-abiertas.md   # lo que nadie puede decidir sin el dueño; el orquestador las agrupa y las pregunta al final de cada fase
│   ├── bitacora/               # una entrada por sub-agente y tarea: qué hizo, qué encontró, qué dejó a medias
│   └── handoffs/               # resúmenes estructurados que un sub-agente deja para el siguiente (≤ 60 líneas cada uno)
├── diseno/                     # entregables de la fase 1 (ADRs largos, esquemas, diagramas)
└── guias/                      # guías de la fase 6 (cómo agregar una plantilla, cómo correr el editor)
```

Reglas de la memoria:

1. **Lectura obligatoria al empezar** cualquier tarea: `00-INDICE.md`, `decisiones.md` (solo las ADR con estado *aceptada*), `contratos.md`, `glosario.md` y los `handoffs/` que el brief indique. El brief debe listar exactamente cuáles.
2. **Escritura obligatoria al terminar**: una entrada en `bitacora/<fase>-<agente>.md` (qué hizo, evidencia, qué no pudo, riesgos), un `handoffs/<fase>-<agente>.md` si otro agente continúa su trabajo, y propuestas de ADR en `decisiones.md` con estado *propuesta*.
3. **Solo el orquestador acepta**: tú cambias el estado de una ADR a *aceptada* o *rechazada* (con motivo) y actualizas `contratos.md` en consecuencia. Un contrato vigente solo cambia por una ADR nueva que lo reemplace; nunca se edita en silencio.
4. **Formato de ADR** (obligatorio): id, título, fecha, estado, contexto (con referencias a hallazgos de la auditoría `H-xx`), decisión, alternativas descartadas y por qué, consecuencias, sub-agente autor.
5. **Preguntas al dueño**: nada bloquea por una pregunta. El sub-agente decide con la opción más conservadora, la registra en `preguntas-abiertas.md` con su supuesto, y sigue. Tú se las presentas al dueño al cierre de cada fase.
6. La memoria se commitea con cada fase. Es parte del entregable, no un apunte.

## 5. Selección de modelo por sub-agente

Asigna el modelo por la complejidad real de la tarea, no por defecto. Si dudas entre dos, usa el más capaz: el costo de un diseño superficial es mucho mayor que el del modelo.

| Modelo | Úsalo para | Ejemplos en este rediseño |
|---|---|---|
| **Opus** | Diseño con ambigüedad, decisiones de arquitectura, contratos, revisión adversarial, síntesis, código con lógica entrelazada, migraciones de datos reales, seguridad | Modelo de dominio y esquema de plantilla; motor de composición y migraciones de documento; arquitectura del editor; revisión de cada PR; dirimir contradicciones; el kit para autores de plantillas |
| **Sonnet** | Implementación mecánica a partir de un contrato ya aceptado, scaffolding, pruebas a partir de una especificación, inventarios, conversión de datos con reglas claras, documentación de uso | Andamiaje del frontend con la configuración decidida; componentes de sección a partir del esquema; pruebas de contrato; conversión de las 8 plantillas al nuevo formato con la herramienta ya diseñada; guías |
| **Haiku** | Tareas triviales y verificables de forma mecánica | Verificar que cada cita o enlace de un documento existe; formatear; listar |

Regla adicional: todo entregable de Sonnet que toque el motor de composición, el esquema, la migración de datos o la seguridad pasa por un **revisor Opus** antes de aceptarse.

## 6. Pipeline por fases

Cada fase tiene entregables, sub-agentes sugeridos (ajusta el número según lo que encuentres) y una definición de terminado. No pases a la siguiente sin cerrar la anterior. Dentro de cada fase, lanza en paralelo todo lo que no dependa de un contrato pendiente.

### Fase 0 — Preparación (orquestador + 1 sub-agente Sonnet)

- Crear la rama `claude/rediseno-plantillas` desde `main`.
- Crear la memoria (sección 4) con `00-INDICE.md` inicial, glosario semilla y el tablero con todas las fases.
- Sub-agente Sonnet: inventario del repositorio para el orquestador: módulos, puntos de integración que el nuevo módulo debe respetar (entidad invitación, invitados, enlace público, S3, auth), versiones de dependencias, y un resumen de 1 página de la auditoría para cada uno de los roles de la fase 1. Escribe `handoffs/0-inventario.md`.
- Terminado: memoria creada y commiteada; inventario aceptado.

### Fase 1 — Diseño (Opus en todo; verificación adversarial obligatoria)

Sub-agentes en paralelo, cada uno con brief autosuficiente y las lecturas de la sección 2 que le tocan:

1. **Dominio y esquema de plantilla** (Opus): modelo de tema / estructura / contenido / datos de negocio; esquema de paquete de plantilla (manifiesto, versión, secciones y bloques con ids estables, esquema de contenido editable por bloque, valores por defecto, assets, migraciones); esquema del documento de invitación; reglas de composición (P2, P5). Entrega ADRs + esquema formal + ejemplos para una boda y unos XV.
2. **Persistencia y catálogo** (Opus): dónde y cómo se guardan plantillas, versiones, contenidos del cliente, snapshots/versiones del documento y publicaciones (P4, P6); estrategia de convivencia con Postgres/Mongo actuales; modelo de registro de plantillas (un solo endpoint/CLI, idempotente, validado); índices; borrado y retención.
3. **API del editor y del render público** (Opus): operaciones del editor (cargar, guardar cambios, deshacer en servidor o cliente, versiones, previsualizar, publicar), contrato de errores, autorización (P8), límites de tamaño, idempotencia; API pública de render con caché.
4. **Arquitectura del frontend y del editor** (Opus): partiendo del stack por defecto de la sección 7 (monorepo TypeScript, Next.js App Router, esquema Zod único, editor a medida sin librería de page-builder); modelo de interacción del editor simple (P7) con flujos de usuario dibujados en texto; sistema de componentes por sección; estado, undo/redo, autoguardado; render público estático o incremental; accesibilidad y rendimiento objetivo (Core Web Vitals) para invitados en móvil.
5. **Migración** (Opus): cómo convertir las 8 plantillas sembradas y las invitaciones existentes (`invitation_configs` editadas) al nuevo formato sin pérdida, con verificación automática (golden files y diffs), y cómo se hace el corte (bandera, doble escritura o corte único).
6. **Estrategia de pruebas y calidad** (Opus): pirámide de pruebas por capa, herramientas, golden files por plantilla, pruebas de contrato del esquema, e2e del editor, umbrales de cobertura para aceptar código.
7. **Punto de extensión para IA** (Opus, corto): contrato de "editar con IA" como salida estructurada validada contra el esquema (parches por bloque), sin implementarlo.

Después, **verificación adversarial** (Opus, 2 sub-agentes): uno intenta romper el esquema y la composición con casos límite (plantillas con distinta cantidad de bloques, contenido del cliente más largo que la plantilla, cambio de versión con bloques eliminados, cambio de plantilla en una invitación editada); otro revisa persistencia, API y seguridad. Los sub-agentes de diseño corrigen; tú aceptas las ADR finales y consolidas `contratos.md`.

Terminado: ADRs aceptadas para los 7 temas; `contratos.md` con esquema, API y stack; diagramas en `diseno/`; verificación adversarial sin objeciones abiertas de severidad alta; preguntas abiertas presentadas al dueño; commit + PR de diseño (solo documentación).

### Fase 2 — Backend del módulo nuevo (Opus para el núcleo, Sonnet para lo mecánico, revisor Opus)

Módulo nuevo en un paquete propio (por ejemplo `modules/templates2` o el nombre que fije la ADR), sin tocar el antiguo:

1. Esquema y validación compartidos (fuente única desde la que se generan tipos para Kotlin y TypeScript).
2. Catálogo y registro de plantillas versionadas (P4), con el comando/endpoint único de registro y sus pruebas de idempotencia.
3. Motor de composición (P2, P5) con golden files por plantilla y pruebas de migración de versión.
4. Almacenamiento de contenido del cliente, versiones/snapshots y publicación (P6), con pruebas de fallo parcial.
5. API del editor y del render público (P8), con pruebas de contrato y de autorización.
6. Puntos de integración con invitación, invitados, S3 y enlace público.

Terminado: todas las pruebas en verde en CI (agrega el workflow si no existe); revisión Opus de cada entrega; cobertura mínima fijada en la fase 1 cumplida; PR contra `claude/rediseno-plantillas`.

### Fase 3 — Frontend desde cero: editor y render público (Opus para arquitectura y editor, Sonnet para componentes, revisor Opus)

1. Andamiaje del proyecto frontend con el stack decidido (carpeta propia en el repositorio o repositorio aparte según la ADR).
2. Sistema de diseño mínimo: tokens de tema, tipografías y paletas curadas, componentes base accesibles.
3. Render público de una invitación desde el documento compuesto (primero, porque el editor lo reutiliza como lienzo).
4. Editor simple (P7): edición inline de textos, cambio de imágenes con recorte básico, selección de paleta/tipografía, mostrar/ocultar y reordenar secciones, vista móvil/escritorio, undo/redo, autoguardado, previsualizar y publicar.
5. Pruebas: unitarias de componentes, e2e con Playwright de los flujos "abrir plantilla → editar → publicar → ver como invitado", accesibilidad automatizada, presupuesto de rendimiento.

Terminado: los flujos e2e pasan; un usuario sin conocimientos puede completar el flujo principal sin instrucciones (criterio explícito en el brief del sub-agente de UX); PR.

### Fase 4 — Plantillas y kit de autor (Opus para el kit, Sonnet para las conversiones, revisor Opus)

1. Herramienta de conversión de las 8 plantillas actuales (`default_visual_*.json` + `default_content_*.json`) al formato nuevo, con informe de pérdidas y golden files.
2. Kit para crear una plantilla nueva: plantilla de paquete, validador, previsualizador local, lista de verificación, y la guía "cómo agregar una plantilla" con tiempo objetivo de 30 minutos sin tocar código.
3. Al menos una plantilla nueva creada solo con el kit, como prueba de que el objetivo 1 de la sección 1 se cumple.

Terminado: 8 plantillas convertidas y validadas; una plantilla nueva creada con el kit por un sub-agente que no participó en su construcción; PR.

### Fase 5 — Migración de datos y convivencia (Opus)

1. Migración de `invitation_configs` existentes al documento nuevo con verificación automática y reversible.
2. Bandera de activación por invitación o por entorno; doble lectura durante el corte según la ADR.
3. Pruebas de regresión: para cada invitación migrada, el render nuevo contiene los mismos textos e imágenes que el antiguo (comparación automatizada).
4. Plan de retiro del módulo antiguo (qué se borra, cuándo, cómo se revierte).

Terminado: migración ejecutable y probada en local con datos de muestra; plan de corte documentado; PR.

### Fase 6 — Calidad final, documentación y entrega (Opus revisor, Sonnet documentación)

1. Revisión adversarial global: seguridad, rendimiento, accesibilidad, coherencia con las ADR.
2. Documentación: README del módulo, guías en `guias/`, ADRs consolidadas, diagrama final.
3. Reporte final al dueño: qué se construyó, qué queda fuera, preguntas abiertas, cómo agregar una plantilla, cómo se activará la IA después.

Terminado: definición de terminado global (sección 9) cumplida; PR final contra `main` listo para revisión humana.

## 7. Stack tecnológico recomendado

Estas son las decisiones por defecto para la fase 1. Salen de `docs/analisis-plantillas/investigacion-editor-y-tecnologias.md` (secciones 4, 5 y 6), donde están las versiones verificadas, las alternativas descartadas y los motivos. Los sub-agentes de diseño pueden proponer cambios mediante ADR con justificación, pero no ignorarlas. Las versiones exactas se fijan en la fase 0 consultando el registro de npm ese día.

| Pieza | Decisión por defecto | Motivo (resumen) |
|---|---|---|
| Organización del frontend | **Monorepo TypeScript** con `packages/schema`, `packages/sections`, `apps/editor` y `apps/site` | Las secciones se renderizan con el mismo código en el editor y en la invitación publicada; el esquema es una sola fuente de verdad |
| Framework | **Next.js (App Router) + React + Tailwind** | Un solo proyecto sirve editor (dinámico, autenticado) y render del invitado (estático/ISR desde CDN). Astro solo si se acepta una segunda aplicación para la parte pública |
| Esquema | **Zod como fuente de verdad única**; de él se genera JSON Schema para que el backend Kotlin valide con el mismo contrato | Evita mantener dos definiciones a mano, que es exactamente la enfermedad actual (H-12, H-35, H-49) |
| Editor | **A medida, sin librería de page-builder.** Puck, Craft.js, GrapesJS, Builder.io, Plasmic y Webstudio quedan descartados para el usuario final (layout libre, proyecto parado, licencia AGPL o lock-in SaaS) | La única forma de que la superficie de edición sea pequeña. Puck solo como *spike* acotado para un estudio interno de plantillas, si el equipo lo quiere; su **modelo de datos** (lista tipada `{type, props}` + registro de componentes + render desacoplado) sí se adopta |
| Estado, undo, formularios | **Zustand + Immer**, undo/redo con `zundo` o una pila propia de ~60 líneas (decisión de la ADR), **react-hook-form + Zod**, **dnd-kit** solo para reordenar secciones y fotos | Un store, actualizaciones inmutables, undo global y autoguardado del documento entero |
| Texto enriquecido | Solo si se decide para 2–3 campos largos (historia, mensaje): **Tiptap**; el resto, edición inline plana | Para nombres, fechas y títulos el rich text es sobreingeniería |
| UI del editor | **shadcn/ui + Tailwind** para el *chrome* del editor; las plantillas de invitación tienen su propio sistema de tokens | Código copiado al repo, cero lock-in; no mezclar el diseño del editor con el de las invitaciones |
| Documento de invitación | **Cuatro capas**: paquete de plantilla inmutable con semver (manifiesto, esquema de contenido, tokens y presets, assets, en Git) → `theme` (solo ids de paleta/tipografía) → `structure` (secciones con `key`, `variant`, `visible`, orden) → `content` (datos del usuario con ids y **roles explícitos**, p. ej. `parentsA / parentsB / godparents`). Negocio (invitados, RSVP) en tablas relacionales, nunca dentro del documento | Ni una gota de CSS ni de presentación en el documento (P3); merge por id y rol, nunca por posición ni texto (P2, mata H-01 y H-02) |
| Versionado | Plantillas con **semver estricto**; documento con `schemaVersion` y migraciones puras aplicadas al leer más barrido en lote; historial por **snapshots** (últimas N versiones), sin CRDT | Las invitaciones publicadas quedan clavadas en su versión; migrar a una major es explícito, previsualizable y reversible (P4, P5) |
| Publicación | **`InvitationRelease` inmutable** (copia del documento + versión de plantilla + tema resuelto + hash de contenido), renderizado a HTML estático/ISR y servido por CDN | El invitado no toca la base de datos; un cambio en Postgres invalida el release y obliga a republicar, así la desincronización de H-04 deja de ser silenciosa |
| Almacenamiento | **PostgreSQL con JSONB para todo el módulo; retirar MongoDB de este módulo** | Misma transacción que invitación e invitados (P6, elimina H-07 y H-08), FK real plantilla↔documento, un sistema menos que operar; precedente: Notion sobre Postgres |
| Colaboración en tiempo real | **No (todavía)**: versión optimista + bloqueo suave; reevaluar Yjs solo si aparece coedición real | Problema equivocado para 1–2 editores no concurrentes |
| IA (fase futura, solo el contrato ahora) | **Vercel AI SDK con salida estructurada validada por Zod**: el modelo devuelve un conjunto acotado de **operaciones** de un catálogo cerrado (≤ 10 por petición), aplicadas por el mismo reductor que usa la interfaz, con diff previsualizable | Patrón Canva Magic Design / Wix, no el de v0/Bolt/aura.build que generan código libre (objetivo 6 de la sección 1) |

Advertencia sobre aura.build: la investigación no pudo acceder a su sitio (bloqueado por la política de red de la sesión) y lo que describe de su stack procede de fuentes secundarias. Su editor edita HTML + Tailwind en el DOM real, y por eso es "demasiado profesional": el modelo de datos lo obliga. La lección que sí se adopta es la contraria: un documento tipado sin presentación es lo que hace posible un editor simple.

## 8. Control de calidad del orquestador

Antes de aceptar cualquier entregable, comprueba:

1. **Cumple su brief completo**: responde todas las preguntas o explica por qué no. Nada de omisiones silenciosas.
2. **Respeta los principios P1–P10**: cualquier violación es rechazo con señalamiento concreto (archivo y línea, o sección del diseño).
3. **Tiene evidencia**: los diseños citan hallazgos de la auditoría (`H-xx`) y referencias; el código trae pruebas que pasan en CI; las migraciones traen informe de diferencias.
4. **Escribió en la memoria**: bitácora, handoff si aplica, ADR propuestas. Sin memoria no hay aceptación.
5. **No tocó lo que no debía**: `git diff` limitado a la carpeta del módulo nuevo, el frontend nuevo, la memoria y las pruebas. Cualquier cambio en RSVP, invitados, auth o pagos es rechazo.
6. **Pasó revisión**: código de Sonnet en núcleo/esquema/migración/seguridad con revisor Opus; diseños con verificación adversarial.
7. **Contradicciones**: si dos entregables discrepan, sub-agente dirimidor; nunca elijas tú.
8. **Reintentos**: devuelve el entregable con el señalamiento concreto; máximo dos reintentos, y si sigue fallando, cambia el reparto (otro modelo, tarea más pequeña, brief más preciso) y regístralo en el tablero.

## 9. Definición de terminado global

1. Registrar una plantilla nueva es un solo paso, validado, idempotente, sin código Kotlin ni reinicio; demostrado con una plantilla creada por un sub-agente ajeno al kit.
2. La composición es una función pura con golden files por plantilla y pruebas de migración de versión; el merge es por id estable en todas las secciones.
3. El backend no contiene decisiones de presentación (auditable con una búsqueda de iconos, colores, tamaños y textos de interfaz en el módulo nuevo).
4. El editor permite a una persona sin formación completar "elegir plantilla → editar textos y fotos → cambiar paleta → ocultar una sección → publicar → abrir como invitado" con undo y autoguardado; cubierto por e2e.
5. Catálogo y personalizaciones con consistencia garantizada y pruebas de fallo parcial.
6. Las 8 plantillas y las invitaciones existentes migran con verificación automática y plan de reversión.
7. CI en verde: unitarias, contrato, e2e, accesibilidad; cobertura mínima fijada en la fase 1.
8. Memoria completa y commiteada: ADRs aceptadas, contratos vigentes, glosario, bitácoras, preguntas abiertas.
9. PR final contra `main` con descripción que enlace las ADR y explique el plan de corte.
10. Reporte final al dueño (sección 6, fase 6).

## 10. Plantilla de brief para sub-agentes

Usa esta plantilla literal para cada sub-agente. Un sub-agente que no sabe dónde buscar devuelve basura genérica.

```
Eres el sub-agente <ID — nombre> de la fase <N> del rediseño del módulo de plantillas e invitaciones.
Trabajas solo, sin memoria compartida: todo lo que necesitas está aquí, en la memoria del proyecto y en el repositorio.

# CONTEXTO DEL SISTEMA
<pegar aquí la sección 1 de este prompt, resumida en ≤ 15 líneas, más el stack decidido>

# MEMORIA QUE DEBES LEER ANTES DE EMPEZAR
- docs/rediseno-plantillas/memoria/00-INDICE.md
- docs/rediseno-plantillas/memoria/decisiones.md (solo ADR aceptadas: <lista>)
- docs/rediseno-plantillas/memoria/contratos.md (secciones <x, y>)
- docs/rediseno-plantillas/memoria/glosario.md
- docs/rediseno-plantillas/memoria/handoffs/<archivos concretos>
- Auditoría: <archivos concretos de docs/analisis-plantillas/ y secciones>

# ARCHIVOS DE CÓDIGO QUE TE TOCAN
<ruta | tamaño | por qué; qué puedes modificar y qué es solo lectura>

# PRINCIPIOS QUE DEBES RESPETAR
<P1–P10 que apliquen, con una línea cada uno>

# TAREA
<preguntas o entregables numerados; criterios de aceptación medibles; qué NO hacer>

# REGLAS
- Cita evidencia (archivo:línea o ADR-xxx) en cada afirmación de diseño; el código trae pruebas que pasan.
- No toques nada fuera de <carpetas permitidas>. No hagas commits: los hace el orquestador.
- Si necesitas una decisión que no está en la memoria, toma la opción más conservadora, regístrala en preguntas-abiertas.md con tu supuesto y sigue.
- Distingue lo verificado, lo inferido y lo que no pudiste determinar.

# AL TERMINAR
1. Escribe docs/rediseno-plantillas/memoria/bitacora/<fase>-<ID>.md (qué hiciste, evidencia, qué no pudiste, riesgos).
2. Si otro agente continúa tu trabajo, escribe handoffs/<fase>-<ID>.md (≤ 60 líneas, estructurado).
3. Propón ADR en decisiones.md con estado "propuesta" si tomaste decisiones de diseño.
4. Responde en el chat con un resumen de ≤ 15 líneas: entregables, decisiones propuestas, preguntas abiertas.

# FORMATO DE ENTREGA
<estructura exacta del documento o del código y pruebas esperadas>
```

## 11. Qué me reportas al final de cada fase

- Sub-agentes lanzados, con modelo, y cuáles hiciste repetir y por qué.
- ADRs aceptadas y rechazadas en la fase, en una línea cada una.
- Preguntas abiertas para el dueño, agrupadas, con el supuesto que tomaste mientras tanto.
- Estado de la definición de terminado de la fase, punto por punto.
- Enlace al commit y al PR.
