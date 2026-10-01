# SliceUI PR 6B Implementation Plan: Rendered Geometry Coverage

Repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Real target project, read-only reference only unless copied into `/tmp`:

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
```

Secondary context:

```text
SLICEUI-PR6-RENDERED-VISUAL-FIDELITY-IMPLEMENTATION-PROMPT.md
SLICEUI-PR6-INDEPENDENT-VERIFICATION-CHECKLIST.md
SLICEUI-PR6A-CORRECTIVE-PATCH-RENDER-SAFETY-PROMPT.md
SLICEUI-PR6A-CHECKPOINT-COMMIT-PLAN.md
```

Source, active documentation, committed checkpoints, and verification reports are more authoritative than old planning prompts.

## 1. Objective

Implement **PR 6B Rendered Geometry Coverage** on top of the committed PR 6A Render Foundation and Safety.

PR 6B must add the remaining evidence-backed geometry checks required to complete full PR 6:

```text
control heights
button proportions
major horizontal and vertical gaps
table header density
table row density
table cell padding
table footer density
pagination geometry
relative alignment
overflow and clipping
border and radius coverage
typography and line-height coverage
```

The work must reuse the PR 6A browser lifecycle, network isolation, failure boundary, package contract, target isolation, screenshot policy, and opt-in CLI. Do not redesign those systems.

## 2. Mandatory Entry Gate

Before changing source:

1. Confirm checkpoint `0394317` is current HEAD or a direct ancestor.
2. Confirm the recorded status:

```text
PR 6A Render Foundation and Safety: COMPLETE
PR 6B Geometry Coverage: REQUIRED
Full PR 6: INCOMPLETE
```

3. Confirm PR 6A findings:

```text
RNS-001: RESOLVED
NET-001: RESOLVED
PKG-001: RESOLVED
RUN-001: RESOLVED
FNT-001: DEFERRED
```

4. Run baseline render, static verify, and full-suite tests.
5. Audit existing transcript/XML design facts that can support each PR 6B check.
6. Classify all working-tree files.
7. Treat root-level `SLICEUI-PR*.md` files and `tester.xml` as excluded unless fixture ownership is explicitly decided below.
8. Stop if unknown modifications exist.
9. Do not change source before producing a short geometry coverage and fixture-ownership note.

Record entry-gate evidence in the final response.

## 3. Existing Foundation That Must Be Preserved

PR 6A already owns:

```text
opt-in `--render`
static verify short-circuit
viewport validation
isolated temporary Angular mount
phase-aware render error boundary
active external-network blocking
runtime-fail propagation
browser and workspace cleanup
development-only package contract
screenshot lifecycle
root padding comparison
divider thickness comparison
text color comparison
text size comparison
text weight comparison
```

PR 6B must extend measurement and comparison only.

Do not change these contracts unless a proven regression requires a minimal correction.

## 4. Explicit Scope

PR 6B may add or modify:

```text
src/framework/angular/render-verify.mjs
small geometry measurement/comparison helpers under src/lib/ or src/framework/angular/
test/render-verify.test.mjs
minimal official geometry fixture files if approved by fixture decision
skill/SKILL.md
active owning documentation
```

Modify `src/commands/verify.mjs` or `src/cli.mjs` only if a geometry-specific option is genuinely required. Prefer no new CLI flags.

Do not create many helpers unless existing ownership becomes unclear.

## 5. Out of Scope

Do not implement:

- AI vision scoring;
- blocking screenshot pixel diff;
- OCR;
- multi-browser matrix;
- broad responsive breakpoint matrix;
- visual auto-correction;
- production application crawling;
- complete CSS cascade debugger;
- full accessibility audit;
- full Angular compiler integration;
- parser rewrite;
- resolver/referee/snapshot redesign;
- public packaging of the dev-only render fixture;
- browser/network/package-contract redesign;
- repository-wide source scan;
- new heavy dependency;
- unrelated refactor;
- commit or push before independent verification.

## 6. Fixture Ownership Decision

`tester.xml` is currently untracked and was intentionally excluded from PR 6A.

Before implementation, determine whether it becomes an official PR 6B fixture.

### Option A: official checked-in fixture

Use only if:

- it contains no private or sensitive design data;
- its ownership and license permit inclusion;
- it is stable and minimal enough for regression testing;
- it provides design facts needed for table, controls, spacing, and overflow;
- it is moved deliberately into the repository fixture convention;
- expected facts are documented;
- it is not committed from repository root as `tester.xml`.

Suggested destination must follow existing conventions, conceptually:

```text
test/fixtures/render-geometry/<fixture-name>/design.xml
```

### Option B: local evaluation input

Use if ownership or stability is uncertain.

- keep `tester.xml` untracked;
- copy it to `/tmp` for evaluation;
- create a smaller synthetic official fixture containing only non-sensitive facts;
- do not stage `tester.xml`.

### Required decision note

Before coding, state:

```text
selected option
reason
fixture path
facts covered
sensitive-data review
expected maintenance owner
```

If material ownership is unclear, choose Option B. Do not silently commit `tester.xml`.

## 7. Geometry Coverage Inventory

Create a pre-implementation matrix for:

```text
root padding
major gaps
input height
select height
button height
button width/proportions
button horizontal padding
button icon/text gap
font family
font size
font weight
line height
section/header typography
table header height
table row height
table cell vertical padding
table footer height
pagination control height
pagination relative position
search/limit toolbar height
checkbox/action column alignment
visible overflow/clipping
border width/style/color
border radius
```

For each record:

```text
design evidence path
literal or structural fact
DOM mapping strategy
CSS box model used
comparison type
tolerance
required or optional
blocking or warning
fixture coverage
```

Do not implement a check without a defensible expected fact.

## 8. Design Facts as the Only Expected Geometry Oracle

Expected values must come from:

```text
raw XML/FIGML literal facts
transcript literal facts
transcript structural relationships
```

Do not use as expected geometry:

```text
resolved.json
spec.md
agent-context.md
sample component defaults
old generated output
Pilar showcase dimensions
screenshot intuition
```

Pilar/library information may identify a rendered component or explain behavior, but it does not replace literal design geometry.

## 9. Geometry Semantic Mapping

Design frame dimensions are not automatically CSS dimensions.

For every fact, classify:

```text
literal rendered box
container frame
canvas position
content box
border box
visual bounds
structural relationship
fluid/unconstrained dimension
```

Examples:

- a Figma input frame may represent rendered control height;
- a button frame may represent border-box size;
- a parent frame width may be fluid layout context, not a fixed CSS width;
- canvas x/y is not internal padding;
- repeated table-row instances may establish row height;
- auto-layout item spacing may establish `gap`.

Store or expose this classification in measurement metadata where useful.

## 10. DOM Mapping Safety

Reuse PR 6A mapping but strengthen it for geometry families.

Mapping may use:

```text
visible text
role
component selector
bounded structural relation
known table semantics
stable temporary-only fixture markers
```

Rules:

1. Never first-pick ambiguous matches.
2. Filter hidden/non-rendered duplicates.
3. Record candidate count for ambiguity.
4. Required ambiguous mapping makes the check unverifiable/non-green.
5. Optional ambiguous mapping skips with reason.
6. Do not modify production component source to add permanent IDs.
7. Temporary fixture instrumentation must remain isolated.

Test repeated labels and repeated controls.

## 11. Box Model Collection

Collect normalized browser measurements:

```text
getBoundingClientRect
computed width/height
box-sizing
padding top/right/bottom/left
border widths
margin where relationship checks require it
gap/row-gap/column-gap
font family/size/weight/line-height
border radius
scrollWidth/clientWidth
scrollHeight/clientHeight
overflow-x/overflow-y
visibility/display/opacity where relevant
```

Normalize numeric CSS values into pixels where deterministic.

Do not compare `auto`, percentages, viewport units, or intrinsic values as fixed pixels without a documented conversion context.

## 12. Measurement Contract

Each comparison result should include:

```text
stable diagnostic ID
category
status/severity
design node/fact locator
DOM locator
semantic measurement type
expected
actual
delta
tolerance
unit
required/optional
trust: literal-design or structural-design
remediation
```

Do not emit large style dumps.

## 13. Tolerance Policy

Derive tolerances from:

```text
three-run deterministic variance
browser subpixel behavior
measurement semantics
fixture evidence
```

Separate policy by family:

```text
box position/size
padding/gap
font size
line height
border width
border radius
relative alignment
color
```

Required rules:

- exact zero variance does not require zero tolerance if subpixel allowance is justified;
- tolerance must not hide material mismatch;
- boundary semantics must be explicit (`abs(delta) <= tolerance` passes or equivalent);
- relative tolerance may be used only for large fluid dimensions;
- each diagnostic reports its tolerance;
- tolerance values are centralized, not scattered magic numbers.

## 14. Control Height Coverage

Implement evidence-backed checks for:

```text
input height
select height
button height
checkbox visual box where explicit
other controls only if design facts exist
```

Rules:

- compare rendered border-box height when design frame is classified as literal control box;
- include border and padding naturally through `getBoundingClientRect`;
- avoid checking hidden native inputs behind custom controls unless the visible wrapper is the design element;
- multiple same-role controls require deterministic mapping;
- no design fact means honest skip.

Required defects:

```text
control too tall
control too short
control missing
ambiguous mapping
```

## 15. Button Proportion Coverage

Measure where constrained:

```text
height
width if design-fixed
horizontal padding
icon/text gap
icon size when explicit
border radius
text alignment
```

Do not fail button width for fluid or content-driven designs unless expected width is literal.

Add a ratio/proportion diagnostic only if it has a clear semantic interpretation. Prefer direct measurable facts.

## 16. Major Gap Coverage

Compare auto-layout or structural spacing facts:

```text
vertical section gap
horizontal toolbar gap
label-to-control gap
button group gap
icon-to-text gap
header-to-content spacing
footer internal gap
```

Prefer:

```text
computed `gap`
```

when layout uses flex/grid. Otherwise derive relative bounding-box distance between mapped siblings.

Rules:

- account for margins only when `gap` is not the contract;
- avoid double-counting gap plus margins;
- preserve ordering evidence;
- hidden siblings do not count;
- repeated structures require bounded sampling policy.

## 17. Typography and Line-Height Coverage

Extend existing typography checks to include:

```text
font family when reliable evidence exists
font size
font weight
line height
letter spacing if explicit
text wrapping
truncation/clipping relationship
```

FNT-001 remains deferred unless PR 6B now has reliable expected-font evidence.

If expected font family exists:

- record computed family stack;
- determine whether expected family appears;
- do not fetch external fonts;
- fallback must not yield silent typography pass when font changes geometry materially.

Line-height rules:

- normalize `normal` carefully;
- do not invent a numeric expected line height if design does not provide one;
- use rendered line box or computed value consistently.

## 18. Section and Header Typography

Map headings by design evidence, not only HTML tags.

Check:

```text
font size
weight
line height
color
bottom/adjacent spacing where structural evidence exists
```

Repeated text or identical headings must not first-pick.

## 19. Table Fixture Requirements

PR 6B requires a deterministic table-bearing fixture with:

```text
table header
at least two body rows
representative text lengths
checkbox column if design shows one
action column if design shows one
search/limit toolbar if design shows one
footer information
pagination controls
fixed deterministic mock data
```

Do not use real user or production data.

The fixture must not rely on external network requests.

## 20. Table Header Density

Measure:

```text
header row height
header cell vertical padding
header font size
header line height
header text alignment
```

Use a bounded sampling policy:

- compare mapped representative cells;
- fail if required cells materially diverge;
- report min/max when multiple cells are sampled;
- do not emit one redundant diagnostic for every identical cell.

## 21. Table Row Density

Measure:

```text
body row height
cell vertical padding
body text line height
multi-line behavior when design permits
checkbox/action vertical alignment
```

Rules:

- use deterministic rows;
- record sampled row count;
- avoid treating a deliberately taller wrapped row as universal row height;
- expected repeated row height must come from repeated design facts;
- report aggregate evidence such as median/min/max where appropriate.

## 22. Table Cell Padding

Compare top/bottom padding where explicit or derivable.

Distinguish:

```text
cell padding
row height
text line height
border contribution
```

Do not infer cell padding solely from row height when multiple combinations are possible.

## 23. Table Footer Density

Measure:

```text
footer height
internal vertical alignment
information-text line height
pagination control height
footer padding/gap
```

Only require elements shown by design.

## 24. Pagination Geometry

Measure evidence-backed facts:

```text
bounding box
control height
item size
item gap
relative location inside footer
right/left/center alignment
vertical alignment with footer info
```

Do not use PR 4 `behaviorBindings` as expected geometry. Use transcript/XML structural facts.

## 25. Relative Alignment

Prefer relationship checks over absolute coordinate copying.

Examples:

```text
pagination right edge aligns with footer content edge
search and limit controls share a horizontal row
button group aligns to section end
labels align with controls
checkbox/action columns align vertically
```

Comparison may use:

```text
edge delta
center delta
baseline approximation
ordering
containment
```

Document which relation is checked and its tolerance.

## 26. Overflow and Clipping Coverage

Implement checks for:

```text
scrollWidth > clientWidth
scrollHeight > clientHeight
required text clipped
required control outside viewport/container
unexpected hidden overflow
off-screen mapped element
container expansion caused by fixed dimensions
```

Rules:

1. Expected scroll containers must be recognized.
2. Horizontal table scrolling may be valid if design/project contract permits it.
3. `overflow: hidden` is not automatically a failure.
4. A required visible element with clipped content is blocking when unsupported by design.
5. Text truncation may be valid only with evidence.
6. Report actual/client/scroll dimensions.

Create temporary defect variants for horizontal and vertical overflow.

## 27. Border Coverage

Extend border checks where literal facts exist:

```text
width
style
color
side-specific borders
divider orientation
```

Normalize computed colors and widths.

Do not fail a border hidden by design state not currently rendered.

## 28. Radius Coverage

Measure corner radii where explicit:

```text
top-left
top-right
bottom-right
bottom-left
```

Normalize shorthand and per-corner values.

Do not compare a parent container radius against a nested visible control accidentally.

## 29. Required/Optional Check Semantics

For each geometry fact classify:

```text
required literal fact
required structural relation
optional visual detail
unsupported fact
ambiguous mapping
```

Final rendered state rules:

- required implemented fact fails outside tolerance → visual-fail;
- required fact cannot be mapped → unverifiable/non-green;
- optional fact absent → skip with reason;
- unsupported fact → explicit skip, not pass;
- no geometry checks executed → cannot be rendered pass.

## 30. Diagnostic IDs and Categories

Extend the stable diagnostic vocabulary without renumbering existing PR 6A IDs unnecessarily.

Suggested bounded categories:

```text
control-height
button-geometry
spacing
typography
table-density
pagination
alignment
overflow
border
radius
mapping
```

Ensure IDs are unique, stable, documented, and deterministically ordered.

## 31. Failure Aggregation

Rendered result should aggregate checks deterministically:

```text
runtime/setup failure outranks geometry results
required unverifiable outranks pass
blocking geometry mismatch → visual-fail
warnings-only with complete required evidence may pass
```

Do not change PR 6A failure-state contract.

## 32. Screenshot Role

Continue using screenshots as supporting evidence.

PR 6B must not introduce pixel similarity as a blocking oracle.

Screenshot may help inspect:

```text
table density
control size
overflow
alignment
```

Machine decisions must derive from geometry/computed-style measurements.

## 33. Artifact Schema

If geometry output is persisted or enriched, keep it versioned and bounded.

Per measurement include only relevant facts.

Do not persist entire DOM, complete computed-style maps, or large HTML snapshots.

If no report file is persisted by PR 6A, avoid adding a broad artifact system solely for PR 6B unless necessary for verification.

## 34. Determinism Requirements

Run known-good and defect fixtures at least three times.

Normalize only timestamps and temporary paths.

Assert stable:

```text
primary state
check set
element mapping
expected values
actual values within observed variance
diagnostic IDs
ordering
tolerance decisions
screenshot dimensions
```

If table measurements vary due to font or async layout, fix readiness/state determinism before making them blocking.

## 35. Dynamic-State Readiness

Before table/control measurement, confirm:

```text
mock rows rendered
Angular stable enough for measurement
fonts ready
animations disabled
transitions disabled
scroll position reset
expanded/open state explicitly selected if required
```

Use bounded waits. Timeout yields mount/runtime/unverifiable state, never visual pass.

## 36. Static and Safety Non-Regression

PR 6B must preserve:

```text
static verify no browser
static failure short-circuit
viewport bounds
render error boundary
network blocking
runtime-fail behavior
target isolation
development-only package contract
artifact cleanup
```

Add no repository-wide scans or target writes.

## 37. Tests Required: Controls

Test at minimum:

- [ ] Known-good input height passes.
- [ ] Too-tall input fails.
- [ ] Too-short input fails.
- [ ] Known-good select height passes.
- [ ] Button height mismatch fails.
- [ ] Fluid button width is not falsely rejected.
- [ ] Fixed button width mismatch fails when literal.
- [ ] Button horizontal padding mismatch fails when evidenced.
- [ ] Icon/text gap mismatch fails when evidenced.
- [ ] Ambiguous repeated controls do not first-pick.

## 38. Tests Required: Spacing

- [ ] Flex/grid gap known-good passes.
- [ ] Gap outside tolerance fails.
- [ ] Bounding-box sibling distance path works when no CSS gap exists.
- [ ] Margin and gap are not double-counted.
- [ ] Hidden sibling is excluded.
- [ ] Vertical and horizontal spacing use correct axes.

## 39. Tests Required: Typography

- [ ] Font size boundary behavior.
- [ ] Font weight normalization.
- [ ] Line-height known-good and mismatch.
- [ ] `normal` line-height handled honestly.
- [ ] Heading/body/table/button roles map by evidence.
- [ ] Repeated text ambiguity safe.
- [ ] Wrapping/truncation behavior measured where evidenced.

## 40. Tests Required: Table Density

- [ ] Header height pass/fail.
- [ ] Body row height pass/fail.
- [ ] Cell padding pass/fail.
- [ ] Footer height pass/fail.
- [ ] Pagination height and item gap pass/fail.
- [ ] Checkbox/action alignment pass/fail when present.
- [ ] Multi-row sampling deterministic.
- [ ] Wrapped row does not corrupt universal density expectation.
- [ ] No table design facts yields honest skip.

## 41. Tests Required: Alignment

- [ ] Footer pagination right alignment.
- [ ] Shared toolbar row relationship.
- [ ] End-aligned button group.
- [ ] Edge/center deltas reported correctly.
- [ ] Absolute canvas coordinates are not used as component-internal expectations.

## 42. Tests Required: Overflow

- [ ] Horizontal unintended overflow fails.
- [ ] Vertical unintended overflow fails.
- [ ] Expected table scroll container passes.
- [ ] Required clipped text fails when no truncation evidence exists.
- [ ] Explicit valid truncation passes or warns per policy.
- [ ] Off-viewport required element fails.
- [ ] Client/scroll dimensions appear in diagnostic.

## 43. Tests Required: Border and Radius

- [ ] Border width/style/color pass/fail.
- [ ] Side-specific divider check.
- [ ] Radius shorthand normalization.
- [ ] Per-corner mismatch.
- [ ] Correct DOM layer selected.

## 44. Tolerance Boundary Tests

For every tolerance family test:

```text
inside tolerance
exactly at tolerance
just outside tolerance
large mismatch
```

Assert expected/actual/delta/tolerance/unit.

## 45. Mapping Tests

Test:

```text
unique match
repeated visible text
hidden duplicate
nested duplicate
missing element
same-role controls
multiple table rows
```

Required ambiguous fact must not pass.

## 46. Three-Run Browser Tests

At least one known-good complete geometry fixture and one defect fixture must run three times in the real browser path.

Pure helper determinism is not sufficient.

## 47. E2E Validation

Use:

```bash
TMP_ROOT="/tmp/sliceui-pr6b-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Run explicit repository CLI:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs verify <dir> [name] --render
```

Scenarios:

```text
complete known-good geometry fixture
control-height defect
button-spacing defect
table-density defect
pagination-alignment defect
typography/line-height defect
overflow defect
border/radius defect
ambiguous mapping
missing required element
```

Capture:

```text
state
exit code
checks
diagnostics
expected/actual/delta/tolerance
screenshot path/dimensions
timing
target status before/after
```

## 48. Performance

Measure phase costs before/after PR 6B:

```text
browser startup
mount readiness
measurement count
geometry extraction
comparison
screenshot
total
```

Measurement expansion must remain bounded.

Avoid a separate browser evaluation for every property when one bounded collection pass can gather facts.

## 49. Read/Write Boundary

Dynamically prove:

```text
target writes = 0
repository scans = 0
network escapes = 0
temporary writes contained
no npm install
static verify unchanged
```

Do not alter package contract.

## 50. PR 1-6A Non-Regression

Verify:

### PR 1

Compact context remains intact.

### PR 2

Snapshot and ground-truth safety remain intact.

### PR 3

Hot referee still has zero project-source reads.

### PR 4

Resolve provenance and taxonomy ambiguity remain safe.

### PR 5

Name normalization, exact APIs, lexical syntax checking, exit codes, and bounded static reads remain safe.

### PR 6A

Opt-in render, failure boundary, network isolation, runtime state, package contract, target isolation, and cleanup remain safe.

## 51. Documentation and Skill

Update active owning docs only.

Document:

```text
implemented geometry families
fact-to-box semantic mapping
tolerances
required/optional geometry semantics
DOM ambiguity behavior
table sampling policy
overflow policy
screenshot remains supporting evidence
PR 6B completion status
```

Likely owners:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
docs/project-docs/foundation/status.md
skill/SKILL.md
```

