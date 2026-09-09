# `/perfil` — sesión **E3** (cuenta, marca y legal)

**Esto es un marcador del andamio 5-0d y se sustituye ENTERO.** Hoy no lee nada y no llama al backend.

## Qué pantalla va aquí
La cuenta de la clienta: datos mínimos del perfil, cambio de contraseña, cierre de sesión en todos
los dispositivos, y el estado de verificación del correo si `core/email` lo permite (si no lo
permite, E3 lo registra como ADR con el supuesto, tal y como pide el prompt maestro).

## Lo que E3 tiene que endurecer al construirla
`N-01` (token de recuperación devuelto sin autenticar) ya está cerrada en la fase 3-C. Lo que queda,
y que E3 hereda del inventario de 5-0b-A: **mensajes genéricos y sin enumeración** en registro y
recuperación (que no se pueda distinguir «ese correo no existe» de «ese correo existe»), y **límite
de intentos**. El cambio de contraseña invalida las sesiones abiertas.

## Ficheros que E3 puede tocar desde aquí
Los mismos que en `(sitio)/contacto/README.md`, más `src/main/kotlin/.../modules/product/account/**`.

## Notas del andamio
- Va en `(chrome)` y no en `(chrome)/(sitio)`: es producto detrás de sesión, no web de venta. Por eso
  usa el `contenedor="main"` por defecto.
- `noindex` es **permanente**.
