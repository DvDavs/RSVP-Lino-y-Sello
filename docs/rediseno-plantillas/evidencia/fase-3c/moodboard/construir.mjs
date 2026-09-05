#!/usr/bin/env node
// construir.mjs — ensambla `index.html` a partir de `plantilla.html` (escrita a mano) y de los
// datos de `verificar-paletas.mjs` (escalas, semántica claro/oscuro y parejas AA). También escribe
// `semantica.css`: para cada paleta y tema, los tokens `--ui-*` resueltos a hex, de modo que
// cualquier bloque del moodboard se pinta con `data-paleta="a|b|c"` + `data-theme="light|dark"`.
// Node sin dependencias. Ejecutar: `node construir.mjs`.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PALETAS, PAREJAS, contraste, semantica } from "./verificar-paletas.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const PASOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const PASOS_N = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const ETIQUETA = { primary: "principal", support1: "apoyo 1", support2: "apoyo 2", accent: "acento calido", success: "exito", danger: "peligro", warning: "aviso", info: "info" };

function luminanciaTexto(hex) {
  return contraste("#000000", hex) >= contraste("#ffffff", hex) ? "#150e07" : "#ffffff";
}

// ─── semantica.css ───────────────────────────────────────────────────────────────────────────
let css = "/* GENERADO por construir.mjs a partir de verificar-paletas.mjs */\n";
for (const p of PALETAS) {
  for (const tema of ["light", "dark"]) {
    const s = semantica(p, tema);
    css += `[data-paleta="${p.id}"][data-theme="${tema}"], [data-paleta="${p.id}"] [data-theme="${tema}"] {\n`;
    for (const [k, v] of Object.entries(s)) css += `  --ui-${k}: ${v};\n`;
    css += "}\n";
  }
}
writeFileSync(join(AQUI, "semantica.css"), css);

// ─── Fragmentos por paleta ───────────────────────────────────────────────────────────────────
function escalasHtml(p) {
  let h = '<div class="escalas">';
  for (const [rol, e] of Object.entries(p.escalas)) {
    h += `<div class="escala"><div class="nombre"><b>${e.nombre}</b>${ETIQUETA[rol]} · ${e.h}°</div><div class="pasos">`;
    for (const paso of PASOS) {
      const hex = e.pasos[paso];
      h += `<div class="paso" style="background:${hex};color:${luminanciaTexto(hex)}">${paso}<small>${hex}</small></div>`;
    }
    h += "</div></div>";
  }
  h += `<div class="escala neutral"><div class="nombre"><b>${p.neutral.nombre}</b>neutros calidos · ${p.neutral.h}°</div><div class="pasos">`;
  for (const paso of PASOS_N) {
    const hex = p.neutral.pasos[paso];
    h += `<div class="paso" style="background:${hex};color:${luminanciaTexto(hex)}">${paso}<small>${hex}</small></div>`;
  }
  return h + "</div></div></div>";
}

function tablaAA(p) {
  let h = '<div class="scroll-x"><table class="aa"><thead><tr><th>pareja</th><th>claro</th><th>ratio</th><th>oscuro</th><th>ratio</th><th>umbral</th><th>uso</th></tr></thead><tbody>';
  const sl = semantica(p, "light"), sd = semantica(p, "dark");
  for (const [fg, bg, umbral, nota] of PAREJAS) {
    const rl = contraste(sl[fg], sl[bg]), rd = contraste(sd[fg], sd[bg]);
    const clase = (r) => (umbral === null ? "info" : r >= umbral ? "ok" : "falla");
    h += `<tr><td><code>${fg}</code> / <code>${bg}</code></td>`;
    h += `<td><span class="muestra" style="background:${sl[bg]};color:${sl[fg]}">Aa 12</span></td><td class="${clase(rl)}">${rl.toFixed(2)}</td>`;
    h += `<td><span class="muestra" style="background:${sd[bg]};color:${sd[fg]}">Aa 12</span></td><td class="${clase(rd)}">${rd.toFixed(2)}</td>`;
    h += `<td>${umbral === null ? "informativa" : umbral.toFixed(1)}</td><td>${nota}</td></tr>`;
  }
  return h + "</tbody></table></div>";
}

const RAYOS_MINI = `<svg class="rayos-mini" viewBox="0 0 200 200" aria-hidden="true"><g transform="translate(100 100)">${Array.from({ length: 12 }, (_, i) => `<path d="M0 0 L${(110 * Math.cos((i * 30 * Math.PI) / 180)).toFixed(1)} ${(110 * Math.sin((i * 30 * Math.PI) / 180)).toFixed(1)} A110 110 0 0 1 ${(110 * Math.cos(((i * 30 + 15) * Math.PI) / 180)).toFixed(1)} ${(110 * Math.sin(((i * 30 + 15) * Math.PI) / 180)).toFixed(1)} Z" fill="var(--ui-primary-soft)"/>`).join("")}</g></svg>`;

