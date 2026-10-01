# SliceUI PR 6B Corrective Patch Plan: DOM Mapping Ambiguity and Control-Height Contract

Repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Real target project, read-only reference only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Official PR 6A checkpoint:

```text
0394317 feat(sliceui): add safe opt-in rendered verification
```

Required documents:

```text
docs/SLICEUI-PR6B-VERIFICATION-REPORT.md
docs/SLICEUI-PR6-VERIFICATION-REPORT.md
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
SLICEUI-PR6B-GEOMETRY-COVERAGE-IMPLEMENTATION-PLAN.md
SLICEUI-PR6B-INDEPENDENT-VERIFICATION-CHECKLIST.md
```

Supporting context when needed:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
docs/SLICEUI-PR4-VERIFICATION-REPORT.md
docs/SLICEUI-PR5-VERIFICATION-REPORT.md
SLICEUI-PR6A-CORRECTIVE-PATCH-RENDER-SAFETY-PROMPT.md
```

Source code, active documentation, committed checkpoints, and verification reports are more authoritative than planning prompts.

## 1. Mandatory Entry Gate

Before changing source:

1. Read `docs/SLICEUI-PR6B-VERIFICATION-REPORT.md`.
2. Confirm the recorded decision:

```text
PR 6B: CONDITIONAL PASS
PR 6B may close: NO
Corrective patch required: YES
PR 6C required: YES
Full PR 6 complete: NO
```

3. Confirm the blocking findings:

```text
MAP-001 High
Ambiguous text mapping picks the first matching DOM element and can produce a false pass.

DOC-001 Medium
Control-height contract conflicts: implementation marks it optional while active documentation marks it required.
```

4. Confirm no other finding blocks PR 6B closure.
5. Confirm `FIX-001`, involving personal data in a pre-existing fixture, is a separate privacy task and must not be modified in this patch.
6. Run baseline focused tests before source changes.
7. Reproduce `MAP-001` and `DOC-001` with actual output.
8. Stop if the verification report or repository state differs materially.
9. Do not begin PR 6C, commit, or push in this task.

Record entry-gate evidence in the final response.

## 2. Corrective Patch Objective

Implement the smallest safe correction that:

1. Removes every silent first-match selection from geometry DOM mapping.
2. Distinguishes zero, unique, and ambiguous matches deterministically.
3. Makes required mapping ambiguity non-green.
4. Makes optional mapping ambiguity a bounded warning or skip.
5. Makes required control-height facts blocking when a literal visible control box is evidenced.
6. Keeps uncertain control mappings honest rather than guessing.
7. Synchronizes implementation, diagnostics, tests, skill, and documentation.
8. Preserves all PR 6A render-safety guarantees.
9. Preserves all successfully verified PR 6B geometry checks.
10. Keeps PR 6C geometry families separate and explicitly required.

Do not redesign the rendered-verification architecture.

## 3. Scope Allowed

Changes may include only:

```text
src/framework/angular/render-geometry.mjs
src/framework/angular/render-verify.mjs only if aggregation or browser collection must change
test/render-geometry.test.mjs
test/render-verify.test.mjs only for production-browser regression coverage
minimal synthetic fixture variants under test/fixtures/render-geometry/
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md only if ambiguity/control handling is not already accurate
```

Modify the smallest set of files supported by the root-cause audit.

## 4. Explicitly Out of Scope

Do not implement:

- PR 6C geometry coverage;
- flex or structural gap checks;
- table header, row, cell, or footer density;
- pagination geometry;
- relative alignment;
- overflow and clipping;
- expanded border or radius checks;
- font-fallback detection;
- complete typography-role coverage;
- AI vision scoring;
- pixel-diff blocking;
- browser lifecycle redesign;
- network-policy redesign;
- package-contract redesign;
- static verify redesign;
- parser, resolver, referee, or snapshot redesign;
- repository scans;
- new dependencies;
- unrelated refactoring;
- privacy-fixture cleanup for `FIX-001`;
- commit or push.

Keep these separate:

```text
FIX-001 pre-existing fixture privacy sanitization
TST-001 through TST-004 broader test hardening not directly needed by MAP-001/DOC-001
PR 6C remaining rendered geometry coverage
```

## 5. Required Pre-Fix Reproduction

Use:

```bash
TMP_ROOT="/tmp/sliceui-pr6b-corrective-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Use the repository CLI explicitly:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs verify <dir> [name] --render
```

Never use a global/on-PATH binary.

### MAP-001 reproduction

Create an isolated fixture variant where one required design fact maps to at least two visible DOM elements through the current mapping strategy.

Record:

```text
mapping strategy
design fact locator
candidate count
candidate visibility
selected candidate
final state
diagnostic
```

Pre-fix behavior to reproduce:

```text
candidate count > 1
mapping selects els[0]
comparison can pass
no ambiguity diagnostic
```

Also reproduce, if current behavior differs:

```text
one visible + one hidden duplicate
parent and nested child with similar textContent
two optional buttons with matching text
```

### DOC-001 reproduction

Use a literal design input/control height of `40px` with rendered variants:

```text
40px
42px
42.1px or another value just outside tolerance
30px
missing control
ambiguous repeated control
```

Record:

```text
required flag
severity
state
exit code
diagnostic
active documentation statement
```

Pre-fix mismatch to confirm:

```text
source required=false
outside-tolerance input mismatch warns but does not block
active docs call control height required
```

Do not change source before both findings are reproduced.

## 6. Root-Cause Audit

Audit at minimum:

```text
src/framework/angular/render-geometry.mjs
src/framework/angular/render-verify.mjs
test/render-geometry.test.mjs
test/render-verify.test.mjs
test/fixtures/render-geometry/
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
```

Search:

```bash
rg -n "els\[0\]|querySelector|querySelectorAll|textContent|candidate|ambiguous|required|control-height|input-height|optional|warn|unverifiable|visual-fail" \
  src/framework/angular test/render-geometry.test.mjs test/render-verify.test.mjs \
  docs/project-docs/development/api-contract.md \
  docs/project-docs/technical-guidelines/verify-gate-trust.md skill/SKILL.md
