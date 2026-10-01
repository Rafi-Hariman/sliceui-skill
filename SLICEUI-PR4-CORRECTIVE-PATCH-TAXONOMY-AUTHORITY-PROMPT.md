# SliceUI PR 4 Corrective Patch Plan: Taxonomy Ambiguity and Authority Semantics

Repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Project target nyata yang hanya boleh digunakan sebagai sumber bukti read-only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Checkpoint baseline resmi sebelum PR 4:

```text
f67f8bb feat(sliceui): add compact agent context and snapshot referee
```

Dokumen yang wajib dibaca sebelum implementasi:

```text
docs/SLICEUI-PR4-VERIFICATION-REPORT.md
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/architecture.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
SLICEUI-PR4-RESOLVE-PROVENANCE-SEMANTIC-SAFETY-PROMPT.md
SLICEUI-PR4-INDEPENDENT-VERIFICATION-PROMPT.md
```

Dokumen pendukung bila diperlukan:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
```

## 1. Mandatory Entry Gate

Sebelum mengubah source:

1. Baca `docs/SLICEUI-PR4-VERIFICATION-REPORT.md`.
2. Pastikan keputusan aktual adalah:

```text
PR 4: CONDITIONAL PASS
PR 5 may start: YES
```

3. Pastikan tidak ada blocking finding.
4. Pastikan corrective patch berfokus pada:

```text
TAX-001 (Medium)
Status co-occurrence dengan beberapa kandidat memilih kandidat pertama secara diam-diam
serta tidak menyimpan daftar kandidat.
```

5. Pastikan `AUT-001` hanya ikut diperbaiki bila perubahan dapat dilakukan secara lokal tanpa memperluas architecture:

```text
Verified adalah capability fact.
Implementation recommendation tetap hint.
```

6. Jalankan baseline focused tests sebelum source diubah.
7. Jika report berbeda secara material, hentikan dan laporkan mismatch.
8. Jangan memulai PR 5 dalam task ini.

Catat entry-gate evidence pada respons akhir.

## 2. Tujuan Corrective Patch

Perbaiki semantic-safety gap pada status/taxonomy resolution sehingga ambiguity tidak pernah disembunyikan melalui pemilihan kandidat pertama.

Perilaku lama yang bermasalah:

```text
Corpus menemukan beberapa status candidates
→ resolver mengambil candidate pertama
→ resolved value terlihat terpilih
→ candidates[] tidak tersedia
→ confidence tetap 0.70
→ agent tidak mengetahui bahwa mapping ambiguous
```

Target behavior:

```text
Zero candidate
→ unresolved atau conservative fallback yang eksplisit

Exactly one supported candidate
→ boleh menjadi non-authoritative hint
→ provenance dan confidence tetap eksplisit

Multiple candidates with no deterministic winner
→ jangan memilih kandidat pertama
→ selected/resolved value kosong sesuai schema aktual
→ candidates[] berisi top bounded candidates
→ stable ordering
→ authority unresolved atau hint sesuai contract aktual
→ confidence ambiguous tier, misalnya 0.50
→ fallbackUsed false kecuali fallback benar-benar digunakan
→ diagnostic ambiguity tersedia
→ spec dan agent context memperlihatkan ambiguity secara ringkas
```

Corrective patch juga harus memperjelas `AUT-001`:

```text
Capability fact:
uii-table.paginationAlign exists
→ authority: verified

