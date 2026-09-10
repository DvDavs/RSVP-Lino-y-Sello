// e2e/admin-consola.spec.ts — que la consola de `/admin` hace su trabajo, con sesión MASTER y sobre
// datos creados por la PROPIA prueba (ADR-5-E1-03: nunca `invitacionSembrada()`, cada spec crea su
// invitación y su cuenta si hace falta, limpieza en `finally`). La tabla ruta × rol vista desde el
// producto vive en `admin-roles.spec.ts`; este archivo mide el contenido, no la puerta.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";
import { API_BASE, borrarInvitacion, cuentaNueva, invitacionConDocumento, sesionDemo, sql } from "./preparar.ts";
import { textosAdmin } from "../lib/admin/textos.ts";

const NOMBRES_PESTANAS = [
  textosAdmin.pestanas.resumen,
  textosAdmin.pestanas.clientas,
  textosAdmin.pestanas.invitaciones,
  textosAdmin.pestanas.pagos,
  textosAdmin.pestanas.plantillas,
];

async function cuentaMaster(): Promise<{ token: string; customerId: number; email: string }> {
  const cuenta = await cuentaNueva();
  sql(`UPDATE customer SET role = 'MASTER' WHERE id = ${cuenta.customerId};`);
  return cuenta;
}

/**
 * Las cinco pestañas viven SIEMPRE en el DOM (`forceMount`, `ConsolaAdmin.tsx`), así que
 * `page.getByRole("tabpanel")` a secas resuelve a las CINCO a la vez — hay que acotar por el
 * nombre accesible (el mismo texto que su pestaña, por `aria-labelledby`) para operar sobre UNA.
 */
function panelDe(page: Page, pestana: string) {
  return page.getByRole("tabpanel", { name: pestana });
}

test("las cinco pestañas se abren y cada una enseña su contenido", async ({ page }) => {
  const { token } = await cuentaMaster();
  await sesionDemo(page, token);
  await page.goto("/admin");

  await expect(page.getByRole("tablist", { name: textosAdmin.pagina.titulo })).toBeVisible();

  const secciones: Array<{ pestana: string; titulo: string }> = [
    { pestana: textosAdmin.pestanas.resumen, titulo: textosAdmin.resumen.titulo },
    { pestana: textosAdmin.pestanas.clientas, titulo: textosAdmin.clientas.titulo },
    { pestana: textosAdmin.pestanas.invitaciones, titulo: textosAdmin.invitaciones.titulo },
    { pestana: textosAdmin.pestanas.pagos, titulo: textosAdmin.pagos.titulo },
    { pestana: textosAdmin.pestanas.plantillas, titulo: textosAdmin.plantillas.titulo },
  ];

  for (const { pestana, titulo } of secciones) {
    await page.getByRole("tab", { name: pestana }).click();
    const panel = panelDe(page, pestana);
    await expect(panel.getByRole("heading", { name: titulo, level: 2 })).toBeVisible();
    // El bloque terminó de resolver — ni un `Skeleton` (role="status") colgado, ni un
    // `BloqueConError` (role="alert") tapando el contenido. Da igual si trae filas o el `EmptyState`
    // de tabla vacía: ambos cuentan como "enseñar su contenido", lo que no vale es quedarse cargando
    // o caer en un error contra datos que la propia prueba acaba de crear con una cuenta MASTER.
    await expect(panel.getByRole("status")).toHaveCount(0, { timeout: 15_000 });
    await expect(panel.getByRole("alert")).toHaveCount(0);
  }
});

test("el resumen no espera a que las tablas terminen de cargar", async ({ page }) => {
  const { token } = await cuentaMaster();

  // Retarda SOLO las cuatro rutas de tabla (nunca `metricas`): no es un mock de datos —la respuesta
  // sigue siendo la del backend real—, es una demora artificial para poder afirmar el ORDEN sin
  // recurrir a una espera de tiempo fijo (`no-restricted-syntax` de `apps/web/e2e/**` prohíbe
  // `waitForTimeout`; esto es `setTimeout` dentro del propio manejador de ruta, no esa llamada).
  const RETARDO_MS = 4_000;
  const retardar = async (route: Route): Promise<void> => {
    await new Promise((resolver) => setTimeout(resolver, RETARDO_MS));
    await route.continue();
  };
  const esRuta = (fragmento: string) => (url: URL) => url.href.includes(fragmento);
  await page.route(esRuta("/product/admin/clientas"), retardar);
  await page.route(esRuta("/product/admin/invitaciones"), retardar);
  await page.route(esRuta("/product/admin/pagos"), retardar);
  await page.route(esRuta("/product/admin/plantillas"), retardar);

  await sesionDemo(page, token);
  await page.goto("/admin");

  // El resumen (sin retardo) tiene que enseñar sus cifras bastante antes de que el retardo
  // artificial de las otras cuatro rutas termine: si esperara a las tablas, este `expect` agotaría
  // su plazo, muy por debajo de `RETARDO_MS`.
  const resumen = page.locator('section[aria-labelledby="admin-resumen-titulo"]');
  await expect(resumen.getByRole("status")).toHaveCount(0, { timeout: RETARDO_MS - 1_500 });
  await expect(resumen.getByText(textosAdmin.resumen.tarjetas.clientas)).toBeVisible();
  await expect(resumen.getByRole("alert")).toHaveCount(0);

  // Mientras tanto, Clientas (con el retardo todavía activo) SIGUE cargando: no es una coincidencia
  // de tiempos del resumen, son peticiones de verdad independientes entre sí.
  const clientas = page.locator('section[aria-labelledby="admin-clientas-titulo"]');
  await expect(clientas.getByRole("status").first()).toBeVisible();
});

