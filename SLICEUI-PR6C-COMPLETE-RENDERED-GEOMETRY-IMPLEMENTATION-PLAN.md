# SliceUI PR 6C Implementation Plan: Complete Rendered Geometry Coverage

Repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Real target project, read-only reference only unless copied into `/tmp`:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Official PR 6B checkpoint:

```text
60a0835 feat(sliceui): add ambiguity-safe geometry verification
```

Required project documents:

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
```

Secondary planning context:

```text
SLICEUI-PR6-RENDERED-VISUAL-FIDELITY-IMPLEMENTATION-PROMPT.md
SLICEUI-PR6-INDEPENDENT-VERIFICATION-CHECKLIST.md
SLICEUI-PR6A-CORRECTIVE-PATCH-RENDER-SAFETY-PROMPT.md
SLICEUI-PR6B-GEOMETRY-COVERAGE-IMPLEMENTATION-PLAN.md
SLICEUI-PR6B-INDEPENDENT-VERIFICATION-CHECKLIST.md
SLICEUI-PR6B-CORRECTIVE-PATCH-DOM-MAPPING-CONTROL-CONTRACT.md
```

Source code, active documentation, committed checkpoints, and verification reports are more authoritative than old planning prompts.

## 1. Objective

Implement **PR 6C Complete Rendered Geometry Coverage** on top of the committed PR 6A and PR 6B foundations.

PR 6C must complete the remaining evidence-backed rendered geometry families:

```text
structural and flex gaps
table header density
table body-row density
table cell padding
table footer density
pagination geometry
relative alignment
overflow and clipping
border width, style, and color
border radius
font fallback detection
complete typography roles
selector-map coverage for remaining families
```

PR 6C is the final planned geometry phase of PR 6. Full PR 6 may be considered ready for independent closure verification only when every evidence-backed family is either:

```text
implemented and tested,
explicitly unsupported because no defensible design fact exists,
or explicitly accepted out of scope through a documented user decision.
```

Do not silently defer another required geometry phase.

## 2. Mandatory Entry Gate

Before changing source:

1. Confirm checkpoint `60a0835` is current HEAD or a direct ancestor.
2. Confirm the recorded status:

```text
PR 6A Render Foundation and Safety: COMPLETE
PR 6B Geometry Coverage: COMPLETE
MAP-001: RESOLVED
DOC-001: RESOLVED
AGG-001: RESOLVED
PR 6C: REQUIRED
Full PR 6: INCOMPLETE
```

3. Confirm PR 6B invariants:

```text
required mapping missing or ambiguous → non-green
optional ambiguity → warning or skip
zero required geometry checks → unverifiable, exit 3
required mismatch → visual-fail
optional mismatch → warning
silent first-pick → prohibited
```

4. Run baseline render, geometry, static verify, and full-suite tests.
5. Audit every remaining geometry family against available transcript/XML evidence.
6. Decide fixture and selector-map ownership before coding.
7. Classify all working-tree entries.
8. Keep root-level prompt files and root `tester.xml` excluded.
9. Stop if unknown modifications exist.
10. Do not modify source before writing the required coverage, selector-map, and semantic-mapping note.

Record entry-gate evidence in the final response.

## 3. Existing Foundations That Must Be Preserved

### PR 6A owns

```text
opt-in `--render`
static verify short-circuit
safe viewport bounds
isolated temporary Angular mount
phase-aware failure boundary
active network isolation
runtime-fail propagation
browser/workspace cleanup
development-only package contract
screenshot lifecycle
target-project isolation
```

### PR 6B owns

```text
transcript/XML expected-value oracle
centralized tolerance policy
explicit unique/missing/ambiguous mapping states
bounded candidate summaries
hidden-element filtering
nested-duplicate refinement
required control-height contract
zero-required-check guard
root padding
control height
line height
divider thickness
text color, size, and weight
optional button-frame and table-frame warnings
```

PR 6C must extend coverage without weakening or redesigning these contracts.

## 4. Explicit Scope

PR 6C may add or modify, subject to ownership audit:

```text
src/framework/angular/render-geometry.mjs
small geometry or selector-map helpers under src/framework/angular/ or src/lib/
src/framework/angular/render-verify.mjs only for bounded integration
test/render-geometry.test.mjs
test/render-verify.test.mjs
synthetic fixtures under test/fixtures/render-geometry/
selector-map fixture metadata that contains locators only
skill/SKILL.md
active owning documentation
```

Avoid new CLI options unless a geometry state cannot be represented safely through existing fixture/config ownership. Prefer no CLI changes.

## 5. Explicitly Out of Scope

Do not implement:

- AI vision scoring;
- blocking screenshot pixel comparison;
- OCR;
- visual auto-correction;
- multi-browser matrix;
- broad responsive breakpoint matrix;
- arbitrary production application crawling;
- full CSS cascade debugger;
- full accessibility audit;
- parser rewrite;
- resolver, referee, snapshot, or static-verify redesign;
- public packaging of the development-only render fixture;
- network/package-contract redesign;
- new heavy dependencies;
- repository-wide scans;
- unrelated refactoring;
- `FIX-001` privacy remediation for the pre-existing fixture;
- commit or push before independent verification.

## 6. Privacy and Fixture Ownership

Root `tester.xml` remains local-only and excluded because it contains private data.

Required rules:

```text
root tester.xml is never imported by tests
root tester.xml is never staged
private values are never copied into fixtures, logs, reports, or prompts
all committed fixtures use generic synthetic data
```

PR 6C must extend the existing official synthetic fixture rather than using the private root file.

If the private file contains useful structure, manually recreate only the minimum generic structure required, without copying literal personal values.

Run a privacy scan over every changed fixture and report. Keep `FIX-001` separate.

## 7. Required Pre-Implementation Decision Note

Before coding, write a concise implementation note containing:

```text
checkpoint and baseline
remaining geometry-family matrix
design fact locator for each family
semantic fact-to-box classification
selector-map ownership and shape
DOM locator strategy
required/optional state
blocking/warning/skip state
tolerance family
fixture variants
files to change
tests
```

Do not start implementation before this note is complete.

## 8. Coverage Completion Matrix

Audit these families:

```text
structural/flex gaps
label-to-control gap
button-group gap
icon-to-text gap
toolbar gap
header-to-content spacing
table header row height
table header cell padding
table header typography
table body-row height
table body-cell padding
table body typography
checkbox/action column alignment
table footer height
table footer padding/gap
footer information-text alignment
pagination control height
pagination item size
pagination item gap
pagination relative position
pagination alignment
section and toolbar relative alignment
required-element containment
overflow-x
overflow-y
text clipping
valid truncation
expected table scroll
border widths
border styles
border colors
per-corner radius
font-family evidence
font fallback
heading typography
label typography
body typography
helper typography
table typography
button typography
status typography
```

For every family record:

```text
evidence available yes/no
evidence source and locator
mapping possible yes/no
selector-map required yes/no
measurement semantics
required or optional
blocking/warning/skip
tolerance
test fixture
implementation status
```

No family may disappear silently from the final report.

## 9. Design Oracle Contract

Expected geometry and style values must come only from:

```text
raw XML/FIGML literal facts
transcript literal facts
transcript structural relationships
```

Never use as expected values:

```text
resolved.json
spec.md
agent-context.md
sample/showcase defaults
old generated output
screenshot intuition
selector-map metadata
```

The selector map identifies the rendered element only. It must never carry expected dimensions, spacing, alignment, or semantic answers.

## 10. Selector-Map Contract

PR 6C may introduce locator-only metadata for synthetic fixtures where transcript facts cannot uniquely identify rendered DOM elements.

Conceptual shape:

```json
{
  "version": 1,
  "mappings": [
    {
      "designNodeId": "table-header-row",
      "renderLocator": {
        "strategy": "css",
        "selector": "[data-sliceui-fixture='table-header']"
      }
    }
  ]
}
```

Rules:

1. Selector maps contain locators only.
2. Expected values remain in transcript/XML.
3. Selector maps are fixture-scoped, not repository/project-scoped truth.
4. No selectors are injected permanently into production components.
5. Temporary fixture markers are allowed only in isolated synthetic fixture output.
6. Missing selector target is non-green for required facts.
7. Multiple selector matches are ambiguous and non-green for required facts.
8. Selector maps are versioned and validated.
9. Unsafe selectors or path-like values are rejected.
10. Selector maps must not bypass the PR 6B ambiguity contract.

## 11. Selector-Map Validation

Validate:

```text
schema version
unique design-node mapping
non-empty selector
bounded selector length
no script or executable content
no expected-value fields
no absolute private paths
no duplicate required mappings
```

Reject selector maps containing fields such as:

```text
expectedHeight
expectedGap
expectedAlignment
expectedColor
expectedRadius
```

Expected facts must be read independently from transcript/XML.

## 12. Semantic Fact-to-Box Mapping

For every check classify the expected fact as one of:

```text
literal border box
literal content box
literal visual bounds
container frame
structural sibling distance
computed gap
edge alignment
center alignment
containment relation
expected scroll container
text line box
typography style
```

Do not compare canvas position to component-internal geometry.

Do not compare fluid dimensions as fixed values without explicit evidence.

If semantic equivalence cannot be justified, mark unsupported or optional. Do not guess.

## 13. DOM Measurement Collection

Extend the existing single bounded browser-evaluate collection pass.

Collect only mapped evidence-backed elements and facts:

```text
bounding rect
client/scroll dimensions
computed display/visibility/opacity
computed overflow-x/overflow-y
padding
margin where relationship checks require it
gap/row-gap/column-gap
border widths/styles/colors
per-corner radii
font family/size/weight/line-height/letter-spacing
text wrapping geometry
parent/child relationship
viewport intersection
```

Avoid one browser round trip per property.

Do not dump full DOM or complete computed-style maps.

## 14. Required and Optional Semantics

Classify every fact:

```text
required literal fact
required structural relationship
optional visual fact
unsupported fact
ambiguous mapping
```

Aggregation remains:

```text
required mismatch → visual-fail
required missing/ambiguous/unsupported → non-green or unverifiable
optional mismatch → warning
optional missing/ambiguous → skip or warning
zero executed required checks → unverifiable
runtime/setup error → outranks geometry
```

Do not weaken AGG-001.

## 15. Centralized Tolerance Policy

Extend centralized tolerances by family:

```text
box dimensions
spacing/gap
line height
table row/header/footer dimensions
cell padding
pagination item geometry
edge/center alignment
border width
border radius
font size
letter spacing
overflow allowance
```

Requirements:

- derive tolerances from three-run variance plus bounded browser-subpixel allowance;
- use `abs(delta) <= tolerance` or documented equivalent;
- report tolerance in diagnostics;
- no scattered magic numbers;
- do not use tolerance to hide material mismatch;
- exact structural order/containment checks should not use arbitrary pixel tolerance;
- color/style values use normalized exact comparison where deterministic.

## 16. Structural and Flex Gap Coverage

Implement evidence-backed checks for:

```text
vertical section gap
horizontal toolbar gap
label-to-control gap
button-group gap
icon-to-text gap
header-to-content spacing
footer internal gap
```

Preferred comparison:

```text
computed gap/row-gap/column-gap
```

Fallback when gap is not the layout contract:

```text
relative bounding-box distance between uniquely mapped siblings
```

Rules:

- use the correct axis;
- do not double-count gap and margins;
- hidden siblings do not contribute;
- preserve sibling order;
- required ambiguous mapping is non-green;
- report element locators, expected distance, actual distance, delta, and tolerance.

## 17. Table Fixture Requirements

Extend the synthetic official fixture with deterministic table structure:

```text
toolbar with search and optional limit control
table header
at least three body rows
short and representative medium text
checkbox column when design fact exists
action column when design fact exists
footer information
pagination controls
fixed generic mock data
```

Do not use network requests, time, random data, or private information.

Known-good and defect variants must differ only in intended defects.

## 18. Table Header Density

Measure:

```text
header row height
header cell top/bottom padding
header font size
header font weight
header line height
header text alignment
```

Sampling:

- use mapped representative cells;
- record sample count;
- report min/max/median when multiple cells are measured;
- avoid one duplicate diagnostic per identical cell;
- a required outlier must not be hidden by median-only reporting.

## 19. Table Body-Row Density

Measure:

```text
body-row height
body-cell top/bottom padding
body font size and line height
checkbox/action vertical alignment
```

Rules:

- use deterministic rows;
- distinguish normal single-line rows from explicitly wrapped rows;
- do not treat a deliberate wrapped row as the universal expected height;
- report sample count and range;
- required repeated-row evidence must originate from transcript/XML.

## 20. Table Cell Padding

Compare cell padding only when directly evidenced or semantically derivable without ambiguity.

Distinguish:

```text
row height
cell padding
line height
border contribution
```

Do not infer padding solely from row height when multiple box-model combinations could explain it.

If direct padding evidence is absent, mark unsupported rather than inventing a value.

## 21. Table Footer Density

Measure:

```text
footer height
footer top/bottom padding
internal gap
information-text line height
vertical alignment
pagination container height
```

Only require elements shown by design.

## 22. Pagination Geometry

Measure evidence-backed:

```text
container bounding box
pagination control height
item width/height
item gap
relative position within footer
horizontal alignment
vertical alignment with information text
edge alignment with footer content
```

Do not use PR 4 behavior bindings as the expected geometry oracle.

Use selector maps only to locate pagination DOM nodes.

## 23. Relative Alignment

Implement structural relationship checks, such as:

```text
pagination right edge aligns with footer content edge
search and limit controls share a row
button group aligns to container end
labels align with controls
checkbox/action content centers within columns
footer information and pagination share vertical center
```

Comparison types:

```text
edge delta
center delta
baseline approximation
ordering
containment
```

Document the relation and tolerance. Do not copy absolute canvas coordinates.

## 24. Overflow and Clipping

Implement checks for:

```text
scrollWidth > clientWidth
scrollHeight > clientHeight
required text clipping
required control outside container or viewport
unexpected hidden overflow
container expansion caused by fixed dimensions
off-screen required element
```

Policy:

1. Expected scroll containers are allowed when design/project evidence supports scrolling.
2. Horizontal table scrolling may be valid.
3. `overflow: hidden` is not automatically an error.
4. Unsupported clipping of required content is blocking.
5. Valid ellipsis/truncation requires evidence.
6. Report client, scroll, and bounding dimensions.
7. Distinguish overflow defects from intentionally scrollable regions.

## 25. Text Wrapping and Truncation

Where evidence exists, measure:

```text
line count approximation
scroll/client width
white-space
overflow
text-overflow
required visible text
```

Do not use OCR.

If design explicitly shows truncation, validate the truncation contract. Otherwise clipping required text is non-green.

## 26. Border Coverage

Implement:

```text
side-specific border width
border style
normalized border color
divider orientation
```

Use the correct rendered layer.

Do not compare a nested library border to a parent design border accidentally.

Normalize RGB/RGBA/hex consistently.

## 27. Radius Coverage

Measure:

```text
top-left radius
top-right radius
bottom-right radius
bottom-left radius
```

Normalize CSS shorthand and elliptical values where supported.

Map the correct visible container/control layer.

If the design only provides a uniform radius, compare all required corners.

## 28. Font-Family and Fallback Detection

Resolve FNT-001 only when reliable expected-font evidence exists.

Required approach:

```text
expected font family from literal design/project fact
actual computed font-family stack
font readiness via document.fonts.ready
optional document.fonts.check when applicable
```

Rules:

- do not download fonts;
- do not infer expected font from sample code;
- if expected font is required but unavailable/fallback is used, typography evidence cannot cleanly pass;
- classify as degraded or unverifiable according to existing state model;
- diagnostics show expected and computed family names only, not file paths;
- generic fallback families alone do not prove the expected font loaded.

If no reliable evidence exists for a fixture role, mark the font-family check unsupported and document it.

## 29. Complete Typography Roles

Add evidence-backed checks for:

```text
heading
label
body text
helper text
table header
table body
button text
status text
footer information
pagination text
```

For each role compare only supported facts:

```text
font family
font size
font weight
line height
letter spacing
color
wrapping/truncation relationship
```

Do not infer role solely from HTML tag name. Use design node classification plus locator map.

## 30. Mapping and Ambiguity Safety

All new selector-map and semantic mappings must preserve PR 6B rules:

```text
0 required candidates → non-green
1 candidate → measure
>1 required candidates → ambiguous, non-green
>1 optional candidates → warning/skip
hidden duplicate → excluded only if truly non-rendered
nested duplicate → semantic refinement or ambiguity
```

No raw first-pick is allowed.

Candidate summaries remain bounded and privacy-safe.

## 31. Diagnostic Contract

Each new check must include:

```text
stable diagnostic ID
bounded category
required/optional marker
design fact locator
DOM locator or mapping strategy
semantic measurement type
expected
actual
delta
tolerance
unit
sample count/range where aggregated
trust source
remediation
```

Do not emit full HTML, complete style objects, private values, or absolute private paths.

## 32. Diagnostic Categories

Use bounded categories:

```text
spacing
table-density
pagination
alignment
overflow
border
radius
typography
font
mapping
```

Do not create categories per element or row.

Keep existing IDs stable. Add new IDs deterministically and document them.

## 33. Sampling and Aggregation

For repeated structures, define bounded sampling:

```text
maximum representative rows/cells
selection rule
min/max/median
outlier policy
required mismatch policy
```

Do not scan arbitrary numbers of rows.

An outlier that violates a required fact must not be hidden by a passing median.

## 34. No-False-Green Rules

Rendered verification cannot pass when:

```text
zero required facts execute
required selector-map target is missing
required selector-map target is ambiguous
required table structure is absent
required overflow state cannot be determined
font evidence is required but unavailable
all new families skip due to unsupported mapping while claimed as covered
```

Do not count optional warnings or skipped checks as required evidence.

## 35. Real-Browser Determinism

Run known-good and defect scenarios at least three times through the production browser path.

Assert stable:

```text
primary state
check IDs
mapping results
sample counts
expected values
actual values within observed variance
diagnostic ordering
tolerance decisions
screenshot dimensions
```

If asynchronous table layout varies, fix readiness before making checks blocking.

## 36. Dynamic Readiness

Before measuring:

```text
Angular mount completed
mock rows rendered
fonts ready
animations/transitions disabled
scroll reset
expanded/open state selected if required
layout settled through bounded readiness condition
```

Timeout is non-green. Never measure an incomplete state as valid.

## 37. Synthetic Fixture Variants

Maintain minimal variants for:

```text
known-good complete geometry
spacing defect
table-header density defect
table-row density defect
cell-padding defect
footer defect
pagination alignment defect
overflow defect
border defect
radius defect
font/typography defect
ambiguous selector-map target
missing selector-map target
```

Prefer programmatic variants or small overrides over duplicated fixture trees.

No fixture may contain private data.

## 38. Tests: Selector Map

Required tests:

- [ ] Valid map resolves unique target.
- [ ] Missing target is non-green when required.
- [ ] Multiple matches are ambiguous.
- [ ] Optional ambiguity warns/skips.
- [ ] Duplicate design-node mapping rejected.
- [ ] Unsupported schema version rejected.
- [ ] Expected-value fields rejected.
- [ ] Unsafe/executable selector content rejected.
- [ ] Selector length bounded.
- [ ] Locator map never supplies expected geometry.

## 39. Tests: Gaps

- [ ] Correct flex gap passes.
- [ ] Gap inside tolerance passes.
- [ ] Gap at tolerance passes.
- [ ] Gap just outside tolerance fails.
- [ ] Bounding-box sibling spacing works when no CSS gap exists.
- [ ] Hidden sibling excluded.
- [ ] Margin and gap not double-counted.
- [ ] Horizontal and vertical axes correct.
- [ ] Ambiguous sibling mapping non-green.

## 40. Tests: Table Density

- [ ] Header height pass/fail.
- [ ] Header cell padding pass/fail.
- [ ] Header typography pass/fail.
- [ ] Body-row height pass/fail.
- [ ] Body-cell padding pass/fail when evidenced.
- [ ] Body line-height pass/fail.
- [ ] Footer height pass/fail.
- [ ] Footer gap/padding pass/fail.
- [ ] Sample counts deterministic.
- [ ] Outlier is not hidden by median.
- [ ] Wrapped row handled according to evidence.
- [ ] Missing required table structure non-green.

## 41. Tests: Pagination and Alignment

- [ ] Pagination height pass/fail.
- [ ] Item size pass/fail.
- [ ] Item gap pass/fail.
- [ ] Right/left/center alignment relation.
- [ ] Footer information vertical-center relation.
- [ ] Toolbar shared-row relation.
- [ ] Edge delta diagnostic correct.
- [ ] Canvas coordinates not reused internally.

## 42. Tests: Overflow and Clipping

- [ ] Horizontal unintended overflow fails.
- [ ] Vertical unintended overflow fails.
- [ ] Expected table scroll passes.
- [ ] Required clipped text fails without truncation evidence.
- [ ] Valid ellipsis passes or warns per policy.
- [ ] Off-viewport required control fails.
- [ ] Client/scroll dimensions reported.
- [ ] `overflow:hidden` alone does not fail.

## 43. Tests: Border and Radius

- [ ] Border width pass/fail.
- [ ] Border style pass/fail.
- [ ] Border color normalization.
- [ ] Side-specific border mapping.
- [ ] Uniform radius pass/fail.
- [ ] Per-corner radius mismatch.
- [ ] Correct DOM layer selected.

## 44. Tests: Font and Typography

- [ ] Expected font loaded passes.
- [ ] Required font fallback is non-green/degraded.
- [ ] No expected-font evidence skips honestly.
- [ ] Heading role maps correctly.
- [ ] Label/body/helper roles map correctly.
- [ ] Table/button/status/footer/pagination roles map correctly.
- [ ] Size/weight/line-height/letter-spacing boundaries.
- [ ] Wrapping/truncation relation.
- [ ] Repeated typography target ambiguity-safe.

## 45. Tests: Aggregation

- [ ] All required families pass → pass.
- [ ] Any required mismatch → visual-fail.
- [ ] Required family unmapped → non-green.
- [ ] Optional warnings do not block.
- [ ] Zero required executed → unverifiable.
- [ ] Runtime/setup failure outranks geometry.
- [ ] Unsupported family is visible, not silently counted as pass.

## 46. PR 6A and PR 6B Non-Regression

Re-test:

```text
static verify no browser
static short-circuit
viewport bounds
network isolation
runtime-fail
cleanup
target writes zero
development-only package contract
root padding
control height
line height
divider
text style
ambiguity-safe mapping
zero-required guard
optional warnings
```

## 47. PR 1-5 Non-Regression

Confirm:

```text
PR 1 compact context
PR 2 snapshot and ground-truth safety
PR 3 hot referee zero project reads
PR 4 resolve provenance and ambiguity safety
PR 5 target normalization, exact API, lexical syntax, exit semantics
```

## 48. E2E Scenario Matrix

Use:

```bash
TMP_ROOT="/tmp/sliceui-pr6c-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Use repository CLI explicitly:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs verify <dir> [name] --render
```

Run:

```text
complete known-good fixture
spacing defect
table header defect
table row defect
cell-padding defect
footer/pagination defect
relative-alignment defect
horizontal overflow
vertical overflow
valid expected scroll
border/radius defect
font fallback
typography-role defect
selector-map missing
selector-map ambiguous
zero required evidence
network attempt
runtime failure
invalid viewport
```

Capture:

```text
state
exit code
checks executed
mapping status
sample counts
expected/actual/delta/tolerance
warnings/skips
screenshot dimensions
process cleanup
target mutation
```

## 49. Performance and Boundedness

Measure before/after:

```text
total render median
browser evaluations
mapped element count
sampled row/cell count
geometry collection time
comparison time
screenshot time
```

Requirements:

- one bounded collection pass where practical;
- selector-map mappings bounded;
- repeated table sampling bounded;
- diagnostics bounded;
- no repository scan;
- no unbounded wait.

## 50. Read/Write/Network/Process Trace

Dynamically prove:

```text
target writes = 0
repository scans = 0
network escapes = 0
temporary writes contained
no npm install
browser and processes cleaned
static path unchanged
```

## 51. Documentation and Skill

Update active owning docs only.

Document:

```text
completed PR 6C families
selector-map locator-only contract
semantic fact-to-box policy
central tolerances
table sampling policy
alignment policy
overflow/truncation policy
border/radius policy
font fallback policy
typography role mapping
required/optional aggregation
remaining unsupported facts, if any
full PR 6 status
```

Likely owners:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
docs/project-docs/foundation/status.md
skill/SKILL.md
```

