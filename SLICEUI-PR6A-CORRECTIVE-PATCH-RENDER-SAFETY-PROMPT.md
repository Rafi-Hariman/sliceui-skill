# SliceUI PR 6A Corrective Patch Plan: Render Failure Boundary, Network Isolation, and Package Contract

Repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Real target project, read-only reference only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Official baseline checkpoint before PR 6:

```text
2617638 feat(sliceui): strengthen verify reliability and syntax safety
```

Required documents:

```text
docs/SLICEUI-PR6-VERIFICATION-REPORT.md
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
docs/project-docs/foundation/architecture.md
skill/SKILL.md
SLICEUI-PR6-RENDERED-VISUAL-FIDELITY-IMPLEMENTATION-PROMPT.md
SLICEUI-PR6-INDEPENDENT-VERIFICATION-CHECKLIST.md
```

Supporting evidence when needed:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
docs/SLICEUI-PR4-VERIFICATION-REPORT.md
docs/SLICEUI-PR5-VERIFICATION-REPORT.md
```

## 1. Mandatory Entry Gate

Before changing source:

1. Read `docs/SLICEUI-PR6-VERIFICATION-REPORT.md`.
2. Confirm the recorded decision is:

```text
PR 6: CONDITIONAL PASS
PR 6 may close: NO
PR 6B required: YES
```

3. Confirm the blocking findings are:

```text
RNS-001 Critical
A render-stage exception can escape as an uncaught crash without a deterministic SUI-RENDER state.

NET-001 High
The implementation claims offline rendering but has no active browser request interception.