test("la tabla de invitaciones filtra por texto y por estado", async ({ page }) => {
  const { token, customerId, email } = await cuentaMaster();
  // Documento aplicado, SIN publicar: nace "en-edicion" (hay `tpl_document`, no hay `tpl_release`
  // activo — `ConsultasDeAdministracion.kt`, `bitacora/5-E5-A.md §3.4`). Sirve para probar que el
  // filtro de estado de verdad cambia el resultado, sin necesitar publicar nada.
  const invitationId = await invitacionConDocumento(token, customerId);
  try {
    await sesionDemo(page, token);
    await page.goto("/admin");
    await page.getByRole("tab", { name: textosAdmin.pestanas.invitaciones }).click();
    const panel = panelDe(page, textosAdmin.pestanas.invitaciones);
    await expect(panel.getByRole("status")).toHaveCount(0, { timeout: 15_000 });

    // Búsqueda por texto — por el correo de esta cuenta (único, generado por `cuentaNueva()`), que
    // el buscador casa contra el correo de la clienta (`bitacora/5-E5-A.md §6`: "buscar… casa
    // contra nombre y correo de la clienta y contra el nombre del tipo de evento").
    await panel.getByRole("searchbox", { name: textosAdmin.invitaciones.filtros.buscar }).fill(email);
    await expect(panel.locator("table tbody tr")).toHaveCount(1, { timeout: 5_000 });

    // Filtro de estado: "Publicada" no casa con esta invitación (en-edicion) → tabla vacía.
    const filtroEstado = panel.getByRole("combobox", { name: textosAdmin.invitaciones.filtros.estado });
    await filtroEstado.click();
    await page.getByRole("option", { name: textosAdmin.invitaciones.estados.publicada }).click();
    await expect(panel.getByText(textosAdmin.invitaciones.vacio.conFiltro)).toBeVisible({ timeout: 5_000 });
    await expect(panel.locator("table tbody tr")).toHaveCount(0);

    // Vuelve a aparecer con el estado correcto: el filtro de verdad cambia el resultado, no lo tapa.
    await filtroEstado.click();
    await page.getByRole("option", { name: textosAdmin.invitaciones.estados.enEdicion }).click();
    await expect(panel.locator("table tbody tr")).toHaveCount(1, { timeout: 5_000 });
  } finally {
    borrarInvitacion(invitationId);
  }
});

test("el alcance de un ADMIN: no ve la invitación de una clienta ajena (anti-IDOR desde la interfaz)", async ({
  page,
}) => {
  const admin = await cuentaNueva();
  sql(`UPDATE customer SET role = 'ADMIN' WHERE id = ${admin.customerId};`);

  // Clienta DE este admin: `created_by` apunta a él, que es lo que mira la regla de alcance
  // (`AlcanceDeAdministracion.kt`, `bitacora/5-E5-A.md`: `customer.id = :yo OR customer.created_by
  // = :yo`).
  const propia = await cuentaNueva();
  sql(`UPDATE customer SET created_by = ${admin.customerId} WHERE id = ${propia.customerId};`);
  const invitacionPropia = await invitacionConDocumento(propia.token, propia.customerId);

  // Clienta AJENA: sin relación con el admin — ni `id` ni `created_by` coinciden.
  const ajena = await cuentaNueva();
  const invitacionAjena = await invitacionConDocumento(ajena.token, ajena.customerId);

  try {
    await sesionDemo(page, admin.token);
    await page.goto("/admin");
    await page.getByRole("tab", { name: textosAdmin.pestanas.invitaciones }).click();
    const panel = panelDe(page, textosAdmin.pestanas.invitaciones);
    await expect(panel.getByRole("status")).toHaveCount(0, { timeout: 15_000 });

    const buscar = panel.getByRole("searchbox", { name: textosAdmin.invitaciones.filtros.buscar });

    // Control: el mismo buscador SÍ encuentra a la clienta que es suya — así el cero de más abajo
    // es alcance, no un buscador roto.
    await buscar.fill(propia.email);
    await expect(panel.locator("table tbody tr")).toHaveCount(1, { timeout: 5_000 });

    // La clienta ajena: la misma sesión de ADMIN, el mismo buscador, cero filas.
    await buscar.fill(ajena.email);
    await expect(panel.getByText(textosAdmin.invitaciones.vacio.conFiltro)).toBeVisible({ timeout: 5_000 });
    await expect(panel.locator("table tbody tr")).toHaveCount(0);
  } finally {
    borrarInvitacion(invitacionPropia);
    borrarInvitacion(invitacionAjena);
  }
});

