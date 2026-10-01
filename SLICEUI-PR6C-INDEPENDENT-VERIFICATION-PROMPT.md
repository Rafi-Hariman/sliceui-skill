# SliceUI PR 6C Independent Verification Plan: Full Rendered Geometry Closure

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

Required documents:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
docs/SLICEUI-PR4-VERIFICATION-REPORT.md
docs/SLICEUI-PR5-VERIFICATION-REPORT.md
docs/SLICEUI-PR6-VERIFICATION-REPORT.md
docs/SLICEUI-PR6B-VERIFICATION-REPORT.md
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
docs/project-docs/foundation/status.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
SLICEUI-PR6C-COMPLETE-RENDERED-GEOMETRY-IMPLEMENTATION-PLAN.md
SLICEUI-PR6C-DECISION-NOTE.md
```

If the decision note has a different location, locate it by exact filename. Do not modify it.

Secondary context:

```text
SLICEUI-PR6-INDEPENDENT-VERIFICATION-CHECKLIST.md
SLICEUI-PR6B-INDEPENDENT-VERIFICATION-CHECKLIST.md
SLICEUI-PR6B-CORRECTIVE-PATCH-DOM-MAPPING-CONTROL-CONTRACT.md
```

Source code, active documentation, committed checkpoints, and verification reports are more authoritative than planning prompts.

## 1. Verification Objective

Independently verify the PR 6C implementation and decide whether:

```text
PR 6C is correct and ready to close,
full PR 6 may close after the PR 6C checkpoint,
or a corrective patch is required.
```

This is the final planned rendered-geometry verification phase. The verification must examine both:

1. Correctness of implemented PR 6C checks.
2. Validity of every `unsupported-no-evidence` disposition.

Do not treat an unsupported disposition as implemented. Do not fail an evidence-safe implementation merely because facts unavailable from the parser/transcript were not invented.

## 2. Read-Only Safety Rules

This task is read-only for implementation source, tests, fixtures, active documentation, skill, decision notes, and prior reports.

Only create:

```text
docs/SLICEUI-PR6C-VERIFICATION-REPORT.md
```

All temporary projects, fixture variants, screenshots, traces, browser profiles, and outputs must stay under:

```text
/tmp/sliceui-pr6c-verification-<timestamp>/
```

Do not:

- modify source, tests, or fixtures;
- modify active documentation or skill;
- modify the PR 6C decision note;
- modify previous verification reports;
- fix findings;
- commit, stage, or push;
- use a global/on-PATH SliceUI binary;
- modify the real target project;
- read root `tester.xml` into automated tests;
- reproduce personal data in logs or the report;
- start another geometry phase;
- accept a PASS based only on existing tests.

## 3. Required Final Decisions

The final report must answer:

```text
PR 6C: PASS / CONDITIONAL PASS / FAIL
PR 6C may close: YES / NO
Corrective patch required: YES / NO
NOEV dispositions valid: YES / NO
Table-density limitation blocks closure: YES / NO
Selector maps locator-only: YES / NO
Overflow policy evidence-safe: YES / NO
PR 6A and PR 6B safeguards preserved: YES / NO
Full PR 6 may close after checkpoint: YES / NO
Next phase may start: YES / NO
```

Core guarantees:

```text
Fixture privacy preserved:
Design oracle independent:
Selector-map schema safe:
Required selector missing/ambiguous non-green:
Zero-required guard preserved:
Gap checks reliable:
Table typography/density disposition valid:
Pagination/alignment disposition valid:
Overflow defects blocking:
Expected-scroll exception not invented:
Valid-truncation exception not invented:
Border/radius checks reliable:
Font/typography checks evidence-safe:
Diagnostics stable and measurable:
Browser determinism proven:
Target writes zero:
Static verify non-regression:
PR 1-6B non-regression:
status.md accurate:
```

## 4. Implementation Claims to Reproduce

PR 6C reports implementation of:

```text
required structural/flex gap
required border width
required border color
required uniform and corner radius
required letter spacing
required role font size
required role font weight
required font family
required objective horizontal overflow
optional table-frame evidence
optional button-height evidence
all PR 6A/PR 6B checks
```

Reported `unsupported-no-evidence` families:

```text
table header/body row height
table cell padding
border style
non-space-between alignment relations
expected-scroll intent
valid ellipsis/truncation intent
```

Reported out-of-scope or unsupported families requiring scrutiny:

```text
button proportions
pagination/table alignment relations
```

Reported validation baseline:

```text
focused: 214 pass / 0 fail / 0 skip
full: 507 tests / 504 pass / 3 pre-existing skips / 0 fail
known-good browser runs: pass x3
known defect browser runs: visual-fail x3
```

Do not accept these claims without independent reproduction.

## 5. Baseline and Source Integrity

Run:

```bash
git status --short
git rev-parse HEAD
git log -10 --oneline
node --version
npm --version
```

Checklist:

- [ ] Confirm `60a0835` is HEAD or a direct ancestor.
- [ ] Confirm PR 6A and PR 6B are committed.
- [ ] Classify all modified and untracked paths.
- [ ] Confirm root planning prompts are known exclusions.
- [ ] Confirm root `tester.xml` is untracked and excluded.
- [ ] Stop if unknown changes exist.
- [ ] Record real-target status.
- [ ] Hash every PR 6C source, test, fixture, documentation, skill, status, and decision-note file before verification.
- [ ] Confirm no new screenshot or generated `.sliceui` artifact exists in the repository.

Suggested source set, adjusted to the actual diff:

```text
src/framework/angular/render-geometry.mjs
src/framework/angular/render-verify.mjs
src/framework/angular/selector-map.mjs
test/render-geometry.test.mjs
test/render-verify.test.mjs
test/selector-map.test.mjs
test/fixtures/render-geometry/structural/
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/status.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
SLICEUI-PR6C-DECISION-NOTE.md
```

## 6. Privacy and Fixture Review

Verify:

```text
root tester.xml = private local-only input
committed PR 6C fixtures = synthetic official fixtures
```

Checklist:

- [ ] Root `tester.xml` is not imported by source or tests.
- [ ] Root `tester.xml` is not copied into fixture directories.
- [ ] Root `tester.xml` remains untracked.
- [ ] Synthetic fixtures contain only generic values.
- [ ] No personal data is copied into selector maps, screenshots, diagnostics, or reports.
- [ ] No production financial or identity data appears in fixture files.
- [ ] Fixture variants are deterministic and network-free.

Use the known privacy-pattern scan from prior verification, but do not reproduce personal values in the final report.

`FIX-001` remains a separate privacy task. Do not change or verify it as part of PR 6C beyond confirming no regression.

## 7. Architecture and Call Graph

Audit:

```text
src/framework/angular/selector-map.mjs
src/framework/angular/render-geometry.mjs
src/framework/angular/render-verify.mjs
src/commands/verify.mjs
PR 6C tests and structural fixtures
```

Reconstruct:

```text
transcript/XML facts
→ selector-map validation
→ expected-fact extraction
→ PR 6A isolated render
→ bounded DOM collection
→ selector/text mapping
→ geometric/style comparison
→ required/optional/NOEV aggregation
→ render state and diagnostics
```

Confirm:

- [ ] Selector maps are validated before browser launch where possible.
- [ ] Invalid maps exit non-green deterministically.
- [ ] Browser collection remains bounded.
- [ ] Geometry comparison cannot bypass PR 6A failure states.
- [ ] Runtime/setup failures outrank geometry results.
- [ ] Required mismatches produce visual-fail.
- [ ] Unsupported rows do not count as pass.

## 8. Design Oracle Independence

Search for use of:

```text
resolved.json
spec.md
agent-context
behaviorBindings
sample/showcase defaults
selector-map expected values
```

Verify:

- [ ] Expected geometry comes only from transcript/XML literal or structural facts.
- [ ] Selector maps contain locators only.
- [ ] Selector maps do not carry dimensions, values, expected state, allowed overflow, or valid truncation intent.
- [ ] Screenshots are not numeric geometry oracles.
- [ ] Existing rendered output is not baseline truth.
- [ ] Project defaults are not treated as design facts.

Any selector-map field that supplies expected geometry or semantic intent is a blocking finding.

## 9. Selector-Map Schema Verification

Reconstruct the schema from source.

Expected conceptual shape:

```json
{
  "version": 1,
  "mappings": [
    {
      "designNodeId": "node-id",
      "renderLocator": {
        "strategy": "css",
        "selector": "[data-sliceui-fixture='target']"
      },
      "required": true
    }
  ]
}
```

Verify validation of:

- [ ] Supported version.
- [ ] Object and array shape.
- [ ] Unique design-node mapping.
- [ ] Supported locator strategy.
- [ ] Non-empty selector.
- [ ] Selector length bound.
- [ ] Rejection of URLs, absolute paths, script-like content, angle-bracket markup, `javascript:`, or `eval` patterns.
- [ ] Rejection of expected-value fields at all levels.
- [ ] Rejection of duplicate required mappings.
- [ ] Stable diagnostic for invalid map.
- [ ] Invalid map prevents browser launch.

Test nested or obfuscated expected fields, not only obvious top-level properties.

## 10. Selector-Map Resolution Semantics

Dynamically test:

```text
unique required target
missing required target
ambiguous required target
unique optional target
missing optional target
ambiguous optional target
hidden duplicate
nested duplicate
```

Required behavior:

```text
required missing → non-green
required ambiguous → non-green
optional missing → skip
optional ambiguous → warning or skip
unique → measure
```

No raw first-pick may exist.

Candidate summaries must be bounded and privacy-safe.

## 11. Coverage Matrix Reconstruction

Reconstruct from source, not from the implementation summary.

For every family record:

```text
implemented / partial / unsupported-no-evidence / out-of-scope
expected-fact source
mapping strategy
required / optional
blocking / warning / skip
tolerance
diagnostic ID
test coverage
```

Families:

```text
gap and spacing
table header typography
table body typography
table row height
table cell padding
table footer facts
pagination geometry
alignment relations
overflow-x
overflow-y
text clipping
expected scrolling
valid truncation
border width
border style
border color
uniform radius
per-corner radius
font family
font fallback
role font size
role font weight
role line height
letter spacing
button proportions
```

No family may disappear from the verification report.

## 12. NOEV Disposition Contract

Verify the implementation has an explicit status or report disposition for unsupported facts.

Required NOEV properties:

```text
family
classification: unsupported-no-evidence
reason
evidence limitation
handling
```

NOEV must:

- remain visible in coverage output or documentation;
- never produce an invented numeric expected value;
- never count as an executed required check;
- never count as a pass;
- not automatically make an otherwise evidence-complete run fail;
- not be silently described as implemented.

## 13. Table Density Limitation

Independently inspect parser and transcript behavior.

Verify:

- [ ] `figml-parse.mjs` exposes no defensible table row node type, row height fact, or cell-padding fact.
- [ ] Transcript fixture exposes no row-height or cell-padding expected values.
- [ ] Overall table frame height cannot validly derive average row height.
- [ ] No implementation divides container height by row count.
- [ ] Header/body typography facts that do exist are checked.
- [ ] Table-frame height remains optional and is not called row-density coverage.
- [ ] Row height and cell padding are marked unsupported-no-evidence.
- [ ] Unsupported rows do not satisfy required geometry evidence.

Decision:

```text
Evidence-backed table density complete: YES / NO
Numeric row/cell density unsupported safely: YES / NO
Limitation blocks full PR 6 closure: YES / NO
```

A parser expansion is outside PR 6C and must not be retroactively required if no defensible fact exists.

## 14. Border Style Limitation

Verify whether the parser/transcript provides stroke style independently from width and color.

Required:

- [ ] Border width expected fact is defensible.
- [ ] Border color expected fact is defensible.
- [ ] Border style has no fact if marked NOEV.
- [ ] No style such as `solid` is assumed from browser defaults.
- [ ] Border-style NOEV is visible and not counted as pass.

## 15. Alignment Limitation

Verify the claim that the parser exposes only `space-between` through `justifyContentOf`, or equivalent limited structural evidence.

Check:

- [ ] Implemented alignment relations are backed by transcript/XML.
- [ ] Non-evidenced left/right/center relations are not invented.
- [ ] Absolute canvas coordinates are not reused as component-internal alignment.
- [ ] Unsupported relations are explicit NOEV or out-of-scope.
- [ ] Locator maps do not carry expected alignment.

Determine whether pagination/table alignment is truly evidence-blocked or merely unimplemented despite available structural facts.

## 16. Gap Measurement Verification

Verify semantic axis handling:

```text
row layout → column-gap
column layout → row-gap
gap: row-gap column-gap shorthand
```

Test:

- [ ] Known-good gap passes.
- [ ] Inside tolerance passes.
- [ ] At tolerance passes.
- [ ] Just outside tolerance fails.
- [ ] Large mismatch fails.
- [ ] Horizontal/vertical axes are not reversed.
- [ ] Hidden siblings do not affect mapping.
- [ ] Gap and margin are not double-counted.
- [ ] Missing/ambiguous required targets are non-green.

Diagnostic must include expected, actual, delta, tolerance, unit, axis, and locators.

## 17. Border Width and Color Verification

Test:

```text
known-good width and color
inside/at/outside width tolerance
wrong color
transparent/alpha color
side-specific border
different visible DOM layer
```

Verify:

- [ ] Correct border side is measured.
- [ ] Width uses centralized tolerance.
- [ ] Color comparison is normalized and exact where deterministic.
- [ ] Expected and actual are not reversed.
- [ ] Required mismatch is blocking.
- [ ] Border style is not overclaimed.

## 18. Radius Verification

Test:

```text
uniform known-good radius
inside/at/outside tolerance
large mismatch
per-corner mismatch
CSS shorthand
elliptical radius if supported
wrong DOM layer
```

Verify:

- [ ] Uniform design radius checks all required corners when appropriate.
- [ ] Corner-specific facts map correctly.
- [ ] Radius uses centralized tolerance.
- [ ] Wrong nested layer is not measured.
- [ ] Required mismatch blocks.

## 19. Letter-Spacing Verification

Test:

```text
known-good
inside tolerance
at tolerance
just outside tolerance
normal
unit conversion if supported
```

Verify:

- [ ] Expected evidence exists.
- [ ] `normal` is handled honestly.
- [ ] Required mismatch blocks.
- [ ] Diagnostic reports pixel or normalized unit accurately.

## 20. Role Typography Verification

Reconstruct supported roles from source:

```text
heading
label
body
helper
table header/body
button
status
footer
pagination
```

For each claimed role verify:

- [ ] Design role evidence exists.
- [ ] Locator is unique or ambiguity-safe.
- [ ] Expected font size/weight/line height/color/letter spacing comes from transcript/XML.
- [ ] Missing required role is non-green.
- [ ] Unsupported role is visible as NOEV rather than pass.
- [ ] HTML tag name alone is not the semantic oracle.

## 21. Font-Family and Fallback Verification

Check the source of expected font family.

Verify:

- [ ] Expected family comes from literal design/project evidence.
- [ ] `document.fonts.ready` is awaited.
- [ ] Computed family is recorded.
- [ ] If the required family is unavailable, state is degraded/unverifiable or another documented non-green state.
- [ ] Generic fallback alone does not count as expected font loaded.
- [ ] No external font is downloaded.
- [ ] No local private font path is exposed.
- [ ] No evidence means explicit unsupported, not invented expectation.

If reliable expected-font evidence is absent, a font-family required check would be a finding.

## 22. Objective Overflow Policy

Verify objective overflow measurements:

```text
scrollWidth > clientWidth beyond tolerance
scrollHeight > clientHeight beyond tolerance
required content outside mapped container
required content outside viewport
required text clipped
```

Required policy:

- objective required overflow defect → visual-fail;
- missing/ambiguous required target → non-green;
- `overflow:hidden` alone → never fails;
- no semantic exception is inferred without design evidence.

Test:

- [ ] Equal dimensions pass.
- [ ] Overflow within tolerance passes.
- [ ] Horizontal overflow outside tolerance fails.
- [ ] Vertical overflow outside tolerance fails if implemented/claimed.
- [ ] Required mapped element outside container fails.
- [ ] `overflow:hidden` without measurable clipping passes.
- [ ] Diagnostic reports client, scroll, delta, tolerance, and overflow mode.

## 23. Expected-Scroll NOEV

Verify:

- [ ] Transcript/XML provides no scroll-intent fact.
- [ ] Selector maps cannot carry `expectedScroll`, `allowOverflow`, or equivalent.
- [ ] Expected table scrolling is marked unsupported-no-evidence.
- [ ] Unexpected measured overflow is not excused by table semantics alone.
- [ ] NOEV exception does not count as pass.

If table content overflows and no design evidence permits scrolling, the result should be blocking under the selected policy.

## 24. Valid-Truncation NOEV

Verify:

- [ ] Transcript/XML provides no truncation/ellipsis intent.
- [ ] Selector maps reject `validTruncation`, `ellipsisExpected`, or equivalent fields.
- [ ] `text-overflow: ellipsis` alone does not prove valid design intent.
- [ ] Clipped required text without evidence is blocking.
- [ ] No clipping means ellipsis styling alone is not a defect.
- [ ] Valid-truncation exception is explicit unsupported-no-evidence.

## 25. Required/Optional/NOEV Aggregation

Create scenarios:

```text
all required pass + optional pass
all required pass + optional warning
required fail + optional pass
required mapping missing
required mapping ambiguous
zero required facts
zero executed required checks
only optional checks
required checks pass + NOEV rows
runtime-fail + geometry pass
```

Verify:

- [ ] Required pass with optional warning may pass.
- [ ] Required mismatch produces visual-fail.
- [ ] Required missing/ambiguous is non-green.
- [ ] Zero required/executed required is unverifiable.
- [ ] Optional-only evidence cannot pass.
- [ ] NOEV rows neither pass nor fail by themselves.
- [ ] Runtime/setup failure outranks geometry.

## 26. Diagnostics Contract

For each implemented family inspect representative pass/fail diagnostics.

Required fields where applicable:

```text
stable ID
category
required/optional marker
design fact locator
DOM locator/mapping strategy
semantic measurement type
expected
actual
delta
tolerance
unit
sample count/range if aggregated
trust source
remediation
```

Verify deterministic ordering and bounded evidence.

## 27. Browser Determinism

Run complete known-good structural fixture at least three times.

Run at least two defect fixtures three times, including:

```text
one objective geometry/style mismatch
one overflow or mapping failure
```

Assert stable:

```text
state
exit code
check IDs
mapping results
expected/actual values
NOEV rows
ordering
screenshot dimensions
```

The implementation reports zero variance. Reproduce independently.

## 28. Performance and Boundedness

Measure:

```text
browser evaluations
mapped fact count
candidate summary bound
render median
geometry collection duration
comparison duration
sample count
```

Verify:

- [ ] One bounded browser collection pass or equivalent bounded architecture.
- [ ] No property-by-property browser round trips.
- [ ] Fact count per family is bounded.
- [ ] Candidate summaries remain bounded.
- [ ] No repository scan.
- [ ] No unbounded wait.

## 29. PR 6A Safety Regression

Reproduce:

- [ ] Static verify launches no browser.
- [ ] Static failure short-circuits render.
- [ ] Invalid oversized viewport exits 2 before browser.
- [ ] External request is blocked and sanitized.
- [ ] Runtime page error is non-green.
- [ ] Temporary workspace is cleaned.
- [ ] Target project remains unchanged.
- [ ] Packaged render remains development-only/fixture-unavailable.

## 30. PR 6B Safety Regression

Reproduce:

- [ ] Required ambiguity is non-green.
- [ ] Optional ambiguity is non-blocking.
- [ ] No silent first-pick.
- [ ] Literal control height remains required.
- [ ] Outside-tolerance control height is visual-fail.
- [ ] Zero required/executed required stays unverifiable.
- [ ] Existing root padding, line-height, divider, and text-style checks still work.

## 31. Static Verify Non-Regression

Compare static behavior against checkpoint `60a0835`:

```text
browser launch count
project read set
exit state
check count
human output
elapsed median
```

Confirm PR 6C modules are not loaded on the static path where avoidable.

## 32. Target and Temporary Isolation

Trace one known-good and one defect render.

Record:

```text
target reads
target writes
repository writes
/tmp writes
.sliceui writes
network attempts/blocks
browser and child processes
```

Required:

- target writes zero;
- no repository scans;
- no network escapes;
- no npm install;
- temporary files contained and cleaned;
- browser/process cleanup complete.

## 33. status.md Historical Accuracy

Review every changed status claim against actual checkpoints:

```text
PR 4: a6fd181
PR 5: 2617638
PR 6A: 0394317
PR 6B: 60a0835
PR 6C: implemented, currently uncommitted and independently unverified
Full PR 6: incomplete until this verification and checkpoint
```

Verify:

- [ ] No committed PR is described as uncommitted.
- [ ] No hash is wrong.
- [ ] PR 6C is not described as officially complete.
- [ ] Full PR 6 is not prematurely complete.
- [ ] No unrelated roadmap status was changed without evidence.
- [ ] Historical corrections are factual, not speculative.

Any unsupported status rewrite is a documentation finding.

## 34. Documentation and Skill Accuracy

Audit:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/status.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
README.md
docs/SLICEUI-OVERVIEW.md
```