PKG-001 High
The public package exposes --render although the packaged installation cannot provision the required mount fixture/runtime.
```

4. Confirm the geometry coverage gap is intentionally separated into PR 6B and is not part of this corrective patch.
5. Run baseline focused tests before modifying source.
6. Reproduce all three blocking findings with actual output.
7. If the report differs materially, stop and report the mismatch.
8. Do not commit, push, or begin PR 6B in this task.

Record entry-gate evidence in the final response.

## 2. Corrective Patch Objective

Implement the smallest safe correction that:

1. Places the complete rendered-verification lifecycle behind a deterministic error boundary.
2. Converts every render-stage exception into a structured, non-green render result.
3. Rejects unsafe viewport dimensions before browser launch.
4. Actively intercepts and blocks unexpected external network requests.
5. Produces a bounded network diagnostic without leaking sensitive request details.
6. Makes the packaged/public availability contract honest and testable.
7. Ensures runtime page errors change the final render state.
8. Tightens font-fallback and screenshot behavior only where the changes remain local and low-risk.
9. Preserves target-project isolation, static-verify behavior, and cleanup.
10. Reclassifies the completed work honestly as PR 6A Render Foundation and Safety, while leaving geometry expansion to PR 6B.

Do not rewrite the render subsystem. Preserve the existing working foundation.

## 3. Scope Allowed

Changes may include only:

- full render lifecycle error boundary;
- render-stage error classification;
- safe viewport limits and validation;
- active Playwright request interception;
- external request diagnostics and state policy;
- runtime exception propagation into `runtime-fail`;
- public versus development-only package contract;
- CLI/help/documentation gating for development-only render mode;
- packaged-install behavior and diagnostics;
- local font-fallback detection if implementable without broad redesign;
- local screenshot failure policy clarification and enforcement;
- focused regression tests;
- focused re-verification;
- active owning documentation and skill synchronization.

Likely files, subject to source audit:

```text
src/framework/angular/render-verify.mjs
src/commands/verify.mjs
src/cli.mjs
test/render-verify.test.mjs
test/verify-root.test.mjs
package.json only if public-file inclusion or CLI contract genuinely requires it
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
```

Do not modify every listed file automatically. Use the smallest correct diff.

## 4. Explicitly Out of Scope

Do not implement:

- PR 6B geometry coverage;
- input/select/button height checks;
- button proportions;
- major gap checks;
- table header/row/cell/footer density;
- pagination geometry;
- relative alignment coverage;
- overflow and clipping checks;
- expanded border-radius coverage;
- AI vision scoring;
- blocking pixel diff;
- multi-browser support;
- large responsive matrices;
- visual auto-correction;
- full accessibility audit;
- parser redesign;
- static verify redesign;
- resolve/referee/snapshot redesign;
- package dependency installation flow unless explicitly approved;
- new heavy dependency;
- repository scanning;
- unrelated cleanup/refactor;
- commit or push.

Keep these findings deferred unless directly required by the safety fixes:

```text
FNT-001 missing font-fallback detection
SCR-001 screenshot-policy wording
ART-001 artifact wording
MAP-001 hidden duplicate mapping coverage
TOL-001 tolerance-boundary test coverage
TST-001/TST-002/TST-003 broader test hardening
```

## 5. Required Pre-Fix Reproduction

Use a temporary root:

```bash
TMP_ROOT="/tmp/sliceui-pr6a-corrective-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Use the repository CLI explicitly:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs ...
```

Never use a global/on-PATH binary.

### RNS-001 reproduction

Run a render scenario that fails after browser/page creation, including the verified case:

```text
--viewport 99999x99999
```

Record:

```text
stdout
stderr
exit code
raw stack trace yes/no
structured SUI-RENDER diagnostic yes/no
primary state
cleanup result
```

Pre-fix expected bad behavior:

```text
page.setContent or equivalent throws
exception escapes
raw stack trace is printed
no deterministic render state exists
```

### NET-001 reproduction

Create a temporary component or mount script that attempts:

```javascript
fetch("https://example.com/sliceui-network-test")
```

Record:

```text
request interception installed yes/no
request attempted
request blocked yes/no
external connection observed yes/no
render state
diagnostic
```

Pre-fix expected finding:

```text
no page.route or equivalent active blocker exists
```

Do not allow a real external request merely to prove the bug. Use safe instrumentation, request listeners, a guaranteed aborting local test boundary, or source-backed evidence if an external escape cannot be tested safely.

### PKG-001 reproduction

In `/tmp`:

```bash
npm pack
npm install <generated-tarball>
```

Test installed package:

```text
CLI help
static verify
verify --render
```

Record:

```text
render source included yes/no
mount fixture included yes/no
Playwright provision available yes/no
CLI advertises render yes/no
render outcome
exit code
diagnostic
```

Pre-fix expected mismatch:

```text
--render is publicly advertised
required fixture/runtime is not shipped
render always returns fixture-unavailable
```

Do not change source before all reproductions are complete.

## 6. Root-Cause Audit

Audit at minimum:

```text
src/framework/angular/render-verify.mjs
src/commands/verify.mjs
src/cli.mjs
test/render-verify.test.mjs
package.json
package-lock.json
skill/SKILL.md
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
```

Search:

```bash
rg -n "setContent|addScriptTag|newPage|chromium|launch|page\.route|request|fetch|runtime-fail|pageerror|console|screenshot|fixture-unavailable|--render|viewport|preserve-render|files" \
  src test package.json package-lock.json skill docs README.md