Do not overstate unsupported measurements.

## 52. Validation Commands

Before changes:

```bash
git status --short
git rev-parse HEAD
git log -1 --oneline
node --version
npm --version
```

Run baseline actual tests:

```bash
node --test test/render-verify.test.mjs
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
```

Run existing render-mount/probe tests by actual filenames.

After implementation:

```bash
node --check <all changed/new source and test files>
```

Focused suite must include real-browser geometry tests.

Relevant combined suite must include:

```text
render verify
render mount/probe
static verify
snapshot/transcript
Pilar mount/catalog
referee
resolve/spec/agent-context
```

Then:

```bash
npm test
```

## 53. Independent Self-Review Before Completion

Before final response, inspect:

- [ ] Every required family from Section 7 has a status.
- [ ] No missing family is silently omitted.
- [ ] Every blocking check has evidence-backed expected facts.
- [ ] No resolver/spec values are visual truth.
- [ ] Ambiguous mapping never first-picks.
- [ ] Tolerances are centralized and tested.
- [ ] Table sampling is deterministic.
- [ ] Overflow distinguishes expected scrolling.
- [ ] PR 6A safety has not regressed.
- [ ] Target project unchanged.
- [ ] No screenshot or `.sliceui` artifact is in repository.
- [ ] `tester.xml` ownership decision is explicit.

