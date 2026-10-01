# SliceUI PR 6 Implementation Plan: Rendered Visual Fidelity

Repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Project target nyata yang hanya boleh digunakan sebagai read-only reference unless copied to a temporary workspace:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Checkpoint baseline resmi:

```text
2617638 feat(sliceui): strengthen verify reliability and syntax safety
```

Dokumen yang wajib dibaca sebelum implementasi:

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
```

Prompt PR sebelumnya boleh dibaca sebagai secondary context. Source code, active documentation, committed checkpoints, dan verification reports tetap menjadi authority utama.

## 1. Mandatory Entry Gate

Sebelum mengubah source:

1. Pastikan checkpoint `2617638` berada pada current history.
2. Pastikan PR 5 telah ditutup setelah corrective patch `FWK-001`, `FWK-002`, dan `EXT-001`.
3. Pastikan keputusan terakhir menyatakan:

```text
PR 5 official status: COMPLETE
PR 6 may start: YES
```

4. Jalankan baseline tests untuk verify, render probes, mount tests, conventions, snapshot, referee, resolve, spec, dan agent context.
5. Audit dependency dan script yang sudah tersedia untuk Angular mount, browser rendering, screenshots, image comparison, dan test server.
6. Catat `git status --short` dan klasifikasikan seluruh modified/untracked files.
7. Jika ada unknown modification selain prompt files yang sudah diketahui, hentikan dan laporkan.
8. Jangan menambah dependency atau mengubah build architecture sebelum kemampuan existing telah diaudit.
9. Jangan mengubah source sebelum render ownership, failure states, measurable facts, dan artifact lifecycle ditulis dalam implementation note.

Catat entry-gate evidence pada final response.

## 2. Masalah yang Harus Diselesaikan

PR 1 sampai PR 5 telah memperbaiki context, snapshot, referee, resolve safety, dan structural verification. Namun structural correctness tidak membuktikan runtime visual fidelity.

Contoh defect yang dapat lolos static checks:

```text
font size terlalu besar
control height salah
button proportion salah
table row terlalu tinggi
padding root berlebihan
spacing teramplifikasi
pagination/footer density salah
teks terpotong atau overflow
library default terduplikasi oleh generated CSS
layout responsive rusak pada viewport target
render gagal tetapi static verify tetap terlihat green
```

PR 6 harus menambahkan optional rendered verification yang mengukur hasil runtime secara deterministic, tanpa mengganti static verify dan tanpa menjadikan screenshot pixel similarity sebagai satu-satunya oracle.

## 3. Tujuan PR 6

Implementasikan Rendered Visual Fidelity dengan prinsip berikut:

1. Render mode bersifat explicit dan opt-in.
2. Static verify tetap cepat dan tetap menjadi gate terpisah.
3. Render failure tidak pernah green.
4. Mount/build/runtime errors dibedakan dari visual mismatch.
5. Geometry dan computed style facts menjadi primary machine evidence.
6. Screenshot menjadi supporting evidence, bukan satu-satunya oracle.
7. Fixed viewport, browser, fonts, locale, time, animation, dan data state dibuat deterministic.
8. Comparison berasal dari transcript/raw design facts, bukan `spec.md` atau resolver hints.
9. Diagnostics memiliki stable IDs dan measurable deltas.
10. Generated output tidak diubah otomatis oleh verifier.
11. Temporary mount tidak memodifikasi project target nyata.
12. Existing headless probes direuse bila aman.
13. Repository-wide scans tidak ditambahkan ke hot path.
14. Artifacts memiliki lifecycle, size policy, dan cleanup yang jelas.
15. PR 1 sampai PR 5 tidak regress.

## 4. Scope yang Diizinkan

PR 6 boleh mengubah atau menambah, setelah audit:

```text
src/commands/verify.mjs untuk explicit render flag/dispatch yang additive
src/commands/render-verify.mjs bila command separation lebih bersih
src/framework/angular/render-verify.mjs
src/framework/angular/render-mount.mjs
src/lib/render-diagnostics.mjs
src/lib/geometry-compare.mjs
src/lib/render-artifacts.mjs
src/lib/timing.mjs secara additive bila metadata diperlukan
src/cli.mjs untuk help/flags
existing render/mount helpers and tests
skill/SKILL.md
active documentation pemilik render contract
minimal deterministic render fixtures
```

Gunakan nama dan ownership convention repository aktual. Jangan membuat semua helper bila existing files sudah memiliki responsibility yang tepat.

## 5. Di Luar Scope

Jangan mengimplementasikan:

- automated CSS correction;
- AI vision scoring;
- OCR service eksternal;
- cloud browser service;
- network calls;
- arbitrary production application crawling;
- repository-wide component rendering;
- parser rewrite;
- resolve redesign;
- snapshot/referee redesign;
- full design-tool API integration;
- responsive matrix tak terbatas;
- support semua browser pada PR pertama;
- performance benchmarking produk yang luas;
- accessibility audit lengkap;
- visual approvals UI/dashboard;
- baseline image version-control system yang besar;
- TypeScript/Python rewrite;
- dependency baru tanpa audit dan explicit justification;
- unrelated cleanup/refactor;
- commit atau push sebelum independent verification.

## 6. Architecture Principle: Separate Static and Rendered Gates

Pertahankan separation:

```text
STATIC VERIFY
sliceui verify <dir> [name]
→ structural, API, framework, design-fact, convention checks
→ no browser required
→ fast default path