Implementation recommendation:
use [paginationAlign]="'right'"
→ authority: hint
```

Jangan membatalkan atau menulis ulang PR 4. Terapkan perubahan minimum.

## 3. Scope yang Diizinkan

Perubahan hanya boleh mencakup:

- status/taxonomy multi-candidate handling pada resolver;
- deterministic candidate ranking dan bounding;
- explicit ambiguity diagnostic;
- unresolved/selected-value semantics untuk ambiguous status;
- spec rendering ambiguity secara ringkas;
- agent-context ambiguity secara ringkas;
- local authority correction untuk behavior bindings;
- regression tests untuk `TAX-001` dan `AUT-001`;
- owning documentation jika contract berubah;
- focused re-verification;
- optional checkpoint commit hanya setelah corrective patch independently focused-verified dan user mengizinkan melalui task terpisah.

Likely files, subject to source audit:

```text
src/lib/resolve.mjs
src/lib/resolution-policy.mjs
src/commands/spec.mjs
src/lib/agent-context.mjs
test/resolve.test.mjs
test/spec.test.mjs
test/agent-context.test.mjs
skill/SKILL.md
docs/project-docs/development/api-contract.md
```

Jangan mengubah semua file secara otomatis. Gunakan perubahan terkecil.

## 4. Di Luar Scope

Jangan mengimplementasikan:

- PR 5 Verify Reliability;
- PascalCase normalization pada verify;
- unknown Angular input verification;
- wrapper/modal invention detector;
- visual/render verification;
- taxonomy registry baru;
- repository/database taxonomy scan;
- FIGML parser rewrite;
- componentProperties/mainComponent support;
- status machine-learning classifier;
- full authority-model redesign;
- full candidate-system redesign untuk semua resolution kinds;
- conventions-body conflict CNF-001;
- fs-trace redesign;
- referee fingerprint changes;
- verdict atomic writing;
- cold-path scan optimization;
- TypeScript migration;
- Python rewrite;
- dependency baru;
- unrelated cleanup/refactor;
- generated Angular output changes selain akibat safe ambiguity communication;
- commit atau push sebelum focused re-verification selesai.

Temuan berikut tetap deferred kecuali test perlu disesuaikan secara langsung:

```text
CND-001 maxRejected/resolvedJsonMaxGrowth enforcement
PRV-001 footer provenance precision
TST-001 broader test-quality hardening beyond TAX-001 regression
```

## 5. Wajib Reproduce TAX-001 Sebelum Fix

Sebelum coding, buat controlled temporary scenario yang menghasilkan minimal dua status candidates dengan evidence setara atau tidak cukup untuk deterministic winner.

Gunakan helper aktual atau CLI path yang paling dekat dengan production behavior.

Record:

```text
input design text/color
corpus/class vocabulary inputs
candidate count
candidate order
selected value
classification
authority
confidence
fallbackUsed
diagnostics
```

False-safe behavior harus direproduksi:

```text
candidate count > 1
selected value = first candidate
candidates missing or empty
no ambiguity diagnostic
```

Jangan mengubah source sebelum reproduksi berhasil. Jika tidak dapat direproduksi, hentikan dan investigasi mismatch.

Gunakan `/tmp` untuk seluruh scenario fixture:

```bash
TMP_ROOT="/tmp/sliceui-pr4-corrective-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

## 6. Root-Cause Audit

Audit minimal:

```text
src/lib/resolve.mjs
src/lib/resolution-policy.mjs
src/commands/spec.mjs
src/lib/agent-context.mjs
test/resolve.test.mjs
test/spec.test.mjs
test/agent-context.test.mjs
```

Cari:

```bash
rg -n "STATUS_LABELS|status|taxonomy|co-occurrence|candidate|candidates|resolved\[0\]|confidence|authority|behaviorBindings|verified|hint|fallbackUsed|diagnostic" \
  src test skill docs
```

Buktikan:

- fungsi yang mengumpulkan status candidates;
- tempat candidate pertama dipilih;
- alasan candidates tidak disimpan;
- confidence tier yang digunakan;
- how spec renders selected value;
- how agent context receives status hint;
- where behavior binding top-level authority becomes `verified`;
- whether nested evidence already represents verified capability.

## 7. Taxonomy Candidate Policy

Implementasikan policy deterministik berikut, disesuaikan dengan schema aktual.

### Zero candidates

Expected:

```text
classification: unresolved
selected/resolved: empty
candidates: []
authority: unresolved or fallback only if a real conservative fallback exists
confidence: 0
fallbackUsed: true only when an actual fallback implementation is emitted
diagnostic: no supported taxonomy mapping
```

Jangan membuat taxonomy class baru.

### Exactly one candidate

Candidate boleh dipilih jika evidence cukup menurut policy existing.

Expected:

```text
classification: semantic-hypothesis or implementation-recommendation
authority: hint
confidence: semantic tier, normally <= 0.70 for corpus co-occurrence
fallbackUsed: false
provenance: exact corpus/class source
```

Candidate list boleh disimpan atau tidak sesuai contract, tetapi selected source harus traceable.

### Multiple candidates with a deterministic winner

Hanya boleh memilih winner jika tie-break rule benar-benar semantic dan documented, misalnya:

```text
exact normalized status text match
+ verified taxonomy source
```

Jangan menggunakan:

```text
array order
filesystem order
object insertion order
first corpus occurrence
lexicographic order alone
```

sebagai semantic winner.

Jika deterministic winner ada:

- selected value jelas;
- rejected alternatives bounded;
- reason eksplisit;
- confidence sesuai evidence;
- candidates tetap traceable bila material.

### Multiple candidates without deterministic winner

Expected:

```text
selected/resolved: empty
classification: semantic-hypothesis or unresolved, sesuai schema
upper-level authority: unresolved or hint, never verified/authoritative
confidence: ambiguous tier, normally 0.50
fallbackUsed: false unless fallback is separately emitted
candidates: top 3, stable ordered
diagnostics: ambiguity explicit
```

Ordering hanya untuk deterministic presentation, bukan winner selection.

## 8. Candidate Shape

Gunakan shape aktual atau additive shape yang konsisten.

Conceptual example:

```json
{
  "value": "label-custom-active",
  "score": 0.5,
  "authority": "hint",
  "source": "conventions.ngDeepCorpus",
  "evidence": [
    {
      "type": "corpus-co-occurrence",
      "entryId": "..."
    }
  ]
}
```

Candidates wajib:

- maksimal `POLICY.maxCandidates`;
- stable sort;
- tidak duplicate;
- tidak berisi selected value sebagai rejected jika selected kosong;
- memiliki source/provenance minimum;
- tidak membawa full corpus block;
- tidak membawa source bodies;
- tidak mengandung absolute path yang tidak perlu.

Jika total candidates lebih dari limit, simpan count total atau truncation metadata bila schema mendukung. Jangan memperbesar scope jika metadata tersebut belum ada dan top-three sudah cukup untuk safety.

## 9. Ambiguity Diagnostic

Gunakan existing diagnostic style.

Conceptual diagnostic:

```text
SUI-RESOLVE-STATUS-AMBIGUOUS
Multiple project taxonomy candidates have equivalent evidence.
No status class was selected automatically.
```

Diagnostic harus menyertakan secara bounded:

```text
node/group id
exact design text jika ada
normalized color jika ada
candidate count
selected = none
recommended handling
```

Jangan menyuruh agent mencari repository.

## 10. Spec Rendering

Untuk ambiguous status, `spec.md` harus menunjukkan ambiguity tanpa menjadi verbose.

Conceptual format:

```markdown
Status taxonomy hint: unresolved (ambiguous)
Confidence: ambiguous
Candidates: `label-custom-active`, `label-custom-success`
Do not choose automatically without additional evidence.
```

Requirements:

- jangan menampilkan kandidat pertama sebagai recommended value;
- jangan memberikan imperative class usage;
- jangan menyembunyikan ambiguity;
- candidates bounded;
- exact design text/colors tetap terlihat sebagai design facts di section yang tepat;
- no full provenance dump;
- legacy unambiguous status rendering tetap kompatibel.

## 11. Agent Context Rendering

Agent context harus tetap compact.

