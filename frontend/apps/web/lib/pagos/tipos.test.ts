import { describe, expect, it } from "vitest";
import { ErrorDePago, PAY_ERROR_CODES } from "./tipos.ts";

describe("ErrorDePago", () => {
  it("conserva code, status y message de un código conocido", () => {
    const error = new ErrorDePago("PAY_ALREADY_PAID", 409, "la invitación ya está pagada");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("PAY_ALREADY_PAID");
    expect(error.status).toBe(409);
    expect(error.message).toBe("la invitación ya está pagada");
    expect(error.isKnownCode).toBe(true);
  });

  it("un código PAY_* que el frontend no conoce se degrada a PAY_DESCONOCIDO, sin perder isKnownCode=false", () => {
    const error = new ErrorDePago("PAY_ALGO_NUEVO_DEL_BACKEND", 422, "algo nuevo");
    expect(error.code).toBe("PAY_DESCONOCIDO");
    expect(error.isKnownCode).toBe(false);
  });

  it("PAY_ERROR_CODES incluye los siete del contrato más el catch-all local", () => {
    expect(PAY_ERROR_CODES).toContain("PAY_NOT_CONFIGURED");
    expect(PAY_ERROR_CODES).toContain("PAY_STRIPE_UNAVAILABLE");
    expect(PAY_ERROR_CODES).toContain("PAY_DESCONOCIDO");
    expect(PAY_ERROR_CODES.length).toBe(8);
  });
});
