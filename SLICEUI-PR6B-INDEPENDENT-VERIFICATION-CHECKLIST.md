# SliceUI PR 6B Independent Verification Checklist

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
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
docs/SLICEUI-PR4-VERIFICATION-REPORT.md
docs/SLICEUI-PR5-VERIFICATION-REPORT.md
docs/SLICEUI-PR6-VERIFICATION-REPORT.md
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
SLICEUI-PR6B-GEOMETRY-COVERAGE-IMPLEMENTATION-PLAN.md
```

Secondary context:

```text
SLICEUI-PR6-RENDERED-VISUAL-FIDELITY-IMPLEMENTATION-PROMPT.md
SLICEUI-PR6-INDEPENDENT-VERIFICATION-CHECKLIST.md
SLICEUI-PR6A-CORRECTIVE-PATCH-RENDER-SAFETY-PROMPT.md
SLICEUI-PR6A-CHECKPOINT-COMMIT-PLAN.md
```

Source code, active documentation, committed checkpoints, and verification reports are more authoritative than planning prompts.

## 1. Verification Objective

Independently verify the PR 6B Rendered Geometry Coverage implementation.

This verification must decide two separate questions:

```text
1. Is the implemented PR 6B geometry subset correct, deterministic, safe, and ready to close?
2. Is full PR 6 complete, or is PR 6C still required for the missing geometry families?
```

Do not merge these decisions.

A correct result may be:

```text
PR 6B: PASS
PR 6B may close: YES
PR 6C required: YES
Full PR 6 complete: NO
```

PR 6B must not be failed merely because PR 6C remains necessary, unless PR 6B claims complete coverage or omits requirements that were explicitly assigned to PR 6B and have usable evidence.

## 2. Read-Only Safety Rules

This task is read-only for implementation source, tests, fixtures, skill, and active documentation.

Only create:

```text
docs/SLICEUI-PR6B-VERIFICATION-REPORT.md
```

Store temporary projects, browser profiles, screenshots, traces, fixture variants, reports, and package installations under:

```text
/tmp/sliceui-pr6b-verification-<timestamp>/
```

Do not:

- modify source or tests;
- modify fixtures;
- modify skill or active documentation;
- fix findings;
- commit or push;
- stage files;
- use global/on-PATH SliceUI;
- run writer commands against the real target;
- commit or copy root-level `tester.xml` into the repository;
- expose personal data from `tester.xml` in logs or reports;
- start PR 6C implementation;
- weaken the approved PR 6B scope silently.

## 3. Mandatory Decision Outputs

The final report must answer:

```text
PR 6B decision: PASS / CONDITIONAL PASS / FAIL
PR 6B may close: YES / NO
Corrective patch required: YES / NO
PR 6C required: YES / NO
Full PR 6 complete: YES / NO
Next phase may start: YES / NO
```

Core guarantees:

```text
Synthetic fixture is safe and official:
Root tester.xml remains excluded:
Expected geometry comes from transcript/XML:
Control-height checks reliable:
Line-height checks reliable:
Optional warning semantics correct:
Tolerance boundaries correct:
Diagnostics measurable and stable:
DOM mapping ambiguity-safe:
Browser geometry deterministic:
No-geometry run cannot green:
PR 6A safety preserved:
Target project writes are zero:
Static verify non-regression:
PR 1-6A non-regression:
```

## 4. Implementation Claims to Reproduce

PR 6B reports:

```text
New source:
  src/framework/angular/render-geometry.mjs

Extended source:
  src/framework/angular/render-verify.mjs

New tests:
  test/render-geometry.test.mjs

Official synthetic fixture:
  test/fixtures/render-geometry/{known-good,defect}

Implemented required checks:
  root padding
  input/control height
  divider thickness
  line-height
  text color
  text size
  text weight

Implemented optional warning checks:
  button frame height
  table frame height

Central tolerances:
  box +/-2px
  line-height +/-1px
  divider +/-1px

