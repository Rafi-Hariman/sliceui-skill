# SliceUI — Kondisi Saat Ini (Full State Document)

> **Tujuan dokumen:** bahan brainstorming bug-fix & optimasi SliceUI untuk agent lain.
> **Tanggal snapshot:** 2026-11-09 · **Commit HEAD:** `76590e3` · **Versi package:** `0.15.0`
> **Test suite:** 797 total / 794 pass / 0 fail / 3 skip (skip env-gated `PILAR_CHECKOUT`)
> **Status working tree:** banyak perubahan **uncommitted** (lihat §12).

---

## 1. Apa itu SliceUI

SliceUI = **agent skill + CLI** yang mengubah desain UI (screenshot / Figma XML) menjadi kode komponen yang idiomatik terhadap project target. Dibangun untuk agentic coding CLI (Claude Code, Cursor, dll) dan model text-only yang tidak bisa "melihat" gambar.

Prinsip inti (dari `skill/SKILL.md:10`):

> "SliceUI adalah **deterministic design-context compiler + project-context router + verification harness** — bukan second reasoning agent. Transcribe sekali, implement sekali, lalu biarkan gate membuktikan."

Dua input, satu pipeline:
- **XML (FIGML) — preferred**: parse deterministik (exact text, warna, geometri, nama komponen), 100% lokal, tanpa API key, tanpa vision, ~90%+ attribute fidelity.
- **Screenshot — fallback**: Gemini vision (tier 1, butuh key) → static macOS fallback (tier 2: `sips` + OCR Swift Vision).

Dependensi runtime: `fast-glob`, `fast-xml-parser`, `typescript`. Dev: `esbuild`, `playwright`, `sass`. Pure ESM, Node ≥ 20.

**Hal kunci:** SliceUI terpecah dua bagian dengan biaya berbeda:
- **CLI** (deterministik, murah/gratis) — kompilasi project + design context.
- **Skill** (agent slicing dari context itu) — ini biaya token AI.

---

## 2. Mental Model & Authority Hierarchy

```
PROJECT CONTEXT  (.sliceui/handoff.md)
+
DESIGN FACTS     (sliceui inspect)
→ IMPLEMENT
→ CHECK          (sliceui check)
```

Authority hierarchy (`A1`–`A5`):
```
A1 DESIGN      (struktur visible, konten, properti visual, order, state)  ← paling tinggi
A2 FRAMEWORK   (validitas sintaksis/struktural)
A3 PROJECT     (idiom/library/token/pattern tim)
A4 PROJECT POLICY (constraint non-visual org)
A5 AGENT JUDGMENT (hanya kalau A1–A4 tidak menjawab)
```

Aturan: authority lebih rendah **tidak boleh menambah/mengubah** design visible yang ditetapkan lebih tinggi. Token design hanya mengganti literal bila menyelesaikan ke **nilai yang sama**.

Recipe states (dari `src/lib/design-resolution.mjs`):
- `required` — terapkan sesuai instruksi
- `allowed` — opsional bila berguna (⚠️ didefinisikan tapi **tidak pernah di-emit** — lihat §11)
- `rejected` — jangan emit
- `conflicting` — A1 DESIGN menang

---

## 3. Struktur Repository

```
src/
  cli.mjs                 entry point, dispatch command + timing log
  commands/               1 file per command (18 command)
  design/                 Design Intent Graph pipeline (FIGML → graph)
    ingest.mjs raw-graph.mjs topology.mjs regions.mjs content.mjs
    intent-graph.mjs constraints.mjs visibility.mjs slice-ir.mjs
  planning/               implementation-plan.mjs design-geometry.mjs recipe-merger.mjs
  verification/           plan-based verify (DOM-evidence, pure, browser-agnostic)
    verify.mjs plan.mjs relationship.mjs content.mjs style.mjs runtime.mjs
    responsive.mjs feedback.mjs applicability.mjs semantic-style.mjs
  framework/angular/      SEMUA pengetahuan Angular (verify, conventions, uii-profile,
                          detect-angular, rules, pilar-*, render-*, check-layers)
  framework/vue-sfc/      (eksperimental) conventions.mjs rules.mjs
  lib/                    generic + helper (agent-context, design-resolution,
                          figml-parse, figml-contract, library-scan/registry, resolve,
                          fidelity, handoff, snapshot, style-tokens, ts-ast, dsb)
  project/                knowledge-graph.mjs recipe-semantics.mjs scss-mine.mjs business-boundary.mjs
  render/                 project-render-adapter.mjs
  ocr/ocr.swift           Swift Vision OCR (macOS)
scripts/                  extract-pilar.mjs, extract-pilar-showcase.mjs, guard-publish.mjs
skill/SKILL.md            skill utama (72 baris)
skill/handoff/SKILL.md    companion skill /sliceui-handoff
skill/references/         angular13-cheatsheet.md, transcript-example-hero.md
research/figml-audit/     audit lengkap FIGML→Angular (read-only, 2026-11-06)
test/                     unit + e2e + eval + render-reality + fixtures
```

