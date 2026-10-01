# SliceUI PR 5 Corrective Patch Plan: Framework Syntax Lexical Safety and Unverifiable Output

Repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Project target nyata yang hanya boleh digunakan sebagai referensi read-only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Checkpoint baseline resmi sebelum PR 5:

```text
a6fd181 feat(sliceui): add typed resolve provenance and ambiguity safety
```

Dokumen yang wajib dibaca sebelum implementasi:

```text
docs/SLICEUI-PR5-VERIFICATION-REPORT.md
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
SLICEUI-PR5-VERIFY-RELIABILITY-INDEPENDENT-GATE-SAFETY-PROMPT.md
SLICEUI-PR5-INDEPENDENT-VERIFICATION-PROMPT.md
```

Dokumen pendukung bila diperlukan:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
docs/SLICEUI-PR4-VERIFICATION-REPORT.md
```

## 1. Mandatory Entry Gate

Sebelum mengubah source:

1. Baca `docs/SLICEUI-PR5-VERIFICATION-REPORT.md`.
2. Pastikan keputusan aktual adalah:

```text
PR 5: CONDITIONAL PASS
PR 6 may start: YES
```

3. Pastikan tidak ada blocking finding.
4. Pastikan corrective patch hanya menangani:

```text
FWK-001 (Medium)
Framework syntax checker salah mendeteksi syntax di comments dan string literals.

FWK-002 (Informational)
Executable effect() belum terdeteksi sebagai signal API yang tidak sesuai policy Angular target.

EXT-001 (Low)
Malformed snapshot menghasilkan exit 3 tetapi human headline belum mengatakan UNVERIFIABLE.
```

5. Jalankan baseline focused tests sebelum source diubah.
6. Reproduce `FWK-001`, `FWK-002`, dan `EXT-001` pada temporary fixtures.
7. Jika verification report berbeda secara material, hentikan dan laporkan mismatch.
8. Jangan memulai PR 6 dalam task ini.

Catat entry-gate evidence pada final response.

## 2. Tujuan Corrective Patch

Implementasikan patch terkecil yang:

1. Mengabaikan syntax-like text di comments dan literal text.
2. Tetap mendeteksi syntax executable yang benar-benar dijalankan.
3. Menambahkan `effect()` ke bounded signal API detection bila Angular/project policy memang melarangnya.
4. Mempertahankan line dan column diagnostic yang akurat.
5. Menampilkan primary state `UNVERIFIABLE` pada malformed snapshot dan kondisi exit 3 lain yang relevan.
6. Menjaga exit-code contract PR 5 tetap sama.
7. Menjaga exact API validation, diagnostics, skip semantics, dan bounded read path tetap utuh.
8. Menambahkan regression tests dan focused re-verification.
9. Tidak mengubah PR 5 menjadi full TypeScript parser, Angular compiler, atau visual verification system.

## 3. Masalah yang Harus Diperbaiki

### FWK-001: false positive pada comments dan strings

Perilaku salah yang telah direproduksi:

```typescript
// Do not use inject() in Angular 13.
```

```typescript
const documentation = "Avoid inject() in this project";
```

Kedua contoh tersebut dianggap memakai `inject()` secara executable dan menghasilkan blocking failure.

Target:

```text
syntax-like text dalam comment atau literal text
→ tidak dideteksi

