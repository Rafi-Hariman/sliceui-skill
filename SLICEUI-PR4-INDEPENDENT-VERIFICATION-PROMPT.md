# SliceUI PR 4 Independent Verification Plan

Repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Project target nyata yang hanya boleh digunakan sebagai sumber bukti read-only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Checkpoint baseline resmi:

```text
f67f8bb feat(sliceui): add compact agent context and snapshot referee
```

Dokumen yang wajib dibaca sebelum verifikasi:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
SLICEUI-PR4-RESOLVE-PROVENANCE-SEMANTIC-SAFETY-PROMPT.md
```

Jika salah satu file berada di lokasi berbeda, cari berdasarkan nama. Jangan mengubah prompt atau verification report sebelumnya.

## 1. Tujuan

Lakukan independent verification terhadap implementasi PR 4 Resolve Provenance and Semantic Safety.

Verifikasi harus membuktikan atau membantah bahwa:

1. Setiap resolved decision mempunyai classification yang valid.
2. Setiap decision mempunyai authority yang sesuai dengan sumbernya.
3. Confidence bersifat deterministic dan policy-based.
4. Evidence dan provenance cukup spesifik untuk ditelusuri tanpa repository scan.
5. Semantic hypotheses tidak tampil sebagai literal design facts.
6. Implementation recommendations bersifat non-authoritative.
7. Fallback dan unresolved state terlihat jelas dan tidak disamarkan.
8. Candidate dan rejected alternatives bounded dan deterministic.
9. Verified public API mengalahkan behavioral CSS.
10. Icon metadata mengalahkan inference dari button text atau label.
11. Status/taxonomy mapping tidak menjadi authoritative hanya karena warna atau corpus co-occurrence.
12. Semantic roles tetap hint kecuali explicit metadata tersedia.
13. Modal/card semantics tidak dihasilkan tanpa evidence.
14. `spec.md` membedakan design facts, verified capabilities, dan implementation hints.
15. `agent-context.md` tetap compact serta tidak memperlakukan hint sebagai fakta.
16. Existing schema-1 consumers tetap aman atau mendapat compatibility path yang jelas.
17. Verify dan referee tetap independen dari `resolved.json` dan `spec.md`.
18. Resolve, spec, dan agent-context tidak menambah project-source reads.
19. Artifact growth tetap bounded.
20. PR 1, PR 2, dan PR 3 tidak regress.
21. PR 4 dapat ditutup sebelum PR 5 dimulai.

Verifikasi ini bersifat read-only terhadap implementation source.

## 2. Batas Scope dan Safety

Lakukan inspeksi, tests, instrumentasi read-only, temporary E2E, pengukuran, dan tulis laporan.

Jangan:

- memperbaiki source code;
- mengubah tests atau fixtures;
- mengubah skill atau dokumentasi existing;
- melakukan refactor;
- menjalankan formatter write mode;
- melakukan commit atau push;
- melanjutkan PR 5;
- memperbaiki PascalCase verify;
- menambah unknown Angular input validation;
- menambah wrapper/modal verification rules;
- mengubah FIGML parser;
- menambah componentProperties atau mainComponent support;
- merancang ulang fs-trace;
- mengubah referee fingerprint;
- mengubah verdict atomic writing;
- mengubah generated Angular output;
- memakai repository target nyata untuk writer commands;
- memakai global/on-PATH `sliceui`;
- menyatakan PASS hanya karena test suite lulus.

Satu-satunya file baru yang boleh dibuat di repository:

```text
docs/SLICEUI-PR4-VERIFICATION-REPORT.md
```

Semua fixture, output, logs, source copies, generated artifacts, dan read traces harus disimpan di:

```text
/tmp/sliceui-pr4-verification-<timestamp>/
```

## 3. Implementation Claims yang Harus Diverifikasi

PR 4 mengklaim:

```text
schemaVersion: 2
classification emitted:
- implementation-recommendation
- semantic-hypothesis
- unresolved

authority emitted:
- hint
- fallback

full policy vocabulary:
- authoritative
- verified
- hint
- fallback
- unresolved

