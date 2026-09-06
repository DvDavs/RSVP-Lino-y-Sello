import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@/lib/api-types";
import {
  CAPACIDADES,
  capacidadesDisponibles,
  claveDePlantilla,
  conteoPorTipo,
  entraEnElPlan,
  esCapacidad,
  filtrarPlantillas,
  nivelDePlan,
  SIN_FILTROS,
} from "./catalogo.ts";

function plantilla(parcial: Partial<CatalogItem>): CatalogItem {
  return {
    slug: "una",
    version: "1.0.0",
    name: { "es-MX": "Una" },
    eventKinds: ["wedding"],
    minPlanTier: 1,
    previewUrl: "https://ejemplo.test/a.webp",
    capabilities: [],
    status: "published",
    ...parcial,
  };
}

// Las dos plantillas reales del catálogo sembrado (verificadas contra el backend de este worktree).
const BODA = plantilla({ slug: "boda-clasica", name: { "es-MX": "Boda clásica" }, eventKinds: ["wedding"], minPlanTier: 2, capabilities: ["story", "hashtags", "music"] });
const XV = plantilla({ slug: "xv-jardin", name: { "es-MX": "XV Jardín" }, eventKinds: ["quince"], minPlanTier: 1, capabilities: ["hashtags"] });

describe("nivelDePlan (nombre del plan → nivel, espejo de is_premium)", () => {
  it("Premium es 2 y todo lo demás 1", () => {
    expect(nivelDePlan("Premium")).toBe(2);
    expect(nivelDePlan("premium")).toBe(2);
    expect(nivelDePlan("Básico")).toBe(1);
    expect(nivelDePlan(null)).toBe(1);
    expect(nivelDePlan("")).toBe(1);
  });
});

describe("entraEnElPlan", () => {
  it("«Boda clásica» (plan 2) queda fuera de un plan Básico y dentro de un Premium", () => {
    expect(entraEnElPlan(BODA, 1)).toBe(false);
    expect(entraEnElPlan(BODA, 2)).toBe(true);
  });
  it("«XV Jardín» (plan 1) entra en cualquiera", () => {
    expect(entraEnElPlan(XV, 1)).toBe(true);
    expect(entraEnElPlan(XV, 2)).toBe(true);
  });
});

describe("conteoPorTipo", () => {
  it("cuenta una plantilla en cada uno de sus tipos de evento", () => {
    const conteo = conteoPorTipo([BODA, XV, plantilla({ slug: "mixta", eventKinds: ["birthday", "generic"] })]);
    expect(conteo.get("wedding")).toBe(1);
    expect(conteo.get("quince")).toBe(1);
    expect(conteo.get("birthday")).toBe(1);
    expect(conteo.get("generic")).toBe(1);
    expect(conteo.get("baptism")).toBeUndefined();
  });
});

describe("capacidades", () => {
  it("las cinco capacidades son las del manifiesto y solo esas", () => {
    expect([...CAPACIDADES]).toEqual(["singlePlace", "story", "hashtags", "music", "countdown"]);
    expect(esCapacidad("story")).toBe(true);
    expect(esCapacidad("estilo-boho")).toBe(false);
  });

  it("solo se ofrecen las capacidades que alguna plantilla tiene (nunca un filtro sin resultados)", () => {
    expect(capacidadesDisponibles([BODA, XV])).toEqual(["story", "hashtags", "music"]);
    expect(capacidadesDisponibles([XV])).toEqual(["hashtags"]);
    expect(capacidadesDisponibles([])).toEqual([]);
  });
});

describe("filtrarPlantillas", () => {
  const items = [BODA, XV];

  it("sin filtros no esconde nada: las bloqueadas por plan se enseñan con su motivo", () => {
    expect(filtrarPlantillas(items, SIN_FILTROS, 1)).toEqual(items);
  });

  it("«Incluidas en mi plan» esconde las de plan superior", () => {
    expect(filtrarPlantillas(items, { soloDeMiPlan: true, capacidad: null }, 1)).toEqual([XV]);
    expect(filtrarPlantillas(items, { soloDeMiPlan: true, capacidad: null }, 2)).toEqual(items);
  });

  it("el filtro de capacidad deja solo las que la declaran", () => {
    expect(filtrarPlantillas(items, { soloDeMiPlan: false, capacidad: "music" }, 2)).toEqual([BODA]);
    expect(filtrarPlantillas(items, { soloDeMiPlan: false, capacidad: "hashtags" }, 2)).toEqual(items);
    expect(filtrarPlantillas(items, { soloDeMiPlan: false, capacidad: "countdown" }, 2)).toEqual([]);
  });

  it("los filtros se combinan", () => {
    expect(filtrarPlantillas(items, { soloDeMiPlan: true, capacidad: "music" }, 1)).toEqual([]);
  });
});

describe("claveDePlantilla", () => {
  it("distingue dos versiones de la misma plantilla", () => {
    expect(claveDePlantilla(BODA)).toBe("boda-clasica@1.0.0");
    expect(claveDePlantilla({ ...BODA, version: "2.0.0" })).toBe("boda-clasica@2.0.0");
  });
});
