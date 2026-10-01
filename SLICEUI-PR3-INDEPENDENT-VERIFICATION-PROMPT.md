# SliceUI PR 3 Independent Verification Plan

Repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Project target nyata yang hanya boleh digunakan sebagai sumber bukti read-only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Dokumen yang wajib dibaca sebelum verifikasi:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
docs/project-docs/development/api-contract.md
SLICEUI-PR3-REFEREE-COLD-HOT-SEPARATION-PROMPT.md
```

Jika file berada di lokasi berbeda, temukan berdasarkan nama. Jangan mengubah prompt, audit, atau verification report sebelumnya.

## 1. Tujuan

Lakukan independent verification terhadap implementasi PR 3 Referee Cold/Hot Separation.

Verifikasi harus membuktikan atau membantah bahwa:

1. Default `sliceui referee --target <name>` tidak lagi membaca project source.
2. Default hot path tidak melakukan recursive walk atau repository-wide glob.
3. Full codebase evidence scan hanya berjalan saat init/cold path atau explicit `--deep`.
4. Stored verdict memiliki schema yang valid, ringkas, dan tidak menyimpan source bodies.
5. Stored verdict terikat pada fingerprint project dan snapshot.
6. Fresh verdict dipakai secara benar.
7. Missing, stale, invalid, incomplete, dan failed verdict tidak pernah green karena absence.
8. `--deep` mempertahankan duplicate-selector dan convention-provenance detection dari behavior lama.
9. Deep mode menulis verdict secara aman dan deterministik.
10. Old snapshot tanpa verdict mendapat migration diagnostic yang jelas tanpa silent scan.
11. Bounded target/design checks tetap berjalan dan tidak kehilangan validasi penting.
12. PR 1 agent-context behavior dan PR 2 snapshot/ground-truth safety tidak regress.
13. Dokumentasi dan skill sesuai behavior aktual.
14. PR 3 dapat ditutup sebelum PR 4 dimulai.

Verifikasi ini bersifat read-only terhadap implementation source.

## 2. Batas Scope dan Safety

Lakukan inspeksi, pengujian, instrumentasi read-only, temporary E2E, pengukuran, dan tulis laporan.

Jangan:

- memperbaiki source code;
- mengubah tests;
- mengubah skill atau dokumentasi existing;
- melakukan refactor;
- melanjutkan PR 4;
- memperbaiki PascalCase verify;
- merancang ulang fs-trace;
- memperbaiki conventions-body conflict;
- menambah source fingerprint baru;
- mengubah verdict update policy;
- mengubah severity finding;
- melakukan commit;
- menjalankan formatter write mode;
- menghapus file user;
- menjalankan writer command pada project target nyata;
- memakai global/on-PATH `sliceui`;
- menyatakan PASS hanya karena test suite lulus.

Satu-satunya file baru yang boleh dibuat di repository:

```text
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
```

Semua fixture, logs, generated verdicts, source copies, dan screenshots harus berada di:

```text
/tmp/sliceui-pr3-verification-<timestamp>/
```

## 3. Implementation Claims yang Harus Diverifikasi

PR 3 mengklaim:

```text
init:
  full detection + codebase evidence scan
  writes .sliceui/referee-verdict.json

hot referee:
  reads stored verdict
  performs bounded target/design checks
  zero project-source reads

referee --deep:
  performs live repository scan
  writes or refreshes verdict

fingerprints:
  projectFingerprint = existing inputHash
  snapshotFingerprint = sha256(project-context.json + conventions.json)
