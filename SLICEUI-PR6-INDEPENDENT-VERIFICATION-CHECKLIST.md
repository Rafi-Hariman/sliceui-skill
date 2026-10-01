# SliceUI PR 6 Independent Verification Checklist

Repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Real target project, read-only reference only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Official baseline checkpoint:

```text
2617638 feat(sliceui): strengthen verify reliability and syntax safety
```

Required documents:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
docs/SLICEUI-PR4-VERIFICATION-REPORT.md
docs/SLICEUI-PR5-VERIFICATION-REPORT.md
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
SLICEUI-PR6-RENDERED-VISUAL-FIDELITY-IMPLEMENTATION-PROMPT.md
```

If a file is located elsewhere, find it by exact filename. Do not modify implementation prompts or previous verification reports.

## 1. Verification Objective

Independently verify the PR 6 Rendered Visual Fidelity implementation and decide whether:

```text
PR 6 can close completely,
PR 6 requires a corrective patch,
or the implementation should be reclassified as PR 6A Render Foundation.
```

The verification must prove or disprove:

1. Render verification is explicit and opt-in.
2. Default static verification never starts a browser.
3. Static failure short-circuits rendered verification.
4. Every render setup/build/mount/runtime failure is non-green.
5. Target project isolation is real, not only claimed.
6. Browser rendering is deterministic enough for blocking geometry checks.
7. Expected values come from transcript/raw design facts.
8. Resolver, spec, and agent context are not visual oracles.
9. DOM-to-design mapping never silently selects the first ambiguous element.
10. Geometry diagnostics contain measurable expected/actual/delta/tolerance evidence.
11. Screenshots are supporting evidence rather than the only oracle.
12. Network access is actively blocked and reported.
13. Temporary and preserved artifacts follow the documented lifecycle.
14. The package-distribution contract is honest and usable.
15. Required geometry families are implemented or explicitly identified as an incomplete PR 6 scope.
16. Static verification and PR 1 through PR 5 remain healthy.

This task is read-only for implementation source.

## 2. Safety and Allowed Output

Only create this repository file:

```text
docs/SLICEUI-PR6-VERIFICATION-REPORT.md
```

Store all fixtures, copied projects, screenshots, traces, browser profiles, package installations, and generated render artifacts under:

```text
/tmp/sliceui-pr6-verification-<timestamp>/
```

Do not:

- modify source, tests, fixtures, skill, or active documentation;
- fix findings;
- commit or push;
- run writer commands against the real target project;
- install or update dependencies in the repository or real target project;
- use a global/on-PATH SliceUI binary;
- start PR 7 or another implementation phase;
- accept a PASS based only on existing tests;
- weaken the original PR 6 Definition of Done.

## 3. Mandatory Decision Outputs

The final report must answer:

```text
PR 6 decision: PASS / CONDITIONAL PASS / FAIL / RECLASSIFY AS PR 6A
PR 6 may close: YES / NO
A follow-up geometry patch is required: YES / NO
Next phase may start: YES / NO
```

Core guarantees:

```text
Render is opt-in:
Static verify launches no browser:
Static failure short-circuits render:
Render failure can never green:
Geometry checks deterministic:
Design facts are the oracle:
DOM mapping is ambiguity-safe:
External network is blocked:
Target project writes are zero:
Temporary artifacts are cleaned:
Preserve mode works:
Package-distribution contract is accurate:
Required geometry coverage is complete:
Static verify non-regression:
PR 1-5 non-regression:
```

## 4. Implementation Claims to Reproduce

PR 6 reports:

```text
CLI:
  sliceui verify <dir> [name]
  sliceui verify <dir> [name] --render
  --viewport WxH
  --preserve-render-artifacts

Browser:
  Playwright 1.63
  headless Chromium
  default viewport 1440x900

Mount:
  isolated /tmp Angular 13 workspace
  Dart Sass + esbuild + platformBrowserDynamic

Current measurements:
  root internal padding
  divider thickness
  text color
  text size
  text weight

Current full suite:
  462 pass
  3 pre-existing skips
  0 fail
