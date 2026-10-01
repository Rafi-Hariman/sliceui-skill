# SliceUI PR 5 Implementation Plan: Verify Reliability and Independent Gate Safety

Repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Project target nyata yang hanya boleh digunakan sebagai source of evidence secara read-only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Checkpoint baseline resmi:

```text
a6fd181 feat(sliceui): add typed resolve provenance and ambiguity safety
```

Dokumen yang wajib dibaca sebelum implementasi:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
docs/SLICEUI-PR4-VERIFICATION-REPORT.md
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
```

Prompt PR sebelumnya boleh dibaca sebagai secondary context, tetapi source code, active documentation, dan verification reports tetap menjadi authority utama.

## 1. Mandatory Entry Gate

Sebelum mengubah source:

1. Pastikan checkpoint `a6fd181` berada pada current history.
2. Pastikan PR 4 telah dinyatakan selesai setelah corrective patch `TAX-001` dan `AUT-001`.
3. Pastikan keputusan terakhir menyatakan:

```text
PR 4 official status: COMPLETE
PR 5 may start: YES
```

4. Jalankan baseline tests terdekat dengan verify, snapshot, transcript, conventions, Pilar catalog, referee, resolve, dan spec.
5. Catat `git status --short` dan klasifikasikan seluruh perubahan/untracked files.
6. Jika ada unknown modification selain prompt files yang sudah diketahui, hentikan dan laporkan.
7. Jangan mengubah source sebelum check inventory dan trust model selesai dianalisis.

Catat entry-gate evidence pada final response.

## 2. Masalah yang Harus Diselesaikan

PR 5 berfokus pada reliability post-generation gate.

Audit sebelumnya menemukan atau mengindikasikan risiko berikut:

```text
1. PascalCase class name tidak dinormalisasi ke kebab-case file stem.
2. Missing or malformed ground truth pernah menghasilkan false green sebelum PR 2 corrective patch.
3. Sebagian checks memakai corpus yang sama dengan generator, sehingga shared wrong assumption dapat lolos.
4. Unknown Angular/Pilar inputs dapat tidak dikenali secara cukup spesifik.
5. Generated structure dapat menambah wrapper/card/modal semantics yang tidak ada pada design.
6. Behavioral CSS dapat menggantikan public component API.
7. Required markers, table options, action/auth wiring, status taxonomy, dan layout dapat diverifikasi dengan evidence yang kualitasnya berbeda-beda.
8. Diagnostics perlu membedakan fail, skip, unverifiable, warning, dan framework/setup errors secara konsisten.
9. Exit code harus merepresentasikan trust state secara benar.
10. Verify harus tetap independen dari resolved.json dan spec.md.
```

PR 5 harus memperkuat gate tanpa mengubahnya menjadi visual renderer atau repository-wide scanner.

## 3. Tujuan PR 5

Implementasikan Verify Reliability and Independent Gate Safety dengan perubahan minimal dan backward-compatible.

PR ini harus menghasilkan:

1. Deterministic target-name normalization.
2. Explicit ground-truth state and no false green.
3. Compiler-like diagnostics dengan stable IDs.
4. Exact public component API validation.
5. Unknown input/output detection untuk verified catalog components.
6. Public API precedence checks terhadap behavioral CSS.
7. Structural invention checks terhadap wrapper/card/modal semantics.
8. Independent design/XML-derived checks tetap menjadi primary signal.
9. Shared-corpus checks dilabeli sesuai trust level.
10. Table, pagination, search, checkbox, action, footer, and auth wiring checks yang evidence-backed.
11. Angular-version compatibility checks yang bounded.
12. Correct exit-code semantics.
13. Bounded project reads, tanpa repository-wide scan.
14. Verify tetap independen dari resolve/spec.
15. PR 1–4 tidak regress.
16. Dokumentasi trust boundary dan diagnostic contract sinkron.

## 4. Scope yang Diizinkan

PR 5 boleh mengubah:

```text
src/commands/verify.mjs
src/framework/angular/verify.mjs
src/lib/snapshot.mjs hanya jika ground-truth contract membutuhkan local compatibility handling
src/lib/pilar-loader.mjs atau catalog query helper bila exact API lookup perlu diekspos
src/framework/angular/pilar-typecheck.mjs hanya jika existing machine API validation dapat direuse
src/framework/angular/uii-slice-policy.mjs bila verify policy ownership memang berada di sana
src/lib/transcript-schema.mjs bila bounded evidence helper diperlukan
src/lib/diagnostics.mjs atau helper baru yang kecil bila repository belum memiliki diagnostic owner
skill/SKILL.md
test/verify.test.mjs
test/verify-root.test.mjs
test fixtures minimal
active documentation yang memiliki ownership atas verify contract
```

Buat helper kecil baru bila diperlukan, misalnya conceptual:

```text
verify-diagnostics.mjs
component-name.mjs
angular-template-bindings.mjs
```

Jangan membuat abstraction besar bila logic dapat tetap terfokus.

## 5. Di Luar Scope

Jangan mengimplementasikan:

- PR 6 rendered visual fidelity;
- browser/headless render comparison;
- screenshot diff;
- Playwright/Puppeteer dependency;
- Angular build orchestration baru yang berat;
- full TypeScript compiler migration;
- FIGML parser rewrite;
- resolve provenance changes;
- agent-context redesign;
- referee fingerprint changes;
- snapshot ownership changes;
- repository-wide verify scan;
- source indexing baru;
- taxonomy registry baru;
- runtime API/service validation;
- network calls;
- TypeScript or Python rewrite;
- dependency baru tanpa kebutuhan mutlak;
- unrelated cleanup/refactor;
- commit atau push sebelum independent verification.

Deferred findings seperti atomic verdict writing, cold-path scan reuse, and fs-trace redesign tetap di luar scope.

## 6. Verify Trust Model

Verify harus membedakan empat jenis evidence:

```text
A. Independent design evidence
   raw XML, transcript facts, geometry, visible text, node relationships

