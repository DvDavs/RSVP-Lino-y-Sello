# `/admin` — sesión **E5** (panel de administración)

**Esto es un marcador del andamio 5-0d y se sustituye ENTERO.** Hoy no lee nada, no llama al backend
y no enseña información de ninguna cuenta ni de ninguna invitación.

## Qué pantalla va aquí
La consola de MASTER/ADMIN: clientes, invitaciones (estado, plan, pago, enlace, deshabilitar), pagos,
planes, catálogo de plantillas registradas y métricas básicas (creadas, publicadas, pagadas, RSVP).

## El catálogo de plantillas es de SOLO LECTURA
El alta de una plantilla es por el kit de autor de la fase 4, nunca por esta pantalla. Se lee por la
API de `templates2` (`contratos.md §4`).

## Autorización — lo que E5 tiene que hacer
1. **En el backend primero.** `modules/product/admin` y `modules/admin/**` niegan por rol. La
   pantalla puede esconder un botón; solo el backend impide la acción.
2. **En el frontend después**, para no enseñar una consola vacía a quien no puede usarla.
3. **Tabla ruta × rol probada**, como pide el prompt maestro de la fase: cada ruta de administración,
   con USER, con ADMIN y con MASTER, y el código que devuelve cada combinación.
4. Cuidado con el IDOR: que un ADMIN pueda listar clientes no significa que pueda abrir la invitación
   de cualquiera. Comprueba la propiedad en cada lectura, no solo en el listado.

## Ficheros que E5 puede tocar desde aquí
- esta carpeta entera y sus subrutas,
- `src/main/kotlin/.../modules/product/admin/**` y sus pruebas,
- sus propios componentes y sus pruebas.

## Ficheros que NO puede tocar
`lib/panel/nav.ts` y `lib/panel/tipos.ts`, los `nav.<area>.ts` de E2 y E4, y las carpetas de las
otras sesiones. `/admin` NO entra en el registro de navegación del panel: ese registro es la barra de
la CLIENTA dentro de su invitación, no la consola del equipo.

## Notas del andamio
- Va en `(chrome)` y no en `(chrome)/(sitio)`: no es web de venta, no lleva la cabecera ni el pie del
  sitio. Por eso el marcador usa el `contenedor="main"` por defecto — aquí no hay `<main>` heredado.
- `noindex` es **permanente**.
