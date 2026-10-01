# SliceUI PR 6C Fresh-Session Independent Re-Verification Prompt

## 1. Assignment

Perform a genuinely independent, adversarial, read-only re-verification of the current uncommitted PR 6C implementation.

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

Primary verification procedure:

```text
SLICEUI-PR6C-FRESH-SESSION-INDEPENDENT-VERIFICATION-PROMPT.md
```

Historical reports:

```text
docs/SLICEUI-PR6C-VERIFICATION-REPORT.md
docs/SLICEUI-PR6C-FRESH-INDEPENDENT-VERIFICATION-REPORT.md
```

Treat historical reports as evidence of prior repository states and findings. Do not overwrite them, assume their findings are resolved, or inherit their expected verdict.

Reconstruct current behavior directly from source, tests, fixtures, active contracts, Git history, and runtime evidence.

## 2. Independence Disclosure

Start the report with:

```text
Fresh-session re-verification: YES / NO
Prior involvement in PR 6C implementation: YES / NO
Prior involvement in PR 6C corrective patches: YES / NO
Prior access to expected verdicts: YES / NO
Independence limitations:
```

If you implemented or corrected the current PR 6C tree, disclose that and do not claim a fully independent verdict.

## 3. Allowed Output

Create only:

```text
docs/SLICEUI-PR6C-FRESH-INDEPENDENT-REVERIFICATION-REPORT.md
```

Do not modify or overwrite either historical report.

Keep all temporary fixtures, browser profiles, screenshots, traces, copied projects, and generated artifacts under:

```text
/tmp/sliceui-pr6c-fresh-reverification-<timestamp>/
```

## 4. Strict Read-Only Rules

Do not:

- modify implementation source;
- modify tests or fixtures;
- modify active documentation, status, or skill files;
- modify prompts, decision notes, or historical reports;
- stage, commit, amend, squash, or push;
- install or update repository dependencies;
- use a global or PATH-resolved SliceUI binary;
- modify the real target project;
- import or quote root `tester.xml`;
- reproduce private data in logs or reports;
- fix findings during verification;
- assume any corrective-patch claim is true.

Use the repository CLI explicitly:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs ...
```

## 5. Initial Integrity Gate

Run:

```bash
git status --short
git rev-parse HEAD
git log -10 --oneline
node --version
npm --version
```

Verify:

- `60a0835` is HEAD or a direct ancestor;
- PR 6A and PR 6B are committed;
- PR 6C remains uncommitted;
- all modified and untracked paths are classified;
- root prompts and root `tester.xml` are known exclusions;
- no unknown change prevents reliable attribution;
- no unexpected dependency or lockfile change exists;
- the real target retains only known pre-existing modifications.

Hash all PR 6C source, tests, fixtures, active documentation, status, and skill files before verification. Repeat hashes at the end.

## 6. Authoritative Sources

Inspect at minimum:

```text
src/commands/verify.mjs
src/framework/angular/render-verify.mjs
src/framework/angular/render-geometry.mjs
src/framework/angular/selector-map.mjs
src/cli.mjs

test/verify-root.test.mjs
test/verify.test.mjs
test/render-verify.test.mjs
test/render-geometry.test.mjs
test/selector-map.test.mjs
test/fixtures/render-geometry/