```

Prove:

- the exact first-pick code path;
- how visible candidates are currently filtered;
- whether nested parent/child matches can both appear;
- how required and optional facts are represented;
- how mapping failures affect final state;
- where control-height is marked optional;
- why documentation states it is required;
- whether the fixture design frame represents a visible rendered border box;
- whether aggregation already supports required ambiguity as non-green.

## 7. Mapping Result Contract

Replace implicit element-or-null mapping with an explicit mapping result.

Conceptual states:

```text
unique
missing
ambiguous
unsupported
```

Conceptual shape, adapted to repository conventions:

```json
{
  "status": "ambiguous",
  "strategy": "visible-text",
  "candidateCount": 2,
  "locator": "design-node-or-fact-id",
  "candidates": [
    { "tag": "button", "role": "button" },
    { "tag": "button", "role": "button" }
  ]
}
```

Candidate metadata must remain bounded and must not include full HTML, full text bodies, or sensitive values.

## 8. Candidate Filtering

Before determining ambiguity, filter candidates deterministically.

Exclude elements that are clearly not rendered:

```text
display: none
visibility: hidden or collapse
hidden attribute
zero rendered box only when it truly indicates non-visible output
ancestor-hidden elements
```

Do not exclude:

```text
visible zero-text controls
clipped but required elements
partially off-screen elements
opacity: 0 without policy review
```

Opacity, clipping, and off-screen status may represent separate visual defects. Do not hide those candidates merely to force uniqueness.

## 9. Nested-Duplicate Handling

Text mapping can match both a parent and a child because `textContent` aggregates descendants.

Use an explicit bounded strategy, for example:

```text
exact normalized own-visible-text preferred over aggregate text
semantic role/tag constraints
smallest valid matching element when justified
exclude ancestor when a descendant is the actual semantic target
```

Do not blindly choose the deepest or smallest element for every fact.

The selected rule must be:

- deterministic;
- documented;
- tested;
- based on the measurement semantic;
- independent of DOM order alone.

If the strategy cannot produce a unique justified element, return `ambiguous`.

## 10. Unique Mapping Rule

Only one valid candidate may proceed to geometry measurement.

```text
0 candidates → missing
1 candidate  → unique
>1 candidates→ ambiguous
```

A deterministic semantic refinement may reduce multiple raw candidates to one valid candidate. Array order, first occurrence, source order, or `els[0]` are not semantic refinements.

## 11. Required Mapping Semantics

For a required fact:

```text
unique     → measure and compare
missing    → non-green
ambiguous  → non-green
unsupported→ non-green or explicit unverifiable according to current contract
```

Recommended final state:

```text
required missing/ambiguous mapping
→ unverifiable or visual-fail according to established aggregation
→ never pass
```

Use the existing state model. Do not create a new state unless necessary.

Diagnostic must explain whether the problem is missing or ambiguous rather than calling it a geometry mismatch.

## 12. Optional Mapping Semantics

For an optional fact:

```text
unique     → measure; mismatch warns
missing    → skip with reason
ambiguous  → warning or skip with reason
unsupported→ skip with reason
```

Optional ambiguity must not block otherwise complete required geometry evidence.

It must remain visible and must not silently disappear.

## 13. Ambiguity Diagnostic Contract

Add or reuse stable bounded diagnostics.

Required data:

```text
stable ID
category: mapping or geometry-mapping
status/severity
required or optional
design fact locator
mapping strategy
candidate count
bounded candidate summaries
reason
remediation
```

Example conceptual message:

```text
Required control-height fact maps to 2 visible input candidates. No element was selected automatically.
```

Remediation should request a more specific design-to-DOM locator or fixture selector map, not manual first-choice selection.

## 14. Candidate Summary Safety

Candidate summaries may include bounded metadata such as:

```text
tag name
role
input type
stable local selector if available
small normalized generic text preview only when safe
visible state
```

Do not include:

```text
full outerHTML
full textContent
personal data
form values
credentials
absolute private paths
```

For tests involving repeated labels, use synthetic generic values.

## 15. Mapping Ordering and Determinism

Candidate output ordering must be stable for diagnostics only.

Stable ordering may use:

```text
DOM position
semantic key
tag/role/local selector
```

Ordering must never imply selection.

Run the ambiguity scenario at least three times and compare normalized diagnostics.

## 16. Control-Height Contract Decision

Resolve DOC-001 according to design evidence.

For the official synthetic fixture:

```text
design input frame height = 40px
mapped rendered element = visible input/control border box
```

Therefore:

```text
control height is required
required=true
mismatch outside tolerance is blocking
missing mapping is non-green
ambiguous mapping is non-green
```

Do not downgrade documentation to optional merely to match current code.

## 17. Control Types and Evidence Strength

Required behavior applies only when all are true:

```text
literal design height exists
design node represents visible control box
DOM target can be deterministically mapped
rendered measurement is semantically equivalent
```

For other control types:

```text
native input with visible border box → required when evidenced
custom select wrapper → required only when visible wrapper mapping is proven
hidden native input → not the visible geometry target
fluid/unconstrained control → do not invent fixed width/height
```

If semantic equivalence is uncertain, the result must be unsupported/unverifiable or explicitly optional, not guessed.

## 18. Control-Height Comparison

Use rendered border-box height from `getBoundingClientRect()` or the existing normalized collected value.

Expected behavior with `40px` fact and `2px` tolerance:

```text
40.0 → pass
38.0 → pass
42.0 → pass
37.9 → visual-fail
42.1 → visual-fail
30.0 → visual-fail
missing → non-green mapping diagnostic
ambiguous → non-green mapping diagnostic
```

Use actual floating-point comparison without unsafe rounding that hides outside-boundary defects.

## 19. Required/Optional Aggregation Preservation

After changing control height to required, re-test aggregation:

```text
required control pass + optional warnings → pass with warnings
required control fail + optional pass → visual-fail
required control ambiguous + optional pass → non-green
required control missing + optional warnings → non-green
zero required checks → unverifiable
runtime/setup failure → outranks geometry
```

Do not let optional button/table warnings determine the blocking state.

## 20. No-Geometry False-Green Prevention

Preserve and test:

```text
requiredFactCount = 0
or executedRequiredCheckCount = 0
→ rendered result cannot be pass
```

Expected state should remain the established unverifiable/non-green state.

Do not count skipped or ambiguous optional checks as required evidence.

## 21. Browser-Level Ambiguity Tests

At least one regression test must use the real production browser path, not only a pure mapping helper.

Required browser scenarios:

```text
two visible controls matching one required design fact
one visible + one hidden duplicate
nested parent/child text duplicate
two optional buttons matching one optional fact
```

Assert final state and diagnostic.

## 22. Pure Mapping Unit Tests

Add focused unit tests for:

```text
zero candidates
one candidate
multiple candidates
hidden filtering
nested duplicate refinement
stable candidate ordering
bounded candidate summaries
```

Pure helper tests complement but do not replace browser-level tests.

## 23. Control-Height Boundary Tests

Add automated tests for:

```text
40
38
42
37.9
42.1
30
missing
ambiguous
```

Assert:

```text
state
required flag
severity
expected
actual
delta
tolerance
unit
diagnostic ID
```

## 24. Documentation Synchronization

Update active owning documentation to state exactly:

```text
literal input/control height mapped to the visible control border box is required
outside-tolerance mismatch is blocking
missing or ambiguous required mapping is non-green
optional button/table frame facts remain warning-only
mapping ambiguity never first-picks
```

Likely owners:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
```

