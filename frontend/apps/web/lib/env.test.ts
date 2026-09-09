// lib/env.test.ts — cada variable del catálogo en sus tres estados: ausente, con basura y con un
// valor válido. Todo son funciones puras sobre un mapa: no se toca `process.env` global en ninguna
// prueba, así que ninguna deja el entorno contaminado para la siguiente.
//
// NINGÚN VALOR REAL: la clave de Stripe de estas pruebas es evidentemente ficticia y el correo y el
// dominio son de ejemplo.
import { describe, expect, it } from "vitest";
import {
  CATALOGO,
  hooksE2EActivos,
  leerClavePublicableDeStripe,
  leerCorreoDeSoporte,
  problemasDelEntorno,
  revisarEntorno,
  type NombreDeVariable,
} from "./env.ts";

/** Ficticia a propósito: la forma es la de Stripe, el contenido no vale para nada. */
const CLAVE_FICTICIA = "pk_test_ESTONOESUNACLAVEREAL0000";
const CLAVE_SECRETA_FICTICIA = "sk_test_ESTOTAMPOCOESUNACLAVEREAL00";

function estado(entorno: Record<string, string | undefined>, nombre: NombreDeVariable) {
  const encontrado = revisarEntorno(entorno).find((e) => e.nombre === nombre);
  if (!encontrado) throw new Error(`${nombre} no está en el catálogo`);
  return encontrado;
}

describe("catálogo", () => {
  it("tiene las seis variables, sin repetidas, y todas opcionales", () => {
    expect(CATALOGO).toHaveLength(6);
    expect(new Set(CATALOGO.map((v) => v.nombre)).size).toBe(6);
    expect(CATALOGO.every((v) => v.obligatoria === false)).toBe(true);
  });

  it("cada ficha dice para qué sirve, quién manda sobre ella y qué pasa si falta", () => {
    for (const ficha of CATALOGO) {
      expect(ficha.paraQue.length, ficha.nombre).toBeGreaterThan(10);
      expect(ficha.fuente.length, ficha.nombre).toBeGreaterThan(3);
      expect(ficha.siFalta.length, ficha.nombre).toBeGreaterThan(10);
    }
  });

  it("`revisarEntorno` cubre exactamente el catálogo", () => {
    expect(revisarEntorno({}).map((e) => e.nombre)).toEqual(CATALOGO.map((v) => v.nombre));
  });

  it("un entorno vacío no tiene ni un problema: todas son opcionales", () => {
    expect(problemasDelEntorno({})).toHaveLength(0);
    expect(revisarEntorno({}).every((e) => !e.declarada && !e.valida)).toBe(true);
  });
});

describe("NEXT_PUBLIC_SOPORTE_CORREO", () => {
  it("ausente: ni válida ni con motivo (no es un error no tenerla)", () => {
    expect(leerCorreoDeSoporte({})).toBeNull();
    expect(estado({}, "NEXT_PUBLIC_SOPORTE_CORREO")).toMatchObject({ declarada: false, valida: false, motivo: null });
  });

  it("con basura: se rechaza y se dice qué se pierde", () => {
    for (const basura of ["", "  ", "soporte", "soporte@ejemplo", "soporte @ejemplo.mx"]) {
      expect(leerCorreoDeSoporte({ NEXT_PUBLIC_SOPORTE_CORREO: basura }), basura).toBeNull();
    }
    const revisado = estado({ NEXT_PUBLIC_SOPORTE_CORREO: "soporte" }, "NEXT_PUBLIC_SOPORTE_CORREO");
    expect(revisado.valida).toBe(false);
    expect(revisado.motivo).toContain("correo de soporte");
  });

  it("válida: se normaliza igual que el correo de ventas (mismo `normalizarCorreo`)", () => {
    expect(leerCorreoDeSoporte({ NEXT_PUBLIC_SOPORTE_CORREO: " soporte@ejemplo.mx " })).toBe("soporte@ejemplo.mx");
    expect(estado({ NEXT_PUBLIC_SOPORTE_CORREO: "soporte@ejemplo.mx" }, "NEXT_PUBLIC_SOPORTE_CORREO")).toMatchObject({
      declarada: true,
      valida: true,
      motivo: null,
    });
  });
});

