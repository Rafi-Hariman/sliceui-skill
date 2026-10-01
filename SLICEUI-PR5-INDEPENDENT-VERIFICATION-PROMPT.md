# SliceUI PR 5 Independent Verification Plan

Repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Project target nyata yang hanya boleh digunakan sebagai referensi read-only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Checkpoint baseline resmi:

```text
a6fd181 feat(sliceui): add typed resolve provenance and ambiguity safety
```

Dokumen yang wajib dibaca:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
docs/SLICEUI-PR4-VERIFICATION-REPORT.md
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
skill/SKILL.md
SLICEUI-PR5-VERIFY-RELIABILITY-INDEPENDENT-GATE-SAFETY-PROMPT.md
```

Jika file berada di lokasi berbeda, cari berdasarkan nama. Jangan mengubah prompt atau report sebelumnya.

## 1. Tujuan

Lakukan independent verification terhadap implementasi PR 5 Verify Reliability and Independent Gate Safety.

Verifikasi harus membuktikan atau membantah bahwa:

1. Target component dinormalisasi secara deterministik dari kebab-case, PascalCase, class name, dan file stem.
2. Path traversal, prefix collision, dan ambiguity ditolak dengan aman.
3. Missing, malformed, stale, atau incomplete required ground truth tidak pernah green.
4. Required skip dan optional skip memiliki dampak final-state yang berbeda dan benar.
5. Exit code 0/1/2/3 konsisten dengan primary state.
6. Diagnostics mempunyai stable ID, category, trust, severity, status, location, evidence, dan remediation yang konsisten.
7. Exact Pilar inputs dan outputs divalidasi secara case-sensitive.
8. `uii-table.paginationAlign` dibedakan dari `uii-pagination.paginationALign`.
9. Unknown component inputs/outputs gagal secara tepat.
10. Native attributes, attribute bindings, class bindings, style bindings, directives, dan template refs tidak menjadi false positive.
11. Public component API mengalahkan behavioral deep CSS tanpa melarang visual-only CSS.
12. Invented modal/card/visible wrapper dapat dideteksi dari independent design evidence.
13. Neutral Angular wrappers tidak false-positive.
14. Angular 13-incompatible syntax terdeteksi hanya ketika version evidence mendukung.
15. Table, pagination, action, auth, status, icon, form marker, canvas, dan module checks tetap evidence-backed.
16. Shared-assumption checks dilabeli jujur dan tidak dipresentasikan sebagai independent proof.
17. Verify tetap independen dari `resolved.json`, `spec.md`, dan `agent-context.md`.
18. Verify hanya membaca bounded component/module files dan tidak repository-scan.
19. Diagnostics dan result deterministic pada repeated runs.
20. PR 1 sampai PR 4 tidak regress.
21. PR 5 dapat ditutup sebelum PR 6 dimulai.

Verifikasi ini read-only terhadap implementation source.

## 2. Batas Scope dan Safety

Lakukan inspection, tests, temporary E2E, read tracing, dan tulis report.

Jangan:

- memperbaiki source atau tests;
- mengubah skill atau active docs;
- melakukan refactor;
- memulai PR 6;
- menambah render/browser/screenshot checks;
- mengubah parser;
- mengubah resolve/referee/snapshot architecture;
- menambah dependency;
- menjalankan formatter write mode;
- commit atau push;
- menjalankan writer command pada real target project;
- memakai global/on-PATH `sliceui`;
- menyimpulkan PASS hanya dari test count.

Satu-satunya file baru yang boleh dibuat di repository:

```text
docs/SLICEUI-PR5-VERIFICATION-REPORT.md
```

Semua fixture, logs, traces, generated snapshots, dan outputs harus berada di:

```text
/tmp/sliceui-pr5-verification-<timestamp>/
```

## 3. Klaim Implementasi yang Harus Direproduksi

PR 5 mengklaim:

```text
Name normalization:
- testingcomponent
- TestingcomponentComponent
- testingcomponent.component
- testingcomponent.component.ts
→ target yang sama

Exit contract:
0 pass
1 fail
2 invalid-input
3 unverifiable

Diagnostics:
- 32 checks
- 11 categories
- stable SUI-VERIFY-* IDs
- trust: literal-design / verified-capability / shared-assumption / independent

Read boundary:
- 3 component files
- 4 bounded owning-module files
- 0 repository-wide scans

