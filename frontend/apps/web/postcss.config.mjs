// Tailwind 4 vía @tailwindcss/postcss — SOLO para el chrome del editor (04 §19). El grupo de rutas
// `(public)` y `(canvas)` no importan `globals.css`, así que este plugin no les alcanza.
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
