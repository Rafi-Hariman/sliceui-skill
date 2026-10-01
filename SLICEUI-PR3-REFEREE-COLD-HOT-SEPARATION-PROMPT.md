# SliceUI PR 3 Implementation Plan: Referee Cold/Hot Separation

Repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Project target nyata yang hanya boleh digunakan sebagai bukti read-only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Dokumen yang wajib dibaca sebelum implementasi:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
docs/project-docs/development/api-contract.md
```

Prompt PR sebelumnya bila tersedia:

```text
SLICEUI-PR1-AGENT-CONTEXT-REDUCTION-PROMPT.md
SLICEUI-PR2-SNAPSHOT-DEDUPLICATION-PROMPT.md
SLICEUI-PR2-CORRECTIVE-PATCH-MISSING-GROUND-TRUTH.md
```

## 1. Mandatory Entry Gate

Sebelum mengubah source:

1. Baca laporan verifikasi PR 2.
2. Pastikan corrective patch VER-001 telah selesai.
3. Pastikan keputusan terakhir menyatakan:

```text
PR 2 may be closed: YES
PR 3 may start: YES
```

4. Jalankan tests existing yang paling dekat dengan snapshot dan referee untuk memastikan baseline hijau.
5. Jika PR 2 belum mengizinkan PR 3, hentikan pekerjaan.
6. Jangan memperbaiki finding PR 1 atau PR 2 lain dalam task ini.

Catat evidence entry gate pada respons akhir.

## 2. Masalah yang Harus Diselesaikan

Audit membuktikan `sliceui referee --target` melakukan full repository scan pada setiap slicing.

Call path aktual mencakup operasi seperti:

```text
referee --target
→ locate target component melalui repository-wide glob
→ read seluruh *.html
→ read seluruh *.scss dan *.css
→ read seluruh *.component.ts
→ merge source menjadi corpus besar
→ validate convention provenance
→ detect duplicate selectors
```

Pada target nyata audit mencatat sekitar:

```text
539 project-source reads
538 unique project files
sekitar 3.4 MB source dibaca
full scans atas HTML, SCSS, CSS, dan component TS
```

Validasi tersebut berguna untuk membuktikan provenance project, tetapi tidak seharusnya dijalankan pada setiap slice.

Target arsitektur:

```text
COLD PATH
init / detect --force / explicit deep referee
→ scan repository
→ validate convention provenance
→ detect duplicate selectors
→ build codebase-evidence verdict
→ bind verdict to project/snapshot fingerprint
→ persist verdict in .sliceui

HOT PATH
referee --target <design>
→ read .sliceui snapshot
→ read design XML/transcript/artifacts
→ read stored codebase-evidence verdict
→ validate freshness
→ perform target/design checks
→ project-source reads = 0