Update `skill/SKILL.md` only if its current wording permits guessing or does not distinguish required versus optional rendered geometry.

Do not edit the historical independent verification report merely to replace its decision. The report must remain an independent record of the pre-correction state.

## 25. Fixture Privacy and Isolation

Use only synthetic fixture values.

Do not read or import root-level `tester.xml` in automated tests.

Do not modify the pre-existing privacy finding fixture in this patch.

Run a bounded privacy scan over changed fixtures and reports. Do not place personal values in commands, logs, or final response.

## 26. PR 6C Boundary

Do not implement or claim completion of:

```text
flex and structural gaps
table header/row/cell/footer density
pagination geometry
relative alignment
overflow and clipping
border width/style expansion
border radius
font fallback
complete typography roles
```

After this patch, the correct status remains:

```text
PR 6B may close after focused verification
PR 6C required: YES
Full PR 6 complete: NO
```

## 27. PR 6A Safety Non-Regression

Re-test or include relevant suites for:

```text
static verify launches no browser
static fail short-circuits render
unsafe viewport exits 2 before browser
external request is blocked and sanitized
runtime page error is non-green
target writes remain zero
temporary workspace cleanup
packaged render remains development-only/fixture-unavailable
```

The corrective patch must not change these contracts.

## 28. Existing Geometry Non-Regression