File terbesar (porsi signifikan): `framework/angular/pilar-catalog.mjs` (3114 baris, org-private), `framework/angular/verify.mjs` (2268), `framework/angular/pilar-showcase.mjs` (1301).

**Private vs public:** `package.json` `files` mengecualikan `pilar-*.mjs`, `uii-profile.mjs`, `uii-slice-policy.mjs`, `pilar-version.mjs` dari tarball npm publik. Semua checks pilar di-`loadPilar()` → `null` di public install → **skip gracefully**.

---

## 4. Pipeline (agent-facing happy path)

```
sliceui init     → .sliceui/handoff.md (SATU contract project) + conventions + context (WHAT + HOW)
sliceui inspect  → satu design context kompak tervalidasi: struktur + capability + fakta visual
sliceui check    → post-generate blocking gate (design/framework/project/policy), exit 0 = selesai
```

Internal granular — `transcribe`, `resolve`, `spec`, `plan`, `referee`, `verify` — tetap ada sebagai command compat/debug.

**Alur data end-to-end:**
1. `init` → `detect` → scan project → `project-context.json` + `conventions.json` + `conventions.md` + `handoff.md` (+ UII-only: `uii-profile.md`, `pilar-reference.md`, `pilar-showcase.md`).
2. `inspect <design>` → reuse `transcribe()` + `persistTranscript()` → `buildSpec` + `buildAgentContext` → compact output. FIGML juga compile Design Intent Graph (`ingestDesign`).
3. Agent implement komponen (baca `handoff.md` → `inspect` → source yang disebut `inspect` saja).
4. `check <dir> [design]` → delegate ke `verify` (exit 0/1/2/3).

---

## 5. Referensi Command Lengkap

| Command | Fungsi | Exit codes | Artefak |
|---|---|---|---|
| `install [--dir]` | copy skill → `~/.claude/skills/sliceui` + companion `/sliceui-handoff`; anti-clobber (backup `.bak`) | 0/1 | manifest `.sliceui-cli-version` |
| `init [--key-from F] [--framework] [--yes] [--profile]` | setup project: dir, config, `.env.local`, gitignore, `detect` | 0/2/interactive | `project-context.json`, `conventions.json/.md`, `handoff.md`, `context/*.md`, UII docs, `referee-verdict.json` |
| `detect [--force]` | scan framework/library/conventions (freshness gate via `inputHash`) | 0 | sama (rewrite) |
| `transcribe <input> [--static] [--transcript-version 2]` | XML → parse deterministik; image → Gemini → static | 0/2/3/4 | `artifacts/<stem>/transcript.{json,md,meta.json}` + `contract.json` (+ `sliceir.json`+`transcript-v2/` bila v2) |
| `resolve <xml\|json>` | map tiap styled leaf → kandidat idiom exact | 0/2/3 | `artifacts/<stem>/resolved.json` |
| `spec <xml\|json>` | one-pass render doc (elements + inline idioms + copy-targets) | 0/2/3 | `spec.md` + `agent-context.md` + `context-manifest.json` |
| `inspect <xml\|img> [--json]` | **primary per-design contract** | 0/2/3 | cache yang dibaca `check` |
| `plan <xml\|figml> [--json]` | compact Implementation Plan (Design Intent ⊕ Project Knowledge) — **fast-path, FIGML-only** | 0/2/3 | stdout only |
| `check <dir> [design] [--render --layers]` | post-generate gate (delegate `verify`) | 0/1/2/3 | — |
| `verify <dir> [name]` | compat alias `check` | 0/1/2/3 | — |
| `referee [root] [--target N] [--deep]` | validasi ground-truth artifact (snapshot mode default) | 0/1/2 | — |
| `fidelity <xml>` | skor preservasi atribut FIGML→transcript (%) | 0 (≥90%)/1/2/3 | stdout |
| `benchmark [--json]` | seeded benchmark + maturity matrix | 0 | stdout |
| `doctor` | diagnosa install (Node/platform/sips/swiftc/key/skill/live Gemini/pilar drift) | 0/1 | — |
| `timing` | per-stage wall-clock dari `runs.jsonl` | 0 | — |
| `uninstall [--skill]` | hapus `.sliceui/` (+ `.env.local` bila sliceui-owned) | 0 | — |
| `update` | self-update CLI + refresh skill | 0/1 | — |

