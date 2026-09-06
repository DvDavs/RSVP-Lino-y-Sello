// El gate de `ADR-1R-C-01` sobre los 9 pares REALES del repositorio (18 ficheros). Sin fixtures
// inventadas: si el dato cambia, la prueba lo dice.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { clasificar, ErrorTabla, lineaResumen, validarTabla } from "../src/clasificador.ts";
import { clasificarPlantilla, clasificarTodas, DIR_F1_POR_DEFECTO, leerF1, raizRepo, reglasMuertas } from "../src/f1.ts";
import { enumerarHojas } from "../src/hojas.ts";
import { PLANTILLAS } from "../src/plantillas.ts";
import { REGLAS_CONTENIDO } from "../src/reglas-contenido.ts";
import { REGLAS_VISUAL } from "../src/reglas-visual.ts";
import type { Regla } from "../src/taxonomia.ts";

const DIR = path.join(raizRepo(), DIR_F1_POR_DEFECTO);

/** Línea base medida por el prototipo de la fase 1 (`05 §4.1`): hojas por fichero visual. */
const HOJAS_VISUAL: Readonly<Record<string, number>> = {
  bautizo: 3830, boda_basico: 5003, boda_premium: 6623, boda_premium_2: 5500, comunion: 3830,
  confirmacion: 3830, cumpleanos: 3830, evento: 3671, xv_premium: 4793,
};

describe("enumerador de hojas", () => {
  it("reproduce EXACTAMENTE el conteo de hojas del prototipo de la fase 1 (05 §4.1)", () => {
    for (const p of PLANTILLAS) {
      const f1 = leerF1(p.templateId, DIR);
      expect(enumerarHojas(f1.visual).length, p.slugLegado).toBe(HOJAS_VISUAL[p.slugLegado]);
    }
  });
  it("enumera los contenedores vacíos como hoja (si no, un `items: []` desaparecería)", () => {
    const h = enumerarHojas({ a: [], b: {}, c: null });
    expect(h.map((x) => x.puntero)).toEqual(["/a", "/b", "/c"]);
  });
  it("arrastra el `id` legado más cercano como trazabilidad, nunca como blockId", () => {
    const h = enumerarHojas({ items: [{ id: "b-f1", text: { content: "x" } }] });
    expect(h.find((x) => x.puntero === "/items/0/text/content")?.idLegado).toBe("b-f1");
  });
});

describe("gate mecánico: cero patrones de hoja sin clasificar", () => {
  const todas = clasificarTodas(DIR);

  it("SIN MAPEAR = 0 en los 18 ficheros de F1", () => {
    const lineas: string[] = [];
    let sin = 0;
    for (const t of todas) {
      lineas.push(lineaResumen(t.visual.resumen), lineaResumen(t.contenido.resumen));
      sin += t.visual.resumen.patronesSinMapear.length + t.contenido.resumen.patronesSinMapear.length;
    }
    expect(sin, lineas.join("\n")).toBe(0);
  });

  it("toda regla lleva su decisión escrita y su cita de evidencia", () => {
    for (const r of [...REGLAS_VISUAL, ...REGLAS_CONTENIDO]) {
      expect(r.motivo.length, r.id).toBeGreaterThan(30);
      expect(r.evidencia.length, r.id).toBeGreaterThan(3);
    }
  });

  it("las reglas muertas son EXACTAMENTE las declaradas como red de seguridad", () => {
    const m = reglasMuertas(todas);
    const declaradas = [...REGLAS_VISUAL, ...REGLAS_CONTENIDO].filter((r) => r.redDeSeguridad).map((r) => r.id).sort();
    expect([...m.visual, ...m.contenido].sort()).toEqual(declaradas);
  });

  it("no hay categoría comodín: la taxonomía sólo tiene cuatro clases", () => {
    const clases = new Set([...REGLAS_VISUAL, ...REGLAS_CONTENIDO].map((r) => r.clase));
    expect([...clases].sort()).toEqual(["bloqueante", "descartada", "mapeada", "presentacion"]);
  });
});