```

Reported limitations:

```text
- table density is not measured
- input/select/button control height is not measured
- overflow geometry is not measured
- button/control frame width and height are not compared
- render mode requires dev-only Angular mount dependencies
- stripped/npm installation returns fixture-unavailable
- cross-file project SCSS token imports are unsupported
```

Do not accept any claim without reproduction.

## 5. Baseline and Integrity Checklist

- [ ] Run `git status --short`.
- [ ] Run `git rev-parse HEAD`.
- [ ] Run `git log -1 --oneline`.
- [ ] Confirm checkpoint `2617638` exists in history.
- [ ] Record Node and npm versions.
- [ ] Classify all working-tree entries as PR 6, known prompts, or unknown.
- [ ] Stop if unknown modifications exist.
- [ ] Record real target `git status --short`.
- [ ] Hash all PR 6 source/test/docs/skill files before verification.
- [ ] Confirm no stray `.sliceui` exists in the SliceUI repository.

Suggested initial hash set:

```bash
shasum -a 256 \
  src/framework/angular/render-verify.mjs \
  src/commands/verify.mjs \
  src/cli.mjs \
  test/render-verify.test.mjs \
  skill/SKILL.md \
  docs/project-docs/development/api-contract.md \
  docs/project-docs/technical-guidelines/verify-gate-trust.md
```

Add every actual changed PR 6 file.

## 6. Capability and Dependency Audit

- [ ] Inspect `package.json` and lockfile.
- [ ] Confirm Playwright is already present and no PR 6 dependency was added.
- [ ] Confirm Chromium/headless shell availability.
- [ ] Inspect existing `render-probe.mjs`, `render-mount.mjs`, and `pilar-mount.mjs` ownership.
- [ ] Confirm PR 6 reuses existing browser/mount tooling where claimed.
- [ ] Confirm static verify does not import Playwright eagerly.
- [ ] Confirm static CLI startup succeeds if browser binaries are unavailable.
- [ ] Identify whether Angular fixture dependencies are dev-only.
- [ ] Determine whether render verification is intended as public package functionality or development-only functionality.
- [ ] Compare that intent to CLI help, skill, and documentation.

Search:

```bash
rg -n "playwright|chromium|render-verify|render-mount|render-probe|pilar-mount|--render|--viewport|preserve-render" \
  package.json package-lock.json src test scripts skill docs README.md