```

Reported results:

```text
Before hot source reads : 539
After hot source reads  : 0
After hot readdir/glob  : 0
Deep fixture reads      : 5 files
Verdict size            : about 1 KB
Full tests              : 397 pass / 3 pre-existing skips / 0 fail
```

Known limitation:

```text
projectFingerprint does not detect uncommitted source changes.
```

Jangan menerima klaim ini tanpa reproduksi.

## 4. Keputusan yang Wajib Dihasilkan

Laporan akhir harus menjawab:

```text
Can PR 3 be closed? YES / NO / CONDITIONAL
Can PR 4 start? YES / NO
Hot referee source reads = 0? YES / NO
Hot repository traversal = 0? YES / NO
Deep parity preserved? YES / NO / PARTIAL
No pass-by-absence? YES / NO
Verdict writing atomic and safe? YES / NO / UNKNOWN
Fingerprint freshness trustworthy? YES / NO / CONDITIONAL
PR 1 and PR 2 non-regression preserved? YES / NO
```

## 5. Tahap 0: Baseline dan Safety

Dari root repository:

```bash
git status --short
git rev-parse HEAD
node --version
npm --version
```

Kelompokkan working-tree changes:

```text
PR 1
PR 2 and corrective patch
PR 3
prompt/report files
unknown
```

Buat temporary root:

```bash
TMP_ROOT="/tmp/sliceui-pr3-verification-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Simpan source hashes awal minimal:

```bash
shasum -a 256 \
  src/lib/referee-verdict.mjs \
  src/lib/referee.mjs \
  src/commands/referee.mjs \
  src/commands/init.mjs \
  src/cli.mjs \
  skill/SKILL.md \
  test/referee-verdict.test.mjs
```

Tambahkan file PR 3 aktual yang ditemukan.

Catat status target project nyata:

```bash
cd /Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
git status --short
```

Target project dan `.sliceui` nyata tidak boleh berubah.

## 6. Tahap 1: Static Architecture Review

Audit minimal:

```text
src/lib/referee-verdict.mjs
src/lib/referee.mjs
src/commands/referee.mjs
src/commands/init.mjs
src/commands/detect.mjs
src/cli.mjs
src/lib/snapshot.mjs
src/lib/fs-trace.mjs
src/lib/timing.mjs
skill/SKILL.md
test/referee-verdict.test.mjs
test/referee.test.mjs
test/init.test.mjs
```

Gunakan:

```bash
rg -n "refereeHot|refereeArtifacts|codebaseEvidenceFindings|liveRefereeFindings|referee-verdict|projectFingerprint|snapshotFingerprint|--deep|findDuplicateSelectors|locateTargetTs|fg\.sync|fast-glob|readFileSync|writeFile|rename|temporary|inputHash" src test skill docs README.md
```

Buat call graph aktual:

```text
init → verdict generation → verdict write
hot command → verdict load → assess → bounded checks
--deep command → live scan → findings → verdict write
```

Untuk setiap call, tandai filesystem scope:

```text
.sliceui bounded read
project-source read
recursive traversal
full-tree glob
bounded target path
write
child process
```

## 7. Tahap 2: Check Classification Parity

Buat daftar semua checks legacy referee sebelum PR 3 dan mapping setelah PR 3.

Minimal kategorikan:

```text
duplicate selector detection
wellAvailable claim validation
ngDeep/corpus evidence validation
convention source/provenance checks
target component lookup
design/transcript fidelity
artifact consistency
snapshot freshness
framework/project checks
```

Untuk setiap check, tulis:

```text
legacy location
new location: cold/deep/hot/stored
input source
blocking or non-blocking
stored evidence fields
exit effect
parity status
```

Cari checks yang hilang, severity berubah, atau hanya ditampilkan tanpa memengaruhi result.

## 8. Tahap 3: Verdict Schema Review

Audit `.sliceui/referee-verdict.json` schema dari source dan generated fixture.

Periksa:

- schemaVersion;
- generatedAt;
- mode;
- project fingerprint;
- snapshot fingerprint;
- status;
- findings;
- evidence summary;
- tool version;
- completion marker bila ada;
- source-body leakage;
- absolute path leakage;
- secrets;
- deterministic ordering;
- unknown-field handling;
- unknown future schema handling.

Required verdict states harus dapat direpresentasikan atau di-assess sebagai:

```text
fresh-pass
fresh-fail
missing
stale
invalid
incomplete
```

Jika state tidak disimpan langsung tetapi dihitung, dokumentasikan decision path.

## 9. Tahap 4: Test Quality Review

Audit tests PR 3. Pastikan tests benar-benar membuktikan:

1. Verdict serialization.
2. Fresh-pass assessment.
3. Fresh-fail assessment.
4. Missing verdict non-green.
5. Stale fingerprint non-green.
6. Invalid/malformed non-green.
7. Incomplete verdict non-green.
8. Hot path tidak memanggil live scan.
9. Hot path tidak melakukan repository glob.
10. Deep path menemukan duplicate selector.
11. Deep path menemukan convention evidence mismatch.
12. Deep-to-hot result parity.
13. Source/snapshot change staleness.
14. Failed deep verdict disimpan sebagai fail.
15. Verdict writing failure tidak meninggalkan valid-looking partial verdict.
16. Old snapshot migration behavior.
17. PR 2 no-ground-truth verify remains non-green.

Cari false confidence:

- unit tests stubbing away actual filesystem behavior;
- no-read assertion yang hanya memeriksa exported function tetapi bukan CLI command;
- freshness test hanya snapshot hash, tidak project anchor;
- deep parity hanya membandingkan count, bukan finding detail;
- failed verdict test tidak memeriksa exit code;
- atomicity tidak diuji;
- `fresh-fail` test mengizinkan status pass tanpa label jelas.

## 10. Tahap 5: Re-run Tests

Focused:

```bash
node --test test/referee-verdict.test.mjs
node --test test/referee.test.mjs
node --test test/init.test.mjs
node --test test/detect.test.mjs
node --test test/snapshot.test.mjs
node --test test/verify.test.mjs
```

Relevant combined:

```bash
node --test \
  test/referee-verdict.test.mjs \
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

Syntax checks untuk seluruh changed source PR 3.

Catat exact pass/fail/skip, duration, warning, dan environment dependencies.

Jangan memperbaiki kegagalan.

## 11. Tahap 6: E2E Fixture Design

Buat temporary project fixture yang cukup representatif, minimal memiliki:

```text
package.json
project config minimum
.sliceui canonical snapshot
multiple component.ts files
duplicate selectors
HTML evidence
SCSS/CSS convention evidence
one missing convention claim
one valid convention claim
design XML/transcript artifact
target name containing normal case
optional path containing spaces
```

Gunakan copy fixture existing bila cukup. Jangan memakai project target nyata untuk writer/deep execution.

Pastikan fixture dapat menguji lebih dari 5 files dan 4 selectors bila practical. Targetkan minimal:

```text
10+ project source files
at least 2 duplicate-selector groups
at least 2 convention evidence claims
at least 1 missing claim
```

Jika tidak practical, jelaskan limitation.

## 12. Tahap 7: Baseline Legacy Behavior

Jika behavior legacy masih dapat dipanggil melalui lower-level function tanpa mengubah source, jalankan pada temporary fixture.

Capture:

```text
finding IDs
severity
message/detail
exit outcome
files read
bytes read
elapsed
```

Jika tidak dapat menjalankan legacy path, gunakan report audit dan deep result sebagai reference, lalu tandai limitation.

## 13. Tahap 8: Deep Mode Verification

Jalankan dengan repository CLI eksplisit:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs referee --target <name> --deep
```

Periksa:

- live scan benar-benar terjadi;
- only deep mode scans;
- findings lengkap;
- duplicate selectors ditemukan;
- convention evidence mismatch ditemukan;
- exact details sebanding dengan legacy;
- exit code sesuai blocking status;
- verdict ditulis sesuai policy;
- verdict status sesuai findings;
- failed deep tidak ditulis sebagai pass;
- output menyatakan mode deep;
- verdict tidak berisi source bodies.

Capture file-read metrics dengan read-only shim atau instrumentation.

## 14. Tahap 9: Hot Mode Zero-Read Proof

