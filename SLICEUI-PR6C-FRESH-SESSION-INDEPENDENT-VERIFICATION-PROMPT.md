# SliceUI PR 6C Fresh-Session Independent Verification Prompt

## 1. Verification Assignment

Perform a genuinely independent, adversarial, read-only verification of the current uncommitted PR 6C implementation.

Repository:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Real target project, read-only reference only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Committed baseline:

```text
60a0835 feat(sliceui): add ambiguity-safe geometry verification
```

Primary verification checklist:

```text
SLICEUI-PR6C-INDEPENDENT-VERIFICATION-PROMPT.md
```

This is a fresh-session review. Reconstruct the implementation, intended behavior, scope, and risks directly from source, tests, fixtures, active documentation, and committed history.

Do not assume the uncommitted implementation or its tests are correct. Do not assume any finding has been resolved merely because source or documentation says so.

## 2. Independence Disclosure

At the beginning of the report, state:

```text
Fresh-session verification: YES / NO
Prior involvement in PR 6C implementation: YES / NO
Prior access to implementation summaries or expected verdicts: YES / NO
Independence limitation, if any:
```

If you participated in implementing or correcting PR 6C, disclose it and do not claim a fully independent verdict.

## 3. Authoritative Sources

Read these sources before testing:

```text
src/framework/angular/render-geometry.mjs
src/framework/angular/render-verify.mjs
src/framework/angular/selector-map.mjs
src/commands/verify.mjs
src/cli.mjs

test/render-geometry.test.mjs
test/render-verify.test.mjs
test/selector-map.test.mjs
test/fixtures/render-geometry/

docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
docs/SLICEUI-PR4-VERIFICATION-REPORT.md
docs/SLICEUI-PR5-VERIFICATION-REPORT.md
docs/SLICEUI-PR6-VERIFICATION-REPORT.md
docs/SLICEUI-PR6B-VERIFICATION-REPORT.md
docs/SLICEUI-PR6C-VERIFICATION-REPORT.md

docs/project-docs/development/api-contract.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
docs/project-docs/foundation/status.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
```

Use the primary checklist as the complete verification procedure:

```text
SLICEUI-PR6C-INDEPENDENT-VERIFICATION-PROMPT.md
```

Planning prompts and implementation summaries are secondary context only. Source, active contracts, committed checkpoints, and reproducible runtime evidence take precedence.

## 4. Allowed Output

Create only:

```text
docs/SLICEUI-PR6C-FRESH-INDEPENDENT-VERIFICATION-REPORT.md
```

Do not overwrite or edit:

```text
docs/SLICEUI-PR6C-VERIFICATION-REPORT.md
```

The existing report is a historical verification artifact and must remain unchanged.

All temporary fixtures, browser profiles, screenshots, traces, copied projects, package installations, and generated artifacts must remain under:

```text
/tmp/sliceui-pr6c-fresh-verification-<timestamp>/
```

## 5. Read-Only and Safety Rules

Do not:

- modify implementation source;
- modify tests or fixtures;
- modify active documentation or skill files;
- modify decision notes or prior verification reports;
- stage, commit, amend, squash, or push;
- install or update repository dependencies;
- use a global or PATH-resolved SliceUI binary;
- modify the real target project;
- import root `tester.xml` into tests;
- reproduce private values from root `tester.xml` in output;
- leave screenshots, `.sliceui` artifacts, browser profiles, or temporary files in the repository;
- fix findings during verification;
- infer the intended verdict from prior summaries.