RENDERED VERIFY
sliceui verify <dir> [name] --render
or an equivalent explicit command consistent with current CLI
→ safe temporary mount
→ build/serve
→ deterministic browser render
→ geometry/computed-style/runtime checks
→ screenshot artifacts
```

Jangan mengaktifkan browser render secara default.

Jika existing CLI lebih cocok dengan separate command, misalnya:

```text
sliceui render-verify <dir> [name]
```

jelaskan tradeoff sebelum coding. Jangan silently change architecture. Prefer additive `--render` only if parser and output contract remain clear.

## 7. Result State Model

Rendered verification harus membedakan:

```text
pass
visual-fail
build-fail
mount-fail
runtime-fail
unverifiable
invalid-input
degraded
warning
skip
```

Suggested command semantics:

```text
pass          → render completed; all required rendered checks passed
visual-fail   → render completed; blocking measurable visual mismatch exists
build-fail    → temporary mounted project did not build
mount-fail    → component could not be mounted safely
runtime-fail  → browser page loaded but runtime exception prevented valid evidence
unverifiable  → required design/render evidence absent or invalid
invalid-input → invalid target/viewport/config
```

Final output must never collapse build failure into visual mismatch or skip.

## 8. Exit-Code Contract

Audit existing CLI exit conventions before choosing codes.

Preserve PR 5 contract where applicable:

```text
0 = verified pass
1 = verified correctness/visual fail
2 = invalid input/target
3 = unverifiable required evidence
```

If build/mount/runtime failure needs distinct codes, prefer a documented bounded extension only if compatibility is safe. Otherwise use non-zero with explicit primary state.

Wajib:

- browser unavailable is non-green;
- build failure is non-green;
- mount timeout is non-green;
- missing screenshot is non-green when screenshot is required;
- required geometry checks skipped cannot exit 0;
- warnings-only may exit 0 only if render evidence is complete;
- human output and internal state agree.

## 9. Render Ownership and Isolation

Rendered verification must not mutate the real target project.

Allowed approach:

```text
read component + bounded owning module context
→ copy minimal fixture or use isolated existing mount harness
→ inject/mount generated component in /tmp
→ build/serve temporary workspace
→ render
→ delete or preserve temp path according to debug policy
```

Forbidden:

```text
editing target NgModule
editing target routing
writing target source files
writing target package.json or lockfile
running install/update in target
leaving generated .sliceui or screenshots in target
```

If an existing mount helper safely copies fixtures, reuse it.

## 10. Dependency Audit Before Decision

Audit current package and scripts:

```bash
cat package.json
rg -n "playwright|puppeteer|chromium|browser|headless|screenshot|render|mount|karma|angular|pixelmatch|sharp|canvas" \
  package.json package-lock.json src test scripts docs
