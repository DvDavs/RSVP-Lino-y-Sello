# Glosario (semilla; se amplía por ADR)

- **Plantilla (template package)**: paquete versionado e inmutable (manifiesto + esquema de contenido + tokens/presets + valores por defecto + assets + migraciones). Identificada por `slug@semver`.
- **Tema (theme)**: elección de paleta y tipografía entre los presets de la plantilla. Solo ids, nunca CSS.
- **Estructura (structure)**: lista ordenada de secciones con `key` estable, `variant`, `visible`.
- **Sección**: unidad de página de la invitación (portada, padres, itinerario, galería, mesa de regalos, RSVP…).
- **Bloque**: unidad editable dentro de una sección, con id estable y rol explícito (p. ej. `parentsA`, `godparents`).
- **Contenido (content)**: lo que edita el cliente, por id de bloque. Nunca posicional.
- **Datos de negocio**: invitación, invitados, RSVP, itinerario en PostgreSQL; nunca dentro del documento.
- **Documento de invitación**: `{schemaVersion, template, theme, structure, content}` del cliente.
- **Composición**: función pura `componer(plantilla@v, contenido, datosDeNegocio) → documento renderizable`.
- **Release (InvitationRelease)**: copia inmutable publicada (documento + versión de plantilla + tema resuelto + hash).
- **Migración de documento**: función pura que lleva un documento de una versión de plantilla/esquema a otra.
- **Kit de autor**: herramientas para crear y validar una plantilla nueva sin tocar Kotlin.
