# Bitácora — 1-pruebas + 1-ia (fase 1)

## Qué hice
`diseno/06-pruebas-y-calidad.md`: pirámide de pruebas por capa con herramienta y ubicación exacta, umbrales de cobertura por ámbito (85% núcleo de composición/migración, 80% módulo completo, 100% esquemas con caso positivo+negativo), formato exacto de golden files (reutiliza la carpeta de `diseno/ejemplos/`), tabla de casos JSON compartida para las 21 invariantes (Kotlin+TS, mata H-35), script de Postgres local sin Docker (`pg_ctl`/`initdb`, verificado que el entorno lo permite), y el diseño (no implementación) del workflow de GitHub Actions de 3 jobs. Registré ADR-024…026.

`diseno/07-extension-ia.md`: contrato `EditProposal` (mismo catálogo `Operation` que el editor humano), pipeline de 6 pasos (validar→dry-run→aplicar→reparar→descartar-y-continuar→diff), reglas de seguridad heredadas de `03-api.md`/ADR-015, alcance recomendado (prosa sí, maquetar no). Registré ADR-027. Documento corto por instrucción del brief.

## Evidencia
`handoffs/0-resumen-auditoria-pruebas.md` (H-19 central), `contratos.md` §7 (entorno verificado: sin Docker, Postgres 16 local, JDK 21, sin CI); `handoffs/0-resumen-auditoria-ia.md` y `handoffs/1-aura-lecciones.md` (lecciones 1, 5, 7).

## Qué no pude hacer / limitaciones
No ejecuté ningún test real (no hay `src/test` ni `frontend/` todavía — es diseño puro de fase 1, como pide el prompt maestro). No verifiqué si el runner de GitHub Actions de este repo tiene Docker (afectaría solo la alternativa condicional de §6, no el camino primario).

## Archivos tocados
`diseno/06-pruebas-y-calidad.md`, `diseno/07-extension-ia.md`, `memoria/decisiones.md` (ADR-024…027), este archivo.