Latest full suite:
  475 pass
  3 pre-existing skips
  0 fail
```

Reported deferred families:

```text
radius
flex/structural gap
table header density
table row density
table cell padding
table footer density
pagination geometry
relative alignment
overflow and clipping
border width/style
complete typography roles
font-fallback detection
```

Do not accept any claim without reproduction.

## 5. Baseline and Source Integrity

From repository root:

```bash
git status --short
git rev-parse HEAD
git log -1 --oneline
node --version
npm --version
```

Checklist:

- [ ] Confirm `0394317` is HEAD or a direct ancestor.
- [ ] Confirm PR 6A is committed and complete.
- [ ] Classify every working-tree entry.
- [ ] Confirm root-level prompts are known and excluded.
- [ ] Confirm root `tester.xml` remains untracked.
- [ ] Stop if unknown changes exist.
- [ ] Record real target status.
- [ ] Hash every PR 6B source, test, fixture, skill, and documentation file before verification.
- [ ] Confirm no render screenshot or generated `.sliceui` artifact exists in the repository.

Suggested hash set:

```bash
shasum -a 256 \
  src/framework/angular/render-geometry.mjs \
  src/framework/angular/render-verify.mjs \
  test/render-geometry.test.mjs \
  test/render-verify.test.mjs \
  skill/SKILL.md \
  docs/project-docs/development/api-contract.md \
  docs/project-docs/technical-guidelines/verify-gate-trust.md
```

Add every actual changed/file fixture path.

## 6. Fixture Ownership and Privacy Review

Verify the implementation decision:

```text
root tester.xml = local evaluation input only
synthetic render-geometry fixture = official test fixture
```

Checklist:

- [ ] Root `tester.xml` is not imported by tests.
- [ ] Root `tester.xml` is not copied into fixture paths.
- [ ] Root `tester.xml` is not staged or tracked.
- [ ] Automated tests do not depend on root `tester.xml`.
- [ ] Synthetic fixture contains no real names, IDs, monetary records, faculty details, or personal data.
- [ ] Synthetic fixture uses generic labels and deterministic mock data.
- [ ] Fixture ownership and purpose are documented.
- [ ] Fixture paths follow repository conventions.
- [ ] Fixture is minimal and stable.
- [ ] Expected design facts are traceable from the fixture XML/transcript.

Search for known personal values without copying them into the report:

```bash
rg -n "25915001|25231045|Raisha|Aqshal" test src docs skill
```

Expected result: no match in committed/in-scope product and fixture files.

Do not include personal values in the verification report beyond stating that root `tester.xml` contains private data and remains excluded.

## 7. Architecture and Call Graph Review

Audit:

```text
src/framework/angular/render-geometry.mjs
src/framework/angular/render-verify.mjs
src/commands/verify.mjs
test/render-geometry.test.mjs
test/render-verify.test.mjs
test/fixtures/render-geometry/
```

Build actual call graph:

```text
transcript/XML facts
→ geometry expectation extraction
→ PR 6A isolated render
→ bounded DOM collection pass
→ mapping
→ geometry comparisons
→ required/optional aggregation
→ render state
→ diagnostics
```

Confirm:

- [ ] Expected values are extracted before comparison.
- [ ] Browser collection uses one bounded evaluate pass as claimed.
- [ ] Comparisons do not trigger repository scans.
- [ ] Geometry code does not bypass PR 6A error boundaries.
- [ ] Geometry code does not weaken network interception.
- [ ] Runtime errors still outrank geometry results.
- [ ] Geometry failures map to `visual-fail`.
- [ ] Required unmappable evidence is non-green.

## 8. Oracle Independence Audit

Search:

```bash
rg -n "resolved\.json|spec\.md|agent-context|resolveTranscript|behaviorBindings|showcase|sample" \
  src/framework/angular/render-geometry.mjs \
  src/framework/angular/render-verify.mjs \
  test/render-geometry.test.mjs