```

## 7. Static Architecture Review

Audit at minimum:

```text
src/framework/angular/render-verify.mjs
src/commands/verify.mjs
src/framework/angular/verify.mjs
src/cli.mjs
existing render-mount/render-probe helpers
test/render-verify.test.mjs
```

Build the actual call graph:

```text
CLI parse
→ static verify
→ static-state short-circuit decision
→ render dispatch
→ temporary mount creation
→ Sass/esbuild
→ browser launch
→ page mount
→ font/animation readiness
→ element mapping
→ measurement
→ diagnostics
→ screenshot
→ cleanup/preserve
→ final state and exit code
```

For every step record:

```text
input
output
failure state
timeout
filesystem reads
filesystem writes
child process or in-process tool
cleanup owner
```

## 8. Scope Coverage Inventory

Create a matrix for every original required check family:

```text
root internal padding
major vertical/horizontal gaps
input height
select height
button height
button proportions
font size
font weight
line height
section/header typography
table header height
table row height
table cell padding
table footer height
pagination geometry
relative alignment
visible clipping/overflow
major border/radius facts
```

For each mark:

```text
implemented
partially implemented
not implemented
required design facts available yes/no
blocking/warning/skip
source path/symbol
test coverage
```

This matrix is decisive. Do not call PR 6 complete if mandatory families remain unimplemented unless the work is explicitly reclassified as PR 6A.

## 9. CLI Opt-In Verification

### Default static verify

- [ ] Run static verify without `--render`.
- [ ] Instrument browser launch.
- [ ] Confirm browser launch count is zero.
- [ ] Confirm no render screenshot or temporary render workspace is created.
- [ ] Confirm static exit/output remains PR 5-compatible.

### Explicit render

- [ ] Run the same target with `--render`.
- [ ] Confirm static verification runs first.
- [ ] Confirm browser launches only after static gate permits it.
- [ ] Confirm rendered result is included in final state.

### Invalid viewport

Test:

```text
0x0
negative values
non-numeric
one dimension missing
extremely large dimensions
path-like text
```

- [ ] Invalid viewport exits 2.
- [ ] Browser launch count is zero.
- [ ] No artifact is written.
- [ ] Diagnostic is actionable.

## 10. Static-Failure Short-Circuit

Create a component with a known blocking static verify failure.

Run with `--render` and prove:

- [ ] Exit follows static failure.
- [ ] Render state is explicitly skipped due to static failure.
- [ ] Browser does not launch.
- [ ] Sass/esbuild does not run.
- [ ] No screenshot is produced.
- [ ] No render temporary workspace remains.
- [ ] Output does not imply rendered verification completed.

Use dynamic instrumentation, not only source inspection.

## 11. Render State and Exit Matrix

Reproduce each state with a controlled fixture:

```text
pass
visual-fail
build-fail
mount-fail
runtime-fail
unverifiable
fixture-unavailable
invalid-input
warning-only
```

For each record:

```text
primary state
process exit code
diagnostic ID
human headline
browser launched yes/no
screenshot expected/actual
temporary cleanup result
```

Required:

- [ ] `pass` exits 0.
- [ ] `visual-fail` exits non-zero.
- [ ] `build-fail` is distinct and non-green.
- [ ] `mount-fail` is distinct and non-green.
- [ ] `runtime-fail` is distinct and non-green.
- [ ] `unverifiable` exits 3 or documented non-green equivalent.
- [ ] `fixture-unavailable` exits 3 and is not called pass.
- [ ] `invalid-input` exits 2.
- [ ] Warnings-only exit 0 only when required render evidence is complete.

## 12. Browser-Unavailable Scenario

Simulate browser unavailable without modifying dependency installation.

Possible safe methods:

```text
invalid executable path
test injection/stub
isolated environment excluding browser binary
```

Verify:

- [ ] Non-green state.
- [ ] Distinct render-setup/browser diagnostic.
- [ ] No visual mismatch diagnostic.
- [ ] Actionable remediation.
- [ ] Cleanup succeeds.
- [ ] Target unchanged.

## 13. Build-Failure Scenario

Create a temporary component/SCSS variant that fails Sass or esbuild.

Verify:

- [ ] State is build-fail.
- [ ] Exit is non-zero.
- [ ] Diagnostic identifies build phase.
- [ ] Browser does not report a fake visual failure.
- [ ] Screenshot is not treated as valid evidence.
- [ ] Temporary mount cleanup follows policy.
- [ ] Target project remains unchanged.

## 14. Mount-Failure Scenario

Create a mount fixture that builds but never produces the required Angular host marker.

Verify:

- [ ] Bounded timeout is enforced.
- [ ] State is mount-fail.
- [ ] Diagnostic identifies mount timeout/missing host.
- [ ] Exit is non-zero.
- [ ] Browser closes.
- [ ] No false screenshot pass.

Do not wait the full timeout repeatedly if dependency injection or a shortened test timeout safely proves behavior.

## 15. Runtime-Failure Scenario

Create runtime exception after page load.

Verify:

- [ ] Uncaught page error is captured.
- [ ] State is runtime-fail.
- [ ] Exit is non-zero.
- [ ] Console evidence is bounded.
- [ ] No geometry result is trusted after invalid runtime state.
- [ ] Screenshot, if captured for debugging, is not considered proof of pass.

## 16. Font Availability and Readiness

Test:

```text
expected font available
expected font unavailable
font readiness timeout/failure if injectable
```

Verify:

- [ ] `document.fonts.ready` or equivalent is awaited.
- [ ] Actual computed font family is recorded.
- [ ] Missing required font cannot silently pass typography checks.
- [ ] Missing font produces degraded/unverifiable according to documented policy.
- [ ] No external font download occurs.
- [ ] Fallback font behavior is described honestly.

If implementation has no missing-font detection, record a material finding.

## 17. Animation and Dynamic-State Control

- [ ] Confirm animation and transition disabling is injected before measurement.
- [ ] Verify computed animation duration/transition duration are zero or disabled.
- [ ] Confirm scroll position reset.
- [ ] Confirm readiness wait is bounded.
- [ ] Confirm repeated geometry does not drift due to animation.
- [ ] Test one intentionally animated fixture if practical.

## 18. Network Blocking

A fixture with no requests is insufficient proof.

Create a temporary component that attempts:

```javascript
fetch("https://example.com/sliceui-test")
```

or another harmless external URL.

Instrument browser requests and prove:

- [ ] Request is intercepted before leaving the browser.
- [ ] No external response is received.
- [ ] Diagnostic records blocked external origin safely.
- [ ] Render becomes non-green or degraded according to policy.
- [ ] No credentials/headers are logged.
- [ ] Local/data/blob resources remain allowed as documented.

If no interception exists and the request would leave the environment, classify the offline-network claim as false and determine closure impact.

## 19. Target Project Isolation

Before every real-target reference run:

```bash
git status --short
git diff --name-only
```

After run, compare:

```text
git status
file hashes
directory listing
.sliceui contents
package.json
lockfile
source files
```

Required:

- [ ] Target source writes = 0.
- [ ] Package/lock writes = 0.
- [ ] Target `.sliceui` writes = 0 unless command contract explicitly permits a bounded report and the test uses a copy.
- [ ] No route/module modifications.
- [ ] No npm install.
- [ ] No browser artifacts in target.

Use a temporary copy for any writer scenario.

## 20. Temporary Workspace Isolation

Trace all temporary writes.

Verify:

- [ ] Workspace root is under `/tmp`.
- [ ] Directory name is unique.
- [ ] Only expected bundle/mount files are written.
- [ ] No path escape through component name.
- [ ] Default success cleans workspace.
- [ ] Default failure follows documented cleanup policy.
- [ ] Preserve mode preserves only documented artifacts, not the entire node_modules/browser profile unless explicitly intended.
- [ ] Browser always closes in `finally`.

## 21. Preserve-Artifact Lifecycle

Run with `--preserve-render-artifacts`.

Verify:

- [ ] Artifact path matches documentation.
- [ ] Parent directory is created safely.
- [ ] Existing file behavior is deterministic.
- [ ] Screenshot is valid PNG.
- [ ] Dimensions match viewport or documented component clipping behavior.
- [ ] File size is bounded.
- [ ] No unexpected logs, bundles, or browser profile are preserved.
- [ ] Target source remains unchanged.

Run without preserve flag:

- [ ] Temporary screenshot is removed after successful use.
- [ ] No stale file remains.

## 22. Screenshot Failure Safety

Simulate screenshot failure where practical.

Verify:

- [ ] If screenshot is required evidence, state is non-green.
- [ ] If screenshot is supporting-only and geometry is valid, policy is explicit.
- [ ] Failure diagnostic is distinct.
- [ ] No pass is claimed contrary to documentation.
- [ ] Cleanup still occurs.

## 23. Screenshot Evidence Review

For generated screenshot:

- [ ] PNG header valid.
- [ ] Dimensions expected.
- [ ] Color mode reasonable.
- [ ] File size bounded.
- [ ] No sensitive real data.
- [ ] Deterministic mock data used.
- [ ] Screenshot path referenced correctly by diagnostics/output.
- [ ] Screenshot is not the sole source of blocking decisions.

## 24. Design Oracle Independence

Static audit:

```bash
rg -n "resolved\.json|spec\.md|agent-context|resolveTranscript|behaviorBindings" \
  src/framework/angular/render-verify.mjs src/commands/verify.mjs
