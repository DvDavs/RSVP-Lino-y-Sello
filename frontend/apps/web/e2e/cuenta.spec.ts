// e2e/cuenta.spec.ts — las tres pantallas de cuenta (fase 5, E3), contra el BACKEND REAL, sin
// mockear la API. `handoffs/5-E3-A2-contrato-cuenta.md` es la especificación.
//
// ADR-5-E1-03 (regla dura de la fase): cada prueba crea su PROPIA cuenta con un correo único —
// nunca la cuenta de demostración ni una compartida entre pruebas — para que `fullyParallel` con
// varios workers no se pise. Verificado con `--workers=4 --repeat-each=2` (bitácora).
import { expect, test } from "@playwright/test";
import { API_BASE, sesionDemo, sql } from "./preparar.ts";

/** Misma regla de fuerza que el resto del backend: ≥8, mayúscula, minúscula, carácter especial. */
const PASSWORD = "Secreta1!";
const PASSWORD_NUEVA = "OtraSecreta2!";

interface CuentaDePrueba {
  readonly email: string;
  readonly token: string;
  readonly customerId: number;
}

/** Alta por la ruta real — nunca por SQL — para que el correo de verificación se acuñe de verdad. */
async function altaDePrueba(page: import("@playwright/test").Page, prefijo: string): Promise<CuentaDePrueba> {
  const email = `${prefijo}.${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}@example.com`;
  const alta = await page.request.post(`${API_BASE}/auth/signup`, {
    data: { name: "Prueba", lastName: "Cuenta", email, password: PASSWORD },
  });
  if (!alta.ok()) throw new Error(`POST /auth/signup → ${alta.status()}: ${await alta.text()}`);
  const { accessToken } = (await alta.json()) as { accessToken: string };
  const customerId = Number(sql(`SELECT id FROM customer WHERE email = '${email}';`));
  return { email, token: accessToken, customerId };
}

function tokenDeVerificacion(customerId: number): string {
  const token = sql(`SELECT email_verification_token FROM customer WHERE id = ${customerId};`);
  if (!token) throw new Error(`customer ${customerId} no tiene email_verification_token`);
  return token;
}

test.describe("/verificar-correo — la ruta que antes daba 404", () => {
  test("sin token en la URL, dice qué hacer sin llamar al backend", async ({ page }) => {
    await page.goto("/verificar-correo");
    await expect(page.getByRole("heading", { name: "Este enlace no trae el código de confirmación" })).toBeVisible();
  });

  test("con el token real del alta, confirma el correo y ofrece entrar", async ({ page }) => {
    const cuenta = await altaDePrueba(page, "verificar");
    const token = tokenDeVerificacion(cuenta.customerId);

    await page.goto(`/verificar-correo?token=${token}`);
    await expect(page.getByText("Tu correo quedó verificado")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: "Entrar a mi cuenta" })).toHaveAttribute("href", "/acceso");

    // Verificado también en la base: `email_verified` pasó a true y el token se consumió.
    expect(sql(`SELECT email_verified FROM customer WHERE id = ${cuenta.customerId};`)).toBe("t");
    expect(sql(`SELECT email_verification_token FROM customer WHERE id = ${cuenta.customerId};`)).toBe("");
  });

  test("un token que ya se usó ofrece pedir uno nuevo, y el reenvío no rompe nada", async ({ page }) => {
    const cuenta = await altaDePrueba(page, "usado");
    const token = tokenDeVerificacion(cuenta.customerId);

    // Se consume una vez por la ruta real…
    const primero = await page.request.post(`${API_BASE}/auth/verify-email`, { data: { token } });
    expect(primero.ok(), "primer POST /auth/verify-email").toBeTruthy();

    // …y el mismo enlace, pulsado otra vez, cae en "ya no sirve".
    await page.goto(`/verificar-correo?token=${token}`);
    await expect(page.getByRole("heading", { name: "Ese enlace ya no sirve" })).toBeVisible({ timeout: 15_000 });

    await page.getByLabel("Correo electrónico").fill(cuenta.email);
    await page.getByRole("button", { name: "Mandar un enlace nuevo" }).click();
    await expect(
      page.getByText("Si el correo corresponde a una cuenta sin verificar, te mandamos un enlace nuevo."),
    ).toBeVisible();
  });
});

