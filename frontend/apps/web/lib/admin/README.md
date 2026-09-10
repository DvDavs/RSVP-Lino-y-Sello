# `lib/admin/` — capa de datos y textos de `/admin`

Encargo de la sesión **E5-B** (fase 5, panel de administración). Esta carpeta es **solo** tipos,
cliente HTTP, textos y formato — ningún componente, ninguna pantalla, ningún `.tsx`. Quien escriba
`app/(chrome)/admin/**` importa de aquí y no tiene que decidir cómo se llama un campo, cómo se ve
una fecha vacía o qué dice un estado de error: ya está resuelto y probado.

## Ficheros

| Fichero | Qué hay |
|---|---|
| `tipos.ts` | Los tipos TypeScript de las siete respuestas del contrato, con las claves exactas en español (más `InvitacionHeredada`/`AlternarEstadoInvitacionResponse` para la ruta heredada de la §4, en inglés a propósito). |
| `cliente.ts` | Una función por ruta, ver tabla de abajo. |
| `formato.ts` | Funciones puras de presentación (`formatearImporte`, `formatearFechaCorta`, `formatearFechaEvento`, `etiquetaEstadoInvitacion`, `etiquetaEstadoPago`): tolerantes a dato ausente/vacío, nunca lanzan. |
| `textos.ts` | `textosAdmin`, todos los textos de interfaz de `/admin` en es-MX. |
| `*.test.ts` | Pruebas de las tres piezas de arriba (junto a cada fichero, estilo `lib/api-client.test.ts`). |

## Las siete rutas del contrato → su función de cliente

| Ruta | Función |
|---|---|
| `GET /product/admin/metricas` | `obtenerMetricas()` |
| `GET /product/admin/clientas` | `listarClientas(query?)` |
| `GET /product/admin/invitaciones` | `listarInvitaciones(query?)` |
| `PUT /admin/invitations/{id}/toggle-status` (heredada, §4 del contrato) | `alternarEstadoInvitacion(invitacionId)` |
| `GET /product/admin/pagos` | `listarPagos(query?)` |
| `GET /product/admin/planes` | `listarPlanes()` |
| `GET /product/admin/plantillas` | `listarPlantillas()` |

Todas lanzan `ApiError` / `SessionError` / `UnknownApiError` (de `../errors.ts`) ante cualquier
respuesta no-2xx — ninguna devuelve `null` en su lugar. `SessionError` cubre tanto un 401/403 de la
cadena de filtros como el `ErrorMessage` heredado sin `code` TPL_* que usa la ruta de alternar
estado (ver el comentario de cabecera de `cliente.ts`).

## Tres decisiones de diseño

1. **El token de sesión vive solo en `lib/api-client.ts`** (P8, `contratos.md §8 C4`). Este
   directorio no lee ni escribe `sessionStorage` ni guarda el token en memoria propia: importa
   `getAuthToken()` y `getApiBaseUrl()` de `../api-client.ts` tal cual, y en un 401/403 llama a
   `marcarSesionCaducada()` (también importada de ahí, exportada para esto) antes de lanzar
   `SessionError` — igual que hace `peticion()` en `api-client.ts`, para que un 401 clasificado
   aquí y uno clasificado en el editor cuenten la misma historia: `haySesionCaducada()` se enciende
   y el token muerto se tira los dos casos igual (ADR-5-E5-02).
2. **Los textos de `/admin` NO entran en `lib/i18n.ts`.** Partir `i18n.ts` por áreas es trabajo de
   la sesión E2; tocarlo en paralelo desde aquí habría sido un conflicto de fusión garantizado.
   `textosAdmin` ya tiene la forma (`textosAdmin.<sección>.<clave>`) que tendría dentro de
   `lib/i18n/admin.ts` el día que E2 termine esa partición — E6 lo puede mover sin cambiar ni un
   consumidor.
3. **Cero agregados en el frontend.** Ninguna función de `cliente.ts` ni de `formato.ts` suma,
   promedia o deriva una cifra: las métricas y los contadores ya vienen calculados del backend
   (regla dura del encargo). `formato.ts` solo traduce forma (moneda, fecha, etiqueta), nunca
   calcula un valor nuevo.

## Lo que la pantalla necesita saber

- `listarInvitaciones`/`listarPagos`/`listarClientas` devuelven paginación (`total`, `pagina`,
  `tamano`, `elementos`); la pantalla decide cómo pintar el paginador, este paquete no lo hace.
- `alternarEstadoInvitacion` **no** devuelve el nuevo estado (`publicada`/`en-edicion`/
  `deshabilitada`) en su respuesta — el legado solo expone `status` de pago (`"paid"` /
  `"pending_payment"`) dentro de `invitation`. Tras alternar, la pantalla necesita volver a pedir
  `listarInvitaciones` (o aplicar el cambio de forma optimista) para refrescar la columna Estado.
- `listarPagos` trae `origen: "invitaciones" | "pagos"`: hoy siempre `"invitaciones"` (E4 no ha
  aterrizado su fuente real). No hay que ramificar la pantalla por `origen`; es informativo.
- `plan` es `string | null` en `InvitacionAdmin` y `PagoAdmin`: una invitación sin plan existe.