EXPLICIT DEEP MODE
referee --target <design> --deep
→ perform live repository scan
→ report live findings
→ optionally refresh stored verdict only under explicit documented policy
```

## 3. Tujuan PR 3

Implementasikan pemisahan cold path dan hot path pada referee dengan perubahan minimal dan backward-compatible.

PR ini harus menghasilkan:

1. Stored referee/codebase-evidence verdict pada `.sliceui`.
2. Fingerprint yang mengikat verdict ke snapshot/project state.
3. `referee --target` default tanpa repository-wide scan.
4. `referee --target --deep` sebagai explicit live validation.
5. Clear stale/missing verdict diagnostics.
6. Tidak ada silent deep scan.
7. Tidak ada pass-by-absence.
8. Existing referee findings tetap tersedia dalam deep mode.
9. Existing target/design validation tetap tersedia pada hot path jika dapat dilakukan dari snapshot.
10. Tests yang membuktikan hot-path repository-source reads sama dengan nol.

## 4. Scope yang Diizinkan

PR 3 boleh mengubah:

- `src/commands/init.mjs` sejauh menyimpan cold-path verdict;
- `src/commands/detect.mjs` sejauh fingerprint/snapshot metadata diperlukan;
- `src/commands/referee.mjs`;
- `src/lib/referee.mjs`;
- helper fingerprint/provenance kecil di `src/lib/` bila diperlukan;
- `src/cli.mjs` hanya untuk flag `--deep` atau reporting yang diperlukan;
- `src/lib/timing.mjs` hanya jika perlu mencatat deep/snapshot mode tanpa redesign besar;
- tests referee/init/detect yang relevan;
- owning active documentation;
- fixtures minimal untuk stored verdict dan freshness.

## 5. Di Luar Scope

Jangan mengimplementasikan:

- perbaikan PascalCase verify normalization;
- redesign `fs-trace` menyeluruh;
- loader-level Node interception sebagai production dependency;
- resolve confidence/provenance;
- visual/render verification;
- perubahan FIGML parser;
- perubahan agent context PR 1;
- perubahan snapshot ownership PR 2;
- conventions-body conflict diagnostic CNF-001;
- incremental source-file indexing lengkap;
- content-addressed cache;
- command `refresh` baru kecuali benar-benar tidak dapat dihindari;
- perubahan generated Angular output;
- dependency baru tanpa kebutuhan mutlak;
- unrelated cleanup, formatting, atau refactor;
- commit Git.

Jika menemukan defect lain, dokumentasikan sebagai deferred finding.

## 6. Invariant Utama

Pertahankan invariant berikut:

### No hidden scan

```text
referee --target <name>
```

tidak boleh melakukan repository-wide glob, walk, atau reads secara diam-diam.

### Deep is explicit

Live source validation hanya melalui:

```text
referee --target <name> --deep
```

atau cold path yang secara jelas dijalankan saat init/detect setup.

### No pass-by-absence

Jika stored verdict tidak tersedia atau tidak dapat dipercaya:

- jangan pass;
- jangan auto-scan;
- hasil harus `NOT VERIFIABLE`, `STALE`, atau equivalent non-green;
- exit code non-zero;
- diagnostic harus memberi tindakan eksplisit.

### Deep validation parity

Deep mode harus mempertahankan kemampuan lama dalam menemukan:

- convention evidence yang tidak lagi ditemukan;
- duplicate selectors;
- target component lookup bila memang bagian current behavior;
- corruption/staleness yang sebelumnya dilaporkan referee.

### Snapshot mode correctness

Hot mode hanya boleh memercayai verdict yang:

- valid schema;
- sesuai fingerprint;
- tidak stale;
- memiliki hasil dan evidence summary yang diperlukan.

## 7. Audit Wajib Sebelum Implementasi

Audit aktual source, jangan hanya mengikuti dokumen.

Minimal baca:

```text
src/commands/referee.mjs
src/lib/referee.mjs
src/commands/init.mjs
src/commands/detect.mjs
src/lib/snapshot.mjs
src/lib/fs-trace.mjs
src/lib/timing.mjs
src/cli.mjs
test/referee.test.mjs
test/init.test.mjs
test/detect.test.mjs
test/fs-trace.test.mjs
test/timing.test.mjs
skill/SKILL.md
```

Cari seluruh call site:

```bash
rg -n "refereeArtifacts|referee|findDuplicateSelectors|locateTargetTs|fast-glob|fg\.sync|glob|readFileSync|project-context|inputHash|fingerprint|git rev-parse" src test skill docs README.md
```

Buat klasifikasi checks referee aktual:

```text
codebase-wide provenance check
codebase-wide duplicate selector check
target component existence check
design/transcript fidelity check
artifact consistency check
snapshot freshness check
framework/project compatibility check
```

Untuk setiap check, tentukan:

- membutuhkan live repository atau tidak;
- dapat dipindahkan ke init atau tidak;
- dapat dijawab dari stored verdict atau tidak;
- harus tetap hot atau tidak;
- severity dan exit effect;
- source of truth.

Jangan coding sebelum klasifikasi selesai.

## 8. Arsitektur Verdict yang Direkomendasikan

Simpan satu artifact machine-readable di `.sliceui`, misalnya:

```text
.sliceui/referee-verdict.json
```

Nama boleh disesuaikan jika convention repository lebih kuat, tetapi jangan menyimpan verdict per-design jika isinya merupakan codebase evidence global.

Struktur konseptual:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-09-25T00:00:00.000Z",
  "mode": "deep",
  "projectFingerprint": {
    "algorithm": "sha256",
    "value": "...",
    "inputs": []
  },
  "snapshotFingerprint": {
    "algorithm": "sha256",
    "value": "...",
    "inputs": []
  },
  "status": "pass",
  "findings": [],
  "evidence": {
    "filesConsidered": 0,
    "selectorsChecked": 0,
    "conventionClaimsChecked": 0,
    "duplicateSelectors": []
  },
  "tool": {
    "version": "0.15.0"
  }
}
```