```

Verify:

- [ ] Expected geometry comes only from literal or structural transcript/XML facts.
- [ ] `resolved.json` is not an expected-value source.
- [ ] `spec.md` is not an expected-value source.
- [ ] Agent context is not an expected-value source.
- [ ] Existing generated output is not used as baseline truth.
- [ ] Screenshot appearance is not used to invent numeric expectations.
- [ ] Optional button/table values still originate from design frames, even though their semantic confidence is lower.

## 9. Coverage Matrix Reconstruction

Reconstruct coverage from source, not from the implementation report.

For every family record:

```text
implemented / partial / unsupported
expected fact source
DOM locator strategy
required / optional
blocking / warning / skip
tolerance
diagnostic ID
test coverage
```

Families:

```text
root padding
control/input height
select height
button height
button width/proportion
button padding
button icon/text gap
major gaps
font family
font size
font weight
line height
heading typography
divider thickness
table frame height
table header height
table row height
table cell padding
table footer height
pagination geometry
relative alignment
overflow/clipping
border width/style/color
border radius
```

Use this matrix to determine whether implementation claims are accurate.

## 10. Semantic Fact-to-Box Review

For every implemented fact verify the mapping classification:

```text
literal rendered border box
container frame
canvas coordinate
structural relation
visual bounds
fluid/unconstrained value
```

Specifically review:

### Root padding

- [ ] Canvas x/y is not internal padding.
- [ ] Auto-layout padding is used as the expected fact.

### Input/control height

- [ ] Design frame is legitimately classified as visible control border box.
- [ ] Browser uses the visible control/wrapper, not a hidden native input.

### Button frame height

- [ ] Optional warning semantics reflect mapping uncertainty.
- [ ] It cannot create blocking visual-fail by itself.

### Table frame height

- [ ] Treated as optional container-frame evidence.
- [ ] It is not mislabeled as row density.

### Line height

- [ ] Expected line-height exists literally or is derived by a documented safe rule.
- [ ] `normal` is not silently converted to an invented value.

### Divider thickness

- [ ] Correct side/orientation and visible DOM layer are mapped.

## 11. DOM Mapping Safety

Construct scenarios for:

```text
unique visible match
repeated visible text
same-role repeated controls
hidden duplicate
nested duplicate
missing required element
multiple table-like containers
```

Verify:

- [ ] Unique match is deterministic.
- [ ] Hidden elements are filtered.
- [ ] Required ambiguity never selects the first candidate.
- [ ] Required ambiguity is non-green/unverifiable.
- [ ] Optional ambiguity yields warning/skip with reason.
- [ ] Candidate count is visible.
- [ ] DOM locator is included in diagnostic.
- [ ] Production source is not modified with permanent IDs.
- [ ] Temporary fixture markers do not define expected geometry.

## 12. Central Tolerance Policy

Audit `GEOMETRY_TOLERANCE` or equivalent.

Verify:

- [ ] Box tolerance is centralized.
- [ ] Line-height tolerance is centralized.
- [ ] Divider tolerance is centralized.
- [ ] No scattered magic values duplicate these tolerances.
- [ ] Boundary rule is `abs(delta) <= tolerance` or documented equivalent.
- [ ] Each diagnostic reports tolerance.
- [ ] Units are explicit.
- [ ] Expected/actual direction is consistent.
- [ ] Negative and decimal values are handled safely.

Search:

```bash
rg -n "tolerance|GEOMETRY_TOLERANCE|Math\.abs|delta" \
  src/framework/angular/render-geometry.mjs \
  src/framework/angular/render-verify.mjs \
  test/render-geometry.test.mjs