Untuk ambiguous status:

```text
- mark unresolved/ambiguous;
- provide bounded candidates only if useful;
- explicitly forbid guessing;
- do not emit selected implementation class;
```

Do not include:

- full corpus entries;
- all candidates beyond limit;
- full diagnostics JSON;
- source bodies;
- raw conventions JSON.

Agent context remains under `30,000` characters.

## 12. AUT-001 Local Correction

Correct only if the source model can be adjusted locally.

Current concern:

```text
behavior binding top-level authority = verified
```

This can imply the recommendation itself is verified.

Target layering:

```text
Capability evidence:
- component: uii-table
- api: paginationAlign
- authority: verified

Implementation recommendation:
- binding: [paginationAlign]="'right'"
- authority: hint
- confidence: 0.85
```

Requirements:

- verified remains attached to machine-verified capability existence;
- recommendation remains hint;
- public API precedence remains enforced;
- exact casing remains `paginationAlign` for table;
- standalone `paginationALign` is not changed;
- CSS rejection remains recorded;
- spec labels capability and recommendation separately;
- agent context does not call the recommendation authoritative.

If source already models this distinction and only rendering is misleading, fix rendering only. Avoid schema churn.

## 13. Backward Compatibility

Preserve schema v2 and all schema-1 compatibility guarantees.

Do not:

- rename existing fields destructively;
- remove legacy keys;
- change existing unambiguous selected values;
- require transcript regeneration;
- make verify/referee consume resolved output.

New ambiguity behavior may intentionally change selected value only for multi-candidate status cases that were previously silently selected.

Document that semantic change in tests and final report.

## 14. Determinism

Same ambiguous inputs must produce identical normalized output across runs.

Assert:

```text
candidate order stable
selected remains empty
confidence stable
authority stable
diagnostic order stable
provenance order stable
no random IDs
no filesystem-order dependence
```

Run at least three repeated resolutions for the ambiguity fixture.

## 15. Tests Wajib

### 15.1 Reproduce old ambiguity behavior

Documented pre-fix reproduction, not necessarily retained as passing test.

### 15.2 Zero candidates

- unresolved;
- no invented class;
- confidence 0;
- correct fallbackUsed semantics.

### 15.3 One corpus candidate

- selected as hint if existing policy permits;
- confidence <= 0.70;
- provenance traceable;
- no authoritative/verified claim.

### 15.4 Multiple equal candidates

- no selected value;
- candidates surfaced;
- candidates <= 3;
- confidence ambiguous tier;
- diagnostic present;
- no silent first-candidate selection.

### 15.5 Multiple candidates stable ordering

Randomize input order. Output candidates remain stable.

### 15.6 More than max candidates

- bounded to max;
- no unbounded artifact growth;
- deterministic top set.

### 15.7 Deterministic winner

Only if current implementation supports a real semantic tie-breaker. Test reason and rejected alternatives. Do not invent a tie-breaker solely to satisfy test.

### 15.8 Status color only

- not authoritative;
- not high/exact;
- ambiguous or unresolved.

### 15.9 Status text/color conflict

- ambiguity visible;
- no silent selected class.

### 15.10 Real Aktif fixture

- remains hint 0.70 if it has exactly one corpus candidate;
- selected value remains unchanged;
- provenance still says corpus co-occurrence.

### 15.11 Spec ambiguity

- does not show first candidate as selected recommendation;
- shows bounded ambiguity;
- says not to guess.

### 15.12 Agent context ambiguity

- non-authoritative;
- compact;
- no selected class;
- no guessing instruction violation.

### 15.13 AUT-001 capability/recommendation split

- capability evidence authority verified;
- recommendation authority hint;
- confidence remains 0.85;
- exact binding preserved;
- CSS rejected.

### 15.14 Standalone pagination casing

Confirm no regression:

```text
uii-table.paginationAlign
uii-pagination.paginationALign
```