docs/project-docs/development/api-contract.md
docs/project-docs/foundation/status.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
```

Also read the primary verification procedure and historical reports only after independently identifying the current production call chain and coverage matrix.

## 7. Priority Re-Verification Questions

Independently answer:

1. Does the production CLI load the correct selector map?
2. Is the selector map validated before browser launch?
3. Does production pass the validated map into `renderVerify`?
4. Do CLI and direct API paths produce equivalent geometry verdicts?
5. Does an absent required border fail regardless of numeric tolerance?
6. Are all evidenced uniform border sides enforced?
7. Do real required comparison failures outrank the zero-evidence guard?
8. Does genuinely absent required evidence remain unverifiable?
9. Are invalid maps rejected with exit `2` and zero browser launches?
10. Are successful temporary screenshots cleaned according to contract?
11. Are failure and preserve-mode screenshot lifecycles bounded and documented?
12. Are diagnostics free of literal `undefined` fields?
13. Are PR 6A and PR 6B safeguards preserved?
14. May PR 6C and full PR 6 close after checkpoint?

## 8. Production Selector-Map Integration

Reconstruct the complete shipped path:

```text
CLI arguments
→ static verification
→ static-pass gate
→ selector-map path resolution
→ file read and JSON parse
→ strict validation
→ renderVerify invocation
→ structural geometry checks
→ aggregation
→ process exit
```

Verify:

- map location is deterministic and bounded;
- no repository scan finds the map;
- map is read at most once per render invocation;
- static verify without `--render` reads no map;
- static failure short-circuits before map read and browser launch;
- missing-map behavior is documented and cannot falsely claim map-only coverage;
- invalid map is rejected before Playwright/browser/workspace creation;
- the map reaching geometry remains locator-only.

## 9. CLI Versus Direct API Parity

Use the same known-good and defect fixture through:

```text
A. node src/cli.mjs verify ... --render
B. direct renderVerify invocation with the same validated selector map
```

Compare:

```text
primary state
exit code or equivalent result
executed check IDs
mapping states
expected/actual values
warnings/failures
```

Required:

- known-good passes on both paths;
- structural defect visual-fails on both paths;
- mapped families appear on the CLI path;
- no production-only false pass remains.

Any CLI/direct verdict divergence is blocking.

## 10. Selector-Map Invalid-Input Path

Test:

```text
malformed JSON
unsupported version
unknown root field
unknown mapping field
unknown locator field
expected-value field
semantic exception field
case/separator variant
nested forbidden field
array-contained forbidden field
unsafe selector
path-like selector payload
```

Required:

```text
state: invalid-input
exit: 2
browser launches: 0
render workspaces: 0
screenshots: 0
stable SUI-RENDER-MAP diagnostic
```

Confirm innocent valid selectors are accepted.

## 11. Required Border Presence

For an evidenced required border with expected width greater than zero, test every uniform side:

```text
top
right
bottom
left
```

Required scenarios:

```text
all sides correct
all sides absent
each single side absent
each single side wrong width
each single side wrong color
multiple sides wrong
zero-width side with matching computed color
non-zero width at tolerance boundary
non-zero width just outside tolerance
transparent/alpha color
side-specific divider
```

Required contract:

```text
expected > 0 and actual <= 0
→ required-border-absent
→ visual-fail
```

Numeric tolerance applies only after positive rendered presence is established.

Computed color on a zero-width border must not produce a pass.

## 12. Verdict Precedence and Counters

Reconstruct actual counters and aggregation order.

At minimum identify:

```text
requiredFactCount
requiredMappedCount
requiredExecutedCount
requiredPassCount
requiredFailureCount
requiredMappingFailureCount
```

Verify a required comparison that executes and fails counts as executed evidence.

Test:

```text
required style failure with zero required passes
required geometry failure with optional passes
required mapping missing
required mapping ambiguous
zero required facts
required facts but zero executable evidence
only optional checks
required pass + optional warning
runtime failure + geometry result
invalid map
```

Required outcomes:

```text
required comparison failure → visual-fail, exit 1
required mapping failure → established non-green state
zero required facts → unverifiable, exit 3
zero executable required evidence → unverifiable, exit 3
optional-only evidence → unverifiable, exit 3
required pass + optional warning → pass
runtime/setup failure → outranks geometry
invalid map → invalid-input, exit 2
```

A concrete required failure must never be downgraded to unverifiable by a zero-pass guard.

## 13. Diagnostics

Verify normal output never contains:

```text
detail=undefined
detail: undefined
undefined
```

when an optional detail field is absent.

Inspect representative diagnostics for:

```text
selector-map failure
mapping ambiguity
border absence
border mismatch
gap/radius/overflow failure
required mismatch
unverifiable zero evidence
runtime/network failure
```

Diagnostics must remain bounded, deterministic, actionable, and privacy-safe.

## 14. Screenshot Lifecycle

Independently test:

### Default success

```text
screenshot captured/used
→ temporary screenshot deleted
```

### Default visual failure

Verify the documented contract exactly. If failure evidence is retained temporarily:

```text
path is bounded
path is reported safely
retention does not leak into repository
the policy matches active documentation
```

### Preserve mode

```text
--preserve-render-artifacts
→ exactly the documented screenshot remains
```

### Exception path

```text
browser/workspace cleanup still runs
artifact behavior matches contract
```

Count relevant files before and after each scenario. Do not rely only on source inspection.

## 15. Existing PR 6C Coverage

Reconstruct and dynamically test the currently claimed families:

```text
gap
border width/color
radius
letter spacing
font family and typography facts
overflow-x/overflow-y
off-container
off-viewport
required-content clipping
root padding
control height
line height
divider
text color/size/weight
```

Expected values must remain transcript/XML-derived. Selector maps remain locators only.

## 16. Unsupported-No-Evidence

Validate these claimed limitations independently:

```text
table row height
table cell padding
border style
non-evidenced alignment
expected-scroll intent
valid-truncation intent
```

Confirm:

- no defensible transcript/parser fact exists;
- no expected value is invented;
- NOEV remains visible;
- NOEV does not count as pass;
- NOEV does not count as executed required evidence;
- NOEV does not block an otherwise evidence-complete run;
- no available evidence is being hidden.

Do not require another geometry phase solely for absent parser facts.

## 17. Objective Overflow and Clipping

Through the production CLI path, test:

```text
horizontal overflow outside tolerance
vertical overflow outside tolerance
required child outside mapped container
required element outside viewport
horizontal content clipping
vertical content clipping
overflow:hidden without clipping
ellipsis without clipping
ellipsis with measurable required clipping
```

Required:

```text
objective required defect → visual-fail
overflow:hidden alone → not a failure
ellipsis alone → not a failure
expected-scroll/truncation intent → not invented
```

## 18. PR 6A Regression

Reproduce:

- static verify launches no browser;
- static failure short-circuits render;
- oversized viewport exits `2` before browser;
- network requests are blocked and sanitized;
- runtime page error is non-green;
- browser/workspace cleanup completes;
- package contract remains development-only;
- target project remains unchanged.

## 19. PR 6B Regression

Reproduce:

- required ambiguity is non-green;
- optional ambiguity is non-blocking;
- no silent first-pick;
- literal control height is required;
- outside-tolerance control mismatch blocks;
- zero required or zero executable evidence is unverifiable;
- root-padding, line-height, divider, and text-style checks remain correct.

## 20. Production-Path Determinism

Run at least three times:

```text
CLI known-good structural fixture
CLI structural defect fixture
CLI absent-border fixture
CLI required-comparison failure
CLI invalid selector map
```

Normalize timestamps and temporary paths only.

Assert stable:

```text
state
exit code
check IDs
selector-map load result
required counters
expected/actual values
diagnostic ordering
artifact result
```

Any intermittent verdict is blocking.

## 21. Performance and Boundedness

Measure:

```text
selector-map reads per render
browser launches
browser evaluations
known-good render median
defect render median
static verify median
```

Required:

```text
map reads <= 1 per render
map reads = 0 on static path
invalid map browser launches = 0
repository scans = 0
no material static regression
no unbounded waits or diagnostics
```

## 22. Target, Network, and Artifact Isolation

Trace known-good and defect runs.

Required:

```text
target writes = 0
repository scans = 0
network escapes = 0
npm installs = 0
temporary writes stay under /tmp
no generated repository artifact
browser/process cleanup complete
```

Confirm the real target retains only its known pre-existing changes.

## 23. Documentation and status.md

Audit:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/status.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
README.md
docs/SLICEUI-OVERVIEW.md
```