`cli.mjs` mencatat tiap run ke `.sliceui/runs.jsonl` (kecuali `UNTIMED_COMMANDS`), yang membuat "ke mana menit pergi" terjawab via `sliceui timing`.

---

## 6. Design Data Pipeline (Transcription)

### 6.1 Dua parser XML (divergen)

| Parser | Lokasi | Sifat |
|---|---|---|
| Legacy transcript | `src/lib/figml-parse.mjs` | lossy by design; fokus field kurasi (text/color/geometry/radius/border/padding/gap/justify/hidden) |
| Raw Design Graph | `src/design/raw-graph.mjs` | "lossless"; baca `mainComponent.id`, constraints, layoutPositioning, sizing, alignment, opacity, fontName |

**Masalah audit:** keduanya mengklasifikasi node independen, keduanya dulu **drop `mainComponent.id`**, tanpa shared vocabulary, tanpa schema-version gate, dan module-global id counter (`_idSeq`) yang non-deterministik.

### 6.2 Tiga lapisan baru (additive, tidak menghapus parser lama)

1. **`src/lib/figml-contract.mjs` (Phase 1, 2026-11-06)** — kontrak terpadu:
   - `parseFigmlContract(xml, filename)` → full-fidelity `ContractDoc` (simpan SEMUA element+attribute, `mainComponent.id`, `schemaVersion`, checksum, aggregated diagnostics).
   - `normalizeFromTranscript` / `normalizeFromRawGraph` → satu `NormalizedDesign` minimal yang sama → buktikan kedua parser ekuivalen pada field yang penting.
   - 6 kode diagnostics: `missing-critical-field`, `unknown-element`, `unknown-attribute`, `inferred-default`, `ambiguous-value`, `unsupported-field`.
   - `makeIdSeq()` per-parse (fix determinisme global counter).
   - Menulis `contract.json` (additive, transcript lama byte-identical).

2. **`src/design/slice-ir.mjs` (Phase 2, 2026-11-06)** — SliceIR minimum versioned `sliceir/0.1`:
   - `buildSliceIR(contractDoc)` → nodes + indexes + stats + diagnostics + `subtreeHash` + provenance per property.
   - Memulihkan 14 field critical-loss (lihat §9).

3. **`src/lib/render-hierarchical-transcript.mjs`** — transcript v2 opt-in (`--transcript-version 2`): `transcript-v2/{manifest,outline,diagnostics,components,sections}` + trust guard.

**Default output (tanpa flag) byte-identical** — transcript lama tidak berubah. v2 adalah opt-in.

### 6.3 Screenshot tier

- **Tier 1 Gemini** (`transcribe-gemini.mjs`): `callGemini(TRANSCRIBE_PROMPT, image)` → `parseJsonLoose` → OCR overlay (nearest box + bigram-Jaccard > 0.3 → **string OCR menang** atas teks vision). Default model `gemini-3.6-flash`.
- **Tier 2 static** (`transcribe-static.mjs`, macOS-only): `sips` → BMP (downscale 512px) → pure-JS decode → band detection → Swift Vision OCR → band typing heuristik (nav/hero/section/footer by posisi y).