```

Prove:

- which operations are outside the current error boundary;
- how browser/page/context cleanup is owned;
- how render states are aggregated;
- how runtime page errors are stored and whether they affect state;
- whether viewport validation has upper bounds;
- whether request interception exists;
- what package `files` includes;
- why the packaged install cannot mount;
- whether help/docs present render as public and generally available;
- whether screenshot failures are currently fatal, ignored, or uncaught.

## 7. Render Lifecycle Error Boundary

The complete render sequence must be covered by one deterministic outer boundary, while preserving phase-specific diagnostics.

Cover all stages:

```text
input/config validation
fixture availability check
temporary workspace creation
Sass compilation
esbuild bundling
browser launch
browser context creation
page creation
request interception installation
setContent
script/style injection
Angular mount readiness
font readiness
geometry collection
runtime/console validation
screenshot capture
artifact preservation
cleanup
```

No exception from these stages may escape as an unclassified raw crash.

## 8. Phase-Aware Failure Classification

Track a bounded current phase, for example:

```text
validate
fixture
build
browser-launch
page-setup
network-policy
content-load
script-injection
mount
font-readiness
measure
screenshot
artifact-preserve
cleanup
```

Map exceptions deterministically:

```text
validation failure       → invalid-input
fixture not provisioned  → fixture-unavailable or unverifiable
Sass/esbuild failure     → build-fail
browser launch/context   → render-setup-fail or browser-fail
setContent/injection     → mount-fail or content-load-fail
Angular readiness timeout→ mount-fail
page error/runtime error → runtime-fail
font readiness failure  → unverifiable/degraded according to policy
measurement error       → unverifiable or render-fail, never pass
screenshot required fail→ screenshot-fail/non-green
preserve failure         → artifact-fail/non-green when explicitly requested
```

Do not classify every exception as visual-fail.

## 9. Structured Error Result

Every caught failure must return a bounded structured result containing:

```text
primary state
exit code
stable diagnostic ID
category
phase
severity
message
safe evidence summary
remediation
cleanup status where useful
```

Example conceptual diagnostic:

```json
{
  "id": "SUI-RENDER-SETUP-001",
  "category": "render-setup",
  "severity": "error",
  "status": "fail",
  "phase": "content-load",
  "message": "The browser page closed while loading the isolated render document.",
  "remediation": "Use a supported viewport and verify the local Chromium installation."
}
```

Follow the repository’s actual diagnostic shape.

Do not expose full raw stack traces in normal user output. A bounded debug detail may be preserved only in temporary/debug artifacts if policy allows.

## 10. Cleanup Guarantee

Cleanup must remain in `finally` or an equivalent unconditional path.

Verify cleanup for failures at each stage:

```text
before browser launch
after browser launch
page setup
setContent
script injection
mount timeout
runtime exception
measurement
screenshot
artifact preservation
```

Required:

- browser closes if created;
- context/page closes through browser close or explicit cleanup;
- temporary workspace follows retention policy;
- temporary screenshot follows retention policy;
- preserve-mode artifact is not deleted after successful preservation;
- cleanup failure cannot replace the original primary failure silently;
- cleanup failure is reported in bounded form if material.

## 11. Viewport Validation

Add explicit safe bounds before browser launch.

Validate:

```text
integer width and height
minimum dimensions
maximum dimensions
format WxH
no negative values
no zero
no decimals unless explicitly supported
no scientific notation
no path-like input
```

Choose bounds based on browser/memory safety and existing supported use cases. Document the policy.

A reasonable bounded range may be conceptual, such as:

```text
minimum 200x200
maximum 7680x4320
```

Do not copy these values blindly. Inspect existing project/design viewports and choose a defensible range.

Invalid viewport behavior:

```text
primary state: invalid-input
exit code: 2
browser launch: 0
workspace creation: 0 or cleaned immediately
artifact writes: 0
```

Test the original failing case `99999x99999`.

## 12. Active Network Isolation

Install request interception before any page content or component code can issue a request.

Policy should explicitly classify URLs:

Allowed where required:

```text
data:
blob:
about:
local inline resources
possibly localhost/127.0.0.1 only if the implementation genuinely uses a local server
```

Blocked:

```text
http:// external hosts
https:// external hosts
ws:// and wss:// external hosts
file:// unless explicitly required and safe
unknown schemes
```

The current inline `setContent` architecture should normally require no external HTTP access.

## 13. Network Diagnostic and State Policy

When a blocked external request is attempted:

1. Abort it before external access.
2. Record only safe details:

```text
scheme
sanitized origin or hostname
resource type
request count
```

3. Do not record:

```text
Authorization headers
cookies
query strings with secrets
request bodies
full sensitive URLs
```

4. Choose and document final state:

```text
runtime-fail
or deterministic degraded/non-green state
```

Recommended: external network attempt makes rendered verification non-green because the environment is no longer self-contained.

## 14. Network Tests

Required tests:

### External fetch

```javascript
fetch("https://example.com/sliceui-network-test")
```

Expected:

- intercepted;
- aborted;
- no response;
- non-green render state;
- stable diagnostic.

### External image/font/script

Attempt at least one resource-tag request if practical.

Expected blocked.

### Allowed data/blob

Confirm documented local schemes still work.

### Sensitive URL sanitization

Use a test URL with query text and verify diagnostic does not echo sensitive query values.

### Interception timing

Confirm interception is installed before `setContent` and script injection.

## 15. Runtime Error State

Resolve RUN-001 if the change is local.

Capture:

```text
pageerror
unhandled rejection where observable
Angular runtime errors
console.error according to documented policy
```

Required:

- runtime exception before valid evidence makes state `runtime-fail`;
- geometry is not trusted after invalid runtime state;
- screenshot may be debug evidence only;
- exit is non-zero;
- console messages are bounded;
- raw stack is not dumped unboundedly;
- unrelated console warning does not automatically become runtime-fail unless policy states so.

If `console.error` is not blocking, document exact distinction from uncaught runtime errors.

## 16. Package Contract Decision

Choose one explicit contract after auditing distribution.

### Recommended minimal approach: development-only render mode

Because the packaged tarball lacks the Angular mount fixture and browser provisioning, the smallest honest correction is:

```text
--render is a development/repository capability
static verify remains public package capability
packaged invocation reports fixture-unavailable with actionable guidance
help/docs clearly label the limitation
no claim that packaged render works out of the box
```

Do not package the complete fixture/runtime merely to avoid the wording change unless user approval is obtained for that material distribution change.

### Alternative: public render feature

Only choose this if all required files, dependencies, runtime provisioning, package size, and security implications are intentionally addressed and verified.

This is a materially larger approach.

If you determine the public approach is necessary, stop before implementing and ask:

> I have an alternative approach that may be better - want me to use it instead?

Do not switch silently.

## 17. Development-Only Gating

If using the recommended development-only contract:

- CLI help must label `--render` as development-only or requiring the local render fixture.
- API contract must describe required dev dependencies/fixture.
- Skill must not instruct packaged users to assume availability.
- Installed package must return a stable `fixture-unavailable` state and exit 3.
- Diagnostic must explain that static verify remains available.
- Do not suggest installing arbitrary dependencies automatically.
- Do not expose internal private paths.

Optional stricter gating:

```text
only advertise --render in repository/dev help context
```

Use only if it can be implemented without confusing CLI differences. Documentation honesty is mandatory; hiding behavior is optional.

## 18. Package Tests

Use `/tmp`:

```bash
npm pack
npm install <tarball>
```

Test installed package:

```text
CLI help
static verify
render verify
invalid viewport
fixture unavailable
```

Required:

- package contents match chosen contract;
- help wording matches availability;
- static verify works without dev fixture;
- render invocation never raw-crashes;
- fixture-unavailable returns exit 3;
- remediation is actionable and honest;
- no target modification;
- no package install initiated by SliceUI itself.

## 19. Font Fallback Hardening

Resolve FNT-001 only if local and low-risk.

Current `document.fonts.ready` wait does not prove the expected font was used.

Minimum safe enhancement:

```text
record expected font family when a literal design/project fact exists
record computed font family
if expected required family is absent from computed family, mark typography check degraded/unverifiable
```

Do not infer an expected font when design/project evidence is absent.

Do not fetch fonts.

If robust expected-font evidence is unavailable, keep FNT-001 deferred and document why. Do not add unreliable detection.

## 20. Screenshot Failure Policy

Clarify and enforce whether screenshot is:

```text
required render evidence
or supporting debug evidence
```

Recommended for current architecture:

```text
geometry is the blocking oracle
screenshot is required supporting evidence for a completed render run
screenshot failure makes the run non-green because the documented artifact contract was not fulfilled
```

If screenshot is supporting-only and pass can survive screenshot failure, documentation and diagnostics must say so explicitly.

Required:

- screenshot exceptions are caught;
- distinct diagnostic;
- no raw crash;
- cleanup runs;
- preserve failure is distinguished from screenshot capture failure.

## 21. Artifact Lifecycle Sync

Ensure actual behavior and docs agree for:

```text
default screenshot creation
default screenshot cleanup
failure screenshot behavior
preserve path
overwrite behavior
maximum file count
maximum file size or bounded dimensions
```

Do not silently preserve temporary bundles, browser profiles, or node_modules.

## 22. Baseline Static Gate Preservation

PR 6A corrections must not alter default static verification semantics.

Verify:

- no browser import/launch on static path;
- no request interception setup on static path;
- no render workspace on static path;
- PR 5 exit codes unchanged;
- static read set unchanged;
- performance unchanged within noise;
- full static diagnostics unchanged.

## 23. Failure-State Tests

Add automated tests for actual state transitions, not only helper behavior.

Required minimum:

### Oversized viewport

- invalid-input;
- exit 2;
- browser not launched;
- no raw stack.

### Browser launch failure

- deterministic non-green state;
- stable diagnostic;
- cleanup.

### Page/content-load failure

- deterministic non-green state;
- stable diagnostic;
- no raw stack.

### Script injection failure

- deterministic non-green state.

### Mount timeout

- mount-fail;
- non-zero.

### Runtime exception

- runtime-fail;
- non-zero;
- no trusted geometry pass.

### Screenshot failure

- behavior matches documented policy.

### Cleanup after failure

- workspace/browser cleanup verified.

Use dependency injection, test hooks, or controlled fixtures. Do not corrupt the local browser installation.

## 24. Network Tests at Browser Level

Tests must launch a real browser or the same Playwright path used by production render verification.

Do not prove network isolation only by checking that `page.route` appears in source.

Assert:

```text
request event observed
route abort executed
no successful external response
render state non-green
diagnostic stable
```

## 25. Viewport Tests

Test:

```text
valid default
valid custom
minimum boundary
maximum boundary
below minimum
above maximum
zero
negative
non-numeric
missing half
99999x99999
```

Confirm invalid cases do not launch the browser.

## 26. Determinism

Run corrected failure scenarios at least three times where practical.

Normalize timestamps and temporary paths only.

Assert stable:

```text
primary state
exit code
diagnostic ID
phase
severity
network diagnostic sanitization
cleanup outcome
```

Known-good geometry determinism must remain unchanged.

## 27. Target and Repository Isolation

Record before/after:

```text
real target git status
real target file hashes
SliceUI source hashes
SliceUI repository status
stray .sliceui directories
binary screenshots in repository
```

Required:

- real target unchanged;
- no screenshots in repository;
- no prompt files modified;
- only intended source/test/docs changes from the corrective patch;
- all temporary package installs under `/tmp`.

## 28. Read/Write/Network/Process Trace

Produce an updated trace:

```text
project files read
project files written
repository files written
/tmp files written
.sliceui artifacts written
external requests attempted
external requests blocked
browser processes
other child processes
```

Verify no npm install occurs during render verification itself.

## 29. Performance

Measure:

```text
viewport validation cost
request interception setup cost
known-good render median
network-block scenario
failure cleanup time
static verify median
```

A small overhead is acceptable. No phase may become unbounded.

## 30. Required Regression Tests

### RNS-001

- full lifecycle errors are classified;
- no raw uncaught crash;
- viewport upper bound enforced;
- cleanup always executes.

### NET-001

- external fetch blocked;
- external resource blocked;
- diagnostic sanitized;
- local schemes allowed as documented.

### PKG-001

- package help/docs match dev-only contract;
- packaged static verify works;
- packaged render returns fixture-unavailable cleanly;
- no overpromise.

### RUN-001 if resolved

- pageerror flips state to runtime-fail.

### FNT-001 if resolved

- expected font mismatch is non-green/degraded.

### Screenshot policy

- capture failure behavior tested;
- preserve path tested;
- cleanup tested.

### PR 1-5 non-regression

- all previous suites remain green.

### PR 6 foundation non-regression

- opt-in dispatch;
- static short-circuit;
- known-good render;
- visual mismatch;
- geometry determinism;
- target isolation.

## 31. Validation Commands

Before changes:

```bash
git status --short
git rev-parse HEAD
git log -1 --oneline
node --version
npm --version
```

Baseline actual tests:

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

Focused suite must include:

```text
render verify tests
verify/verify-root tests
render mount/probe tests
package tests if added
```

Relevant combined suite must include:

```text
render
static verify
snapshot
transcript
Pilar mount/catalog
referee
resolve
spec
agent context
```

Then run:

```bash
npm test
```

## 32. Focused Re-Verification Matrix

After implementation, perform focused re-verification rather than repeating the entire PR 6 audit.

Required scenarios:

```text
valid render pass
visual mismatch
oversized viewport
browser launch failure
page/content-load failure
script injection failure
mount timeout
runtime page error
external fetch
external image/script/font request
screenshot failure
preserve artifact
package static verify
package render fixture-unavailable
static fail short-circuit
static verify no browser
```

For each record:

```text
state
exit code
diagnostic ID
phase
browser launched
request blocked
artifact result
cleanup result
target mutation
```

## 33. PR 6A Closure and PR 6B Boundary

After the corrective patch, use this honest status model:

```text
PR 6A Render Foundation and Safety
- opt-in rendering
- deterministic mount foundation
- failure boundaries
- network isolation
- package contract
- current bounded geometry checks

