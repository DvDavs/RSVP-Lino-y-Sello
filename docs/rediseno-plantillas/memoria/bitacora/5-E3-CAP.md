# 5-E3-CAP · capturas de las siete pantallas de cuenta/legal (fase 5, sesión E3)

Encargo mecánico: sacar capturas de página completa a 390/768/1280 de las pantallas públicas de
`/contacto`, `/legal`, `/legal/privacidad`, `/legal/terminos`, `/acceso`, `/verificar-correo` (dos
estados) y de `/perfil` (con sesión). Sin tocar código de producto.

## Cómo se levantó el entorno

- Aislamiento obligatorio: worktree propio en `/tmp/cap-e3`, creado con
  `git worktree add /tmp/cap-e3 7d4b8e4` (el commit ya verificado que indicaba el encargo). El
  árbol principal no se tocó salvo para escribir esta bitácora y las capturas.
- Backend: `scripts/dev-backend.sh status` ya daba `EN MARCHA` en `:6003` cuando empecé —
  compartido con el resto de la sesión sobre el mismo clúster Postgres efímero
  (`/tmp/templates2-pg`, puerto 58489 en este arranque). No hizo falta `start`; lo reutilicé tal
  cual (idempotente, y el estado de Postgres no depende del árbol de trabajo).
- Frontend: `cd /tmp/cap-e3/frontend && pnpm install --frozen-lockfile`, luego
  `pnpm run build` (turbo) con las variables de `/contacto` puestas para la tanda "real":
  ```
  NEXT_PUBLIC_CONTACTO_WHATSAPP=+529514709685        # D-04
  NEXT_PUBLIC_CONTACTO_CORREO=hola@linoysello.com      # D-03
  NEXT_PUBLIC_SOPORTE_CORREO=soporte@linoysello.com    # D-03
  ```
  Verifiqué `ls apps/web/public/fonts/` antes de servir: los seis `.woff2` (Fraunces, Onest, Red Hat
  Mono) estaban copiados por el `build` de `@invitaciones/ui`.
- Servido con `PORT=3000 pnpm --filter web run start` (puertos 3000 y 6003 comprobados libres antes
  de arrancar; nadie más los usaba en este momento).
- Capturas con Playwright (`@playwright/test@1.62.1`, Chromium preinstalado
  `/opt/pw-browsers/chromium-1194`, nunca `playwright install`) desde un script Node suelto en el
  scratchpad de la sesión — mismo método que `e2e/editor-3c-evidencia.spec.ts` (`page.screenshot`),
  con `fullPage: true` para página completa. El script no forma parte del repo ni se commiteó.
- Cuenta para `/perfil`: `scripts/seed/cuenta.sh` desde el worktree → clienta de prueba
  `cliente-cuenta-615-9225a5@example.com` (evidentemente falsa, generada por el script), sesión
  inyectada en `sessionStorage` bajo la misma clave que usa `e2e/preparar.ts#sesionDemo`
  (`invitaciones.auth.token`).
- Token real de verificación: copiado el método de `e2e/cuenta.spec.ts#tokenDeVerificacion` — alta
  por la ruta real (`POST /auth/signup`, nunca por SQL) y luego
  `SELECT email_verification_token FROM customer WHERE id = …` contra el mismo Postgres efímero
  (`psql` directo, mismas coordenadas que usa `e2e/preparar.ts#sql`).
- **Aviso importante que documento para quien reuse este método**: un enlace de verificación se
  consume en la PRIMERA visita. Mi primer intento reutilizó el mismo token para las tres anchuras y
  la segunda y tercera captura cayeron en el estado "Ese enlace ya no sirve" en vez de "verificado".
  Lo corregí dando de alta DOS cuentas de prueba adicionales (una por cada ancho que faltaba) y
  recapturando `verificar-correo-verificado-768.png` y `-1280.png` con un token fresco cada una.
  Las tres cuentas de prueba usadas son correos `@example.com` generados por el script o por mí con
  sufijos aleatorios — ningún dato real.
- Bonus pedido por el encargo: reconstruí el frontend una segunda vez SIN
  `NEXT_PUBLIC_CONTACTO_WHATSAPP` (dejando los correos puestos) para capturar el estado "sin
  configurar" de una sola tarjeta de `/contacto` (`contacto-sin-whatsapp-1280.png`, un único ancho).
  Al terminar, paré el servidor (`fuser -k 3000/tcp`) y dejé la última build en el worktree tal cual
  quedó (sin WhatsApp) — no volví a reconstruir con las tres variables porque ya tenía las 24
  capturas "reales" guardadas en disco antes de ese segundo build.

## Capturas generadas (25 ficheros)