---

## 7. Design Intent Graph (`src/design/`)

Pipeline FIGML → graph (untuk `inspect` + `plan` + verify plan-based):

| Modul | Peran |
|---|---|
| `ingest.mjs` | entry ingest design |
| `raw-graph.mjs` | raw parse (lossless) |
| `topology.mjs` | relative layout constraint (SIBLING_RATIO, ITEM_DISTANCE, GRID_TRACKS, ANCHOR, ALIGNMENT, RELATIVE_SIZE, CONTAINMENT) |
| `regions.mjs` | region detection |
| `content.mjs` | exact visible content |
| `intent-graph.mjs` | compile intent graph |
| `constraints.mjs` | constraint extraction |
| `visibility.mjs` | runtime visibility |
| `slice-ir.mjs` | SliceIR projection |

Graph dikonsumsi oleh:
- `inspect` (sections: topology/layout constraints/exact content/runtime state/uncertainty < 0.5 confidence).
- `plan` (`buildImplementationPlan`).
- `verification/` (compile `VerificationPlan` → verify terhadap DOM evidence).

---

## 8. Verification Gate

### 8.1 Dua mesin verify (berbeda tapi terkait)

**(a) 33 static checks** — `src/framework/angular/verify.mjs` (`verifyComponent`), didekomposisi ke 4 authority layer oleh `check-layers.mjs`:

| Layer | Jumlah | Checks |
|---|---|---|
| **design** | 11 | `textCoverage`, `styleFidelity`, `phantomWrapper`, `modalWrapper`, `containerPadding`, `requiredMarker`, `iconColor`, `inventedLayout`, `buttonOrder`, `filterRowButton`, `gridColumns` |
| **framework** | 6 | `scssCompiles`, `frameworkSyntax`, `declaredInModule`, `noHashedSelectors`, `deadCode`, `typeCheck` |
| **project** | 10 | `classVocabulary`, `inventedUtility`, `loadedClass`, `libraryTable`, `ngxSelectBinding`, `scssCoverage`, `noBareNgDeep`, `alignmentViaDeepCss`, `tableOptions`, `anatomy` |
| **policy** | 6 | `pilarBindings`, `pilarInjection`, `rowAuth`, `tableBindings`, `mockRowCount`, `noTranslation` |

> Catatan: header `check-layers.mjs` bilang "32" tapi `CLASSIFICATION` berisi **33** entry — inkonistensi minor.

`render` **bukan** check layer — ia adalah **backstop mechanism** yang diterapkan pada verdict design render-dependent (`styleFidelity`, `containerPadding`, `iconColor`) saat browser bisa mengukur cascade.

**(b) Plan-based verification** — `src/verification/*.mjs`: compile `VerificationPlan` dari intent graph → verify terhadap measured DOM evidence (geometry rects, computed styles, visible text, runtime state). **Pure** — tidak pernah launch browser/read fs. Digunakan oleh mount/probe tooling.

### 8.2 Exit code contract

```
0 = verified pass   1 = verified fail   2 = invalid input/target   3 = unverifiable
```

**"No ground truth is never green"** — 5 enforcement points:
1. `hasGroundTruth = conventions || transcript || rawXml`; tanpa itu → `unverifiable` → exit 3.
2. Unpaired design (name tak match, tanpa flag `--xml/--transcript`) → exit 3 "UNVERIFIED (design pairing failed)".
3. Snapshot conventions malformed/conflict → exit 3 (ground-truth state, bukan empty).
4. Per-check honesty: kurang evidence → `skip`, **bukan** `pass`.
5. Render side: tiap build/mount/runtime/browser failure adalah non-green state.

**`warn` TIDAK PERNAH mem-block** — hanya dicetak. (Ini trade-off yang dipilih berulang: classVocabulary invented-classes, deadCode, alignmentViaDeepCss, inventedLayout, mockRowCount, declaredInModule, modalWrapper, tableBindings rowsChanged, pilarInjection.)

### 8.3 Render backstop (`--render`)