test.describe("/perfil — sustituye el marcador", () => {
  test("carga los datos reales, enseña el correo sin verificar y reenvía", async ({ page }) => {
    const cuenta = await altaDePrueba(page, "perfil-datos");
    await sesionDemo(page, cuenta.token);

    await page.goto("/perfil");
    await expect(page.getByLabel("Correo")).toHaveValue(cuenta.email);
    await expect(page.getByText("Correo sin verificar")).toBeVisible();

    const respuestaReenvio = page.waitForResponse((r) => r.url().includes("/auth/verify-email:resend"));
    await page.getByRole("button", { name: "Reenviar" }).click();
    expect((await respuestaReenvio).status()).toBe(200);
    await expect(page.getByText("Si tu cuenta todavía no está verificada, te mandamos un enlace nuevo.")).toBeVisible();
  });

  test("guardar el nombre lo persiste de verdad (release: PUT /user/profile → GET lo confirma)", async ({ page }) => {
    const cuenta = await altaDePrueba(page, "perfil-guardar");
    await sesionDemo(page, cuenta.token);
    await page.goto("/perfil");

    const campoNombre = page.getByLabel("Nombre");
    await campoNombre.fill("Ana Actualizada");
    const escritura = page.waitForResponse(
      (r) => r.url().endsWith("/user/profile") && r.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    expect((await escritura).status()).toBe(200);
    await expect(page.getByText("Guardado")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Nombre")).toHaveValue("Ana Actualizada");
  });

  test("pedir un cambio de correo con contraseña incorrecta lo dice EN el campo de la contraseña", async ({ page }) => {
    const cuenta = await altaDePrueba(page, "perfil-correo");
    await sesionDemo(page, cuenta.token);
    await page.goto("/perfil");

    await page.getByRole("button", { name: "Cambiar correo" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByLabel("Nuevo correo").fill(`nuevo.${Date.now()}@example.com`);
    await dialogo.getByLabel("Tu contraseña actual").fill("ContraseñaMala1!");
    await dialogo.getByRole("button", { name: "Pedir el cambio" }).click();
    await expect(dialogo.getByText("Tu contraseña actual no coincide.")).toBeVisible();
  });

  test("cambiar la contraseña avisa antes, cierra la sesión y deja entrar con la nueva", async ({ page }) => {
    const cuenta = await altaDePrueba(page, "perfil-password");
    await sesionDemo(page, cuenta.token);
    await page.goto("/perfil");

    // El aviso está ANTES de pulsar, no aparece solo tras el error.
    await expect(
      page.getByText("Al cambiarla, cerramos tu sesión en todos los dispositivos y tendrás que volver a entrar."),
    ).toBeVisible();

    await page.getByLabel("Actual").fill(PASSWORD);
    // `{exact: true}`: "Nueva" es subcadena de "Repite la nueva" (Playwright compara por texto
    // accesible, no exacto por defecto) y `getByLabel` fallaría en modo estricto sin esto.
    await page.getByLabel("Nueva", { exact: true }).fill(PASSWORD_NUEVA);
    await page.getByLabel("Repite la nueva").fill(PASSWORD_NUEVA);
    const escritura = page.waitForResponse(
      (r) => r.url().endsWith("/user/account/password") && r.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();
    expect((await escritura).status()).toBe(200);
    await page.waitForURL(/\/acceso\?motivo=sesion/);
    await expect(page.getByText("Tu sesión terminó. Vuelve a entrar para seguir donde lo dejaste.")).toBeVisible();

    // La contraseña VIEJA ya no sirve; la NUEVA sí (verificado contra la ruta real de acceso).
    const conViejaFalla = await page.request.post(`${API_BASE}/auth/token`, {
      data: { email: cuenta.email, password: PASSWORD },
    });
    expect(conViejaFalla.status()).toBe(401);
    const conNuevaEntra = await page.request.post(`${API_BASE}/auth/token`, {
      data: { email: cuenta.email, password: PASSWORD_NUEVA },
    });
    expect(conNuevaEntra.ok()).toBeTruthy();
  });

  test("cerrar sesión en todos los dispositivos manda a /acceso y borra el refreshToken en el servidor", async ({
    page,
  }) => {
    const cuenta = await altaDePrueba(page, "perfil-logout");
    await sesionDemo(page, cuenta.token);
    await page.goto("/perfil");

    const antes = Number(sql(`SELECT count(*) FROM refresh_tokens WHERE customer_id = ${cuenta.customerId};`));
    expect(antes).toBeGreaterThan(0);

    const escritura = page.waitForResponse((r) => r.url().endsWith("/user/account/logout"));
    await page.getByRole("button", { name: "Cerrar sesión en todos los dispositivos" }).click();
    expect((await escritura).status()).toBe(200);
    await page.waitForURL(/\/acceso(?!.*motivo)/);

    const despues = Number(sql(`SELECT count(*) FROM refresh_tokens WHERE customer_id = ${cuenta.customerId};`));
    expect(despues).toBe(0);
  });
});

test.describe("/acceso — alta completa", () => {
  test("crea la cuenta con teléfono opcional, avisa de que nace sin verificar, y entra igual", async ({ page }) => {
    const email = `acceso.${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}@example.com`;

    await page.goto("/acceso");
    await page.getByRole("tab", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Te mandamos un correo para confirmar esta dirección.", { exact: false })).toBeVisible();

    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByText("Con la lada de México: +52 y 10 dígitos", { exact: false })).toBeVisible();
    await page.getByLabel("Nombre").fill("Ana");
    await page.getByLabel("Apellidos").fill("Torres");
    await page.getByLabel("Teléfono (opcional)").fill("+525512345678");

    const alta = page.waitForResponse((r) => r.url().endsWith("/auth/signup"));
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    const respuesta = await alta;
    expect(respuesta.status()).toBe(200);

    // Entra de inmediato — la verificación no bloquea nada (contrato §5.1).
    await page.waitForURL((url) => url.pathname !== "/acceso");

    expect(sql(`SELECT email_verified, phone FROM customer WHERE email = '${email}';`)).toBe("f|+525512345678");
  });
});