Full suite:
- 446 pass
- 3 pre-existing skips
- 0 fail
```

Known limitations:

```text
- name normalization does not search another directory
- frameworkSyntax is bounded static detection
- modalWrapper is a non-blocking heuristic warning
- exit 3 uses existing unpaired and snapshot diagnostics
```

Jangan menerima klaim tanpa reproduction.

## 4. Keputusan Wajib

Final report harus menjawab:

```text
Can PR 5 be closed? YES / NO / CONDITIONAL
Can PR 6 start? YES / NO
Name normalization reliable? YES / NO
Ground-truth false-green risks closed? YES / NO
Required/optional skip semantics correct? YES / NO
Exit-code contract correct? YES / NO
Diagnostics stable and actionable? YES / NO / PARTIAL
Exact API validation reliable? YES / NO
Structural checks safe? YES / NO / PARTIAL
Angular version checks safe? YES / NO / PARTIAL
Read path bounded? YES / NO
Verify independent from resolve/spec? YES / NO
PR 1–4 non-regression preserved? YES / NO
```

## 5. Baseline dan Source Integrity

Dari root repository:

```bash
git status --short
git rev-parse HEAD
git log -1 --oneline
node --version
npm --version
```

Pastikan `a6fd181` ada pada history. Kelompokkan working tree:

```text
PR 5 source
PR 5 tests
PR 5 docs/skill
known prompt files
unknown/unrelated
```

Buat temporary root:

```bash
TMP_ROOT="/tmp/sliceui-pr5-verification-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Hash awal minimal:

```bash
shasum -a 256 \
  src/lib/component-name.mjs \
  src/lib/diagnostics.mjs \
  src/commands/verify.mjs \
  src/framework/angular/verify.mjs \
  test/verify.test.mjs \
  test/verify-root.test.mjs \
  skill/SKILL.md
```

Tambahkan changed files aktual lainnya.

Catat real target status read-only:

```bash
cd /Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
git status --short
```

Real target dan `.sliceui`-nya tidak boleh berubah.

## 6. Static Architecture Review

Audit minimal:

```text
src/lib/component-name.mjs
src/lib/diagnostics.mjs
src/commands/verify.mjs
src/framework/angular/verify.mjs
src/lib/snapshot.mjs
src/lib/pilar-loader.mjs
src/framework/angular/pilar-catalog.mjs
src/framework/angular/pilar-typecheck.mjs
src/framework/angular/uii-slice-policy.mjs
src/lib/transcript-schema.mjs
skill/SKILL.md
test/verify.test.mjs
test/verify-root.test.mjs
```

Gunakan:

```bash
rg -n "normalize|component-name|primaryState|decorateCheck|SUI-VERIFY|hasGroundTruth|unverifiable|invalid-input|exitCode|pilarBindings|paginationAlign|paginationALign|modalWrapper|frameworkSyntax|shared-assumption|literal-design|verified-capability|readOwningModules" \
  src test skill docs README.md
```

Buat call graph:

```text
CLI verify
→ target normalization
→ component read
→ ground-truth pairing
→ snapshot load
→ framework verify
→ check decoration
→ primary-state aggregation
→ human output
→ exit code
```

Tandai setiap filesystem operation sebagai:

```text
bounded .sliceui read
component read
bounded owning-module read
ancestor exists probe
repository traversal
glob
write
child process
```

## 7. Check Inventory Review

Reconstruct seluruh 32 checks dari source, bukan report implementasi.

Untuk setiap check tulis:

```text
check name
stable ID
category
trust source
severity
required/optional
evidence input
skip condition
fail condition
final-state impact
```

Pastikan:

- IDs unik dan stable;
- category vocabulary bounded;
- trust classification benar;
- shared-assumption check tidak salah diberi label independent;
- literal-design check berasal dari transcript/XML;
- verified-capability check berasal dari machine catalog/policy;
- generated component hanya subject, bukan ground truth;
- required/optional ownership eksplisit.

## 8. Name Normalization Matrix

Uji actual CLI dan helper terhadap:

```text
testingcomponent
TestingcomponentComponent
testingcomponent.component
testingcomponent.component.ts
billing-history
BillingHistoryComponent
billing-history.component
billing-history.component.ts
HTTPClientComponent
URLParserComponent
XMLHTTPServiceComponent
```

Expected:

- equivalent names resolve file set yang sama;
- acronym conversion deterministic;
- already-kebab-case preserved;
- suffix stripping bounded;
- no arbitrary prefix match.