```

Classify available capabilities:

```text
already installed and supported
present only in dev tooling
existing custom browser probe
available through system browser
missing
```

Do not add a browser dependency before proving existing tooling cannot satisfy the scope.

If a new dependency is materially required, stop before installing and provide:

```text
user approach
proposed dependency
alternative without dependency
tradeoff
```

Then ask:

> I have an alternative approach that may be better - want me to use it instead?

Do not silently add the dependency.

## 11. Deterministic Render Environment

A valid render requires fixed controls.

Define and record:

```text
browser engine and version
viewport width and height
device scale factor
color scheme
reduced motion
locale
timezone
font availability and readiness
network policy
animation policy
transition policy
date/time seed if relevant
random seed if relevant
mock data state
scroll position
page background
```

Recommended first viewport:

```text
design frame viewport if explicit
otherwise one documented default desktop viewport
```

Do not test many responsive viewports in the initial PR unless design facts explicitly require them.

## 12. Font Policy

Font differences can invalidate geometry.

Required behavior:

1. Determine project/design font family from available facts.
2. Wait for `document.fonts.ready` where supported.
3. Record actual computed font family.
4. Detect fallback font usage when expected font is unavailable.
5. Missing required font produces `degraded` or `unverifiable`, not silent visual pass.
6. Do not download fonts over network during verification.
7. Avoid OS-specific font assumptions without documentation.

## 13. Animation and Dynamic State Policy

Before measurement:

```text
animations disabled or settled
transitions disabled or settled
spinners stopped through deterministic fixture state
async mock data loaded
microtasks/macrotasks settled according to bounded rule
scroll position reset
hover/focus/open state explicitly selected when required
```

Use timeout bounds. Never wait indefinitely.

If a required open/expanded state cannot be reached, mark check unverifiable/runtime-fail rather than measuring the wrong state.

## 14. Data and Interaction State

Rendered fixture must use deterministic data.

Define explicit states where relevant:

```text
default
populated table
empty table if design shows it
select open state if design shows it
hover/focus only when design requires it
pagination page state
checked/unchecked checkbox
status label values
```

Do not invent states absent from design evidence.

Initial PR should support only states required by existing target fixtures. Document unsupported states.

## 15. Design Facts as Render Oracle

Primary comparison source:

```text
raw XML/FIGML facts
transcript.json literal and structural facts
```

Not primary oracle:

```text
resolved.json
spec.md
agent-context.md
old generated output
sample component screenshot
```

Resolved/spec may be used only for contextual labels, never as expected geometry.

## 16. Measurement Model

Collect bounded facts from rendered DOM.

Per relevant element:

```text
identifier mapping
bounding rectangle
computed display/position
width/height
padding
margin where reliable
gap
font family
font size
font weight
line height
color
background color
border width/style/color
border radius
text content
visibility
scrollWidth/clientWidth
scrollHeight/clientHeight
overflow state
```

Do not dump all DOM computed styles. Measure only mapped/evidence-backed elements.

## 17. Element Mapping

Rendered DOM elements must map to design/transcript nodes deterministically.

Preferred strategies:

```text
explicit data attributes injected only in temporary fixture
stable component selectors
text + role + bounded structural relationship
known table/header/control selectors
```

Do not modify production component source merely to add test IDs unless existing code already supports them and user approved.

If mapping is ambiguous:

```text
mark ambiguous
show candidates
skip required comparison as unverifiable if no winner
never first-pick silently
```

## 18. Geometry Comparison

Compare measurable relationships rather than only absolute canvas coordinates.

Required geometry classes:

```text
component root size
internal padding
child gaps
control width/height
button width/height
text baseline/line box where measurable
table header height
table row height
footer height
pagination bounding box
relative alignment
visible overflow/clipping
```

Separate:

```text
canvas x/y
component internal padding
relative child positions
```

Do not copy canvas position into internal layout expectations.

## 19. Tolerance Policy

Use explicit tolerances by measurement type.

Conceptual starting policy, to be validated against fixtures:

```text
position/size: small absolute px tolerance + optional relative tolerance
font size: stricter small tolerance
line height: small tolerance
color: exact normalized RGBA when deterministic
border radius: small px tolerance
alignment/order: structural, not numeric only
```

Do not hardcode arbitrary tolerances without baseline experiments.

Before implementation, measure known good fixture variance across at least three identical runs. Use observed deterministic variance to choose tolerances.

Document every tolerance and rationale.

## 20. Visual Diagnostic Contract

Every rendered check emits stable diagnostic data.

Conceptual shape:

```json
{
  "id": "SUI-RENDER-GEOMETRY-001",
  "category": "control-height",
  "severity": "error",
  "status": "fail",
  "designNodeId": "...",
  "selector": "uii-select",
  "expected": 32,
  "actual": 40,
  "delta": 8,
  "tolerance": 1,
  "unit": "px",
  "trust": "literal-design",
  "artifact": "actual.png",
  "remediation": "Reduce the rendered control height to match the design fact."
}
```

Fields where available:

```text
stable id
category
severity/status
design node or structural fact
rendered selector/element locator
expected/actual/delta/tolerance
trust source
artifact references
remediation
```

Avoid huge HTML/style dumps.

## 21. Diagnostic Categories

Use bounded categories such as:

```text
render-setup
mount
runtime
font
root-geometry
spacing
control-height
typography
table-density
alignment
overflow
color
border
style-amplification
screenshot
```

Do not create one category per element.

## 22. Required Check Families

Initial PR 6 should implement measurable checks for:

```text
root internal padding
major vertical/horizontal gaps
input/select/button heights
button proportions
font size and line height
section/header typography
table header height
table row height
table footer/pagination geometry
visible clipping/overflow
major border/radius facts
```

Checks only run when expected design evidence exists.

## 23. Table Density Checks

Table visual fidelity is a priority.

Measure:

```text
header height
row height
cell vertical padding
text line height
checkbox/action column alignment
footer height
search/limit toolbar height
pagination control height
information text baseline
```

Do not require a row count beyond deterministic mock state.

Use design facts to determine expected density. Do not inherit sample defaults as truth.

## 24. Typography Checks

Measure:

```text
font family readiness
font size
font weight
line height
text wrapping
truncation
letter spacing if explicit
```

Distinguish:

```text
heading
label
body
helper text
table header
table row
button text
status text
```

Do not infer semantic typography solely from tag names.

## 25. Control and Button Geometry

For input/select/button/check controls:

```text
height
width when design-constrained
horizontal padding
border radius
icon/text gap
icon size where measurable
label alignment
```

Do not fail width when the design intentionally allows fluid sizing.

## 26. Overflow and Clipping

Detect:

```text
scrollWidth > clientWidth beyond tolerance
scrollHeight > clientHeight unexpectedly
text clipping
hidden required element
off-viewport critical control
container overflow caused by fixed dimensions
```

Expected scroll containers must be distinguished from accidental overflow.

## 27. Style Amplification

Detect likely generated-style amplification where measurable:

```text
library default + generated override doubles padding
nested wrappers compound spacing
font size amplified beyond design
min-height plus padding makes control too tall
multiple matching rules create unexpected computed value
```

Rendered verifier should report computed result and bounded contributing-rule evidence if browser tooling exposes it.

Do not implement a full CSS cascade debugger in PR 6.

## 28. Duplicate Library Defaults

Compare computed values and generated declarations to identify likely restatement of library defaults.

This is usually warning-level unless it causes measurable mismatch.

Examples:

```text
same default padding redeclared
same border radius redeclared
same font inherited then overridden identically
```

Do not mark every duplicate declaration as a failure.

## 29. Screenshot Policy

Capture at minimum:

```text
actual rendered screenshot
```

Optional when deterministic expected bitmap exists:

```text
expected image
pixel diff image
```

Rules:

- screenshot is evidence, not sole pass/fail oracle;
- no pixel diff without stable comparable baseline;
- redact or avoid sensitive data;
- deterministic mock data only;
- screenshot filename stable and bounded;
- no giant uncompressed artifacts without policy;
- do not commit screenshots by default.

## 30. Screenshot Comparison

If a design/source image exists and is geometrically comparable, pixel comparison may be experimental and non-blocking unless validated.

Before making pixel diff blocking, test:

```text
font variance
anti-aliasing variance
browser version variance
device scale variance
subpixel positioning
color-profile variance
```

Initial PR should prefer geometry/computed-style blocking checks and keep pixel similarity informational unless evidence proves stability.

## 31. Build and Mount Failures

Differentiate:

```text
component source invalid
owning module unavailable
fixture integration failure
Angular build failure
browser launch failure
runtime exception
render timeout
font timeout
measurement mapping failure
```

Each must have distinct diagnostic ID and remediation.

Do not report visual mismatch when no valid render exists.

## 32. Console and Runtime Errors

Capture bounded browser evidence:

```text
uncaught exceptions
unhandled promise rejections
Angular runtime errors
console.error
failed local resource loads
```

Policy:

- runtime exception preventing valid state is blocking;
- unrelated warning may be non-blocking;
- network request to prohibited external source is blocking/degraded;
- do not dump unlimited console logs.

## 33. Network Policy

Default render should be offline/local-only.

Block or intercept unexpected external requests.

Allow only:

```text
local fixture server
bundled assets
explicit local data URLs/blob URLs
```

Unexpected network dependency makes render non-deterministic and should be reported.

## 34. Render Artifact Layout

Store temporary or requested artifacts under a dedicated output root, conceptually:

```text
.sliceui/artifacts/<name>/render/
```

or temporary `/tmp` path by default.

Possible files:

```text
render-report.json
actual.png
geometry.json
browser-console.json
mount-log.txt
```

Decide ownership before coding.

Recommended:

```text
normal run → bounded report under .sliceui artifact if project contract expects it
heavy screenshot/debug files → /tmp unless explicit preserve flag
```

Do not add large binary files to Git.

## 35. Artifact Schema

If persisted report is introduced, version it.

Conceptual:

```json
{
  "schemaVersion": 1,
  "primaryState": "pass",
  "environment": {},
  "viewport": {},
  "checks": [],
  "diagnostics": [],
  "artifacts": {},
  "metrics": {},
  "timing": {}
}
```

No absolute private path unless needed and explicitly marked local-only.

## 36. Artifact Retention and Cleanup

Define:

```text
temporary workspace cleanup on success
temporary workspace preserve on debug/failure policy
screenshot retention
maximum artifact size
old artifact overwrite/version behavior
```

Never silently accumulate large browser artifacts.

## 37. CLI Contract

Audit current parser before choosing final form.

Preferred additive command examples:

```bash
sliceui verify <dir> [name] --render
sliceui verify <dir> [name] --render --viewport 1440x900
sliceui verify <dir> [name] --render --preserve-artifacts
```

Do not add all flags unless needed.

Initial minimum may be:

```text
--render
--viewport <width>x<height> only if design viewport is absent
--preserve-render-artifacts optional for debugging
```

Validate viewport input and reject unsafe values.

## 38. Static Verify Interaction

Define whether `--render` runs static verify first.

Recommended:

```text
static verify runs first
blocking static fail → render skipped with explicit reason
static pass/warnings → render runs
unverifiable static state → render skipped, non-green
```

Do not spend browser time when foundational static verification is invalid.

If render can provide independent evidence despite some static warnings, document exact policy.

## 39. Run Logging

If compatible, append additive metadata:

```text
verifyMode: static|render
renderState
browser
viewport
renderElapsedMs
artifactPath
```

Do not redesign timing/runs log.

## 40. Determinism

Run same render at least three times.

Expected stable after normalizing timestamps:

```text
primary state
diagnostic IDs
expected/actual values within deterministic bounds
element mapping
screenshot dimensions
geometry output
console errors
tolerance decisions
```

If same-run geometry varies beyond tolerance, render mode is not ready to be blocking.

## 41. Performance Budget

Rendered verification is expected to be slower, but must be bounded.

Measure:

```text
mount setup
build/serve
browser startup
page load
font readiness
measurement
screenshot
cleanup
total
```

Set explicit timeout values based on observed fixture behavior, not arbitrary assumptions.

No phase may wait indefinitely.

## 42. Read and Write Boundary

Dynamically trace:

```text
project files read
project files written
temporary files written
.sliceui files written
network requests
child processes
```

Required:

- target project writes = 0;
- repository-wide scans = 0 unless existing bounded mount requires a documented set;
- child process commands visible;
- temporary writes contained;
- no package installation during verify.

## 43. Security and Safety

Browser render executes code. Apply boundaries:

```text
local fixture only
no credentials
offline network policy
bounded timeout
bounded output
no arbitrary shell from component content
no external URL navigation
no target mutation
```

Do not render untrusted arbitrary repositories without documenting the execution risk.

## 44. Test Requirements

### 44.1 CLI opt-in

Default static verify does not launch browser. `--render` does.

### 44.2 Invalid viewport/input

Non-green, no browser launch.

### 44.3 Static fail short-circuit

Render skipped, reason visible.

### 44.4 Valid render pass

Known-good fixture renders and passes required geometry checks.

### 44.5 Build failure

Distinct state/diagnostic, non-green.

### 44.6 Mount failure

Distinct state/diagnostic, non-green.

### 44.7 Runtime exception

Distinct state/diagnostic, non-green.

### 44.8 Browser unavailable

Distinct non-green state, actionable remediation.

### 44.9 Font unavailable

Degraded/unverifiable according to required font policy.

### 44.10 Root padding mismatch

Blocking measurable diagnostic.

### 44.11 Control height mismatch

Blocking measurable diagnostic.

### 44.12 Typography mismatch

Expected versus actual diagnostic.

### 44.13 Table row density mismatch

Expected versus actual row height/padding diagnostic.

### 44.14 Button proportion mismatch

Expected versus actual dimensions/padding diagnostic.

### 44.15 Overflow

Unexpected clipping/overflow diagnostic.

### 44.16 Alignment

Relative alignment diagnostic where design evidence exists.

### 44.17 Missing design fact

Check skips as optional or render report becomes unverifiable if required mapping absent, according to policy.

### 44.18 Ambiguous DOM mapping

No silent first-pick.

### 44.19 Animation disabled

Repeated geometry stable.

### 44.20 Font ready

Measurement waits correctly.

### 44.21 External network blocked

Unexpected request reported.

### 44.22 Screenshot generated

Correct dimensions and bounded file size.

### 44.23 Screenshot failure

No false pass when screenshot required.

### 44.24 Artifact cleanup

Temporary files cleaned on success unless preserve flag.

### 44.25 Preserve artifacts

Debug flag preserves documented files only.

### 44.26 Target project unchanged

Hash/status before and after identical.

### 44.27 Determinism

Three runs produce stable decisions.

### 44.28 Static verify non-regression

Default verify output/reads/performance remain compatible.

### 44.29 PR 1–5 non-regression

All previous safeguards remain green.

## 45. Fixture Strategy

Reuse existing render probes and Angular fixtures where possible.

Audit candidates:

```text
test/fixtures/angular13
test/fixtures/mahasiswa-tarif
existing pilar mount fixture
existing cascade/render probes
```

Create minimal deterministic render fixture only if existing fixtures cannot express geometry checks.

Fixture should include:

```text
heading
input/select/button
table header and rows
footer/pagination
status label
known font policy
fixed mock data
```

Avoid copying a large real application.

## 46. Baseline and Defect Fixtures

Maintain at least:

```text
known-good render fixture
root-padding defect
control-height defect
table-density defect
typography defect
overflow defect
runtime-failure fixture
```

Prefer programmatic fixture variants over duplicated trees.

## 47. Test Validation Commands

Before changes:

```bash
git status --short
git rev-parse HEAD
git log -1 --oneline
node --version
npm --version
```

Run baseline relevant tests discovered by audit, including existing render/mount probes.

After implementation, syntax-check all changed/new source and tests.

Focused tests should include actual names discovered from repository, conceptually:

```bash
node --test test/render-verify.test.mjs
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
node --test test/pilar-mount.test.mjs
```

Do not invent filenames if repository uses different names. Use actual test ownership.

Relevant combined suite must include:

```text
render/mount tests
verify tests
snapshot tests
transcript tests
Pilar catalog/mount tests
referee tests
resolve/spec/agent-context tests
```

Then run:

```bash
npm test
```

## 48. Temporary E2E Validation

Use:

```bash
TMP_ROOT="/tmp/sliceui-pr6-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Use repository CLI explicitly:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs ...
```

Never use global/on-PATH binary.

E2E scenarios:

```text
static verify only
render pass
root padding mismatch
control height mismatch
table row mismatch
typography mismatch
overflow
build failure
runtime error
browser unavailable simulation
font unavailable simulation
external request block
artifact preserve/cleanup
```

Capture:

```text
primary state
exit code
diagnostics
timings
read/write trace
artifact list
screenshot dimensions
target git status before/after
```

## 49. Independent Geometry Validation

For at least one representative fixture, independently inspect generated `geometry.json` or report values and compare them to browser evaluation output.

Ensure no unit conversion or selector mapping bug.

## 50. Visual Comparison Strategy

Before adding any pixel similarity score, state:

```text
available expected image source
alignment/cropping policy
browser stability evidence
font stability evidence
anti-aliasing variance
whether score is informational or blocking
```

If these cannot be proven, do not make pixel score blocking in PR 6.

## 51. Documentation and Skill

Update owning docs only, likely:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
README.md or overview only if CLI command list changes
```