B. Verified project capability evidence
   exact Pilar selector/input/output, framework version, slice policy

C. Shared project convention evidence
   classVocabulary, ngDeepCorpus, loadedClassRegistry, approved recipes

D. Generated implementation evidence
   component .ts/.html/.scss and owning module files
```

Trust rules:

1. A dan B dapat menghasilkan blocking correctness checks.
2. C dapat menghasilkan blocking check hanya jika ownership/provenance masih valid dan check tidak sekadar mengulang generator instruction tanpa independent evidence.
3. D adalah subject yang diverifikasi, bukan ground truth.
4. `resolved.json`, `spec.md`, dan `agent-context.md` bukan verify ground truth.
5. Missing A/B yang diperlukan membuat result unverifiable atau degraded, bukan green.
6. Shared-corpus check harus dilabeli `shared-assumption` atau equivalent bila bukan independent cross-check.

## 7. Verify Result States

Gunakan explicit result states, bukan hanya boolean pass.

Conceptual states:

```text
pass
fail
unverifiable
invalid-input
degraded
warning
skip
```

Final command status harus memiliki one primary state.

Suggested semantics:

```text
pass         → all required checks executed, no blocking failures
fail         → at least one blocking correctness failure
unverifiable → required ground truth missing/stale/incomplete
invalid-input→ component target or command input invalid
```

`degraded`, `warning`, dan `skip` boleh menjadi check-level status, tetapi jangan membuat command terlihat green bila required checks tidak berjalan.

## 8. Exit-Code Contract

Audit current exit codes sebelum perubahan.

Gunakan existing project convention bila ada. Jika perlu, document deterministic mapping, misalnya:

```text
0 = verified pass
1 = verified fail
2 = invalid command input / target not found
3 = unverifiable / missing required ground truth
```

Jangan mengubah exit codes secara breaking tanpa compatibility analysis.

Wajib:

- all required checks skipped tidak boleh exit 0;
- target not found tidak boleh exit 0;
- malformed snapshot tidak boleh exit 0;
- unknown future schema tidak boleh exit 0;
- warnings-only dapat exit 0 jika verification tetap complete;
- JSON and human output report the same primary state.

## 9. Target Name Normalization

Perbaiki known PascalCase normalization gap.

Inputs berikut harus dapat merujuk component target yang sama bila unambiguous:

```text
testingcomponent
TestingcomponentComponent
testingcomponent.component
testingcomponent.component.ts
```

Untuk kebab-case multiword:

```text
billing-history
BillingHistoryComponent
billing-history.component
billing-history.component.ts
```

Required policy:

1. Strip known suffixes deterministically.
2. Convert Angular class name PascalCase to kebab-case.
3. Preserve already-kebab-case stem.
4. Reject path traversal.
5. Do not search entire repository.
6. Resolve only within explicitly provided component directory or bounded target root.
7. If multiple matches remain, return ambiguity, not first pick.
8. Do not accept arbitrary prefix matches.

Create one shared helper if referee or other command already has correct normalization. Reuse rather than duplicate.

## 10. Component Read Boundary

Verify may read:

```text
component .ts
component .html
component .scss/.css
bounded owning module chain
.sliceui canonical snapshot
paired transcript/raw XML
tool-owned Pilar catalog/policy
```

Verify must not:

```text
scan all project components
scan all HTML/SCSS/CSS
search repository-wide by selector
read unrelated source examples
invoke detect/init automatically
invoke referee deep automatically
```

Owning module traversal must remain bounded and documented.

## 11. Diagnostic Contract

Every check must emit a stable diagnostic record.

Conceptual shape:

```json
{
  "id": "SUI-VERIFY-API-001",
  "category": "component-api",
  "severity": "error",
  "status": "fail",
  "message": "Unknown input [paginationALign] on uii-table.",
  "file": "testingcomponent.component.html",
  "line": 12,
  "column": 5,
  "evidence": [],
  "remediation": "Use [paginationAlign] for uii-table."
}
```

Required fields where available:

```text
stable id
category
severity
status
message
relative file
line/column or bounded location
evidence summary
trust source
remediation
```

Do not include large source snippets or sensitive absolute paths.

## 12. Diagnostic Categories

Use bounded categories such as:

```text
ground-truth
target
framework-syntax
component-api
template-structure
design-fidelity
layout
style
shared-convention
module-wiring
data-model
auth-wiring
accessibility
```

Do not create a different category for every check.

## 13. Severity Policy

Suggested policy:

```text
error   → blocking correctness or unverifiable trust failure
warning → material risk but verification can complete
info    → non-blocking recommendation
```

Examples:

```text
unknown verified component input     → error
missing required visible text         → error
invented modal wrapper                → error or warning based on evidence strength
shared-corpus style mismatch only     → warning/error per independent evidence
unused optional output                → info
```

Document every severity change from current behavior.

## 14. Ground-Truth Safety

Preserve PR 2 corrective invariant:

> No required ground truth can never be green.

Test fully:

```text
missing conventions
missing project-context
missing transcript
missing raw XML
malformed canonical JSON
unknown schema
paired transcript/XML mismatch
stale artifact metadata
```

For each check, determine whether it is:

```text
required for all verification
required only for a check family
optional
```

Do not make the entire command unverifiable when only an optional check lacks evidence. Conversely, do not report full pass if required design/project checks did not run.

## 15. Exact Component API Validation

Use machine catalog as authority.

For every recognized Pilar component selector in generated HTML:

1. Parse bound inputs.
2. Parse outputs/events.
3. Parse static attributes relevant to API.
4. Compare exact case-sensitive names.
5. Report unknown inputs/outputs.
6. Preserve Angular binding syntax distinctions.
7. Do not treat arbitrary native attributes as component inputs.
8. Do not infer undocumented inputs from samples.

Required test distinction:

```text
uii-table.paginationAlign
uii-pagination.paginationALign
```

Known valid binding must pass. Wrong casing, wrong component API, or misspelling must fail with exact remediation.

## 16. Angular Template Binding Parsing

Do not use naïve substring matching where it creates false positives.

Support bounded syntax needed by project:

```text
[input]
(input)
[(twoWay)]
#templateRef
*ngIf
*ngFor
[attr.x]
[class.x]
[style.x]
plain attributes
```

Distinguish:

```text
component input
DOM property
attribute binding
class/style binding
structural directive
output event
```

If an existing Angular parser/compiler API is already available in dependencies, reuse it only if low-risk. Otherwise implement a bounded tokenizer/parser sufficient for project syntax and document limitations.

Do not add heavyweight dependencies without approval.

## 17. Public API Versus Behavioral CSS

Use PR 4 provenance/policy as guidance, but verify independently from generated output and catalog.

Examples:

```text
uii-table has paginationAlign
+ generated SCSS uses deep selector to force footer alignment
→ fail/warn according to policy
```

Required behavior:

- exact public input available and design requires behavior;
- generated template must use public input;
- conflicting behavioral `::ng-deep` should be rejected;
- visual-only deep style may remain;
- check should identify selector/property and available API;
- do not depend on `resolved.json` recommendation.

## 18. Structural Invention Checks

Verify generated structure against transcript/raw design facts.

Detect unsupported additions such as:

```text
modal wrapper
card wrapper
extra section container
invented header/footer shell
phantom panel background
duplicated toolbar
invented empty-state block
```

Rules:

1. Use design/transcript evidence, not resolver semantic role.
2. Wrapper detection must account for implementation-only neutral wrappers needed by Angular.
3. Do not fail every extra `<div>`.
4. Focus on wrappers with visible/layout semantics:

```text
background
border
radius
padding
fixed dimensions
modal classes/roles
card classes
header/footer styling
```

5. Diagnostic must state which visual/semantic wrapper lacks design evidence.
6. Modal semantics require backdrop/dialog/close/modal evidence.
7. Existing checks such as phantom wrapper must be audited and strengthened rather than duplicated.

## 19. Layout and Canvas Coordinate Safety

Preserve distinction:

```text
canvas position
component-internal padding
child spacing
```

Verify:

- root does not reproduce canvas x/y as internal padding;
- spacing follows design relationships;
- invented fixed width/height is flagged when contradicting responsive design;
- pagination alignment derives from design evidence;
- table toolbar grouping remains evidence-based;
- layout check does not depend on `spec.md`.

## 20. Table and Pagination Checks

For table designs, independently derive expected features from transcript/XML.

Potential checks:

```text
searchOptions
limitOptions
paginationOptions
paginationAlign
footerInfo
checkboxColumn
actionColumn
column definitions
row model
empty state if explicitly designed
```

Rules:

- only require feature when design evidence exists;
- exact API names from catalog;
- no assumption from sample code;
- distinguish standalone pagination from table pagination;
- wrong default must be surfaced when public input exists;
- missing optional feature must not fail.

## 21. Action and Auth Wiring

Verify action controls only when design and project policy require them.

Checks may include:

```text
actionColumn enabled/disabled
row.actions shape
auth.canUpdate or project-equivalent requirement
edit/delete/view handler presence
output event wiring
```

Rules:

- exact auth field from verified policy/profile;
- no invented permission name;
- no handler required when action not present;
- handler declaration and template wiring consistency;
- no dead subscription infrastructure;
- no invented endpoint or service.

## 22. Status and Taxonomy Verification

PR 4 now exposes hints safely. Verify must remain independent.

Use design facts plus verified project sources.

Rules:

- exact visible status text must be preserved;
- color-only mapping is not semantic proof;
- generated class must exist in loaded registry/vocabulary if used;
- class semantic correspondence may be warning/shared-assumption unless independent taxonomy source exists;
- ambiguous resolver candidates must not influence verify;
- verify should not read resolved candidates;
- wrong visible text remains blocking;
- unknown class remains error if registry available.

## 23. Icon Verification

Use raw/transcript icon metadata where available, not resolver output.

Check:

- explicit glyph/variant/description mapping where deterministic;
- visible icon presence when required;
- generated icon class exists;
- metadata conflict with generated icon;
- unknown metadata may degrade rather than invent expected icon;
- button label alone must not determine expected icon.

Do not copy PR 4 resolver output into verify ground truth.

## 24. Required Marker and Form Checks

Verify required markers only when design explicitly shows them or policy requires them.

Checks:

```text
required asterisk presence
label-control association where available
input/select presence
placeholder/text preservation
required/disabled/read-only state
```

Do not invent form validation rules absent from the design/project contract.

## 25. Angular Version Compatibility

Use project framework version from canonical snapshot.

For Angular 13 fixture, detect bounded incompatible syntax:

```text
standalone component metadata when project requires NgModule
inject() if unsupported by project policy
@if
@for
modern control-flow blocks
signals APIs when unavailable
```

Do not attempt full TypeScript compilation in this PR unless existing tooling already provides it cheaply. Static diagnostics should be precise and bounded.

## 26. Module Wiring

Retain bounded owning module traversal.

Verify where applicable:

```text
component declaration
required module imports
routing module relationship
shared module placement
selector/class consistency
```

Do not repository-scan all modules.

Missing owning module context may yield degraded/unverifiable for module-specific checks, not necessarily fail all design checks.

## 27. Shared-Assumption Check Labeling

Audit checks that compare generated output to conventions data used by generation.

Examples:

```text
scssCoverage
classVocabulary
loadedClassRegistry
ngDeepCorpus reuse
```

For every such check, label trust nature:

```text
independent
shared-assumption
verified-capability
literal-design
```

A shared-assumption check may still catch drift, but do not present it as independent design fidelity proof.

Human and JSON outputs should expose trust source where useful.

## 28. Skip Semantics

Every skipped check must include:

```text
reason
required/optional status
missing evidence
impact on final trust state
```

Forbidden:

```text
25 skip
0 fail
exit 0
```

without explaining whether required checks were skipped.

Implement command aggregation:

```text
required skipped → unverifiable/degraded according to policy
optional skipped → may still pass
```

## 29. JSON Report Contract

If verify supports JSON output, ensure it contains:

```text
schemaVersion
primaryState
exitCode
summary counts
checks[]
diagnostics[]
groundTruth state
trust sources
files inspected
```

Human output and JSON output must agree.

If there is no JSON mode existing, do not create a broad reporting subsystem solely for PR 5. Keep diagnostic objects structured internally and preserve current output contract.

## 30. Determinism

Same inputs must yield:

```text
same primary state
same exit code
same diagnostic IDs
same ordering
same severity
same evidence summary
```

Stable ordering suggestion:

```text
category
file
line
check ID
```

Exclude timestamps from semantic comparison.

## 31. Backward Compatibility

Preserve existing CLI commands:

```bash
sliceui verify <dir> [name]
```

Support old/new snapshot shape through PR 2 loader.

Preserve current machine-consumed output fields where documented. Additive diagnostics are preferred.

Any changed exit semantics must be documented and tested.

## 32. Audit Wajib Sebelum Coding

Run:

```bash
rg -n "verifyComponent|readComponent|readOwningModules|pairGroundTruth|hasGroundTruth|checks|skip|pass|exit|paginationAlign|paginationALign|phantom|wrapper|modal|unknown input|classVocabulary|scssCoverage|auth|required" \
  src test skill docs README.md