## 54. Acceptance Criteria

PR 6B implementation is complete only if:

- [ ] Fixture ownership is explicit.
- [ ] No sensitive design fixture is committed accidentally.
- [ ] Control height checks implemented.
- [ ] Button proportion checks implemented where literal.
- [ ] Major gap checks implemented.
- [ ] Line-height coverage implemented where evidence exists.
- [ ] Table header density implemented.
- [ ] Table row density implemented.
- [ ] Table cell padding implemented where directly evidenced.
- [ ] Table footer density implemented.
- [ ] Pagination geometry implemented.
- [ ] Relative alignment implemented.
- [ ] Overflow and clipping implemented.
- [ ] Border coverage extended.
- [ ] Radius coverage implemented where evidenced.
- [ ] Required/optional semantics explicit.
- [ ] DOM ambiguity safe.
- [ ] Tolerance boundaries tested.
- [ ] Three-run browser determinism proven.
- [ ] Geometry diagnostics measurable and stable.
- [ ] Screenshot remains supporting evidence.
- [ ] PR 6A safety preserved.
- [ ] Static verify unchanged.
- [ ] Target writes remain zero.
- [ ] No network escapes.
- [ ] Focused tests pass.
- [ ] Relevant suite passes.
- [ ] Full suite passes except pre-existing skips.
- [ ] PR 1-6A non-regression confirmed.
- [ ] Documentation synchronized.
- [ ] Ready for independent verification.