Confirm they accurately describe:

- selector-map production location and load timing;
- invalid map pre-browser exit `2`;
- static path does not read map;
- absent required border semantics;
- full-side width/color checks;
- required-failure precedence;
- zero-evidence unverifiable behavior;
- screenshot success/failure/preserve lifecycle;
- diagnostic-detail behavior;
- NOEV limitations;
- PR 6C remains uncommitted until this verification passes;
- full PR 6 is not officially complete before checkpoint.

Historical checkpoint references must be accurate:

```text
PR 4: a6fd181
PR 5: 2617638
PR 6A: 0394317
PR 6B: 60a0835
```

## 24. Test Quality Review

Audit whether tests genuinely cover:

```text
production CLI selector integration
CLI/direct parity
invalid-map no-browser path
static no-map-read path
absent required border
all four border sides
required-failure precedence
zero-evidence guard
diagnostic undefined suppression
screenshot lifecycle
browser-level overflow/clipping
three-run determinism
PR 6A/6B regressions
```

Flag helper-only tests where production or browser behavior is claimed.

## 25. Test Execution

Run actual relevant files, including at minimum:

```bash
node --test test/render-geometry.test.mjs
node --test test/render-verify.test.mjs
node --test test/selector-map.test.mjs
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
```

Run actual render mount/probe and Pilar mount tests.