Verify:

- implemented families are accurate;
- NOEV families are explicit;
- table row/cell density is not overclaimed;
- border style is not overclaimed;
- alignment limits are explicit;
- expected scroll/truncation are not claimed as validated;
- selector maps are locator-only;
- overflow defect policy is accurate;
- font-family evidence requirements are accurate;
- full PR 6 remains unclosed before checkpoint;
- no privacy-sensitive content appears.

## 35. Automated Test Quality Review

Audit PR 6C tests for:

```text
selector-map schema failures
expected-field rejection
unique/missing/ambiguous mapping
gap axis and boundaries
border/radius boundaries
letter spacing
typography roles
font fallback
objective overflow
expected-scroll NOEV
valid-truncation NOEV
NOEV aggregation
zero-required guard
real-browser three-run determinism
PR 6A/6B regressions
```

Flag tests that:

- test only helpers where browser behavior is claimed;
- omit exact state or exit assertions;
- use selector maps as expected-value sources;
- treat NOEV as pass;
- lack negative security/schema cases;
- never test zero required evidence;
- fail to test overflow exceptions safely.

## 36. Re-run Tests

Run actual files discovered in the repository, including at minimum:

```bash
node --test test/render-geometry.test.mjs
node --test test/render-verify.test.mjs
node --test test/selector-map.test.mjs
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
```