```

Verify:

- [ ] Expected geometry comes from transcript/raw facts.
- [ ] No resolver hint is used as expected style.
- [ ] No spec recommendation is used as visual ground truth.
- [ ] Old generated output is not baseline truth.
- [ ] Screenshot from sample component is not baseline truth.

## 25. DOM-to-Design Mapping

Audit mapping strategy and test:

```text
unique text
repeated text
same role repeated
missing element
multiple matching elements
nested elements
hidden duplicate
```

Required:

- [ ] Unique mapping succeeds deterministically.
- [ ] Ambiguous mapping does not first-pick.
- [ ] Candidate count/evidence visible.
- [ ] Required mapping ambiguity produces unverifiable or non-green result.
- [ ] Optional mapping ambiguity skips honestly.
- [ ] Hidden duplicate is not mistaken for visible target.
- [ ] Production component source is not mutated to add test IDs.

## 26. Geometry Determinism

Run known-good render at least three times with identical environment.

Capture raw values:

```text
root padding
text font size
text weight
text color
divider thickness
bounding boxes
screenshot dimensions
```

Calculate:

```text
min
max
range
mean or median
```

Verify:

- [ ] Primary state stable.
- [ ] Diagnostic IDs stable.
- [ ] Element mapping stable.
- [ ] Geometry variance within tolerance.
- [ ] Tolerance rationale distinguishes observed variance from policy allowance.
- [ ] Screenshot dimensions stable.

If deterministic variance exceeds tolerance, blocking geometry is not ready.

## 27. Tolerance Validation

Reported tolerances:

```text
root padding: +/-2px
divider thickness: +/-1px
```

Test boundary values:

```text
within tolerance
exactly at tolerance
just outside tolerance
large mismatch
```

Verify:

- [ ] Boundary semantics documented (`<=` or `<`).
- [ ] Delta calculation correct.
- [ ] Units correct.
- [ ] Negative/decimal values handled.
- [ ] Expected/actual not reversed.
- [ ] Diagnostic shows tolerance.

## 28. Current Implemented Geometry Checks

### Root padding

- [ ] Known-good passes.
- [ ] Each side can fail independently.
- [ ] Canvas x/y is not treated as padding.
- [ ] Shorthand/computed padding normalized correctly.
- [ ] Diagnostic expected/actual/delta correct.

### Divider thickness

- [ ] Known-good passes.
- [ ] Too thin/too thick fails outside tolerance.
- [ ] Wrong style/color is handled according to implemented scope.

### Text color

- [ ] Normalized color comparison correct.
- [ ] RGB/RGBA/hex normalization correct.
- [ ] Alpha behavior documented.

### Text size

- [ ] Known-good passes.
- [ ] Mismatch is diagnosed measurably.
- [ ] Font fallback does not produce silent pass.

### Text weight

- [ ] Numeric and keyword weights normalized correctly.
- [ ] Browser-computed value comparison correct.

## 29. Required Scope Gap Assessment

The original PR 6 plan required more than the reported implementation.

Independently determine status for:

```text
input height
select height
button height
button proportions
major gaps
table header height
table row height
table cell vertical padding
table footer height
pagination geometry
relative alignment
visible clipping/overflow
major border radius
```

For every missing family:

1. Confirm whether design facts exist in current fixture/transcript.
2. Confirm whether implementation contains a check.
3. Confirm whether a test exists.
4. Classify omission:

```text
blocking scope gap
acceptable conditional limitation
no available design evidence
explicitly deferred follow-up
```

Decision rule:

- If design facts and a viable fixture exist but mandatory checks are absent, PR 6 cannot receive full PASS.
- If foundation is intentionally accepted separately, use `RECLASSIFY AS PR 6A` and require PR 6B Geometry Coverage.

## 30. Table Density Verification

If implementation claims no table-density support, verify the absence and impact.

Use or construct a temporary table-bearing fixture with design facts for:

```text
header height
row height
cell padding
footer height
pagination height
```

Determine whether current renderer can collect these facts even if comparator is absent.

Record:

```text
design evidence available yes/no
DOM mapping possible yes/no
measurement available yes/no
comparison implemented yes/no
```

Do not add the feature. Use evidence to judge scope completeness.

## 31. Control Height and Button Geometry

Use design facts for input/select/button if available.

Confirm:

```text
frame dimensions represent literal control geometry or only design container frame
```

Do not demand comparison when design frame is not semantically equivalent to CSS box. However, require a documented mapping policy.

Record whether current omission is deliberate and safe or an unimplemented required family.

## 32. Overflow and Clipping

Create a temporary overflow defect:

```text
long text
fixed width
hidden overflow
scrollWidth > clientWidth
```

Determine whether current implementation:

- measures overflow;
- reports it;
- ignores it.

If ignored, classify against original acceptance criteria.

## 33. Build and Style Pipeline Fidelity

Audit Sass and esbuild processing.

Verify:

- [ ] Real component SCSS is used.
- [ ] Component style encapsulation behavior resembles Angular runtime.
- [ ] Tool/library styles required by fixture are loaded.
- [ ] Missing cross-file `@use`/`@import` produces explicit build-fail/unverifiable, not altered CSS.
- [ ] No silent removal of unsupported imports.
- [ ] Source maps are not required for correctness unless documented.

## 34. Runtime and Console Policy

Create controlled:

```text
console.error only
console.warn only
uncaught exception
unhandled rejection
local resource failure
external resource request
```

Verify severity and state against policy.

Ensure logs are bounded and do not expose secrets.

## 35. Package Distribution Test

This is mandatory because the implementation reports a stripped-install limitation.

In a temporary directory:

```bash
npm pack
npm install <generated-tarball>
```

Do not modify the repository package installation.

Test from the installed package:

```text
static verify
CLI help
render verify
```

Record:

```text
package contents
presence of render-verify source
presence of mount fixture
presence of Playwright dependency/browser access
static behavior
render behavior
exit state
documentation/help wording
```

Decision:

- If render is public, stripped package must provide a usable path or clearly installable optional provision.
- If render is development-only, CLI/help/docs must say so and public package must not overpromise.
- `fixture-unavailable` may be acceptable only if the feature contract honestly defines it.

## 36. Static Verify Non-Regression

Compare baseline static verify before/after PR 6:

```text
browser launches
project files read
exit state
check count
human output
elapsed median
```

Required:

- [ ] Browser launch count remains zero.
- [ ] No render dependency loaded eagerly if avoidable.
- [ ] Read set unchanged.
- [ ] Exit semantics unchanged.
- [ ] Existing static diagnostics unchanged except documented additive help.
- [ ] Performance regression is negligible.

## 37. Test Quality Review

Audit `test/render-verify.test.mjs` and relevant existing mount tests.

Check coverage for:

```text
opt-in dispatch
browser launch absence on static
invalid viewport no-launch
static fail short-circuit
build/mount/runtime failures
browser unavailable
font unavailable
network blocking
artifact cleanup
artifact preservation
screenshot failure
DOM ambiguity
three-run determinism
tolerance boundaries
target isolation
package distribution
table/control/overflow scope
```

Flag tests that:

- test only pure helpers;
- do not launch a browser where the claim is browser behavior;
- use a fake screenshot without validating PNG;
- do not assert process exit code;
- never inspect target mutation;
- never test external requests;
- accept missing required geometry families silently.

## 38. Re-run Tests

Run actual relevant tests discovered from repository.

At minimum:

```bash
node --test test/render-verify.test.mjs
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
```

Also run existing actual render/mount/probe tests by their real filenames.

Run combined suite including:

```text
render verify
render mount/probe
static verify
snapshot
transcript
Pilar catalog/mount
referee
resolve
spec
agent context
```

Then run:

```bash
npm test
```

Run `node --check` on all changed/new source and test files.

Record exact pass/fail/skip and environment-dependent skips.

## 39. Performance and Timeout Verification

Measure at least three runs:

```text
total render time
browser startup
build/bundle
mount readiness
font readiness
measurement
screenshot
cleanup
```

Verify:

- [ ] No phase is unbounded.
- [ ] Mount timeout works.
- [ ] Timeout diagnostic identifies phase.
- [ ] Cleanup runs after timeout.
- [ ] Static verify remains fast.

## 40. Read, Write, Network, and Process Trace

Produce a consolidated trace:

```text
project files read
project files written
repository files written
/tmp files written
.sliceui artifacts written
network requests attempted/blocked
browser processes
other child processes
```

Required:

- [ ] Target writes = 0.
- [ ] No repository-wide traversal.
- [ ] No npm install during render.
- [ ] No external request escapes.
- [ ] Child-process lifecycle bounded.
- [ ] Temporary writes contained.

## 41. PR 1-5 Non-Regression

### PR 1

- [ ] Agent context remains compact.

### PR 2

- [ ] Snapshot dedup remains intact.
- [ ] Missing ground truth remains non-green.

### PR 3

- [ ] Hot referee remains zero project-source reads.

### PR 4

- [ ] Resolve provenance remains intact.
- [ ] Taxonomy ambiguity remains safe.

### PR 5

- [ ] Name normalization works.
- [ ] Exact API checks work.
- [ ] Comment/string lexical masking remains safe.
- [ ] Exit 0/1/2/3 semantics remain correct.
- [ ] Static read boundary remains bounded.

## 42. Documentation and Skill Review

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

Verify documentation accurately states:

- render is opt-in;
- static verify remains default;
- exact CLI syntax;
- current implemented measurement families;
- unimplemented table/control/overflow families are not claimed;
- result states and exits;
- render dependencies/provisioning;
- package-distribution limitation;
- offline/network policy;
- screenshot role;
- artifact retention;
- security/execution risk;
- target isolation;
- no visual auto-fix.

Report every contradiction. Do not edit docs.

## 43. Diff and Scope Audit

Review all PR 6 changes relative to `2617638`.

Classify every hunk:

```text
required render foundation
required geometry comparison
required tests
required docs/skill
unrelated
scope reduction
scope leakage
known prompts
tester.xml
```

Special attention:

- `tester.xml` is untracked and must remain excluded unless proven required product fixture.
- No binary screenshot should be staged.
- No dependency/lockfile should change unexpectedly.
- No target files should appear.

## 44. Decision Rules

### PASS

Only if:

- all render failure states are non-green;
- opt-in/static separation is proven;
- isolation/network/artifact lifecycle is proven;
- design oracle and ambiguity safety are correct;
- deterministic geometry is proven;
- all mandatory geometry families from the approved PR 6 scope are implemented and tested;
- package contract is usable and accurate;
- full suite passes;
- docs match behavior.

### CONDITIONAL PASS

Allowed if:

- render foundation and implemented checks are correct;
- no false green, mutation, or network escape exists;
- one or more non-blocking limitations remain;
- missing geometry families have an explicit required corrective patch;
- public/package contract is honest;
- no blocking foundation defect exists.

### RECLASSIFY AS PR 6A

Use when:

- render foundation is complete and safe;
- current geometry subset is useful and deterministic;
- original PR 6 required coverage is materially incomplete;
- closing the entire PR 6 would overclaim completion.

Required follow-up:

```text
PR 6B Geometry Coverage
- control heights
- table density
- pagination geometry
- overflow/clipping
- remaining required families with available design evidence
```

### FAIL

Use if:

- any render failure can green;
- browser launches by default;
- static fail still launches browser;
- external network is not blocked despite documentation;
- target project is modified;
- cleanup/isolation is unsafe;
- diagnostics are non-deterministic;
- design facts are not the primary oracle;
- DOM mapping silently first-picks ambiguity;
- package/docs materially misrepresent availability;
- static verify regresses.

## 45. Finding Format

Severity:

```text
Critical
High
Medium
Low
Informational
```

Finding IDs:

```text
CLI opt-in and flags
STA static short-circuit/non-regression
RNS render states
BLD build
MNT mount
RUN runtime
BRW browser
FNT fonts
NET network
ISO isolation
ART artifacts
SCR screenshots
MAP element mapping
GEO geometry
TOL tolerances
TBL table density
CTL control/button geometry
OVF overflow
DET determinism
PKG package distribution
RDP reads/writes/processes
PER performance
REG prior PR regression
DOC documentation
SCP scope
TST test quality
```

Every material finding must include:

```text
Finding ID
Severity
Status: Confirmed / Strong evidence / Suspected / Not found / Unable to verify
Evidence: path, symbol, line, command, output
Impact
Required correction
Blocks complete PR 6 closure: yes/no
Blocks PR 6A closure: yes/no
```

## 46. Output Report

Create only:

```text
docs/SLICEUI-PR6-VERIFICATION-REPORT.md
```

Required structure:

```markdown
# SliceUI PR 6 Verification Report

