# Implementation Results — Phase 1 (Unified FigML Parser Contract)

Tanggal: 2026-11-06 · Commit base: `76590e3` · Status: **SELESAI** · Read-only terhadap source audit.

## Ringkasan
Fase 1 mengimplementasikan **kontrak parser FIGML terpadu** (`src/lib/figml-contract.mjs`) tanpa menghapus parser lama, tanpa mengubah public CLI command, tanpa mengubah format transcript. Parser lama (`figml-parse.mjs`, `design/raw-graph.mjs`) tetap utuh dan dipanggil sama seperti sebelumnya; kontrak adalah lapisan *additive* yang menormalisasi kedua hasil ke satu bentuk minimum, mempertahankan `mainComponent.id`, seluruh unknown element/attribute, dan mengeluarkan 6 kode diagnostics.

## File yang diubah / ditambah

| File | Jenis | Perubahan |
|---|---|---|
| `src/lib/figml-contract.mjs` | **BARU** | Kontrak terpadu: `parseFigmlContract`, `normalizeFromTranscript`, `normalizeFromRawGraph`; full-fidelity walk; 6 diagnostics; identitas deterministik per-parse |
| `src/lib/figml-parse.mjs` | MOD | Global `_idSeq` → `makeIdSeq()` per-parse (format id identik) |
| `src/commands/transcribe.mjs` | MOD (additive) | `buildContract()` + `persistTranscript` menulis `contract.json` |
| `src/lib/render-transcript.mjs` | MOD (1 baris) | Guard line "UNTRUSTED DESIGN DATA" |
| `test/figml-contract.test.mjs` | **BARU** | 10 test kontrak + regression + security |
| `research/figml-audit/implementation-results.md` | **BARU** | Laporan ini |
| `research/figml-audit/index.html`, `audit-summary.json` | UPDATE | Menambah bagian implementasi (data audit lama tidak dihapus) |

## Alasan tiap perubahan