PR 6B Geometry Coverage
- control heights
- button proportions
- major gaps
- table density
- footer/pagination geometry
- alignment
- overflow/clipping
- remaining evidence-backed geometry families
```

Do not claim full PR 6 complete after only the PR 6A corrective patch.

Correct closure language:

```text
PR 6A may close: YES/NO
PR 6B required: YES
Full PR 6 complete: NO
```

## 34. Documentation and Skill

Update only active owning documentation.

Required synchronization:

```text
render failure states and bounded error handling
viewport limits
active network blocking policy
blocked-request state
package/dev-only availability
fixture-unavailable behavior
runtime-error policy
screenshot required/supporting policy
PR 6A versus PR 6B boundary
```

Likely owners:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
docs/project-docs/foundation/status.md
skill/SKILL.md
src/cli.mjs help text
```

Do not update broad docs unnecessarily.

Skill must not instruct a packaged user to assume rendered verification is available. It should require interpreting fixture-unavailable as non-green and actionable, not as a visual pass.

## 35. Acceptance Criteria

Corrective patch is complete only if:

- [ ] RNS-001 reproduced before fix.
- [ ] NET-001 reproduced before fix.
- [ ] PKG-001 reproduced before fix.
- [ ] Full render lifecycle is covered by deterministic error handling.
- [ ] No render-stage exception escapes as raw uncaught crash.
- [ ] Every render failure is non-green.
- [ ] Failure phase is visible.
- [ ] Cleanup runs after all tested failures.
- [ ] Safe viewport limits exist.
- [ ] `99999x99999` is rejected before browser launch.
- [ ] External network requests are actively intercepted and aborted.
- [ ] Network diagnostics are sanitized.
- [ ] Network attempt cannot green.
- [ ] Runtime page error produces runtime-fail.
- [ ] Package contract is explicitly development-only or otherwise genuinely supported.
- [ ] Packaged static verify remains usable.
- [ ] Packaged render behavior is deterministic and honest.
- [ ] Screenshot failure policy is explicit and enforced.
- [ ] Target project writes remain zero.
- [ ] Static verify remains browser-free and unchanged.
- [ ] Current geometry determinism remains intact.
- [ ] Focused tests pass.
- [ ] Relevant combined suite passes.
- [ ] Full suite passes except known environment skips.
- [ ] PR 1-5 non-regression confirmed.
- [ ] Documentation synchronized.
- [ ] PR 6B geometry scope remains separate.
- [ ] No commit or push performed.