describe("la compuerta NO es vacua: se sabotea la tabla y cae", () => {
  it("quitando V-COVER-TITLE, la red de seguridad convierte el título en BLOQUEANTE (no en silencio)", () => {
    const saboteada: Regla[] = REGLAS_VISUAL.filter((r) => r.id !== "V-COVER-TITLE");
    const f1 = leerF1(7, DIR);
    const c = clasificar("saboteada", enumerarHojas(f1.visual), saboteada, "no-boda");
    const h = c.hojas.find((x) => x.puntero === "/config/sectionCover/title/content");
    expect(h?.reglaId).toBe("V-GEN-CONTENT");
    expect(h?.clase).toBe("bloqueante");
  });
  it("quitando ADEMÁS la red de seguridad, el patrón queda SIN MAPEAR y el gate cae", () => {
    const saboteada: Regla[] = REGLAS_VISUAL.filter((r) => r.id !== "V-COVER-TITLE" && r.id !== "V-GEN-CONTENT");
    const f1 = leerF1(7, DIR);
    const c = clasificar("saboteada", enumerarHojas(f1.visual), saboteada, "no-boda");
    expect(c.resumen.patronesSinMapear).toEqual(["/config/sectionCover/title/content"]);
  });
  it("quitando la genérica de `md` se desploma la cobertura de presentación", () => {
    const saboteada: Regla[] = REGLAS_VISUAL.filter((r) => r.id !== "V-GEN-MDSMXS-MD");
    const f1 = leerF1(7, DIR);
    const c = clasificar("saboteada", enumerarHojas(f1.visual), saboteada, "no-boda");
    expect(c.resumen.patronesSinMapear.length).toBeGreaterThan(200);
  });
});

describe("validarTabla — casos negativos con el mensaje exacto", () => {
  const base: Regla = { id: "X", patron: "/a", clase: "descartada", motivo: "m", evidencia: "e" };
  it("regla duplicada", () => {
    expect(() => validarTabla([base, base])).toThrowError("Regla duplicada: X");
  });
  it("patrón que no empieza por /", () => {
    expect(() => validarTabla([{ ...base, patron: "a" }])).toThrowError('Regla X: el patrón debe empezar por "/" (a)');
  });
  it("motivo vacío", () => {
    expect(() => validarTabla([{ ...base, motivo: "  " }])).toThrowError("Regla X: falta el motivo escrito (P1)");
  });
  it("evidencia vacía", () => {
    expect(() => validarTabla([{ ...base, evidencia: "" }])).toThrowError("Regla X: falta la cita de evidencia");
  });
  it("mapeada sin destino", () => {
    expect(() => validarTabla([{ ...base, clase: "mapeada" }])).toThrowError('Regla X: clase "mapeada" sin destino');
  });
  it("destino en una clase que no es mapeada", () => {
    expect(() => validarTabla([{ ...base, destino: { tipo: "negocio", campo: "invitation.date" } }]))
      .toThrowError('Regla X: sólo "mapeada" lleva destino');
  });
  it("presentacion sin destino de presentación", () => {
    expect(() => validarTabla([{ ...base, clase: "presentacion" }]))
      .toThrowError('Regla X: clase "presentacion" sin destino de presentación');
  });
  it("es un ErrorTabla, no un Error cualquiera", () => {
    try { validarTabla([base, base]); expect.unreachable(); }
    catch (e) { expect(e).toBeInstanceOf(ErrorTabla); }
  });
  it("las dos tablas del producto pasan la validación", () => {
    expect(() => { validarTabla(REGLAS_VISUAL); validarTabla(REGLAS_CONTENIDO); }).not.toThrow();
  });
});

describe("cohortes de rol: boda y no-boda no se cruzan", () => {
  it("`boda_premium_2` declara los DOS mapas y la tabla lo resuelve por cohorte", () => {
    const cls = clasificarPlantilla(leerF1(11, DIR));
    const dest = (ptr: string) => cls.visual.hojas.find((h) => h.puntero === ptr);
    expect(dest("/config/sectionCouple/groomName/content")?.destino).toMatchObject({ rol: "celebrantA" });
    // presente y a null en el mismo fichero: NO puede acabar en `honoree`
    expect(dest("/config/sectionCouple/namePersonEvent")?.clase).toBe("descartada");
    expect(cls.visual.hojas.some((h) => h.destino?.tipo === "bloque" && h.destino.rol === "honoree")).toBe(false);
  });
  it("en una plantilla no-boda no aparece ni un rol de la pareja", () => {
    const cls = clasificarPlantilla(leerF1(7, DIR));
    const roles = new Set(cls.visual.hojas.concat(cls.contenido.hojas)
      .map((h) => (h.destino?.tipo === "bloque" || h.destino?.tipo === "itemBloque" ? h.destino.rol : null)));
    expect(roles.has("honoree")).toBe(true);
    for (const r of ["celebrantA", "celebrantB", "celebrantAPhoto", "celebrantBPhoto", "celebrantAText", "celebrantBText"]) {
      expect(roles.has(r as never), r).toBe(false);
    }
  });
});