## 1. Executive Decision
## 2. Scope and Environment
## 3. Git and Source Integrity Baseline
## 4. Capability and Dependency Audit
## 5. Architecture Review
## 6. Original Scope Coverage Matrix
## 7. CLI Opt-In and Static Gate
## 8. Render State and Exit Matrix
## 9. Browser, Build, Mount, and Runtime Failures
## 10. Font and Dynamic-State Determinism
## 11. Network Isolation
## 12. Target and Temporary Workspace Isolation
## 13. Artifact and Screenshot Lifecycle
## 14. Design Oracle and DOM Mapping
## 15. Geometry Determinism
## 16. Tolerance Assessment
## 17. Implemented Geometry Checks
## 18. Required Geometry Scope Gaps
## 19. Table Density Assessment
## 20. Control and Button Geometry Assessment
## 21. Overflow and Clipping Assessment
## 22. Build and Style Pipeline Fidelity
## 23. Package Distribution Assessment
## 24. Test Quality Review
## 25. Tests Re-run
## 26. Performance and Timeouts
## 27. Read/Write/Network/Process Trace
## 28. PR 1-5 Non-Regression
## 29. Documentation and Skill Assessment
## 30. Diff and Scope Review
## 31. Findings by Severity
## 32. Acceptance Checklist
## 33. Required Corrections or PR 6B Scope
## 34. Deferred Items
## 35. Final Recommendation
## Appendix A: Commands Executed
## Appendix B: Render Scenario Matrix
## Appendix C: Geometry Raw Results
## Appendix D: Network and Process Trace
## Appendix E: Package Contents and Installed-Package Results
## Appendix F: Source Hashes and Git Status
```

## 47. End-of-Task Integrity

Before final response:

- [ ] Re-run all source hashes and compare start/end.
- [ ] Confirm source/tests/docs/skill unchanged.
- [ ] Confirm only verification report was added.
- [ ] Run SliceUI `git status --short`.
- [ ] Run real target `git status --short`.
- [ ] Confirm no stray `.sliceui` in SliceUI repository.
- [ ] Confirm no screenshot/binary remains in repository.
- [ ] Confirm all temporary package installs are under `/tmp`.
- [ ] Confirm no prompt or `tester.xml` was modified/staged.
- [ ] Do not commit or push.

## 48. Required Final Response

### Decision

```text
PR 6: PASS / CONDITIONAL PASS / FAIL / RECLASSIFY AS PR 6A
PR 6 may close: YES / NO
PR 6B required: YES / NO
Next phase may start: YES / NO
```

### Core Guarantees

```text
Render is opt-in:
Static verify launches no browser:
Static failure short-circuits render:
Render failure can never green:
Geometry checks deterministic:
Target isolation proven:
External network blocked:
Artifact lifecycle safe:
Package contract accurate:
Required geometry coverage complete:
Static verify non-regression:
PR 1-5 non-regression:
```

### Scope Coverage

List implemented, partial, and missing geometry families.

### Key Evidence

Summarize dynamic failure matrix, geometry runs, network interception, target isolation, package install, artifacts, and full-suite results.

### Blocking Findings

List or `None`.

### Non-Blocking Findings

List material limitations.

### Required Corrective Patch or PR 6B

State exact required work. Do not implement it.

### Report

```text
docs/SLICEUI-PR6-VERIFICATION-REPORT.md
```

### Validation

List principal commands and results.

### Git Status

Show SliceUI and real-target status.

Do not implement corrections, commit, or push.

## 49. Final Instruction

Begin with source hashes, dependency audit, architecture call graph, and the original scope-coverage matrix. Then dynamically test opt-in behavior, static short-circuiting, all failure states, external network blocking, target isolation, artifact cleanup/preservation, package distribution, and three-run geometry determinism. Treat missing table density, control height, and overflow coverage as a decision-critical scope question rather than a cosmetic limitation. The task is complete only when it returns an evidence-based decision on full PR 6 closure versus conditional correction or explicit PR 6A/PR 6B separation.