## 36. Safety and Git Rules

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

Do not modify or stage `tester.xml` unless the user explicitly decides it is an official product fixture in a separate task.

Do not modify the real target project.

Do not commit or push. PR 6A requires focused re-verification first.

Record initial/final statuses and source hashes.

## 37. Work Sequence

### Phase 1: Gate and reproduce

- read the independent verification report;
- confirm blocker scope;
- reproduce RNS-001, NET-001, PKG-001;
- run baseline tests.

### Phase 2: Root-cause and contract note

Before coding, state:

```text
failure-boundary root cause
network-isolation root cause
package-contract root cause
files to change
viewport bounds
network URL policy
runtime-error policy
screenshot policy
package/dev-only decision
tests
```

### Phase 3: Failure boundary and viewport

- phase-aware try/catch;
- deterministic diagnostics;
- safe viewport bounds;
- unconditional cleanup.

### Phase 4: Active network isolation

- interception before content load;
- allowlist/deny policy;
- diagnostic sanitization;
- non-green external request state.

### Phase 5: Runtime and screenshot hardening

- pageerror state;
- screenshot failure state;
- bounded logs;
- cleanup.

### Phase 6: Package contract

- development-only gating/documentation or approved public provisioning;
- installed-package tests.

### Phase 7: Tests and E2E