Gunakan fields aktual yang diperlukan. Jangan menyimpan:

- full repository source;
- concatenated HTML/SCSS/CSS;
- raw component bodies;
- secrets;
- absolute paths yang tidak perlu;
- data design-specific yang berubah setiap slice;
- duplicate snapshot blobs.

Stored verdict harus ringkas dan cukup untuk menjawab apakah codebase evidence validated pada fingerprint tertentu.

## 9. Pisahkan Dua Jenis Fingerprint

### Project/codebase fingerprint

Fingerprint untuk mendeteksi perubahan source yang dapat membuat provenance verdict stale.

Harus mempertimbangkan tradeoff performa. Jangan melakukan full file read pada hot path hanya untuk menghitung freshness.

Gunakan source fingerprint yang sudah tersedia jika cukup, misalnya:

```text
existing detect inputHash
git HEAD
package/lock/config hashes
snapshot-generated fingerprint
explicit codebase evidence hash computed during deep scan
```

Namun audit sebelumnya mencatat git HEAD saja tidak melihat uncommitted source changes. Untuk PR 3, gunakan minimal safe policy yang tidak memerlukan full scan hot path.

Pilihan acceptable:

```text
strong cold-path fingerprint
+ cheap hot-path anchors
+ explicit stale/unknown state when certainty is insufficient
```

Jangan mengklaim fresh bila system tidak dapat membuktikannya.

### Snapshot fingerprint

Bind verdict ke canonical files yang memengaruhi claims, misalnya:

```text
project-context.json
conventions.json
relevant config
framework/library profile
```

Computing hash atas beberapa bounded `.sliceui` files pada hot path diperbolehkan.

### Required behavior

```text
fingerprints match   → stored verdict trusted
fingerprints differ  → stale, non-green, no silent scan
verdict absent       → missing, non-green, no silent scan
verdict malformed    → invalid, non-green, no silent scan
```

## 10. Cold-Path Generation

Cold-path verdict harus dibuat melalui salah satu atau kedua jalur berikut, sesuai architecture existing:

### During `sliceui init`

Setelah project detection dan conventions snapshot selesai:

```text
run deep codebase evidence validation
persist referee verdict
report findings
```

Current init sudah menjalankan referee report-only. Reuse logic tersebut. Hindari full scan tambahan selain scan yang memang diperlukan.

Jika detect dan referee saat ini melakukan dua independent full scans, PR 3 tidak wajib mengoptimalkan seluruh cold-path duplication, tetapi jangan menambah scan ketiga.

### During explicit deep referee

```bash
sliceui referee --target <name> --deep
```

Deep mode:

1. melakukan live scan;
2. menghasilkan findings;
3. mencatat read metrics jika tersedia;
4. menentukan apakah verdict global aman diperbarui;
5. menyimpan verdict hanya bila policy eksplisit dan tests mendukung;
6. tidak menyimpan pass verdict jika validation gagal atau incomplete.

Tentukan dan dokumentasikan policy update:

```text
--deep updates verdict by default
```

atau:

```text
--deep reports only; init is sole writer
```

Pilih pendekatan paling kecil dan konsisten dengan workflow existing. Jangan membuat hidden side effect tanpa dokumentasi.

## 11. Hot-Path `referee --target`