1. **`figml-contract.mjs`** — audit menemukan dua parser XML divergen tanpa kontrak bersama, `mainComponent.id` hilang di keduanya, dan tidak ada diagnostics untuk field tak dikenal. Kontrak menyediakan satu lapisan full-fidelity yang mempertahankan semuanya.
2. **`figml-parse.mjs` (counter)** — audit (`determinism-report.md`) mencatat global `_idSeq` membuat id node tanpa-id non-deterministik lintas panggilan dalam proses yang sama. Diganti `makeIdSeq()` per-parse.
3. **`transcribe.mjs`** — menulis `contract.json` sebagai artefak *additive*; tidak mengubah `transcript.json/md/meta` atau stdout.
4. **`render-transcript.mjs`** — pemisahan untrusted design content dari instruksi (audit `security-findings.md` #9/#14).
5. **`test/figml-contract.test.mjs`** — kontrak + regression untuk determinism, mainComponent, unknown preservation, parity dua parser, dan security.

## Test sebelum dan sesudah

| | Sebelum (baseline) | Sesudah |
|---|---|---|
| Total test | 769 | 779 |
| Pass | 766 | 776 |
| Fail | 0 | 0 |
| Skip | 3 | 3 |

- **0 regresi** — seluruh 766 test lama tetap lulus.
- **+10 test baru** (contract + regression + security).

## Compatibility impact

- **Public CLI command**: tidak berubah. `sliceui transcribe/inspect/spec/plan/resolve/fidelity/...` argumen & exit code sama.
- **Transcript format**: tidak berubah (byte-identical, dibuktikan hash identik `f71aa0a70b0a…` sebelum/sesudah).
- **Parser lama**: tidak dihapus, perilaku tidak berubah (kecuali counter id per-parse yang justru membuat determinisme).
- **Artefak baru**: `contract.json` muncul di `.sliceui/artifacts/<stem>/` — additive, tidak ada test yang memeriksa jumlah file.

## Output yang berubah

- `transcript.md` — bertambah 1 baris guard "UNTRUSTED DESIGN DATA" (baris baru, tidak menghapus apapun).
- `.sliceui/artifacts/<stem>/contract.json` — **baru** (full-fidelity + diagnostics + normalized).

## Output yang TIDAK berubah

- `transcript.json` — byte-identical (hash sama dengan baseline).
- `transcript.meta.json` — identik.
- stdout CLI (`transcribe`, `fidelity`, dll) — identik.
- id node yang ber-id asli — identik.
- Perilaku `spec`/`resolve`/`inspect`/`plan` — tidak berubah (mereka tetap memakai parser lama).

## Critical-loss yang berhasil diperbaiki (Fase 1)

1. **`mainComponent.id`** — kini dipertahankan ke `contract.json` (23 node di mahasiswa-tarif) dan ke normalized output (`mainComponentId`). **Belum** tersalur ke `transcript.json`/agent-facing (di luar scope fase 1).
2. **Unknown element & attribute** — tidak hilang; dipertahankan verbatim di `rawAttrs` + terhitung di `unknown.*` + `unknown-element`/`unknown-attribute` diagnostic. (Temuan baru: `variantProperties`/`scaleFactor` muncul sebagai *atribut* pada icon instance.)
3. **Determinisme identitas** — global `_idSeq` dihapus → id node tanpa-id deterministik per-parse.
4. **Diagnostics** — 6 kode (missing-critical-field, unknown-element, unknown-attribute, inferred-default, ambiguous-value, unsupported-field) teragregasi.
5. **Pemisahan untrusted content** — guard line di `transcript.md`.

## Critical-loss yang BELUM diperbaiki (sengaja ditunda — bukan scope fase 1)

| Field | Status |
|---|---|
| Rich text / mixed font spans | belum |
| Font family (`fontName.family`) | belum (tersalur ke `contract.json` sebagai `node.font`, tapi tidak ke transcript) |
| `layoutSizingHorizontal/Vertical` (FILL/HUG) | belum (ada di `rawAttrs`/`box`, tidak ke agent-facing) |
| Alignment primary/counter (CENTER/MAX) | belum |
| `layoutPositioning=ABSOLUTE` | belum (tersalur di `rawAttrs`, tidak ke transcript) |
| `constraints` | belum (tersalur di `node.constraints`, tidak ke transcript) |
| Opacity non-zero | belum |
| `required` flag | belum |
| Instance overrides non-visible | belum (tersalur di `node.overrides`) |

Catatan: kontrak **menyimpan** semua field ini secara full-fidelity; yang belum dilakukan adalah *menyalurkannya ke `transcript.json` / agent-facing output*. Itu adalah fase berikutnya.

## Rollback instructions

```sh
# Membatalkan seluruh perubahan fase 1 (kembali ke state sebelum implementasi):
cd /Users/bsi-2-2200019/Development/freelance/sliceui-skill
git checkout -- src/lib/figml-parse.mjs src/commands/transcribe.mjs src/lib/render-transcript.mjs
git clean -f src/lib/figml-contract.mjs test/figml-contract.test.mjs
# research/figml-audit/ dibiarkan (atau dihapus manual bila tidak diinginkan):
#   rm -rf research/figml-audit/implementation-results.md
```

Tidak ada commit yang dibuat, jadi `git checkout -- <file>` mengembalikan file yang dimodifikasi ke `HEAD`. File baru (`figml-contract.mjs`, `figml-contract.test.mjs`) tidak ter-tracking sebelum fase ini, sehingga `git clean -f`/`rm` menghapusnya.

## Source produksi yang berubah

| File | Nature |
|---|---|
| `src/lib/figml-parse.mjs` | refactor internal (counter per-parse) |
| `src/commands/transcribe.mjs` | additive (contract artifact) |
| `src/lib/render-transcript.mjs` | additive (1 baris guard) |
| `src/lib/figml-contract.mjs` | baru |

Tidak ada perubahan pada: `src/design/*`, `src/framework/*`, `src/commands/{spec,resolve,inspect,plan,...}`, `src/lib/{raw-graph,fidelity,resolve,...}`, `skill/*`.