Run a combined suite covering render, CLI verify/root, selector maps, static verify, snapshot/transcript, Pilar, referee, resolve, spec, and agent-context.

Then run:

```bash
npm test
```

Run `node --check` on all changed/new source and test files.

Record actual counts. Do not reuse previously reported totals.

## 26. Temporary E2E Matrix

Use:

```bash
TMP_ROOT="/tmp/sliceui-pr6c-fresh-reverification-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Run through the production CLI where applicable:

```text
known-good structural fixture
structural defect fixture
direct/CLI parity
invalid selector map
missing selector map
static verify without render
required border entirely absent
each uniform border side absent/wrong
border tolerance boundary
required style mismatch with zero required passes
all required mappings missing
zero required facts
only optional facts
required pass + optional warning
off-container element
off-viewport element
horizontal/vertical clipping
overflow:hidden without clipping
network attempt
runtime error
invalid viewport
default success screenshot cleanup
default failure screenshot lifecycle
preserve screenshot mode
```

Record:

```text
state
exit code
selector-map read count
browser launch count
mapping result
required counters
diagnostic IDs
expected/actual/delta/tolerance
artifact result
cleanup result
target mutation
```

## 27. Decision Rules

### PASS

Use only if:

- production selector integration is active and bounded;
- CLI/direct verdict parity holds;
- required absent borders fail;
- all evidenced border sides remain enforced;
- required comparison failures have correct precedence;
- zero required evidence remains unverifiable;
- invalid maps fail before browser launch;
- screenshot and diagnostic contracts are accurate;
- objective overflow coverage remains complete;
- selector maps remain locator-only and strict;
- NOEV dispositions remain valid;
- PR 6A and PR 6B safeguards remain intact;
- tests and full suite pass;
- target/privacy/isolation guarantees hold;
- no blocking finding remains.

### CONDITIONAL PASS

Use if a focused corrective patch is still required before checkpoint.

### FAIL

Use for a material false-green, production integration failure, fake oracle, selector-map safety breach, target mutation, non-deterministic verdict, or broad contract failure.

## 28. Full PR 6 Closure Rule

Full PR 6 may close after checkpoint only if:

```text
PR 6A complete
PR 6B complete
PR 6C fresh re-verification passes
all evidence-backed geometry is implemented
all absent facts have valid explicit NOEV dispositions
no blocking finding remains
```

A valid NOEV limitation does not require a PR 6D.

## 29. Finding Format

For each material finding include:

```text
ID
severity: Critical / High / Medium / Low / Informational
status
source evidence
runtime evidence
impact
required correction
blocks PR 6C closure: yes/no
blocks full PR 6 closure: yes/no
```

Suggested prefixes:

```text
IND
MAP
BOR
AGG
DIA
ISO
OVF
NOE
ORC
SAF
REG
TST
DOC
STA
PER
SCP
```

## 30. Report Output

Create only:

```text
docs/SLICEUI-PR6C-FRESH-INDEPENDENT-REVERIFICATION-REPORT.md
```

Required structure:

```markdown
# SliceUI PR 6C Fresh-Session Independent Re-Verification Report