### 15.15 Public API precedence

Still passes after authority correction.

### 15.16 Schema compatibility

All existing schema-1 keys retained.

### 15.17 Artifact budget

Resolved artifact remains within accepted budget for real fixture. Corrective patch must not add material bloat.

### 15.18 Zero repository reads

Resolve/spec/agent-context remain zero project-source reads.

### 15.19 PR 1–3 non-regression

- compact context;
- snapshot dedup;
- missing ground truth non-green;
- hot referee zero-read.

## 16. Test Files

Prefer updating existing ownership files:

```text
test/resolve.test.mjs
test/spec.test.mjs
test/agent-context.test.mjs
```

Add a new test file only if taxonomy policy has a clear separate module owner. Avoid fixture sprawl.

## 17. Validation Commands

Before changes:

```bash
git status --short
git rev-parse HEAD
git log -1 --oneline
node --version
npm --version
```

Baseline:

```bash
node --test test/resolve.test.mjs
node --test test/spec.test.mjs
node --test test/agent-context.test.mjs
```

After implementation, syntax-check all changed source.

Focused tests:

```bash
node --test test/resolve.test.mjs
node --test test/spec.test.mjs
node --test test/agent-context.test.mjs
```

Relevant combined suite:

```bash
node --test \
  test/resolve.test.mjs \
  test/spec.test.mjs \
  test/agent-context.test.mjs \
  test/transcript-schema.test.mjs \
  test/pilar-catalog.test.mjs \
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

## 18. Temporary E2E

Use explicit repository CLI:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs ...
```

Never use global/on-PATH `sliceui`.

Run temporary scenarios through:

```text
resolve
spec
agent-context generation
```

Capture:

```text
selected value
candidate list
classification
authority
confidence
fallbackUsed
diagnostics
resolved artifact size
spec wording
agent-context wording
project-source reads
```

Use real project only as read-only reference.

## 19. Focused Re-Verification

After implementation and tests, perform focused re-verification rather than repeating the entire PR 4 independent verification.

Scenarios:

```text
zero taxonomy candidates
one taxonomy candidate
multiple taxonomy candidates
more than max candidates
color-only status
text/color conflict
real Aktif case
public API binding recommendation
standalone pagination casing
```

Record:

```text
input
selected
candidates
authority
confidence
diagnostic
spec result
agent-context result
```

Decision:

```text
PR 4 corrective patch: PASS / FAIL
TAX-001: RESOLVED / UNRESOLVED
AUT-001: RESOLVED / DEFERRED / UNRESOLVED
PR 4 may be closed: YES / NO
PR 5 may start: YES / NO
```

## 20. Acceptance Criteria

Corrective patch complete only if:

- [ ] TAX-001 reproduced before fix.
- [ ] Multi-candidate status no longer silently selects first.
- [ ] Ambiguous candidates are bounded and stable.
- [ ] Ambiguous confidence uses documented tier.
- [ ] Ambiguity diagnostic is explicit.
- [ ] Spec does not present ambiguous candidate as selected fact/hint.
- [ ] Agent context does not instruct guessing.
- [ ] Zero-candidate status remains unresolved.
- [ ] One-candidate real fixture remains safely compatible.
- [ ] Color-only status never becomes authoritative/high.
- [ ] AUT-001 layering corrected or explicitly deferred with evidence.
- [ ] Verified capability and hint recommendation are distinguishable.
- [ ] Public API precedence remains intact.
- [ ] Exact pagination casing remains intact.
- [ ] Schema compatibility remains intact.
- [ ] Artifact growth remains bounded.
- [ ] No repository reads added.
- [ ] Focused tests pass.
- [ ] Relevant suite passes.
- [ ] Full suite passes except pre-existing skips.
- [ ] PR 1–3 non-regression confirmed.
- [ ] No PR 5 work enters patch.
- [ ] Documentation synchronized if contract changed.

## 21. Documentation