Document:

```text
opt-in command/flag
static versus rendered gate
result states and exits
deterministic environment
tolerances
artifact paths and retention
build/mount/runtime failure semantics
offline/network policy
security note
known limitations
```

Skill should instruct:

- run static verify first;
- run rendered verify only when requested/available according to workflow;
- do not treat render setup failure as visual pass;
- use diagnostics, not screenshot intuition alone;
- do not auto-edit generated code;
- do not browse repository or network.

## 52. Backward Compatibility

Preserve:

```text
sliceui verify <dir> [name]
```

Default behavior and exit semantics remain static verify.

New render mode is additive.

Do not require browser dependency for static verify startup.

Do not change existing static report schema destructively.

## 53. PR 1–5 Non-Regression

### PR 1

Compact agent context remains under budget.

### PR 2

Snapshot dedup and missing-ground-truth safety remain intact.

### PR 3

Hot referee remains zero project-source reads.

### PR 4

Resolve provenance and ambiguity safety remain intact.

### PR 5

Name normalization, exact APIs, lexical syntax safety, diagnostic trust, exit states, and bounded reads remain intact.

## 54. Acceptance Criteria

PR 6 implementation complete only if:

- [ ] Entry gate authorizes PR 6.
- [ ] Existing render/mount capabilities audited.
- [ ] Dependency decision explicit.
- [ ] Render mode opt-in.
- [ ] Static verify unchanged by default.
- [ ] Target project writes remain zero.
- [ ] Temporary mount isolated.
- [ ] Browser/render environment deterministic.
- [ ] Fonts handled explicitly.
- [ ] Animations/dynamic state controlled.
- [ ] Design facts are primary oracle.
- [ ] Element mapping deterministic or ambiguity visible.
- [ ] Geometry checks implemented for priority categories.
- [ ] Tolerances documented and evidence-based.
- [ ] Table density checks implemented.
- [ ] Typography checks implemented.
- [ ] Control/button geometry checks implemented.
- [ ] Overflow checks implemented.
- [ ] Build/mount/runtime failures distinguished.
- [ ] No render failure can green.
- [ ] Screenshot is supporting evidence, not sole oracle.
- [ ] Artifacts versioned/bounded/cleaned.
- [ ] Network external requests blocked/reported.
- [ ] Diagnostics stable and measurable.
- [ ] Three-run determinism demonstrated.
- [ ] Read/write trace proves isolation.
- [ ] Focused tests pass.
- [ ] Relevant suite passes.
- [ ] Full suite passes except known environment skips.
- [ ] PR 1–5 non-regression confirmed.
- [ ] Documentation synchronized.
- [ ] No out-of-scope auto-fixing or AI vision work.

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