Default hot path harus membaca bounded inputs saja:

```text
.sliceui/project-context.json
.sliceui/conventions.json
.sliceui/referee-verdict.json
design XML/transcript/meta
resolved/spec only if current check requires
bounded target metadata already in snapshot
```

Default hot path tidak boleh:

- `fg.sync("**/*.html")`;
- `fg.sync("**/*.scss")`;
- `fg.sync("**/*.css")`;
- `fg.sync("**/*.component.ts")`;
- recursively walk project source;
- concatenate source files;
- search target across entire project;
- invoke detect/init automatically;
- invoke deep mode automatically.

Target component existence pada pre-generate stage perlu dikaji. Jika target component belum dibuat, existence bukan requirement. Jika current `--target` menunjuk design artifact, resolve dari `.sliceui/artifacts`, bukan repository-wide glob.

Jangan mempertahankan repository target lookup hanya demi compatibility jika secara semantik target belum ada. Namun setiap perubahan semantics harus dibuktikan dan diuji.

## 12. Referee Modes dan CLI Contract

Pertahankan current command:

```bash
sliceui referee --target <name>
```

Tambahkan explicit optional flag:

```bash
sliceui referee --target <name> --deep
```

Jika parser CLI memiliki convention berbeda, ikuti convention tersebut.

Optional reporting:

```bash
sliceui referee --target <name> --profile
sliceui referee --target <name> --deep --profile
```

Jangan mengubah positional/flag existing secara breaking.

Output default harus menyatakan mode:

```text
Referee mode          : snapshot
Codebase scan         : skipped
Stored verdict        : fresh
Project source reads  : 0
```

Deep output:

```text
Referee mode          : deep
Codebase scan         : enabled
Files inspected       : ...
Stored verdict        : updated/not updated
```

## 13. Missing, Stale, Invalid, and Failed Verdicts

### Missing verdict

```text
referee-verdict.json absent
```

Expected:

- non-green;
- non-zero exit;
- no silent deep scan;
- diagnostic menyarankan init atau explicit deep.

### Stale verdict

Fingerprint mismatch.

Expected:

- non-green;
- non-zero;
- diagnostic menunjukkan mismatch category;
- no auto-rescan.

### Malformed verdict

Invalid JSON/schema.

Expected:

- invalid/non-green;
- no fallback green;
- no auto-rescan;
- diagnostic jelas.

### Stored failed verdict

Deep validation sebelumnya menemukan defect.

Expected:

- hot referee surfaces stored findings summary;
- remains non-green;
- tidak mengubah failed menjadi stale/pass secara diam-diam.

### Fresh pass verdict

Expected:

- hot codebase-evidence check pass;
- target/design checks tetap dijalankan;
- exit sesuai combined results.

## 14. Duplicate Selector Semantics

Current deep referee mendeteksi duplicate selectors melalui full scan.

Setelah split:

```text
deep/cold path
→ calculate duplicate selector findings
→ store summarized findings

hot path
→ read stored findings
→ fail if stored verdict contains blocking duplicates
```

Stored evidence harus cukup untuk diagnostic, misalnya selector dan bounded file references, tanpa menyimpan source bodies.

Pastikan:

- duplicate findings tidak hilang;
- failed verdict tidak dianggap fresh pass;
- project changes membuat verdict stale;
- deep mode masih mereproduksi current findings.

## 15. Convention Provenance Semantics

Current deep scan memeriksa apakah claims conventions dapat ditelusuri ke project source.

Stored verdict harus menyimpan summary:

```text
claim identifier
claim type
status found/missing/conflict
bounded evidence reference
severity
```

Jangan menyimpan full CSS/HTML content jika selector/path/hash cukup.

Hot referee tidak perlu mengulang source lookup. Ia memercayai verdict hanya jika fingerprint fresh.

## 16. No Pass-by-Absence

Pertahankan pelajaran dari VER-001 PR 2.

Hot referee tidak boleh pass jika:

- verdict absent;
- verdict null;
- verdict malformed;
- verdict stale;
- fingerprint unknown;
- validation incomplete;
- deep scan aborted;
- required snapshot ground truth absent.

Gunakan explicit state, bukan truthy empty object.

Contoh state:

```text
fresh-pass
fresh-fail
missing
stale
invalid
incomplete
```

Nama aktual mengikuti codebase.

## 17. Backward Compatibility

Existing `.sliceui` snapshots tidak memiliki referee verdict.

Policy:

```text
old snapshot + hot referee
→ NOT VERIFIABLE / missing verdict
→ non-zero
→ suggest explicit init or --deep
→ no silent scan
```

Jangan mempertahankan old behavior full scan secara default, karena itu menggagalkan tujuan PR 3.

Compatibility berarti command memberi migration path yang jelas, bukan secara diam-diam melakukan behavior mahal lama.

Skill harus diperbarui agar agent:

- tidak menjalankan deep mode secara default;
- menjalankan regular referee;
- jika missing/stale, melaporkan dan meminta explicit init/deep workflow sesuai instruction;
- tidak menganggap non-green sebagai izin generate.

## 18. Tests Wajib

Gunakan fixtures kecil, jangan scan project nyata dalam unit tests.

### 18.1 Verdict serialization

- schema/version valid;
- no source bodies;
- deterministic normalized output;
- pass/fail findings preserved.

### 18.2 Init writes verdict

Given project fixture:

- init/detect workflow produces verdict according to selected ownership policy;
- verdict fingerprint binds to new snapshot;
- no duplicate/unexpected scan.

### 18.3 Hot fresh pass

Given fresh pass verdict:

- `referee --target` exits according to target/design checks;
- no project source reads;
- no full glob;
- output says snapshot mode.

### 18.4 Hot fresh failed verdict

- stored findings surfaced;
- exit non-zero;
- no live scan.

### 18.5 Missing verdict

- non-zero;
- clear diagnostic;
- no live scan.

### 18.6 Stale verdict

- fingerprint mismatch detected;
- non-zero;
- no live scan;
- remediation shown.

### 18.7 Malformed/invalid verdict

- non-zero;
- no pass-by-absence;
- no scan.

### 18.8 Incomplete verdict

- non-zero;
- explicit status.

### 18.9 Deep mode parity

Given fixture with known convention corruption or duplicate selector:

- deep mode finds same class of defect as legacy referee;
- exit semantics preserved;
- evidence stored/reported correctly.

### 18.10 Deep pass

- scans project fixture;
- generates fresh verdict according to policy;
- subsequent hot run does zero source reads and uses verdict.

### 18.11 Source change staleness

Modify fingerprint anchor in temporary fixture:

- hot verdict becomes stale;
- no auto deep scan.

### 18.12 Snapshot change staleness

Change conventions/project-context bounded file:

- snapshot fingerprint mismatch;
- non-zero.

### 18.13 No repository scan assertion

Use instrumentation robust enough to prove hot path:

```text
project-source reads = 0
recursive project traversal = 0
full-tree glob count = 0
```

If current `fs-trace` is insufficient, test by injecting filesystem/glob dependency or using a test-only read shim. Do not redesign production tracing under this PR.

### 18.14 CLI flag contract

- existing flags still parse;
- `--deep` works;
- unknown flag behavior unchanged;
- help text updated.

### 18.15 PR 1 and PR 2 non-regression

- agent context tests pass;
- snapshot tests pass;
- missing ground truth verify remains non-green;
- no canonical ownership regression.

## 19. Validation Commands

Before changes:

```bash
git status --short
git rev-parse HEAD
node --version
npm --version
```

Run syntax checks for every changed source file.

Focused tests:

```bash
node --test test/referee.test.mjs
node --test test/init.test.mjs
node --test test/detect.test.mjs
node --test test/snapshot.test.mjs
node --test test/verify.test.mjs
```

Relevant combined suite:

```bash
node --test \
  test/referee.test.mjs \
  test/init.test.mjs \
  test/detect.test.mjs \
  test/detect-context-files.test.mjs \
  test/snapshot.test.mjs \
  test/verify.test.mjs \
  test/verify-root.test.mjs \
  test/resolve.test.mjs \
  test/spec.test.mjs \
  test/agent-context.test.mjs \
  test/timing.test.mjs \
  test/fs-trace.test.mjs
```

Full suite:

```bash
npm test
```

## 20. Temporary End-to-End Validation

Use:

```bash
TMP_ROOT="/tmp/sliceui-pr3-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Use repository entrypoint explicitly:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs ...
```

Do not use global/on-PATH `sliceui`.

E2E scenarios:

### Scenario A: old snapshot

- no verdict;
- hot referee non-zero;
- no source scan.

### Scenario B: explicit deep

- scan temporary project;
- produce findings/verdict according to policy;
- record inspected count.

### Scenario C: subsequent hot

- use fresh stored verdict;
- source reads zero;
- result equivalent to stored deep result plus target checks.

### Scenario D: source/snapshot change

- fingerprint mismatch;
- stale status;
- no auto scan.

### Scenario E: failed deep verdict

- hot remains fail.

Do not run writer commands against real target project.

## 21. Performance Measurement

Measure before and after on a copied/temporary target fixture where practical.

Report:

```text
legacy referee source reads
legacy referee unique files
legacy referee bytes
legacy referee elapsed
new hot referee source reads
new hot referee unique files
new hot referee bytes
new hot referee elapsed
new deep referee source reads
new deep referee elapsed
stored verdict bytes
```

Do not claim model-token savings from file bytes. This PR targets filesystem/time determinism.

Acceptance target:

```text
hot referee project-source reads = 0
hot referee repository-wide traversal = 0
deep mode retains live validation
```

## 22. Timing and Runs Log

If current run logging can accept optional metadata without schema break, record:

```text
refereeMode: snapshot|deep
verdictStatus: fresh|stale|missing|invalid|failed
codebaseScan: true|false
```

Do not redesign timing. If adding fields risks scope expansion, report via stdout/profile only and defer run-log enhancement.

## 23. Skill Update

Update `skill/SKILL.md` minimally:

Default workflow:

```text
sliceui referee --target <name>
```

If result says missing/stale:

- do not generate;
- do not silently run deep;
- use documented explicit setup/deep command;
- report why validation is unavailable.

Do not instruct agent to search repository manually.

Keep deep mode opt-in.

## 24. Documentation

