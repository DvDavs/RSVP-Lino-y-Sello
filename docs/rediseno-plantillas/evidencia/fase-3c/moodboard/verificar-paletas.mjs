#!/usr/bin/env node
// verificar-paletas.mjs — Node sin dependencias. Define las tres paletas como DATOS (hex sRGB
// derivados de OKLCH por `generar-escalas.mjs`), asigna cada rol semántico a un paso de escala en
// claro y en oscuro, calcula el contraste WCAG 2.x (luminancia relativa) de todas las parejas
// garantizadas y sale con código 1 si alguna baja de su umbral: 4,5:1 para texto normal, 3,0:1
// solo donde se declara texto grande o gráfico (bordes de control, anillo de foco, iconos).
//
// Es la semilla del `verify-contrast` del bloque 1 (romperá el build de `packages/tokens`).
// Ejecutar: `node verificar-paletas.mjs` (opción `--json` para volcar la semántica resuelta).

import { pathToFileURL } from "node:url";

// ─── Datos: tres paletas (hex sRGB derivados de OKLCH por generar-escalas.mjs) ─────────────
export const PALETAS = [
  {
    "id": "a",
    "nombre": "Bugambilia",
    "lema": "Rosa mexicano, tinta de cacao, jade y mango. Fiesta y elegancia a la manera de Barragán.",
    "escalas": {
      "primary": {
        "nombre": "bugambilia",
        "h": 352,
        "pasos": {
          "50": "#fff3f8",
          "100": "#ffe5ef",
          "200": "#ffcce1",
          "300": "#ffa4cc",
          "400": "#ff62b2",
          "500": "#e52995",
          "600": "#bb0076",
          "700": "#95005d",
          "800": "#710045",
          "900": "#530031"
        }
      },
      "support1": {
        "nombre": "anil",
        "h": 264,
        "pasos": {
          "50": "#f3f7ff",
          "100": "#e4edff",
          "200": "#ccddff",
          "300": "#a7c4ff",
          "400": "#76a2ff",
          "500": "#457cfd",
          "600": "#2a5cda",
          "700": "#1b46b4",
          "800": "#11338a",
          "900": "#0a2466"
        }
      },
      "support2": {
        "nombre": "jade",
        "h": 168,
        "pasos": {
          "50": "#eafcf4",
          "100": "#d3f6e7",
          "200": "#acedd3",
          "300": "#77dbb7",
          "400": "#2dbf94",
          "500": "#009e77",
          "600": "#007c5d",
          "700": "#006249",
          "800": "#004936",
          "900": "#003426"
        }
      },
      "accent": {
        "nombre": "mango",
        "h": 78,
        "pasos": {
          "50": "#fff5e7",
          "100": "#ffeaca",
          "200": "#fed698",
          "300": "#f2b95a",
          "400": "#d79700",
          "500": "#b07b00",
          "600": "#8b6000",
          "700": "#6e4b00",
          "800": "#523700",
          "900": "#3c2700"
        }
      },
      "success": {
        "nombre": "hierba",
        "h": 148,
        "pasos": {
          "50": "#edfcee",
          "100": "#d8f6db",
          "200": "#b7edbd",
          "300": "#8bda97",
          "400": "#57be6b",
          "500": "#1ca045",
          "600": "#007f30",
          "700": "#006425",
          "800": "#004b19",
          "900": "#003610"
        }
      },
      "danger": {
        "nombre": "chile",
        "h": 27,
        "pasos": {
          "50": "#fff4f2",
          "100": "#ffe6e3",
          "200": "#ffcfc9",
          "300": "#ffaba1",
          "400": "#ff7266",
          "500": "#ea3d38",
          "600": "#c50516",
          "700": "#9e000e",
          "800": "#780008",
          "900": "#580004"
        }
      },
      "warning": {
        "nombre": "ambar",
        "h": 58,
        "pasos": {
          "50": "#fff5ed",
          "100": "#ffe8d7",
          "200": "#ffd2b2",
          "300": "#ffb072",
          "400": "#ee8722",
          "500": "#c66b00",
          "600": "#9c5300",
          "700": "#7c4100",
          "800": "#5e2f00",
          "900": "#442100"
        }
      },
      "info": {
        "nombre": "cielo",
        "h": 236,
        "pasos": {
          "50": "#eef8ff",
          "100": "#daf1ff",
          "200": "#b7e3ff",
          "300": "#7ecfff",
          "400": "#2ab1f2",
          "500": "#0091cb",
          "600": "#0071a0",
          "700": "#00597f",
          "800": "#004260",
          "900": "#002f46"
        }
      }
    },
    "neutral": {
      "nombre": "hueso",
      "h": 62,
      "pasos": {
        "50": "#fdf9f6",
        "100": "#f7f1ec",
        "200": "#ece5de",
        "300": "#d8cfc8",
        "400": "#b3a9a1",
        "500": "#988d84",
        "600": "#6c6158",
        "700": "#554b42",
        "800": "#3d332b",
        "900": "#292018",
        "950": "#150e07"
      }
    }
  },
  {
    "id": "b",
    "nombre": "Talavera",
    "lema": "Cobalto de Puebla, terracota, olivo y sol. Artesanal, confiable, sin ser otro azul corporativo.",
    "escalas": {
      "primary": {
        "nombre": "cobalto",
        "h": 262,
        "pasos": {
          "50": "#f2f7ff",
          "100": "#e3edff",
          "200": "#caddff",
          "300": "#a4c5ff",
          "400": "#71a3ff",
          "500": "#3b7dff",
          "600": "#1a5cdf",
          "700": "#0b46b8",
          "800": "#04338e",
          "900": "#032468"
        }
      },
      "support1": {
        "nombre": "terracota",
        "h": 42,
        "pasos": {
          "50": "#fff4f0",
          "100": "#ffe7de",
          "200": "#ffd1bf",
          "300": "#ffad8d",
          "400": "#f28052",
          "500": "#d75a21",
          "600": "#af4000",
          "700": "#8b3100",
          "800": "#692300",
          "900": "#4d1800"
        }
      },
      "support2": {
        "nombre": "olivo",
        "h": 126,
        "pasos": {
          "50": "#f4f9ec",
          "100": "#e7f2d8",
          "200": "#d2e5b6",
          "300": "#b5d08d",
          "400": "#92b25e",
          "500": "#739432",
          "600": "#567506",
          "700": "#435d00",
          "800": "#314500",
          "900": "#223100"
        }
      },
      "accent": {
        "nombre": "sol",
        "h": 90,
        "pasos": {
          "50": "#fdf6e4",
          "100": "#faecc7",
          "200": "#f3da97",
          "300": "#e5c057",
          "400": "#c89f00",
          "500": "#a48200",
          "600": "#816500",
          "700": "#664f00",
          "800": "#4c3b00",
          "900": "#372900"
        }
      },
      "success": {
        "nombre": "hierba",
        "h": 150,
        "pasos": {
          "50": "#ecfcef",
          "100": "#d7f6dc",
          "200": "#b5edbf",
          "300": "#87db9a",
          "400": "#50bf6f",
          "500": "#03a14a",
          "600": "#007f38",
          "700": "#00642b",
          "800": "#004b1e",
          "900": "#003614"
        }
      },
      "danger": {
        "nombre": "chile",
        "h": 25,
        "pasos": {
          "50": "#fff4f3",
          "100": "#ffe6e4",
          "200": "#ffcfca",
          "300": "#ffaba3",
          "400": "#ff716b",
          "500": "#ea3c3f",
          "600": "#c50220",
          "700": "#9e0017",
          "800": "#78000e",
          "900": "#580008"
        }
      },
      "warning": {
        "nombre": "ambar",
        "h": 62,
        "pasos": {
          "50": "#fff5ec",
          "100": "#ffe8d5",
          "200": "#ffd3ad",
          "300": "#ffb169",
          "400": "#eb8911",
          "500": "#c16f00",
          "600": "#985600",
          "700": "#794300",
          "800": "#5b3100",
          "900": "#422200"
        }
      },
      "info": {
        "nombre": "agua",
        "h": 205,
        "pasos": {
          "50": "#e8fbfd",
          "100": "#d0f5f9",
          "200": "#a5eaf2",
          "300": "#6bd7e3",
          "400": "#00bac9",
          "500": "#0098a4",
          "600": "#007781",
          "700": "#005e66",
          "800": "#00464c",
          "900": "#003237"
        }
      }
    },
    "neutral": {
      "nombre": "hueso",
      "h": 70,
      "pasos": {
        "50": "#fdf9f6",
        "100": "#f6f1ec",
        "200": "#ece5de",
        "300": "#d7d0c7",
        "400": "#b2a9a0",
        "500": "#978d84",
        "600": "#6b6157",
        "700": "#544b41",
        "800": "#3c342a",
        "900": "#282017",
        "950": "#140e07"
      }
    }
  },
  {
    "id": "c",
    "nombre": "Jade",
    "lema": "Verde jade profundo, coral, ocre y cempasúchil. Fresco, natural, con el calor de la fiesta en los acentos.",
    "escalas": {
      "primary": {
        "nombre": "jade",
        "h": 178,
        "pasos": {
          "50": "#eafbf7",
          "100": "#d2f6ed",
          "200": "#aaecdc",
          "300": "#74dac4",
          "400": "#24bea5",
          "500": "#009c86",
          "600": "#007a69",
          "700": "#006152",
          "800": "#00483d",
          "900": "#00342b"
        }
      },
      "support1": {
        "nombre": "coral",
        "h": 24,
        "pasos": {
          "50": "#fff4f3",
          "100": "#ffe6e4",
          "200": "#ffcfcb",
          "300": "#ffaaa4",
          "400": "#fe726e",
          "500": "#e2484a",
          "600": "#be222d",
          "700": "#9b0d1d",
          "800": "#760413",
          "900": "#57030b"
        }
      },
      "support2": {
        "nombre": "ocre",
        "h": 86,
        "pasos": {
          "50": "#fdf6e8",
          "100": "#f9ecd0",
          "200": "#f1daa8",
          "300": "#e1c075",
          "400": "#c89e39",
          "500": "#a87f00",
          "600": "#846300",
          "700": "#694e00",
          "800": "#4e3a00",
          "900": "#382900"
        }
      },
      "accent": {
        "nombre": "cempasuchil",
        "h": 52,
        "pasos": {
          "50": "#fff4ee",
          "100": "#ffe8da",
          "200": "#ffd2b7",
          "300": "#ffaf7e",
          "400": "#f97d14",
          "500": "#ce6400",
          "600": "#a34e00",
          "700": "#813c00",
          "800": "#612c00",
          "900": "#471e00"
        }
      },
      "success": {
        "nombre": "hierba",
        "h": 145,
        "pasos": {
          "50": "#edfbed",
          "100": "#daf6da",
          "200": "#baecba",
          "300": "#90d992",
          "400": "#5fbd65",
          "500": "#2f9f3d",
          "600": "#008020",
          "700": "#006517",
          "800": "#004b0f",
          "900": "#003608"
        }
      },
      "danger": {
        "nombre": "chile",
        "h": 16,
        "pasos": {
          "50": "#fff4f4",
          "100": "#ffe6e6",
          "200": "#ffced0",
          "300": "#ffa9ae",
          "400": "#ff6e7e",
          "500": "#ec3157",
          "600": "#c4003e",
          "700": "#9c002f",
          "800": "#760022",
          "900": "#570016"
        }
      },
      "warning": {
        "nombre": "ambar",
        "h": 70,
        "pasos": {
          "50": "#fff5ea",
          "100": "#ffe9d0",
          "200": "#ffd4a3",
          "300": "#fab45f",
          "400": "#e19000",
          "500": "#b97500",
          "600": "#915b00",
          "700": "#734700",
          "800": "#573400",
          "900": "#3f2500"
        }
      },
      "info": {
        "nombre": "anil",
        "h": 258,
        "pasos": {
          "50": "#f2f7ff",
          "100": "#e2eeff",
          "200": "#c8deff",
          "300": "#a0c6ff",
          "400": "#68a5ff",
          "500": "#3d84ea",
          "600": "#1c65c8",
          "700": "#0c4ea5",
          "800": "#05397e",
          "900": "#03295d"
        }
      }
    },
    "neutral": {
      "nombre": "hueso",
      "h": 58,
      "pasos": {
        "50": "#fdf9f6",
        "100": "#f7f1ed",
        "200": "#ede4df",
        "300": "#d8cfc8",
        "400": "#b3a9a1",
        "500": "#988d85",
        "600": "#6c6158",
        "700": "#564b43",
        "800": "#3d332b",
        "900": "#291f18",
        "950": "#150d08"
      }
    }
  }
];