Use the repository CLI explicitly:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs ...
```

## 6. Initial Integrity Gate

Before testing, run:

```bash
git status --short
git rev-parse HEAD
git log -10 --oneline
node --version
npm --version
```

Confirm:

- `60a0835` is HEAD or a direct ancestor;
- PR 6A and PR 6B are committed;
- PR 6C remains uncommitted;
- all modified and untracked paths are classified;
- root prompts and root `tester.xml` are recognized exclusions;
- no unknown change exists;
- no dependency or lockfile change exists unless already part of the reviewed implementation;
- the real target retains only its known pre-existing changes.

Hash all PR 6C source, tests, fixtures, documentation, and skill files before verification. Repeat the hashes at the end.

Stop if unknown modifications prevent reliable attribution.

## 7. Verification Approach

Do not merely rerun existing tests. Perform all of the following:

1. Static source and contract audit.
2. Independent reconstruction of the geometry coverage matrix.
3. Negative testing with temporary fixture variants.
4. Production browser-path testing.
5. Selector-map schema and security testing.
6. Required, optional, and unsupported-no-evidence aggregation testing.
7. Three-run determinism testing.
8. PR 6A and PR 6B regression testing.
9. Target-isolation and artifact-lifecycle testing.
10. Documentation and historical-status audit.
11. Full test-suite execution.

Treat current tests as evidence, not proof.

## 8. Selector-Map Verification

Independently verify that selector maps are locator-only.

Confirm the actual schema and validate:

```text
root allowed fields
mapping-entry allowed fields
render-locator allowed fields
schema version
selector strategy
selector length
unique design-node mapping
required flag
```

Test rejection of:

```text
unknown root fields
unknown mapping fields
unknown locator fields
expected geometry fields
actual/value fields
expected-scroll fields
allow-overflow fields
valid-truncation fields
ellipsis-intent fields
case variants
separator variants
nested forbidden fields
array-contained forbidden fields
script-like values
URLs
absolute paths
markup-like values
```

Verify:

- invalid selector map becomes `invalid-input`;
- exit code is `2`;
- browser launch count is zero;
- no workspace or artifact is produced;
- diagnostic is stable and does not expose sensitive values;
- valid CSS selectors are not rejected merely because selector text contains an ordinary word that resembles a forbidden semantic term.

Inspect the entire raw payload validation path. Do not accept safety solely because downstream indexing discards unknown fields.

## 9. Mapping and Ambiguity Verification

Dynamically test:

```text
unique required target
missing required target
ambiguous required target
unique optional target
missing optional target
ambiguous optional target
hidden duplicate
ancestor-hidden duplicate
nested duplicate
repeated visible controls
```

Required contract:

```text
required missing → non-green
required ambiguous → non-green
optional missing → skip
optional ambiguous → warning or skip
unique target → measured
```

Verify no silent first-pick remains. Search source for first-element access and prove that uniqueness is established before selection.

Candidate summaries must be bounded and privacy-safe.

## 10. Design Oracle Independence

Prove expected geometry and styles derive only from raw XML/FIGML or transcript facts.

Search for use of:

```text
resolved.json
spec.md
agent-context
behaviorBindings
showcase/sample defaults
old generated output
selector-map expected values
```

Selector maps must not provide:

```text
expected dimensions
expected spacing
expected alignment
expected colors
expected radii
expected scrolling
valid truncation intent
```

Any selector-map semantic or expected-value path into comparison logic is a blocking finding.

## 11. Coverage Matrix Reconstruction

Reconstruct coverage directly from source for every family:

```text
root padding
control height
line height
divider thickness
text color
text size
text weight
structural/flex gap
border width
border color
border style
uniform radius
per-corner radius
letter spacing
role font size
role font weight
role line height
font family
font fallback
overflow-x
overflow-y
off-container required elements
off-viewport required elements
required-content clipping
expected scrolling
valid truncation
table frame
table-row density
table-cell padding
pagination geometry
alignment relations
button proportions
```

For each record:

```text
implemented / partial / unsupported-no-evidence / out-of-scope
expected-fact source
mapping strategy
required / optional
blocking / warning / skip
tolerance
diagnostic ID
automated test coverage
browser-path coverage
```

No family may disappear from the final report.

## 12. Unsupported-No-Evidence Validation

Independently validate every unsupported-no-evidence disposition.

At minimum review:

```text
table row height
table cell padding
border style
non-evidenced alignment
expected-scroll intent
valid-truncation intent
```

For each, prove:

- the parser/transcript genuinely lacks a defensible fact;
- no expected value was invented;
- it remains visible in coverage documentation;
- it does not count as an executed required check;
- it does not count as pass;
- it does not automatically fail an otherwise evidence-complete render;
- it does not conceal an available mapping or fact.

A valid unsupported disposition does not require another geometry phase.

## 13. Table-Density Limitation

Inspect parser and transcript output directly.

Verify:

```text
row-level design node available: YES / NO
row-height fact available: YES / NO
cell-padding fact available: YES / NO
header/body typography facts available: YES / NO
table frame height available: YES / NO
```

Confirm the implementation does not derive average row height from overall table height or row count.

Determine:

```text
Evidence-backed table density complete: YES / NO
Numeric row/cell density safely unsupported: YES / NO
Table-density limitation blocks closure: YES / NO
```

Do not require parser expansion solely to manufacture absent facts.

## 14. Gap Verification

Test row and column layout semantics independently.

Confirm:

```text
row layout uses column-gap
column layout uses row-gap
two-value gap shorthand uses the correct axis
```

Test:

- known-good;
- inside tolerance;
- exactly at tolerance;
- just outside tolerance;
- large mismatch;
- hidden sibling;
- ambiguous required target;
- missing required target;
- margin and gap interaction.

Diagnostics must include axis, expected, actual, delta, tolerance, unit, and locators.

## 15. Full-Side Border Verification

Independently verify uniform evidenced borders check:

```text
top
right
bottom
left
```

For each side test:

```text
width
normalized color
```

Required scenarios:

- all sides correct;
- top wrong;
- right wrong;
- bottom wrong;
- left wrong;
- multiple sides wrong;
- transparent/alpha color;
- wrong nested DOM layer;
- side-specific divider fact.

Confirm:

- any evidenced-side mismatch is blocking;
- divider remains side-specific;
- border style is not claimed without evidence;
- diagnostics identify affected sides deterministically.

## 16. Radius Verification

Test:

```text
uniform radius
per-corner radius
inside tolerance
at tolerance
just outside tolerance
large mismatch
shorthand
elliptical value if claimed
wrong DOM layer
```

Verify required mismatch is blocking and expected values are evidence-backed.

## 17. Typography and Font Verification

Reconstruct which roles are genuinely distinguishable from transcript/XML and locator-only mapping.

Review:

```text
heading
label
body
helper
table header
table body
button
status
footer
pagination
```

For each claimed role verify evidence for:

```text
font family
font size
font weight
line height
letter spacing
color
```

Confirm HTML tag names alone are not the semantic oracle.

For font-family checks verify:

- expected family comes from literal evidence;
- `document.fonts.ready` is awaited;
- computed family is recorded;
- fallback behavior is honest;
- no external font download occurs;
- generic fallback does not prove the expected family loaded;
- unsupported roles remain visible rather than passing silently.

## 18. Objective Overflow Verification

Test objective overflow through the production browser path.

Required scenarios:

```text
scrollWidth == clientWidth
horizontal overflow within tolerance
horizontal overflow outside tolerance
scrollHeight == clientHeight
vertical overflow within tolerance
vertical overflow outside tolerance
required child outside mapped container
required element outside viewport
horizontal required-content clipping
vertical required-content clipping
overflow:hidden without clipping
ellipsis style without clipping
ellipsis with measurable required-content clipping
```

Required contract:

```text
objective required overflow/clipping → visual-fail
required missing/ambiguous mapping → non-green
overflow:hidden alone → not a failure
ellipsis alone → not a failure
```

Diagnostics must provide bounded dimensions, edge evidence, axis, delta, tolerance, and overflow mode.

## 19. Expected-Scroll and Valid-Truncation Policy

Verify no design fact provides intentional scroll or truncation semantics.

Confirm selector maps reject or cannot express:

```text
expectedScroll
allowOverflow
scrollIntent
validTruncation
ellipsisExpected
truncateIntent
```

Policy:

```text
expected scrolling without evidence → unsupported-no-evidence
valid truncation without evidence → unsupported-no-evidence
objective clipping without evidence of exception → blocking
```

Unsupported exceptions must not count as pass.

## 20. Required, Optional, and NOEV Aggregation

Independently test:

```text
all required pass
all required pass + optional warning
required mismatch
required missing mapping
required ambiguous mapping
zero required facts
zero executed required checks
only optional checks
required pass + NOEV rows
runtime failure + geometry pass
invalid selector map
```

Expected:

```text
required mismatch → visual-fail
required missing/ambiguous → non-green
zero required/executed required → unverifiable
optional-only evidence → cannot pass
NOEV rows → neither pass nor fail by themselves
runtime/setup state → outranks geometry
invalid map → invalid-input before browser
```

## 21. Diagnostics Verification

Inspect representative diagnostics for:

```text
gap
border width/color
radius
letter spacing
typography/font
overflow/clipping
selector-map validation
mapping ambiguity
```

Required fields where applicable:

```text
stable ID
category
required/optional marker
design fact locator
DOM locator or mapping strategy
semantic measurement type
expected
actual
delta
tolerance
unit
axis or side
sample count/range
trust source
remediation
```

Ensure deterministic ordering and bounded evidence. No full HTML, private text, values, credentials, or private paths.

## 22. Browser Determinism

Run at least three independent runs for:

```text
complete known-good structural fixture
objective overflow defect
full-side border defect
selector-map invalid-input scenario
```

Normalize only timestamps and temporary paths.

Assert stable:

```text
state
exit code
check IDs
mapping result
expected/actual values
NOEV rows
diagnostic ordering
screenshot dimensions
```

Any intermittent pass/fail is blocking.

## 23. PR 6A Safety Regression

Reproduce:

- static verify launches no browser;
- static failure short-circuits render;
- oversized viewport exits `2` before browser;
- external request is blocked and diagnostic sanitized;
- runtime page error is non-green;
- browser and workspace cleanup complete;
- target project unchanged;
- packaged render remains development-only/fixture-unavailable.

## 24. PR 6B Safety Regression

Reproduce:

- required ambiguity non-green;
- optional ambiguity non-blocking;
- no silent first-pick;
- control height required;
- outside-tolerance control defect blocking;
- zero required or zero executed required checks unverifiable;
- root padding, line height, divider, and text checks still function.

## 25. Static Verify Non-Regression

Compare static behavior against checkpoint `60a0835`:

```text
browser launch count
project read set
exit state
check count
human output
elapsed median
```

PR 6C browser modules should not load on the default static path where avoidable.

## 26. Target and Artifact Isolation

Trace known-good and defect renders.

Record:

```text
target files read
target files written
repository writes
/tmp writes
.sliceui writes
network attempts/blocks
browser processes
other child processes
```

Required:

```text
target writes = 0
repository scans = 0
network escapes = 0
npm installs = 0
temporary artifacts contained and cleaned
browser/process cleanup complete
```

## 27. status.md Accuracy

Compare active status claims against committed history:

```text
PR 4 checkpoint: a6fd181
PR 5 checkpoint: 2617638
PR 6A checkpoint: 0394317
PR 6B checkpoint: 60a0835
PR 6C: uncommitted and under independent verification
Full PR 6: not officially complete before checkpoint
```

Verify no unrelated roadmap status was rewritten without evidence.

## 28. Documentation and Skill Audit

Review:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/status.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
README.md
docs/SLICEUI-OVERVIEW.md
```

