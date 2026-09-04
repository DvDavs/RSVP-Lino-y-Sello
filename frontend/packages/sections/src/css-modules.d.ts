// packages/sections/src/css-modules.d.ts — declaración de tipo para imports de CSS Modules.
// Vite (que usa vitest y, vía Next, apps/web) los transforma en tiempo de build a un objeto de
// nombres de clase; `tsc` necesita esta declaración para no fallar en `--noEmit`.
declare module "*.module.css" {
  const classes: { readonly [className: string]: string };
  export default classes;
}