## 55. Safety and Git Rules

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

Do not stage root-level `tester.xml` unless it is deliberately moved into an approved fixture location after the ownership review.

Do not modify the real target project.

Do not commit or push. PR 6B requires independent verification first.

Record initial/final status and source hashes.

## 56. Work Sequence

### Phase 1: Gate and fixture decision

- confirm checkpoint and PR 6A closure;
- classify working tree;
- decide `tester.xml` ownership;
- run baseline tests.

### Phase 2: Coverage and semantic mapping note

Before coding, state:

```text
fixture selected
required fact families
design fact locators
DOM mapping
box-model semantics
tolerance families
required/optional states
files to change
tests
```

### Phase 3: Measurement model extension

- bounded DOM collection;
- box model;
- overflow facts;
- normalized typography/borders/radii.

### Phase 4: Control, button, and spacing checks

- control heights;
- proportions;
- major gaps;
- mapping and diagnostics.

### Phase 5: Table and pagination checks

- header/row/cell/footer;
- pagination;
- sampling;
- alignment.

### Phase 6: Overflow, border, radius, typography

- accidental clipping;
- border/radius;
- line-height;
- wrapping/truncation.

### Phase 7: Tests and deterministic E2E

- helper boundaries;
- real browser known-good and defects;
- three runs;
- tolerance edges;
- isolation.

