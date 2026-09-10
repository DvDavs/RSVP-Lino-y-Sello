# Bitácora parcial · 5-E5-A · consola de administración del producto nuevo

> **Superado por `5-E5-A.md`** (bitácora final, con las pruebas y la verificación con `curl`). Este
> fichero se conserva tal como se escribió a mitad del encargo; sus números de línea son de ese
> momento y algunos se movieron después.

Estado en el momento de escribir esto: **rutas escritas y compilando** (`./gradlew compileKotlin` en
verde), **pruebas no escritas todavía**, verificación con `curl` no hecha todavía.

## Hecho

| Fichero (bajo `src/main/kotlin/mx/evolutiondev/invitaciones/modules/product/admin/`) | Qué es |
|---|---|
| `AlcanceDeAdministracion.kt:1-58` | La regla de alcance por rol en un objeto. `PREDICADO` (`:44`) es el `WHERE` que se interpola en **todas** las consultas: `(:todo = 1 OR c.id = :yo OR c.created_by = :yo)`, copiado de `DashboardRepository.kt:50`. `todo` es entero y no booleano para que PostgreSQL infiera el tipo del parámetro sin `CAST`. |
| `RespuestasDeAdministracion.kt:1-120` | Los 11 DTO con claves en español. Instantes serializados a mano con `Instant.toString()` para que `spring.jackson.*` no pueda alterar el contrato. |
| `ParametrosDeAdministracion.kt:1-72` | Validación: `pagina >= 0` (`:48`), `tamano in [1,100]` (`:53`), filtros de lista cerrada (`:61`). Todo error es `IllegalArgumentException` → **400 con cuerpo**, por `GeneralExceptionHandler.kt:69-79`. Nada se ignora en silencio. |
| `ConsultasDeAdministracion.kt:1-470` | Las siete lecturas en **SQL nativo** sobre `EntityManager`. Métricas `:82`, clientas `:130`, invitaciones `:214`, pagos `:290`, planes `:330`, plantillas `:365`. |
| `FuenteDePagosDeAdministracion.kt:1-84` | La interfaz de §5 y su única implementación de hoy, `PagosDesdeInvitaciones` (`:52`), con `origen = "invitaciones"`. Ni una tabla nueva, ni un fichero bajo `modules/product/payments`. |
| `ConsolaDeAdministracionService.kt:1-88` | Ata validación + consulta + página. Sin un solo `filter {}` sobre resultados. |
| `ProductAdminConsolaController.kt:1-93` | Las 6 rutas, `@PreAuthorize("hasAnyRole('ADMIN','MASTER')")` **de clase**. `SecurityConfig.kt` no se toca. |
| `modules/admin/invitations/service/InvitationAdminService.kt:107-124` | **Arreglo S-03**: `markAsPaid` ahora llama a `hierarchyValidationService.validateInvitationAccess` antes de nada, con el mismo patrón exacto de `toggleInvitationStatus` (`:475-477`) y `getInvitationById` (`:460-462`). |

## Decisiones que tuve que tomar leyendo el código real

1. **`rsvpUltimos7Dias` no puede usar `invitation_guest.is_attending`: esa columna ya no existe.**
   `V16__add_guest_enhancements.sql:45` la borró y la sustituyó por el enum `attendance_status`
   (`V16:3`). Se cuenta `attendance_status = 'CONFIRMED'` con `updated_at >= now() - interval '7 days'`
   y `is_enabled = true`. Sigue siendo un aproximado por lo que el contrato ya anticipaba: no hay
   columna de fecha de confirmación. Va a `preguntas-abiertas.md`.
2. **SQL nativo y no JPQL.** `InvitationEntity.kt:16`, `CustomerEntity.kt:15`,
   `InvitationGuestEntity.kt:16` e `InvitationPlanEntity.kt:13` llevan `@Filter(name="enabledFilter")`
   y `core/hibernate/aspect/HibernateFilterAspect.kt:26-36` lo enciende o lo apaga **según el rol de
   quien pide**. Una consulta que tiene que ver lo deshabilitado (el estado `deshabilitada` del
   contrato §3 **es** `is_enabled = false`) no puede depender de que un aspecto haya pasado antes.
   Los filtros de Hibernate no se aplican a SQL nativo.
3. **Las tablas de `templates2` no tienen asociación JPA con `InvitationEntity`**
   (`TplDocumentEntity.kt:37`, `TplReleaseEntity.kt:31` guardan `invitation_id` suelto), así que el
   cruce va en SQL. Es otra razón para lo anterior.
4. **`estado = "devuelto"` de §5 se acepta y devuelve página vacía**, no 400: es válido en el contrato
   y esta fuente no puede producirlo (`§A5.2`: no hay dónde registrar una devolución).
5. **`CAST(x AS text)` y no `x::text`** en `plantillas`: Hibernate confundiría `::text` con un
   parámetro con nombre.
6. **`"time"` entre comillas** en la consulta de invitaciones: es palabra reservada y la columna se
   llama así (`V1__initial_schema.sql`).

## Falta

- Pruebas Kotlin (tabla ruta × rol parametrizada; alcance anti-IDOR; `enlacePublico` nulo sin release;
  `plantillas` sin cifras codificadas; S-03).
- Verificación con `curl` contra `:6003` (las 6 rutas × 3 identidades, y `toggle-status` de §4).
- ADR-5-E5-01 al final de `decisiones.md`; preguntas abiertas; bitácora final.
- Puede hacer falta sembrar un ADMIN (no MASTER) en `scripts/seed/admin.sh` para medir la fila ADMIN.

## Hallazgos vistos y **no tocados** (dueño: E2)

- **S-04** IDOR de invitados, `modules/shared/guests/service/InvitationGuestsService.kt:121-122`,
  `:259-260`, `:286-287`: el `guestId` nunca se cruza con el `invitationId`.
- **S-05** `deleteGuest` (`InvitationGuestsService.kt:153-161`): para ADMIN no comprueba ni jerarquía
  ni pertenencia, y borra físicamente (`hardDeleteById`, `:160`).
- **S-13** `GuestResponseItem.kt:36-37` saca `confirmationToken` y `cancellationToken` en todos los
  listados del panel.
Los tres viven en el servicio compartido de invitados. Arreglarlos desde aquí rompería la rama de E2.
