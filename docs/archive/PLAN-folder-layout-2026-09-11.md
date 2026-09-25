# Plan — Rapi-ulang struktur folder `.sliceui/`

> **Tanggal:** 2026-09-11 · **Status:** DRAFT — menunggu review sebelum eksekusi
> **Keputusan (disepakati):** Opsi B (per-design), folder input = `inputs/`, migrasi = user
> uninstall + re-init sendiri (tanpa backward-compat).

## Context

Satu XML menghasilkan output yang terpencar di 3 folder datar (`transcript/`, `resolve/`, `spec/`)
plus input di 2 folder (`xml/`, `images/`). Beberapa XML → `transcript/` penuh file `name.{md,json,meta}`
flat. Nesting `transcript/` saja tidak menyelesaikan (resolve/spec tetap flat), jadi disepakati
**satu folder per design** yang menampung semua turunan satu input, plus input dibungkus `inputs/`.

Bonus: logic `verify`/`referee` saat ini *pairing by name* dengan menebak via `readdir` di 2 folder
terpisah — setelah refactor, pairing jadi "satu nama → satu folder" (lebih sederhana & deterministik).

## Struktur target

```
.sliceui/
  inputs/
    images/                 # ← screenshot (was .sliceui/images)
    xml/                    # ← figma XML   (was .sliceui/xml)
  artifacts/
    <name>/                 # ← satu folder per XML/design
      transcript.md
      transcript.json
      transcript.meta.json
      resolved.json         # (was .sliceui/resolve/<name>.resolved.json)
      spec.md               # (was .sliceui/spec/<name>.spec.md)
  context/ ...              # per-project (TIDAK berubah)
  project-context.json, conventions.{json,md}, uii/pilar docs, runs.jsonl, config.json, .env.local
  # (semua per-project lain TIDAK berubah)
```

## Perubahan per file

### Writers

1. **`src/commands/init.mjs`** — buat `inputs/images` + `inputs/xml` (ganti `images` + `xml`).
   Update `created[]`. Tidak perlu buat `artifacts/` upfront (dibuat on-demand oleh writer).

2. **`src/commands/transcribe.mjs`** `main()` — tulis ke `artifacts/<stem>/transcript.{md,json,meta.json}`
   (stem = `basename(abs)` tanpa ext, sama seperti sekarang). `mkdirSync` folder `artifacts/<stem>`.

3. **`src/commands/resolve.mjs`** `main()` — tulis ke `artifacts/<stem>/resolved.json`.

4. **`src/commands/spec.mjs`** `main()` — tulis ke `artifacts/<stem>/spec.md`.

### Readers / pairing

5. **`src/commands/verify.mjs`** `pairGroundTruth(root, name, opts)` — ganti flat-list matching:
   - dengan `name`: `artifacts/<name>/transcript.json` + `inputs/xml/<name>.{xml,figml}`
   - tanpa `name`: list folder `artifacts/*` (ambil `transcript.json` pertama) + list `inputs/xml/*`.

6. **`src/lib/referee.mjs`** `readRawXmlFromSliceui(root)` — baca `inputs/xml/` (ganti `xml/`).

7. **`src/commands/referee.mjs`** `readTranscript(root)` — baca `artifacts/*/transcript.json`
   (list folder, ambil pertama).

### Docs / help

8. **`skill/SKILL.md`** — semua referensi path:
   - `.sliceui/transcript/<name>.transcript.md` → `.sliceui/artifacts/<name>/transcript.md`
   - `.sliceui/resolve/<name>.resolved.json` → `.sliceui/artifacts/<name>/resolved.json`
   - `.sliceui/spec/<name>.spec.md` → `.sliceui/artifacts/<name>/spec.md`
   - `.sliceui/xml/<name>.xml` → `.sliceui/inputs/xml/<name>.xml`
   - `.sliceui/images/<name>.png` → `.sliceui/inputs/images/<name>.png`

9. **`src/cli.mjs`** HELP — perbaiki deskripsi `transcribe` yang lama (`.sliceui/transcript.md` → `.sliceui/artifacts/<name>/`).

### Tidak berubah

- `context/`, `project-context.json`, `conventions.{json,md}`, `runs.jsonl`, `config.json`, `.env.local`,
  uii/pilar docs — semua per-project tetap di root `.sliceui/`.
- `uninstall.mjs` — rm `.sliceui/` utuh, otomatis aman.
- `detect.mjs` — menulis `context/` + `project-context.json`, tidak menyentuh input/artifact.

## Blast radius test

Test yang pakai disk-write command-layer **tidak ada** (test `transcribe`/`resolve`/`spec` memanggil
fungsi lib/orchestrator langsung, bukan `main()`; `referee`/`verify` memanggil `refereeArtifacts`/
`verifyComponent` langsung). `verify-root.test.mjs` menguji `nearestProjectRoot`/`parseArgs`
(tidak menyentuh subfolder). Jadi refactor ini **tidak memecah test existing**, tapi saya tetap
tambah test pairing baru.

**Test baru** (`test/verify-root.test.mjs` atau file baru):
- `pairGroundTruth` menemukan `artifacts/<name>/transcript.json` + `inputs/xml/<name>.xml`.
- `readRawXmlFromSliceui` membaca dari `inputs/xml/`.
- (opsional) satu end-to-end: `transcribe` + `resolve` + `spec` menulis ke `artifacts/<stem>/`.

## Migrasi

User akan `sliceui uninstall` lalu `sliceui init --yes` di project bill (struktur lama diabaikan).
Tidak ada backward-compat.

## Verifikasi

1. `node --test test/` → 295 pass (baseline) + test baru / 0 fail.
2. Smoke di temp dir: `sliceui init --yes` → cek `inputs/{images,xml}` dibuat; `sliceui transcribe x.xml`
   → cek `artifacts/x/transcript.{md,json,meta.json}`; `sliceui resolve x.xml` → `artifacts/x/resolved.json`;
   `sliceui spec x.xml` → `artifacts/x/spec.md`.
3. `sliceui verify` + `sliceui referee` menemukan ground truth dari struktur baru.