// ─── Contraste WCAG 2.x ─────────────────────────────────────────────────────────────────────────
function canal(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
export function luminancia(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}
export function contraste(fg, bg) {
  const a = luminancia(fg), b = luminancia(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// ─── Roles semánticos → paso de escala ─────────────────────────────────────────────────────────
// Regla: el brillo lo dan los pasos claros (50-300) en superficies grandes y los oscuros (600-900)
// en tipografía; el 500 es decorativo (formas), nunca texto ni fondo de texto.
const BLANCO = "#ffffff";

/** El anillo de foco NO es del matiz principal: debe verse sobre el botón primario. */
const FOCO = { a: "support1", b: "support1", c: "info" };

export function semantica(paleta, tema) {
  const e = Object.fromEntries(Object.entries(paleta.escalas).map(([rol, s]) => [rol, s.pasos]));
  const n = paleta.neutral.pasos;
  const foco = e[FOCO[paleta.id]];
  if (tema === "light") {
    return {
      surface: n[50], "surface-raised": BLANCO, "surface-alt": e.primary[50],
      ink: n[900], "ink-muted": n[700], "ink-placeholder": n[600],
      border: n[500], divider: n[200],
      primary: e.primary[600], "on-primary": BLANCO, "primary-hover": e.primary[700],
      "primary-soft": e.primary[100], "on-primary-soft": e.primary[800],
      "primary-bright": e.primary[500], link: e.primary[700],
      accent: e.accent[400], "on-accent": n[950], "accent-soft": e.accent[100], "on-accent-soft": e.accent[800],
      success: e.success[600], "on-success": BLANCO, "success-text": e.success[700], "success-soft": e.success[100], "on-success-soft": e.success[800],
      danger: e.danger[600], "on-danger": BLANCO, "danger-text": e.danger[600], "danger-soft": e.danger[100], "on-danger-soft": e.danger[800],
      warning: e.warning[400], "on-warning": n[950], "warning-text": e.warning[700], "warning-soft": e.warning[100], "on-warning-soft": e.warning[800],
      info: e.info[600], "on-info": BLANCO, "info-text": e.info[700], "info-soft": e.info[100], "on-info-soft": e.info[800],
      focus: foco[500],
      "support-1": e.support1[500], "support-1-soft": e.support1[100], "support-1-deep": e.support1[800],
      "support-2": e.support2[500], "support-2-soft": e.support2[100], "support-2-deep": e.support2[800],
    };
  }
  return {
    surface: n[950], "surface-raised": n[900], "surface-alt": n[800],
    ink: n[50], "ink-muted": n[300], "ink-placeholder": n[400],
    border: n[500], divider: n[800],
    primary: e.primary[300], "on-primary": n[950], "primary-hover": e.primary[200],
    "primary-soft": e.primary[900], "on-primary-soft": e.primary[100],
    "primary-bright": e.primary[500], link: e.primary[300],
    accent: e.accent[300], "on-accent": n[950], "accent-soft": e.accent[900], "on-accent-soft": e.accent[100],
    success: e.success[300], "on-success": n[950], "success-text": e.success[300], "success-soft": e.success[900], "on-success-soft": e.success[100],
    danger: e.danger[300], "on-danger": n[950], "danger-text": e.danger[300], "danger-soft": e.danger[900], "on-danger-soft": e.danger[100],
    warning: e.warning[300], "on-warning": n[950], "warning-text": e.warning[300], "warning-soft": e.warning[900], "on-warning-soft": e.warning[100],
    info: e.info[300], "on-info": n[950], "info-text": e.info[300], "info-soft": e.info[900], "on-info-soft": e.info[100],
    focus: foco[300],
    "support-1": e.support1[400], "support-1-soft": e.support1[900], "support-1-deep": e.support1[200],
    "support-2": e.support2[400], "support-2-soft": e.support2[900], "support-2-deep": e.support2[200],
  };
}

// ─── Parejas garantizadas: [texto/figura, fondo, umbral, nota] · umbral null = informativa ──────
export const PAREJAS = [
  ["ink", "surface", 4.5, "texto normal"],
  ["ink", "surface-raised", 4.5, "texto normal"],
  ["ink", "surface-alt", 4.5, "texto normal"],
  ["ink-muted", "surface", 4.5, "texto normal"],
  ["ink-muted", "surface-raised", 4.5, "texto normal"],
  ["ink-muted", "surface-alt", 4.5, "texto normal"],
  ["ink-placeholder", "surface-raised", 4.5, "texto normal (campo)"],
  ["border", "surface-raised", 3.0, "grafico: borde de control"],
  ["border", "surface", 3.0, "grafico: borde de control"],
  ["divider", "surface", null, "decorativo: separador"],
  ["on-primary", "primary", 4.5, "texto normal (boton)"],
  ["on-primary", "primary-hover", 4.5, "texto normal (boton hover)"],
  ["on-primary-soft", "primary-soft", 4.5, "texto normal (chip)"],
  ["primary", "surface", 3.0, "grafico: icono de accion, aro secundario"],
  ["primary", "surface-raised", 3.0, "grafico: icono de accion, aro secundario"],
  ["link", "surface", 4.5, "texto normal (enlace)"],
  ["link", "surface-raised", 4.5, "texto normal (enlace)"],
  ["link", "surface-alt", 4.5, "texto normal (enlace)"],
  ["primary-bright", "surface", null, "decorativo: formas"],
  ["on-accent", "accent", 4.5, "texto normal (acento calido)"],
  ["on-accent-soft", "accent-soft", 4.5, "texto normal"],
  ["on-success", "success", 4.5, "texto normal"],
  ["success-text", "surface", 4.5, "texto normal (estado)"],
  ["success-text", "surface-raised", 4.5, "texto normal (estado)"],
  ["on-success-soft", "success-soft", 4.5, "texto normal"],
  ["on-danger", "danger", 4.5, "texto normal"],
  ["danger-text", "surface", 4.5, "texto normal (error)"],
  ["danger-text", "surface-raised", 4.5, "texto normal (error)"],
  ["on-danger-soft", "danger-soft", 4.5, "texto normal"],
  ["on-warning", "warning", 4.5, "texto normal"],
  ["warning-text", "surface", 4.5, "texto normal (aviso)"],
  ["warning-text", "surface-raised", 4.5, "texto normal (aviso)"],
  ["on-warning-soft", "warning-soft", 4.5, "texto normal"],
  ["on-info", "info", 4.5, "texto normal"],
  ["info-text", "surface", 4.5, "texto normal"],
  ["info-text", "surface-raised", 4.5, "texto normal"],
  ["on-info-soft", "info-soft", 4.5, "texto normal"],
  ["focus", "surface", 3.0, "grafico: anillo de foco"],
  ["focus", "surface-raised", 3.0, "grafico: anillo de foco"],
  ["focus", "surface-alt", 3.0, "grafico: anillo de foco"],
  // El anillo de foco NUNCA toca el control: lleva un halo de 2 px de `surface` entre control y
  // anillo (`box-shadow: 0 0 0 2px surface, 0 0 0 5px focus` u `outline-offset: 2px`), así que su
  // color adyacente es siempre `surface`, ya verificado arriba. Por eso no existe la pareja
  // focus/primary: medirla sería medir algo que el sistema prohíbe dibujar.
  ["support-1-deep", "support-1-soft", 4.5, "texto normal (banda de apoyo 1)"],
  ["support-2-deep", "support-2-soft", 4.5, "texto normal (banda de apoyo 2)"],
];

export function verificar() {
  const filas = [];
  let fallos = 0, evaluadas = 0;
  for (const p of PALETAS) {
    for (const tema of ["light", "dark"]) {
      const s = semantica(p, tema);
      for (const [fg, bg, umbral, nota] of PAREJAS) {
        const r = contraste(s[fg], s[bg]);
        const ok = umbral === null ? null : r >= umbral;
        if (umbral !== null) { evaluadas++; if (!ok) fallos++; }
        filas.push({ paleta: `${p.id}:${p.nombre}`, tema, fg, bg, hexFg: s[fg], hexBg: s[bg], ratio: r, umbral, ok, nota });
      }
    }
  }
  return { filas, fallos, evaluadas };
}

function tabla() {
  const { filas, fallos, evaluadas } = verificar();
  const col = (t, n) => String(t).padEnd(n);
  console.log(col("paleta", 13) + col("tema", 6) + col("figura", 17) + col("fondo", 15) + col("hex", 17) + col("ratio", 7) + col("umbral", 7) + col("estado", 7) + "nota");
  console.log("-".repeat(118));
  for (const f of filas) {
    const estado = f.ok === null ? "info" : f.ok ? "OK" : "FALLA";
    console.log(col(f.paleta, 13) + col(f.tema, 6) + col(f.fg, 17) + col(f.bg, 15) + col(`${f.hexFg}/${f.hexBg}`, 17) + col(f.ratio.toFixed(2), 7) + col(f.umbral === null ? "-" : f.umbral.toFixed(1), 7) + col(estado, 7) + f.nota);
  }
  console.log("-".repeat(118));
  console.log(`${PALETAS.length} paletas x 2 temas x ${PAREJAS.length} parejas = ${filas.length} filas; ${evaluadas} con umbral; ${fallos} fallos.`);
  return fallos;
}

const esPrincipal = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (esPrincipal) {
  if (process.argv.includes("--json")) {
    const out = {};
    for (const p of PALETAS) out[p.id] = { light: semantica(p, "light"), dark: semantica(p, "dark") };
    console.log(JSON.stringify(out, null, 2));
  } else {
    process.exit(tabla() > 0 ? 1 : 0);
  }
}
