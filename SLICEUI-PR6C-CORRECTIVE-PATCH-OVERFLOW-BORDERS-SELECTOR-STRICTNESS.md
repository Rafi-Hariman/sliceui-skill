# SliceUI PR 6C Corrective Patch Plan: Overflow, Full-Side Borders, and Selector-Map Strictness

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
docs/SLICEUI-PR6C-VERIFICATION-REPORT.md
docs/SLICEUI-PR6B-VERIFICATION-REPORT.md
docs/SLICEUI-PR6-VERIFICATION-REPORT.md
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/status.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
SLICEUI-PR6C-COMPLETE-RENDERED-GEOMETRY-IMPLEMENTATION-PLAN.md
SLICEUI-PR6C-INDEPENDENT-VERIFICATION-PROMPT.md
SLICEUI-PR6C-DECISION-NOTE.md
```

If the decision note is located elsewhere, find it by exact filename. Do not rewrite historical verification decisions merely to replace `CONDITIONAL PASS` with `PASS`.

Supporting documents when needed:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
docs/SLICEUI-PR4-VERIFICATION-REPORT.md
docs/SLICEUI-PR5-VERIFICATION-REPORT.md
```

Source code, active documentation, committed checkpoints, and verification reports are more authoritative than planning prompts.

## 1. Mandatory Entry Gate

Before changing source:

1. Read `docs/SLICEUI-PR6C-VERIFICATION-REPORT.md`.
2. Confirm its independence disclosure and recorded verdict:

```text
PR 6C: CONDITIONAL PASS
PR 6C may close: NO
Corrective patch required: YES
Full PR 6 may close after checkpoint: NO
```

3. Confirm the blocking findings:

```text
OVF-001 High
Objective overflow coverage is incomplete: required clipped content and required off-viewport/off-container elements can pass.

BOR-001 High
Uniform evidenced borders are checked on only one side, allowing incorrect bottom/left/right borders to pass.

DOC-001 High or artifact-level blocker
Active documentation claims protections that implementation does not yet provide.
```

4. Confirm the recommended hardening finding:

```text
SCH-001 Medium
Selector-map forbidden-field validation is exact-match and shallow, silently ignoring semantic fields such as expectedScroll, allowOverflow, or validTruncation.
```

5. Confirm these findings remain separate unless directly affected:

```text
TYP-001 role granularity
FNT-001 stronger font substitution detection
NOE-001 programmatic NOEV marker
TST-001 through TST-006 broader automation gaps
FIX-001 pre-existing private fixture sanitization
```

6. Run baseline focused tests before source changes.
7. Reproduce `OVF-001`, `BOR-001`, and `SCH-001` with actual output.
8. Confirm root `tester.xml` remains excluded and is not read by automated tests.
9. Stop if the repository state differs materially from the verification report.
10. Do not commit, push, or start another feature phase in this task.

Record entry-gate evidence in the final response.

## 2. Corrective Patch Objective

Implement the smallest safe patch that:

1. Detects objective horizontal and vertical overflow affecting required mapped content.
2. Detects required mapped elements outside their required container or viewport.
3. Detects required text/content clipping without inventing design intent.
4. Keeps `overflow:hidden` non-failing unless measurable clipping or out-of-bounds loss exists.
5. Preserves `expected-scroll` and `valid-truncation` as explicit unsupported-no-evidence dispositions.
6. Checks all evidenced border sides rather than only the top edge.
7. Keeps border style unsupported when the parser/transcript supplies no style fact.
8. Recursively rejects semantic or expected-value fields in selector maps, case-insensitively.
9. Synchronizes implementation, tests, active docs, skill, and status wording.
10. Preserves every PR 6A and PR 6B safety invariant.
11. Produces focused re-verification evidence suitable for a genuine independent review in a fresh session.

Do not narrow the documentation claim merely to avoid implementing objective overflow checks. Do not invent semantic exceptions.

## 3. Allowed Scope

Changes may include only the minimum necessary files, likely:

```text
src/framework/angular/render-geometry.mjs
src/framework/angular/render-verify.mjs only if aggregation or browser collection integration requires it
src/framework/angular/selector-map.mjs
test/render-geometry.test.mjs
test/render-verify.test.mjs only for production-browser coverage
test/selector-map.test.mjs
minimal synthetic variants under test/fixtures/render-geometry/
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/status.md only if current PR 6C state wording requires correction
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md only if its contract is stale
```

