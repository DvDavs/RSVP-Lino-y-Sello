# 3-UX — handoff · sólo las fricciones ALTAS

Recorrido real (Chromium + Playwright) sobre el `build` de producción de `apps/web` contra el
backend sembrado. **No pude completar la tarea del criterio de terminado sin ayuda:** me atasqué de
forma terminal en U-1 y U-2, y seguí sólo inyectando un token a mano y tecleando `/editor/3`.
Detalle, capturas y contraste contra `04 §6-§7` en `bitacora/3-ux.md`. Evidencia en
`evidencia/fase-3/ux/`.

**8 fricciones altas, ordenadas por daño.** Las cuatro primeras impiden la tarea; las cuatro
siguientes publican algo roto sin avisar. Siete de las ocho son promesas de `04 §6-§7` sin cablear.

| # | Fricción (alta) | Arreglo propuesto | Evidencia · `04` |
|---|---|---|---|
| U-2 | **«Elegir esta plantilla» no hace nada.** `type="submit"` fuera de todo formulario y sin manejador: cero peticiones, cero mensajes, en las dos tarjetas. El segundo verbo del criterio de terminado es imposible. | Cablear el botón a `POST …/document:choose-template` y navegar a `/editor/{id}`, con `aria-busy` y los tres errores ya nombrados en §7.1 p.2. | `06`,`07` · §7.1 p.2 |
| U-1 | **No hay forma de iniciar sesión.** `/editor` dice «Inicia sesión de nuevo» sin ningún acceso; «Ayuda» y «Mi cuenta» son `href="#"`; no existe ruta de login en el `build`. Aquí abandona la clienta, en el minuto 3. | Añadir la pantalla de acceso y hacer del aviso un botón **«Iniciar sesión»**; cablear o quitar los dos enlaces de la cabecera. | `02`,`03`,`04` · §7.1 p.1 («401 → redirección a login») |
| U-3 | **La fecha de la boda no se puede cambiar en ninguna parte.** Sale 🔒 en Portada y en Los novios con «Se toma de los datos de tu invitación», sin decir dónde. Tercer verbo del criterio, también imposible. | Añadir el botón **`[Editar allí]`** que §6.3 ya dibuja junto a esa frase, apuntando a la pantalla que sí edita la fecha. | `10`,`12-losnovios` · §6.3 (textual) |
| U-8 | **El editor no se puede usar en un teléfono.** A 390×844 desborda 182 px (`scrollWidth` 572 / `clientWidth` 390), **«Publicar» queda fuera de pantalla** en `x=481` y la vista previa no se ve. Incumple WCAG 2.2 AA 1.4.10. | Diseño de una columna por debajo de ~900 px: lista y vista previa en pestañas, cabecera apilada, «Publicar» siempre visible. *Requiere decidir el wireframe: §6 nunca dibujó el editor en móvil.* | `44` · hueco de **diseño** (D-16) |
| U-5 | **Publicas y el invitado ve la versión anterior ~5 min.** Medido: publiqué «Paulina & Emilio», el diálogo dijo «✅ ya se puede ver en internet» y a t+0/2/5/10 s el enlace servía «Mariana & Rodrigo» (`s-maxage=300`, `stale-while-revalidate`). El backend **nunca** llama a `/api/revalidate` (0 peticiones) y el arranque no fija `REVALIDATE_SECRET`. | Invalidar `/i/[publicToken]` al publicar, como ya contrata §6; y no afirmar «ya se puede ver» hasta que la invalidación responda. | §1.11 · §6 tabla de rutas |
| U-6 | **El enlace que se comparte es `http://localhost/i/…`**, tal cual lo devuelve el servidor, tanto en «Copiar enlace» como en el texto de WhatsApp y en «Ver como invitado» (`ERR_CONNECTION_REFUSED`). Si lo manda, no le abre a nadie. | Construir el enlace con el origen público del sitio en vez de con el `publicUrl` del servidor, y fallar el arranque si ese origen es `localhost`. | `33`,`36` · §6.5 |
| U-4 | **Dos fechas distintas en la misma invitación, sin aviso.** Cambié la ceremonia al 22 de mayo en el itinerario y la portada siguió diciendo 18 de abril; se publica así. Los invitados se apuntan el día equivocado. | Añadir a la comprobación previa un bloqueo (o al menos un ⚠) cuando la fecha de la portada no coincida con la del primer momento del itinerario. | `14`,`15` · sin cubrir en §6-§7 |
| U-7 | **La foto demasiado grande falla en silencio.** Con un JPG de 27 MB no ocurre nada visible: el mensaje —bueno— se pinta en `y=928` con la ventana en 900, **28 px por debajo del borde**, y lejos del botón que falló. La galería sí avisa antes del límite; «Cambiar foto» no dice nada. | Mostrar el error pegado a «Cambiar foto» y desplazar el panel hasta él; añadir ahí el mismo pie que ya tiene la galería («JPG, PNG o WebP · hasta 8 MB»); y la barra de progreso que pide §7.1 p.7. | `21`,`22` · §7.1 p.7 |

**Contexto imprescindible para no romper lo que está bien.** El editor tiene partes claramente
logradas y ninguna de estas correcciones debería tocarlas: el guardado automático con
«Guardado hh:mm» y el aviso «Sin conexión — tus cambios se guardarán cuando vuelva»; la vista previa
en vivo y su desplazamiento a la sección elegida; la vista previa de paleta al pasar el ratón
(medida: cumple §7.1 p.8); el vocabulario sin jerga; la pantalla de publicado con WhatsApp; y el
teclado (foco visible en todo, trampa de foco correcta en el diálogo, Escape devuelve el foco al
botón que lo abrió). **`axe-core` AA da 0 violaciones** en editor, catálogo e invitado.

**19 fricciones medias/bajas** (U-9 a U-27) quedan en la bitácora; las cuatro que más rentan si
sobra tiempo: U-10 (el texto alternativo sigue describiendo la foto anterior tras reemplazarla),
U-11 (el diálogo dice «Todo listo para publicar» con un obligatorio vacío en pantalla), U-12
(«Despublicar» y «Generar un enlace nuevo» inertes) y U-17 (al abrir una sección el foco cae a
`<body>`).