```

## 13. Tolerance Boundary Tests

For each implemented numeric family test:

```text
inside tolerance
exactly at tolerance
just outside tolerance
large mismatch
```

Required families:

```text
root padding
control height
button/table optional height
line height
divider thickness
```

Verify:

- [ ] Inside passes.
- [ ] Exactly at tolerance passes.
- [ ] Just outside produces correct fail or warning.
- [ ] Large mismatch produces deterministic diagnostic.
- [ ] Delta and unit are correct.

If existing automated tests omit any boundary, reproduce independently and record a test-quality finding.

## 14. Root Padding Verification

Use controlled fixture variants:

```text
known-good
within tolerance
each side just outside tolerance
large mismatch
```

Verify:

- [ ] Top/right/bottom/left compared independently.
- [ ] Correct shorthand normalization.
- [ ] Required mismatch produces `visual-fail`.
- [ ] Diagnostic contains expected, actual, delta, tolerance, unit.
- [ ] Canvas position does not affect result.

## 15. Control Height Verification

Test:

```text
known-good 40px
38px or 42px boundary according to tolerance
just below boundary
just above boundary
much too tall
much too short
missing input
repeated inputs
hidden native input plus visible wrapper
```

Verify:

- [ ] Correct visible element is measured.
- [ ] Required mismatch blocks.
- [ ] Missing required control is non-green.
- [ ] Repeated controls do not first-pick.
- [ ] Height uses rendered border box.
- [ ] Diagnostic ID stable.

## 16. Line-Height Verification

Test:

```text
known-good 20px
inside/exact/outside tolerance
30px defect
computed `normal`
unitless line-height if fixture supports it
repeated text nodes
```

Verify:

- [ ] Known-good passes.
- [ ] `30 vs 20` yields visual-fail and stable diagnostic.
- [ ] `normal` does not become a fabricated numeric expected value.
- [ ] Correct text node is mapped.
- [ ] Font size and line-height are not conflated.

## 17. Divider Thickness Verification

Test:

```text
known-good 1px
0px
2px boundary if tolerance permits
just outside tolerance
wrong side/orientation
hidden divider
```

Verify:

- [ ] Visible border side is measured.
- [ ] Optional browser normalization is handled.
- [ ] Required mismatch blocks.
- [ ] Divider color/style are not claimed if not implemented.

## 18. Existing Text Style Non-Regression

Re-test PR 6A checks:

```text
text color
font size
font weight
```

Verify:

- [ ] Known-good passes.
- [ ] Defects still fail.
- [ ] Geometry refactor did not change diagnostic IDs unexpectedly.
- [ ] Color normalization is stable.
- [ ] Weight keyword/numeric normalization is stable.

## 19. Optional Button Height Semantics

Test:

```text
known-good frame height
mismatch inside tolerance
mismatch outside tolerance
missing button
ambiguous repeated buttons
```

Verify:

- [ ] Outside-tolerance mismatch produces warning, not blocking fail.
- [ ] Warning includes expected/actual/delta/tolerance.
- [ ] Button warning alone may still allow pass only when all required checks complete.
- [ ] Missing optional button does not masquerade as required pass.
- [ ] Documentation clearly explains why the fact is optional.

## 20. Optional Table Frame Height Semantics

Test:

```text
known-good table container
height mismatch
missing optional table container
multiple table-like containers
```

Verify:

- [ ] Mismatch is warning-only.
- [ ] It is not called table-row density coverage.
- [ ] Ambiguous optional mapping does not first-pick.
- [ ] Diagnostic calls it container/frame evidence.

## 21. Required Versus Optional Aggregation

Create combinations:

```text
all required pass + optional pass
all required pass + optional warning
required fail + optional pass
required fail + optional warning
required mapping missing
only optional checks execute
zero geometry checks execute
```

Expected:

- [ ] Required pass + optional warning may pass with warning visible.
- [ ] Required mismatch yields visual-fail.
- [ ] Required missing mapping is non-green/unverifiable.
- [ ] Only optional checks cannot prove full rendered pass if no required evidence executed.
- [ ] Zero geometry checks cannot return clean rendered pass.
- [ ] Runtime/setup failure outranks geometry state.

## 22. Diagnostic Contract Verification

For representative required fail and optional warning assert:

```text
stable ID
category
severity/status
design fact locator
DOM locator
semantic measurement type
expected
actual
delta
tolerance
unit
required/optional marker
trust source
remediation
```

Verify:

- [ ] No large DOM/style dump.
- [ ] No private absolute path.
- [ ] Deterministic ordering.
- [ ] Remediation references the measured property, not speculative architecture.

## 23. Known-Good Browser Determinism

Run the official known-good fixture at least three times through the production browser path.

Capture raw signature:

```text
primary state
check IDs
mapped elements
expected values
actual values
deltas
tolerances
screenshot dimensions
```

Calculate min/max/range for numeric actuals.

Verify:

- [ ] State stable.
- [ ] Mapping stable.
- [ ] Ordering stable.
- [ ] Actual values stable within observed variance.
- [ ] Tolerance exceeds observed variance without hiding meaningful defects.
- [ ] Screenshot dimensions stable.

The implementation report states two runs. Independent verification must run at least three.

## 24. Defect Browser Determinism

Run at least one required defect, preferably line-height, three times.

Verify:

- [ ] All runs are visual-fail.
- [ ] Same diagnostic ID.
- [ ] Same expected and actual values within variance.
- [ ] Same remediation.
- [ ] No intermittent pass.

Run one optional warning defect repeatedly and verify it remains warning-only.

## 25. Synthetic Fixture Content Review

Inspect fixture files.

Verify:

- [ ] No external network requests.
- [ ] No real personal data.
- [ ] No timestamps/random values.
- [ ] Deterministic rows/text.
- [ ] Styling corresponds to transcript facts.
- [ ] Defect fixture differs only in intended defect(s).
- [ ] No hidden extra defect accidentally makes tests pass/fail.
- [ ] Fixture does not encode expected values in DOM attributes used by comparator unless those values originate from transcript and are only locators.

## 26. Deferred-Family Disposition Matrix

For each deferred family, independently classify:

```text
no design evidence
usable design evidence but no DOM mapping
usable evidence and possible fixture selector map
implementation absent
accepted for PR 6C
candidate to accept out of full PR 6
```

Families:

```text
flex/structural gaps
table header height
table row height
table cell padding
table footer density
pagination geometry
relative alignment
overflow/clipping
border width/style
border radius
font fallback
complete typography roles
```

For each, answer:

1. Does the synthetic fixture or `tester.xml` provide design facts?
2. Can a fixture selector map provide a locator without becoming the expected-value oracle?
3. Is the omission technically necessary or simply deferred?
4. Does the approved PR 6B plan require it?
5. Does omission block PR 6B closure or only full PR 6 closure?

Do not expose personal data from `tester.xml` while performing this analysis.

## 27. Selector-Map Feasibility Review

Assess whether an isolated fixture selector map could lawfully support deferred checks.

Safe separation:

```text
selector map → identifies rendered DOM element
transcript/XML → supplies expected geometry
```

Unsafe behavior:

```text
selector map → embeds expected geometry or semantic answer
```

Determine whether table density, pagination, alignment, and overflow are feasible in PR 6C without fake oracle.

## 28. Table Coverage Honesty

Verify current documentation, skill, and diagnostics do not claim:

```text
table header density implemented
table row density implemented
table cell padding implemented
table footer/pagination geometry implemented
```

Confirm `table frame height` is labeled optional container-frame evidence only.

## 29. Overflow Coverage Honesty

Verify current implementation and docs explicitly state overflow/clipping is unsupported/deferred.

Ensure:

- [ ] No check is mislabeled as overflow coverage.
- [ ] Pass output does not imply clipping was verified.
- [ ] PR 6C scope records overflow.

## 30. Gap and Alignment Coverage Honesty

Verify no existing root padding or frame-height check is presented as:

```text
flex gap verification
relative alignment verification
pagination alignment verification
```

These remain deferred unless actual code proves otherwise.

## 31. PR 6A Safety Regression Matrix

Reproduce:

### Opt-in

- [ ] Static verify launches no browser.
- [ ] `--render` launches browser only after static pass.

### Static short-circuit

- [ ] Static failure skips render.
- [ ] No browser/workspace.

### Viewport

- [ ] `99999x99999` exits 2 before browser.

### Network

- [ ] External request blocked.
- [ ] Sanitized diagnostic.
- [ ] Non-green state.

### Runtime error

- [ ] Page error yields runtime-fail.

### Package contract

- [ ] Help still says development-only.
- [ ] Packaged static verify works.
- [ ] Packaged render returns fixture-unavailable exit 3.

### Cleanup and isolation

- [ ] Temporary workspace cleaned.
- [ ] Target project unchanged.

## 32. Static Verify Non-Regression

Compare default static behavior to PR 6A checkpoint:

```text
browser launch count
project read set
exit code
check count
output
elapsed median
```

Verify no geometry module is loaded on static path if avoidable.

## 33. Read, Write, Network, and Process Trace

Trace one known-good and one defect browser run.

Record:

```text
target files read
target files written
repository writes
/tmp writes
.sliceui writes
external requests attempted/blocked
browser processes
other child processes
```

Required:

- [ ] Target writes zero.
- [ ] Repository scans zero.
- [ ] Network escapes zero.
- [ ] Temporary writes contained.
- [ ] No npm install.
- [ ] Browser/process cleanup complete.

## 34. Performance Review

Measure at least three known-good renders.

Record:

```text
total median
geometry collection duration if available
measurement count
browser evaluations
screenshot duration
```

Verify geometry uses one bounded collection pass rather than one browser round trip per property.

Compare to reported `~2-3s` baseline and flag material regression.

## 35. Automated Test Quality Review

Audit:

```text
test/render-geometry.test.mjs
test/render-verify.test.mjs
fixture tests
```

Check coverage for:

```text
tolerance boundaries
required/optional aggregation
missing required mapping
zero required checks
ambiguous mapping
hidden duplicate
repeated controls
real browser three-run determinism
optional warnings
PR 6A regressions
fixture privacy
```

Flag tests that:

- only assert helper output;
- never use production browser path;
- assert only string presence;
- do not test exact exit state;
- omit boundary values;
- allow first-pick mapping;
- use fixture data as both locator and expected-value oracle;
- never test zero required geometry facts.

## 36. Re-run Tests

Run:

```bash
node --test test/render-geometry.test.mjs
node --test test/render-verify.test.mjs
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
```

Run existing render-mount/probe/Pilar mount tests by actual filenames.

Run a relevant combined suite containing:

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

Run `node --check` on all changed/new source and tests.

Record exact pass/fail/skip.

## 37. Temporary E2E Scenario Matrix

Use:

```bash
TMP_ROOT="/tmp/sliceui-pr6b-verification-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Use repository CLI explicitly:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs verify <dir> [name] --render
```

Scenarios:

```text
known-good synthetic fixture
required line-height defect
required control-height defect
required root-padding defect
required divider defect
optional button-height defect
optional table-frame defect
ambiguous mapping
missing required element
zero required geometry evidence
network attempt
runtime failure
invalid viewport
```

For each record:

```text
primary state
exit code
checks executed
diagnostics
expected/actual/delta/tolerance
warning count
browser/process cleanup
target mutation
```

## 38. Decision Rules for PR 6B

### PASS

Use only if:

- all implemented PR 6B checks are correct and deterministic;
- fixture is safe and official;
- oracle independence holds;
- required/optional semantics are correct;
- no-geometry and ambiguous-required cases cannot green;
- diagnostics are measurable and stable;
- PR 6A safety is preserved;
- tests and full suite pass;
- documentation accurately states deferred scope.

PR 6C may still be required.

### CONDITIONAL PASS

Use if:

- core implemented geometry checks are correct;
- one or more non-blocking issues remain;
- no false green affects required implemented facts;
- a focused corrective patch is required before checkpoint.

### FAIL

Use if:

- expected values come from non-design sources;
- ambiguous mapping first-picks;
- required missing mapping can pass;
- zero required geometry checks can pass;
- tolerance hides material defects;
- required mismatch is warning-only;
- optional mismatch blocks unexpectedly;
- fixture contains private data;
- PR 6A safety regresses;
- target project is modified;
- browser results are non-deterministic.

## 39. Decision Rules for Full PR 6 and PR 6C

Keep separate from PR 6B quality.

### PR 6C required

Use when one or more significant families remain feasible and intentionally deferred:

```text
table density
pagination geometry
relative alignment
overflow/clipping
major gaps
border/radius
complete typography/font coverage
```

### Full PR 6 complete

Only if an explicit scope decision accepts all remaining families as out-of-scope or independent verification proves no defensible evidence/mapping exists for them.

Do not infer this acceptance.

Without explicit approval:

```text
PR 6C required: YES
Full PR 6 complete: NO
```

## 40. Finding Format

Severity:

```text
Critical
High
Medium
Low
Informational
```

Finding prefixes:

```text
FIX fixture/privacy
ORC oracle independence
MAP DOM mapping
SEM semantic box mapping
TOL tolerances
GEO geometry comparison
CTL controls
TYP typography
DIV divider
OPT optional semantics
AGG aggregation
DIA diagnostics
DET determinism
TBL table scope
GAP gap scope
ALI alignment scope
OVF overflow scope
BOR border/radius
SAF PR 6A safety
ISO isolation
NET network
PER performance
PKG package contract
REG prior PR regression
DOC documentation
SCP scope disposition
TST test quality
```

Every material finding must contain:

```text
Finding ID
Severity
Status: Confirmed / Strong evidence / Suspected / Not found / Unable to verify
Evidence: path, symbol, line, command, output
Impact
Required correction
Blocks PR 6B closure: yes/no
Requires PR 6C: yes/no
Blocks full PR 6 closure: yes/no
```

## 41. Documentation and Skill Review

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

- current implemented families are accurate;
- optional button/table semantics are explicit;
- table density is not overclaimed;
- overflow is not overclaimed;
- tolerances are accurate;
- transcript/XML oracle is explicit;
- DOM ambiguity behavior is documented;
- synthetic fixture ownership is documented;
- `tester.xml` remains excluded due to privacy;
- PR 6C boundary is explicit;
- full PR 6 is not called complete.

Do not edit docs.

## 42. Diff and Scope Audit

Review all PR 6B changes relative to `0394317`.

Classify hunks:

```text
geometry measurement
geometry comparison
diagnostics
fixture
tests
docs/skill
PR 6A regression fix
unrelated
PR 6C work
prompt/local artifact
```

Confirm:

- no hidden browser/network/package redesign;
- no new dependency;
- no target mutation;
- no root `tester.xml` staging;
- no prompt staging;
- no screenshot binary;
- no generated `.sliceui` artifact.

## 43. Verification Report Output

Create only:

```text
docs/SLICEUI-PR6B-VERIFICATION-REPORT.md
```

Required structure:

```markdown
# SliceUI PR 6B Verification Report