Setelah deep menghasilkan verdict, jalankan:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs referee --target <name>
```

Buktikan secara dinamis:

```text
project-source reads = 0
project-source unique files = 0
repository-wide globs = 0
recursive project traversal = 0
readdir project source = 0
child-process source scan = 0
```

Baca `.sliceui` boleh dilakukan dan harus dilaporkan terpisah.

Jangan hanya mengandalkan current `fs-trace` jika tidak meng-cover call sites. Gunakan read-only `node:fs` shim atau controlled dependency injection di temporary execution tanpa mengubah source.

Periksa output:

```text
mode = snapshot
codebase scan = skipped
stored verdict status shown
combined result correct
```

## 15. Tahap 10: Verdict State Matrix

Uji seluruh state berikut pada isolated copies.

### Fresh pass

- valid current fingerprints;
- pass findings;
- hot bounded checks run;
- no scan;
- result green only jika semua blocking checks pass.

### Fresh fail

Gunakan stored blocking finding dan stored non-blocking finding secara terpisah.

Periksa:

- blocking finding → non-zero;
- non-blocking finding → output tidak menyesatkan;
- status tidak menyebut clean pass jika verdict status secara literal adalah fail;
- severity classification konsisten dengan legacy.

### Missing

- verdict absent;
- non-zero;
- NOT VERIFIABLE/migration diagnostic;
- no scan.

### Stale snapshot fingerprint

- modify copied `conventions.json` or `project-context.json`;
- non-zero;
- mismatch diagnostic;
- no scan.

### Stale project fingerprint

- modify bounded project fingerprint anchor;
- non-zero jika detectable;
- no scan.

### Invalid JSON

- malformed verdict;
- non-zero;
- no scan;
- no crash stack-only output.

### Unknown schema

- future schema version;
- safe non-green;
- no scan.

### Incomplete

Remove required fields/completion evidence.

- non-zero;
- no pass-by-absence.

### Stored failed verdict

- findings surfaced with detail;
- not converted to pass by bounded target checks.

## 16. Tahap 11: Uncommitted Source Change Experiment

Known limitation menyatakan project fingerprint tidak melihat uncommitted source changes.

Reproduce pada temporary Git repository:

1. Run deep and create fresh verdict.
2. Modify an HTML/SCSS/component.ts source file without commit.
3. Run hot referee.
4. Observe verdict freshness.

Record:

```text
change detected: yes/no
hot result: fresh/stale/unknown
scan occurred: yes/no
user warning present: yes/no
risk: low/medium/high/blocking
```

Decision guidance:

- Jika hot mengklaim definitively fresh tanpa warning setelah relevant uncommitted source change, evaluate as potentially material.
- Jangan memperbaiki.
- Tentukan apakah PR 3 dapat conditional-pass dengan documented limitation atau harus fail.

Pertimbangkan actual user workflow: SliceUI berjalan saat source changes sering belum committed.

## 17. Tahap 12: Snapshot Fingerprint Verification

Modify temporary copies independently:

```text
conventions.json
project-context.json
unrelated runs.jsonl
unrelated design artifact
```

Expected:

- canonical snapshot files relevant to verdict → stale;
- unrelated telemetry should not stale unless intentionally included;
- fingerprint deterministic;
- hash ordering stable;
- path/temp-root differences do not create false stale if contents equal.

## 18. Tahap 13: Atomic Verdict Writing

Audit write implementation.

Check whether verdict is written:

```text
directly to final path
```

or:

```text
temporary sibling file → fsync/close if used → rename final
```

Test or simulate failure where practical:

- serialization failure;
- interrupted/truncated write;
- permission error;
- deep scan throws before completion;
- process exits before finalization.

Required safety:

- old valid verdict should not become partial valid JSON;
- partial verdict must be invalid/non-green;
- incomplete deep validation must not write fresh-pass;
- failed scan must not preserve misleading current timestamp/status.

If atomic writing is absent, classify risk and determine closure impact. Do not implement fix.

## 19. Tahap 14: Deep Verdict Update Policy

Verify documented behavior:

```text
--deep writes verdict by default
```

Test:

### Deep pass

- writes fresh-pass only after complete validation.

### Deep fail

- writes fresh-fail, not stale old pass.

### Deep incomplete/crash

- does not write fresh-pass;
- old verdict treatment is safe and visible.

### Repeated deep

- deterministic findings;
- generatedAt may change;
- fingerprints stable for unchanged inputs;
- no accumulation or duplicate findings.

## 20. Tahap 15: Bounded Target and Design Checks

Inspect and dynamically test target lookup.

Verify:

- no full-tree glob;
- no recursive source search;
- target resolves from artifacts/snapshot or bounded path;
- missing target has clear result;
- target existing/non-existing semantics appropriate for pre-generation stage;
- path with spaces works;
- arbitrary target cannot escape project root;
- no path traversal;
- artifact name normalization is deterministic;
- transcript/XML matching remains intact;
- fidelity checks still run.

Do not mix the deferred PascalCase verify bug unless referee itself has a directly relevant normalization regression.

## 21. Tahap 16: Severity and Exit Semantics

Build a matrix of every stored finding type:

```text
finding ID
legacy severity
new severity
stored verdict status
hot exit code
deep exit code
blocking yes/no
message parity
```

Pay special attention to reported behavior:

```text
fresh-fail can exit 0 if only non-blocking reds
```

Determine whether:

- verdict status `fail` is semantically appropriate for warnings;
- output clearly distinguishes blocking fail from non-blocking warning;
- duplicate selector findings have correct severity;
- convention provenance missing has correct severity;
- green wording is not misleading;
- automation can understand final state.

A non-blocking warning may exit 0, but it must not look like a clean pass if stored status says fail.

## 22. Tahap 17: Old Snapshot Migration

Use copy of old snapshot with no verdict.

Expected:

```text
non-zero
missing-verdict diagnostic
explicit init or --deep remediation
no automatic scan
no artifact mutation
```

Check skill instructions align with this behavior and do not cause an infinite retry or automatic deep scan.

## 23. Tahap 18: PR 1 and PR 2 Non-Regression

Verify:

### PR 1

- `agent-context.md` generation unchanged;
- context budget/metrics unchanged;
- skill reading order still compact;
- no instruction to read full conventions JSON.

### PR 2

- project-context remains deduped;
- conventions canonical ownership intact;
- missing conventions returns null;
- verify empty ground truth remains non-green;
- legacy snapshots remain readable;
- no snapshot conflict behavior changed unexpectedly.

Run direct empty-ground-truth verify regression again.

## 24. Tahap 19: Documentation and Skill Review

Audit:

```text
skill/SKILL.md
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
README.md
docs/SLICEUI-OVERVIEW.md
```

Verify:

- default referee is snapshot mode;
- deep is explicit;
- verdict location documented;
- missing/stale/invalid are non-green;
- migration for old snapshot clear;
- deep write side effect documented;
- fingerprint limitation documented accurately;
- no docs claim full scan default;
- agent is not instructed to search repository manually;
- no contradictory command syntax.

Do not modify docs. Report stale statements.

## 25. Tahap 20: Performance Measurement

Measure on controlled fixture, and if safe, on a copied realistic fixture.

Capture:

```text
legacy/deep source reads
legacy/deep unique files
legacy/deep bytes
legacy/deep elapsed
hot .sliceui reads
hot project-source reads
hot unique project-source files
hot bytes
hot elapsed
hot glob/readdir counts
verdict size
```

Repeat hot run multiple times if practical and report median, not only one sample.

Do not translate filesystem bytes into model-token savings.

## 26. Tahap 21: Diff and Scope Audit

Review all PR 3 hunks against baseline.

Classify:

```text
required PR 3
required tests
required skill/docs
pre-existing PR 1/PR 2
unrelated
scope leakage
```

Check:

- no hidden PR 4 work;
- no fs-trace redesign;
- no PascalCase fix;
- no generated code changes;
- no new dependency;
- no command breaking change;
- no accidental formatting;
- no real target mutation.

## 27. Pass/Fail Criteria

PR 3 is `PASS` only if:

- hot CLI path dynamically proves zero project-source reads;
- hot path dynamically proves zero repository traversal;
- deep mode preserves legacy material findings;
- missing/stale/invalid/incomplete are non-green;
- blocking fresh-fail exits non-zero;
- non-blocking warnings are not presented as a clean pass;
- no pass-by-absence;
- old snapshots migrate explicitly without scan;
- target/design checks remain present;
- verdict write is safe enough not to create misleading fresh-pass;
- fingerprint behavior is accurately documented;
- PR 1 and PR 2 regressions absent;
- tests and full suite pass;
- docs match actual behavior;
- source/target unchanged during verification.

PR 3 may be `CONDITIONAL PASS` if:

- all core cold/hot and gate guarantees pass;
- one known limitation remains, such as uncommitted changes not detected;
- limitation is explicit, does not create pass-by-absence, and has safe user guidance;
- no blocking correctness defect exists.

PR 3 is `FAIL` if:

- any hot source read/traversal occurs;
- silent deep fallback occurs;
- missing/stale/invalid can exit 0 as trusted;
- blocking stored finding can be green;
- deep misses material legacy checks;
- failed/incomplete deep writes fresh-pass;
- partial verdict can be trusted;
- target validation materially disappears;
- PR 2 ground-truth false green returns;
- project target is modified;
- documentation hides material limitation.

## 28. Finding Format

Severity:

```text
Critical
High
Medium
Low
Informational
```

IDs:

```text
RDP read path
VRD verdict model
FPR fingerprint/freshness
DPM deep parity
ATM atomicity
EXT exit semantics
TGT target/design checks
BWC backward compatibility
REG non-regression
DOC documentation
PER performance
SCP scope
TST test quality
```

Each material finding:

```text
Finding ID
Severity
Status: Confirmed / Strong evidence / Suspected / Not found / Unable to verify
Evidence with path/symbol/line/command/output
Impact
Required correction
Blocks PR 3 closure: yes/no
```

## 29. Output Report

Create only:

```text
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
```

Required structure:

```markdown
# SliceUI PR 3 Verification Report

