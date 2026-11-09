# SliceUI FIGML Audit — Hasil Penelitian

Audit read-only terhadap pipeline FIGML→SliceUI→Angular. Tanggal **2026-11-06**, commit `76590e3293564babe36e1ecac6e1b5b6e1e5f8a0`.

## Cara membuka laporan
Buka `index.html` langsung dari filesystem (self-contained, tanpa CDN/tracker, light+dark theme).

## File hasil

| File | Isi |
|---|---|
| `index.html` | Laporan utama (self-contained) |
| `audit-summary.json` | Ringkasan machine-readable |
| `repository-inventory.md` | Inventory repo + environment (FASE 1) |
| `observed-figml-schema.json` / `.md` | Skema FigML empiris (FASE 2) |
| `field-coverage.csv` / `.md` | Field coverage matrix (FASE 3) |
| `fixture-gap-analysis.md` | Gap fixture + spesifikasi [NEEDS FIGML EXPORT] (FASE 4) |
| `end-to-end-trace.md` | Trace satu fixture end-to-end (FASE 5) |
| `determinism-report.md` | Uji determinisme (FASE 6a) |
| `scale-report.md` | Uji scale 100–10k node (FASE 6b) |
| `security-findings.md` | Audit XML + prompt injection (FASE 7) |
| `evaluation-recommendation.md` | Rubric evaluasi + rekomendasi arsitektur (FASE 8-9) |

## Script penelitian (read-only, tidak mengubah produksi)

- `analyze-schema.mjs` — inventaris tag/atribut/tipe value XML (regenerasi `observed-figml-schema.json`).
- `determinism-scale.mjs` — uji determinisme + scale synthetic.
- `gen-coverage.mjs` — regenerate `field-coverage.csv` + coverage summary.

Menjalankan ulang (dari repo root):
```sh
node research/figml-audit/analyze-schema.mjs test/fixtures/mahasiswa-tarif/raw.xml tester.xml test/fixtures/eval-hope/ground-truth/raw.xml test/fixtures/pilar-golden/ground-truth/raw.xml
node research/figml-audit/determinism-scale.mjs
node research/figml-audit/gen-coverage.mjs
```

## Inti temuan (ringkas)

1. **Format FigML tidak lossless** — banyak field Figma tidak diekspor, dan beberapa yang diekspor di-drop parser. Bukan klaim vendor: dibuktikan dari 2 export asli.
2. **Dua parser XML paralel divergen** (`figml-parse.mjs` lossy vs `design/raw-graph.mjs` "lossless") — tidak satupun menyimpan `mainComponent.id` (relasi component→instance).
3. **P0 exact coverage 61.5%**, usable 84.6%; **P1 exact 41.2%**, usable 47.1%. 10 field critical-loss.
4. **`fidelity` "100%" menyesatkan** — hanya menskor 13 atribut kurasi, bukan ground truth penuh.
5. **Deterministik** (byte-identical 3×) untuk node ber-id; **scale aman** (10k node = 118ms/36MB).
6. **Parser XML aman** (XXE/depth/prototype-pollution/malformed diblokir fast-xml-parser).
7. **Prompt injection terbuka** — layer name/text tersalur verbatim tanpa isolasi teknis (hanya instruksi SKILL.md:62).
8. **Rekomendasi: Pilihan B** — FigML → versioned adapter → SliceIR → scene index → hierarchical transcript.

Lihat `index.html` untuk detail lengkap, bukti file:baris, dan implementation plan.