Negative cases:

```text
../target
..\\target
foo/bar
foo\\bar
absolute path
empty name
Component
.component.ts
billing
billing-history-extra
```

Required:

- traversal/separators invalid-input exit 2;
- no match exit 2;
- exact target preferred;
- multiple exact-equivalent matches produce ambiguity/non-green;
- no first-pick;
- path with spaces works;
- target cannot escape passed directory.

## 9. Ground-Truth State Matrix

Build isolated scenarios:

```text
valid paired transcript + XML + conventions + project context
missing conventions
missing project-context
missing transcript
missing raw XML
malformed conventions
malformed project-context
unknown schema
transcript/XML unpaired
stale metadata if supported
present-but-empty valid snapshot
```

For each record:

```text
primary state
exit code
required checks run/skipped
diagnostics
success wording present yes/no
```

No required-ground-truth absence may exit 0.

## 10. Required versus Optional Skip

Identify at least:

- one required check that can skip;
- one optional check that can skip.

Verify:

```text
required skipped
→ final state unverifiable or documented non-green
→ exit 3 or established non-green code
→ reason and impact visible

optional skipped
→ pass may remain if all required checks ran
→ reason visible
→ not counted as silent success
```

Check aggregate output, not only internal helper result.

## 11. Exit-Code Contract

Dynamically reproduce:

```text
valid pass              → 0
blocking correctness    → 1
invalid target/input    → 2
unverifiable ground truth→ 3
warnings only           → 0 only when verification complete
```

Ensure human headline, primary state, and process exit code agree.

If timing/runs log exists, verify recorded exit code agrees.

## 12. Diagnostic Contract

For representative checks inspect:

```text
id
category
trust
severity
status
detail/message
file
line/column when available
evidence
remediation
```

Required:

- stable ID across repeated runs;
- no duplicate IDs for different semantics unless check instances are intentionally repeated;
- relative path preferred;
- no large source bodies;
- no private absolute path leakage in normal human output;
- remediation exact and not speculative;
- severity consistent with final-state impact.

Run identical scenario at least three times and deep-compare normalized diagnostics and ordering.

## 13. Exact Pilar API Validation

Use controlled templates and machine catalog.

### Valid table input

```html
<uii-table [paginationAlign]="'right'"></uii-table>
```

Expected valid.

### Wrong table case

```html
<uii-table [paginationALign]="'right'"></uii-table>
```

Expected blocking diagnostic with `paginationAlign` remediation.

### Valid standalone pagination

```html
<uii-pagination [paginationALign]="'right'"></uii-pagination>
```

Expected valid if catalog confirms.

### Wrong standalone case

```html
<uii-pagination [paginationAlign]="'right'"></uii-pagination>
```

Expected blocking diagnostic with `paginationALign` remediation.

### Unknown input

Recognized Pilar selector + fake input must fail.

### Unknown output

Recognized Pilar selector + fake output must fail.

### Known output

Known event binding must pass.

### Unknown selector

Do not pretend API is known. Behavior must be documented: skip/degraded/unknown selector, not arbitrary input failure.

Prove verify uses catalog directly and does not read `resolved.json`.

## 14. Angular Binding Parser Matrix

Test:

```html
[knownInput]
(knownOutput)
[(twoWay)]
[attr.aria-label]
[class.active]
[style.width.px]
*ngIf
*ngFor
#templateRef
id
class
aria-label
data-test
```

Verify:

- component inputs/outputs checked only where appropriate;
- native attributes not false-positive;
- attr/class/style bindings not treated as component inputs;
- structural directives not treated as outputs;
- malformed binding produces precise diagnostic or safe degraded result;
- multi-line template and whitespace do not evade checks.

## 15. Public API Versus Behavioral CSS

Controlled scenarios:

### Behavioral override conflict

- design evidence requires right pagination alignment;
- public input exists;
- template omits public input;
- SCSS forces alignment via behavioral `::ng-deep` selector.

Expected diagnostic identifying:

```text
behavioral CSS
available public input
component selector
remediation
trust source verified-capability + literal-design
```

### Public API used correctly

No conflict diagnostic.

### Visual-only deep CSS

Examples such as border color, hover, radius, internal icon sizing should not fail solely because `::ng-deep` exists.

### CSS without relevant design evidence

Do not invent a required component binding solely from catalog availability.

## 16. Modal/Card/Wrapper Heuristic

Test:

```text
role="dialog" without modal evidence
modal-* class without modal evidence
card class with visible border/background/padding without card evidence
neutral div
ng-container
implementation-only wrapper without visual style
genuine modal design evidence
```

Verify:

- unsupported semantic wrapper produces warning as designed;
- warning ID/category/trust correct;
- neutral wrappers do not warn;
- genuine modal evidence suppresses warning;
- warning-only result may exit 0 but output must not hide warning;
- heuristic never becomes blocking unless documented;
- no resolver semantic role is used as ground truth.

## 17. Framework Syntax Matrix

With Angular 13 evidence, test separately:

```text
@if
@for
@switch
@defer
inject()
standalone: true
signal(
computed(
effect(
```

Verify:

- each unsupported construct is detected where intended;
- location/detail precise;
- comments and string literals do not create obvious false positives;
- Angular version absent → framework check skips/degrades according to policy;
- newer supported version → no Angular-13 diagnostic;
- no full compiler claim is made.

## 18. Table and Pagination Checks

Use design fixtures with and without evidence for:

```text
searchOptions
limitOptions
paginationOptions
paginationAlign
footerInfo
checkboxColumn
actionColumn
```

Verify:

- required only when transcript/XML shows feature;
- exact component API names;
- no sample-code assumptions;
- standalone and embedded pagination distinguished;
- missing optional feature does not fail;
- default-sensitive behavior reported where catalog includes default;
- checks remain independent from PR 4 behaviorBindings.

## 19. Action and Auth Wiring

Controlled scenarios:

```text
action column present + auth requirement satisfied
action present + auth missing
action absent + auth absent
action handler declared but not wired
template event wired but handler missing
invented permission property
```

Verify exact policy source and no false requirement when action absent.

## 20. Status and Icon Independence

Static audit and dynamic proof:

- no `resolved.json` read;
- no `resolveTranscript` call;
- no `spec.md` read.

Status checks:

- exact visible text mismatch blocks;
- unknown used class fails if registry exists;
- color alone does not establish semantic expected class;
- ambiguous resolver candidates irrelevant.

Icon checks:

- deterministic transcript metadata mismatch diagnosed;
- unknown metadata does not invent expected icon;
- button label alone does not determine icon;
- generated icon class existence uses registry/capability evidence.

## 21. Required Marker and Form Checks

Test:

```text
explicit required asterisk present/missing
no required marker in design
label and control presence
placeholder preservation
required/disabled/read-only evidence
```

Ensure no invented form policy.

## 22. Canvas and Layout Safety

Test component where design canvas x/y is non-zero but internal root padding is zero.

Expected:

- copying x/y into component padding produces diagnostic;
- legitimate internal padding passes;
- child gap and root padding not conflated;
- fixed width/height contradiction remains evidence-based;
- check uses transcript/XML, not spec.

## 23. Module Read Boundary

Instrument verify dynamically.

Expected reads:

```text
component .ts/.html/.scss or .css
bounded owning component/module/routing/shared-module chain
.sliceui files
```

Prove absence of:

```text
repository glob
recursive source walk
all components scan
unrelated sample reads
deep referee invocation
detect/init invocation
```

Inspect the reported 41 ancestor `existsSync` probes. Confirm they are bounded root discovery and do not enumerate/read source.

Test symlink/path edge if practical. Ensure bounded traversal cannot escape intended project root unexpectedly.

## 24. Shared-Assumption Labels

Audit checks using:

```text
classVocabulary
loadedClassRegistry
ngDeepCorpus
scssCoverage
conventions
```

Verify diagnostic/result carries `shared-assumption`, not independent/literal-design.

Check that final output does not imply these checks independently prove design fidelity.

## 25. Human Output and Optional JSON

If no JSON mode exists, confirm no undocumented JSON claim.

For human output verify:

- primary state visible;
- exit meaning clear;
- errors/warnings/skips distinguished;
- required skipped reasons visible;
- no clean-success wording when state non-green;
- diagnostic IDs visible or otherwise accessible as documented;
- no giant source dumps.

## 26. Determinism

Run each representative scenario at least three times.

Normalize only timing/timestamps.

Assert stable:

```text
primary state
exit code
check ordering
diagnostic IDs
categories
trust
severity
status
details/evidence ordering
```

## 27. Test Quality Review

Audit PR 5 tests for real coverage.

Required review:

```text
PascalCase and acronym names
path traversal
ambiguity
no match
all exit codes
required/optional skips
wrong-case table and pagination
unknown input/output
native attributes
binding syntax distinctions
public API/CSS conflict
visual CSS exception
modal/card positive and negative
all Angular constructs
module bounded reads
determinism
PR 1–4 regression
```

Flag tests that:

- only test helper, not CLI process;
- only assert substring;
- do not assert exit code;
- use impossible binding/catalog shape;
- fail to test false positives;
- treat warning as blocking accidentally;
- never exercise required skip aggregation.

## 28. Re-run Tests

Focused:

```bash
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
node --test test/snapshot.test.mjs
node --test test/pilar-catalog.test.mjs
```

Relevant combined:

```bash
node --test \
  test/verify.test.mjs \
  test/verify-root.test.mjs \
  test/snapshot.test.mjs \
  test/init.test.mjs \
  test/detect.test.mjs \
  test/transcript-schema.test.mjs \
  test/pilar-catalog.test.mjs \
  test/conventions.test.mjs \
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

Run `node --check` for every changed/new source file.

Record exact pass/fail/skip, warning, and duration.

Do not fix failures.

## 29. Temporary E2E

Use repository entrypoint explicitly:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs verify <dir> [name]
```

Never use global binary.

Run scenario matrix covering:

```text
valid pass
blocking fail
invalid target
unverifiable snapshot
PascalCase target
ambiguous target
wrong-case input
unknown input/output
native binding controls
public API/CSS conflict
modal warning
Angular syntax failures
auth mismatch
required skip
optional skip
```

Capture stdout, stderr, exit code, and read trace.

## 30. Performance

Measure multiple runs and report median:

```text
verify elapsed before/after if baseline reproducible
current median
project files read
.sliceui files read
bytes read
check count
human output size
```

Correctness is primary. Flag material latency or read-path expansion.

## 31. PR 1–4 Non-Regression

### PR 1

- compact agent context remains under budget;
- no full conventions instruction.

### PR 2

- project-context dedup intact;
- missing conventions returns null;
- empty-ground-truth verify remains non-green.

### PR 3

- hot referee remains zero project-source reads;
- no hidden deep scan.

### PR 4

- resolve schema/provenance intact;
- TAX-001 multi-candidate ambiguity remains safe;
- AUT-001 capability/recommendation layering intact;
- verify remains independent from resolver artifacts.

## 32. Documentation and Skill Review

Audit:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
docs/project-docs/foundation/status.md
skill/SKILL.md
README.md
docs/SLICEUI-OVERVIEW.md
```

Verify:

- exit code contract accurate;
- primary states accurate;
- name normalization described accurately;
- diagnostic/trust model accurate;
- required/optional skip semantics documented;
- exact API checks not overclaimed;
- modal warning described as heuristic/non-blocking;
- Angular checks described as bounded static checks;
- read boundary documented;
- verify independence from resolve/spec explicit;
- no visual/render claim enters PR 5 docs.

Do not modify docs. Report contradictions.

## 33. Diff and Scope Audit

Review PR 5 diff relative to `a6fd181`.

Classify hunks:

```text
required PR 5
required tests
required docs/skill
unrelated
PR 6 leakage
pre-existing prompt files
```

Check for:

- rendering/screenshot code;
- new dependencies;
- parser rewrite;
- resolve/referee coupling;
- repository scan;
- generated-code changes;
- real target mutation;
- accidental prompt staging.

## 34. PASS / CONDITIONAL PASS / FAIL

PR 5 is `PASS` only if:

- all target name forms normalize correctly;
- ambiguity and traversal are safe;
- required missing ground truth is non-green;
- required/optional skip aggregation is correct;
- exit codes and primary states agree;
- diagnostics stable and actionable;
- exact API/casing checks pass all positive/negative cases;
- binding parser avoids native/directive false positives;
- public API/CSS precedence works;
- visual CSS remains allowed;
- structural heuristic has acceptable false-positive controls;
- Angular checks are version-gated and bounded;
- status/icon checks remain independent;
- module read path bounded;
- no repository scan;
- PR 1–4 healthy;
- tests and full suite pass;
- docs match behavior.

PR 5 may be `CONDITIONAL PASS` if:

- core reliability and false-green guarantees pass;
- one non-blocking limitation remains, such as heuristic modal warning or bounded syntax coverage;
- limitation is accurately documented;
- no blocking correctness or false-green defect exists.

PR 5 is `FAIL` if:

- required skipped checks can exit 0;
- invalid/malformed ground truth can green;
- target normalization chooses ambiguous first match;
- wrong-case or unknown Pilar input passes;
- native attributes false-positive materially;
- blocking failure exits 0;
- warning causes undocumented blocking;
- verify depends on resolved/spec;
- repository-wide scan occurs;
- PR 1–4 regress;
- docs overclaim visual/compiler guarantees.

## 35. Finding Format

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
NAM name normalization
GRT ground truth
SKP skip semantics
EXT exit contract
DIA diagnostics
API component API
BND binding parser
CSS API/CSS precedence
STR structural wrappers
FWK framework syntax
TBL table/pagination
AUT auth/action
STA status
ICN icon
FRM form/required
LAY canvas/layout
MOD module boundary
TRU trust labels
DET determinism
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
Blocks PR 5 closure: yes/no
```