```

Build a complete check inventory:

```text
check ID/name
category
evidence source
trust type
required/optional
current severity
current skip condition
current exit impact
proposed change
```

Do not code before this inventory is written in a short implementation note.

## 33. Tests Wajib

### 33.1 Name normalization

Test equivalent names:

```text
billing-history
BillingHistoryComponent
billing-history.component
billing-history.component.ts
```

Test ambiguity, path traversal, prefix collision, and no match.

### 33.2 Missing ground truth

All required missing/malformed states are non-green with correct exit.

### 33.3 Required versus optional skip

- required skip → non-green;
- optional skip → pass may remain;
- reasons visible.

### 33.4 Exact Pilar input

Valid input passes.

### 33.5 Wrong case

```text
paginationALign on uii-table
paginationAlign on uii-pagination
```

must fail with exact correction.

### 33.6 Unknown input/output

Unknown catalog binding fails. Native attributes do not false-positive.

### 33.7 Binding syntax

Cover `[input]`, `(output)`, `[(twoWay)]`, `[attr.x]`, `[class.x]`, `[style.x]`, `*ngIf`, `*ngFor`.

### 33.8 Public API versus CSS

Public API available + behavioral deep CSS used incorrectly → diagnostic.

Visual-only deep CSS remains allowed.

### 33.9 Invented modal/card wrapper

Visible semantic wrapper without design evidence → diagnostic.

Neutral Angular wrapper should not false-positive.

### 33.10 Root canvas offset

Canvas x/y copied as internal padding → diagnostic.

### 33.11 Table features

Evidence-backed required options pass/fail precisely.

### 33.12 Auth wiring

Action present + required auth field missing → diagnostic.

No action → no false requirement.

### 33.13 Status safety

Visible text mismatch fails; unknown class fails when registry exists; color-only does not create semantic expectation.

### 33.14 Icon safety

Metadata mismatch fails; unknown metadata remains degraded/unresolved; button text is not expected-icon source.

### 33.15 Required marker

Explicit required marker missing fails; absent marker does not create requirement.

### 33.16 Angular 13 syntax

Unsupported syntax diagnostics with exact location.

### 33.17 Module wiring

Bounded module lookup; no repository scan.

### 33.18 Shared-assumption labels

Corpus/class checks expose trust type.

### 33.19 Deterministic diagnostics

Repeated runs deep-equal after non-semantic normalization.

### 33.20 PR 1–4 non-regression

- compact context;
- snapshot dedup;
- no-ground-truth safety;
- hot referee zero reads;
- resolve provenance and ambiguity safety.

## 34. Test Fixtures

Reuse existing fixtures when possible.

Possible fixtures:

```text
test/fixtures/angular13
test/fixtures/mahasiswa-tarif
test/fixtures/pilar-golden
test/fixtures/eval-hope
```

Add minimal focused fixtures only when necessary for:

```text
wrong-case inputs
invented wrapper
unknown binding
required marker
Angular 13 incompatible syntax
auth wiring
```

Avoid large duplicate fixture trees.

## 35. Validation Commands

Before source changes:

```bash
git status --short
git rev-parse HEAD
git log -1 --oneline
node --version
npm --version
```

Baseline focused:

```bash
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
node --test test/snapshot.test.mjs
```

After implementation, syntax-check all changed source.

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

## 36. Temporary E2E Validation

Use:

```bash
TMP_ROOT="/tmp/sliceui-pr5-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Use repository CLI explicitly:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs ...
```

Never use global `sliceui`.

Run controlled scenarios:

```text
valid component
PascalCase target
wrong-case input
unknown input
invented wrapper
missing required ground truth
optional evidence missing
Angular 13 incompatible syntax
public API vs CSS conflict
action/auth mismatch
```

Capture:

```text
exit code
primary state
check statuses
diagnostic IDs
files read
project-source reads
elapsed
human output
JSON output if applicable
```

## 37. Read-Path Proof

Dynamically prove verify reads only bounded sources.

Expected target project reads:

```text
component files
bounded owning modules
```

Forbidden:

```text
repository-wide glob
recursive component scan
all HTML/SCSS read
unrelated source examples
```

Use read-only fs shim or controlled instrumentation. Separate `.sliceui` reads from project-source reads.

## 38. Performance and Artifact Impact

Measure before/after:

```text
verify elapsed median
files read
bytes read
number of checks
diagnostic object size
human output size
```

Correctness is primary, but avoid material latency or output bloat.

## 39. Documentation and Skill

Update owning docs only.

Likely:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
skill/SKILL.md
```

