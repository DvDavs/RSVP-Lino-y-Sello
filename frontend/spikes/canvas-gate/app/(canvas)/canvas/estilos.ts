/**
 * CSS del lienzo, inyectado como `<style nonce>` (ver `layout.tsx`).
 * Solo `var(--inv-*)` para el color: los tokens del tema los aplica el cliente por CSSOM al recibir
 * `RENDER` (`documentElement.style.setProperty`), que **no** es un atributo `style` en línea y por
 * tanto no lo bloquea la CSP.
 */
export const cssDelLienzo = `
:root{
  --inv-color-bg:#F7F5EE; --inv-color-surface:#FFFFFF; --inv-color-ink:#2F3A2B;
  --inv-color-accent:#6B7B4A; --inv-color-accentInk:#FFFFFF; --inv-color-muted:#8A9178;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--inv-color-bg);color:var(--inv-color-ink)}
#lienzo{outline:none;min-height:100vh;padding:0 0 48px}
#lienzo[data-viewport="mobile"]{max-width:420px;margin:0 auto;box-shadow:0 0 0 1px rgba(0,0,0,.08)}
.espera{padding:64px 24px;text-align:center;color:var(--inv-color-muted);font-size:15px}
.seccion{padding:28px 24px;border-bottom:1px solid rgba(0,0,0,.06);scroll-margin-top:8px}
.seccion[hidden]{display:none}
.seccion-titulo{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--inv-color-muted);margin:0 0 12px}
h1.portada{font-size:44px;line-height:1.1;margin:0 0 8px;font-weight:600}
h2{font-size:24px;margin:0 0 8px;font-weight:600}
.bloque{display:block;width:100%;text-align:left;background:none;border:2px solid transparent;border-radius:6px;
  padding:6px 8px;margin:0 -8px;font:inherit;color:inherit;cursor:pointer}
.bloque:hover{border-color:rgba(107,123,74,.35)}
.bloque[data-selected="true"]{border-color:var(--inv-color-accent);background:rgba(107,123,74,.08)}
.bloque:focus-visible{outline:3px solid var(--inv-color-accent);outline-offset:2px}
.etiqueta{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--inv-color-muted)}
.valor{display:block;font-size:17px;line-height:1.45}
.lista{margin:4px 0 0;padding-left:18px}
img.foto{display:block;width:100%;height:auto;border-radius:8px;background:var(--inv-color-surface)}
img.portada{aspect-ratio:16/9;object-fit:cover}
#control-sin-cors{font-family:"ControlSinCors",monospace;font-size:13px;color:var(--inv-color-muted);padding:8px 24px}
@font-face{
  /* CONTROL NEGATIVO de C1: mismo woff2, servido SIN Access-Control-Allow-Origin.
     En origen opaco debe fallar. Si cargara, la medición de A2 no probaría nada. */
  font-family:"ControlSinCors";
  src:url("/control-fonts/plantilla-serif.woff2") format("woff2");
  font-display:swap;
}
`;