Do not call full PR 6 complete until all acceptance criteria pass and independent verification authorizes closure.

## 52. Validation Commands

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
node --test test/render-geometry.test.mjs
node --test test/render-verify.test.mjs
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
```

Run existing render mount/probe tests by actual filenames.

After implementation, run `node --check` on all changed/new source and test files.

Focused tests must include real-browser PR 6C scenarios.

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

## 53. Independent Self-Review

Before final response verify:

- [ ] Every remaining family has an explicit disposition.
- [ ] No selector map stores expected values.
- [ ] No fake oracle was introduced.
- [ ] No raw first-pick exists.
- [ ] Required missing/ambiguous remains non-green.
- [ ] Zero required remains unverifiable.
- [ ] Tolerances centralized and boundary-tested.
- [ ] Table sampling deterministic and bounded.
- [ ] Overflow distinguishes expected scrolling.
- [ ] Font checks use reliable evidence only.
- [ ] PR 6A and PR 6B safeguards remain intact.
- [ ] Target project unchanged.
- [ ] Root `tester.xml` untouched and untracked.
- [ ] No private data in fixtures/reports.
- [ ] No screenshot or `.sliceui` artifact in repository.

## 54. Acceptance Criteria

PR 6C implementation is complete only if:

- [ ] Entry gate authorizes PR 6C.
- [ ] Fixture privacy preserved.
- [ ] Selector-map contract implemented and validated.
- [ ] Selector maps contain locators only.
- [ ] Structural/flex gap coverage implemented where evidenced.
- [ ] Table header density implemented.
- [ ] Table row density implemented.
- [ ] Table cell padding implemented where evidenced.
- [ ] Table footer density implemented.
- [ ] Pagination geometry implemented.
- [ ] Relative alignment implemented.
- [ ] Overflow/clipping implemented.
- [ ] Expected scroll distinguished from defects.
- [ ] Border width/style/color coverage implemented.
- [ ] Radius coverage implemented.
- [ ] Font fallback implemented where reliable evidence exists.
- [ ] Typography roles implemented where evidenced.
- [ ] Required/optional semantics explicit.
- [ ] Mapping ambiguity safe.
- [ ] Zero-required guard preserved.
- [ ] Central tolerance boundaries tested.
- [ ] Three-run browser determinism proven.
- [ ] Diagnostics stable and measurable.
- [ ] Sampling bounded and deterministic.
- [ ] PR 6A and PR 6B safety preserved.
- [ ] Static verify unchanged.
- [ ] Target writes zero.
- [ ] Network escapes zero.
- [ ] Focused tests pass.
- [ ] Relevant suite passes.
- [ ] Full suite passes except pre-existing skips.
- [ ] PR 1-6B non-regression confirmed.
- [ ] Documentation synchronized.
- [ ] Ready for independent full PR 6 verification.

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

Do not stage or import root `tester.xml`.

Do not modify pre-existing private fixtures in this task.

Do not modify the real target project.

Do not commit or push. PR 6C requires independent verification first.

Record initial/final status and source hashes.

## 56. Work Sequence

### Phase 1: Gate, privacy, and coverage audit

- confirm checkpoint `60a0835`;
- classify working tree;
- confirm root private file exclusion;
- reconstruct remaining coverage matrix;
- run baseline tests.

### Phase 2: Selector-map and semantic note

Before coding, state:

```text
selector-map schema and ownership
fact-to-box semantics
required/optional decisions
tolerances
sampling policy
fixture variants
files to change
tests
```

### Phase 3: Locator-only selector maps

- schema validation;
- no expected values;
- ambiguity safety;
- fixture integration.

### Phase 4: Gaps and table density

- spacing;
- header/body/cell/footer;
- bounded sampling;
- diagnostics.

### Phase 5: Pagination and alignment

- items/container;
- edge/center relationships;
- footer/toolbar structure.

### Phase 6: Overflow, border, and radius

- expected scroll;
- clipping;
- side-specific borders;
- corner radii.

### Phase 7: Font and typography roles

- reliable font evidence;
- fallback state;
- role-based typography and wrapping.

### Phase 8: Tests and deterministic E2E

- helper boundaries;
- real-browser known-good and defects;
- three-run stability;
- PR 6A/6B regressions;
- full suite.

### Phase 9: Documentation and final scope review

- owning docs;
- explicit unsupported facts;
- readiness for independent full PR 6 verification.

## 57. Required Final Response

### Entry Gate

```text
Checkpoint baseline:
PR 6A status:
PR 6B status:
PR 6C authorized:
Full PR 6 initial status:
```

### Privacy and Fixture Decision

```text
root tester.xml status:
synthetic fixture paths:
privacy scan:
fixture additions:
```

### Coverage Summary

List every family as:

```text
implemented / unsupported-no-evidence / explicitly out-of-scope
required / optional
blocking / warning / skip
```

### Selector-Map Contract

```text
schema:
locator-only enforcement:
validation:
missing target:
ambiguous target:
privacy safeguards:
```

### Semantic Mapping

Explain fact-to-box mapping and structural relationships.

### Tolerance and Sampling Policy

List centralized tolerances, observed variance, sample limits, and outlier behavior.

### Geometry Coverage

Report:

```text
gaps
table header/body/cell/footer
pagination
alignment
overflow/clipping
border/radius
font fallback
typography roles
```

### Diagnostics

Provide representative expected/actual/delta/tolerance and mapping diagnostics using synthetic values only.

### Validation

List commands and exact outcomes.

### Determinism and Performance

```text
known-good runs:
defect runs:
variance:
browser evaluations:
sample counts:
render median before/after:
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