Update only owning documentation if the ambiguity or authority contract changes.

Likely owner:

```text
docs/project-docs/development/api-contract.md
```

Document concisely:

```text
multiple equal taxonomy candidates remain unresolved
candidate limit
ambiguous confidence tier
no silent first-candidate selection
capability verified versus recommendation hint
```

Update `skill/SKILL.md` only if agent handling of ambiguous status is not already explicit.

Do not update broad docs unnecessarily.

## 22. Safety and Git Rules

Do not run:

```text
git reset --hard
git clean -fd
git checkout -- .
git restore .
npm update
auto-format whole repository
```

Do not delete prompt files. Do not modify real target project.

Do not commit or push. PR 4 must be focused-verified first.

Record initial and final `git status --short`.

## 23. Work Sequence

### Phase 1: Gate and reproduce

- read report;
- confirm findings;
- reproduce TAX-001;
- run baseline tests.

### Phase 2: Root-cause note

Before coding, state:

```text
root cause
files to change
candidate policy
authority correction plan
tests
```

### Phase 3: Implement TAX-001 correction

- no first-candidate silent selection;
- bounded candidate surfacing;
- deterministic ambiguity state;
- diagnostic.

### Phase 4: Implement local AUT-001 correction

Only if contained and safe.

### Phase 5: Update rendering

- spec ambiguity;
- agent-context conservative handling.

### Phase 6: Tests and E2E

- focused;
- combined;
- full;
- zero-read and artifact metrics.

### Phase 7: Focused re-verification

- scenario matrix;
- closure decision.

### Phase 8: Documentation and scope review

- owning docs only;
- no PR 5 leakage.

## 24. Required Final Response

### Entry Gate

```text
PR 4 verification decision:
TAX-001 confirmed:
AUT-001 confirmed:
Other blockers:
```

### Pre-Fix Reproduction

```text
Candidate count:
Selected value:
Candidates exposed:
Confidence:
Diagnostic:
```

### Root Cause

Include paths, symbols, and first-candidate behavior.

### Corrective Patch Summary

Describe minimum changes.

### Files Changed

Separate source, tests, skill/docs, and pre-existing files.

### Taxonomy Policy After Fix

```text
zero candidates:
one candidate:
multiple candidates:
deterministic winner:
ambiguous confidence:
candidate limit:
```

### Authority Semantics After Fix

```text
capability fact authority:
implementation recommendation authority:
confidence:
CSS rejection:
```

### Validation

List exact commands and outcomes.

### Artifact and Read Metrics

```text
resolved size before/after:
spec size before/after:
agent-context size before/after:
resolve project reads:
spec project reads:
```

### Focused Re-Verification Decision

```text
PR 4 corrective patch: PASS / FAIL
TAX-001: RESOLVED / UNRESOLVED
AUT-001: RESOLVED / DEFERRED / UNRESOLVED
PR 4 may be closed: YES / NO
PR 5 may start: YES / NO
```

### Deferred Findings

Keep deferred:

```text
CND-001 budget enforcement
PRV-001 footer provenance precision
PR 5 verify reliability
visual/render verification
parser metadata support
fs-trace redesign
atomic verdict writing
incremental refresh/cache
```

### Documentation Sync

Use `Documentation sync: clear.` or list stale docs.

### Git Status

Include `git status --short`. Do not commit.

## 25. Definition of Done

The task is complete only when multi-candidate status ambiguity is surfaced rather than silently collapsed, candidate ordering and limits are deterministic, ambiguous confidence is explicit, spec and agent context prevent guessing, behavior-binding authority correctly distinguishes verified capability facts from hint-level implementation recommendations, all tests pass, no target repository reads are added, and focused re-verification explicitly authorizes or blocks PR 4 closure and PR 5.

Start by reproducing TAX-001 on a controlled temporary fixture. Do not modify source before the first-candidate ambiguity is demonstrated with actual output.