Confirm they accurately state:

- selector maps are locator-only and strict;
- objective overflow/clipping behavior;
- `overflow:hidden` alone is not failure;
- expected scroll and valid truncation remain unsupported-no-evidence;
- uniform borders check all evidenced sides;
- border style remains unsupported without evidence;
- table row/cell density is not overclaimed;
- unsupported rows do not count as pass;
- PR 6C is not officially complete before checkpoint;
- full PR 6 is not prematurely closed.

## 29. Test Quality Review

Audit whether tests cover:

```text
recursive selector-map validation
case and separator variants
nested/array semantic fields
invalid-map no-browser path
full-side border browser regression
off-container/off-viewport browser regression
horizontal and vertical clipping
overflow:hidden without clipping
ellipsis without and with clipping
NOEV aggregation
zero-required guard
three-run determinism
PR 6A/6B regressions
```

Flag helper-only tests where browser behavior is claimed.

## 30. Test Execution

Run at minimum:

```bash
node --test test/render-geometry.test.mjs
node --test test/render-verify.test.mjs
node --test test/selector-map.test.mjs
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
```

Run actual render mount/probe and Pilar mount tests.

Run a combined suite containing render, selector-map, static verify, snapshot/transcript, Pilar, referee, resolve, spec, and agent-context tests.

