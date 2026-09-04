// lighthouserc.cjs — compuerta (b) de `04 §16.2`: LCP y el resto de Core Web Vitals con
// `@lhci/cli@0.15.1`, preajuste **mobile**, **3 corridas y mediana**.
//
// Por qué `.cjs` y no el `.json` que dejó el bloque 3-1: la URL de la invitación de demostración NO
// es una constante. `scripts/seed-demo.sh` acuña un `publicToken` nuevo cada vez que se siembra
// sobre el clúster efímero (`PublicTokenGenerator` con `SecureRandom`, contratos §5), así que un
// literal en un `.json` queda obsoleto en la siguiente sesión — el `.json` traía, de hecho,
// `PLACEHOLDER_SEED_TOKEN`, que no es una URL real. Aquí la URL se resuelve al arrancar, por la API
// REAL, con el mismo descubrimiento que usan las e2e (`e2e/util/demo.ts`).
//
// `LHCI_URL` la sobrescribe si alguien ya sabe la URL exacta (CI con un sembrado propio).
// Este archivo ES CommonJS a propósito: `@lhci/cli` carga su configuración con `require()`.
/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync } = require("node:child_process");

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:6003";
const WEB = process.env.LHCI_WEB_BASE ?? "http://127.0.0.1:3000";
const EMAIL = process.env.TPL_DEMO_EMAIL ?? "demo.boda@example.com";
const PASS = process.env.TPL_DEMO_PASS ?? "Demo1234!";

/** Descubre el `publicToken` de la invitación publicada por `scripts/seed-demo.sh`. Síncrono a
 *  propósito: la configuración de LHCI se evalúa antes de que exista un bucle de eventos propio. */
function descubrirToken() {
  if (process.env.TPL_DEMO_PUBLIC_TOKEN) return process.env.TPL_DEMO_PUBLIC_TOKEN;
  const guion = `
    const API=${JSON.stringify(API)};
    (async()=>{
      const t=await fetch(API+"/auth/token",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email:${JSON.stringify(EMAIL)},password:${JSON.stringify(PASS)}})});
      if(!t.ok) throw new Error("auth/token "+t.status);
      const {accessToken}=await t.json();
      for(let id=1;id<=24;id++){
        const r=await fetch(API+"/editor/invitations/"+id+"/document",{headers:{Authorization:"Bearer "+accessToken}});
        if(r.status!==200) continue;
        const d=await r.json();
        if(!d.publicToken) continue;
        const e=await fetch(API+"/public/i/"+d.publicToken+"/exists");
        if(!e.ok) continue;
        if(!(await e.json()).published) continue;
        process.stdout.write(d.publicToken); return;
      }
      throw new Error("sin invitación publicada: ejecuta scripts/seed-demo.sh");
    })().catch(e=>{console.error(String(e.message));process.exit(1);});
  `;
  return execFileSync(process.execPath, ["-e", guion], { encoding: "utf8" }).trim();
}

const url = process.env.LHCI_URL ?? `${WEB}/i/${descubrirToken()}`;

module.exports = {
  ci: {
    collect: {
      // `04 §16.2` pide 3 corridas y mediana. Se suben a 5 por la POLÍTICA ANTI-FLAKE de esa misma
      // sección ("si el ruido del runner la vuelve inestable se sube `numberOfRuns`, NO se baja el
      // umbral"): en este contenedor, ~1 de cada 3 corridas termina con `NO_LCP` — Lighthouse no
      // encuentra ningún evento de traza `largestContentfulPaint::Candidate` aunque el FCP y el
      // Speed Index sí salgan (medido, `evidencia/fase-3/render-publico/lhci.txt`). Con 5 corridas
      // la mediana se calcula siempre sobre corridas válidas. El umbral sigue siendo 2 500 ms.
      numberOfRuns: 5,
      startServerCommand: "pnpm run start",
      startServerReadyPattern: "Ready in",
      url: [url],
      // `04 §16.2` fija el preajuste MÓVIL (Moto G Power, 4G lento): es donde se abre una
      // invitación que llega por WhatsApp. El ejemplo JSON de `04` ponía `"desktop"` y el texto
      // aclaraba "el preajuste real es `mobile`"; manda el texto. En Lighthouse 12 **no existe un
      // preajuste llamado "mobile"**: móvil es el comportamiento POR DEFECTO (`formFactor: mobile`
      // + `screenEmulation` de Moto G Power + estrangulamiento 4G), y los únicos presets son
      // `perf`, `experimental` y `desktop`. Por eso aquí no se pasa `preset` ninguno.
      settings: {
        formFactor: "mobile",
        screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
        // Este entorno corre como root y Chromium se niega a arrancar su zygote sin `--no-sandbox`
        // ("Running as root without --no-sandbox is not supported", crbug.com/638180). Es una
        // concesión al CONTENEDOR de esta sesión, no a la medición: no cambia el rendimiento.
        chromeFlags: "--no-sandbox --disable-dev-shm-usage",
      },
    },
    assert: {
      assertions: {
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 200 }],
        "categories:accessibility": ["error", { minScore: 1 }],
      },
    },
    upload: { target: "filesystem", outputDir: "./.lighthouseci" },
  },
};