- Static verify **selalu jalan dulu**; `!staticPass` → render SKIPPED (render adalah superset, bukan retry foundation invalid).
- Compile SCSS real (Dart Sass) → wrap template+CSS dalam komponen Angular-13 throwaway (esbuild, offline via `page.route` abort non-data request) → headless Chromium → fixed viewport (default 1440×900).
- `competingCss` = stylesheet project real dari `loadedClassRegistry.files` (≤4 file / ≤1 MB) di-inject global sebelum mount → authored `::ng-deep` benar-benar bersaing dengan cascade nyata.
- Geometry facts (`render-geometry.mjs`): tolerance terpusat (box 2px, line-height 1px, gap 1px, radius 1px, font-size 1px, letter-spacing 0.5px, font-weight exact). Gap diukur sebagai **jarak rendered efektif antar child pertama** (bukan computed `gap`) — menangkap stacked-spacing defect.

---

## 9. Field Coverage & Critical Loss (Hasil Audit)

Audit `research/figml-audit/` (2026-11-06) membuktikan **FIGML tidak lossless** dan menemukan **10 field critical-loss**:

| # | Field | Dampak | Status |
|---|---|---|---|
| 1 | `mainComponent.id` (relasi component→instance) | agent tak tahu instance → komponen apa | ✅ **fixed** di contract/SliceIR (belum di transcript legacy) |
| 2 | Rich text / mixed-font spans | teks campuran font hilang jadi string tunggal | ⏳ deferred (diagnostic + sentinel) |
| 3 | Font family (`fontName.family`) | transcript cuma size/weight/color | ✅ recovered ke SliceIR |
| 4 | `layoutSizingHorizontal/Vertical` (FILL/HUG) | responsive: node FILL vs HUG tak tersalur | ✅ recovered ke SliceIR |
| 5 | Alignment `primaryAxisAlignItems`/`counterAxisAlignItems` (CENTER/MAX) | hanya SPACE_BETWEEN tersalur | ✅ recovered ke SliceIR |
| 6 | `layoutPositioning="ABSOLUTE"` | absolute child hilang | ✅ recovered ke SliceIR |
| 7 | `constraints` (SCALE/CENTER/MIN) | resize behavior hilang | ✅ recovered ke SliceIR |
| 8 | Opacity non-zero | hanya dipakai deteksi hidden (`==0`) | ✅ recovered ke SliceIR |
| 9 | `required` flag | diparse tapi **dead field** (tak dibaca siapapun) | ✅ recovered ke SliceIR |
| 10 | Instance overrides non-visible | hanya `overriddenField="visible"` dipakai | ✅ recovered ke SliceIR |

**Coverage score:**
- P0 exact 61.5% / usable 84.6% (13 field terverifikasi).
- P1 exact 41.2% / usable 47.1% (17 field).

> ⚠️ **`sliceui fidelity` menyesatkan** — `computeFidelity` (`fidelity.mjs:32-36`) HANYA menskor 13 atribut kurasi. Field hilang tidak masuk denominator, jadi "100%" ≠ lossless.

**Inference sites (~11 heuristik)** — interpretasi yang TIDAK dari XML: `classifyInstance` (regex nama), `markTables` (geometri ≥3 baris), `FA_ICON_COLORS` (warna→ikon), `NAME_GLYPH` (alias nama→glyph), deteksi pagination (regex teks Indonesia), heading (fontSize≥18), select-vs-input (hasIconChild), badge status (warna/teks), button variant (bg), color census (luminance/saturation), table row compression.

---

## 10. Project Context & Conventions (`init`/`detect`)

`detect` membangun dua artefak:
1. **`project-context.json` (WHAT)** — capabilities map (13 kategori: select/table/modal/toast/editor/date/slider/switch/pagination/divider/well/checkbox/layout), provenance (`sourceCode|configFile|registryDefault`), designTokens, sampleComponents, moduleStructure, componentDir, inputHash.
2. **`conventions.json` + `conventions.md` (HOW)** — classVocabulary (top-40 + family ≥2-sibling), ngDeepCorpus (override corpus merged, majority-vote canonical, hashed-scope stripped), componentAnatomy (wellAvailable/tableTag/skeletonTag/pagination/mockRowsFloor), naming, loadedClassRegistry.