Verify:

```text
root padding
line height
divider thickness
text color
text size
text weight
optional button height
optional table frame height
```

Only control-height severity and ambiguity handling should change materially.

## 29. Determinism

Run at least three times:

```text
required ambiguous mapping
required control-height mismatch
optional ambiguous mapping
known-good fixture
```

Normalize only timestamps and temporary paths.

Assert stable:

```text
primary state
exit code
diagnostic ID
candidate count
candidate summary ordering
required/optional marker
expected/actual/delta/tolerance
```

## 30. Performance and Boundedness

Ensure ambiguity detection does not add unbounded DOM traversal or repeated browser round trips.

Prefer collecting bounded candidate metadata within the existing evaluate pass.

Measure:

```text
candidate count limit
candidate summary limit
browser evaluation count
known-good render median before/after
ambiguous fixture render time
```

Do not dump all matching nodes into diagnostics.

## 31. Read/Write Boundary

Dynamically confirm:

```text
target writes = 0
repository scans = 0
network escapes = 0
temporary files under /tmp
generated repository artifacts = 0
```

Do not alter package dependencies or lockfiles.

## 32. Required Tests Checklist

### MAP-001

- [ ] Required zero candidate is non-green.
- [ ] Required unique candidate measures normally.
- [ ] Required multiple visible candidates are ambiguous and non-green.
- [ ] No `els[0]` or equivalent first-pick remains.
- [ ] Hidden duplicate does not create false ambiguity when one visible candidate remains.
- [ ] Nested duplicate is resolved only by documented semantic refinement.
- [ ] Unresolved nested ambiguity remains non-green.
- [ ] Optional ambiguity warns/skips and does not block.
- [ ] Candidate summaries are bounded.
- [ ] Diagnostics deterministic.

