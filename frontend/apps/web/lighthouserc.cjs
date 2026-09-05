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
// PUERTO PROPIO (3-7 D3). `startServerCommand` levanta `next start`, que sin `PORT` escucha en el
// 3000. Si el 3000 YA está ocupado por otro proceso —esta máquina aloja varias sesiones de agentes
// en paralelo, cada una con su `next start`—, `next start` muere con `EADDRINUSE` pero LHCI sigue
// adelante y mide **la aplicación del otro proceso**: otro build, otro código, otra caché. Es una
// medición silenciosamente falsa, y es el candidato número uno a explicar por qué 3-3 midió una
// mediana de 2 314 ms y 3-6 midió 3 200-3 500 ms sobre el mismo código (bitácora 3-7 §4).
// Con `LHCI_PORT` cada sesión mide su propio servidor, y `comprobarPuertoLibre` rompe en vez de
// medir el de al lado.
const PORT = Number(process.env.LHCI_PORT ?? 3000);
const WEB = process.env.LHCI_WEB_BASE ?? `http://127.0.0.1:${PORT}`;
const EMAIL = process.env.TPL_DEMO_EMAIL ?? "demo.boda@example.com";
const PASS = process.env.TPL_DEMO_PASS ?? "Demo1234!";

/** Rompe si el puerto ya está ocupado: medir el servidor de otro no es una medición. */
function comprobarPuertoLibre() {
  if (process.env.LHCI_WEB_BASE) return; // servidor externo a propósito: es quien llama quien manda
  // Sondeo SÍNCRONO en un proceso aparte: la configuración de LHCI se evalúa con `require()`, sin
  // bucle de eventos propio donde esperar a un socket asíncrono.
  const guion = `const n=require("node:net");const s=n.connect(${PORT},"127.0.0.1");
    s.on("connect",()=>{process.stdout.write("ocupado");s.destroy();});
    s.on("error",()=>{process.stdout.write("libre");});
    s.setTimeout(1500,()=>{process.stdout.write("libre");s.destroy();});`;
  const ocupado = execFileSync(process.execPath, ["-e", guion], { encoding: "utf8" }).trim() === "ocupado";
  if (ocupado) {
    throw new Error(
      `LHCI: el puerto ${PORT} ya está ocupado. \`next start\` no podría arrancar y Lighthouse mediría ` +
        `la aplicación de OTRO proceso. Usa \`LHCI_PORT=<libre> pnpm --filter web run lhci\`, o pon ` +
        `\`LHCI_WEB_BASE\` si el servidor de ese puerto es tuyo a propósito.`,
    );
  }
}
comprobarPuertoLibre();

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
      // `04 §16.2` pide **3 corridas y mediana**, y autoriza SUBIRLAS —nunca bajar el umbral— si el
      // ruido del runner vuelve inestable la compuerta. 3-3 las subió a 5 por los `NO_LCP`; 3-7 las
      // deja en 5, ya sin esa razón: con `throttlingMethod: "devtools"` (abajo) y la portada
      // corregida, 8 de 8 corridas dan valor y la dispersión es de ±40 ms (bitácora 3-7 §4).
      numberOfRuns: 5,
      startServerCommand: `PORT=${PORT} pnpm run start`,
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
        // ── EL AJUSTE QUE RESUELVE LA CONTRADICCIÓN 3-3 / 3-6 (bitácora 3-7 §4) ──────────────────
        // Por defecto Lighthouse **no mide** el LCP bajo 4G lento: corre la página casi sin
        // estrangular y luego SIMULA el resultado con Lantern (`throttlingMethod: "simulate"`).
        // Sobre esta página ese modelo es BIMODAL: 15 corridas seguidas, mismo build, misma URL,
        // mismo servidor, dieron 11 valores en 2 015-2 317 ms y 4 en 3 211-3 326 ms, con un hueco
        // limpio entre 2 570 y 3 211 y sin NADA que los separe (TTFB 456-464 ms en todas, arranque
        // de JS 268-350 ms, hilo principal 790-926 ms, mismo elemento LCP). El escalón de ~1 000 ms
        // lo mete el propio modelo, que unas veces cuelga los `.woff2` del grafo de dependencias
        // del texto de portada y otras no.
        //
        // Con 5 corridas, la mediana cae en un modo o en el otro POR AZAR. Eso —y no un cambio de
        // código— es lo que explica que 3-3 midiera 2 314 ms (CUMPLE) y 3-6 midiera 3 191/3 544/
        // 3 433 ms (NO CUMPLE): en las corridas crudas de AMBOS bloques aparecen los dos modos
        // (3-3 registró un 1 215 ms; 3-6, un 1 560,8 ms).
        //
        // `devtools` aplica el estrangulamiento DE VERDAD (4G lento + CPU ×4) y publica el LCP
        // OBSERVADO. Medido sobre el mismo build: 15/15 corridas válidas, 1 984-2 147 ms salvo un
        // 1 363, mediana 2 010 ms. Unimodal y con ±40 ms de dispersión. Es una medición, no un
        // modelo: por eso manda, y por eso el número deja de discrepar entre bloques.
        //
        // NO se toca el umbral (2 500 ms) ni el perfil de dispositivo. El coste es que cada corrida
        // tarda más, porque las descargas se estrangulan de verdad.
        throttlingMethod: "devtools",
        screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
        // `--no-sandbox`: este entorno corre como root y Chromium se niega a arrancar su zygote sin
        // él ("Running as root without --no-sandbox is not supported", crbug.com/638180). Es una
        // concesión al CONTENEDOR, no a la medición: no cambia el rendimiento.
        //
        // NO se emula `prefers-reduced-motion`: la página se mide con sus animaciones puestas, como
        // la ve el invitado. Se probó como paliativo de los `NO_LCP` (3-3 los documentó: Chrome no
        // registra como candidato a LCP un elemento invisible, y `cover-rise` arrancaba en
        // `opacity: 0`) y se descartó en cuanto la portada dejó de aparecer desde la transparencia
        // (`CoverSection.module.css`, D3 de 3-7): medir con las animaciones apagadas habría tapado
        // justo el defecto que costaba 1 562 ms de LCP.
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