## 1. Executive Decision

## 2. Scope and Environment

## 3. Git and Safety Baseline

## 4. Architecture Review

## 5. Legacy-to-New Check Mapping

## 6. Verdict Schema Assessment

## 7. Test Quality Review

## 8. Tests Re-run

## 9. E2E Fixture

## 10. Deep Mode Assessment

## 11. Hot Zero-Read Assessment

## 12. Verdict State Matrix

## 13. Fingerprint and Freshness Assessment

## 14. Uncommitted Source Change Experiment

## 15. Atomic Writing Assessment

## 16. Deep Update Policy Assessment

## 17. Target and Design Check Assessment

## 18. Severity and Exit Semantics

## 19. Old Snapshot Migration

## 20. PR 1 and PR 2 Non-Regression

## 21. Documentation and Skill Assessment

## 22. Performance Measurements

## 23. Diff and Scope Review

## 24. Findings by Severity

## 25. Acceptance Checklist

## 26. Required Corrections Before PR 4

## 27. Deferred Items

## 28. Final Recommendation

## Appendix A: Commands Executed

## Appendix B: Read Trace Raw Results

## Appendix C: Verdict Scenario Raw Results

## Appendix D: Legacy/New Finding Parity

## Appendix E: Hashes and Git Status
```

## 30. End-of-Task Validation

Before finishing:

1. Re-run source hashes and compare start/end.
2. Run `git status --short` in SliceUI.
3. Run `git status --short` in real target project.
4. Confirm no source implementation changed.
5. Confirm only report file was added.
6. Confirm no stray `.sliceui` in SliceUI repository.
7. Confirm all temp artifacts are outside repository.
8. Confirm no secrets or sensitive source bodies in report/verdict samples.
9. Confirm zero-read claim uses dynamic evidence.
10. Confirm PASS is not based only on test count.
11. Do not commit.

## 31. Required Final Response

### Decision

```text
PR 3: PASS / CONDITIONAL PASS / FAIL
PR 4 may start: YES / NO
```

### Core Guarantees

```text
Hot referee source reads = 0:
Hot repository traversal = 0:
Deep parity preserved:
No pass-by-absence:
Atomic verdict safety:
Freshness trustworthy:
PR 1/PR 2 non-regression:
```

### Key Evidence

Summarize read trace, state matrix, deep parity, fingerprints, atomicity, and tests.

### Blocking Findings

List blockers or `None`.

### Non-Blocking Findings

List material limitations.

### Report

```text
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
```

### Validation

List exact principal commands and outcomes.

### Git Status

Show SliceUI and real target statuses.

Do not implement fixes after verification. Wait for the next instruction.

## 32. Final Instruction

Begin with static source review and source hashes, then execute controlled temporary E2E scenarios. Use the real target only for read-only reference. Do not accept implementation claims without reproduction. The verification is complete only when it produces a reliable decision on whether PR 3 may close and PR 4 may begin.
