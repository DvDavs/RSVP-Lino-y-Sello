// src/perdidas.ts — el informe de pérdidas (`T3`): tres cubetas, cada entrada con su puntero, su `id`
// legado, su valor, su clasificación y SU MOTIVO ESCRITO.
//
//   aceptada    presentación que P3 manda tirar (colores, tamaños, iconos, `fontFamily`)
//   a revisar   contenido cuyo destino es discutible o cuyo valor no es representable todavía
//   bloqueante  contenido VISIBLE sin destino en el catálogo cerrado
//
// Una entrada `bloqueante` hace fallar la construcción. Las `aceptada` se agregan por regla y patrón
// (son ~3 600 hojas por plantilla y listarlas una a una haría el informe ilegible); el detalle hoja a
// hoja de TODAS las clases está en `cobertura.json`, que es el que prueba el gate de P1.

export type Cubeta = "aceptada" | "a revisar" | "bloqueante";

export interface EntradaPerdida {
  readonly cubeta: Cubeta;
  readonly legacyPointer: string;
  readonly legacyId: string | null;
  readonly valor: unknown;
  readonly clasificacion: string;
  readonly reglaId: string;
  readonly motivo: string;
  readonly evidencia: string;
  /** Presente cuando la pérdida la produce el constructor y no la tabla (colisión, valor no convertible). */
  readonly detalle?: string;
  /** Presente en las `bloqueante` que una decisión de producto puede desbloquear. */
  readonly decision?: { readonly id: string; readonly opciones: readonly string[] };
}

export interface EntradaAgregada {
  readonly reglaId: string;
  readonly patron: string;
  readonly clasificacion: string;
  readonly motivo: string;
  readonly evidencia: string;
  readonly hojas: number;
  readonly ejemplos: readonly { readonly legacyPointer: string; readonly legacyId: string | null; readonly valor: unknown }[];
}

export interface InformePerdidas {
  readonly plantilla: { readonly templateId: number; readonly slug: string; readonly version: string; readonly nombre: string; readonly cohorte: string };
  readonly fuentes: readonly string[];
  readonly generadoPor: string;
  readonly resumen: {
    readonly hojasTotales: number;
    readonly mapeadas: number;
    readonly presentacion: number;
    readonly descartadas: number;
    readonly patronesSinMapear: number;
    readonly aceptadas: number;
    readonly aRevisar: number;
    readonly bloqueantes: number;
  };
  /** El criterio HUMANO de la paleta y las tipografías (`theme.json` no admite comentarios). */
  readonly criterioDelTema: string;
  readonly contrasteMedido: readonly { readonly pareja: string; readonly ratio: number; readonly umbral: number }[];
  readonly correccionesDeColor: readonly string[];
  readonly aceptada: readonly EntradaAgregada[];
  readonly aRevisar: readonly EntradaPerdida[];
  readonly bloqueante: readonly EntradaPerdida[];
  /** Decisiones de producto pendientes por plantilla, con las opciones que las desbloquean. */
  readonly decisionesPendientes: readonly { readonly id: string; readonly opciones: readonly string[]; readonly hojas: number }[];
  /** Trazabilidad `id` legado → `itemId` nuevo. NUNCA se reusa el legado (ADR-1R-C-02). */
  readonly trazaDeItems: readonly { readonly grupo: string; readonly indiceLegado: string; readonly legacyIds: readonly string[]; readonly itemId: string }[];
}

export class ErrorBloqueante extends Error {
  constructor(public readonly entradas: readonly EntradaPerdida[]) {
    super(
      `La construcción NO produce paquete: ${entradas.length} entrada(s) BLOQUEANTE(S) — contenido visible sin destino (P1).\n` +
      entradas.map((e) => `  ${e.legacyPointer} = ${JSON.stringify(e.valor)}\n    ${e.motivo}` +
        (e.decision ? `\n    se desbloquea con --decision ${e.decision.id}=${e.decision.opciones.join("|")}` : "")).join("\n"),
    );
    this.name = "ErrorBloqueante";
  }
}
