# `package_hash` antes/después — 4-9

Medido con `pnpm plantilla check <dir> --no-escribir` (ANTES: copia temporal del `defaults.json`
tal y como estaba en `HEAD` antes de este encargo, en `/tmp/before_check/`, borrada al terminar;
DESPUÉS: el árbol real tras 4-9). `toga-y-sello/1.0.0` y `xv-jardin/1.0.0` no se tocaron (ya
estaban limpios) y conservan su hash.

| plantilla | antes | después |
|---|---|---|
| bautizo-elegante/1.0.0 | `sha256:e78e6d5b461a603cb4ab641f0be72271e64ed8274d587782f801032e711ecb2d` | `sha256:d3982655f41385bb7eb1725b45e07737ae41322bd6ca4ceb5ac181ea025255a7` |
| boda-basica/1.0.0 | `sha256:e0fca1af936e395c56e94e0e97aa75717577d9c48d83c92fce54d9ee895f18ba` | `sha256:1e4a5a43e4711557d1dbd7a57eafed22190200fe03d99e2137f96ff647f583db` |
| boda-clasica/1.0.0 | `sha256:da89e8813f5f27bd9909359aae72c166ac8f519d0f62d6e1077b38ddd688acce` | `sha256:cf0120182112711ac8137a465680c2ad0ba7b3196fd1a04e83d050775048e111` |
| boda-clasica/1.0.1 | `sha256:063dd69869f36bf7ae085d5a78a49565bfe59edd5c881b4bc1116f4ebd0edfaa` | `sha256:78e7a625026cc84695f2040351dd59b1196917c0c0652d6bcc90935583b84fd9` |
| boda-premium-2/1.0.0 | `sha256:d7b9c0b103c9f84d7a0b943ab73d8a96f81d89b3db0f56ca6a2ba41a9580cc73` | `sha256:2d4caa899aaa9118ffbed3656a8a5146822b71307f23b4509b043f784e595b81` |
| boda-premium/1.0.0 | `sha256:5e0c0a7546794d36e2c5c540e3752b0c6d3d4fe4d8358a5251c504ed98609d54` | `sha256:f46e267fc25f47bb72db25a1851cce6365ecd2f61e2eb68bbda0f9c35f9fc354` |
| comunion-elegante/1.0.0 | `sha256:034a636364b4a7755f55467f46ce5ad6d509cfc3fd4d5853f8e3d3ac06d744be` | `sha256:8d15b65289abf08a03c215954de2c85d71ea09660b04649be7ef5956f871fec9` |
| confirmacion-elegante/1.0.0 | `sha256:718b6427d9b35d401c01315d2a3c450df8edbba4539c012de058ba49287b697a` | `sha256:f01920e159e6982130377f2f85f48a2c119b52cc0d9ad89da3e41000fea5e9c1` |
| cumpleanos-elegante/1.0.0 | `sha256:e14875c0d431940d8aa6d1fa25524e4266864776ec82cf327bd8cd419ed27953` | `sha256:dd8cf34af1609d6647b2517e5e8b5a5b78a6c7dc1ecc6115198b7541e081a3e8` |
| evento-elegante/1.0.0 | `sha256:50f3fa0f53d6b14edf72c0c5b58aaab16b591da8994468a0a9e952ef7ca58928` | `sha256:879fd363d7964d2a87146d82b9f7f11e07e3a37f16aa6d0194d1283f4f6772af` |
| xv-elegance/1.0.0 | `sha256:82da74eae2b9499bdfd6538d7e9fe91dad7f2483ba3a25797f9a87a9427f3a0d` | `sha256:0a07d9fe3bacdd655fa0edd4d2a8d9eaf936b1afcf1eafae93cf09b430153f5d` |
| toga-y-sello/1.0.0 | (sin cambios) | `sha256:b20bf24bd4cd5df38fddbf3155ce3bda111b4c816e416b8c56cb850e8efdb63f` |
| xv-jardin/1.0.0 | (sin cambios) | `sha256:128c63473c87b7f7efac12b17301bf31fdb64558c0a0b7bfc39fa0681e9bf688` |

Los valores "antes" de las 11 plantillas coinciden byte a byte con los "después" publicados en
`memoria/bitacora/4-8.md` (era el estado de salida de este encargo). `formato-y-paquete.test.ts`
llevaba hardcodeados los de `boda-clasica/1.0.0` y `boda-clasica/1.0.1` (los únicos dos de la lista
`PUBLICADOS`, que también cita `memoria/handoffs/4-0a.md §4`); se actualizaron a los valores
DESPUÉS de esta tabla. `xv-jardin` es la base de las nuevas pruebas de sabotaje 7 y 8 y su hash no
cambió porque nunca llevó contenido de terceros (confirmado: no aparece en ninguna de las listas de
`grep` de esta tarea).