Do not modify every listed file automatically. Use the smallest evidence-backed diff.

## 4. Explicitly Out of Scope

Do not implement:

- parser expansion for row/cell facts;
- invented table-row or cell-padding expectations;
- semantic expected-scroll flags;
- semantic valid-truncation flags;
- pagination or alignment expectations without design evidence;
- AI vision scoring;
- blocking screenshot pixel comparison;
- OCR;
- visual auto-correction;
- multi-browser support;
- broad responsive matrices;
- full accessibility audit;
- browser lifecycle redesign;
- network-policy redesign;
- package-contract redesign;
- static verify redesign;
- resolver, referee, snapshot, or parser redesign;
- new dependencies;
- repository-wide scanning;
- private-fixture remediation for `FIX-001`;
- unrelated refactoring;
- commit or push.

## 5. Required Pre-Fix Reproduction

Use:

```bash
TMP_ROOT="/tmp/sliceui-pr6c-corrective-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Use the repository CLI explicitly:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs verify <dir> [name] --render
```

Never use the global/on-PATH binary.

### OVF-001 reproduction

Create synthetic isolated variants for:

```text
required element positioned far outside viewport
required child extending beyond mapped parent container
required horizontal text clipping
required vertical content clipping
scrollWidth > clientWidth beyond tolerance
scrollHeight > clientHeight beyond tolerance
overflow:hidden with no measurable clipping
overflow within tolerance
```

Record for each:

```text
mapping state
required/optional status
container locator
child/content locator
bounding rectangles
clientWidth/clientHeight
scrollWidth/scrollHeight
overflow-x/overflow-y
viewport intersection
final state
diagnostic ID
```

Pre-fix behavior to reproduce:

```text
at least one objective required off-viewport/off-container/clipping defect
→ no blocking overflow diagnostic
→ pass or otherwise false-green
```

### BOR-001 reproduction

Use a design fact representing a uniform border, for example:

```text
expected all sides: 1px, evidenced normalized color
```

Render variants:

```text
all sides correct
wrong top
wrong right
wrong bottom
wrong left
multiple wrong sides
```

Pre-fix behavior to reproduce:

```text
top side correct
bottom/left/right incorrect
→ check passes because only top is measured
```

Record expected/actual values per side and final state.

### SCH-001 reproduction

Construct invalid selector maps containing semantic or expected-value fields in multiple shapes:

```text
expectedScroll
allowOverflow
validTruncation
ellipsisExpected
expectedHeight
expectedGap
expectedAlignment
ExpectedScroll
ALLOWOVERFLOW
nested metadata.expectedScroll
nested renderLocator.validTruncation
array-contained semantic object
```

Pre-fix behavior to confirm:

```text
field is silently ignored
map remains accepted
```

Also confirm fields cannot currently reach geometry comparison. This explains severity but does not remove the strictness defect.

Do not change source before all three findings are recorded.

## 6. Root-Cause Audit

Audit at minimum:

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
```

Search:

```bash
rg -n "overflow|scrollWidth|clientWidth|scrollHeight|clientHeight|viewport|clipp|bounding|borderTop|borderRight|borderBottom|borderLeft|borderColor|forbidden|expectedScroll|allowOverflow|validTruncation|ellipsisExpected" \
  src test docs skill