### Phase 8: Documentation and scope review

- owning docs;
- full PR 6 status only if all acceptance criteria pass.

## 57. Required Final Response

### Entry Gate

```text
Checkpoint baseline:
PR 6A official status:
PR 6B authorized:
Evidence:
```

### Fixture Ownership

```text
tester.xml decision:
official fixture path:
sensitive-data review:
facts covered:
```

### Summary

Describe geometry coverage added without restating PR 6A.

### Files Changed

Group source, tests/fixtures, skill, docs, and excluded prompts/local files.

### Coverage Matrix

List each family as:

```text
implemented / unsupported / no evidence
required / optional
blocking / warning / skip
```

### Semantic Mapping

Explain design-frame-to-CSS-box policy and ambiguity handling.

### Tolerance Policy

List centralized tolerances and observed three-run variance.

### Geometry Diagnostics

Provide representative expected/actual/delta/tolerance examples.

### Table and Pagination Coverage

Report sampling, density, footer, and alignment behavior.

### Overflow Policy

Report expected scroll versus accidental clipping behavior.

### Validation

List exact commands and results.

### Determinism and Performance

```text
known-good runs:
defect runs:
variance:
render median before/after:
measurement count:
```

### Isolation

```text
target reads:
target writes:
repository scans:
network escapes:
temporary artifacts:
```