### Known Limitations

Only factual remaining limitations. Do not invent a PR 6D merely to avoid completing evidence-backed scope.

### Documentation Sync

Use `Documentation sync: clear.` or list stale docs.

### Git Status

Include exact `git status --short`. Do not commit.

## 58. Focused Implementation Decision

End with:

```text
PR 6C implementation: PASS / FAIL
Remaining evidence-backed geometry complete: YES / NO
Selector maps locator-only: YES / NO
Geometry diagnostics deterministic: YES / NO
PR 6A and PR 6B safety preserved: YES / NO
Full PR 6 ready for independent closure verification: YES / NO
```

Do not claim full PR 6 officially complete until independent verification passes.

## 59. Definition of Done

The task is complete only when every remaining evidence-backed rendered geometry family has an explicit, honest disposition; locator-only selector maps safely bridge design nodes to rendered elements without becoming an expected-value oracle; structural gaps, table density, pagination, alignment, overflow, borders, radii, font fallback, and typography roles are measured wherever defensible; required and optional semantics, ambiguity safety, zero-required protection, centralized tolerances, bounded sampling, privacy, isolation, network safety, and PR 6A/6B invariants remain intact; browser results are deterministic; all tests pass; documentation is synchronized; and full PR 6 is ready for independent closure verification.

Begin by confirming checkpoint `60a0835`, auditing fixture privacy and every remaining geometry family, and writing the selector-map/semantic-mapping decision note. Do not modify source before those steps are complete.