```

Prove:

- which objective overflow measurements already exist;
- which claimed clipping/off-viewport checks are missing;
- which mapped element is treated as overflow container;
- how required versus optional overflow facts are represented;
- why only one border side is currently checked;
- whether uniform border facts imply all four sides;
- whether side-specific design facts are possible;
- why selector-map denylist misses case variants and nested fields;
- how validated maps are structurally reduced before geometry use;
- where active documentation overclaims current behavior.

## 7. Objective Overflow Contract

Implement only objectively measurable defects.

Blocking required defects:

```text
scrollWidth - clientWidth > tolerance
scrollHeight - clientHeight > tolerance
required mapped element extends outside required mapped container beyond tolerance
required mapped element lies outside viewport beyond tolerance
required visible text/content is clipped horizontally beyond tolerance
required visible text/content is clipped vertically beyond tolerance
```

Do not infer or invent whether scroll/truncation is intentional.

## 8. Overflow Container Semantics

Every overflow check must identify:

```text
required content element
mapped required container or viewport
measurement axis
semantic relationship
tolerance
```

Rules:

1. Use mapped parent/container only when the selector/transcript relationship is defensible.
2. Do not scan every DOM ancestor and choose one arbitrarily.
3. If a required container cannot be mapped uniquely, return non-green mapping state.
4. Off-container checks compare child and container bounding rectangles.
5. Off-viewport checks compare required element bounds to the configured viewport.
6. Partially outside by more than tolerance is a defect.
7. Elements intentionally positioned outside without design evidence are still defects when required.

## 9. Scroll Dimension Semantics

Measure:

```text
clientWidth
clientHeight
scrollWidth
scrollHeight
```

Compute:

```text
horizontalDelta = scrollWidth - clientWidth
verticalDelta = scrollHeight - clientHeight
```

Policy:

```text
delta <= tolerance → pass
delta > tolerance → visual-fail for required content/container
```

Do not fail because CSS overflow mode is `hidden`, `auto`, or `scroll` alone. Measurable loss or overflow is required.

## 10. Text and Content Clipping

Use objective geometry, not OCR.

Possible evidence:

```text
scrollWidth > clientWidth
scrollHeight > clientHeight
child bounds exceed text/container bounds
line box/element bounds exceed clipped parent bounds
required element is outside mapped container
```

Rules:

- no clipping measured → no failure;
- CSS ellipsis alone → no failure;
- ellipsis plus clipped required content without design intent → visual-fail;
- `overflow:hidden` without clipping → pass;
- hidden/non-rendered duplicate handling follows PR 6B mapping rules;
- do not expose full text bodies in diagnostics.

## 11. Expected-Scroll and Valid-Truncation NOEV

Keep these explicit unsupported-no-evidence dispositions:

```text
expected table scroll
intentional ellipsis/truncation
```

Required behavior:

- no semantic exception is inferred;
- selector map cannot declare the exception;
- NOEV rows remain visible;
- NOEV does not count as implemented/pass;
- NOEV does not automatically fail an otherwise evidence-complete render;
- objective overflow/clipping remains blocking in the absence of evidence.

Do not add fields such as:

```text
expectedScroll
allowOverflow
validTruncation
ellipsisExpected
scrollIntent
truncateIntent
```

## 12. Overflow Diagnostics

Each overflow defect must include bounded evidence:

```text
stable diagnostic ID
category: overflow
required: true
design fact/container locator
DOM content locator
container locator
axis
client width/height
scroll width/height
bounding edges where relevant
delta
tolerance
overflow-x/overflow-y
remediation
```

Do not include full HTML, full text content, form values, private data, or absolute private paths.

## 13. Full-Side Border Contract

When design evidence represents a uniform border, compare all four sides:

```text
top
right
bottom
left
```

For each side compare supported facts:

```text
width
color
```

Border style remains unsupported-no-evidence when not supplied by transcript/parser.

## 14. Uniform Versus Side-Specific Border Evidence

Classify border facts:

```text
uniform border → all four sides expected equal
side-specific border → compare only evidenced side(s)
divider → compare only evidenced divider side/orientation
```

Do not convert a divider fact into a uniform border expectation.

Do not assume missing sides should be bordered unless the design fact is uniform.

## 15. Border Width Comparison

For each evidenced side:

```text
actual = computed border-<side>-width
expected = transcript/XML stroke width
delta = actual - expected
tolerance = centralized border tolerance
```

Required mismatch outside tolerance produces visual-fail.

Diagnostics must identify the side.

Do not combine four mismatches into an unreadable style dump. Use one bounded aggregate diagnostic or a bounded per-side diagnostic policy.

## 16. Border Color Comparison

For each evidenced side:

```text
actual = normalized computed border-<side>-color
expected = normalized design color
```

Rules:

- normalize rgb/rgba/hex consistently;
- handle alpha explicitly;
- exact normalized comparison where deterministic;
- transparent and absent borders must not accidentally match an opaque expected border;
- diagnostic identifies side and normalized values.

## 17. Border-Style NOEV

Verify and preserve:

```text
border style expected fact unavailable
→ unsupported-no-evidence
```

Do not assume `solid` from browser output, CSS defaults, or project conventions.

Border-style NOEV:

- remains visible;
- does not count as pass;
- does not block closure when width/color evidence is fully checked;
- is not described as implemented.

## 18. Full-Side Border Tests

Required tests:

- [ ] All four sides correct → pass.
- [ ] Top width wrong → visual-fail.
- [ ] Right width wrong → visual-fail.
- [ ] Bottom width wrong → visual-fail.
- [ ] Left width wrong → visual-fail.
- [ ] Top color wrong → visual-fail.
- [ ] Right color wrong → visual-fail.
- [ ] Bottom color wrong → visual-fail.
- [ ] Left color wrong → visual-fail.
- [ ] Multiple wrong sides → deterministic bounded diagnostics.
- [ ] Divider checks remain side-specific.
- [ ] Border style remains NOEV.
- [ ] Wrong nested DOM layer is not measured.

At least one browser-path regression must reproduce the original top-correct/bottom-left-wrong false pass and prove it now fails.

## 19. Recursive Selector-Map Strictness

Replace shallow exact-match semantic-field filtering with recursive, case-insensitive validation.

Traverse every object and array value in the selector-map payload before structural reduction.

Reject keys whose normalized form indicates expected value or semantic exception.

At minimum reject normalized patterns covering:

```text
expected*
actual*
value
values
allowOverflow
expectedScroll
scrollIntent
validTruncation
ellipsisExpected
truncateIntent
expectedHeight
expectedWidth
expectedGap
expectedAlignment
expectedColor
expectedRadius
```

Use careful matching so harmless locator/schema keys are not rejected accidentally.

## 20. Case and Nesting Normalization

Validation must detect:

```text
expectedScroll
ExpectedScroll
EXPECTED_SCROLL
expected-scroll
expected_scroll
nested.expectedScroll
array item containing allowOverflow
renderLocator.validTruncation
metadata.expectedHeight
```

Normalize key casing and separators for detection.

Do not inspect or reject selector string text merely because it contains an innocent word sequence. Validate field names and schema positions separately from selector safety rules.

## 21. Selector-Map Allowlist and Denylist

Prefer an explicit schema allowlist for known objects:

Root:

```text
version
mappings
```

Mapping entry:

```text
designNodeId
renderLocator
required
```

Render locator:

```text
strategy
selector
```

Unknown fields should be rejected rather than silently ignored.

The recursive semantic-field deny check remains defense-in-depth for nested/obfuscated structures.

## 22. Selector-Map Failure Contract

Invalid map:

```text
primary state: invalid-input
exit code: 2
stable SUI-RENDER-MAP diagnostic
browser launch: 0
workspace/artifact writes: 0 or cleaned immediately
```

Diagnostic includes:

```text
safe normalized field path
reason
remediation
```

Do not echo sensitive values.

## 23. Selector-Map Tests

Required tests:

- [ ] Valid map accepted.
- [ ] Unknown root field rejected.
- [ ] Unknown mapping-entry field rejected.
- [ ] Unknown locator field rejected.
- [ ] `expectedScroll` rejected.
- [ ] `allowOverflow` rejected.
- [ ] `validTruncation` rejected.
- [ ] `ellipsisExpected` rejected.
- [ ] Expected geometry fields rejected.
- [ ] Case variants rejected.
- [ ] Separator variants rejected.
- [ ] Nested objects rejected.
- [ ] Array-contained semantic fields rejected.
- [ ] Valid CSS selector containing ordinary words remains accepted.
- [ ] Invalid map prevents browser launch.
- [ ] Existing unique/missing/ambiguous mapping semantics unchanged.

## 24. Required/Optional/NOEV Aggregation Preservation

Re-test:

```text
all required pass + NOEV rows → pass
required overflow fail → visual-fail
required border side fail → visual-fail
required mapping missing/ambiguous → non-green
optional warning only with required pass → pass with warning
zero required/executed required → unverifiable
runtime/setup failure → outranks geometry
invalid selector map → invalid-input before browser
```

NOEV rows must never satisfy required evidence.

## 25. Documentation Synchronization

Update active owning docs to match the post-fix implementation exactly.

Required wording:

```text
objective required horizontal/vertical overflow is measured
required content outside mapped container or viewport is blocking
required clipped content is blocking when measurable
`overflow:hidden` alone does not fail
expected-scroll and valid-truncation intent remain NOEV
uniform evidenced borders check all four sides for width/color
side-specific divider facts remain side-specific
border style remains NOEV
selector maps reject unknown/semantic/expected-value fields recursively
selector maps remain locator-only
```

Likely owners:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
```