Run existing render mount/probe and Pilar mount tests by actual filename.

Run a combined suite containing:

```text
render geometry
render verify
selector maps
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

Run `node --check` for all changed/new source and test files.

Record exact pass/fail/skip counts.

## 37. Temporary E2E Matrix

Use:

```bash
TMP_ROOT="/tmp/sliceui-pr6c-verification-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Use repository CLI explicitly:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs verify <dir> [name] --render
```

Required scenarios:

```text
complete known-good structural fixture
gap defect
border-width defect
border-color defect
radius defect
letter-spacing defect
font-size-role defect
font-weight-role defect
font-family/fallback scenario
horizontal overflow defect
overflow:hidden without clipping
expected-scroll NOEV
valid-truncation NOEV
invalid selector map
selector target missing
selector target ambiguous
zero required facts
only optional facts
network attempt
runtime failure
invalid viewport
```

For each record:

```text
state
exit code
checks executed
NOEV rows
mapping state
expected/actual/delta/tolerance
warnings/skips
browser cleanup
target mutation
```

## 38. Decision Rules: PASS

PR 6C may receive PASS only if:

- all implemented checks are evidence-backed and deterministic;
- selector maps are locator-only and safe;
- NOEV dispositions are factually valid;
- no fake expected values exist;
- table row/cell limitation is genuinely evidence-blocked;
- objective overflow defects are blocking;
- expected scroll/truncation intent is not invented;
- required/optional/NOEV aggregation is correct;
- PR 6A and PR 6B safeguards are preserved;
- tests and full suite pass;
- active documentation and `status.md` are accurate;
- no private data or target mutation exists.

## 39. Decision Rules: CONDITIONAL PASS

Use when:

- foundational implementation is correct;
- one or more focused non-catastrophic defects remain;
- no broad redesign is required;
- a corrective patch must complete before checkpoint.

## 40. Decision Rules: FAIL

Use if:

- selector maps supply expected values or semantic exceptions;
- required missing/ambiguous mapping can pass;
- zero required checks can pass;
- NOEV is counted as implemented/pass;
- table density expectations are invented;
- overflow exceptions are invented without evidence;
- objective required overflow passes;
- browser results are non-deterministic;
- PR 6A/6B safety regresses;
- target project is modified;
- status documentation materially misrepresents checkpoints;
- fixtures/report contain private data.

## 41. Full PR 6 Closure Rule

Full PR 6 may close after checkpoint only if:

```text
PR 6A complete
PR 6B complete
PR 6C independently passes
all evidence-backed geometry implemented
all unavailable facts have valid explicit NOEV dispositions
no fake oracle introduced
no known blocking finding remains
```

A valid NOEV disposition does not require a PR 6D.

Do not recommend another geometry phase merely because the parser does not expose nonexistent facts. Parser metadata expansion may remain a future enhancement.

## 42. Finding Format

Severity:

```text
Critical
High
Medium
Low
Informational
```

Prefixes:

```text
FIX fixture/privacy
ORC oracle independence
MAP selector mapping
SCH selector-map schema
NOE unsupported-no-evidence
GAP spacing
TBL table density
ALI alignment
OVF overflow/truncation
BOR border
RAD radius
FNT font
TYP typography
AGG aggregation
DIA diagnostics
DET determinism
SAF PR 6A/6B safety
ISO isolation
PER performance
STA status documentation
DOC documentation/skill
TST test quality
REG prior PR regression
SCP scope closure
```

Every material finding must include:

```text
Finding ID
Severity
Status: Confirmed / Strong evidence / Suspected / Not found / Unable to verify
Evidence: path, symbol, line, command, output
Impact
Required correction
Blocks PR 6C closure: yes/no
Blocks full PR 6 closure: yes/no
```

## 43. Verification Report Output

Create only:

```text
docs/SLICEUI-PR6C-VERIFICATION-REPORT.md
```

Required report structure:

```markdown
# SliceUI PR 6C Verification Report

