# 5-2 (E2, invitados · RSVP · compartir) → E6, la sesión de integración

Rama a mergear: **`claude/fase-5-invitados`**, nacida del commit de cimientos `9a4cd56`.
Rama auxiliar `wip/5-2-frontend`: **red de seguridad de un incidente, NO se mergea.** Contiene
instantáneas de trabajo a medias que ya está superado por la rama buena; se puede borrar.

## 1. Lo que entra

| Superficie | Dónde |
|---|---|
| Panel de la clienta | `app/(chrome)/editor/[invitationId]/invitados/**`, `components/invitados/**`, `lib/invitados/{api,types,textos}.ts` |
| Página de la invitada | `app/(public)/r/[token]/**`, `lib/invitados/rsvp.ts` |
| Backend del panel | `modules/product/guests/panel/**` |
| Backend del RSVP público | `modules/product/guests/rsvp/**` |
| Endurecimiento heredado | `modules/shared/guests/{service/InvitationGuestsService,service/GuestAttendanceService,notifier/EmailGuestNotifier}.kt` |
| Navegación y siembra | `lib/panel/nav.invitados.ts`, `lib/panel/nav.compartir.ts`, `scripts/seed/invitados.sh` |
| e2e | `e2e/invitados.spec.ts`, `e2e/invitado.spec.ts` |

## 2. Endpoints, para `contratos.md §15` cuando lo escribas

**Nuevos**, todos en `modules/product/guests`:

- `GET|POST /product/invitations/{id}/guests` · `GET …/guests/summary` ·
  `POST …/guests:preview` (no escribe) · `POST …/guests:import` ·
  `PUT|DELETE …/guests/{guestId}` · `GET …/guests/{guestId}/link` ·
  `GET …/guests/export.csv` · `POST …/guests/{guestId}:send-email`
  — todos con `@PreAuthorize` de clase y autorización **por propiedad de la invitación**.
- `GET|PUT /public/r/{token}` — sin sesión; el token **es** la autorización.

**Endurecidos** (en el servicio compartido, así que arreglan a la vez la superficie de `/admin/**`):
`InvitationGuestsService` (S-04, S-05, y la reactivación entre invitaciones),
`GuestAttendanceService` (S-07), `EmailGuestNotifier` (S-08 y un `println` con el correo).

**Reutilizados tal cual**: `GuestFileImportService`, `GuestExportService`, `getAllGuests` (los 16
contadores), `confirmAttendance`, `JwtUtil` para los tokens.

**No creado, y es de otra sesión**: el alta de invitación por USER (tarea 5-1b de E3). Cuando su
contrato aparezca en `handoffs/5-1b-contrato-alta.md`, **lo integras tú, no yo**: mis e2e crean su
invitación por los ayudantes existentes y no dependen de esa ruta.

## 3. Conflictos previsibles al mergear, y en qué orden

Tres ficheros **compartidos** que toqué. Los tres con cambios pequeños y aditivos, pero anótalos:

1. **`src/main/resources/application.yml`** — bajé `logging.level.org.hibernate` de `debug` a
   `info`. La memoria de cimientos dice que **nadie** edita este fichero y **lo hice a propósito**:
   en `debug`, Hibernate volcaba en cada flush la entidad entera del invitado, con **los dos tokens
   completos**, el correo, el nombre y el teléfono (medido: 31 líneas con tokens y 395 con correos
   en diez minutos de uso). Dejar eso por respetar una frontera de territorio no era la opción
   conservadora. **E3 tiene concedida una excepción sobre este mismo fichero**: su bloque es
   `producto.*` y el mío es `logging`, así que el conflicto, si lo hay, es de contexto y se resuelve
   conservando ambas partes.
2. **`frontend/apps/web/lib/api-client.ts`** — exporté `marcarSesionCaducada` (antes privada). Sin
   eso, los clientes de los módulos nuevos podían tirar el token pero no levantar la bandera, y
   `/acceso` decía «inicia sesión» en vez de «tu sesión caducó» (defecto U-1, cerrado en 3-C). La
   bandera sigue viviendo en un solo sitio. **E3, E4 y E5 van a querer tocar este fichero**: mi
   cambio son dos líneas y un KDoc, en la zona de la sesión, no en las funciones de ruta.
3. **`frontend/apps/web/vitest.config.ts`** — añadí `components/invitados/**` a `coverage.include`.
   Las otras sesiones añadirán su carpeta en la misma lista. Conflicto trivial: conserva todas.

Los ficheros de memoria (`decisiones.md`, `preguntas-abiertas.md`) los toqué **solo añadiendo al
final**, como manda la regla. `contratos.md` y `00-INDICE.md` no los toqué: son tuyos.

## 4. Lo que hereda quien mergee

- **El rojo ajeno**: `components/sitio/portada.test.tsx`, roto desde `bfdcbaa`. No es mío y no lo
  toqué. Lo cierras tú con el merge de las imágenes, como dice `5-0-cimientos.md §4`.
- **El margen de peso de `/r/[token]` es de 1,4 KB** (148,6 de 150 KB gz). Es estrecho a propósito:
  la ruta venía de 238,9 KB porque arrastraba zod entero al importar las clases de error
  compartidas, y se adelgazó definiendo lo mínimo dentro de la propia ruta en vez de subir el
  límite. **Cualquier importación nueva desde `lib/` en esa ruta se lo come.**
  `scripts/check-budget.mjs` **no mide esta ruta todavía**: añadirla es una línea y no lo hice por
  estar fuera de mi territorio.
- **Tres desviaciones del contrato**, ya ratificadas por mí dentro del propio contrato con su
  motivo: el límite pasó de «por token» a «por (token, IP)»; `RSVP_CLOSED` lo produce también el
  panel; y se añadieron `GUEST_INTERNAL` y `RSVP_INTERNAL` para que ningún `500` salga sin `code`.

## 5. Dos cosas que NO son de esta sesión y siguen abiertas

Están en `preguntas-abiertas.md` con su evidencia medida:

- **`FAIL_ON_UNKNOWN_PROPERTIES` está activo en toda la aplicación**, no solo en `templates2`, por un
  bean de `Templates2JsonConfig.kt:35-36` cuyo propio comentario afirma lo contrario. Medido:
  `POST /auth/token` con un campo de más devuelve `400` con el nombre de la clase y la lista de
  propiedades conocidas. Es del dueño de `templates2`. Ninguna ruta de E2 depende de ello.
- **Falta ilustración de «sin invitados»** en `packages/ui`: el estado vacío usa `sin-invitaciones`,
  la más cercana. Es dirección de arte y no se inventa desde una sesión de producto.

## 6. Cómo verificar que el merge no rompió nada

```bash
./gradlew test                                   # esta rama deja 1407 pruebas, 0 fallos
cd frontend && pnpm --filter web run test        # 717 pruebas; el unico rojo permitido es portada.test.tsx
pnpm -r run typecheck                            # 6 paquetes
scripts/dev-backend.sh start
pnpm --filter web exec playwright test e2e/invitados.spec.ts e2e/invitado.spec.ts --workers=4
```

La última es la que importa: **con 4 workers**, por ADR-5-E1-03. Cada spec de esta sesión crea su
propia invitación y la borra; ninguno usa la sembrada compartida.