Do not delete prompt files.

Do not modify the real target project.

Do not commit or push. PR 6 requires independent verification first.

Record initial/final statuses and source hashes.

## 56. Work Sequence

### Phase 1: Gate and capability audit

- confirm checkpoint and closure;
- classify working tree;
- audit browser/mount tooling;
- run baseline tests.

### Phase 2: Architecture decision note

Before coding, state:

```text
CLI form
existing tooling reused
dependency decision
mount ownership
result states
artifact ownership
deterministic environment
measurement categories
tolerance experiment
tests
```

If a materially different dependency/architecture is needed, stop and ask before switching.

### Phase 3: Render foundation

- isolated mount;
- browser lifecycle;
- deterministic environment;
- failure states.

### Phase 4: Measurement and diagnostics

- element mapping;
- geometry/computed styles;
- tolerances;
- stable diagnostics.

### Phase 5: Priority fidelity checks

- root spacing;
- control/button geometry;
- typography;
- table density;
- overflow/alignment.

### Phase 6: Artifacts and screenshot

- report schema;
- screenshot;
- retention/cleanup;
- no sole pixel oracle.

### Phase 7: CLI and static integration

- opt-in dispatch;
- static short-circuit;
- help/output/exit contract.

### Phase 8: Tests and E2E

- success and defect fixtures;
- failures;
- determinism;
- read/write/network trace.