confidence tiers:
- 0.95 alias
- 0.85 structural + verified
- 0.70 semantic match
- 0.50 ambiguous
- 0 unresolved/fallback
```

PR 4 juga mengklaim:

```text
- every resolved group has provenance
- public API wins over behavioral CSS
- metadata wins over label-text icon inference
- status taxonomy stays a hint
- modal semantics are not invented
- old selected values remain unchanged on the real fixture
- resolved artifact growth is 2.94x, within a 3x budget
- agent context remains below 30,000 characters
- resolve/spec project-source reads remain zero
- full suite: 424 pass / 3 pre-existing skips / 0 fail
```

Known limitations:

```text
- parser drops componentProperties and mainComponent signals
- icon resolution has no text fallback rung
- label-custom-active remains corpus-derived at confidence 0.70
- cold CLI timing increased by about 40 ms
```

Jangan menerima klaim tersebut tanpa reproduksi.

## 4. Keputusan yang Wajib Dihasilkan

Laporan akhir harus menjawab:

```text
Can PR 4 be closed? YES / NO / CONDITIONAL
Can PR 5 start? YES / NO
Schema v2 complete and coherent? YES / NO
Authority semantics correct? YES / NO / PARTIAL
Confidence deterministic? YES / NO
Provenance sufficiently specific? YES / NO / PARTIAL
Public API precedence enforced? YES / NO
Icon precedence safe? YES / NO / PARTIAL
Ambiguity and fallback paths safe? YES / NO
Legacy compatibility preserved? YES / NO
No repository reads added? YES / NO
PR 1–3 non-regression preserved? YES / NO
```

## 5. Tahap 0: Baseline dan Source Integrity

Dari root repository:

```bash
git status --short
git rev-parse HEAD
git log -1 --oneline
node --version
npm --version
```

Pastikan baseline `f67f8bb` berada pada history. Kelompokkan working-tree changes:

```text
PR 4 source
PR 4 tests
PR 4 skill/docs
known untracked prompt files
unknown/unrelated
```

Buat temporary root:

```bash
TMP_ROOT="/tmp/sliceui-pr4-verification-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Simpan hash awal seluruh file PR 4 aktual, minimal:

```bash
shasum -a 256 \
  src/lib/resolution-policy.mjs \
  src/lib/resolve.mjs \
  src/commands/resolve.mjs \
  src/commands/spec.mjs \
  src/lib/agent-context.mjs \
  test/resolve.test.mjs \
  test/spec.test.mjs \
  test/agent-context.test.mjs \
  skill/SKILL.md
```

Tambahkan file aktual lain yang berubah.

Catat status project target nyata:

```bash
cd /Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
git status --short
```

Target project dan `.sliceui` nyata tidak boleh berubah.

## 6. Tahap 1: Producer and Consumer Audit

Audit minimal:

```text
src/lib/resolution-policy.mjs
src/lib/resolve.mjs
src/commands/resolve.mjs
src/commands/spec.mjs
src/lib/agent-context.mjs
src/lib/transcript-schema.mjs
src/framework/angular/pilar-catalog.mjs
src/framework/angular/uii-profile.mjs
src/framework/angular/uii-slice-policy.mjs
src/lib/library-registry.mjs
src/framework/angular/verify.mjs
src/lib/referee.mjs
skill/SKILL.md
```

Gunakan:

```bash
rg -n "resolution-policy|resolveTranscript|resolved\.json|schemaVersion|classification|authority|confidence|fallbackUsed|provenance|candidates|rejected|behaviorBindings|paginationAlign|paginationALign|NAME_GLYPH|FA_ICON_COLORS|STATUS_LABELS" \
  src test skill docs README.md
```

Klasifikasikan seluruh consumer:

```text
resolved writer
spec consumer
agent-context consumer
verify consumer
referee consumer
test fixture
documentation contract
external/public contract
```

Pastikan dengan source evidence bahwa:

- verify tidak membaca `resolved.json` atau `spec.md`;
- referee tidak menjadikan resolved output ground truth;
- no command melakukan repository scan untuk resolve provenance;
- schema-1 compatibility tidak tersebar secara tidak terkendali.

## 7. Tahap 2: Schema v2 Structural Review

Audit output schema dan serializer.

Periksa:

- schemaVersion;
- stable group/entry IDs;
- nodeId/property traceability;
- classification;
- authority;
- confidence;
- fallbackUsed;
- selected value;
- evidence;
- provenance design/project/mapping;
- candidates;
- rejected alternatives;
- diagnostics;
- behaviorBindings;
- legacy fields preserved;
- deterministic ordering;
- no absolute-path leakage;
- no source-body leakage;
- no full corpus/catalog duplication.

Buat field ownership map:

```text
field
meaning
producer
consumer
required or optional
legacy compatibility
```

## 8. Tahap 3: Classification Coherence

PR 4 reports emitted classifications:

```text
implementation-recommendation
semantic-hypothesis
unresolved
```

Policy vocabulary may also discuss:

```text
literal-design-fact
normalized-design-fact
structural-design-fact
project-capability
project-token
project-utility
approved-style-recipe
conservative-fallback
```

Determine:

1. Which values are valid in code?
2. Which are actually emitted?
3. Which belong only to transcript/evidence and therefore should not be emitted as resolved groups?
4. Do docs accurately distinguish policy vocabulary from emitted values?
5. Can a fallback be classified as `unresolved` while authority is `fallback` without ambiguity?
6. Is every group classification semantically correct?

Do not fail PR 4 merely because not every conceptual category is emitted. Fail or flag only if the contract/documentation overclaims or classification causes ambiguity.

## 9. Tahap 4: Authority Granularity

Audit authority values in actual output.

Critical distinction:

```text
Verified capability fact:
uii-table.paginationAlign exists
→ authority should be verified at the capability/evidence level

Implementation recommendation:
use [paginationAlign]="'right'"
→ authority may remain hint
```

Verify whether the model can represent both layers without collapsing them.

Test:

- exact public API provenance is marked verified somewhere meaningful;
- recommendation is not incorrectly marked authoritative;
- design evidence remains authoritative in transcript/evidence;
- semantic status mapping remains hint;
- fallback remains fallback;
- unresolved remains unresolved.

If every top-level entry is `hint`, determine whether nested project evidence or behavior binding carries `verified`. If not, classify authority granularity as incomplete.

## 10. Tahap 5: Confidence Determinism

Audit confidence policy and test actual outputs.

Verify:

- same input produces same confidence;
- candidate ordering does not affect score;
- exact alias mapping receives expected tier;
- structural + verified capability receives expected tier;
- corpus co-occurrence receives only semantic tier;
- ambiguous color family receives lower tier;
- unresolved/fallback receives zero or documented minimum;
- no unsupported exact/high confidence;
- numeric values match documentation.

Run repeated resolution on identical inputs and deep-compare normalized outputs excluding timestamps.

## 11. Tahap 6: Provenance Specificity

For every representative decision, verify provenance points to a bounded source.

### Design provenance

Expected examples:

```text
transcript nodeId
property name
variant property
glyphName
description
text value
color value
structural relationship
```

### Project provenance

Expected examples:

```text
conventions.json classVocabulary entry
ngDeepCorpus entry/hash
resolution-policy rule
pilar catalog selector/input/version
UII profile mapping
slice policy rule
```

### Mapping provenance

Expected:

```text
rule name
selected candidate
reason
```

Flag vague provenance such as only `source: design` or `source: project` when more detail exists.

Check that provenance can be inspected without repository source reads.

## 12. Tahap 7: Candidate, Rejected, and Budget Semantics

Create fixtures that force:

- one exact candidate;
- multiple candidates;
- more than three candidates;
- public API versus behavioral CSS rejection;
- unknown resolution;
- fallback.

Verify:

```text
candidates <= configured limit
rejected <= configured limit
evidence <= configured limit
stable sort by score and deterministic tie-breaker
truncated count or summary when additional candidates exist
no duplicate candidates
no selected value repeated as rejected
```

Ensure real ambiguity paths are exercised. The real fixture having zero candidates does not prove this behavior.

## 13. Tahap 8: Public API Precedence

Build controlled cases for behavior configuration.

### Table pagination alignment

Evidence:

```text
footer structural relationship indicates right alignment
Pilar catalog contains uii-table.paginationAlign
behavioral CSS candidate exists
```

Expected:

- public API selected;
- exact case-sensitive binding `paginationAlign`;
- CSS candidate rejected;
- rejection reason stored;
- capability evidence marked verified;
- recommendation remains a hint or documented recommendation authority.

### Standalone pagination

If fixture uses `uii-pagination`, verify exact spelling:

```text
paginationALign
```

Do not accept accidental normalization to `paginationAlign`.

### Insufficient layout evidence

Public API availability alone must not invent alignment recommendation.

### No catalog

Recommendation must degrade from verified to hint/fallback and show missing capability evidence.

### Visual internal style exception

Approved visual CSS recipe may remain if no public API controls that visual property. It must not be rejected merely because another behavioral API exists.

## 14. Tahap 9: Icon Precedence Matrix

Build minimal fixtures for each actual supported rung.

Reported actual ladder:

```text
variantProperties
glyphName
instance description
corpus color
color family
unresolved
```

Verify:

### Metadata versus label conflict

Example:

```text
icon metadata = sync
button label suggests search
```

Expected:

- sync wins;
- label text is not used;
- project alias mapping traceable;
- confidence tier correct.

### Glyph name

Exact glyph name maps deterministically.

### Description

Description mapping is lower or equal authority to stronger metadata.

### Corpus color

Color/corpus mapping remains semantic hypothesis, not verified fact.

### Ambiguous color family

Multiple candidates:

- bounded candidates;
- confidence 0.50 or documented ambiguous tier;
- no arbitrary selected icon unless policy explicitly permits.

### Unknown icon

- unresolved;
- no invented icon;
- fallback state visible.

### Text fallback absence

Confirm button text is intentionally not a rung and docs/skill do not imply it is.

### Unsupported conceptual rungs

Confirm componentProperties/mainComponent are not claimed as active support in docs. They may be documented as deferred parser work.

## 15. Tahap 10: Status and Taxonomy Safety

Build cases:

### Strong evidence

```text
status text + design colors + verified project taxonomy source
```

Determine whether implementation has a truly verified taxonomy source. If not, authority must stay hint.

### Corpus co-occurrence

Expected:

```text
confidence <= 0.70
classification implementation-recommendation or semantic-hypothesis
authority hint
```

### Color only

Expected:

- never authoritative;
- never exact/high;
- candidates or unresolved;
- no semantic status invented from color alone.

### Text conflict with color

Expected:

- ambiguity visible;
- confidence reduced;
- no silent selection.

### Unknown status

Expected unresolved or conservative fallback without invented taxonomy.

Reproduce the real `Aktif` case and verify it remains visibly co-occurrence-derived.

## 16. Tahap 11: Semantic Role Safety

Test design relationships for:

```text
table-toolbar
table-search
page-search
bulk-action-toolbar
modal/card semantics
```

Verify:

- semantic role is hint unless explicit metadata exists;
- structural evidence lists parent/child relationship;
- search classification does not become authoritative solely by name;
- modal recommendation is absent when backdrop/dialog/close/modal metadata is absent;
- card wrapper is not invented;
- unresolved roles stay unresolved.

PR 4 need not add verifier rules. This assessment only checks resolver/spec/agent-context behavior.

## 17. Tahap 12: Facts Versus Hints in Spec

Inspect generated `spec.md`.

Verify:

- literal design facts remain distinguishable;
- implementation hints carry `hint(<level>)` or equivalent;
- verified public capability is labeled separately from recommendation;
- fallback warning is visible;
- unresolved mapping is visible;
- low-confidence mapping is not written as imperative fact;
- exact API names preserved;
- no full provenance dump;
- no design fact removed;
- no recommendation copied into transcript.

Build a human-readable diff against pre-PR 4 spec and classify every material change.

## 18. Tahap 13: Agent Context Safety and Budget

Inspect `agent-context.md` and `context-manifest.json`.

Verify:

- Implementation Hints section is non-authoritative;
- explicit instruction says hints are not facts;
- low-confidence/fallback/unresolved handled conservatively;
- candidate lists are not dumped wholesale;
- full provenance arrays absent;
- no full resolved JSON duplication;
- no full conventions or Pilar docs leakage;
- character budget <= 30,000;
- metrics match actual chars/tokens;
- unused capabilities remain zero where expected;
- raw source examples remain zero.

