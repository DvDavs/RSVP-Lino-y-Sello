#!/usr/bin/env node
// generar-escalas.mjs — genera las escalas 50-900 de cada matiz de las tres paletas EN OKLCH
// (luminosidad perceptualmente uniforme), las recorta al gamut sRGB reduciendo solo el croma, y
// escribe `paletas.generadas.mjs` (datos para `verificar-paletas.mjs`), `paletas.css` (variables
// para el moodboard) y `paletas.md` (tablas para `diseno/11-sistema-de-diseno.md`).
// Node ≥ 18, sin dependencias. Ejecutar: `node generar-escalas.mjs`.
//
// Matemática: OKLab → LMS → sRGB lineal (Björn Ottosson, 2020) y codificación gamma sRGB.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));

// ─── Conversión OKLCH → sRGB ───────────────────────────────────────────────────────────────────
function oklchALinear(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const enGamut = (rgb) => rgb.every((c) => c >= -1e-6 && c <= 1 + 1e-6);

/** Recorte al gamut: baja el croma (nunca la luminosidad ni el matiz) hasta que el color quepa. */
function oklchAHex(L, C, h) {
  let lo = 0, hi = C, rgb = oklchALinear(L, C, h);
  if (!enGamut(rgb)) {
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      rgb = oklchALinear(L, mid, h);
      if (enGamut(rgb)) lo = mid; else hi = mid;
    }
    rgb = oklchALinear(L, lo, h);
  }
  return "#" + rgb.map((c) => Math.round(Math.max(0, Math.min(1, gamma(c))) * 255).toString(16).padStart(2, "0")).join("");
}

// ─── Escala ─────────────────────────────────────────────────────────────────────────────────────
// Luminosidad OKLCH por paso (igual para todos los matices: así 600 de cualquier paleta tiene el
// mismo peso visual y las mismas garantías de contraste con blanco).
const PASOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const L_PASO = { 50: 0.975, 100: 0.945, 200: 0.895, 300: 0.82, 400: 0.72, 500: 0.62, 600: 0.52, 700: 0.44, 800: 0.36, 900: 0.29 };
// Curva de croma: máximo en 500-600, menos en los extremos (los claros son superficies, los oscuros tinta).
const F_CROMA = { 50: 0.14, 100: 0.28, 200: 0.5, 300: 0.72, 400: 0.9, 500: 1.0, 600: 1.0, 700: 0.9, 800: 0.75, 900: 0.6 };

// Neutros cálidos, 12 pasos (50-950), matiz 65° (hueso/cacao), croma pequeño pero nunca cero.
const PASOS_N = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const L_N = { 50: 0.985, 100: 0.962, 200: 0.925, 300: 0.86, 400: 0.74, 500: 0.65, 600: 0.5, 700: 0.42, 800: 0.33, 900: 0.25, 950: 0.17 };
const C_N = { 50: 0.006, 100: 0.009, 200: 0.012, 300: 0.014, 400: 0.016, 500: 0.018, 600: 0.02, 700: 0.02, 800: 0.02, 900: 0.02, 950: 0.018 };

function escala(h, cmax) {
  const out = {};
  for (const p of PASOS) out[p] = oklchAHex(L_PASO[p], cmax * F_CROMA[p], h);
  return out;
}
function neutros(h) {
  const out = {};
  for (const p of PASOS_N) out[p] = oklchAHex(L_N[p], C_N[p], h);
  return out;
}