**Mining SCSS** via `project/scss-mine.mjs` (compileString → flat CSS → balanced-brace reader; sass-unavailable → salvage regex `::ng-deep`). `recipe-semantics.mjs` klasifikasi 7 kelas (STATE_STYLE, STRUCTURAL_INTERNAL, BEHAVIOR_REQUIRED, PAGE_SPECIFIC_GEOMETRY, DESIGN_OVERRIDABLE, VISUAL_DEFAULT, UNVERIFIED) dengan confidence 0.9/0.7/0.35.

**UII gating (kerahasiaan org):** fingerprint project (repo-name / dep `@uiigateway/*`|`pilar` / registry `npm.uii.ac.id`) → profile `uii|generic`. Idiom pilar/@uiigateway hanya tersedia ke UII. Parser sample lokal **sengaja OFF untuk UII** (`detect.mjs:88`, anti-idiom-stale 2026-09-24).

---

## 11. Framework Support Matrix (jujur per-layer)

| Framework | Detect | Codegen rules | Deep adaptation (library/convention/verify) |
|---|---|---|---|
| **Angular** (v13-first) | ✅ | ✅ version-aware | ✅ full — SATU-satunya yang gated `verify` |
| React (TSX) | ✅ | ✅ | ⚠️ experimental — verify tak baca `.tsx` (exit 2) |
| Next.js | ✅ | ✅ | ⚠️ experimental |
| Vue 3 (SFC) | ✅ | ✅ | ⚠️ experimental |
| Svelte | ✅ | ✅ | ⚠️ experimental |
| Tailwind/HTML | ✅ (fallback) | ✅ | ⚠️ experimental — no corpus, no gate |

---

## 12. Status Saat Ini (Uncommitted + Recent Commits)

### Recent commits (HEAD `76590e3`)
```
76590e3 fix(sliceui): harden error handling and resolve audit findings
f824a03 Commit 1 — pembersihan docs
128d6ff delete fixing docs
b0728a1 docs sync
decda3a feat(sliceui): complete rendered geometry verification
60a0835 feat(sliceui): add ambiguity-safe geometry verification
0394317 feat(sliceui): add safe opt-in rendered verification
2617638 feat(sliceui): strengthen verify reliability and syntax safety
a6fd181 feat(sliceui): add typed resolve provenance and ambiguity safety
f67f8bb feat(sliceui): add compact agent context and snapshot referee
```

### Uncommitted (18 file, +333/−51) — dua kelompok pekerjaan:

**(A) FIGML audit implementasi (Phase 1 + 2):**
- `src/lib/figml-contract.mjs` (BARU), `src/design/slice-ir.mjs` (BARU), `src/lib/render-hierarchical-transcript.mjs` (BARU)
- `src/lib/figml-parse.mjs`, `src/commands/transcribe.mjs`, `src/lib/render-transcript.mjs`
- `test/figml-contract.test.mjs`, `test/slice-ir.test.mjs` (BARU)

**(B) Field-validation token-cost edits (5 edit, dari field test 2026-10-27 di project bill):**
1. Uncertainty berjangkar node-id di `inspect` stdout
2. Section "Unresolved (do not guess)" masuk `agent-context.md`
3. Legenda geometri `[x,y W×H]` di `transcript.md`+`spec.md`
4. Split provenance API (pilar-catalog) vs sample
5. Stub `AuthorizationModel` 10 field + inline shape di `uii-profile`

Files terkait: `inspect.mjs`, `spec.mjs`, `agent-context.mjs`, `diagnostics.mjs`, `uii-profile.mjs`, `verify.mjs`, `check-layers.mjs`, `pilar-typecheck.mjs`, `library-scan.mjs`, `pilar-loader.mjs`, `implementation-plan.mjs`, `knowledge-graph.mjs`, `render-transcript.mjs`, `SKILL.md`, + 2 test.

> Catatan: edit #5b (sample) butuh `sliceui init` re-run untuk ter-bake ke `project-context.json`.

---

## 13. Known Issues / Bugs / Deferred (bahan brainstorming)

