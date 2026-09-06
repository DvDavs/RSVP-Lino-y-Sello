#!/usr/bin/env python3
import glob, sys

REPLACEMENTS = [
    # (literal_old, literal_new, expected_total_count)
    # 1) Facebook personal profile (marck.luga.39)
    ('"Marck Luga"', '"Salón Bella Luna"', 10),
    ('https://www.facebook.com/marck.luga.39', 'https://www.example.com/salon-bella-luna', 10),

    # 2) Liverpool (gift registry / suggestions) — negocio real
    ('https://mesaderegalos.liverpool.com.mx/milistaderegalos/50355602', 'https://www.example.com/mesa-de-regalos', 8),
    ('https://mesaderegalos.liverpool.com...', 'https://www.example.com/mesa-de-regalos', 1),
    ('"Mesa Liverpool - Número de evento 50355602"', '"Mesa de regalos - Número de evento 000000 (ejemplo)"', 1),
    ('"Número de evento 50355602"', '"Número de evento 000000 (ejemplo)"', 8),
    ('"Mesa Liverpool"', '"Mesa de regalos"', 5),
    ('"MESA LIVERPOOL"', '"MESA DE REGALOS"', 1),
    ('"Mesa de liverpool"', '"Mesa de regalos"', 2),
    ('"visita liverpool"', '"visita la tienda"', 2),
    ('"value": "Liverpool"', '"value": "Tienda departamental"', 5),

    # 3) City Express — negocio real
    ('City Express Oaxaca', 'Hotel Los Encinos', 10),
    ('https://www.cityexpress.com/centro/hoteles-mexico/oaxaca/oaxaca-de-juarez/oaxaca', 'https://www.example.com/hotel-los-encinos', 10),

    # 4) Sección Amarilla — negocio real
    ('"Sitio Antequera"', '"Sitio de taxis del centro"', 8),
    ('https://www.seccionamarilla.com.mx/resultados/sitio-antequera/1', 'https://www.example.com/sitio-de-taxis', 8),

    # 5) Renta de autos: dirección real + enlace de mapa real
    ('Murguía 102, RUTA INDEPENDENCIA, Centro, 68000 Oaxaca de Juárez, Oax.',
     'Av. Ejemplo 102, Centro, 68000 Oaxaca de Juárez, Oax. (dirección de ejemplo)', 8),
    ('https://goo.gl/maps/iEfDN2DXwF3FcpEc8', 'https://www.example.com/mapa-renta-de-autos', 8),

    # 6) Hashtags de pareja enlazando a redes sociales concretas (facebook.com / instagram.com reales)
    ('https://www.facebook.com/hashtag/rebecaYsantiago', 'https://www.example.com/hashtag/rebecaYsantiago', 2),
    ('https://www.facebook.com/hashtag/antonioYcamila', 'https://www.example.com/hashtag/antonioYcamila', 1),
    ('https://www.facebook.com/hashtag/Sarah&Alan', 'https://www.example.com/hashtag/SarahYAlan', 1),
    ('https://www.instagram.com/explore/tags/rebecaYsantiago', 'https://www.example.com/tags/rebecaYsantiago', 2),
    ('https://www.instagram.com/explore/tags/antonioYcamila', 'https://www.example.com/tags/antonioYcamila', 1),
    ('https://www.instagram.com/explore/tags/Sarah&Alan', 'https://www.example.com/tags/SarahYAlan', 1),
    ('https://instagram.com/...', 'https://www.example.com/hashtag-pareja', 1),

    # 7) Datos bancarios de ejemplo con pinta de reales (CLABE, titular, tarjeta)
    ('"Banco: SANTANDER"', '"Banco: Banco de Ejemplo"', 10),
    ('"Titular: KARLA ZARATE CRUZ"', '"Titular: Nombre Apellido (cuenta de ejemplo)"', 10),
    ('"Cuenta CLABE: 014610606106246881"', '"Cuenta CLABE: 000000000000000000 (ejemplo, sustitúyela por la tuya)"', 10),
    ('"Número de tarjeta: 60610624688"', '"Número de tarjeta: 0000000000000000 (ejemplo)"', 8),

    # evento-elegante: ya era ficticio, se homogeneiza con el criterio explícito (ADR-4-9-01)
    ('"value": "Banco Santander"', '"value": "Banco de Ejemplo"', 1),
    ('"Banco: Santander"', '"Banco: Banco de Ejemplo"', 1),
    ('"Cuenta: 1234567890"', '"Cuenta: 0000000000 (ejemplo)"', 1),
    ('"CLABE: 012345678901234567"', '"CLABE: 000000000000000000 (ejemplo)"', 1),
    ('"Titular: Juan Perez"', '"Titular: Nombre Apellido (cuenta de ejemplo)"', 1),
]

files = sorted(glob.glob('frontend/templates/*/*/defaults.json'))

totals = {old: 0 for old, new, exp in REPLACEMENTS}
per_file_changes = {}

for f in files:
    with open(f, 'r', encoding='utf-8') as fh:
        text = fh.read()
    orig = text
    changed_here = []
    for old, new, exp in REPLACEMENTS:
        c = text.count(old)
        if c:
            text = text.replace(old, new)
            totals[old] += c
            changed_here.append((old, c))
    if text != orig:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(text)
        per_file_changes[f] = changed_here

print("=== Cambios por fichero ===")
for f, ch in per_file_changes.items():
    print(f)
    for old, c in ch:
        print(f"   {c}x  {old!r}")

print("\n=== Totales vs esperado ===")
ok = True
for old, new, exp in REPLACEMENTS:
    got = totals[old]
    status = "OK" if got == exp else "MISMATCH"
    if got != exp:
        ok = False
    print(f"{status:8} esperado={exp:3} obtenido={got:3}  {old!r}")

if not ok:
    print("\n*** HAY DISCREPANCIAS: revisar antes de continuar ***")
    sys.exit(1)
print("\nTodo cuadra.")