// ─── Las tres paletas: nombre, matices (matiz OKLCH en grados, croma máximo) ───────────────────
// Ninguna tiene púrpura/violeta (≈ 280-320°) como principal.
const PALETAS = [
  {
    id: "a", nombre: "Bugambilia",
    lema: "Rosa mexicano, tinta de cacao, jade y mango. Fiesta y elegancia a la manera de Barragán.",
    matices: {
      primary: { nombre: "bugambilia", h: 352, c: 0.235 },
      support1: { nombre: "anil", h: 264, c: 0.2 },
      support2: { nombre: "jade", h: 168, c: 0.15 },
      accent: { nombre: "mango", h: 78, c: 0.18 },
      success: { nombre: "hierba", h: 148, c: 0.17 },
      danger: { nombre: "chile", h: 27, c: 0.21 },
      warning: { nombre: "ambar", h: 58, c: 0.18 },
      info: { nombre: "cielo", h: 236, c: 0.16 },
    },
    neutroH: 62,
  },
  {
    id: "b", nombre: "Talavera",
    lema: "Cobalto de Puebla, terracota, olivo y sol. Artesanal, confiable, sin ser otro azul corporativo.",
    matices: {
      primary: { nombre: "cobalto", h: 262, c: 0.21 },
      support1: { nombre: "terracota", h: 42, c: 0.17 },
      support2: { nombre: "olivo", h: 126, c: 0.13 },
      accent: { nombre: "sol", h: 90, c: 0.18 },
      success: { nombre: "hierba", h: 150, c: 0.17 },
      danger: { nombre: "chile", h: 25, c: 0.21 },
      warning: { nombre: "ambar", h: 62, c: 0.18 },
      info: { nombre: "agua", h: 205, c: 0.14 },
    },
    neutroH: 70,
  },
  {
    id: "c", nombre: "Jade",
    lema: "Verde jade profundo, coral, ocre y cempasúchil. Fresco, natural, con el calor de la fiesta en los acentos.",
    matices: {
      primary: { nombre: "jade", h: 178, c: 0.14 },
      support1: { nombre: "coral", h: 24, c: 0.19 },
      support2: { nombre: "ocre", h: 86, c: 0.14 },
      accent: { nombre: "cempasuchil", h: 52, c: 0.2 },
      success: { nombre: "hierba", h: 145, c: 0.17 },
      danger: { nombre: "chile", h: 16, c: 0.22 },
      warning: { nombre: "ambar", h: 70, c: 0.18 },
      info: { nombre: "anil", h: 258, c: 0.17 },
    },
    neutroH: 58,
  },
];

const generadas = PALETAS.map((p) => {
  const escalas = {};
  for (const [rol, m] of Object.entries(p.matices)) escalas[rol] = { nombre: m.nombre, h: m.h, pasos: escala(m.h, m.c) };
  return { id: p.id, nombre: p.nombre, lema: p.lema, escalas, neutral: { nombre: "hueso", h: p.neutroH, pasos: neutros(p.neutroH) } };
});

// ─── Salidas ─────────────────────────────────────────────────────────────────────────────────────
// 1. Datos para el verificador (módulo ES sin dependencias).
writeFileSync(
  join(AQUI, "paletas.generadas.mjs"),
  "// GENERADO por generar-escalas.mjs — no editar a mano. Hex sRGB derivados de OKLCH.\nexport const PALETAS = " +
    JSON.stringify(generadas, null, 2) +
    ";\n",
);

// 2. CSS para el moodboard: `--a-primary-600`, `--a-neutral-900`, …
let css = "/* GENERADO por generar-escalas.mjs — escalas OKLCH → hex sRGB */\n:root {\n";
for (const p of generadas) {
  for (const [rol, e] of Object.entries(p.escalas)) for (const [paso, hex] of Object.entries(e.pasos)) css += `  --${p.id}-${rol}-${paso}: ${hex};\n`;
  for (const [paso, hex] of Object.entries(p.neutral.pasos)) css += `  --${p.id}-neutral-${paso}: ${hex};\n`;
}
css += "}\n";
writeFileSync(join(AQUI, "paletas.css"), css);

// 3. Tablas markdown para el documento de dirección.
let md = "";
for (const p of generadas) {
  md += `#### Paleta ${p.id.toUpperCase()} — ${p.nombre}\n\n${p.lema}\n\n| Rol (matiz OKLCH) | ${PASOS.join(" | ")} |\n|---|${PASOS.map(() => "---").join("|")}|\n`;
  for (const [rol, e] of Object.entries(p.escalas)) md += `| \`${rol}\` · ${e.nombre} (${e.h}°) | ${PASOS.map((s) => `\`${e.pasos[s]}\``).join(" | ")} |\n`;
  md += `\n| Neutros cálidos (${p.neutral.h}°) | ${PASOS_N.join(" | ")} |\n|---|${PASOS_N.map(() => "---").join("|")}|\n| \`neutral\` · ${p.neutral.nombre} | ${PASOS_N.map((s) => `\`${p.neutral.pasos[s]}\``).join(" | ")} |\n\n`;
}
writeFileSync(join(AQUI, "paletas.md"), md);

console.log("Escalas generadas para", generadas.map((p) => `${p.id}:${p.nombre}`).join(", "));
for (const p of generadas) {
  console.log(`\n[${p.id}] ${p.nombre}`);
  for (const [rol, e] of Object.entries(p.escalas)) console.log(`  ${rol.padEnd(9)} ${e.nombre.padEnd(12)}`, PASOS.map((s) => e.pasos[s]).join(" "));
  console.log(`  neutral   ${p.neutral.nombre.padEnd(12)}`, PASOS_N.map((s) => p.neutral.pasos[s]).join(" "));
}
