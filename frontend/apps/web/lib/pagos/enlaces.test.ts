// lib/pagos/enlaces.test.ts — la frontera de las URLs que el backend devuelve y la interfaz navega
// (revisión 5-4-R1, hallazgos S-1 y S-2).
import { describe, expect, it } from "vitest";
import { enlaceHttpsValido, urlDeCheckoutDeStripe } from "./enlaces.ts";

describe("enlaceHttpsValido", () => {
  it("deja pasar una URL https absoluta", () => {
    expect(enlaceHttpsValido("https://pay.stripe.com/receipts/abc")).toBe("https://pay.stripe.com/receipts/abc");
  });

  it("rechaza javascript:, data: y http:", () => {
    expect(enlaceHttpsValido("javascript:alert(1)")).toBeNull();
    expect(enlaceHttpsValido("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(enlaceHttpsValido("http://pay.stripe.com/receipts/abc")).toBeNull();
  });

  it("rechaza lo que no es una URL, la cadena vacía y los nulos", () => {
    expect(enlaceHttpsValido("/receipts/abc")).toBeNull();
    expect(enlaceHttpsValido("")).toBeNull();
    expect(enlaceHttpsValido(null)).toBeNull();
    expect(enlaceHttpsValido(undefined)).toBeNull();
  });
});

describe("urlDeCheckoutDeStripe", () => {
  it("deja pasar la URL que promete el contrato §2.4", () => {
    expect(urlDeCheckoutDeStripe("https://checkout.stripe.com/c/pay/cs_test_1")).toBe(
      "https://checkout.stripe.com/c/pay/cs_test_1",
    );
  });

  it("rechaza otro dominio, aunque sea de Stripe, y cualquier intento de colarse por el prefijo", () => {
    expect(urlDeCheckoutDeStripe("https://pay.stripe.com/c/pay/cs_test_1")).toBeNull();
    expect(urlDeCheckoutDeStripe("https://checkout.stripe.com.malo.example/c/pay")).toBeNull();
    expect(urlDeCheckoutDeStripe("https://malo.example/#https://checkout.stripe.com/")).toBeNull();
    expect(urlDeCheckoutDeStripe("http://checkout.stripe.com/c/pay/cs_test_1")).toBeNull();
    expect(urlDeCheckoutDeStripe(null)).toBeNull();
  });
});
