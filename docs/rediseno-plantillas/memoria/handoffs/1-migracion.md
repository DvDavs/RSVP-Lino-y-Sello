# Handoff — 1-migracion → 1-pruebas, verificadores adversariales, fase 4/5

Entregable: `diseno/05-migracion.md`. ADR-022/023 en `decisiones.md`.

## Punto crítico para el verificador adversarial de esquema
`05 §3.1`: el golden `before` de cada invitación es el documento YA GUARDADO en Mongo, nunca una regeneración. Si el verificador encuentra un camino de diseño (en 03/04) que asuma "podemos regenerar el before cuando queramos", es una contradicción con este documento — dirimir a favor de `05 §3.1` (evidencia H-09 es directa y verificada).

## Lo que fase 4/5 debe ejecutar (no diseñado aquí en detalle de implementación)
- Construir los 7 paquetes de plantilla restantes siguiendo `05 §2` (5 pasos).
- Correr `LegacyExtractor` contra `invitation_configs` real, resolver la cola de revisión de procedencia con el dueño del producto antes de cortar cualquier invitación con contenido ambiguo.

## Lo que no pude determinar
Ver `05 §8`.