syntax executable dalam code
→ tetap dideteksi
```

### FWK-002: `effect()` tidak terdeteksi

Perilaku saat ini:

```typescript
effect(() => console.log(count()));
```

Tidak dilaporkan walaupun policy yang sama sudah memeriksa signal APIs lain.

Target:

```text
Jika framework version/policy target melarang signals:
- signal()
- computed()
- effect()
- API lain yang memang sudah tercakup current bounded policy
→ dideteksi hanya saat executable
```

Jangan menambahkan API baru tanpa evidence dari current policy/source.

### EXT-001: headline tidak sinkron dengan exit state

Perilaku saat ini:

```text
malformed snapshot
→ diagnostic terlihat
→ exit 3
→ headline masih terlihat seperti ordinary verification run
```

Target:

```text
malformed/missing required ground truth
→ primary state UNVERIFIABLE
→ headline jelas
→ diagnostic reason terlihat
→ exit 3
→ tidak ada clean-pass wording
```

## 4. Scope yang Diizinkan

Perubahan hanya boleh mencakup:

- lexical masking helper untuk framework syntax checks;
- framework syntax matching terhadap masked source;
- detection `effect()` bila didukung current policy;
- preservation line/column offsets;
- headline/state rendering untuk unverifiable conditions;
- focused tests untuk comments, strings, template literals, executable syntax, and malformed snapshot headline;
- owning documentation only if current bounded syntax list or headline contract changes;
- focused re-verification.

Likely files, subject to source audit:

```text
src/framework/angular/verify.mjs
src/commands/verify.mjs
test/verify.test.mjs
test/verify-root.test.mjs
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
```

Buat helper kecil baru hanya jika lexical masking tidak layak dimiliki oleh verify module, misalnya:

```text
src/lib/source-mask.mjs
```

Jangan membuat subsystem parser besar.

## 5. Di Luar Scope

Jangan mengimplementasikan:

- PR 6 visual/render verification;
- browser automation;
- screenshot comparison;
- TypeScript compiler integration baru;
- Angular compiler integration baru;
- AST/parser dependency baru;
- full JavaScript/TypeScript lexer;
- modal/card heuristic refinement;
- acronym normalization changes;
- exact API validation redesign;
- check inventory redesign;
- diagnostic architecture rewrite;
- snapshot loader redesign;
- resolve/referee changes;
- repository scanning;
- full Angular build orchestration;
- TypeScript migration;
- Python rewrite;
- unrelated cleanup/refactor;
- commit atau push sebelum focused re-verification selesai.

Temuan berikut tetap deferred:

```text
NAM-001 stacked acronym normalization
TST-001/TST-002 broader CLI test hardening outside this patch
STR-001 modal/card heuristic refinement
CND-001 budget enforcement
PRV-001 provenance precision
fs-trace redesign
atomic verdict writing
incremental refresh/cache
```

## 6. Wajib Reproduce Sebelum Fix

Gunakan temporary fixture:

```bash
TMP_ROOT="/tmp/sliceui-pr5-corrective-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Gunakan repository CLI secara eksplisit:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs verify <dir> [name]
```

Jangan gunakan global/on-PATH `sliceui`.

### Reproduce FWK-001

Minimal cases:

```typescript
// inject(Service)
```

```typescript
/* signal(0) */
```

```typescript
const a = "inject(Service)";
```

```typescript
const b = 'signal(0)';
```

```typescript
const c = `computed(() => 1)`;
```

Expected pre-fix reproduction:

```text
frameworkSyntax fails
blocking error generated
```

### Reproduce FWK-002

```typescript
effect(() => console.log('x'));
```

Expected pre-fix:

```text
frameworkSyntax does not detect effect()
```

### Reproduce EXT-001

Use malformed canonical snapshot.

Expected pre-fix:

```text
exit code: 3
malformed snapshot diagnostic: present
headline: not explicitly UNVERIFIABLE
```

Record exact stdout, stderr, exit code, check status, and diagnostic.

Jangan mengubah source sebelum seluruh reproductions selesai.

## 7. Root-Cause Audit

Audit minimal:

```text
src/framework/angular/verify.mjs
src/commands/verify.mjs
src/lib/diagnostics.mjs
test/verify.test.mjs
test/verify-root.test.mjs
```

Cari:

```bash
rg -n "frameworkSyntax|inject|signal|computed|effect|standalone|@if|@for|@switch|@defer|UNVERIFIABLE|primaryState|headline|malformedSnapshot|exitCode" \
  src test skill docs