- focused failure matrix;
- browser-level network tests;
- package test;
- read/write/process trace;
- performance;
- full suite.

### Phase 8: Focused re-verification

- required scenario matrix;
- PR 6A closure decision;
- PR 6B remains required.

### Phase 9: Documentation and scope review

- owning docs only;
- no geometry expansion;
- no unrelated change.

## 38. Required Final Response

### Entry Gate

```text
PR 6 verification decision:
RNS-001 confirmed:
NET-001 confirmed:
PKG-001 confirmed:
Other blockers:
```

### Pre-Fix Reproduction

```text
Uncaught render crash:
Viewport used:
Structured diagnostic present:
External request interception present:
Package render availability:
Package help wording:
```

### Root Cause

Include paths, symbols, phase ownership, network setup, and package-file evidence.

### Corrective Patch Summary

Describe the smallest changes.

### Files Changed

Group source, tests, docs/skill/help, and pre-existing prompts/tester.xml.

### Failure Boundary Contract

```text
phases covered:
state mapping:
raw stack policy:
cleanup guarantee:
viewport bounds:
```

### Network Contract

```text
allowed schemes/origins:
blocked schemes/origins:
blocked-request state:
diagnostic sanitization:
interception timing:
```

### Package Contract

```text
public or development-only:
packaged static verify:
packaged render behavior:
help wording:
fixture requirement:
```