test("el catálogo de plantillas se enseña en solo lectura, sin controles de alta ni cifras codificadas", async ({
  page,
}) => {
  const { token } = await cuentaMaster();

  const esperado = (await fetch(`${API_BASE}/product/admin/plantillas`, {
    headers: { authorization: `Bearer ${token}` },
  }).then((r) => r.json())) as { total: number; elementos: readonly unknown[] };

  await sesionDemo(page, token);
  await page.goto("/admin");
  await page.getByRole("tab", { name: textosAdmin.pestanas.plantillas }).click();
  const panel = panelDe(page, textosAdmin.pestanas.plantillas);
  await expect(panel.getByRole("status")).toHaveCount(0, { timeout: 15_000 });

  await expect(panel.getByText(textosAdmin.plantillas.subtitulo)).toBeVisible();

  // Solo lectura: ningún control de alta, de registro ni de subida — ni botón, ni enlace, ni campo
  // de archivo en toda la pestaña (README de la carpeta: "el alta de una plantilla es por el kit de
  // autor de la fase 4, nunca por esta pantalla").
  await expect(panel.getByRole("button")).toHaveCount(0);
  await expect(panel.getByRole("link")).toHaveCount(0);
  await expect(panel.locator('input[type="file"]')).toHaveCount(0);

  // La vista aguanta el número de plantillas que haya en la base — sin cifra codificada ni un slug
  // concreto supuesto: se compara contra lo que el backend acaba de devolver, no contra un número
  // fijo en la prueba.
  await expect(panel.locator("table tbody tr")).toHaveCount(esperado.elementos.length);
});

test("accesibilidad: axe sin violaciones de ningún impacto, con sesión MASTER y la consola cargada", async ({
  page,
}) => {
  // `e2e/a11y-producto.spec.ts` es el sitio natural de esta prueba, pero el encargo de este spec
  // está acotado a `admin*.spec.ts` ("ni un fichero más") y ese archivo no es uno de los míos —
  // documentado en `bitacora/5-E5-F-parcial.md`. Mismo criterio que ese archivo: violaciones VACÍO
  // por completo (cualquier impacto), tolerando solo la `incomplete` de `color-contrast` que ese
  // spec documenta como constante en cuanto hay un degradado en la página.
  const { token } = await cuentaMaster();
  await sesionDemo(page, token);
  await page.goto("/admin");
  await expect(page.getByRole("tablist", { name: textosAdmin.pagina.titulo })).toBeVisible();

  // Dejar que las cinco pestañas resuelvan su carga antes de auditar: auditar en pleno "cargando"
  // no dice nada del árbol final que la persona de verdad usa.
  for (const nombre of NOMBRES_PESTANAS) {
    await page.getByRole("tab", { name: nombre }).click();
    await expect(panelDe(page, nombre).getByRole("status")).toHaveCount(0, { timeout: 15_000 });
  }
  await page.getByRole("tab", { name: textosAdmin.pestanas.resumen }).click();

  const resultados = await new AxeBuilder({ page }).analyze();
  expect(resultados.violations, `/admin — violaciones axe:\n${JSON.stringify(resultados.violations, null, 2)}`).toEqual(
    [],
  );
  const incompletasNoToleradas = resultados.incomplete.filter((regla) => regla.id !== "color-contrast");
  expect(
    incompletasNoToleradas,
    `/admin — incompletas de axe no toleradas (color-contrast sí lo está, ver a11y-producto.spec.ts):\n${JSON.stringify(incompletasNoToleradas, null, 2)}`,
  ).toEqual([]);
});