Todas en `docs/rediseno-plantillas/evidencia/fase-5-E3/`:

- `contacto-390.png`, `contacto-768.png`, `contacto-1280.png` — con WhatsApp y correos configurados.
- `contacto-sin-whatsapp-1280.png` — bonus: WhatsApp sin configurar, correos sí.
- `legal-390.png`, `legal-768.png`, `legal-1280.png`
- `legal-privacidad-390.png`, `legal-privacidad-768.png`, `legal-privacidad-1280.png`
- `legal-terminos-390.png`, `legal-terminos-768.png`, `legal-terminos-1280.png`
- `acceso-390.png`, `acceso-768.png`, `acceso-1280.png`
- `verificar-correo-invalido-390.png`, `-768.png`, `-1280.png` — token inventado que no existe.
- `verificar-correo-verificado-390.png`, `-768.png`, `-1280.png` — token real, consumido una vez por
  captura (tres cuentas de prueba distintas, ver arriba).
- `perfil-390.png`, `perfil-768.png`, `perfil-1280.png` — con sesión de
  `cliente-cuenta-615-9225a5@example.com` (clienta sembrada, sin invitaciones, correo sin verificar:
  es justo el estado que `/perfil` tiene que atender según `scripts/seed/cuenta.sh`).

## Qué se ve bien y qué observar

- Tipografía verificada: comprobé por consola (`getComputedStyle(h1).fontFamily`) que el titular de
  `/contacto` usa `"Fraunces Variable", Fraunces, "Fraunces Fallback", Georgia, …` — es la fuente
  correcta, no una genérica del sistema. Visualmente confirmado también en las capturas (serifa
  Fraunces en todos los titulares, Onest en el cuerpo).
- Todas las pantallas cargaron sin errores visibles, sin desbordes horizontales en 390, y con el
  chrome (cabecera/pie) consistente en las tres anchuras.
- `/contacto` con las variables puestas: número de WhatsApp `+52 95 1470 9685` (D-04) y correos
  `hola@linoysello.com` / `soporte@linoysello.com` (D-03) se ven correctamente en las tarjetas y en
  la sección de soporte.
- `/contacto` sin `NEXT_PUBLIC_CONTACTO_WHATSAPP`: la tarjeta de WhatsApp **desaparece entera** (no
  queda una tarjeta con un mensaje "sin configurar" en su lugar) — la de Correo se queda sola y el
  bloque de layout se reacomoda sin romperse. Es una decisión de diseño válida pero distinta de "una
  frase honesta en vez de botones" que describe el encargo para cuando FALTAN LAS DOS variables (ese
  caso, con las dos vacías, no lo probé — no me quedó claro si hacía falta y prioricé el resto del
  encargo; si el dueño quiere verlo, es una build más con las dos env vars fuera).
- Observación de diseño, no rotura: `/acceso` y los dos estados de `/verificar-correo` a 1280 dejan
  mucho blanco por debajo del formulario/tarjeta central (el contenido es corto y no está centrado
  verticalmente en un layout ancho). No lo capturé como "roto" porque no lo está — es un espacio
  vacío legítimo, pero puede que el dueño lo quiera comentar.
- No encontré ninguna pantalla rota, con contenido cortado, ni con datos que parezcan reales.

## Qué no se pudo capturar

- Nada de lo pedido quedó sin capturar. El único añadido que se quedó a medias fue el estado "sin
  configurar" de la sección de soporte de `/contacto` (cuando falta `NEXT_PUBLIC_SOPORTE_CORREO`, no
  `NEXT_PUBLIC_CONTACTO_WHATSAPP`) y el estado con las DOS variables de WhatsApp/contacto vacías a la
  vez — no forman parte del encargo mínimo y no los hice por tiempo.

## Dónde quedó el trabajo

- Worktree: `/tmp/cap-e3` (NO se borró, según instrucción). Su `frontend/apps/web/.next` quedó
  con la build SIN `NEXT_PUBLIC_CONTACTO_WHATSAPP` (la del bonus) — si alguien reutiliza este
  worktree para otra cosa, reconstruir con las tres variables antes de dar nada por bueno visualmente.
- Servidor de desarrollo parado (`fuser -k 3000/tcp`) al terminar; puerto 3000 libre de nuevo.
- Cuentas de prueba creadas (todas `@example.com`, ninguna real): `cliente-cuenta-615-9225a5@…`
  (perfil), y las de un solo uso `verif-b768-…@…` / `verif-c1280-…@…` para las capturas de
  verificación en 768/1280. No se borraron de la base — son cuentas de prueba idénticas a las que
  ya crea cualquier e2e contra el mismo backend compartido.