Update `status.md` only if current wording about uncommitted PR 6C or corrective status becomes inaccurate. Do not rewrite unrelated history.

Do not rewrite the historical verification verdict. Add a clearly labeled post-verification correction appendix only if the report contains factual claims that must reflect the corrective chain, and only if workflow precedent permits it. Prefer leaving the independent report unchanged and documenting resolution in the focused re-verification result.

## 26. TYP-001 and FNT-001 Decision

Do not force these findings into this corrective patch unless the existing fixture/transcript provides defensible evidence and the change is local.

### TYP-001

Resolve only if distinct typography roles can be mapped from transcript/XML plus locator-only selector maps without using HTML tags as the oracle.

Otherwise retain as factual limitation or NOEV.

### FNT-001

Add `document.fonts.check()` only if:

```text
expected font family is a literal fact
font readiness is stable
failure semantics are documented
no font is downloaded
```

Otherwise keep it deferred/NOEV. Do not invent font evidence.

## 27. NOEV Contract Preservation

Verify explicit unsupported rows remain for:

```text
table row height
table cell padding
border style
non-evidenced alignment
expected scroll intent
valid truncation intent
```

NOEV remains visible, does not count as pass, and does not block evidence-complete closure.

## 28. Existing Geometry Non-Regression

Re-test:

```text
root padding
control height
line height
divider thickness
text color/size/weight
gap
radius
letter spacing
role typography where implemented
font family where supported
optional button/table frame warnings
```

Only overflow, border-side coverage, selector-map strictness, and associated docs should change materially.

## 29. PR 6A and PR 6B Safety Non-Regression

Re-test:

```text
static verify no browser
static fail short-circuit
viewport upper bound
network blocking and sanitization
runtime-fail
cleanup
target writes zero
development-only package contract
required ambiguity non-green
optional ambiguity non-blocking
silent first-pick absent
required control height
zero-required guard
```

## 30. Browser-Level Regression Tests

At minimum use the production browser path for:

```text
off-viewport required element
required child outside mapped container
required horizontal clipped content
required vertical clipped content
uniform border with wrong bottom side
uniform border with wrong left side
overflow:hidden without clipping
```

Pure helper tests are not sufficient for browser behavior claims.

## 31. Determinism

Run at least three times:

```text
known-good structural fixture
off-viewport defect
clipping defect
full-side border defect
invalid selector map
```

Normalize timestamps and temporary paths only.

Assert stable:

```text
primary state
exit code
diagnostic IDs
mapping state
expected/actual/delta/tolerance
border side ordering
overflow evidence
candidate summaries
```

## 32. Performance and Boundedness

Preserve one bounded browser collection pass where practical.

Measure:

```text
browser evaluation count
mapped fact count
overflow measurement count
border-side measurement count
candidate summary limit
known-good render median before/after
defect render median
```

No full DOM scan outside the bounded mapped collection. No unbounded diagnostics.

## 33. Read/Write/Network/Process Boundary

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

## 34. Required Test Checklist

### OVF-001

- [ ] Required horizontal scroll overflow outside tolerance fails.
- [ ] Required vertical scroll overflow outside tolerance fails.
- [ ] Required element outside mapped container fails.
- [ ] Required element outside viewport fails.
- [ ] Required horizontal text clipping fails.
- [ ] Required vertical clipping fails.
- [ ] Overflow within tolerance passes.
- [ ] Equal scroll/client dimensions pass.
- [ ] `overflow:hidden` without clipping passes.
- [ ] Ellipsis without clipping passes.
- [ ] Ellipsis with clipped required content and no intent evidence fails.
- [ ] Expected-scroll remains NOEV.
- [ ] Valid-truncation remains NOEV.
- [ ] Diagnostics include bounded dimensions and axis.

### BOR-001

- [ ] Uniform border checks top/right/bottom/left width.
- [ ] Uniform border checks top/right/bottom/left color.
- [ ] Each single-side defect fails.
- [ ] Multiple-side defect deterministic.
- [ ] Divider remains side-specific.
- [ ] Border style remains NOEV.
- [ ] Correct visible layer measured.

