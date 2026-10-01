# SliceUI PR 6C Corrective Patch Plan: Production Selector Integration, Required Border Presence, and Verdict Precedence

Repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Real target project, read-only reference only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Official committed baseline:

```text
60a0835 feat(sliceui): add ambiguity-safe geometry verification
```

Required authoritative documents:

```text
docs/SLICEUI-PR6C-FRESH-INDEPENDENT-VERIFICATION-REPORT.md
docs/SLICEUI-PR6C-VERIFICATION-REPORT.md
docs/SLICEUI-PR6B-VERIFICATION-REPORT.md
docs/SLICEUI-PR6-VERIFICATION-REPORT.md
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/status.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
SLICEUI-PR6C-COMPLETE-RENDERED-GEOMETRY-IMPLEMENTATION-PLAN.md
SLICEUI-PR6C-INDEPENDENT-VERIFICATION-PROMPT.md
SLICEUI-PR6C-FRESH-SESSION-INDEPENDENT-VERIFICATION-PROMPT.md
SLICEUI-PR6C-DECISION-NOTE.md
```

If a named file is located elsewhere, find it by exact filename. Do not rewrite historical verification decisions merely to replace `CONDITIONAL PASS` with `PASS`.

Source code, active documentation, committed checkpoints, and reproducible runtime evidence are more authoritative than planning prompts or implementation summaries.

## 1. Mandatory Entry Gate

Before changing source:

1. Read `docs/SLICEUI-PR6C-FRESH-INDEPENDENT-VERIFICATION-REPORT.md`.
2. Confirm the independence disclosure states that the verification occurred in a fresh session without prior implementation involvement.
3. Confirm the recorded verdict:

```text
PR 6C: CONDITIONAL PASS
PR 6C may close: NO
Corrective patch required: YES
Full PR 6 may close after checkpoint: NO
```

4. Confirm the blocking findings:

```text
MAP-002 Critical
The production CLI/render path does not pass the selector map to renderVerify, leaving PR 6C structural checks dead on the shipped path.

BOR-001 High
A required evidenced border can be entirely absent and still pass because expected 1px versus actual 0px falls within the general +/-1px tolerance.

AGG-001 High
The zero-required-executed guard runs before required-failure aggregation, masking a real required mismatch as unverifiable instead of visual-fail.
```

5. Confirm the non-blocking findings that may be fixed only when local and low risk:

```text
DIA-001 empty or undefined diagnostic detail
ISO-001 temporary default screenshot not deleted despite documented cleanup
TST-001 missing CLI production-path integration test
```

6. Confirm these remain outside this patch unless directly affected:

```text
TYP-001 typography role granularity
FNT-001 stronger font substitution detection
NOE-001 programmatic NOEV marker
FIX-001 pre-existing private-fixture sanitization
parser metadata expansion
```

7. Run the baseline focused and full suites.
8. Reproduce MAP-002, BOR-001, and AGG-001 through the actual production path before editing source.
9. Confirm root `tester.xml` remains untracked, unstaged, and unused by automated tests.
10. Stop if the repository state differs materially from the fresh independent report.
11. Do not commit, push, or start a new feature phase.

Record entry-gate evidence in the final response.

## 2. Corrective Patch Objective

Implement the smallest safe patch that:

1. Loads the fixture-scoped selector map through the production `verify --render` path.
2. Validates the selector map before browser launch.
3. Passes the validated selector map into `renderVerify` without repository scanning.
4. Ensures structural PR 6C checks execute through the CLI, not only direct function calls.
5. Makes an absent required border fail even when the general numeric tolerance would otherwise permit zero.
6. Preserves normal tolerance behavior for rendered, non-zero borders.
7. Processes real required failures before the zero-required-executed unverifiable guard.
8. Preserves unverifiable behavior when no required evidence exists or none can execute.
9. Removes `detail: undefined` from normal diagnostics if the fix is local.
10. Cleans default temporary screenshots according to the documented lifecycle if the fix is local.
11. Preserves every PR 6A, PR 6B, and already-correct PR 6C invariant.
12. Produces focused re-verification evidence and becomes ready for another fresh-session independent verification.

Do not narrow active contracts merely to avoid fixing production integration or verdict correctness.

## 3. Allowed Scope

Changes may include only the smallest necessary set, likely:

```text
src/commands/verify.mjs
src/framework/angular/render-verify.mjs
src/framework/angular/render-geometry.mjs
src/framework/angular/selector-map.mjs only if a bounded loader/helper belongs there
test/verify-root.test.mjs
test/verify.test.mjs only if command behavior ownership requires it
test/render-verify.test.mjs
test/render-geometry.test.mjs
test/selector-map.test.mjs
minimal synthetic fixture files under test/fixtures/render-geometry/
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/status.md only if the current uncommitted state wording changes
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md only if workflow instructions are stale
```

Do not modify every listed file automatically. Use the narrowest ownership-consistent change.

## 4. Explicitly Out of Scope

Do not implement:

- another geometry phase;
- parser expansion for table row/cell metadata;
- invented expected-scroll or truncation intent;
- AI vision scoring;
- blocking screenshot pixel comparison;
- OCR;
- visual auto-correction;
- multi-browser support;
- broad responsive matrices;
- full accessibility audit;
- resolver, referee, snapshot, or parser redesign;
- public packaging redesign;
- new dependencies;
- repository-wide scanning;
- FIX-001 privacy remediation;
- unrelated refactoring;
- commit or push.

## 5. Required Pre-Fix Reproduction

Use:

```bash
TMP_ROOT="/tmp/sliceui-pr6c-production-corrective-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Use the repository CLI explicitly:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs verify <dir> [name] --render
```

Never use a global or PATH-resolved SliceUI binary.

### MAP-002 reproduction

Use the committed/synthetic PR 6C structural defect fixture whose selector map exposes at least one required structural mismatch.

Run both:

```text
A. Production CLI path
B. Direct renderVerify call with selectorMap explicitly supplied
```

Record:

```text
selector-map path
selector-map existence
selector-map validation result
whether commands/verify.mjs reads it
whether renderVerify receives it
check IDs executed
primary state
exit code
browser launch
```

Pre-fix behavior to reproduce:

```text
CLI path
→ selector map not passed
→ structural checks absent
→ false pass or missing expected visual-fail

Direct renderVerify with map
→ structural checks execute
→ visual-fail for defect fixture
```

### BOR-001 reproduction

Use a required literal uniform border fact:

```text
expected width: positive, for example 1px
actual width: 0px on all sides
```

Record:

```text
expected widths
actual widths
numeric deltas
tolerance
presence classification
final comparison status
final render state
```

Pre-fix behavior:

```text
expected 1px
actual 0px
absolute delta 1px
numeric tolerance +/-1px
→ pass despite required border being absent
```

Also reproduce one non-zero difference at the tolerance boundary so normal tolerance behavior can be preserved intentionally.

### AGG-001 reproduction

Construct a scenario with:

```text
at least one required fact
a required comparison that executes and fails
required executed-pass count equal to zero
```

Record:

```text
required fact count
required executed count
required pass count
required failure count
mapping failures
comparison failures
aggregation branch order
primary state
exit code
```

Pre-fix behavior:

```text
real required comparison failure exists
zero-required-executed guard triggers first
→ unverifiable, exit 3
instead of visual-fail, exit 1
```

Do not change source before all three findings are reproduced with actual output.

## 6. Root-Cause Audit

Audit at minimum:

```text
src/commands/verify.mjs
src/framework/angular/render-verify.mjs
src/framework/angular/render-geometry.mjs
src/framework/angular/selector-map.mjs
test/verify-root.test.mjs
test/verify.test.mjs
test/render-verify.test.mjs
test/render-geometry.test.mjs
test/selector-map.test.mjs
test/fixtures/render-geometry/
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
```

Search:

```bash
rg -n "selectorMap|geometry\.map|renderVerify|requiredGeom|required.*Count|unverifiable|visual-fail|borderWidth|border.*presence|screenshot|detail:|undefined" \
  src test docs skill
```

Prove:

- the complete production CLI call chain;
- the intended owning location and filename for selector maps;
- why the map is available to tests but absent from the command path;
- where map validation should occur;
- where browser launch occurs relative to validation;
- how the border comparator applies tolerance;
- how required-border presence is represented or missing;
- the exact aggregation precedence path;
- why a real required failure is masked;
- where diagnostic `detail` is rendered;
- who owns temporary screenshot deletion.

## 7. Production Selector-Map Ownership

Define one bounded selector-map ownership contract.

Preferred behavior, adjusted to existing fixture/artifact conventions:

```text
component/render target directory
→ known fixed selector-map filename or known fixed adjacent artifact path
→ no recursive search
→ no repository scan
```