Document:

```text
name normalization
result states and exits
diagnostic contract
required/optional skips
API validation
independent versus shared-assumption checks
bounded read path
verify independence from resolve/spec
```

Skill should require:

- run verify after generation;
- treat unverifiable as blocking;
- do not retry by guessing;
- fix exact diagnostic cause;
- use kebab/Pascal names equivalently after normalization;
- no repository search unless explicit workflow requires it.

## 40. Acceptance Criteria

PR 5 complete only if:

- [ ] Entry gate authorizes PR 5.
- [ ] Complete check inventory exists.
- [ ] PascalCase/kebab normalization works.
- [ ] Target ambiguity/path traversal safe.
- [ ] Missing required ground truth non-green.
- [ ] Required and optional skips separated.
- [ ] Exact public API validation works.
- [ ] Wrong-case input fails precisely.
- [ ] Unknown input/output detected.
- [ ] Native attributes do not false-positive.
- [ ] Public API beats behavioral CSS.
- [ ] Visual CSS exception remains allowed.
- [ ] Invented semantic wrappers detected with evidence.
- [ ] Neutral wrappers not over-rejected.
- [ ] Canvas offsets not copied internally.
- [ ] Table checks are evidence-backed.
- [ ] Auth/action checks are policy-backed.
- [ ] Status and icon checks remain independent of resolve.
- [ ] Required markers evidence-backed.
- [ ] Angular 13 incompatible syntax detected.
- [ ] Module reads remain bounded.
- [ ] Shared-assumption checks labeled.
- [ ] Diagnostics stable and structured.
- [ ] Exit semantics deterministic.
- [ ] No repository-wide scans.
- [ ] Verify remains independent from resolved/spec.
- [ ] Focused tests pass.
- [ ] Relevant suite passes.
- [ ] Full suite passes except pre-existing skips.
- [ ] PR 1–4 non-regression confirmed.
- [ ] Documentation synchronized.
- [ ] No PR 6 leakage.