describe("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", () => {
  it("ausente: sin pago en línea y sin ruido", () => {
    expect(leerClavePublicableDeStripe({})).toBeNull();
    expect(estado({}, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY").motivo).toBeNull();
  });

  it("con basura: se rechaza", () => {
    for (const basura of ["", "  ", "pk_", "pk_test_", "pk_prod_ABCDEFGH", "AbCdEfGhIj"]) {
      expect(leerClavePublicableDeStripe({ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: basura }), basura).toBeNull();
    }
  });

  it("una clave SECRETA se rechaza y el aviso no repite el valor", () => {
    const entorno = { NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: CLAVE_SECRETA_FICTICIA };
    expect(leerClavePublicableDeStripe(entorno)).toBeNull();
    const revisado = estado(entorno, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
    expect(revisado.valida).toBe(false);
    expect(revisado.motivo).toContain("SECRETA");
    expect(revisado.motivo).not.toContain(CLAVE_SECRETA_FICTICIA);
  });

  it("válida: `pk_test_…` y `pk_live_…`, con espacios de más recortados", () => {
    expect(leerClavePublicableDeStripe({ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ` ${CLAVE_FICTICIA} ` })).toBe(
      CLAVE_FICTICIA,
    );
    expect(
      leerClavePublicableDeStripe({ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_TAMPOCOESREAL000000" }),
    ).not.toBeNull();
    expect(estado({ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: CLAVE_FICTICIA }, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")).toMatchObject(
      { declarada: true, valida: true, motivo: null },
    );
  });
});

describe("NEXT_PUBLIC_SITE_URL (dueño: lib/enlace-publico.ts)", () => {
  it("ausente: no es un error; el navegador usa el origen navegado", () => {
    expect(estado({}, "NEXT_PUBLIC_SITE_URL")).toMatchObject({ declarada: false, valida: false, motivo: null });
  });

  it("con basura: se dice que no es una URL absoluta", () => {
    expect(estado({ NEXT_PUBLIC_SITE_URL: "invitaciones.mx" }, "NEXT_PUBLIC_SITE_URL").motivo).toContain("absoluta");
    expect(estado({ NEXT_PUBLIC_SITE_URL: "ftp://invitaciones.mx" }, "NEXT_PUBLIC_SITE_URL").motivo).toContain("https");
  });

  it("válida: un origen público con https", () => {
    expect(estado({ NEXT_PUBLIC_SITE_URL: "https://invitaciones.example" }, "NEXT_PUBLIC_SITE_URL")).toMatchObject({
      valida: true,
      motivo: null,
    });
  });

  it("`localhost` vale en desarrollo y NO en producción (U-6)", () => {
    const local = { NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000" };
    expect(estado({ ...local, NODE_ENV: "development" }, "NEXT_PUBLIC_SITE_URL").valida).toBe(true);
    const enProduccion = estado({ ...local, NODE_ENV: "production" }, "NEXT_PUBLIC_SITE_URL");
    expect(enProduccion.valida).toBe(false);
    expect(enProduccion.motivo).toContain("U-6");
  });

  it("http a un dominio real se rechaza en producción", () => {
    const revisado = estado(
      { NEXT_PUBLIC_SITE_URL: "http://invitaciones.example", NODE_ENV: "production" },
      "NEXT_PUBLIC_SITE_URL",
    );
    expect(revisado.valida).toBe(false);
    expect(revisado.motivo).toContain("https");
  });
});

describe("las dos de lib/contacto.ts, revisadas sin reimplementarlas", () => {
  it("teléfono: ausente, basura y válido", () => {
    expect(estado({}, "NEXT_PUBLIC_CONTACTO_WHATSAPP").motivo).toBeNull();
    expect(estado({ NEXT_PUBLIC_CONTACTO_WHATSAPP: "pendiente" }, "NEXT_PUBLIC_CONTACTO_WHATSAPP").motivo).toContain(
      "E.164",
    );
    expect(estado({ NEXT_PUBLIC_CONTACTO_WHATSAPP: "+52 155 1234 5678" }, "NEXT_PUBLIC_CONTACTO_WHATSAPP")).toMatchObject(
      { valida: true, motivo: null },
    );
  });

  it("correo de ventas: ausente, basura y válido", () => {
    expect(estado({}, "NEXT_PUBLIC_CONTACTO_CORREO").motivo).toBeNull();
    expect(estado({ NEXT_PUBLIC_CONTACTO_CORREO: "hola@ejemplo" }, "NEXT_PUBLIC_CONTACTO_CORREO").valida).toBe(false);
    expect(estado({ NEXT_PUBLIC_CONTACTO_CORREO: "hola@ejemplo.mx" }, "NEXT_PUBLIC_CONTACTO_CORREO").valida).toBe(true);
  });
});

describe("NEXT_PUBLIC_E2E_HOOKS", () => {
  it("solo el literal «1» enciende los ganchos", () => {
    expect(hooksE2EActivos({})).toBe(false);
    expect(hooksE2EActivos({ NEXT_PUBLIC_E2E_HOOKS: "true" })).toBe(false);
    expect(hooksE2EActivos({ NEXT_PUBLIC_E2E_HOOKS: "1" })).toBe(true);
    expect(estado({ NEXT_PUBLIC_E2E_HOOKS: "true" }, "NEXT_PUBLIC_E2E_HOOKS").motivo).toContain("«1»");
  });
});