## 19. Tahap 14: Legacy Schema Compatibility

Create or use a schema-1 resolved fixture.

Verify:

- `spec` can consume it if contract promises this;
- agent-context can handle it if it consumes resolved artifacts;
- legacy fields retain unchanged meaning;
- no crash;
- no silent reinterpretation as schema 2 certainty;
- compatibility adapter is centralized;
- unsupported future schema is safe if version handling exists.

Also ensure schema 2 preserves every documented schema-1 key claimed in implementation report.

## 20. Tahap 15: Determinism and Roundtrip

Run repeated executions on identical inputs:

```text
resolve ×3
spec ×3
agent-context ×3
```

Normalize only timestamps expressly documented as non-semantic.

Assert:

- selected values identical;
- classification identical;
- authority identical;
- confidence identical;
- provenance ordering identical;
- candidates/rejected ordering identical;
- behaviorBindings identical;
- no random IDs;
- no absolute temp-path differences;
- semantic hashes stable.

## 21. Tahap 16: Test Quality Review

Audit PR 4 tests.

Ensure they cover actual behavior rather than only substring presence.

Required coverage review:

```text
classification validity
authority mapping
confidence tiers
provenance specificity
public API precedence
standalone pagination case sensitivity
visual CSS exception
icon metadata conflict
ambiguous icon
unknown icon
status strong/weak/conflict/unknown
semantic role ambiguity
modal evidence absence
fallback visibility
unresolved visibility
legacy schema
roundtrip
artifact budget
zero repository reads
skill contract
```

Flag tests that:

- hardcode implementation output without checking evidence;
- never exercise ambiguity;
- assert only that a field exists;
- conflate `verified` capability with `hint` recommendation;
- use synthetic shapes impossible from parser output;
- silently skip unsupported icon metadata rungs.

## 22. Tahap 17: Re-run Tests

Focused:

```bash
node --test test/resolve.test.mjs
node --test test/spec.test.mjs
node --test test/agent-context.test.mjs
node --test test/pilar-catalog.test.mjs
```

Relevant combined:

```bash
node --test \
  test/resolve.test.mjs \
  test/spec.test.mjs \
  test/agent-context.test.mjs \
  test/transcript-schema.test.mjs \
  test/pilar-catalog.test.mjs \
  test/pilar-roundtrip.test.mjs \
  test/conventions.test.mjs \
  test/snapshot.test.mjs \
  test/referee.test.mjs \
  test/referee-verdict.test.mjs \
  test/verify.test.mjs
```

Full suite:

```bash
npm test
```

Run syntax checks on every changed source file.

Record exact pass/fail/skip, duration, warnings, and environment dependencies.

Do not fix failures.

## 23. Tahap 18: Temporary E2E

Use:

```bash
TMP_ROOT="/tmp/sliceui-pr4-verification-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Use repository CLI explicitly:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs ...
```

Do not use global/on-PATH binary.

Run representative temporary copies through:

```text
resolve
spec
agent-context generation
hot referee using existing fresh verdict
verify on known fixture where applicable
```

Capture artifacts and metrics.

## 24. Tahap 19: Real-Fixture Semantic Matrix

Use a temporary copy of the real fixture `figml-export (7)` or the actual named fixture reported by implementation.

Do not modify the real project.

Reproduce the eight groups and compare:

```text
old value
new value
classification
authority
confidence
fallbackUsed
design provenance
project provenance
mapping rule
candidate count
rejected count
```

Verify selected values remain unchanged unless evidence justifies a correction.

## 25. Tahap 20: Artifact Size and Leakage

Measure:

```text
old resolved bytes/chars
new resolved bytes/chars
growth multiple
spec bytes/chars
agent-context bytes/chars
context-manifest bytes/chars
```

Validate:

```text
resolved growth <= 3x target or justified
agent-context <= 30,000 chars
evidence <= configured max
candidates <= configured max
rejected <= configured max
no source bodies
no full corpus blocks
no full catalog/showcase
no credentials
no absolute private paths unless required and documented
```

The reported real-fixture growth is 2.94x, close to the limit. Recalculate independently and check whether small future additions could exceed the intended budget. Determine whether budget enforcement is tested or only observed.

## 26. Tahap 21: Read-Path Proof

