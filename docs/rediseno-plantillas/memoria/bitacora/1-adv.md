# Bitácora — 1-adv-esquema + 1-adv-seguridad (fase 1, ronda 2)

## Qué hice
Ataqué los 7 documentos de ronda 1 con los casos límite del brief (plantillas de distinto tamaño, contenido más largo que la plantilla, cambio de versión con bloques eliminados, cambio de plantilla en invitación editada, colisión de ids, contenido inválido, invariantes no exportables por Zod; y persistencia/API/autorización/fallo parcial/ids inyectables/límites/iframe). Encontré 2 objeciones altas de esquema (E-01: el registro no detecta cambios incompatibles en versiones no-mayores; E-02: `restore` no revalida contra la plantilla vigente tras un cambio de plantilla), 1 objeción alta de seguridad (S-01: `assetId` sin verificación de propiedad, misma familia que H-13), y 7 objeciones medias/bajas más — escritas en `diseno/08-verificacion-adversarial-esquema.md` y `diseno/09-verificacion-adversarial-seguridad.md` con referencia exacta a documento y sección atacada, y corrección propuesta para cada una.

## Método
Para cada afirmación de seguridad/robustez de los documentos de ronda 1, busqué el mecanismo CONCRETO (línea de invariante, paso de algoritmo, control HTTP) que la respaldara — varias afirmaciones eran correctas en prosa pero no tenían control mecánico real detrás (E-01, S-01 son los dos casos más claros: el texto decía "no debería pasar" sin que nada lo impidiera).

## Evidencia
Releí `01-dominio-y-esquema.md` completo, `02-persistencia-y-catalogo.md` completo, `03-api.md` completo, `04-frontend-y-editor.md` §3 (iframe), `esquema/invariants.ts`/`blocks.ts` completos — no releí la auditoría original (fase 0) para esta ronda: el objetivo es atacar el DISEÑO de fase 1, no volver a la auditoría.

## Qué no pude hacer / limitaciones
No ejecuté ningún ataque real (no hay código, es verificación de diseño contra diseño). No verifiqué el cálculo exacto de S-05 (límite de body) contra una implementación real de serialización JSON — es una estimación conservadora, no una medición.

## Riesgos
Puede haber objeciones que esta ronda no encontró — la definición de terminado de la fase exige "sin objeciones altas ABIERTAS", no "sin ningún defecto posible"; documenté esto explícitamente para que quede claro que la ronda 3 cierra lo encontrado, no garantiza exhaustividad total.

## Archivos tocados
`diseno/08-verificacion-adversarial-esquema.md`, `diseno/09-verificacion-adversarial-seguridad.md`, este archivo.
