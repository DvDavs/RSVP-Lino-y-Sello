import { expect, test } from "@playwright/test";

// e2e/publico-no-disponible.spec.ts — E-01 recortado al alcance de 3-1 (andamiaje): un `publicToken`
// inexistente responde `404 TPL_RELEASE_NOT_FOUND` (03 §3.15) SIN backend simulado (06 §8.2.4: cero
// mocks de la API en e2e) y la ruta pública pinta el estado real de `not-found.tsx`. El flujo
// completo (E2E-01 de `06 §8.1`: elegir plantilla → editar → publicar → abrir `/i/{token}`) lo
// escribe el bloque 3-3/3-4, que sí tiene documento y release que publicar.
test("publicToken inexistente muestra el estado de no disponible, sin trampas de foco", async ({ page }) => {
  await page.goto(`/i/token-que-no-existe-${Date.now()}`);
  await expect(page.getByRole("heading", { name: "Esta invitación ya no está disponible" })).toBeVisible();
});