## 1. Executive Decision
## 2. Scope and Environment
## 3. Git and Source Integrity Baseline
## 4. Fixture Ownership and Privacy
## 5. Architecture and Oracle Independence
## 6. Coverage Matrix
## 7. Semantic Fact-to-Box Mapping
## 8. DOM Mapping Safety
## 9. Tolerance Policy and Boundaries
## 10. Root Padding
## 11. Control Height
## 12. Line Height
## 13. Divider Thickness
## 14. Existing Text-Style Regression
## 15. Optional Button and Table Semantics
## 16. Required/Optional Aggregation
## 17. Diagnostic Contract
## 18. Browser Determinism
## 19. Fixture Content Review
## 20. Deferred-Family Disposition
## 21. Selector-Map Feasibility
## 22. PR 6A Safety Regression
## 23. Read/Write/Network/Process Trace
## 24. Performance
## 25. Test Quality Review
## 26. Tests Re-run
## 27. E2E Scenario Matrix
## 28. PR 1-6A Non-Regression
## 29. Documentation and Skill Assessment
## 30. Diff and Scope Review
## 31. Findings by Severity
## 32. Acceptance Checklist
## 33. Required Corrective Patch
## 34. PR 6C Scope Decision
## 35. Final Recommendation
## Appendix A: Commands Executed
## Appendix B: Raw Geometry Results
## Appendix C: Tolerance Boundary Matrix
## Appendix D: Fixture Privacy Scan
## Appendix E: Source Hashes and Git Status
```

## 44. End-of-Task Integrity

Before final response:

- [ ] Re-run source hashes and compare start/end.
- [ ] Confirm source/tests/fixtures/docs/skill unchanged.
- [ ] Confirm only the verification report was added.
- [ ] Confirm root `tester.xml` unchanged and untracked.
- [ ] Confirm no personal data copied into report.
- [ ] Run SliceUI `git status --short`.
- [ ] Run real target `git status --short`.
- [ ] Confirm no screenshot/binary or `.sliceui` artifact added.
- [ ] Confirm temporary artifacts remain under `/tmp`.
- [ ] Do not commit or push.

## 45. Required Final Response

### Decision

```text
PR 6B: PASS / CONDITIONAL PASS / FAIL
PR 6B may close: YES / NO
Corrective patch required: YES / NO
PR 6C required: YES / NO
Full PR 6 complete: YES / NO
Next phase may start: YES / NO
```

### Core Guarantees

```text
Synthetic fixture safe:
Root tester.xml excluded:
Design oracle independent:
Control-height checks reliable:
Line-height checks reliable:
Tolerance boundaries correct:
Optional warning semantics correct:
Required/optional aggregation correct:
Diagnostics stable:
DOM mapping ambiguity-safe:
Browser determinism proven:
PR 6A safety preserved:
Target writes zero:
Static verify non-regression:
PR 1-6A non-regression:
```

### Implemented Coverage

List implemented required and optional geometry families.

### Deferred Coverage

List each family and disposition:

```text
no evidence
mapping unavailable
selector-map feasible
PR 6C required
accepted out-of-scope only with explicit decision
```

### Key Evidence

Summarize browser runs, tolerance boundaries, ambiguity scenarios, fixture privacy, isolation, and full-suite result.

### Blocking Findings

List or `None`.

### Non-Blocking Findings

List material limitations.

### Required Corrective Patch

State exact work. Do not implement it.

### PR 6C Decision

State whether PR 6C remains required and why.

### Report

```text
docs/SLICEUI-PR6B-VERIFICATION-REPORT.md
```

### Validation

List principal commands and results.

### Git Status

Show exact SliceUI and real-target status.

Do not implement corrections, commit, or push.

## 46. Definition of Done

The independent verification is complete only when it proves or disproves the correctness, determinism, oracle independence, tolerance behavior, required/optional semantics, mapping safety, fixture privacy, and PR 6A non-regression of every implemented PR 6B geometry check; explicitly identifies every remaining deferred geometry family; separates PR 6B closure from full PR 6 completion; produces only the verification report; and returns an evidence-based decision on whether PR 6B may close, whether a corrective patch is required, and whether PR 6C remains mandatory.

Begin with source hashes, fixture privacy review, architecture/oracle audit, and the reconstructed coverage matrix. Then test tolerance boundaries, mapping ambiguity, required/optional aggregation, three-run browser determinism, PR 6A safety, and deferred-family feasibility. Do not modify implementation files.