## 0. Independence Disclosure
## 1. Executive Decision
## 2. Scope and Environment
## 3. Git and Source Integrity
## 4. Production Selector Integration
## 5. CLI and Direct API Parity
## 6. Selector-Map Invalid-Input Path
## 7. Required Border Presence
## 8. Verdict Precedence and Counters
## 9. Diagnostics
## 10. Screenshot Lifecycle
## 11. Existing Geometry Coverage
## 12. Unsupported-No-Evidence
## 13. Objective Overflow and Clipping
## 14. PR 6A Regression
## 15. PR 6B Regression
## 16. Browser Determinism
## 17. Performance and Boundedness
## 18. Target, Network, and Artifact Isolation
## 19. Documentation and status.md
## 20. Test Quality
## 21. Tests Re-run
## 22. E2E Matrix
## 23. Findings by Severity
## 24. Acceptance Checklist
## 25. Required Corrective Patch
## 26. Full PR 6 Closure Decision
## 27. Final Recommendation
## Appendix A. Commands
## Appendix B. Production-Path Results
## Appendix C. Border Matrix
## Appendix D. Aggregation Matrix
## Appendix E. Artifact Lifecycle
## Appendix F. Source Hashes and Git Status
```

## 31. Required Final Decision

Return:

```text
Fresh-session re-verification: YES / NO
PR 6C: PASS / CONDITIONAL PASS / FAIL
PR 6C may close: YES / NO
Corrective patch required: YES / NO
Production selector integration active: YES / NO
CLI/direct verdict parity: YES / NO
Required absent border visual-fails: YES / NO
Full-side border verification complete: YES / NO
Required failure precedence correct: YES / NO
Zero required evidence unverifiable: YES / NO
Invalid map pre-browser: YES / NO
Objective overflow coverage complete: YES / NO
Selector maps locator-only and strict: YES / NO
Screenshot lifecycle correct: YES / NO
Diagnostics free of undefined detail: YES / NO
PR 6A and PR 6B safeguards preserved: YES / NO
Full PR 6 may close after checkpoint: YES / NO
Next phase may start: YES / NO
```

## 32. End-of-Task Integrity

Before responding:

- repeat all source hashes and compare start/end;
- confirm source/tests/fixtures/docs/skill/status unchanged;
- confirm only the re-verification report was added;
- confirm root `tester.xml` remains unchanged and untracked;
- confirm no private data entered the report;
- inspect SliceUI and target Git status;
- confirm no screenshots, binaries, `.sliceui`, or temporary artifacts entered the repository;
- confirm all temporary data remains under `/tmp`;
- do not stage, commit, or push.

## 33. Definition of Done

The task is complete only when a fresh reviewer independently reconstructs and adversarially verifies the production selector-map call chain, CLI/direct parity, invalid-map pre-browser behavior, required border presence, full-side border enforcement, verdict precedence, zero-evidence guard, diagnostic output, screenshot lifecycle, existing PR 6C geometry checks, NOEV limitations, objective overflow, PR 6A and PR 6B safeguards, determinism, isolation, documentation, and tests; creates only the re-verification report; and returns an evidence-based decision on PR 6C checkpoint readiness and full PR 6 closure.

Begin with independence disclosure, source hashes, production call-chain reconstruction, and pre-existing working-tree classification. Do not assume any corrective-patch claim is resolved until reproduced independently.
