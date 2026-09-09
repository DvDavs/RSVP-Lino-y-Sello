# PROTOCOLO DE SESIÓN LIGERA (v1, 2026-09-09) — manda sobre cualquier regla anterior de memoria y de reparto

Motivo medido: E2 y E4 escribieron 12 ficheros .md nuevos cada una (1 155 y 1 535 líneas), y en E1, E2 y E4 murieron agentes de golpe por límite de la API sin dejar nada en disco. Este protocolo reduce lectura, reduce escritura y hace reanudable cualquier sesión.

## A. Lectura: el orquestador lee, el sub-agente recibe un digesto
1. El orquestador lee la memoria UNA vez y pega en cada brief un **DIGESTO ≤ 40 líneas**: contratos que aplican (rutas, tipos, códigos de error), reglas duras, hallazgos previos que le afectan, y los ficheros de código que va a tocar con sus líneas. El sub-agente **no lee memoria**: lee solo su digesto y como máximo **5 ficheros de código** que el brief nombra con rango de líneas.
2. Lista de NO LEER para todo sub-agente: prompt maestro, auditoría (`docs/analisis-plantillas/**`), `diseno/01-11`, handoffs y bitácoras de fases anteriores, `preguntas-abiertas.md` completo. Si el sub-agente cree que necesita algo de ahí, lo pide al orquestador en una línea; el orquestador se lo pega.
3. Antes de lanzar un agente caro, un **Haiku** comprueba en 1 minuto que cada ruta y fichero citado en el brief existe. Un brief con rutas falsas cuesta más tokens que esa comprobación.
4. Un brief cabe en **≤ 120 líneas**. Si no cabe, la tarea es demasiado grande: pártela.

## B. Escritura: una bitácora, un handoff, nada más
1. Por SESIÓN (no por agente): **una** bitácora `memoria/bitacora/<sesion>.md` (≤ 80 líneas, cada agente añade su sección `## <agente>` al final con `cat >>`) y **un** handoff `memoria/handoffs/<sesion>-para-<siguiente>.md` (≤ 40 líneas). **Ningún otro .md nuevo.** Salidas de pruebas: la cifra en una línea de la bitácora; el texto completo solo si el revisor lo pide, y entonces en `evidencia/<sesion>/*.txt`, nunca en .md.
2. ADR solo cuando cambia un contrato, **≤ 8 líneas** (id, decisión, motivo con una cita, consecuencia), añadida al final de `decisiones.md`. Pregunta abierta: **1 línea** al final de `preguntas-abiertas.md` con el supuesto tomado.
3. Ficheros compartidos (`00-INDICE.md`, `tablero.md`, `contratos.md`, `hoja-de-ruta.md`): **nunca se reescriben ni se reordenan**; sin fecha ni hora en cabeceras ni en «estado actual»; se edita solo la fila o sección afectada con un `sed`/`Edit` puntual, y lo nuevo se añade **al final**. El diff de un fichero compartido debe ser ≤ 15 líneas por sesión.
4. Prohibido: repetir en la bitácora lo que ya dice el mensaje del commit; narrar el proceso («primero intenté…»); copiar tablas de otros ficheros; copiar el prompt al repositorio (basta una línea con la ruta del prompt en `prompts/`). Mensaje de commit ≤ 6 líneas.
5. Reporte al orquestador: ≤ 15 líneas, solo hechos medidos, sin adjetivos.

## C. Puntos de control y reanudación (contra límites de API y de contexto)
1. Cada sub-agente trabaja en su rama `wip/<sesion>-<tarea>` y hace **commit + push cada vez que algo queda en verde** (una prueba, un endpoint, una pantalla): `wip(<tarea>): <qué quedó verde>`. Commit pequeño y temprano; nunca esperar al final. Un agente que muere deja su trabajo en el remoto, no en su memoria.
2. El orquestador mantiene **`memoria/estado/<sesion>.md`** (el tracker): una tabla `tarea | agente | modelo | rama wip | último commit | estado | siguiente paso concreto`. Se actualiza tras cada evento (lanzar, recibir, aceptar, cortar) con commit y push **inmediatos**. Es lo ÚNICO que lee un orquestador nuevo para reanudar.
3. **Si muere un sub-agente** (límite, tres 529 seguidos): el orquestador escribe en el tracker «cortado en `<commit>`, siguiente: …» y lo relanza con un **brief de reanudación** = brief original + 5 líneas: rama wip, último commit, qué ya está verde, qué falta, por dónde seguir. Con `SendMessage` si sigue vivo; con un `Agent` nuevo si no.
4. **Si muere el orquestador**: el tracker ya está en el remoto. El dueño abre un chat nuevo con el **MISMO prompt** y añade una línea: `REANUDACIÓN: lee solo memoria/estado/<sesion>.md y continúa desde ahí; no repitas nada que esté en verde.` Todo prompt de sesión lleva esta cláusula por defecto (si el tracker existe, se reanuda; si no, se arranca).
5. Cada agente declara al empezar un **presupuesto de contexto** (defecto 120k) y cierra ordenadamente al 80 %: commit, push, línea en el tracker (vía el orquestador), handoff de 10 líneas. Máximo **3 agentes en paralelo** por sesión.
6. Las ramas `wip/*` se borran al aceptarse la tarea (tras el merge `--no-ff` a la rama de la sesión).

## D. Cláusula que se pega al final de cada prompt de sesión
```
# PROTOCOLO Y REANUDACIÓN
Aplica el PROTOCOLO DE SESIÓN LIGERA v1 (docs/rediseno-plantillas/prompts/orquestacion/protocolo-sesion-ligera.md, léelo en la rama claude/stoic-tesla-9bsr8i con `git show origin/claude/stoic-tesla-9bsr8i:docs/rediseno-plantillas/prompts/orquestacion/protocolo-sesion-ligera.md`). Antes de lanzar nada: si existe memoria/estado/<sesion>.md, es una REANUDACIÓN: léelo, no repitas lo que esté en verde, continúa desde «siguiente paso». Si no existe, créalo con todas las tareas en «pendiente» y empújalo en tu primer commit.
```