Then run:

```bash
npm test
```

Run `node --check` on all changed/new source and test files.

Record exact counts. Do not rely on previously reported totals.

## 31. Temporary E2E Matrix

Use:

```bash
TMP_ROOT="/tmp/sliceui-pr6c-fresh-verification-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Required scenarios:

```text
complete known-good fixture
gap defect
wrong border top/right/bottom/left
radius defect
letter-spacing defect
font/typography defect
off-container required child
off-viewport required element
horizontal clipping
vertical clipping
overflow:hidden without clipping
ellipsis without clipping
ellipsis with clipping
invalid selector-map unknown field
invalid selector-map semantic field
nested semantic field
case/separator variant
required selector missing
required selector ambiguous
zero required facts
only optional facts
network attempt
runtime error
invalid viewport
```

For each record:

```text
primary state
exit code
browser launched
mapping status
checks executed
NOEV rows
diagnostic IDs
expected/actual/delta/tolerance
axis/side
cleanup result
target mutation
```

## 32. Decision Rules

### PASS

Use only if:

- implemented checks are evidence-backed and deterministic;
- selector maps are locator-only and strict;
- required mapping and zero-evidence guards cannot false-green;
- objective overflow/clipping checks are complete for the claimed scope;
- full-side evidenced borders are verified;
- NOEV dispositions are factually valid;
- expected scrolling or truncation intent is not invented;
- PR 6A and PR 6B safeguards are preserved;
- documentation and status are accurate;
- tests and full suite pass;
- target isolation and privacy hold;
- no blocking finding remains.

### CONDITIONAL PASS

Use when a focused corrective patch is still required before checkpoint.

### FAIL

Use when a material architectural or safety defect remains, including fake oracle, selector semantic fields reaching comparison, false-green required overflow, false-green required mapping, target mutation, or non-deterministic browser decisions.

## 33. Full PR 6 Closure Rule

Full PR 6 may close after checkpoint only if:

```text
PR 6A complete
PR 6B complete
PR 6C independently passes
all evidence-backed geometry is implemented
all absent facts have valid explicit unsupported-no-evidence dispositions
no known blocking finding remains
```

Do not require another geometry phase solely because the parser does not expose nonexistent facts.

Parser metadata expansion can remain a future enhancement.

## 34. Finding Format

Use severity:

```text
Critical
High
Medium
Low
Informational
```

Suggested prefixes:

```text
IND independence
FIX privacy/fixture
ORC oracle
SCH selector schema
MAP mapping
NOE unsupported evidence
GAP spacing
TBL table density
ALI alignment
OVF overflow/clipping
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
STA status
DOC documentation
TST test quality
REG regression
SCP closure
```

For every material finding include:

```text
ID
severity
status
source and runtime evidence
impact
required correction
blocks PR 6C closure yes/no
blocks full PR 6 closure yes/no
```

## 35. Verification Report

Create only:

```text
docs/SLICEUI-PR6C-FRESH-INDEPENDENT-VERIFICATION-REPORT.md
```

Required structure:

```markdown
# SliceUI PR 6C Fresh-Session Independent Verification Report

