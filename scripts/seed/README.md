# `scripts/seed/` — siembra por área de la fase 5

## Por qué existe esto y no basta `seed-demo.sh`

`scripts/seed-demo.sh` siembra **una** invitación de boda, completa y publicada. Es la demostración
que el dueño abre para juzgar el resultado visual, y se queda como está: no se toca.

Lo que no puede ser es el andamio de las pruebas. La issue **I-CI-01** dejó el job `e2e` del CI
pasando solo con `--workers=1`: varios specs usaban esa misma invitación y se pisaban al correr en
paralelo. La regla de la fase 5 (**ADR-5-E1-03**) es que **cada spec e2e crea sus propios datos**, y
esto es la biblioteca que hace que eso no cueste doscientas líneas por spec.

## Ficheros

| Fichero | Dueño | Qué siembra |
|---|---|---|
| `comun.sh` | **nadie lo edita** salvo el orquestador | las operaciones compartidas: cuentas, invitación propia, invitados |
| `invitados.sh` | E2 | clienta + invitación + tres invitados con cupos distintos |
| `cuenta.sh` | E3 | clienta recién registrada y **sin** invitaciones |
| `plan.sh` | E4 | clienta con dos invitaciones: una sin pagar y otra pagada |
| `admin.sh` | E5 | un MASTER y una clienta **ajena** con invitación, para probar ruta × rol |

**Cada sesión edita únicamente su fichero.** Si necesitas una operación nueva en `comun.sh`, pídela
al orquestador de integración en vez de editarlo: es el único punto compartido y es exactamente el
que no puede tener conflictos.

## Uso

```bash
scripts/dev-backend.sh start          # backend :6003 + Postgres efímero
scripts/seed/invitados.sh             # imprime las variables del caso
eval "$(scripts/seed/invitados.sh)"   # y las deja en el entorno
```

> **Arranque y secretos.** Desde `ADR-5-E3-A3-01` el backend **no arranca** sin `JWT_SECRET`,
> `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `MAIL_USERNAME` y `MAIL_PASSWORD`: ya no tienen valor
> por defecto en `application.yml`. En local no hay que hacer nada — `scripts/dev-backend.sh` las
> define con valores de desarrollo evidentemente falsos —, pero si arrancas la aplicación **a mano**
> (`./gradlew bootRun`) tienes que exportarlas tú: `export JWT_SECRET=...` (mínimo 32 caracteres) y
> las otras cuatro. Si faltan, el arranque falla y el mensaje dice cuáles y cómo ponerlas.

Cada script imprime `SEED_<AREA>_*` en formato `clave=valor` ya escapado, para poder hacer `eval`
sin sorpresas. Ninguno reutiliza datos de una corrida anterior: cada llamada crea correos, teléfonos
e invitaciones nuevos, derivados de un sufijo único por proceso.

## Verificado

- Los cuatro scripts corren contra el backend real y salen con 0.
- **Cuatro corridas simultáneas de `invitados.sh` producen cuatro invitaciones distintas** (ids 9,
  10, 11 y 12 en la medición), que es la propiedad que I-CI-01 echaba en falta.

## Tres cosas que el backend impone y conviene saber antes de pelearse con ellas

1. **El teléfono es único por cuenta** y su formato real es `+52` más diez dígitos
   (`Patterns.kt:56`). El mensaje de error del backend dice «10 digitos numéricos» y **omite el
   prefijo**, así que el intento evidente falla. `seed_telefono_de` deriva uno único del correo.
2. **Una clienta no puede dar de alta a sus propios invitados.** La única superficie de invitados
   está bajo `/admin/**`, reservada a ADMIN y MASTER (`SecurityConfig.kt:42`); la gemela para USER
   vive en el módulo prohibido `modules/user/invitations`. Por eso `invitados.sh` usa un MASTER.
   Construir esa superficie en `modules/product/guests` es trabajo de **E2**, y entonces esto se
   simplifica.
3. **La invitación se crea por SQL**, no por HTTP: `uses_templates2` no tiene ruta que la active
   (ADR-2-4-02), porque `templates2` no crea invitaciones y quien lo hace es el módulo prohibido.
   Es la misma excepción, documentada desde la fase 2, que ya se toma `seed-demo.sh`.