Update owning active docs only, likely:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
README.md or SLICEUI-OVERVIEW.md only if they explicitly describe old referee behavior
```

Document once:

- cold and hot referee responsibilities;
- verdict artifact ownership;
- fingerprint/freshness behavior;
- missing/stale/invalid behavior;
- `--deep` semantics;
- no hidden scan invariant;
- migration for old snapshots.

Do not edit archive docs.

## 25. Acceptance Criteria

PR 3 is complete only if:

- [ ] Entry gate authorizes PR 3.
- [ ] Legacy referee checks are classified.
- [ ] Codebase evidence scan moved to cold/deep path.
- [ ] Stored verdict exists and is versioned.
- [ ] Verdict is bound to project/snapshot fingerprint.
- [ ] Hot `referee --target` performs zero project-source reads.
- [ ] Hot path performs zero repository-wide traversal.
- [ ] Missing verdict is non-green.
- [ ] Stale verdict is non-green.
- [ ] Invalid verdict is non-green.
- [ ] Failed verdict remains fail.
- [ ] No silent deep scan.
- [ ] `--deep` is explicit and documented.
- [ ] Deep mode preserves duplicate-selector and convention-provenance detection.
- [ ] Old snapshots receive clear migration diagnostic.
- [ ] PR 2 missing-ground-truth regression remains fixed.
- [ ] PR 1 agent context remains unchanged.
- [ ] CLI existing arguments remain compatible.
- [ ] Focused tests pass.
- [ ] Relevant suite passes.
- [ ] Full suite passes except pre-existing skips.
- [ ] Performance/read reduction measured.
- [ ] Documentation synchronized.
- [ ] No deferred-work leakage.

## 26. Safety and Git Rules

Never run:

```text
git reset --hard
git clean -fd
git checkout -- .
git restore .
npm update
auto-format whole repository
```

Do not delete user prompt/report files. Do not commit unless explicitly requested.

The working tree contains uncommitted PR 1 and PR 2 work. Preserve it.

Before and after implementation:

- record `git status --short`;
- hash changed source files if practical;
- verify no accidental `.sliceui` in SliceUI repository;
- verify real target project status unchanged.

## 27. Work Sequence

### Phase 1: Gate and baseline

- read reports;
- confirm authorization;
- run baseline tests;
- reproduce legacy referee read path on temporary/copy fixture.

### Phase 2: Classify checks

- separate codebase-wide evidence from target/design checks;
- define verdict contents and authority.

### Phase 3: Design note

Before coding, provide a short implementation note:

- files to change;
- verdict location/schema;
- fingerprint strategy;
- cold writer policy;
- hot reader behavior;
- deep behavior;
- backward compatibility;
- tests.

Do not ask confirmation if within scope.

### Phase 4: Implement verdict model

- serializer/parser;
- explicit states;
- no source bodies.

### Phase 5: Integrate cold path

- init/deep writer;
- avoid added redundant scans.

### Phase 6: Integrate hot path

- stored verdict;
- freshness;
- no scan;
- missing/stale non-green.

### Phase 7: CLI and skill

- `--deep`;
- mode reporting;
- help and workflow instructions.

### Phase 8: Tests

- unit;
- scenario matrix;
- no-read proof;
- compatibility.

### Phase 9: E2E and measurements

- old snapshot;
- deep;
- hot;
- stale;
- failed verdict.

### Phase 10: Documentation and final review

- owning docs;
- diff scope;
- no PR 4/5/6 leakage.

## 28. Required Final Response

### Entry Gate

```text
PR 2 final decision:
PR 3 authorized:
Evidence:
```

### Summary

Explain cold/hot separation.

### Files Changed

Group source, tests, skill, documentation, and pre-existing files.

### Referee Architecture After PR 3

```text
init:
detect:
hot referee:
deep referee:
verdict artifact:
fingerprint:
```

### CLI Contract

Show default and deep commands and their side effects.

### Verdict State Matrix

```text
fresh-pass:
fresh-fail:
missing:
stale:
invalid:
incomplete:
```

### Read-Path Results

```text
Before hot source reads:
After hot source reads:
Before bytes:
After bytes:
Before elapsed:
After elapsed:
Deep source reads:
Verdict size:
```

### Semantic Parity

Report duplicate-selector and convention-provenance parity.

### Validation

List exact commands and pass/fail/skip.

### Backward Compatibility

Explain old snapshot behavior and migration.

### Known Limitations

Only factual limitations.

### Deferred Findings

Do not implement:

```text
CNF-001 conventions-body conflict
verify PascalCase normalization
fs-trace redesign
resolve provenance/confidence
visual verification
incremental refresh/cache
```

### Documentation Sync

Use `Documentation sync: clear.` or list stale docs.

### Git Status

Include `git status --short`. Do not commit.

## 29. Focused Verification Decision

At the end, state:

```text
PR 3 implementation: PASS / FAIL
Hot referee source reads = 0: YES / NO
Deep referee parity preserved: YES / NO
No pass-by-absence: YES / NO
PR 3 ready for independent verification: YES / NO
```

Do not claim PR 3 fully closed until an independent verification task is completed.

## 30. Definition of Done

Task is done only when the default referee no longer scans project source, deep validation remains available explicitly, verdict freshness is enforceable, missing/stale/invalid states are non-green, no pass-by-absence exists, tests and full suite pass, read-path improvement is measured, documentation is synchronized, and the implementation is ready for an independent PR 3 verification.

Start by reading the reports and reproducing the current referee full-scan behavior on a temporary or copied fixture. Do not modify source before the entry gate and check classification are complete.
