// @invitaciones/migration-legacy — herramienta de migración F1 → paquete de plantilla.
//
// Alcance de ESTE paquete en la fase 4: sólo la parte de PLANTILLAS (F1 → paquete). La migración de
// invitaciones (F3 → `tpl_document`, `05 §5`-`§7`) es de la fase 5 y todavía no está aquí.
//
// Regla dura que gobierna todo el paquete (ADR-1R-C-01): F1 se lee con `JSON.parse` y NUNCA por
// `EditorModels.kt`/`DefaultContentConfig.kt`. Por el modelo Kotlin se pierden 4 rutas de contenido
// visible (H-12) y el paquete las necesita.
export * from "./puntero.ts";
export * from "./hojas.ts";
export * from "./taxonomia.ts";
export * from "./clasificador.ts";
export * from "./plantillas.ts";
export * from "./reglas-visual.ts";
export * from "./reglas-contenido.ts";
export * from "./catalogo.ts";
export * from "./valores.ts";
export * from "./tema.ts";
export * from "./hash.ts";
export * from "./perdidas.ts";
export * from "./f1.ts";
export * from "./construir.ts";
export * from "./escribir.ts";
export * from "./golden.ts";