## 1. Executive Decision
## 2. Scope and Environment
## 3. Git and Source Integrity Baseline
## 4. Fixture Privacy
## 5. Architecture and Oracle Independence
## 6. Selector-Map Schema
## 7. Selector Resolution and Ambiguity
## 8. Coverage Matrix
## 9. NOEV Contract
## 10. Table-Density Limitation
## 11. Alignment Limitation
## 12. Gap Verification
## 13. Border Verification
## 14. Radius Verification
## 15. Letter Spacing
## 16. Typography Roles
## 17. Font Family and Fallback
## 18. Objective Overflow and Clipping
## 19. Expected-Scroll NOEV
## 20. Valid-Truncation NOEV
## 21. Required/Optional/NOEV Aggregation
## 22. Diagnostic Contract
## 23. Browser Determinism
## 24. Performance and Boundedness
## 25. PR 6A Safety Regression
## 26. PR 6B Safety Regression
## 27. Static Verify Regression
## 28. Target and Temporary Isolation
## 29. status.md Historical Accuracy
## 30. Documentation and Skill Assessment
## 31. Test Quality Review
## 32. Tests Re-run
## 33. E2E Scenario Matrix
## 34. PR 1-6B Non-Regression
## 35. Diff and Scope Review
## 36. Findings by Severity
## 37. Acceptance Checklist
## 38. Required Corrective Patch
## 39. Full PR 6 Closure Decision
## 40. Final Recommendation
## Appendix A: Commands Executed
## Appendix B: Selector-Map Validation Matrix
## Appendix C: Raw Geometry Results
## Appendix D: NOEV Disposition Matrix
## Appendix E: Privacy Scan
## Appendix F: Source Hashes and Git Status
```

## 44. End-of-Task Integrity

Before final response:

- [ ] Re-run source hashes and compare start/end.
- [ ] Confirm source/tests/fixtures/docs/skill/status/decision note unchanged.
- [ ] Confirm only the PR 6C verification report was added.
- [ ] Confirm root `tester.xml` remains unchanged and untracked.
- [ ] Confirm no personal data copied into report.
- [ ] Run SliceUI `git status --short`.
- [ ] Run real-target `git status --short`.
- [ ] Confirm no screenshot/binary or `.sliceui` artifact was added.
- [ ] Confirm temporary artifacts remain under `/tmp`.
- [ ] Do not commit or push.

## 45. Required Final Response

### Decision

```text
PR 6C: PASS / CONDITIONAL PASS / FAIL
PR 6C may close: YES / NO
Corrective patch required: YES / NO
NOEV dispositions valid: YES / NO
Table-density limitation blocks closure: YES / NO
Selector maps locator-only: YES / NO
Overflow policy evidence-safe: YES / NO
PR 6A and PR 6B safeguards preserved: YES / NO
Full PR 6 may close after checkpoint: YES / NO
Next phase may start: YES / NO
```

### Core Guarantees

```text
Fixture privacy preserved:
Design oracle independent:
Selector-map schema safe:
Required selector missing/ambiguous non-green:
Zero-required guard preserved:
Gap checks reliable:
Table-density disposition valid:
Overflow defects blocking:
Expected-scroll intent not invented:
Valid-truncation intent not invented:
Border/radius checks reliable:
Font/typography checks evidence-safe:
Diagnostics stable:
Browser determinism proven:
Target writes zero:
Static verify non-regression:
PR 1-6B non-regression:
status.md accurate:
```

### Implemented Coverage

List every implemented evidence-backed family.

### Unsupported-NOEV Coverage

List each family, evidence limitation, and closure impact.

### Key Evidence

Summarize selector-map tests, geometry/overflow defects, NOEV validation, browser determinism, status review, isolation, and full-suite outcome.

### Blocking Findings

List or `None`.

### Non-Blocking Findings

List factual limitations and future enhancements.

### Required Corrective Patch

State exact work. Do not implement it.

### Full PR 6 Closure Decision

State whether full PR 6 may close after PR 6C checkpoint and why.

### Report

```text
docs/SLICEUI-PR6C-VERIFICATION-REPORT.md
```

### Validation

List exact principal commands and results.

### Git Status

Show exact SliceUI and real-target status.

Do not implement corrections, commit, or push.

## 46. Definition of Done

Independent verification is complete only when it proves or disproves selector-map safety, oracle independence, implemented PR 6C geometry correctness, valid NOEV handling, table-density evidence limitations, overflow and truncation policy, border/radius and typography behavior, required/optional/NOEV aggregation, browser determinism, privacy, target isolation, status-document accuracy, and PR 1-6B non-regression; creates only the verification report; and returns an evidence-based decision on PR 6C closure and full PR 6 closure after checkpoint.

Begin with source hashes, privacy audit, selector-map schema review, coverage reconstruction, and the NOEV disposition matrix. Then dynamically test required/optional mapping, gaps, borders, radii, typography, objective overflow, NOEV exceptions, aggregation, three-run determinism, PR 6A/6B safeguards, and status-document accuracy. Do not modify implementation files.