The map location must be deterministic and documented.

Do not search the repository for `*.map.json` or similar files.

Do not read root `tester.xml`.

## 8. Production Selector-Map Loading

The production render path must:

```text
1. Determine the bounded map path from the target/fixture contract.
2. If the map exists, read it once.
3. Parse JSON safely.
4. Validate the raw payload with strict selector-map validation.
5. Build the locator-only index.
6. Pass the validated/indexed map into renderVerify.
7. Execute mapped structural checks.
```

If the map is absent:

```text
- behavior must follow the documented map-optional policy;
- existing transcript/text mappings remain available;
- no structural family may be falsely claimed as executed;
- zero-required protection remains active.
```

## 9. Selector-Map Validation Timing

Invalid selector-map behavior:

```text
primary state: invalid-input
exit code: 2
stable SUI-RENDER-MAP diagnostic
browser launch: 0
render workspace: 0 or cleaned immediately
screenshot: none
```

Validation must happen before importing or launching browser tooling where practical.

Do not weaken the recursive strictness or locator-only contract.

## 10. Production Integration Contract

Required production chain:

```text
CLI arguments
→ static verification
→ static-pass gate
→ bounded selector-map load/validation
→ renderVerify({ ..., selectorMap })
→ structural geometry collection
→ comparison and aggregation
→ final state/exit
```

Static verify without `--render` must not:

```text
read selector maps
load Playwright
launch browser
create render workspace
```

Static failure plus `--render` must short-circuit before map loading/browser launch unless current contract explicitly validates input flags earlier.

## 11. CLI Process-Level Regression Tests

Add tests that execute the production command path, not only direct functions.

Required scenarios:

```text
known-good structural fixture with valid map
→ pass, exit 0
→ mapped structural diagnostic/check IDs present

defect structural fixture with valid map
→ visual-fail, exit 1
→ expected gap/border/radius/overflow checks present

invalid map
→ invalid-input, exit 2
→ browser launch count 0

missing optional map
→ documented behavior
→ no false claim that map-only checks executed

static verify without --render
→ selector-map read count 0
→ browser launch count 0
```

At least one test must prove the same defect behaves consistently through direct `renderVerify` and the CLI production path.

## 12. Selector-Map Path Safety

Map path construction must:

```text
stay within the intended target/fixture root
use a fixed known filename or bounded relative path
reject path traversal
avoid absolute private-path input
avoid symlink escape where current project safety policy requires it
```

Do not accept arbitrary user-supplied map paths unless explicitly approved as a separate CLI contract.

## 13. Required Border Presence Contract

For a required evidenced border with expected width greater than zero:

```text
actual width <= 0
→ required-border-absent
→ visual-fail
```

This semantic presence rule runs before general approximate numeric comparison.

A required visible border is not approximately correct when it is absent.

## 14. Border Tolerance After Presence

After presence is established:

```text
expected > 0
actual > 0
→ compare numeric delta using centralized border tolerance
```

Examples for expected `1px` and tolerance `1px`, subject to existing approved policy:

```text
actual 0px → fail as absent, regardless of delta
actual 1px → pass
actual 2px → pass if boundary policy is <= tolerance
actual 2.1px → fail
```

Do not change the centralized tolerance silently. If the tolerance itself appears too broad, record it separately rather than mixing scope.

## 15. Border Color and Presence

Only treat a border color as meaningful when the required border is rendered with positive width.

Rules:

```text
required width absent
→ border presence failure
→ do not let computed color create a pass

required width present
→ compare normalized expected/actual color
```

A browser may return a computed color even for a zero-width border. That color does not prove the border exists.

## 16. Full-Side Required Border Behavior

Preserve the current full-side contract:

```text
top
right
bottom
left
```

For a uniform required border:

- every evidenced side must be present;
- every evidenced side width must pass;
- every evidenced side color must pass;
- one absent or mismatched side produces visual-fail;
- diagnostics identify affected sides deterministically.

Divider facts remain side-specific. Border style remains NOEV when no evidence exists.

## 17. Border Presence Diagnostics

Required diagnostic data:

```text
stable ID
category: border
required: true
design fact locator
DOM locator
side or sides
expected width
actual width
presence status
tolerance
expected/actual color where applicable
remediation
```

Example remediation concept:

```text
The design requires a visible border on the left side, but the rendered border width is 0px.
```

Keep output bounded. Do not dump full computed styles.