### SCH-001

- [ ] Strict schema allowlist.
- [ ] Unknown fields rejected.
- [ ] Semantic fields rejected recursively.
- [ ] Case/separator variants rejected.
- [ ] Nested/array fields rejected.
- [ ] Valid selectors remain accepted.
- [ ] Invalid map exits 2 before browser.
- [ ] No sensitive values in diagnostic.

### Aggregation and non-regression

- [ ] Required overflow/border failure blocks.
- [ ] NOEV does not count as pass.
- [ ] Zero required remains unverifiable.
- [ ] Optional warnings remain non-blocking.
- [ ] PR 6A/6B suites remain green.
- [ ] Full suite passes except pre-existing skips.

## 35. Validation Commands

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
node --test test/selector-map.test.mjs
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
```

After implementation, run `node --check` on all changed/new source and tests.

Focused suite must include browser-backed OVF/BOR regressions and selector-map invalid-input tests.

Relevant combined suite must include:

```text
render geometry
render verify
selector map
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

## 36. Focused Re-Verification Matrix

After implementation, dynamically verify:

```text
known-good structural fixture
off-viewport required element
off-container required child
horizontal clipping
vertical clipping
overflow within tolerance
overflow:hidden without clipping
ellipsis without clipping
ellipsis with clipping and no intent evidence
uniform border known-good
wrong top border
wrong right border
wrong bottom border
wrong left border
invalid selector semantic field
nested invalid selector semantic field
case-variant invalid field
valid selector map
zero required evidence
network attempt
runtime failure
invalid viewport
```

For each record:

```text
state
exit code
mapping status
diagnostic ID
expected/actual/delta/tolerance
axis/side
NOEV rows
browser launch
cleanup
target mutation
```

## 37. Focused Re-Verification Decision

Required result:

```text
PR 6C corrective patch: PASS / FAIL
OVF-001: RESOLVED / UNRESOLVED
BOR-001: RESOLVED / UNRESOLVED
DOC-001: RESOLVED / UNRESOLVED
SCH-001: RESOLVED / DEFERRED / UNRESOLVED
Objective required overflow blocking: YES / NO
Off-container/off-viewport blocking: YES / NO
Full-side evidenced borders checked: YES / NO
Expected-scroll intent invented: NO / YES
Valid-truncation intent invented: NO / YES
Selector maps locator-only and strict: YES / NO
PR 6A/6B safeguards preserved: YES / NO
PR 6C ready for fresh independent verification: YES / NO
Full PR 6 complete: NO
```

Full PR 6 remains incomplete until a genuine independent verification in a fresh session passes and the checkpoint is committed.

## 38. Fresh Independent Verification Handoff

After focused re-verification passes, prepare only the information necessary for a fresh-session verifier:

```text
repository path
baseline checkpoint 60a0835
path to independent-verification prompt
path to authoritative documents
instruction that source reconstruction is required
```

Do not provide the new verifier with expected verdicts, implementation summaries, or preselected conclusions beyond known historical reports.

Do not create a session handoff unless the user asks or the current session must stop.

## 39. Documentation Sync Gate

You may state:

```text
Documentation sync: clear.
```

only when:

- overflow docs match objective checks;
- expected-scroll/truncation remain NOEV;
- border docs say all evidenced sides;
- border style remains NOEV;
- selector-map docs describe recursive strict rejection;
- `status.md` remains historically accurate;
- full PR 6 is still not called complete.

Otherwise list the stale document and exact correction.

## 40. Git and Safety Rules

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

Do not commit or push. A fresh independent verification is required first.

Record initial/final status and source hashes.

## 41. Work Sequence

### Phase 1: Gate and reproduce

- read verification report and disclosure;
- confirm findings;
- reproduce OVF-001, BOR-001, SCH-001;
- run baseline tests.

### Phase 2: Root-cause and policy note

Before coding, state:

```text
overflow measurement gaps
container/viewport semantics
clipping evidence
border uniform/side-specific semantics
selector-map validation gap
NOEV preservation
docs to update
files to change
tests
```

### Phase 3: Objective overflow implementation

- scroll dimensions;
- off-container;
- off-viewport;
- clipping;
- bounded diagnostics;
- no semantic exceptions.

