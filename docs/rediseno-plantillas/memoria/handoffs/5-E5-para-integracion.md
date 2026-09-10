# E5 (panel de administración) → E6 · qué mergear y en qué orden

Sesión E5 de la fase 5. Rama **`claude/fase-5-admin-vq1fjm`**, nacida del commit de cimientos
`9a4cd56` de `origin/claude/fase-5-producto`.

> **Nota de rama.** El encargo pedía `claude/fase-5-admin`; el entorno remoto de la sesión impone
> `claude/fase-5-admin-vq1fjm`. Es el mismo trabajo y el mismo commit base. Copia literal del
> encargo en `prompts/fase-5/E5-admin.md`.

## 1. Lo que trae la rama

| Capa | Dónde | Qué es |
|---|---|---|
| Backend | `modules/product/admin/**` | 7 lecturas de la consola, `@PreAuthorize` de clase (ADMIN/MASTER) |
| Backend | `modules/admin/invitations/service/InvitationAdminService.kt` | cierre del hallazgo **S-03** (ADR-5-E5-01) |
| Frontend | `apps/web/lib/admin/**` | tipos, cliente HTTP, textos es-MX, formato |
| Frontend | `apps/web/app/(chrome)/admin/**` | la pantalla y sus componentes |
| Pruebas | `apps/web/e2e/admin-roles.spec.ts`, `admin-consola.spec.ts` | 20 pruebas, ruta × rol y consola |
| Siembra | `scripts/seed/admin.sh` | ampliado con un ADMIN y una clienta ajena |

**Cero migraciones nuevas.** Todo es lectura sobre el esquema que ya existe.

## 2. Lo que E5 NO tocó, y por qué importa al mergear
- `lib/i18n.ts` — la partición por áreas es de **E2**. Los textos de la consola viven en
  `lib/admin/textos.ts`. Cuando E2 la haga, ese objeto se mueve a `lib/i18n/admin.ts` **sin cambiar
  un solo consumidor**.
- `scripts/check-budget.mjs` — no se añadió `/admin`. Ver §5.
- `lib/panel/nav.ts` — `/admin` **no** entra en el registro: esa barra es la de la clienta dentro de
  su invitación, no la consola del equipo.
- `packages/ui/**` — los componentes de la consola son locales (ADR-5-E5-03).
- El servicio compartido de invitados: hallazgos **S-04, S-05 y S-13** vistos, medidos y **no
  tocados**. Son de **E2** y arreglarlos desde aquí habría roto su rama.
- `SecurityConfig.kt`, `application.yml`, y los tres módulos prohibidos.

## 3. Conflictos previsibles, en orden de probabilidad
1. **`lib/api-client.ts`, una línea.** `marcarSesionCaducada` pasó de privada a **exportada**. Es el
   único cambio de E5 en un fichero compartido de frontend, y fue necesario: sin él, un 401 en la
   consola no marcaba la sesión y `/acceso` decía «todavía no has entrado» en vez de «tu sesión
   caducó». Si otra sesión toca esa zona, conservar el `export`.
2. **`decisiones.md` y `preguntas-abiertas.md`.** E5 solo **añadió al final** con `cat >>`. En un
   conflicto, conservar ambos lados.
3. **Ninguno más.** E5 no deja ni un fichero fuera de su territorio: el único que llegó a tocarse
   se revirtió (ver §4).

## 4. Un hallazgo real que E5 decidió NO arreglar en esta rama
`modules/master/giftmessages/service/MasterGiftMessagesService.kt` tiene el **mismo desbordamiento**
que la objeción ALTA de la revisión de autorización, medido en vivo: `?page=2147483647` responde
**500 con 13 210 bytes de traza**.

Se arregló, se probó… y **se revirtió**. El arreglo **no va en esta rama**. Por qué:

1. `modules/master/**` **no es territorio de E5** ni de ninguna sesión de la fase 5, y **D-08 no lo
   cubre**: esa decisión levanta la prohibición sobre `auth`, `guests`, `admin` y pagos, **no sobre
   `master`**. Sin esa cobertura, es una decisión del dueño.
2. Hay **6 rutas heredadas más** con el mismo síntoma (~17 KB, aunque esas por la guarda de Spring
   Data, **sin** filtrar SQL ni el predicado de alcance). Arreglar 1 de 7 deja el sistema
   incoherente y da por cerrada una clase de fallo que sigue abierta.

**El parche, su medición y su prueba están escritos** en `ADR-5-E5-06` y en `bitacora/5-E5-G.md`:
aplicarlos cuesta minutos cuando su dueño lo decida. Las 7 rutas y las tres preguntas que hay que
resolver (400 contra página vacía · quién lo arregla · apagar el síntoma entero con
`include-message`/`include-stacktrace: never`, que es el hallazgo S-02) están en
`preguntas-abiertas.md`.

## 5. Dos cosas que E6 tiene que decidir
1. **Presupuesto de `/admin`: 273,7 KB gz.** El techo de 150 KB que cita el skill es el de las rutas
   públicas de primera impresión (`/` e `/i`); `/editor` tiene 600 KB, y `/admin` **no está en la
   compuerta**, que pasa en verde. El grueso es un chunk de `zod` que arrastran `lib/errors.ts` y
   `lib/api-client.ts`, fuera del territorio de E5; `/acceso`, ya publicada, mide lo mismo.
   **Propuesto y sin aplicar** (ADR-5-E5-04): añadir `/admin` a `LIMITES_BASE` con techo tipo editor.
2. **La auditoría axe de `/admin` vive dentro de `admin-consola.spec.ts`**, no en
   `a11y-producto.spec.ts`, porque el encargo acotaba los ficheros a `admin*.spec.ts`. Si E6 prefiere
   centralizarla, es un movimiento de bloque.

## 6. Pagos: la costura que espera a E4
`GET /product/admin/pagos` se sirve de `FuenteDePagosDeAdministracion`, con una implementación que
proyecta `invitation.is_paid` y `total_amount` y **se declara como tal** en el campo `origen`
(`"invitaciones"`). Cuando E4 aterrice, **se cambia la implementación, no la ruta**, y `origen` pasa
a `"pagos"`. E5 no integró nada de E4 a propósito.

## 7. Corrección al contrato de la fase, para que nadie persiga un fantasma
El contrato que el orquestador de E5 escribió decía que la métrica de RSVP se calcula sobre
`invitation_guest.is_attending`. **Esa columna no existe**: la retiró
`V16__add_guest_enhancements.sql:45`, que la sustituyó por `attendance_status`
(`PENDING`/`CONFIRMED`/`DECLINED`). La métrica va sobre `attendance_status = 'CONFIRMED'` y sigue
siendo **aproximada**, porque no hay columna con la fecha de confirmación: la ventana de 7 días se
mide sobre `updated_at`. Es pregunta abierta para el dueño.

## 8. El rojo conocido y ajeno
`components/sitio/portada.test.tsx` falla desde `bfdcbaa`, por una causa anterior y ajena a la fase
5. E5 no lo tocó y no lo cuenta en sus cifras. Lo cierra E6 con el merge de las imágenes.