## 0. Independence Disclosure
## 1. Executive Decision
## 2. Scope and Environment
## 3. Git and Source Integrity
## 4. Fixture Privacy
## 5. Architecture and Oracle Independence
## 6. Selector-Map Schema and Strictness
## 7. Selector Resolution and Ambiguity
## 8. Coverage Matrix
## 9. Unsupported-No-Evidence Dispositions
## 10. Table-Density Limitation
## 11. Gap Verification
## 12. Full-Side Border Verification
## 13. Radius Verification
## 14. Typography and Font
## 15. Objective Overflow and Clipping
## 16. Expected-Scroll and Valid-Truncation Policy
## 17. Required/Optional/NOEV Aggregation
## 18. Diagnostic Contract
## 19. Browser Determinism
## 20. PR 6A Safety Regression
## 21. PR 6B Safety Regression
## 22. Static Verify Regression
## 23. Target and Artifact Isolation
## 24. status.md Accuracy
## 25. Documentation and Skill
## 26. Test Quality
## 27. Tests Re-run
## 28. E2E Scenario Matrix
## 29. Performance and Boundedness
## 30. Findings by Severity
## 31. Acceptance Checklist
## 32. Required Corrective Patch
## 33. Full PR 6 Closure Decision
## 34. Final Recommendation
## Appendix A. Commands
## Appendix B. Selector-Map Validation Matrix
## Appendix C. Raw Geometry Results
## Appendix D. NOEV Matrix
## Appendix E. Privacy Scan
## Appendix F. Source Hashes and Git Status
```

## 36. End-of-Task Integrity

Before responding:

- repeat source hashes and compare start/end;
- confirm implementation/tests/fixtures/docs/skill/status unchanged;
- confirm only the fresh verification report was added;
- confirm root `tester.xml` remains unchanged and untracked;
- confirm no private data entered the report;
- inspect SliceUI and target `git status --short`;
- confirm no screenshots, binaries, or `.sliceui` artifacts were added;
- confirm temporary data remains under `/tmp`;
- do not commit or push.

## 37. Required Final Response

### Independence

```text
Fresh-session verification:
Prior implementation involvement:
Independence limitations:
```

### Decision

```text
PR 6C: PASS / CONDITIONAL PASS / FAIL
PR 6C may close: YES / NO
Corrective patch required: YES / NO
NOEV dispositions valid: YES / NO
Table-density limitation blocks closure: YES / NO
Selector maps locator-only and strict: YES / NO
Objective overflow coverage complete: YES / NO
Full-side border verification complete: YES / NO
PR 6A and PR 6B safeguards preserved: YES / NO
Full PR 6 may close after checkpoint: YES / NO
Next phase may start: YES / NO
```

### Core Evidence

Summarize selector strictness, browser geometry defects, NOEV validation, determinism, isolation, status accuracy, and full-suite results.

### Blocking Findings

List or `None`.

### Non-Blocking Findings

List factual limitations and future enhancements.

### Closure Recommendation

State whether PR 6C may be committed and whether full PR 6 may close after that checkpoint.

### Report

```text
docs/SLICEUI-PR6C-FRESH-INDEPENDENT-VERIFICATION-REPORT.md
```

### Git Status

Show exact SliceUI and target status.

Do not modify implementation, commit, or push.

## 38. Definition of Done

The task is complete only when a fresh reviewer independently reconstructs and adversarially verifies the current uncommitted PR 6C implementation, selector-map strictness, oracle independence, objective overflow and clipping, full-side border behavior, GAP/radius/typography checks, valid unsupported-no-evidence dispositions, aggregation safety, deterministic browser results, PR 6A/6B regressions, privacy, target isolation, documentation, and status history; creates only the fresh verification report; and returns an evidence-based decision on PR 6C checkpoint readiness and full PR 6 closure.

Begin with the independence disclosure, source hashes, working-tree classification, privacy scan, selector-map schema reconstruction, and coverage matrix. Do not assume any prior verdict is correct.
