// e2e/admin-roles.spec.ts — la tabla ruta × rol de `/admin`, vista desde el PRODUCTO.
//
// La matriz de códigos HTTP ya está medida al nivel del backend, con pruebas Kotlin y `curl`
// (`bitacora/5-E5-A.md §3.2`: MASTER/ADMIN → 200, USER → 403, anónimo → 401 en las seis rutas de
// `/product/admin/**`). Lo que falta, y es lo que mide este archivo, es la experiencia de una
// persona real que abre `/admin` con cada rol: MASTER y ADMIN entran y ven la consola; una USER
// (clienta normal) no ve la consola, y lo que ve en su lugar es el estado honesto que la pantalla
// enseña ante un 403 — nunca una consola vacía, un esqueleto eterno ni cinco tablas rotas
// (`ConsolaAdmin.tsx`, comentario de cabecera); alguien sin sesión ni siquiera llega a intentarlo.
//
// Cada caso crea su PROPIA cuenta con `cuentaNueva()` — nunca la cuenta de demostración compartida
// — y la eleva por SQL cuando hace falta MASTER/ADMIN: el rol vive en `customer.role` y se lee en
// cada petición, no en el JWT, así que el MISMO token sirve después del `UPDATE`
// (`pruebas-producto §3`). Ninguna prueba usa `invitacionSembrada()` ni crea una invitación —el
// caso de rol no necesita una— así que no hay nada que limpiar en un `finally` (ADR-5-E1-03: la
// regla dura es sobre invitaciones y cuentas compartidas, no sobre cada fila de `customer` que deja
// una cuenta de prueba, igual que el resto de los specs que usan `cuentaNueva()`).
import { expect, test } from "@playwright/test";
import { cuentaNueva, sesionDemo, sql } from "./preparar.ts";
import { textosAdmin } from "../lib/admin/textos.ts";

const NOMBRES_PESTANAS = [
  textosAdmin.pestanas.resumen,
  textosAdmin.pestanas.clientas,
  textosAdmin.pestanas.invitaciones,
  textosAdmin.pestanas.pagos,
  textosAdmin.pestanas.plantillas,
];

async function elevar(customerId: number, rol: "MASTER" | "ADMIN"): Promise<void> {
  sql(`UPDATE customer SET role = '${rol}' WHERE id = ${customerId};`);
}

test("MASTER: entra a /admin y ve la consola con sus cinco pestañas", async ({ page }) => {
  const { token, customerId } = await cuentaNueva();
  await elevar(customerId, "MASTER");
  await sesionDemo(page, token);
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: textosAdmin.pagina.titulo, level: 1 })).toBeVisible();
  await expect(page.getByRole("tablist", { name: textosAdmin.pagina.titulo })).toBeVisible();
  for (const nombre of NOMBRES_PESTANAS) {
    await expect(page.getByRole("tab", { name: nombre })).toBeVisible();
  }
  // Nunca el estado de «sin permiso»: un MASTER no es una historia de 403.
  await expect(page.getByRole("heading", { name: textosAdmin.sesion.sinPermiso.titulo })).toHaveCount(0);
});

test("ADMIN: entra a /admin y ve la consola", async ({ page }) => {
  const { token, customerId } = await cuentaNueva();
  await elevar(customerId, "ADMIN");
  await sesionDemo(page, token);
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: textosAdmin.pagina.titulo, level: 1 })).toBeVisible();
  await expect(page.getByRole("tablist", { name: textosAdmin.pagina.titulo })).toBeVisible();
  for (const nombre of NOMBRES_PESTANAS) {
    await expect(page.getByRole("tab", { name: nombre })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: textosAdmin.sesion.sinPermiso.titulo })).toHaveCount(0);
});

test("USER: no ve la consola — un estado honesto ante el 403, no una consola vacía ni un esqueleto eterno", async ({
  page,
}) => {
  const { token } = await cuentaNueva(); // rol USER por defecto, sin elevar por SQL

  await sesionDemo(page, token);
  await page.goto("/admin");

  // La pantalla lo cuenta con todas las letras: título + cuerpo + UNA salida real
  // (`textosAdmin.sesion.sinPermiso`), sustituyendo las pestañas ENTERAS — no un panel vacío
  // disimulado entre tablas que sí «funcionan». Se acota por el título propio del estado (no basta
  // `getByRole("alert")` a secas: Next.js monta su propio anunciador de ruta con el mismo rol).
  const aviso = page.getByRole("alert").filter({ has: page.getByRole("heading", { name: textosAdmin.sesion.sinPermiso.titulo }) });
  await expect(aviso).toBeVisible({ timeout: 15_000 });
  await expect(aviso.getByRole("heading", { name: textosAdmin.sesion.sinPermiso.titulo })).toBeVisible();
  await expect(aviso.getByText(textosAdmin.sesion.sinPermiso.cuerpo)).toBeVisible();
  await expect(aviso.getByRole("link", { name: textosAdmin.sesion.sinPermiso.accion })).toBeVisible();

  // Nunca una consola vacía ni cinco tablas rotas: las pestañas desaparecen del todo, no se quedan
  // ahí mostrando nada.
  await expect(page.getByRole("tablist", { name: textosAdmin.pagina.titulo })).toHaveCount(0);
  for (const nombre of NOMBRES_PESTANAS) {
    await expect(page.getByRole("tab", { name: nombre })).toHaveCount(0);
  }
  // Ni un esqueleto eterno: resuelto el estado, no queda ningún `Skeleton` (role="status") colgado
  // de un panel que ya no está.
  await expect(page.getByRole("status")).toHaveCount(0);
  // Es un 403 con sesión válida, no un 401: la URL se queda en /admin, nunca manda a /acceso.
  await expect(page).toHaveURL(/\/admin$/);
});

test("anónimo: sin sesión, /admin nunca llega a mostrar la consola — manda a /acceso", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/acceso\?volver=%2Fadmin/, { timeout: 10_000 });
  // Ni la consola (con sesión) ni el estado de «sin permiso» (sin sesión no hay ni petición que
  // devuelva 403): la pantalla a la que llega es /acceso, no una versión rota de /admin.
  await expect(page.getByRole("tablist", { name: textosAdmin.pagina.titulo })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: textosAdmin.sesion.sinPermiso.titulo })).toHaveCount(0);
});