### 13.1 Audit-verified (research/figml-audit)

**Prompt injection (5 medium):**
1. Layer name tersalur verbatim tanpa isolasi teknis (hanya SKILL.md:62 instruksional).
2. Text content (`characters`) verbatim.
3. Component/variant name verbatim.
4. Data desain bercampur instruksi di `spec.md` (batas = markdown block, bukan struktural).
5. Agent menjalankan instruksi dari content desain (tidak ada delimitasi).

**Bug parser:**
- `fidelity` "100%" menyesatkan (subset 13 atribut).
- `mainComponent.id` fixed di contract/SliceIR tapi **belum tersalur ke transcript legacy** (agent-facing utama).
- `required` adalah **dead field** di legacy (diparse, tak dibaca siapapun).

### 13.2 False-positive hotspots di verify (dari map check)

1. **Regex Indonesia baku di check "universal"**: `/^pilih\b/i` (textCoverage), evidence `Tampilkan/Menampilkan N data` (tableOptions/libraryTable), word-list `cari|search|filter|apply|terapkan|go|jalankan|reset|ulang` (filterRowButton).
2. **Data org hardcoded**: `FA_ICON_COLORS` (hex→ikon), `FRAMEWORK_BUTTONS` + `UTILITY_HINTS`, neutral-color sets, asumsi grid **12-kolom Bootstrap**.
3. **`JSON.stringify(transcript)` sebagai evidence test** (loose dua arah): `\bwell\b`, `\bmodal\b`, inventedLayout word-test.
4. **Signal-substring tanpa semantik**: `buttonOrder` gagal pada `row-reverse` APAPUN (termasuk RTL/icon-flip legit); `noTranslation` scan komentar (tak di-strip).
5. **Token-level scssCoverage** (token apapun di rule apapun satisfy) + exact-string diff bare-`::ng-deep`.
6. **Threshold untuk diketahui**: styleFidelity 80%, filter button ≤24 char, mockRows >100, responsive FILL 0.05, viewport 200–7680, competingCss ≤4 file/≤1 MB, render timeout 15s mount + 100ms settle.
7. **`gridColumns` hanya parse `div`** (col-span dari `<form>`/custom-element tak terlihat); asumsi Bootstrap 12.
8. **`primaryState`**: satu `fail` (termasuk layer policy) mem-block seluruh gate, walau layer design pass.

### 13.3 Inkonistensi lintas modul

- Standalone `transcribe-static`/`transcribe-gemini` menulis **flat** `.sliceui/transcript.json` (bukan `artifacts/<stem>/`) — inkonsisten dengan orchestrator.
- `referee` `readTranscript` memilih design pertama di `artifacts/` **arbitrer** bila banyak.
- Recipe state `"allowed"` didefinisikan tapi **tak pernah di-emit** (dead state).
- `runs.jsonl` punya stage "check" DAN "verify" keduanya di dispatch.
- Exit code `4` unik untuk `transcribe` (v2 build failure).
- Header `check-layers.mjs` bilang "32 checks" tapi ada 33.

### 13.4 Deferred (dari remediation + field validation)

- **`guard-publish.mjs` env-var casing** — `NPM_CONFIG_REGISTRY` vs `npm_config_registry` (bug dikonfirmasi, ditunda karena publish-related).
- **`sliceui plan` promotion** — masih fast-path, belum divalidasi token+quality vs `inspect`.
- **Behavioral compilation (§7 final-remediation)** — action→auth→output chain butuh pilar catalog gating.
- **Design delta (§8)** — coverage MINUS recipe = local delta.
- **Responsive verification (§10.5)** — render infra belum diperluas.
- **Gate warning alignment** + expose idiom `.button-action-{right,left,center}` — ditunda karena idiom konteks-dependent (list=right, modal/form=center), frekuensi naif justru salah.
- **Field-test gap #5b** — perlu `init` re-run.

### 13.5 Dampak token-cost (field evidence)