### Phase 9: Documentation and skill

- owning docs only;
- security and limitations.

### Phase 10: Final scope review

- no target mutation;
- no browser dependency in static startup;
- no auto-fix;
- no unrelated change.

## 57. Required Final Response

### Entry Gate

```text
Checkpoint baseline:
PR 5 official status:
PR 6 authorized:
Evidence:
```

### Capability Audit

```text
Existing browser/mount tooling:
Existing dependencies:
New dependencies added: YES/NO
Architecture selected:
Alternative considered:
```

### Summary

Describe rendered verification implementation.

### Files Changed

Group source, tests, fixtures, skill, docs, and pre-existing prompts.

### CLI Contract

```text
static command:
render command/flag:
viewport behavior:
artifact preservation:
```

### Render State and Exit Contract

```text
pass:
visual-fail:
build-fail:
mount-fail:
runtime-fail:
unverifiable:
invalid-input:
```

### Deterministic Environment

Report browser, viewport, scale, fonts, locale, timezone, animations, network, and data state.

### Measurement and Tolerances

List implemented measurements and tolerance rationale.

### Visual Diagnostics

List stable categories and example expected/actual/delta evidence.

### Artifact Contract

```text
report path:
screenshot path:
geometry path:
retention:
cleanup:
size limits:
```

