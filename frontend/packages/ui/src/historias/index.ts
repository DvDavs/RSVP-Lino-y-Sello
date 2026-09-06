// packages/ui/src/historias/index.ts — entrada del subpath `@invitaciones/ui/historias`.
//
// SOLO se importa desde componentes de CLIENTE (ver el porqué en `registro.ts`): trae el registro
// completo, con sus `render()` reales — incluidas las historias `"use client"` que otro bloque
// registre. Un Server Component que solo necesite listar/enrutar componentes usa `metadatos` desde
// la raíz del paquete (`@invitaciones/ui`), no este subpath.
export type { FamiliaHistoria, Historia, Variante } from "./tipos.ts";
export { registro, historiaPorSlug } from "./registro.ts";
export { metadatos, type MetadatoHistoria } from "./metadatos.ts";