Use read-only fs instrumentation or static + dynamic evidence.

Prove:

```text
resolve project-source reads = 0
spec project-source reads = 0
agent-context project-source reads = 0
repository-wide traversal = 0
```

Separate reads of:

```text
.sliceui
input design
SliceUI's own static catalog modules
project source
```

Do not count SliceUI's own module loading as target project source.

## 27. Tahap 22: Performance Measurement

Measure multiple runs, report median:

```text
resolve before/after if baseline reproducible
spec before/after if baseline reproducible
resolve current median
spec current median
in-process resolution policy cost
artifact serialization cost
```

A sub-100 ms absolute CLI time may be acceptable. Flag only material regression or unstable variance.

Do not translate bytes or elapsed time into model token claims.

## 28. Tahap 23: PR 1–3 Non-Regression

### PR 1

- compact context still generated;
- under budget;
- no full conventions read instruction;
- no raw source examples.

### PR 2

- project-context dedup intact;
- conventions canonical owner intact;
- missing conventions returns null;
- empty-ground-truth verify exits non-zero.

### PR 3

- hot referee remains zero-read;
- stored verdict behavior unchanged;
- no hidden deep scan;
- FPR-001 docs remain accurate.

Re-run direct empty-ground-truth verify and a hot-referee read trace where practical.

## 29. Tahap 24: Documentation and Skill Review

Audit:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
docs/project-docs/foundation/status.md
skill/SKILL.md
README.md
docs/SLICEUI-OVERVIEW.md
```

Verify:

- schema v2 path is correct;
- actual artifact path is `.sliceui/artifacts/<name>/resolved.json`;
- classification vocabulary matches implementation;
- authority semantics accurate;
- confidence tiers accurate;
- unsupported parser rungs not claimed as active;
- hints explicitly non-authoritative;
- public API precedence documented;
- fallback/unresolved behavior documented;
- no instruction to guess unresolved decisions;
- no stale schema-1-only statement;
- verify independence accurately stated.

Do not modify docs. Report stale claims.

## 30. Tahap 25: Diff and Scope Audit

Review all PR 4 hunks relative to `f67f8bb`.

Classify:

```text
required PR 4
required tests
required skill/docs
unrelated
scope leakage
pre-existing prompt files
```

Check for:

- hidden PR 5 verification work;
- parser changes;
- generated-code changes;
- new dependencies;
- large formatter diffs;
- verification coupling to resolved output;
- repository scans;
- target-project mutation;
- accidental prompt staging.

## 31. Pass, Conditional Pass, and Fail Criteria

PR 4 is `PASS` only if:

- schema v2 is coherent and documented;
- every emitted decision has valid classification and authority;
- verified capability facts are representable as verified evidence;
- recommendations remain hints;
- confidence is deterministic;
- provenance is specific and bounded;
- explicit design facts are not overridden;
- public API precedence works with exact case;
- icon metadata precedence works;
- ambiguous and unknown paths are safe;
- status color alone is not authoritative;
- modal/card semantics are not invented;
- spec distinguishes facts and hints;
- agent context stays compact;
- legacy compatibility works;
- artifact budget holds;
- no repository reads added;
- PR 1–3 remain healthy;
- tests and full suite pass;
- documentation matches actual support.

PR 4 may be `CONDITIONAL PASS` if:

- core semantic-safety guarantees pass;
- one non-blocking limitation remains, such as parser-skipped metadata rungs or corpus taxonomy risk;
- limitation is accurately documented;
- it does not cause an authoritative false claim or silent guess;
- no blocking correctness defect exists.

PR 4 is `FAIL` if:

- semantic hypothesis can appear authoritative;
- exact capability cannot be distinguished from an inferred recommendation;
- fallback/unresolved can silently select a value;
- public API loses to behavioral CSS;
- label text overrides icon metadata;
- color-only status becomes high/exact;
- candidates are unbounded/non-deterministic;
- provenance is too vague to trace;
- legacy artifacts break;
- verify becomes coupled to resolver assumptions;
- artifact budget materially exceeded;
- repository source reads occur;
- PR 1–3 regress;
- documentation overclaims unsupported parser signals.

## 32. Finding Format

Severity:

```text
Critical
High
Medium
Low
Informational
```

Finding IDs:

```text
SCH schema
CLS classification
AUT authority
CNF confidence
PRV provenance
CND candidates/rejected
API public API precedence
ICN icon resolution
TAX status taxonomy
SEM semantic roles
SPC spec rendering
CTX agent context
BWC backward compatibility
DET determinism
SIZ artifact size
RDP read path
PER performance
REG non-regression
DOC documentation
SCP scope
TST test quality
```

Every material finding:

```text
Finding ID
Severity
Status: Confirmed / Strong evidence / Suspected / Not found / Unable to verify
Evidence: path, symbol, line, command, output
Impact
Required correction
Blocks PR 4 closure: yes/no
```

## 33. Output Report

Create only:

```text
docs/SLICEUI-PR4-VERIFICATION-REPORT.md
```

Required structure:

```markdown
# SliceUI PR 4 Verification Report

