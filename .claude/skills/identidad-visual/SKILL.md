---
name: identidad-visual
description: Dirección de identidad visual y reglas de UI/UX del producto de invitaciones (chrome del editor, web pública, flujos y módulos futuros). Cárgala antes de crear o modificar cualquier componente, pantalla, icono, paleta, tipografía, formulario, flujo de usuario o texto de interfaz en frontend/. No aplica al diseño interno de las plantillas de invitación (tienen su propio sistema de tokens).
---

# Identidad visual del producto

Lee primero `docs/rediseno-plantillas/diseno/10-identidad-visual.md` (dirección completa, 10 principios) y hojea `docs/rediseno-plantillas/referencias/gigsalad/README.md` (capturas de referencia de actitud; nunca copiar).

## Reglas duras (rechazo automático en revisión)
- **Nunca emojis** en interfaz, textos, iconos, estados, correos ni documentación de usuario. Solo SVG propios o de librería abierta rediseñados a la retícula del sistema (`frontend/packages/icons`).
- **Nunca tipografía genérica ni del sistema** en títulos o cuerpo; usa las voces del sistema (`display`, `text`, `label`) desde los tokens. Nunca la fuente de cuerpo en títulos.
- **Nunca controles nativos sin estilo ni shadcn sin rediseñar**: usa los componentes de `frontend/packages/ui`; si falta uno, créalo ahí con todos sus estados y súmalo a la galería `/design`.
- **Color solo desde tokens** (`frontend/packages/tokens`): parejas fondo/texto garantizadas AA; nada de hex sueltos en componentes.
- **Fotos siempre con máscara, radio grande o forma**; nunca rectángulo duro sobre color plano. Sin imagen real, usa el placeholder del sistema y anota la imagen en `imagenes-pendientes.md`.
- **Formas de la biblioteca** (rayos, rayas, ondas, blobs, triángulos, cuadrados rotados, sombras de color) como recurso de composición: una protagonista por bloque.
- **Movimiento sobrio** y con `prefers-reduced-motion`.
- **Separación estricta** entre el chrome del producto y los tokens de las plantillas de invitación.
- Al cambiar algo de identidad (paleta, tipografía, forma, componente base): ADR en `docs/rediseno-plantillas/memoria/decisiones.md` y galería actualizada.

## Libertad
Todo lo demás es libre y se espera creatividad: proponer mejores paletas, formas nuevas, componentes nuevos, micro-interacciones, siempre que mejore el producto, sea accesible y quede documentado. Objetivo: un producto único, diferenciador, fácil de usar, bonito de ver y completamente funcional.
