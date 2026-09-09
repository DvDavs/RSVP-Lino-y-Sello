# 5-2-A · Panel de invitados del rol USER — estado del agente E2-A

Rama `claude/fase-5-invitados`. Territorio: `modules/product/guests/panel/**` (creado) más dos
endurecimientos quirúrgicos en `modules/shared/guests/service/InvitationGuestsService.kt`.
**No se tocó** `GuestAttendanceService`, `EmailGuestNotifier`, `product/guests/rsvp/**` (E2-B), los
tres ficheros congelados de la raíz de `modules/product`, `SecurityConfig`, `application.yml` ni el
frontend. El repositorio `InvitationGuestsRepository` **no** necesitó cambios.

## Terminado y verificado

- **9 de las 10 rutas del contrato §1**, en `panel/GuestPanelController.kt`, con
  `@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")` de clase: listado paginado con `search` y
  `status`, `summary`, alta, `:preview`, `:import`, `PUT`, `DELETE`, `/{guestId}/link` y
  `export.csv`.
- **S-04 cerrado** (`InvitationGuestsService.kt`, nuevo `findGuestByIdInInvitation`): `updateGuest`,
  `getGuest` y `cancelAttendanceFromDashboard` cruzan ya `guest.invitation.id` con `invitationId` y
  lanzan `GuestNotFoundException` con **el mismo literal** que el «no existe».
- **S-05 cerrado** (`InvitationGuestsService.deleteGuest`): la condición por rol se sustituyó por
  `validateInvitation(userId, appRole, guest.invitation.id)`.
- **S-13 cerrado**: `panel/GuestPanelDtos.kt` declara un `GuestItem` propio sin los dos tokens; el
  único sitio donde vuelve a aparecer uno es `GuestLinkResponse`, ya montado en la URL.
- **S-08 evitado en lo nuevo**: `panel/GuestShareLinkBuilder.kt` arma la URL con `app.frontend.url`
  y, si viene vacía, falla en vez de adivinar un host.
- `validateInvitation` pasó de `private` a pública en el servicio compartido para que el panel
  reutilice la misma puerta de propiedad; su lógica y sus mensajes no cambian.
- **62 pruebas nuevas** en `src/test/.../product/guests/panel/**`, todas en verde, y la suite
  completa del repositorio en verde (1383 pruebas, 0 fallos).

## A medias

- `POST …/guests/{guestId}:send-email` responde **`501 GUEST_EMAIL_UNAVAILABLE`** y no manda nada
  (`GuestPanelController.kt`, método `sendEmail`, con el TODO que cita
  `modules/shared/guests/notifier/EmailGuestNotifier.kt:68` y `:129`). Es deliberado: el camino
  corto pasa por un fichero de E2-B que está arreglando ahí mismo S-08, y una colisión de fusión
  costaba más que una ruta honestamente incompleta.

## No empezado (no era de este encargo)

- La superficie pública `/public/r/{token}` del contrato §2 — es de E2-B, y su código ya está en el
  árbol (`product/guests/rsvp/**`, 38 pruebas en verde).
- El cliente del frontend (`lib/invitados/api.ts`) del contrato §3.

## Decisiones tomadas

1. El `@RequestMapping` de clase llega a `/product/invitations/{invitationId}` y **no** a `/guests`:
   Spring intercala un separador al combinar patrones, así que `:preview` y `:import` tienen que
   escribirse en el método completo, como `EditorDocumentController.kt:41`. Las URLs finales son
   exactamente las del contrato.
2. Advice propio acotado a `…product.guests.panel` (no a `…product.guests`), para no secuestrar los
   errores del subpaquete `rsvp` de E2-B.
3. Dos códigos añadidos al catálogo del contrato §0.6: `GUEST_EMAIL_UNAVAILABLE` (501) y
   `GUEST_INTERNAL` (500, red de seguridad para que ninguna ruta devuelva un 500 sin `code`).
4. `GuestDraft` no lleva los tres contadores de confirmados: en un borrador siempre serían cero.
5. La búsqueda del listado es insensible a acentos con `translate(lower(full_name), …)` de Postgres,
   en una `Specification` propia (`panel/GuestPanelQueries.kt`); la de `GuestsSpecifications.kt:33`
   es sensible a mayúsculas y acentos y no sirve para nombres en español.

## Cómo verificar

```
cd /home/user/RSVP-Lino-y-Sello
./gradlew compileKotlin compileTestKotlin
./gradlew test --tests '*product.guests*' --tests '*shared.guests*'
./gradlew test
```

Nunca `./gradlew clean`. Si falla con «Could not write XML test results», es otro agente corriendo
Gradle a la vez sobre el mismo `build/`: se repite el comando y pasa.