### PR 1-6A Non-Regression

Report each safeguard.

### Known Limitations

Only factual remaining limitations.

### Documentation Sync

Use `Documentation sync: clear.` or list stale docs.

### Git Status

Include `git status --short`. Do not commit.

## 58. Focused Implementation Decision

End with:

```text
PR 6B implementation: PASS / FAIL
Required geometry coverage complete: YES / NO
Geometry diagnostics deterministic: YES / NO
DOM mapping ambiguity-safe: YES / NO
PR 6A safety preserved: YES / NO
Full PR 6 ready for independent verification: YES / NO
```

Do not claim full PR 6 officially complete until independent verification passes.

## 59. Definition of Done

The task is complete only when all evidence-backed PR 6B geometry families are implemented with deterministic browser measurements, explicit box-model semantics, centralized and tested tolerances, ambiguity-safe DOM mapping, measurable diagnostics, table and pagination density coverage, control and spacing coverage, overflow/clipping protection, border/radius and line-height coverage where supported, unchanged PR 6A safety guarantees, zero target writes and network escapes, passing tests, synchronized documentation, and readiness for independent full PR 6 verification.

Begin by confirming checkpoint `0394317`, deciding the ownership of `tester.xml`, and writing the coverage/semantic-mapping note. Do not modify source before those decisions are complete.
