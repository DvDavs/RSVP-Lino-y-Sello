// geometria.test.ts — DETERMINISMO (ADR-3C-0-03) y fidelidad al moodboard.
//
// La compuerta importante es la primera: el `path` de `blob(7)` que produce este paquete es el
// MISMO byte a byte que el que `construir.mjs` incrustó en
// `evidencia/fase-3c/moodboard/index.html` (`grep 'M83.1 42.6'` → 1 coincidencia). Si alguien
// «mejora» la matemática, esta prueba cae y el moodboard deja de ser evidencia de nada.
import { describe, expect, it } from "vitest";
import {
  ONDAS,
  arco,
  blob,
  cuadradoRedondeado,
  ladoInscrito,
  poligonoRedondeado,
  prng,
  rayos,
  sello,
  triangulo,
} from "./geometria.ts";

const BLOB_7_DEL_MOODBOARD =
  "M83.1 42.6 C81.4 54.4 77.3 83.2 70.2 90.9 C63.2 98.7 49.6 93.2 40.7 89.2 C31.7 85.1 22.0 76.7 16.7 66.6 " +
  "C11.4 56.6 5.2 37.3 8.8 28.9 C12.4 20.6 26.5 17.8 38.3 16.3 C50.2 14.9 72.7 15.9 80.1 20.3 " +
  "C87.6 24.6 84.7 30.8 83.1 42.6 Z";

describe("blob() — determinista y fiel al moodboard", () => {
  it("blob(7) reproduce EXACTAMENTE el path que el moodboard tiene incrustado", () => {
    expect(blob(7)).toBe(BLOB_7_DEL_MOODBOARD);
  });

  it("dos renders con la misma seed dan el mismo path", () => {
    expect(blob(31, 7, 0.2)).toBe(blob(31, 7, 0.2));
    expect(blob(1)).toBe(blob(1));
  });

  it("seeds distintas dan paths distintos", () => {
    expect(blob(7)).not.toBe(blob(8));
    expect(blob(31, 7, 0.2)).not.toBe(blob(32, 7, 0.2));
  });

  it("cada parámetro cambia el dibujo", () => {
    expect(blob(7, 7, 0.22)).not.toBe(blob(7, 6, 0.22));
    expect(blob(7, 7, 0.22)).not.toBe(blob(7, 7, 0.18));
    expect(blob(7, 7, 0.22, 42)).not.toBe(blob(7, 7, 0.22, 47));
  });

  it("es un path cerrado de `points` curvas cúbicas", () => {
    const d = blob(7, 9, 0.2);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith(" Z")).toBe(true);
    expect(d.match(/C/g)).toHaveLength(9);
  });

  it("no se sale del viewBox de 100 con la amplitud máxima documentada", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const numeros = blob(seed, 7, 0.22)
        .replace(/[MCZ]/g, " ")
        .trim()
        .split(/[\s]+/)
        .map(Number);
      expect(Math.min(...numeros)).toBeGreaterThan(-5);
      expect(Math.max(...numeros)).toBeLessThan(105);
    }
  });
});

describe("prng() — mulberry32", () => {
  it("la misma semilla da la misma secuencia", () => {
    const a = prng(99);
    const b = prng(99);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("devuelve valores en [0, 1)", () => {
    const r = prng(5);
    for (let i = 0; i < 200; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("sello() — r(θ) = R + a·cos(nθ)", () => {
  it("muestrea `pasos + 1` puntos y cierra", () => {
    const d = sello(12, 4, 44, 50, 50, 240);
    expect(d.match(/L/g)).toHaveLength(240);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith(" Z")).toBe(true);
  });

  it("es determinista y sensible a sus parámetros", () => {
    expect(sello(12, 4)).toBe(sello(12, 4));
    expect(sello(12, 4)).not.toBe(sello(14, 4));
    expect(sello(12, 4)).not.toBe(sello(12, 3.2));
  });
});

describe("rayos() — cuñas alternas", () => {
  it("emite exactamente `density` cuñas", () => {
    expect(rayos(12, 160).match(/M0 0/g)).toHaveLength(12);
    expect(rayos(8, 120).match(/M0 0/g)).toHaveLength(8);
  });

  it("cada cuña es un arco del radio pedido", () => {
    expect(rayos(4, 160)).toContain("A160 160 0 0 1");
  });
});

describe("poligonoRedondeado() y las formas derivadas", () => {
  it("con radio 0 devuelve el polígono duro (sin curvas)", () => {
    const d = poligonoRedondeado(
      [
        [0, 0],
        [100, 0],
        [50, 100],
      ],
      0,
    );
    expect(d).not.toContain("Q");
    expect(d).toBe("M0.0 0.0 L100.0 0.0 L50.0 100.0 Z");
  });

  it("con radio > 0 pone una curva por vértice", () => {
    expect(triangulo(12).match(/Q/g)).toHaveLength(3);
    expect(cuadradoRedondeado(80, 14).match(/Q/g)).toHaveLength(4);
  });

  it("el radio nunca se come más de la mitad de un lado", () => {
    // Radio absurdo sobre un cuadrado de lado 40: las curvas se juntan pero el path sigue cerrado.
    const d = cuadradoRedondeado(40, 999);
    expect(d.endsWith(" Z")).toBe(true);
    expect(d).not.toContain("NaN");
  });

  it("rechaza menos de tres puntos", () => {
    expect(() =>
      poligonoRedondeado(
        [
          [0, 0],
          [1, 1],
        ],
        4,
      ),
    ).toThrow(/tres puntos/);
  });
});

describe("ladoInscrito() — el cuadrado rotado no se sale del bloque", () => {
  it("sin giro ocupa la caja entera", () => {
    expect(ladoInscrito(0)).toBeCloseTo(100, 6);
  });

  it("a 45° es el máximo inscrito (100/√2)", () => {
    expect(ladoInscrito(45)).toBeCloseTo(100 / Math.SQRT2, 6);
  });

  it("el cuadrado girado cabe entero en 0-100", () => {
    for (const grados of [-20, -12, 0, 8, 12, 24, 45]) {
      const lado = ladoInscrito(grados);
      const r = (grados * Math.PI) / 180;
      const semidiagonal = (lado / 2) * (Math.abs(Math.cos(r)) + Math.abs(Math.sin(r)));
      expect(50 + semidiagonal).toBeLessThanOrEqual(100.000001);
    }
  });
});

describe("arco() y ONDAS", () => {
  it("el arco por defecto llena la caja y lleva un semicírculo", () => {
    expect(arco(0)).toBe("M0.0 100.0 V50.0 A50.0 50.0 0 0 1 100.0 50.0 V100.0 Z");
  });

  it("los tres perfiles de onda son fijos, distintos y cerrados", () => {
    const perfiles = Object.keys(ONDAS);
    expect(perfiles).toEqual(["suave", "marcada", "doble"]);
    const frentes = perfiles.map((p) => ONDAS[p as keyof typeof ONDAS].frente);
    expect(new Set(frentes).size).toBe(3);
    for (const p of perfiles) {
      const curvas = ONDAS[p as keyof typeof ONDAS];
      expect(curvas.frente.endsWith("V90 H0 Z")).toBe(true);
      expect(curvas.fondo.endsWith("V90 H0 Z")).toBe(true);
    }
  });
});