function mock(p, tema) {
  return `<div class="mock" data-paleta="${p.id}" data-theme="${tema}">
  <div class="banda">${RAYOS_MINI}</div>
  <span class="label tema">${tema === "light" ? "Claro" : "Oscuro (data-theme=dark)"}</span>
  <div class="tarjeta">
    <div class="row" style="justify-content:space-between"><span class="label">Boda · 18 de abril</span><span class="apoyos"><i style="background:var(--ui-support-1)"></i><i style="background:var(--ui-support-2)"></i><i style="background:var(--ui-accent)"></i></span></div>
    <h4>Mariana y Rodrigo</h4>
    <p>Tu invitación ya se puede ver. Comparte el enlace con tus invitados y sigue la confirmación desde aquí.</p>
    <div class="campo"><label>Correo del invitado</label><div class="input">nombre@correo.com</div></div>
    <div class="estados"><span class="chip"><i class="punto"></i>Publicada</span><span class="chip chip-acento">Plan 2</span><span class="chip chip-exito">128 confirmados</span><span class="chip chip-aviso">3 por revisar</span><span class="chip chip-peligro">Falta el lugar</span><span class="chip chip-info">Enlace copiado</span></div>
    <div class="acciones"><span class="btn btn-primario">Publicar</span><span class="btn btn-secundario">Ver como invitado</span><span class="btn btn-terciario">Ayuda</span></div>
    <p style="font-size:13px">Enlace: <a href="#">invitaciones.mx/i/01J8ZC</a> · <span style="color:var(--ui-danger-text);font-weight:600">Hay un dato pendiente</span> · <span style="color:var(--ui-success-text);font-weight:600">Guardado 12:41</span></p>
  </div>
</div>`;
}

function seccionPaleta(p) {
  return `${escalasHtml(p)}
<h3 style="margin-top:32px">Parejas semánticas verificadas (claro y oscuro)</h3>
<p class="muted" style="margin-bottom:12px;font-size:14px">Cada fila la calcula <code>verificar-paletas.mjs</code> (luminancia relativa WCAG 2.x). Umbral 4,5 para texto normal; 3,0 solo donde se declara gráfico; las informativas son decorativas y no gatean el build.</p>
${tablaAA(p)}
<h3 style="margin-top:32px">La paleta en uso: tarjeta, botones y chips</h3>
<div class="mockups" style="margin-top:12px">${mock(p, "light")}${mock(p, "dark")}</div>`;
}

// ─── Formas paramétricas (la misma matemática que tendrán los componentes de `ui/shapes`) ────
/** PRNG determinista (mulberry32): misma `seed`, mismo blob, en servidor y en cliente. */
function prng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
/** Blob orgánico: `n` puntos en polar con radio y ángulo perturbados; cierre suave Catmull-Rom → Bézier. */
export function blob(seed = 1, n = 7, amp = 0.22, r = 42, cx = 50, cy = 50) {
  const rnd = prng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * (Math.PI / n);
    const rr = r * (1 + (rnd() - 0.5) * 2 * amp);
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  const f = (v) => v.toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + " Z";
}
/** Sello festoneado (estrella suave): r(θ) = R + a·cos(nθ). Máscara de foto y fondo de insignia. */
export function sello(n = 12, a = 4, R = 44, cx = 50, cy = 50, pasos = 240) {
  let d = "";
  for (let i = 0; i <= pasos; i++) {
    const th = (i / pasos) * Math.PI * 2;
    const r = R + a * Math.cos(n * th);
    d += `${i === 0 ? "M" : "L"}${(cx + r * Math.cos(th)).toFixed(1)} ${(cy + r * Math.sin(th)).toFixed(1)}`;
  }
  return d + " Z";
}
/** Rayos radiales: `n` cuñas alternas de radio `R` centradas en (0,0); la otra mitad la pinta el fondo. */
export function rayos(n = 12, R = 120) {
  const f = (v) => v.toFixed(1);
  let d = "";
  for (let i = 0; i < n; i++) {
    const a0 = (i * 2 * Math.PI) / n, a1 = a0 + Math.PI / n;
    d += `M0 0 L${f(R * Math.cos(a0))} ${f(R * Math.sin(a0))} A${R} ${R} 0 0 1 ${f(R * Math.cos(a1))} ${f(R * Math.sin(a1))} Z `;
  }
  return d.trim();
}

let html = readFileSync(join(AQUI, "plantilla.html"), "utf8");
// Inclusión de partes escritas a mano: {{INCLUDE:partes/xx.html}}
html = html.replace(/\{\{INCLUDE:([^}]+)\}\}/g, (_, ruta) => readFileSync(join(AQUI, ruta), "utf8"));
// Formas paramétricas: {{BLOB:seed[:n[:amp]]}}, {{SELLO:n[:a]}}, {{RAYOS:n[:R]}}
html = html.replace(/\{\{BLOB:(\d+)(?::(\d+))?(?::([\d.]+))?\}\}/g, (_, s, n, amp) => blob(Number(s), n ? Number(n) : 7, amp ? Number(amp) : 0.22));
html = html.replace(/\{\{SELLO:(\d+)(?::([\d.]+))?\}\}/g, (_, n, a) => sello(Number(n), a ? Number(a) : 4));
html = html.replace(/\{\{RAYOS:(\d+)(?::(\d+))?\}\}/g, (_, n, R) => rayos(Number(n), R ? Number(R) : 120));
for (const p of PALETAS) html = html.replace(`{{PALETA_${p.id.toUpperCase()}}}`, seccionPaleta(p));
const restos = html.match(/\{\{[A-Z_]+\}\}/g);
if (restos) throw new Error(`Marcadores sin resolver: ${restos.join(", ")}`);
writeFileSync(join(AQUI, "index.html"), html);
console.log(`index.html: ${(html.length / 1024).toFixed(1)} KB · semantica.css escrita`);
