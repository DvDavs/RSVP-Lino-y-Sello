# `/legal` — sesión **E3** (cuenta, marca y legal)

**Esto es un marcador del andamio 5-0d y se sustituye ENTERO.** Hoy no lee nada y no llama al backend.

## Qué pantalla va aquí
Aviso de privacidad, términos del servicio y política de cookies, en es-MX. Probablemente tres
subrutas (`/legal/privacidad`, `/legal/terminos`, `/legal/cookies`) con un índice en `/legal`.

## Regla que no se puede saltar
El prompt maestro de la fase los pide **como borradores marcados para revisión legal**. Cada
documento lleva su aviso visible de que no ha pasado por abogado y la fecha de la última revisión.
No se publica texto legal presentado como definitivo sin que el dueño lo haya validado.

## Ficheros que E3 puede tocar desde aquí
Los mismos que en `/contacto/README.md`.

## Notas del andamio
- Grupo `(sitio)`, por eso `contenedor="div"`.
- Los enlaces del pie a `/legal` los añade E3 en `components/sitio/MarcoSitio.tsx`; hoy el pie no
  apunta aquí a propósito, para no ofrecer una página que todavía no dice nada.
