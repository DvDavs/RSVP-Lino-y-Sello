// packages/ui/src/componentes/index.ts — componentes de este bloque (3C, bloque 2 · F3: estados e
// imagen). F1 (formularios) y F2 (superficies y navegación) tienen el suyo propio con el mismo
// nombre en sus worktrees; el orquestador conserva las tres listas de exports al fusionar.
export { EmptyState, type EmptyStateAccion, type EmptyStateProps } from "./EmptyState.tsx";
export { Skeleton, type SkeletonProps, type VarianteSkeleton } from "./Skeleton.tsx";
export { Image, type ImageProps, type EstadoImagen } from "./Image.tsx";