## 41. Safety and Git Rules

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

Do not commit or push. PR 5 requires independent verification first.

Record initial and final `git status --short`.

## 42. Work Sequence

### Phase 1: Gate and baseline

- verify checkpoint and closure;
- classify working tree;
- run baseline tests.

### Phase 2: Check inventory and trust analysis

Before coding, write implementation note:

```text
checks
trust sources
required/optional
severity
skip semantics
exit impact
files to change
tests
```

### Phase 3: Name and input reliability

- normalization;
- target safety;
- ground-truth states.

### Phase 4: Structured diagnostics

- stable IDs;
- states;
- severities;
- deterministic aggregation.

### Phase 5: API and template validation

- bindings;
- exact catalog names;
- wrong case;
- public API precedence.

### Phase 6: Independent structural checks

- wrapper/modal/card;
- canvas/layout;
- table/options;
- status/icon/required marker.

### Phase 7: Framework/module checks

- Angular 13;
- auth/action;
- bounded module wiring.

### Phase 8: Tests and E2E

- focused;
- combined;
- full;
- read-path;
- determinism.

### Phase 9: Documentation and skill

- owning docs;
- concise instructions.

### Phase 10: Scope review

- no PR 6 work;
- no unrelated refactor;
- no target mutation.

## 43. Required Final Response

