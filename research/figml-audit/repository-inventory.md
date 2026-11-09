# Repository Inventory — SliceUI FIGML Audit

Audit tanggal: 2026-11-06 · Commit: `76590e3293564babe36e1ecac6e1b5b6e1e5f8a0`

## Environment

| Item | Nilai |
|---|---|
| OS | macOS 26.6.2 (Darwin 25.6.0) |
| Shell | zsh |
| Node.js | v20.19.5 (engines `>=20`) |
| Package manager | npm (lockfileVersion 3) |
| Package version | 0.15.0 |
| Module system | ESM (`"type": "module"`) |
| Test framework | `node:test` (`node --test test/`) — tidak ada Jest/Mocha/Vitest |

## Dependencies (package.json:41-50)

| Package | Version | Peran |
|---|---|---|
| `fast-xml-parser` | ^5.11.1 (terpasang 5.11.1) | **Satu-satunya parser XML** untuk FIGML |
| `fast-glob` | ^3.3.3 | scan repo (library/capability detection) |
| `typescript` | ^5.9.2 | type-check komponen Angular per-file |
| `esbuild` (dev) | ^0.24.0 | render-mount (dev-only) |
| `playwright` (dev) | ^1.63.0 | render-verify browser probe (dev-only) |
| `sass` (dev) | ^1.80.0 | SCSS compile (render-mount dev) |

Total packages di lockfile: 77.

## Scripts (package.json:33-36)

| Script | Command |
|---|---|
| `test` | `node --test test/` |
| `prepublishOnly` | `npm test && node scripts/guard-publish.mjs` |

Tidak ada script `lint`, `typecheck`, `build` terpisah. Lint/type-check dibangun ke dalam command `sliceui check`.

## FIGML / XML parser — dua jalur paralel

Ada **DUA parser XML yang terpisah dan independen**, keduanya memakai `fast-xml-parser` dengan konfigurasi identik (`preserveOrder:true`, `ignoreAttributes:false`, `attributeNamePrefix:""`, `parseTagValue:false`, `parseAttributeValue:false`):

### 1. Legacy transcript path — `src/lib/figml-parse.mjs`

- `parseFigml(xml, filename)` (baris 29) → transcript object `{version, meta, tokens, layout[]}`.
- Sengaja "lossy" (komentar baris 1-9): mempertahankan pohon, teks, warna, geometri, semantik nama komponen; membuang banyak field.
- `XMLParser` di baris 15-21.
- Dipakai oleh: `transcribe.mjs`, `spec.mjs`, `resolve.mjs`, `inspect.mjs` (via `transcribe`), `fidelity.mjs`.

### 2. Design-intent path — `src/design/raw-graph.mjs` (+ `ingest.mjs`)

- `buildRawGraph(xml, filename)` (baris 37) → Raw Design Graph "lossless".
- Menyimpan `layoutGrow`, `layoutAlign`, `layoutPositioning`, `clipsContent`, bounds lokal+absolut, **semua fills** (bukan cuma pertama), `blendMode`, per-corner radius, `opacity`, alasan visibility, `provenance` (path XML per node).
- `ingestDesign(xml, filename)` (ingest.mjs:18) → kompilasi menjadi Design Intent Graph (`intent-graph.mjs`).
- Dipakai oleh: `plan.mjs` (hanya jalur ini), `inspect.mjs` (untuk seksi Topology/Layout constraints/Content/Runtime state/Uncertainty).

**Implikasi penting:** dua parser mengklasifikasi node secara independen (regex nama yang berbeda), dan *tidak satupun* menyimpan `mainComponent.id` (relasi component→instance).

## Command entrypoints (src/cli.mjs:104-178)

`transcribe`, `fidelity`, `verify`, `referee`, `resolve`, `spec`, `inspect`, `check`, `plan`, `detect`, `init`, `install`, `doctor`, `benchmark`, `timing`, `uninstall`, `update`.

## Fixture XML/FigML

| Path | Ukuran | Jenis |
|---|---|---|
| `test/fixtures/mahasiswa-tarif/raw.xml` | 120,257 B | FIGML asli (ada `<?figml version="1.0"?>`) |
| `tester.xml` | 169,793 B | FIGML asli |
| `test/fixtures/eval-hope/ground-truth/raw.xml` | 388 B | XML minimal buatan (tanpa PI figml) |
| `test/fixtures/pilar-golden/ground-truth/raw.xml` | 1,081 B | XML minimal buatan |

## File relevan (fungsi)

### Produksi — parsing & transcript
- `src/lib/figml-parse.mjs` — parser FIGML→transcript (legacy, lossy)
- `src/lib/transcript-schema.mjs` — kontrak schema transcript v3 + `validateTranscript`
- `src/lib/render-transcript.mjs` — transcript→`transcript.md`
- `src/lib/fidelity.mjs` — skor "preservasi atribut visual" (subset kurasi)
- `src/lib/agent-context.mjs` — transcript→`agent-context.md` (inventory role + capabilities)
- `src/commands/transcribe.mjs` — orchestrator auto-detect (XML→figml, image→gemini→static)
- `src/commands/transcribe-gemini.mjs`, `transcribe-static.mjs` — tier vision/static (bukan FIGML)

### Produksi — design-intent (jalur kedua)
- `src/design/ingest.mjs` — entrypoint `ingestDesign`
- `src/design/raw-graph.mjs` — parser "lossless" kedua
- `src/design/visibility.mjs`, `regions.mjs`, `topology.mjs`, `content.mjs`, `constraints.mjs`, `intent-graph.mjs` — pipeline design-intent

### Produksi — agent-facing output
- `src/commands/inspect.mjs` — per-design contract utama
- `src/commands/spec.mjs` — spec.md (satu-pass render)
- `src/commands/plan.mjs` + `src/planning/implementation-plan.mjs` — implementation plan
- `src/commands/resolve.mjs` + `src/lib/resolve.mjs` — idiom resolution (icon/button)
- `src/lib/handoff.mjs` — `.sliceui/handoff.md` (project-level, no design)

### Framework Angular
- `src/framework/angular/*` — conventions, detect, verify, render-*, pilar-*, rules

### Skill
- `skill/SKILL.md` — instruksi agent (117 baris)
- `skill/references/angular13-cheatsheet.md`, `transcript-example-hero.md`
- `skill/handoff/SKILL.md` — companion handoff

### Test relevan
- `test/figml-parse.test.mjs` (27 kasus) — unit parser FIGML
- `test/mahasiswa-tarif.test.mjs` (7) — end-to-end export asli
- `test/transcribe-figml.test.mjs` (3) — auto-detect XML
- `test/fidelity.test.mjs` (5) — skor fidelity
- `test/transcript-schema.test.mjs` (6), `test/render-transcript.test.mjs` (3)
- `test/inspect.test.mjs`, `test/spec.test.mjs`, `test/resolve.test.mjs`
- `test/topology/*` — raw-graph/intent-graph/constraints
- Total ~767 `test()` di 75 file.

## Tidak ditemukan (gap test)
- Tidak ada test XXE/entity/depth/prototype-pollution untuk parser XML.
- Tidak ada test determinism `parseFigml` (byte-compare/hash dua run).
- Tidak ada test malformed-XML selain root-non-FIGML.