```

Buktikan:

- raw substring/regex path yang menyebabkan comment/string false positive;
- current signal API regex/list;
- how framework version gates check execution;
- how diagnostic location is calculated;
- how primary state becomes unverifiable;
- how headline text is selected;
- how malformed snapshot diagnostic reaches output;
- whether source text includes template and component TS separately.

## 8. Lexical Masking Requirements

Implementasikan bounded lexical masking yang cukup untuk framework checks.

Input:

```text
TypeScript source string
```

Output:

```text
masked source string dengan panjang dan newline positions yang sama
```

Mask regions berikut:

```text
single-line comments
block comments
single-quoted strings
double-quoted strings
template literal plain-text segments
escaped characters in strings
escaped backticks
comment-like text inside strings
quote-like text inside comments
```

Preserve:

```text
string length
line count
newline positions
code outside masked regions
```

Gunakan whitespace replacement untuk masked characters. Jangan menghapus regions sebab line/column diagnostic harus tetap akurat.

## 9. Template Literal Policy

Template literals perlu policy eksplisit.

### Plain template text

```typescript
const doc = `Do not use inject()`;
```

Tidak boleh terdeteksi.

### Executable interpolation

```typescript
const value = `${inject(Service)}`;
```

`inject()` berada di executable expression dan sebaiknya tetap terdeteksi.

### Nested interpolation

```typescript
const value = `count: ${computed(() => `${signal(0)}`)}`;
```

Jika bounded scanner mendukung nesting secara aman, executable expressions harus dipertahankan.

Jika full interpolation nesting terlalu kompleks untuk patch kecil:

1. Jangan menyebabkan false positive dari plain template text.
2. Jangan diam-diam mengklaim full template-expression coverage.
3. Document limitation.
4. Add tests for supported interpolation depth.
5. Prefer a small state machine over fragile regex chaining.

## 10. Masking State Machine

Implementasi minimal dapat menggunakan deterministic state machine dengan states seperti:

```text
CODE
LINE_COMMENT
BLOCK_COMMENT
SINGLE_QUOTE
DOUBLE_QUOTE
TEMPLATE_TEXT
TEMPLATE_EXPRESSION
```

Track only what is needed:

```text
escape state
block comment close
newline preservation
template interpolation depth
brace depth inside interpolation when supported
```

Rules:

- comments can start only in CODE or TEMPLATE_EXPRESSION;
- string literals can start only in executable states;
- comment markers inside strings do not change state;
- quote markers inside comments do not change state;
- escaped quotes do not close strings;
- regex literals are not required unless current framework patterns could false-positive inside them. Audit and document.

Avoid overengineering into a full ECMAScript parser.

## 11. Framework Syntax Matching

Run bounded framework patterns against masked executable source.

Preserve current checks for policy-supported constructs:

```text
@if
@for
@switch
@defer
inject(
standalone: true
signal(
computed(
current supported signal API list
```

Add:

```text
effect(
```

only when source/project policy confirms it belongs to the same incompatible API family.

Patterns should avoid obvious identifier false positives, for example:

```typescript
myinject(
```

should not match `inject(` if current contract requires exact identifier.

Use identifier boundaries where practical.

## 12. Comments and Strings Test Matrix

All following must not trigger frameworkSyntax:

```typescript
// inject(Service)
```

```typescript
/* signal(0) */
```

```typescript
/** computed(() => 1) */
```

```typescript
const a = "inject(Service)";
```

```typescript
const b = 'signal(0)';
```

```typescript
const c = `effect(() => {})`;
```

```typescript
const d = "escaped quote: \" inject(Service)";
```

```typescript
const e = 'escaped quote: \' signal(0)';
```

```typescript
const f = "comment-like // inject()";
```

```typescript
const g = 'comment-like /* signal() */';
```

```typescript
/* quote-like "inject()" and 'signal()' */
```

```typescript
// template-like `${inject(Service)}`
```

Also test multiline block comments and multiline templates.

## 13. Executable Syntax Test Matrix

All following must trigger when framework/policy target marks them unsupported:

```typescript
const service = inject(Service);
```

```typescript
const count = signal(0);
```

```typescript
const doubled = computed(() => count() * 2);
```

```typescript
effect(() => console.log(count()));
```

```typescript
const value = `${inject(Service)}`;
```

```typescript
@Component({ standalone: true })
```

Template constructs:

```html
@if (ready) { ... }
@for (item of items) { ... }
@switch (value) { ... }
@defer { ... }
```

Ensure code after comments/strings remains visible:

```typescript
// inject() is prohibited
const actual = inject(Service);
```

The executable occurrence must still be detected.

## 14. Identifier Boundary Safety

Test obvious non-target identifiers:

```typescript
function myinject() {}
const signalValue = 1;
const computedLabel = 'x';
const sideeffect = () => {};
```

These should not match exact API calls unless current policy intentionally matches them.

Also test property calls according to policy:

```typescript
service.inject()
rxjs.effect()
```

Decide from current check intent whether these should trigger. Document behavior and tests. Do not broaden silently.

## 15. Line and Column Preservation

Masking must preserve diagnostics.

Create fixture where executable syntax appears after:

```text
multiple comments
multiline string/template
escaped quotes
blank lines
```

Verify framework diagnostic location points to actual executable syntax line and column.

Compare pre-mask index and masked index. They must be equal for executable token start.

## 16. Framework Version Gating

Preserve current gating:

```text
Angular <= supported threshold
→ incompatible syntax check runs

Framework version absent
→ check skips/degrades according to existing policy

Newer version that supports syntax
→ no Angular-13 incompatibility diagnostic
```

Do not alter supported version table unless current implementation is demonstrably wrong.

## 17. EXT-001 Human Output Correction

Audit primary state and headline selection.

For these conditions:

```text
missing required ground truth
malformed snapshot
unpaired transcript/XML
unknown required schema
```

Human output should clearly show:

```text
Primary state: UNVERIFIABLE
Exit code: 3
Reason/diagnostic: visible
```

Requirements:

- no clean pass wording;
- malformed snapshot diagnostic remains visible;
- exit code remains 3;
- successful verification headline remains unchanged;
- fail headline remains correct;
- invalid-input headline remains correct;
- human output and internal primaryState agree;
- do not redesign entire reporter.

If only malformed snapshot lacks the correct headline, fix only that state-selection path.

## 18. Diagnostic Contract Preservation

Do not change stable IDs, category, trust, or severity unnecessarily.

Framework diagnostic must retain:

```text
stable SUI-VERIFY-* ID
framework-syntax category
verified-capability or current accurate trust source
error severity
fail status
precise detail
```

If adding `effect()` uses same check ID, ensure diagnostic detail names the detected construct clearly.

Do not emit one duplicate check per occurrence unless current contract already does so. Preserve bounded output.

## 19. Required Tests

### 19.1 FWK-001 pre-fix reproduction evidence

Record before-fix behavior in working notes/final report.

### 19.2 Line comments

Syntax-like text ignored.

### 19.3 Block comments

Syntax-like text ignored, including multiline.

### 19.4 Single-quoted strings

Ignored, including escaped quote.

### 19.5 Double-quoted strings

Ignored, including escaped quote.

### 19.6 Template plain text

Ignored.

### 19.7 Template interpolation

Executable syntax detected for supported interpolation form.

### 19.8 Comment markers inside strings

No state corruption.

### 19.9 Quotes inside comments

No state corruption.

### 19.10 Executable inject

Detected.

### 19.11 Executable signal

Detected.

### 19.12 Executable computed

Detected.

### 19.13 Executable effect

Detected if policy supports.

### 19.14 Syntax after comment/string

Detected.

### 19.15 Identifier boundaries

Non-target identifiers do not false-positive.

### 19.16 Location preservation

Line/column remains correct.

### 19.17 Angular version absent/newer

No incorrect Angular-13 fail.

### 19.18 Malformed snapshot headline

```text
primary state UNVERIFIABLE
exit 3
malformed reason visible
```

### 19.19 Valid pass headline

Unchanged.

### 19.20 Blocking fail headline

Still fail/exit 1.

### 19.21 Invalid input headline

Still invalid-input/exit 2.

### 19.22 Determinism

Repeated output stable.

### 19.23 Bounded reads

No new filesystem reads or repository scan.

### 19.24 PR 1–4 and PR 5 core non-regression

- name normalization;
- exact API validation;
- required/optional skip semantics;
- diagnostic metadata;
- compact context;
- snapshot safety;
- hot referee;
- resolve semantic safety.

## 20. Test Ownership

Prefer existing files:

```text
test/verify.test.mjs
test/verify-root.test.mjs
```

Create a focused helper test only if masking helper becomes a separate module. Do not create large fixtures.

Tests must assert actual behavior, not only substring existence.

For CLI headline/exit cases, spawn actual CLI process and assert process exit code plus output.

## 21. Validation Commands

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
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
```

After implementation, syntax-check all changed/new source and test files.

Focused:

```bash
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
node --test test/snapshot.test.mjs
```

Relevant combined:

```bash
node --test \
  test/verify.test.mjs \
  test/verify-root.test.mjs \
  test/snapshot.test.mjs \
  test/pilar-catalog.test.mjs \
  test/transcript-schema.test.mjs \
  test/referee.test.mjs \
  test/referee-verdict.test.mjs \
  test/resolve.test.mjs \
  test/spec.test.mjs \
  test/agent-context.test.mjs
```

Full suite:

```bash
npm test
```

## 22. Temporary E2E

Use explicit repository CLI only:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs verify <dir> [name]
```

Scenarios:

```text
comment-only syntax
string-only syntax
template-text-only syntax
template interpolation executable syntax
real executable inject/signal/computed/effect
malformed snapshot
valid pass
blocking fail
invalid target
```

Capture:

```text
primary state
exit code
frameworkSyntax status
diagnostic ID/detail/location
headline
repository reads
```

Use real target project only as read-only reference.

## 23. Read-Path Preservation

Dynamically confirm:

```text
project source reads remain bounded to component + owning modules
no repository glob
no recursive walk
no new file reads from masking
no resolve/spec read
```

Masking must operate on already-loaded source strings.

## 24. Performance

Measure multiple runs if practical:

```text
framework syntax check before/after
verify median before/after
source length
masking time
```

A small linear scan is acceptable. Flag pathological or superlinear behavior.

Test at least one moderately large TypeScript source string to ensure masking remains bounded.

## 25. Focused Re-Verification

After implementation and all tests, perform focused re-verification.

Required matrix:

```text
line comment false-positive
block comment false-positive
single/double string false-positive
template text false-positive
template interpolation detection
inject executable
signal executable
computed executable
effect executable
identifier boundary
location accuracy
Angular version gating
malformed snapshot headline
exit codes 0/1/2/3
bounded reads
```

Decision:

```text
PR 5 corrective patch: PASS / FAIL
FWK-001: RESOLVED / UNRESOLVED
FWK-002: RESOLVED / DEFERRED / UNRESOLVED
EXT-001: RESOLVED / UNRESOLVED
PR 5 may be closed: YES / NO
PR 6 may start: YES / NO
```

## 26. Documentation

Update active owning docs only if behavior contract changes.

Likely:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
```

Document concisely:

- framework syntax check inspects executable source, not comments/literal text;
- bounded supported syntax list includes `effect()` if implemented;
- static check is not a full compiler;
- malformed required ground truth shows `UNVERIFIABLE` and exit 3.

Do not update broad docs unless contradictory.

## 27. Acceptance Criteria

Corrective patch complete only if:

- [ ] FWK-001 reproduced before fix.
- [ ] Comments no longer false-positive.
- [ ] Single/double strings no longer false-positive.
- [ ] Template plain text no longer false-positive.
- [ ] Escaped quotes handled.
- [ ] Comment markers within strings handled.
- [ ] Quotes within comments handled.
- [ ] Executable inject detected.
- [ ] Executable signal detected.
- [ ] Executable computed detected.
- [ ] Executable effect detected or explicitly deferred with evidence.
- [ ] Template interpolation detected for supported form.
- [ ] Identifier boundaries safe.
- [ ] Line/column preserved.
- [ ] Version gating preserved.
- [ ] Malformed snapshot headline says UNVERIFIABLE.
- [ ] Malformed snapshot still exits 3.
- [ ] Pass/fail/invalid headlines unchanged.
- [ ] Diagnostic IDs/trust/severity stable.
- [ ] No new repository reads.
- [ ] Focused tests pass.
- [ ] Relevant suite passes.
- [ ] Full suite passes except pre-existing skips.
- [ ] PR 1–4 and PR 5 core non-regression confirmed.
- [ ] Documentation synchronized if needed.
- [ ] No PR 6 work or unrelated refactor.

## 28. Safety and Git Rules

Do not run:

```text
git reset --hard
git clean -fd
git checkout -- .
git restore .
npm update
auto-format whole repository
```

Do not delete prompt files. Do not modify the real target project.

Do not commit or push. PR 5 must be focused-verified first.

Record initial/final `git status --short`.

## 29. Work Sequence

### Phase 1: Gate and reproduce

- read verification report;
- confirm findings;
- reproduce FWK-001, FWK-002, EXT-001;
- run baseline tests.

### Phase 2: Root-cause note

Before coding, state:

```text
root cause
files to change
masking strategy
template interpolation scope
effect policy
headline correction
tests
```

### Phase 3: Implement lexical masking

- bounded state machine;
- preserve offsets;
- executable template interpolation where supported.

### Phase 4: Update syntax checks

- apply masking;
- add effect detection;
- preserve version gating and diagnostics.

### Phase 5: Correct unverifiable headline

- synchronize primary state, headline, diagnostics, exit 3.

### Phase 6: Tests and E2E

- focused;
- combined;
- full;
- read path;
- performance;
- determinism.

### Phase 7: Focused re-verification

- required matrix;
- closure decision.

### Phase 8: Documentation and scope review

- owning docs only;
- no PR 6 leakage.

## 30. Required Final Response

### Entry Gate

```text
PR 5 verification decision:
FWK-001 confirmed:
FWK-002 confirmed:
EXT-001 confirmed:
Other blockers:
```

### Pre-Fix Reproduction

```text
Comment false-positive:
String false-positive:
Template text false-positive:
Executable effect detected:
Malformed headline:
Malformed exit code:
```

### Root Cause

Include paths, symbols, raw matching behavior, and headline state path.

### Corrective Patch Summary

Describe minimal changes.

### Files Changed

Separate source, tests, docs, and pre-existing prompt files.

### Masking Contract

```text
comments:
single/double strings:
template text:
template interpolation:
escapes:
offset preservation:
known limitations:
```

### Framework Syntax Behavior

```text
inject:
signal:
computed:
effect:
@if/@for/@switch/@defer:
version gating:
```

### Output State Behavior

```text
pass headline/exit:
fail headline/exit:
invalid headline/exit:
unverifiable headline/exit:
malformed snapshot reason:
```

### Validation

List exact commands and outcomes.

### Read and Performance Metrics

```text
project reads before/after:
repository scans:
masking median:
verify median:
```

### Focused Re-Verification Decision

```text
PR 5 corrective patch: PASS / FAIL
FWK-001: RESOLVED / UNRESOLVED
FWK-002: RESOLVED / DEFERRED / UNRESOLVED
EXT-001: RESOLVED / UNRESOLVED
PR 5 may be closed: YES / NO
PR 6 may start: YES / NO
```

### Deferred Findings

Keep deferred:

```text
NAM-001 stacked acronyms
TST-001/TST-002 broader CLI automation
STR-001 modal/card heuristic refinement
PR 6 visual/render verification
full compiler integration
parser metadata expansion
fs-trace redesign
atomic verdict writing
incremental refresh/cache
```

### Documentation Sync

Use `Documentation sync: clear.` or list stale docs.

### Git Status

Include `git status --short`. Do not commit.

## 31. Definition of Done

The task is complete only when framework syntax checks inspect executable source rather than comment/literal text, executable `inject`, `signal`, `computed`, and policy-supported `effect` remain detectable, diagnostic offsets remain accurate, malformed required ground truth displays an explicit UNVERIFIABLE headline with exit 3, all tests pass, bounded reads remain unchanged, and focused re-verification explicitly authorizes or blocks PR 5 closure and PR 6.

Start by reproducing FWK-001, FWK-002, and EXT-001 on temporary fixtures. Do not modify source before all three behaviors are recorded with actual output.
