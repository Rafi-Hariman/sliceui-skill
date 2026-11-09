# Implementation Results — Phase 2 (SliceIR + transcript-v2)

Tanggal: 2026-11-06 · Commit base: `76590e3` · Status: **SELESAI** · Opt-in, tidak mengubah default.

## Ringkasan
Fase 2 menambahkan **SliceIR minimum yang versioned** (`src/design/slice-ir.mjs`), **hierarchical transcript v2** opt-in (`src/lib/render-hierarchical-transcript.mjs`), dan flag `--transcript-version 2`. Default (tanpa flag) tidak berubah: transcript lama, meta, dan contract.json tetap byte-stable. Parser lama, contract.json, dan semua command lain tidak disentuh.

## File yang diubah / ditambah

| File | Jenis | Perubahan |
|---|---|---|
| `src/design/slice-ir.mjs` | **BARU** | `buildSliceIR(contractDoc)` → SliceIR `sliceir/0.1` (nodes, indexes, stats, diagnostics, subtreeHash, provenance) |
| `src/lib/render-hierarchical-transcript.mjs` | **BARU** | `renderHierarchicalTranscript(sliceIR, outDir)` → `transcript-v2/` (manifest, outline, diagnostics, components, sections) + trust guard |
| `src/commands/transcribe.mjs` | MOD (additive) | `--transcript-version 2` opt-in; menulis `sliceir.json` + `transcript-v2/`; invalid version → exit 2 |
| `test/slice-ir.test.mjs` | **BARU** | 18 test (determinism, order, dup names, mainComponent, unknown, sizing/alignment/positioning/constraints, opacity/required/visible, untrusted, markdown escaping, invalid version, legacy unchanged, critical-loss recovery) |
| `research/figml-audit/phase-2-baseline.md` | **BARU** | Baseline (hash + ukuran + test count) |
| `research/figml-audit/phase-2-results.md` | **BARU** | Laporan ini |
| `research/figml-audit/audit-summary.json` | UPDATE | Menambah `implementation.phase2` (data Fase 1 tidak dihapus) |

## Alasan tiap perubahan
1. **`slice-ir.mjs`** — audit merekomendasikan `FigML → versioned adapter → SliceIR`. Fase 1 sudah punya contract (adapter full-fidelity); SliceIR adalah proyeksi typed-nya dengan provenance per field dan identitas deterministik. Ini menjawab "1. SliceIR minimum yang versioned", "2. scene/component index", dan "4. penyaluran critical-loss".
2. **`render-hierarchical-transcript.mjs`** — menjawab "3. hierarchical transcript v2 yang opt-in" dan memenuhi data-trust boundary.
3. **`transcribe.mjs`** — menjawab "4. CLI opt-in" (`--transcript-version 2`), tanpa mengubah default.
4. **`test/slice-ir.test.mjs`** — 22 acceptance criteria dari Fase 2F.

## Test sebelum dan sesudah

| | Sebelum (Phase 1 baseline) | Sesudah (Phase 2) |
|---|---|---|
| Total | 779 | 797 |
| Pass | 776 | 794 |
| Fail | 0 | 0 |
| Skip | 3 | 3 |

- **0 regresi**; **+18 test baru**.

## Compatibility impact
- **Public CLI command**: tidak berubah (hanya tambah flag opt-in `--transcript-version 2`).
- **Default output**: **byte-identical** — `transcript.json` hash `f71aa0a70b0a` sama dengan baseline.
- **Parser lama / contract.json**: tidak dihapus, tidak diubah.
- **Output default tidak berubah**: `transcript.json`, `transcript.md`, `transcript.meta.json`, `contract.json` tetap.
- **Output baru (hanya dengan flag)**: `sliceir.json` + `transcript-v2/` di `.sliceui/artifacts/<stem>/`.

## Output yang berubah (hanya opt-in)
- `--transcript-version 2` menambah `sliceir.json` dan `transcript-v2/{manifest.json,outline.md,diagnostics.json,components/*,sections/*}`.

## Output yang TIDAK berubah
- Default `transcribe` (tanpa flag): seluruh artifact identik dengan baseline.
- Semua command lain (`spec`, `plan`, `inspect`, `resolve`, `verify`, `fidelity`, …).

## Critical-loss yang berhasil dipulihkan (ke SliceIR / transcript-v2)
| Field (audit critical-loss) | Status di SliceIR |
|---|---|
| `mainComponent.id` | `component.mainComponentId` + `instancesByComponent` index |
| Font family / style | `typography.fontFamily` / `.fontStyle` (41 node di mahasiswa-tarif) |
| `layoutSizingHorizontal/Vertical` (FILL/HUG) | `layout.sizingHorizontal` / `.sizingVertical` (79 node) |
| Alignment primary/counter | `layout.primaryAxisAlign` / `.counterAxisAlign` |
| `layoutPositioning` (ABSOLUTE) | `layout.positioning` (4 node) |
| `constraints` | `constraints.horizontal` / `.vertical` (157 node) |
| Opacity (incl. 0) | `state.opacity` (0 tidak diubah jadi missing) |
| `required` (incl. false) | `state.required` (false tidak diubah jadi missing) |
| `visible` (incl. false) | `state.visible` |
| Fills / strokes / corner radius / per-corner | `appearance.*` (semua fill, bukan hanya pertama) |
| Overrides (visible + non-visible) | `component.overrides` |
| variantProperties / component properties | `component.variantType/.variantName/.properties` |
| Unknown element / attribute | `rawAttrs` + `UNKNOWN_ELEMENT`/`UNKNOWN_ATTRIBUTE` diagnostic |

## Critical-loss yang BELUM diperbaiki (tetap ditunda — tersimpan di rawAttrs, belum tersalur ke transcript *legacy*)
- Rich text / mixed-font **runs** (hanya `MIXED_TEXT_STYLE` diagnostic + sentinel, bukan dekomposisi span).
- `textDecoration` / `textCase` — tidak teramati di fixture → `needs-fixture` (rawAttrs dipertahankan).
- `effects` (shadow/blur) — tidak teramati → `needs-fixture`.
- `minWidth/maxWidth/minHeight/maxHeight`, `layoutWrap`, `counterAxisSpacing` — tidak teramati → rawAttrs dipertahankan.
- `mainComponent.name` (nama definisi komponen) — definisi komponen bersifat eksternal di export FIGML.

## Rollback instructions
```sh
cd /Users/bsi-2-2200019/Development/freelance/sliceui-skill
git checkout -- src/commands/transcribe.mjs
rm src/design/slice-ir.mjs src/lib/render-hierarchical-transcript.mjs test/slice-ir.test.mjs
# research/figml-audit/phase-2-* dan audit-summary.json dibiarkan atau dihapus manual:
#   rm research/figml-audit/phase-2-baseline.md research/figml-audit/phase-2-results.md
```
(`git checkout -- src/commands/transcribe.mjs` mengembalikan perubahan Fase 2 pada file itu; file Fase 1 tetap di tempat karena Fase 2 hanya menambah, tidak menghapus.)

## Source produksi yang berubah
| File | Nature |
|---|---|
| `src/commands/transcribe.mjs` | additive (flag + v2 artifact) |
| `src/design/slice-ir.mjs` | baru |
| `src/lib/render-hierarchical-transcript.mjs` | baru |

Tidak ada perubahan pada `src/lib/figml-parse.mjs`, `src/lib/figml-contract.mjs`, `src/design/raw-graph.mjs`, `src/framework/*`, `src/commands/{spec,resolve,inspect,plan,verify,...}`, `skill/*`.