## 18. Border Regression Tests

Required tests:

- [ ] All four sides present and correct → pass.
- [ ] All four sides absent → visual-fail.
- [ ] Top absent → visual-fail.
- [ ] Right absent → visual-fail.
- [ ] Bottom absent → visual-fail.
- [ ] Left absent → visual-fail.
- [ ] Width 2px with expected 1px follows boundary policy.
- [ ] Width just outside tolerance fails.
- [ ] Correct computed color with zero width does not pass.
- [ ] Present width with wrong color fails.
- [ ] Divider presence remains side-specific.
- [ ] Multiple absent sides yield deterministic bounded diagnostics.

At least one browser-path test must exercise an absent required uniform border.

## 19. Verdict Precedence Contract

Define explicit aggregation precedence.

Recommended order:

```text
1. build/browser/mount/runtime/setup failure
2. invalid input/map
3. required comparison failures
4. required mapping missing/ambiguous failures
5. zero required facts or zero executable required evidence
6. required passes plus optional warnings
7. clean pass
```

Adapt to the established state model without inventing unnecessary states.

Critical invariant:

```text
If a real required comparison executed and failed, the final result must not be downgraded to unverifiable merely because zero required checks passed.
```

## 20. Required Fact and Execution Counters

Track or derive these concepts explicitly:

```text
requiredFactCount
requiredMappedCount
requiredExecutedCount
requiredPassCount
requiredFailureCount
requiredMappingFailureCount
```

Definitions must be unambiguous.

A required comparison that executes and fails counts as executed evidence, even though it does not count as passed evidence.

Optional checks never increment required counters.

NOEV rows never increment required counters.

## 21. Aggregation Outcomes

Required behavior:

```text
requiredFailureCount > 0
→ visual-fail

requiredMappingFailureCount > 0
→ established non-green mapping/unverifiable state

requiredFactCount == 0
→ unverifiable

requiredFactCount > 0 and requiredExecutedCount == 0
→ unverifiable

requiredExecutedCount > 0 and all executed required checks pass
→ pass, subject to optional warnings
```

If both required comparison and mapping failures exist, define deterministic precedence and document it. Do not hide the concrete comparison failure.

## 22. AGG-001 Regression Tests

Required scenarios:

```text
required style comparison fails, zero required passes
→ visual-fail, exit 1

required geometry comparison fails, optional checks pass
→ visual-fail, exit 1

required facts exist, all are unmapped
→ non-green/unverifiable

required facts exist, all mappings ambiguous
→ non-green/unverifiable

zero required facts
→ unverifiable, exit 3

only optional checks pass
→ unverifiable, exit 3

one required pass + optional warning
→ pass with warning

runtime-fail + geometry pass/fail
→ runtime-fail

invalid map
→ invalid-input, exit 2
```

Assert internal counts where exposed and final process exit codes.

## 23. DIA-001 Local Hardening

If diagnostic rendering currently prints:

```text
detail: undefined
```

apply a minimal local fix:

```text
omit empty/undefined fields
or provide a valid bounded detail only when present
```

Do not redesign diagnostics.

Add a test asserting normal output does not contain literal `undefined` for missing optional fields.

If the fix is not local, defer it explicitly and explain why.

## 24. ISO-001 Temporary Screenshot Cleanup

Audit default screenshot ownership.

Documented behavior should be enforced:

```text
default render
→ temporary screenshot is captured/used
→ screenshot removed during cleanup

--preserve-render-artifacts
→ screenshot preserved at documented path
```

Fix only if ownership is local and safe.

Tests:

```text
default success leaves no screenshot
default visual-fail follows documented retention policy
preserve mode keeps exactly the expected artifact
cleanup runs after exception
```

Do not delete unrelated `/tmp` artifacts or pre-existing ignored files.

## 25. Historical Report Integrity

Do not rewrite the fresh independent report's verdict or findings.

The report remains the historical evidence that discovered MAP-002, BOR-001, and AGG-001.

Record corrective resolution in:

```text
focused re-verification final response
optional clearly labeled corrective addendum only if repository workflow requires a file
future checkpoint closure report
```

Do not make the original verification appear to have passed initially.

## 26. Documentation Synchronization

Update active contracts only where behavior changes.

Required documentation:

```text
production CLI loads and validates bounded selector map before render
invalid map exits 2 before browser
static verify does not read selector map
required positive-width border cannot pass at 0px
full-side border presence/width/color semantics
required failures outrank zero-executed unverifiable guard
zero required evidence remains unverifiable
optional and NOEV evidence do not satisfy required gate
default screenshot cleanup, if ISO-001 resolved
diagnostics omit undefined fields, if DIA-001 resolved
```

Likely owners:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
```

Update `status.md` only if its current uncommitted PR 6C/corrective status becomes factually stale. Do not rewrite unrelated history.

## 27. Privacy and Fixture Safety

Use only synthetic fixture values.

Do not read, import, stage, quote, or copy root `tester.xml`.

Do not modify the pre-existing fixture covered by FIX-001.

Run a privacy scan over changed fixtures, diagnostics, documentation, and reports. Do not reproduce private values in the final response.

## 28. Existing PR 6C Non-Regression

Re-test:

```text
selector-map recursive strictness
locator-only indexing
missing/ambiguous mapping
objective overflow/clipping
off-container/off-viewport checks
full-side border comparison
radius
gap
letter spacing
typography/font checks where evidenced
NOEV dispositions
expected-scroll/truncation non-invention
```

Only production map integration, border presence, aggregation precedence, and local DIA/ISO hardening should change materially.

## 29. PR 6A and PR 6B Non-Regression

Re-test:

```text
static verify no browser
static failure short-circuit
viewport bounds
network blocking and sanitization
runtime-fail
workspace cleanup
target writes zero
development-only package contract
required ambiguity non-green
optional ambiguity non-blocking
silent first-pick absent
required control height
zero-required guard
```

## 30. Production-Path Determinism

Run at least three times:

```text
CLI known-good structural fixture
CLI structural defect fixture
CLI absent-border defect
CLI required style mismatch
CLI invalid selector map
```

Normalize timestamps and temporary paths only.

Assert stable:

```text
primary state
exit code
check IDs
selector-map load result
required counters
expected/actual values
diagnostic ordering
artifact cleanup
```

## 31. Performance and Boundedness

Measure:

```text
selector-map reads per render
browser launch count
browser evaluation count
known-good CLI render median
defect CLI render median
static verify median
```

Requirements:

```text
selector map read at most once per render invocation
no repository scan
invalid map launches no browser
static path reads no selector map
no material render regression
```

## 32. Read/Write/Network/Process Boundary

Dynamically confirm:

```text
target writes = 0
repository scans = 0
network escapes = 0
temporary writes contained
no npm install
browser/process cleanup complete
static path unchanged
```

Do not modify dependencies or lockfiles.

## 33. Required Test Checklist

### MAP-002

- [ ] Production CLI loads bounded selector map.
- [ ] Map validated before browser.
- [ ] Map passed to renderVerify.
- [ ] Known-good structural CLI path passes.
- [ ] Defect structural CLI path visual-fails.
- [ ] Direct and CLI paths agree.
- [ ] Invalid map exits 2 and launches no browser.
- [ ] Static path reads no map.
- [ ] Missing-map behavior documented and tested.
- [ ] No repository scan or path traversal.

### BOR-001

- [ ] Required positive border at 0px fails.
- [ ] Every uniform side presence checked.
- [ ] Normal non-zero tolerance boundary preserved.
- [ ] Zero-width computed color cannot produce pass.
- [ ] Wrong present color fails.
- [ ] Divider remains side-specific.

### AGG-001

- [ ] Required comparison failure outranks zero-pass guard.
- [ ] Required failure exits 1.
- [ ] Zero required facts exits 3.
- [ ] Zero executed required evidence exits 3.
- [ ] Optional-only exits 3.
- [ ] Required pass plus optional warning may pass.
- [ ] Runtime/setup failures retain precedence.
- [ ] Invalid input retains exit 2.

### DIA-001 and ISO-001, if resolved

- [ ] No literal `undefined` in normal diagnostics.
- [ ] Default screenshot cleaned.
- [ ] Preserve mode retains expected artifact.

### Non-regression

- [ ] PR 6A safeguards green.
- [ ] PR 6B safeguards green.
- [ ] Existing PR 6C focused suite green.
- [ ] Full suite green except pre-existing skips.

## 34. Validation Commands

Before source changes:

```bash
git status --short
git rev-parse HEAD
git log -1 --oneline
node --version
npm --version
```

Baseline actual tests:

```bash
node --test test/render-geometry.test.mjs
node --test test/render-verify.test.mjs
node --test test/selector-map.test.mjs
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
```

After implementation, run `node --check` on every changed/new source and test file.

Focused suite must include process-level CLI selector integration, absent border, and verdict precedence tests.

Relevant combined suite must include:

```text
render geometry
render verify
selector maps
CLI verify/root
render mount/probe
static verify
snapshot/transcript
Pilar catalog/mount
referee
resolve/spec/agent-context
```

Then run:

```bash
npm test
```

Record exact counts. Do not reuse previous counts without rerunning after the patch.

## 35. Focused Re-Verification Matrix

After implementation, dynamically verify:

```text
CLI known-good structural fixture
CLI defect structural fixture
direct/CLI parity
invalid selector map
missing selector map
static verify no render
required border entirely absent
one required border side absent
non-zero border at tolerance boundary
required style mismatch with zero required passes
all required mappings missing
zero required facts
only optional facts
one required pass + optional warning
network attempt
runtime failure
invalid viewport
default screenshot cleanup
preserve screenshot mode
```

For each record:

```text
state
exit code
selector-map read count
browser launch count
mapping result
required counters
diagnostic IDs
expected/actual/delta/tolerance
artifact result
cleanup result
target mutation
```

## 36. Focused Re-Verification Decision

Required result:

```text
PR 6C corrective patch: PASS / FAIL
MAP-002: RESOLVED / UNRESOLVED
BOR-001: RESOLVED / UNRESOLVED
AGG-001: RESOLVED / UNRESOLVED
DIA-001: RESOLVED / DEFERRED / UNRESOLVED
ISO-001: RESOLVED / DEFERRED / UNRESOLVED
Production selector integration active: YES / NO
CLI structural defect visual-fails: YES / NO
Required absent border visual-fails: YES / NO
Required failure precedence correct: YES / NO
Zero required evidence unverifiable: YES / NO
Invalid map pre-browser: YES / NO
PR 6A/6B safeguards preserved: YES / NO
PR 6C ready for fresh independent re-verification: YES / NO
Full PR 6 complete: NO
```

Full PR 6 remains incomplete until another fresh independent verification passes and the checkpoint is committed.

## 37. Fresh Independent Re-Verification Handoff

After focused re-verification passes, provide a fresh reviewer only:

```text
repository path
committed baseline 60a0835
path to the fresh-session verification prompt
path to authoritative documents
instruction to reconstruct behavior from source
```

Do not provide expected verdicts or claim findings are resolved to the reviewer.

The reviewer must create a new report or clearly versioned re-verification report without overwriting prior historical reports.

## 38. Documentation Sync Gate

State:

```text
Documentation sync: clear.
```

only if:

- production selector-map loading is documented;
- invalid map timing and exit are documented;
- absent required border semantics are documented;
- full-side borders remain accurate;
- verdict precedence and zero-required behavior are accurate;
- screenshot lifecycle is accurate if changed;
- diagnostics behavior is accurate if changed;
- `status.md` remains historically correct;
- full PR 6 is not called complete.

Otherwise list stale documents and exact corrections.

## 39. Git and Safety Rules

Never run:

```text
git reset --hard
git clean -fd
git checkout -- .
git restore .
npm update
auto-format whole repository
```

Do not delete or stage root-level prompt files.

Do not stage, import, or quote root `tester.xml`.

Do not modify pre-existing private fixtures.

Do not modify the real target project.

Do not commit or push. Fresh independent re-verification is required first.

Record initial/final statuses and source hashes.

## 40. Work Sequence

### Phase 1: Gate and reproduce

- read fresh independent report;
- confirm findings;
- reproduce MAP-002, BOR-001, AGG-001;
- audit DIA-001 and ISO-001;
- run baseline tests.

### Phase 2: Root-cause and integration note

Before coding, state:

```text
production selector-map ownership
loading/validation timing
CLI-to-renderVerify call chain
border presence semantics
aggregation counter definitions and precedence
DIA/ISO ownership
docs to update
files to change
tests
```

### Phase 3: Production selector integration

- bounded map path;
- parse and validate;
- pass into renderVerify;
- no static-path read;
- process-level tests.

### Phase 4: Border presence

- zero-width required border fails;
- non-zero tolerance preserved;
- color gated by presence;
- full-side behavior preserved.

### Phase 5: Verdict precedence

- explicit required counters;
- required failures before zero guard;
- zero evidence remains unverifiable;
- state precedence tests.

### Phase 6: Local DIA/ISO hardening

- omit undefined detail if local;
- enforce screenshot cleanup if local;
- focused tests.

### Phase 7: Full validation and focused re-verification

- CLI/browser E2E;
- determinism;
- isolation;
- PR 6A/6B regression;
- full suite.

### Phase 8: Documentation and fresh-review readiness

- synchronize owning docs;
- preserve historical reports;
- prepare minimal fresh-review handoff.

## 41. Required Final Response

### Entry Gate

```text
Fresh independent verification decision:
MAP-002 confirmed:
BOR-001 confirmed:
AGG-001 confirmed:
DIA-001 confirmed:
ISO-001 confirmed:
Other blockers:
```

### Pre-Fix Reproduction

```text
CLI selector map passed:
CLI structural defect state:
Direct structural defect state:
Required absent border state:
Required comparison mismatch state:
Zero-required guard result:
Default screenshot cleanup:
Undefined diagnostic observed:
```

### Root Cause

Include paths, symbols, production call chain, border comparator, aggregation order, artifact ownership, and documentation ownership.

### Corrective Patch Summary

Describe only the minimum changes.

### Files Changed

Group source, tests/fixtures, docs/skill/status, historical reports, and excluded prompts/private file.

### Production Selector Contract After Fix

```text
map location:
load timing:
validation timing:
invalid map behavior:
missing map behavior:
static-path behavior:
renderVerify integration:
```

### Border Presence Contract After Fix

```text
expected positive + actual zero:
non-zero tolerance:
color comparison:
full-side behavior:
divider behavior:
```

### Verdict Precedence After Fix

```text
runtime/setup:
invalid input:
required comparison failures:
required mapping failures:
zero required facts:
zero executed required evidence:
required pass + optional warnings:
```

### DIA/ISO Contract

```text
undefined diagnostics:
default screenshot:
preserve mode:
cleanup on failure:
```

### Validation

List exact commands and results.

### Determinism and Performance

```text
known-good CLI runs:
defect CLI runs:
absent-border runs:
required-failure runs:
invalid-map runs:
variance:
selector-map reads:
browser launches:
render median:
```

### Isolation and Non-Regression

```text
target writes:
repository scans:
network escapes:
static browser launches:
PR 6A safeguards:
PR 6B safeguards:
existing PR 6C safeguards:
```

### Focused Re-Verification Decision

```text
PR 6C corrective patch: PASS / FAIL
MAP-002: RESOLVED / UNRESOLVED
BOR-001: RESOLVED / UNRESOLVED
AGG-001: RESOLVED / UNRESOLVED
DIA-001: RESOLVED / DEFERRED / UNRESOLVED
ISO-001: RESOLVED / DEFERRED / UNRESOLVED
Production selector integration active: YES / NO
CLI structural defect visual-fails: YES / NO
Required absent border visual-fails: YES / NO
Required failure precedence correct: YES / NO
Zero required evidence unverifiable: YES / NO
Invalid map pre-browser: YES / NO
PR 6A/6B safeguards preserved: YES / NO
PR 6C ready for fresh independent re-verification: YES / NO
Full PR 6 complete: NO
```

### Deferred Work

Keep separate:

```text
TYP-001 if evidence remains insufficient
FNT-001 if evidence remains insufficient
NOE-001 programmatic marker
FIX-001 privacy sanitization
parser metadata expansion
remaining non-blocking automation gaps
```

### Documentation Sync

Use `Documentation sync: clear.` or list stale docs.

### Git Status

Include exact `git status --short`. Do not commit or push.

## 42. Definition of Done

The corrective patch is complete only when the production CLI loads and validates the bounded selector map and passes it into rendered verification; structural defects fail through the shipped CLI path; required positive-width borders cannot pass when absent; all evidenced border sides retain width/color enforcement; real required comparison failures outrank the zero-required-evidence guard while genuinely absent evidence remains unverifiable; invalid maps fail before browser launch; diagnostics and temporary screenshot lifecycle match their contracts where locally corrected; PR 6A, PR 6B, and existing PR 6C safeguards remain intact; browser and CLI results are deterministic; target writes and network escapes remain zero; all tests pass; documentation is synchronized; and the implementation is ready for another genuinely independent fresh-session verification before checkpoint and full PR 6 closure.

Start by reproducing MAP-002, BOR-001, and AGG-001 through the actual production path. Do not modify source before all three findings are recorded with commands and output.
