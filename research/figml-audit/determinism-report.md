# Determinism Report (FASE 6a)

Metode: `parseFigml` dijalankan 3× pada input yang sama, hash SHA-256 dari `JSON.stringify(transcript)` dibandingkan.

## Hasil

| Fixture | Input bytes | Node transcript | byte-identical | Run times (ms) |
|---|---|---|---|---|
| `mahasiswa-tarif/raw.xml` | 120,257 | 157 | ✅ YA | 19.65 / 11.04 / 8.71 |
| `tester.xml` | 169,793 | 229 | ✅ YA | 8.59 / 9.02 / 9.91 |

Kedua fixture menghasilkan hash identik di 3 run → **transcript `parseFigml` deterministik** untuk input dengan `id` pada setiap node.

## Catatan & risiko latensi determinisme

1. **Counter global `_idSeq`** (`figml-parse.mjs:629`): node tanpa atribut `id` mendapat id sintetis `${name}_${++_idSeq}`. Counter adalah module-global dan **tidak di-reset antar panggilan** dalam proses yang sama. Implikasi: dua panggilan `parseFigml` pada XML *tanpa id* dalam proses yang sama menghasilkan id yang berbeda (`node_1`, `node_2`, … terus naik). Pada CLI (proses baru per command) ini deterministik; pada pemanggilan library berulang dalam satu proses, ini **non-deterministik** untuk node tanpa id.

2. Tidak ada test determinism `parseFigml` di suite (dikonfirmasi oleh pencarian: determinism test yang ada hanya di `intent-graph` (sha256 hash), `knowledge-graph`, `scss-mine`, `resolve`, `verify`, `render-geometry`, `agent-context` — bukan `parseFigml`).

3. `censusColors` / `censusSpacing` memakai regex atas XML mentah; hasilnya stabil karena input tetap. `role` warna (background/text/accent/surface) ditentukan luminance/saturation — deterministik untuk input sama.

## Kesimpulan
- **Deterministik: YA** (untuk fixture nyata yang node-nya ber-id, proses-per-command).
- **Kualifikasi:** non-deterministik untuk node tanpa `id` bila `parseFigml` dipanggil >1× dalam proses yang sama (counter global).