### Isolation and Read/Write Boundary

```text
target project reads:
target project writes:
repository scans:
temporary writes:
network requests:
child processes:
```

### Validation

List exact test/E2E commands and results.

### Performance

Report phase timings and timeouts.

### PR 1–5 Non-Regression

Report each safeguard.

### Known Limitations

Only factual limitations.

### Deferred Findings

Keep deferred:

```text
AI vision scoring
blocking pixel diff until stable
multi-browser matrix
large responsive matrix
full accessibility audit
auto-correction
full compiler integration
parser metadata expansion
fs-trace redesign
atomic verdict writing
incremental refresh/cache
```

### Documentation Sync

Use `Documentation sync: clear.` or list stale docs.

### Git Status

Include `git status --short`. Do not commit.

## 58. Focused Implementation Decision

End with:

```text
PR 6 implementation: PASS / FAIL
Render failure can never green: YES / NO
Geometry checks deterministic: YES / NO
Target project isolation proven: YES / NO
Static verify non-regression: YES / NO
PR 6 ready for independent verification: YES / NO
```

Do not claim PR 6 officially closed until independent verification completes.

## 59. Definition of Done

Task is done only when SliceUI can explicitly mount and render a generated component in an isolated deterministic environment, measure evidence-backed geometry and computed styles, distinguish visual mismatch from build/mount/runtime failure, produce stable actionable diagnostics and bounded artifacts, avoid target mutation and external network dependence, preserve the fast static gate, pass all relevant tests, and become ready for independent PR 6 verification.

Begin by confirming checkpoint `2617638`, auditing every existing render/mount capability and dependency, and writing the architecture decision note. Do not add dependencies or modify source before the capability audit and dependency decision are complete.