## 1. Executive Decision

## 2. Scope and Environment

## 3. Git and Source Integrity Baseline

## 4. Producer and Consumer Audit

## 5. Schema v2 Assessment

## 6. Classification Assessment

## 7. Authority Assessment

## 8. Confidence Assessment

## 9. Provenance Assessment

## 10. Candidate and Rejection Assessment

## 11. Public API Precedence

## 12. Icon Resolution Assessment

## 13. Status and Taxonomy Assessment

## 14. Semantic Role Safety

## 15. Spec Rendering Assessment

## 16. Agent Context Assessment

## 17. Legacy Compatibility

## 18. Determinism and Roundtrip

## 19. Test Quality Review

## 20. Tests Re-run

## 21. E2E and Real-Fixture Results

## 22. Artifact Size and Leakage

## 23. Read-Path Assessment

## 24. Performance Assessment

## 25. PR 1–3 Non-Regression

## 26. Documentation and Skill Assessment

## 27. Diff and Scope Review

## 28. Findings by Severity

## 29. Acceptance Checklist

## 30. Required Corrections Before PR 5

## 31. Deferred Items

## 32. Final Recommendation

## Appendix A: Commands Executed

## Appendix B: Resolution Scenario Matrix

## Appendix C: Before/After Semantic Matrix

## Appendix D: Artifact Metrics

## Appendix E: Read Trace Results

## Appendix F: Source Hashes and Git Status
```

## 34. End-of-Task Validation

Before finishing:

1. Re-run source hashes and compare start/end.
2. Run `git status --short` in SliceUI.
3. Run `git status --short` in the real target project.
4. Confirm source implementation and tests were not modified.
5. Confirm only the report file was added.
6. Confirm no stray `.sliceui` in SliceUI repository.
7. Confirm temporary artifacts remain outside repository.
8. Confirm no secrets or source bodies leaked into report samples.
9. Confirm zero-read claims use dynamic or clearly bounded evidence.
10. Confirm PASS is not based only on existing tests.
11. Do not commit or push.

## 35. Required Final Response

### Decision

```text
PR 4: PASS / CONDITIONAL PASS / FAIL
PR 5 may start: YES / NO
```

### Core Guarantees

```text
Schema v2 coherent:
Authority semantics correct:
Confidence deterministic:
Provenance traceable:
Public API precedence:
Icon precedence safe:
Ambiguity/fallback safe:
Legacy compatibility:
No repository reads:
PR 1–3 non-regression:
```

### Key Evidence

Summarize scenario tests, real-fixture matrix, artifact sizes, read traces, and full-suite result.

### Blocking Findings

List blockers or `None`.

### Non-Blocking Findings

List material limitations.

### Report

```text
docs/SLICEUI-PR4-VERIFICATION-REPORT.md
```

### Validation

List exact principal commands and results.

### Git Status

Show SliceUI and real target statuses.

Do not implement corrections after verification. Wait for the next instruction.

## 36. Final Instruction

Begin with source hashes, consumer audit, and schema inspection. Then create controlled temporary fixtures that exercise ambiguity, fallback, unknown icons, taxonomy conflicts, API-versus-CSS precedence, and semantic-role uncertainty. Use the real target only as read-only evidence. The task is complete only when it provides a reliable decision on whether PR 4 may close and PR 5 may begin.