### DOC-001

- [ ] Control height is required for literal visible control-box facts.
- [ ] 40px passes.
- [ ] 38px passes.
- [ ] 42px passes.
- [ ] 37.9px fails.
- [ ] 42.1px fails.
- [ ] 30px fails.
- [ ] Missing control is non-green.
- [ ] Ambiguous control is non-green.
- [ ] Diagnostic marks fact required.
- [ ] Documentation matches source.

### Aggregation

- [ ] Optional warning alone does not block complete required evidence.
- [ ] Required mapping error cannot pass.
- [ ] Zero required checks cannot pass.
- [ ] Runtime/setup failure still outranks geometry.

### Non-regression

- [ ] Existing geometry tests pass.
- [ ] PR 6A safety tests pass.
- [ ] Static verify tests pass.
- [ ] Full suite passes except pre-existing skips.

## 33. Validation Commands

Before source changes:

```bash
git status --short
git rev-parse HEAD
git log -1 --oneline
node --version
npm --version
```

Baseline:

```bash
node --test test/render-geometry.test.mjs
node --test test/render-verify.test.mjs
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
```

After implementation, run `node --check` on all changed/new source and test files.

Focused suite:

```bash
node --test \
  test/render-geometry.test.mjs \
  test/render-verify.test.mjs \
  test/verify.test.mjs \
  test/verify-root.test.mjs
```

Run existing render-mount/probe tests by actual filenames.

Relevant combined suite must include:

```text
render geometry
render verify
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

## 34. Focused Re-Verification Matrix

After implementation, perform focused re-verification.

Required scenarios:

```text
known-good unique control
required repeated visible controls
visible + hidden duplicate
nested duplicate
required missing control
optional repeated buttons
control 37.9px
control 38px
control 40px
control 42px
control 42.1px
control 30px
zero required geometry facts
line-height required defect
network attempt
runtime error
invalid viewport
```

For each record:

```text
state
exit code
mapping status
candidate count
required/optional
diagnostic ID
expected/actual/delta/tolerance
cleanup result
target mutation
```

## 35. Focused Re-Verification Decision

Required final decision:

```text
PR 6B corrective patch: PASS / FAIL
MAP-001: RESOLVED / UNRESOLVED
DOC-001: RESOLVED / UNRESOLVED
Silent first-pick removed: YES / NO
Control height required: YES / NO
Required ambiguity non-green: YES / NO
Optional ambiguity non-blocking: YES / NO
PR 6B may close: YES / NO
PR 6C required: YES
Full PR 6 complete: NO
```

## 36. Documentation Impact

After changes, state:

```text
Documentation sync: clear.
```

only if:

- API contract matches required control-height behavior;
- verify trust guide matches mapping ambiguity behavior;
- skill does not encourage guessing;
- PR 6C boundary remains explicit;
- full PR 6 is not called complete.

Otherwise list the stale document and exact required update.

## 37. Git and Safety Rules

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

Do not stage or import root-level `tester.xml`.

Do not modify pre-existing privacy fixtures as part of this patch.

Do not modify the real target project.

Do not commit or push. PR 6B requires focused re-verification first.

Record initial and final status and source hashes.

## 38. Work Sequence

### Phase 1: Gate and reproduce

- read independent verification report;
- confirm findings;
- reproduce MAP-001 and DOC-001;
- run baseline tests.

### Phase 2: Root-cause note

Before coding, state:

```text
first-pick root cause
candidate filtering behavior
nested duplicate strategy
mapping result contract
required/optional ambiguity states
control-height evidence and required decision
files to change
tests
```

### Phase 3: Explicit mapping result

- unique/missing/ambiguous/unsupported;
- visible candidate filtering;
- nested duplicate refinement;
- bounded candidate summaries;
- no first-pick.

### Phase 4: Aggregation and diagnostics

- required mapping non-green;
- optional mapping warning/skip;
- stable diagnostic;
- zero-required safeguard.

### Phase 5: Control-height contract

- required true for literal visible control box;
- tolerance boundary correctness;
- missing/ambiguous non-green.

### Phase 6: Tests and browser scenarios

- unit boundaries;
- browser ambiguity;
- hidden/nested duplicates;
- determinism;
- PR 6A regression;
- full suite.

### Phase 7: Documentation and focused re-verification

- synchronize owning docs;
- record closure decision;
- keep PR 6C separate.

## 39. Required Final Response

### Entry Gate

```text
PR 6B verification decision:
MAP-001 confirmed:
DOC-001 confirmed:
Other blockers:
```

### Pre-Fix Reproduction

```text
Required candidate count:
Selected candidate:
First-pick observed:
Resulting state:
Control-height required flag:
Outside-tolerance state:
Documentation contract:
```

### Root Cause

Include paths, symbols, selection logic, aggregation behavior, and documentation ownership.

### Corrective Patch Summary

Describe only the minimum changes.

### Files Changed

Group source, tests/fixtures, skill/docs, verification reports, and excluded prompts/`tester.xml`.

### Mapping Contract After Fix

```text
zero candidates:
one candidate:
multiple required candidates:
multiple optional candidates:
hidden duplicates:
nested duplicates:
candidate summary bound:
```

### Control-Height Contract After Fix

```text
fact classification:
required flag:
box measured:
tolerance:
missing mapping:
ambiguous mapping:
outside-tolerance mismatch:
```

### Diagnostics

Provide representative ambiguity and control-height diagnostics without personal data.

### Validation

List exact commands and results.

### Determinism and Performance

```text
known-good runs:
ambiguity runs:
control-defect runs:
candidate ordering:
render median:
browser evaluation count:
```

### Isolation and PR 6A Safety

```text
target writes:
repository scans:
network escapes:
static browser launches:
viewport safety:
runtime-fail behavior:
```

### Focused Re-Verification Decision

```text
PR 6B corrective patch: PASS / FAIL
MAP-001: RESOLVED / UNRESOLVED
DOC-001: RESOLVED / UNRESOLVED
Silent first-pick removed: YES / NO
Control height required: YES / NO
Required ambiguity non-green: YES / NO
Optional ambiguity non-blocking: YES / NO
PR 6B may close: YES / NO
PR 6C required: YES
Full PR 6 complete: NO
```

### Deferred Work

Keep separate:

```text
PR 6C remaining geometry families
FIX-001 privacy sanitization for pre-existing fixture
font-fallback detection
broader selector-map geometry coverage
```

### Documentation Sync

Use `Documentation sync: clear.` or list stale docs.

### Git Status

Include exact `git status --short`. Do not commit.

## 40. Definition of Done

The corrective patch is complete only when no geometry mapper silently first-picks an ambiguous DOM match, required zero/ambiguous mappings are deterministically non-green, optional ambiguity remains visible but non-blocking, hidden and nested duplicates are handled through documented semantic rules, literal visible control height is consistently required in code and documentation, outside-tolerance control mismatch produces visual-fail, zero required checks cannot green, diagnostics are bounded and stable, browser-level regression tests pass, PR 6A safety remains intact, the full suite passes, and focused re-verification authorizes or blocks PR 6B closure while PR 6C remains explicitly required and full PR 6 remains incomplete.

Start by reproducing MAP-001 and DOC-001. Do not modify source until both findings are recorded with actual output.