Field test 2026-10-27: **79.9k token / 14 mnt** (baseline 104k/19 mnt). Root cause: **context INCOMPLETE, bukan agent undisciplined** — `inspect` awalnya tak menamai source path, tak inline library API, cuma 1 row representatif, tak kasih shape `AuthorizationModel`. 3 gap konteks nyata terverifikasi (bentuk AuthorizationModel, provenance API mislabel, tanpa legenda notasi geometri).

---

## 14. Rekomendasi Arsitektur (dari audit FASE 9)

**Pilihan B** (rekomendasi): `FigML → versioned adapter → SliceIR → scene index → hierarchical transcript`.

Alasan (dibuktikan audit):
1. Dua parser divergen sudah mendekati "adapter + IR" tapi tanpa kontrak — SliceIR menyatukannya.
2. `mainComponent.id`, constraints, layoutPositioning, sizing, alignment, opacity, fontName sudah dibaca `raw-graph.mjs` tapi tak pernah jadi agent-facing — adapter+IR tempat menyalurkannya.
3. Versioning kosong (`?figml version="1.0"` tak di-gate).

**Perubahan minimum yang disarankan (fase berikutnya):**
1. Hentikan drop `mainComponent.id` di kedua parser (P0). ✅ (done di contract)
2. Salurkan `fontName.family` → `style.family` + `tokens.fonts` (P1). ✅ (SliceIR)
3. Salurkan `layoutSizingH/V`, `alignPrimary/Counter`, `layoutPositioning`, `constraints` (P1 responsive). ✅ (SliceIR)
4. Salurkan `opacity` non-zero. ✅ (SliceIR)
5. Salurkan `required` ke `inspect`/`spec` (bukan hanya hidden-asterisk). ✅ (SliceIR)
6. Tambah `schemaVersion` gate (baca `?figml version`). ⏳ belum
7. **Chunking per Page/Section/Frame + dedup repeated instance** untuk scale ribuan node. ⏳ belum (10k node ≈ 1.37 MB ≈ 340k token, over window)
8. **Delimitasi data desain** (prompt-injection isolation) di render layer. ⏳ partial (guard line di transcript.md)

---

## 15. Test Suite & CI

- `npm test` = `node --test test/` (platform-agnostic, CI ubuntu).
- Coverage: unit (figml-parse, figml-contract, slice-ir, design-resolution, detect, conventions, check, inspect, agent-context, fidelity, doctor) + e2e + `eval-hope-sliceui` (permanen di CI, fixture sintetis — membuktikan verify memisahkan output manusia-benar vs mesin-drift) + render-reality (3 probe browser: effective spacing / runtime visibility / computed cascade).
- **macOS coverage = known gap** (static tier diuji manual, bukan CI).
- Fixture `angular-mount` di-provision sehingga render test benar-benar jalan di browser (bukan skip).
- 3 skip env-gated `PILAR_CHECKOUT` (org-private, tak tersedia lokal).

---

## 16. Peta Istilah Cepat

- **handoff.md** — router project contract (framework + capability + reference path + tokens bounded), tidak inline corpus.
- **inspect** — primary per-design read (structure + required capabilities + critical visual facts + mappings + recipes by state + conflicts + dangerous defaults + uncertainty).
- **spec.md / agent-context.md** — internal artifacts (spec = full detail, agent-context = scoped + Read: paths).
- **resolved.json** — map styled leaf → idiom candidate (schema 2: groups + behaviorBindings).
- **contract.json** — full-fidelity FIGML parse + diagnostics (Phase 1).
- **sliceir.json / transcript-v2/** — versioned IR + hierarchical transcript (Phase 2, opt-in).
- **pilar / uii** — org-private grammar (component catalog, convention profile, reference docs), gated ke project UII.
- **recipe** — implementation evidence (bukan visual authority): required/allowed/rejected/conflicting.
- **golden reference** — sample komponen yang di-check-in sebagai sumber idiom (marked READ FIRST).

---

*Dokumen ini disintesis dari: `README.md`, `skill/SKILL.md`, `src/cli.mjs`, seluruh `src/**`, `research/figml-audit/**`, `docs/HANDOFF-2026-10-27.md`, memory session, dan git history. Untuk bukti file:baris spesifik, lihat `research/figml-audit/index.html` (self-contained) dan dokumen audit individual.*