### Entry Gate

```text
Checkpoint baseline:
PR 4 official status:
PR 5 authorized:
Evidence:
```

### Summary

Describe verify reliability implementation.

### Files Changed

Group source, tests, skill, docs, and pre-existing prompt files.

### Check Inventory

Summarize categories, trust sources, required/optional, and severity changes.

### Name Normalization

Show accepted forms and ambiguity/path-safety behavior.

### Result and Exit Contract

```text
pass:
fail:
unverifiable:
invalid-input:
required skip:
optional skip:
```

### Diagnostic Contract

Describe IDs, categories, location, trust source, and remediation.

### API Validation

Report exact input/output and casing behavior.

### Structural and Independent Checks

Report wrapper/modal/card, canvas/layout, table, auth, status, icon, and marker behavior.

### Read-Path and Performance

```text
project files read:
owning modules read:
repository-wide scans:
median elapsed before/after:
```

### Validation

List exact commands and outcomes.

### PR 1–4 Non-Regression

Report each safeguard.

### Known Limitations

Only factual limitations.

### Deferred Findings

Do not implement:

```text
PR 6 visual/render verification
browser screenshot diff
full Angular build orchestration
parser metadata expansion
fs-trace redesign
atomic verdict writing
incremental refresh/cache
```

### Documentation Sync

Use `Documentation sync: clear.` or list stale docs.

### Git Status

Include `git status --short`. Do not commit.

## 44. Focused Implementation Decision

End with:

```text
PR 5 implementation: PASS / FAIL
Verify false-green risks closed: YES / NO
Exact API validation reliable: YES / NO
Independent checks preserved: YES / NO
Repository reads bounded: YES / NO
PR 5 ready for independent verification: YES / NO
```

Do not claim PR 5 officially closed until independent verification completes.

## 45. Definition of Done

Task is done only when verify deterministically locates targets, distinguishes pass/fail/unverifiable/invalid states, validates exact component APIs, prevents public-API behavioral overrides, detects evidence-backed structural inventions, preserves independent XML/transcript checks, labels shared-assumption checks honestly, produces stable actionable diagnostics, never exits green when required verification did not run, performs only bounded project reads, passes the full suite, and is ready for independent PR 5 verification.

Begin by confirming checkpoint `a6fd181`, auditing every current verify check, and writing the trust/required/severity inventory. Do not modify source before that inventory is complete.