## 36. Output Report

Create only:

```text
docs/SLICEUI-PR5-VERIFICATION-REPORT.md
```

Required sections:

```markdown
# SliceUI PR 5 Verification Report

## 1. Executive Decision
## 2. Scope and Environment
## 3. Git and Source Integrity Baseline
## 4. Architecture and Check Inventory
## 5. Name Normalization
## 6. Ground-Truth State Matrix
## 7. Required and Optional Skip Semantics
## 8. Exit-Code Contract
## 9. Diagnostic Contract and Determinism
## 10. Pilar API Validation
## 11. Angular Binding Parsing
## 12. Public API Versus CSS
## 13. Modal/Card/Wrapper Assessment
## 14. Framework Syntax Assessment
## 15. Table and Pagination Checks
## 16. Action and Auth Wiring
## 17. Status and Icon Independence
## 18. Required Marker and Form Checks
## 19. Canvas and Layout Safety
## 20. Module and Read Boundary
## 21. Shared-Assumption Trust Labels
## 22. Test Quality Review
## 23. Tests Re-run
## 24. E2E Scenario Matrix
## 25. Performance
## 26. PR 1–4 Non-Regression
## 27. Documentation and Skill Assessment
## 28. Diff and Scope Review
## 29. Findings by Severity
## 30. Acceptance Checklist
## 31. Required Corrections Before PR 6
## 32. Deferred Items
## 33. Final Recommendation
## Appendix A: Commands Executed
## Appendix B: Diagnostic Scenario Raw Results
## Appendix C: Read Trace Results
## Appendix D: Check Inventory
## Appendix E: Source Hashes and Git Status
```

## 37. End-of-Task Validation

Before finish:

1. Re-run source hashes and compare start/end.
2. Run `git status --short` in SliceUI.
3. Run `git status --short` in real target project.
4. Confirm source/tests/docs/skill unchanged.
5. Confirm only report file was added.
6. Confirm no stray `.sliceui` in SliceUI repository.
7. Confirm temporary artifacts remain outside repository.
8. Confirm no secrets or source bodies leaked.
9. Confirm bounded-read claim uses dynamic evidence.
10. Confirm PASS is not based only on existing tests.
11. Do not commit or push.

## 38. Required Final Response

### Decision

```text
PR 5: PASS / CONDITIONAL PASS / FAIL
PR 6 may start: YES / NO
```

### Core Guarantees

```text
Name normalization reliable:
Ground-truth false-green closed:
Required/optional skip semantics correct:
Exit codes correct:
Diagnostics stable:
Exact API validation reliable:
Binding parser safe:
Independent checks preserved:
Repository reads bounded:
Verify independent from resolve/spec:
PR 1–4 non-regression:
```

### Key Evidence

Summarize dynamic scenario matrix, exit codes, diagnostics, API checks, read trace, and suite results.

### Blocking Findings

List blockers or `None`.

### Non-Blocking Findings

List material limitations.

### Report

```text
docs/SLICEUI-PR5-VERIFICATION-REPORT.md
```

### Validation

List principal commands and results.

### Git Status

Show SliceUI and real target statuses.

Do not implement corrections. Wait for next instruction.

## 39. Final Instruction

Begin with hashes, check inventory, and static trust review. Then run controlled CLI scenarios that exercise every exit state, normalization form, exact API case, required/optional skip, structural heuristic, framework syntax check, and read boundary. Use the real target only as read-only reference. The task is complete only when it provides a trustworthy decision on whether PR 5 may close and PR 6 may begin.