### Runtime, Font, and Screenshot Policy

```text
pageerror behavior:
console.error behavior:
font fallback behavior:
screenshot role:
screenshot failure behavior:
artifact preserve/cleanup:
```

### Validation

List exact commands and results.

### Trace and Performance

```text
target reads:
target writes:
repository scans:
external requests attempted/blocked:
temporary writes:
child/browser processes:
static median:
render median:
```

### Focused Re-Verification Decision

```text
PR 6A corrective patch: PASS / FAIL
RNS-001: RESOLVED / UNRESOLVED
NET-001: RESOLVED / UNRESOLVED
PKG-001: RESOLVED / UNRESOLVED
RUN-001: RESOLVED / DEFERRED / UNRESOLVED
FNT-001: RESOLVED / DEFERRED / UNRESOLVED
PR 6A may close: YES / NO
PR 6B required: YES
Full PR 6 complete: NO
```

### Deferred PR 6B Scope

List exactly:

```text
control heights
button proportions
major gaps
table density
footer/pagination geometry
relative alignment
overflow/clipping
remaining evidence-backed border/radius and typography coverage
```

### Documentation Sync

Use `Documentation sync: clear.` or list stale docs.

### Git Status

Include `git status --short`. Do not commit.

## 39. Definition of Done

The task is complete only when every render-stage exception is converted to a deterministic non-green result, unsafe viewports are rejected before browser launch, external network requests are actively blocked and safely diagnosed, runtime errors invalidate rendered evidence, the public/development package contract is honest and verified through `npm pack`, screenshot and cleanup behavior are explicit, target isolation is preserved, static verify remains unchanged, all tests pass, and focused re-verification authorizes or blocks PR 6A closure while explicitly retaining PR 6B Geometry Coverage as required follow-up.

Start by reproducing RNS-001, NET-001, and PKG-001. Do not modify source until all three findings have been recorded with actual commands and output.
