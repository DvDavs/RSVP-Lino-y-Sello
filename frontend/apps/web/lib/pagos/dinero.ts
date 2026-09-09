// lib/pagos/dinero.ts — formatea un importe que YA decidió el backend. Nunca calcula un precio
// (contrato §0: «El precio lo fija el servidor»); esta función solo convierte centavos en el texto
// que se lee.
export function formatearImporte(centavos: number, moneda: string): string {
  const importe = centavos / 100;
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda }).format(importe);
}