### Phase 4: Full-side border implementation

- all evidenced sides;
- width and color;
- uniform versus side-specific;
- style remains NOEV.

### Phase 5: Recursive selector-map strictness

- schema allowlist;
- recursive unknown/semantic-field rejection;
- case/separator normalization;
- pre-browser invalid-input.

### Phase 6: Tests and browser regressions

- helper boundaries;
- browser objective defects;
- full-side borders;
- selector-map negatives;
- determinism;
- PR 6A/6B regression;
- full suite.

### Phase 7: Documentation and focused re-verification

- synchronize owning docs;
- preserve historical reports;
- decide readiness for fresh independent session.

## 42. Required Final Response

### Entry Gate

```text
PR 6C verification decision:
Independence disclosure acknowledged:
OVF-001 confirmed:
BOR-001 confirmed:
DOC-001 confirmed:
SCH-001 confirmed:
Other blockers:
```

### Pre-Fix Reproduction

```text
Off-viewport required element state:
Off-container required child state:
Clipped required content state:
Wrong non-top border state:
Semantic selector field accepted:
Browser/diagnostic behavior:
```

### Root Cause

Include paths, symbols, collection behavior, aggregation, selector-map validation, and documentation ownership.

### Corrective Patch Summary

Describe only the minimum changes.

### Files Changed

Group source, tests/fixtures, docs/skill/status, historical reports, and excluded prompts/private file.

### Overflow Contract After Fix

```text
horizontal scroll overflow:
vertical scroll overflow:
off-container required element:
off-viewport required element:
required clipping:
overflow:hidden without clipping:
expected-scroll intent:
valid-truncation intent:
```

### Border Contract After Fix

```text
uniform border sides:
side-specific border:
width comparison:
color comparison:
style evidence:
diagnostic policy:
```

### Selector-Map Contract After Fix

```text
schema allowlist:
unknown fields:
semantic fields:
case/separator variants:
nested/array fields:
invalid-input behavior:
locator-only guarantee:
```

### Validation

List exact commands and outcomes.

### Determinism and Performance

```text
known-good runs:
overflow-defect runs:
border-defect runs:
invalid-map runs:
variance:
browser evaluations:
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
PR 1-5 safeguards:
```

### Focused Re-Verification Decision

```text
PR 6C corrective patch: PASS / FAIL
OVF-001: RESOLVED / UNRESOLVED
BOR-001: RESOLVED / UNRESOLVED
DOC-001: RESOLVED / UNRESOLVED
SCH-001: RESOLVED / DEFERRED / UNRESOLVED
Objective required overflow blocking: YES / NO
Off-container/off-viewport blocking: YES / NO
Full-side evidenced borders checked: YES / NO
Expected-scroll intent invented: NO / YES
Valid-truncation intent invented: NO / YES
Selector maps locator-only and strict: YES / NO
PR 6A/6B safeguards preserved: YES / NO
PR 6C ready for fresh independent verification: YES / NO
Full PR 6 complete: NO
```

### Deferred Work

Keep separate:

```text
TYP-001 if evidence remains insufficient
FNT-001 if reliable font evidence remains insufficient
NOE-001 programmatic marker enhancement
FIX-001 pre-existing fixture privacy sanitization
non-blocking test automation gaps
parser metadata expansion
```

### Documentation Sync

Use `Documentation sync: clear.` or list stale docs.

### Git Status

Include exact `git status --short`. Do not commit or push.

## 43. Definition of Done

The corrective patch is complete only when objective required horizontal/vertical overflow, off-container, off-viewport, and measurable clipping defects are blocking; `overflow:hidden` without clipping remains valid; expected-scroll and valid-truncation exceptions remain honest NOEV dispositions; every evidenced uniform border side is checked for width and color while unsupported style is not invented; selector maps recursively and case-insensitively reject unknown semantic/expected-value fields before browser launch; required/optional/NOEV aggregation, ambiguity safety, zero-required protection, privacy, target isolation, network safety, and PR 6A/6B invariants remain intact; browser-level regressions are deterministic; all tests pass; documentation matches behavior; and the implementation is ready for a genuinely independent verification in a fresh session.

Start by reproducing OVF-001, BOR-001, and SCH-001. Do not modify source before all findings are recorded with actual commands and output.
