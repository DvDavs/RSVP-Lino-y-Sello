---
name: ui-flujo-asistente
description: Construir un asistente por pasos (wizard) del producto. Cárgala cuando el encargo pida un flujo de varias pantallas con progreso — alta guiada, configuración por etapas, cualquier "asistente de..." nuevo en frontend/apps/web.
---

# ui-flujo-asistente

Antes de nada, carga `identidad-visual` (`.claude/skills/identidad-visual/SKILL.md`). Este skill
asume ya cargado ese contexto. La referencia viva de todo lo que sigue es el asistente de creación
real: `frontend/apps/web/components/asistente/AsistenteDeCreacion.tsx` (queda montado en
`app/(chrome)/editor/page.tsx`) — ábrelo junto a este skill, cada regla de abajo cita su línea.

## 1. El estado que importa vive en la URL, no en un store
Nada de `useState` para "en qué paso estoy": el paso y los datos que otro paso necesita son
parámetros de consulta (`?paso&tipo&inv&plantilla` en el asistente real, líneas 90-96). Así:
- El botón «atrás» del navegador funciona sin código adicional.
- Un enlace compartido a mitad de flujo lleva al mismo sitio para cualquiera.
- Una recarga a media faena no pierde en qué paso estabas.

Patrón de navegación entre pasos (`hrefDePaso`, línea 638): una función pura que arma la
`URLSearchParams` con TODO lo que el asistente necesita reconstruir su estado, y `router.push`/
`router.replace` a esa URL — nunca solo `router.push("/tu-ruta?paso=2")` con un literal, porque
pierde los demás parámetros que los pasos previos ya habían fijado.

## 2. `WizardProgress` — el progreso siempre visible
```tsx
import { WizardProgress, type PasoAsistente } from "@invitaciones/ui";

const pasosProgreso: readonly PasoAsistente[] = PASOS.map((id, indice) => ({
  id,
  etiqueta: es_MX.tuFlujo.pasos[id],
  estado: indice < actual ? "hecho" : indice === actual ? "actual" : "pendiente",
  ...(indice < actual ? { href: hrefDePaso(id, /* … los datos ya conocidos */) } : {}),
}));

<WizardProgress pasos={pasosProgreso} className="max-w-md" />
```
Solo los pasos **ya hechos** llevan `href` (línea 400): son la forma de "volver sin perder lo
escrito" — un enlace real a la URL con los datos ya elegidos, no un botón que reinicia el flujo. Un
paso futuro nunca es clicable. Etiquetas de los pasos en `lib/i18n.ts`, nunca literales.

## 3. Un objetivo por pantalla
Cada paso pregunta o resuelve UNA cosa (en el asistente real: 1 tipo de evento, 2 plantilla, 3 datos
básicos, 4 confirmación). Nunca combines dos decisiones en un paso "para ahorrar clics" — es
exactamente el antipatrón que la identidad visual rechaza. Si un paso necesita datos de un paso
anterior para decidir su contenido (el catálogo del paso 2 se filtra por el tipo elegido en el paso
1, línea ~190 `cargarCatalogoDelTipo`), pásalo por la URL, no por contexto de React compartido.

## 4. Siempre una salida visible
Ningún paso puede ser un callejón sin salida:
- Si el paso depende de una precondición que puede no cumplirse (sin sesión, sin invitaciones
  disponibles), la pantalla lo explica y da una acción real hacia adelante — mira el bloque
  `sesion === "sin"` (línea 380): título, texto y un botón que lleva a `/acceso` con
  `?volver=` puesto, nunca una pantalla en blanco o un `router.replace` silencioso sin explicación
  visible primero.
- Todo paso que no sea el primero tiene un «Volver» real (al paso anterior, con los datos que ya
  tenía) además del progreso clicable de `WizardProgress`.
- El paso final (`PasoListo` en el asistente real) siempre lleva a algo accionable, nunca solo un
  mensaje de "listo" sin botón.

## 5. Volver sin perder lo escrito
Dos mecanismos, según el tipo de dato:
- **Dato que decide el flujo** (tipo de evento, plantilla elegida, id de la invitación en curso):
  va en la URL (§1) — persiste automáticamente al volver porque `hrefDePaso` lo reincluye.
  Un `Select` que cambia ese dato usa `router.replace` (no `push`, para no ensuciar el historial con
  cada cambio de opción) hacia la URL recalculada — mira línea 479.
- **Dato de formulario dentro de un paso** (nombres, fecha, lugar en el paso 3): vive en estado de
  React del componente del paso mientras el usuario lo llena, y se envía por HTTP en el momento en
  que el paso avanza — no antes. Si el usuario retrocede y vuelve a avanzar sin recargar, React
  Server/Client normal ya conserva ese estado porque el componente no se desmonta; si SÍ puede
  desmontarse (navegación fuera y vuelta), pre-rellena desde lo último guardado por HTTP, nunca deja
  el campo en blanco si el dato ya existe en el servidor.

## 6. Sesión y errores de carga, no solo el camino feliz
El asistente real cubre, y el tuyo también debe cubrir:
- Sin sesión → explicación + salida a `/acceso?volver=<tu-ruta>` (nunca una redirección muda).
- Error de red al cargar el catálogo/datos del paso → mensaje de `lib/i18n.ts` con causa y acción de
  reintento, nunca una pantalla vacía silenciosa.
- Mientras se guarda (avanzar de paso escribe por HTTP): botón de avanzar con `loading`/`loadingText`
  del `Button` del sistema, deshabilitado solo durante ese envío.

## 7. Pruebas
- Unitaria por paso (Vitest + Testing Library) para la lógica de cada `Paso*.tsx` — mira
  `PasoTipoEvento.test.tsx`, `PasoDatos.test.tsx`, `PasoPlantilla.test.tsx` como plantilla.
- e2e del flujo completo contra el backend real, navegando por la URL igual que un usuario (nunca
  llamando funciones internas de React) — con una invitación y, si hace falta cuenta nueva, un
  usuario propios de la prueba (ver `pruebas-producto`, nunca la invitación sembrada compartida).
- Vuelve a probar explícitamente: recargar a mitad de flujo no pierde el paso; el botón «atrás» del
  navegador lleva al paso anterior con sus datos; un enlace directo a `?paso=3&...` sin haber pasado
  por 1 y 2 no rompe (o redirige al paso correcto con una razón visible, nunca un error genérico).

## Lista de verificación
- [ ] Estado del flujo en la URL (`useSearchParams`), no en un store aparte.
- [ ] `WizardProgress` con solo los pasos hechos como enlace.
- [ ] Un objetivo por pantalla, sin combinar decisiones.
- [ ] Ninguna pantalla es un callejón sin salida (precondición no cumplida → explicación + acción).
- [ ] «Volver» real en todo paso salvo el primero.
- [ ] Datos que deciden el flujo persisten en la URL; datos de formulario se guardan al avanzar, no antes.
- [ ] Sesión ausente y errores de carga cubiertos con mensajes de `lib/i18n.ts` y acción de reintento.
- [ ] Botón de avanzar con `loading` mientras guarda, deshabilitado solo entonces.
- [ ] e2e navegando por URL real, con datos propios de la prueba.
