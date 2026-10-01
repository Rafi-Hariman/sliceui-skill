# SliceUI PR 6C Checkpoint Commit and Full PR 6 Closure Plan

## 1. Objective

Create exactly one clean checkpoint commit containing the complete, independently verified PR 6C implementation and formally close full PR 6 Rendered Visual Fidelity.

Repository:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Real target project, read-only reference only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Committed baseline before PR 6C:

```text
60a0835 feat(sliceui): add ambiguity-safe geometry verification
```

Preferred checkpoint commit message:

```text
feat(sliceui): complete rendered geometry verification
```

Do not push.

## 2. Required Closure State

The checkpoint is authorized only if the latest fresh-session independent re-verification records:

```text
Fresh-session re-verification: YES
PR 6C: PASS
PR 6C may close: YES
Corrective patch required: NO
Production selector integration active: YES
CLI/direct verdict parity: YES
Required absent border visual-fails: YES
Full-side border verification complete: YES
Required failure precedence correct: YES
Zero required evidence unverifiable: YES
Invalid map pre-browser: YES
Objective overflow coverage complete: YES
Selector maps locator-only and strict: YES
Screenshot lifecycle correct: YES
Diagnostics free of undefined detail: YES
PR 6A and PR 6B safeguards preserved: YES
Full PR 6 may close after checkpoint: YES
Next phase may start: YES
```

Latest verified test baseline:

```text
529 pass
0 fail
3 environment-gated skips
532 total
```

If the repository or report differs materially, stop and do not commit.

## 3. Authoritative Reports Gate

Confirm these historical reports exist and remain unchanged:

```text
docs/SLICEUI-PR6-VERIFICATION-REPORT.md
docs/SLICEUI-PR6B-VERIFICATION-REPORT.md
docs/SLICEUI-PR6C-VERIFICATION-REPORT.md
docs/SLICEUI-PR6C-FRESH-INDEPENDENT-VERIFICATION-REPORT.md
docs/SLICEUI-PR6C-FRESH-INDEPENDENT-REVERIFICATION-REPORT.md
```

Run:

```bash
for file in \
  docs/SLICEUI-PR6-VERIFICATION-REPORT.md \
  docs/SLICEUI-PR6B-VERIFICATION-REPORT.md \
  docs/SLICEUI-PR6C-VERIFICATION-REPORT.md \
  docs/SLICEUI-PR6C-FRESH-INDEPENDENT-VERIFICATION-REPORT.md \
  docs/SLICEUI-PR6C-FRESH-INDEPENDENT-REVERIFICATION-REPORT.md
do
  test -f "$file" || { echo "Missing: $file"; exit 1; }
  git status --short -- "$file"
  git ls-files -- "$file"
done
```

Interpretation:

- include new intended reports explicitly;
- keep earlier CONDITIONAL PASS reports as historical evidence;
- do not rewrite historical verdicts;
- include the final fresh re-verification report;
- stop if any report contains private data;
- stop if the final report is missing.

The closure chain must remain auditable:

```text
PR 6C implementation
→ self-verification conditional pass
→ corrective patch
→ fresh independent verification conditional pass
→ corrective patch
→ fresh independent re-verification pass
→ checkpoint commit
→ full PR 6 closure
```

## 4. Initial Git and Repository Audit

From the SliceUI repository root, run:

```bash
git status --short
git rev-parse HEAD
git log -12 --oneline
git diff --stat
git diff --name-only
git ls-files --others --exclude-standard
```

Confirm:

- `60a0835` is HEAD or a direct ancestor;
- PR 6C remains uncommitted;
- every modified and untracked path is known;
- no dependency or lockfile change exists;
- no unknown source, fixture, documentation, or report exists;
- no screenshot, browser profile, package tarball, temporary bundle, or generated `.sliceui` artifact is intended for commit;
- root prompt files remain excluded;
- root `tester.xml` remains excluded;
- no real-target file is present in the SliceUI commit scope.

Stop if any unknown change exists.

## 5. Working-Tree Classification

Classify every modified and untracked path into exactly one category:

```text
PR 6C source
PR 6C tests
PR 6C synthetic fixtures
PR 6C skill
PR 6C owning documentation
PR 6C status documentation
PR 6C verification report
historical PR 6 report
root planning prompt
root tester.xml containing private data
generated artifact
temporary file
unrelated
sensitive
```

Record the classification before staging.

Do not assume a path belongs merely because it appears in this plan. Inspect its actual diff.

## 6. Expected PR 6C Commit Scope

The expected product scope may include the following, subject to complete diff review.

### Source

```text
src/commands/verify.mjs
src/framework/angular/render-geometry.mjs
src/framework/angular/render-verify.mjs
src/framework/angular/selector-map.mjs
```

Include another source file only if the actual diff proves PR 6C ownership.

### Tests

```text
test/render-geometry.test.mjs
test/render-verify.test.mjs
test/selector-map.test.mjs
test/verify-root.test.mjs
```

Include `test/verify.test.mjs` only if actually changed for PR 6C.

### Synthetic fixtures

```text
test/fixtures/render-geometry/known-good/
test/fixtures/render-geometry/defect/
test/fixtures/render-geometry/structural/
```

Inspect every fixture recursively. Only generic synthetic data may be committed.

### Skill and active documentation

```text
skill/SKILL.md
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/status.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
```

### Verification reports

```text
docs/SLICEUI-PR6C-VERIFICATION-REPORT.md
docs/SLICEUI-PR6C-FRESH-INDEPENDENT-VERIFICATION-REPORT.md
docs/SLICEUI-PR6C-FRESH-INDEPENDENT-REVERIFICATION-REPORT.md
```

A report that is already tracked and unchanged does not need staging again. Record its status.

## 7. Explicit Exclusions

Never stage:

```text
SLICEUI-PR*.md
tester.xml
session handoff files created only for local continuity
screenshots and image outputs
browser profiles
render bundles
package tarballs
/tmp artifacts
generated .sliceui artifacts
real-target project files
credentials, tokens, or private data
unrelated files
```

Do not delete excluded files. Leave them untracked.

The PR 6C implementation plan, corrective prompts, decision note, and verification prompts are planning artifacts unless repository policy explicitly says otherwise. They are not product source and must remain excluded.

## 8. Privacy Gate

Root `tester.xml` contains private information and must remain untracked, unstaged, unread by automated tests, and absent from reports.

Run:

```bash
git status --short -- tester.xml
git ls-files -- tester.xml
rg -n "tester\.xml" src test docs skill package.json
```

Confirm:

- no product or test import exists;
- committed synthetic fixtures are independent;
- no private values are present in intended staged files;
- the final report refers to privacy only in redacted, non-identifying language.

Use the known privacy-pattern scan from prior verification without printing private values in the final response.

`FIX-001` for a pre-existing committed fixture remains a separate future task. Do not modify that fixture in this checkpoint.

## 9. Source Integrity Gate

Before staging, review the complete source diff relative to `60a0835`.

Confirm production behavior includes:

```text
bounded <component-stem>.map.json loading
selector-map validation before browser launch
zero map reads on static path
validated map passed into renderVerify
CLI/direct geometry parity
locator-only selector maps
strict recursive selector schema
objective overflow and clipping
required off-container and off-viewport checks
full-side width and color border checks
required positive-width border presence
required comparison failure precedence
zero required evidence unverifiable
runtime and invalid-input precedence
bounded diagnostics without undefined detail
screenshot lifecycle matching documentation
```

Search for suspicious regressions:

```bash
rg -n "els\[0\]|matches\[0\]|candidates\[0\]|detail.*undefined|selectorMap|geometry\.map|requiredFailure|requiredExecuted|border.*0|screenshot" \
  src/commands/verify.mjs \
  src/framework/angular
```

Every first-element access must occur only after uniqueness is established.

## 10. Production Selector Integration Gate

Confirm the committed diff proves:

```text
static-pass gate precedes selector-map loading
map path is deterministic and bounded
map read count is at most one per render
invalid map exits 2 before browser
missing-map behavior is documented
renderVerify receives selectorMap
structural checks execute through CLI
static verify reads no map and launches no browser
```

No recursive repository search or arbitrary map-path input may be introduced.

## 11. Border Gate

Confirm:

```text
expected width > 0 and actual width <= 0
→ visual-fail before tolerance
```

For uniform evidenced borders, verify all sides remain enforced:

```text
top
right
bottom
left
```

For each side:

- presence is required;
- width uses centralized tolerance after presence;
- color is compared only when the side is rendered;
- transparent zero-alpha color cannot create a false pass;
- divider facts remain side-specific;
- border style remains unsupported-no-evidence when absent from transcript/parser.

## 12. Verdict Precedence Gate

Confirm aggregation order preserves:

```text
runtime/setup failure
invalid input/map
required comparison failure
required mapping failure
zero required facts or zero executable evidence
required pass with optional warnings
clean pass
```

Required outcomes:

```text
required mismatch → visual-fail, exit 1
invalid map → invalid-input, exit 2
zero required evidence → unverifiable, exit 3
optional-only evidence → unverifiable, exit 3
runtime page error → runtime-fail
```

A required comparison failure must not be downgraded by the zero-required guard.

## 13. Overflow and Clipping Gate

Confirm the final code checks claimed objective defects:

```text
horizontal page/container overflow
vertical page/container overflow
required child outside mapped container
required mapped element outside viewport
horizontal required-content clipping
vertical required-content clipping
```

Policy remains:

```text
objective required defect → visual-fail
overflow:hidden without clipping → not failure
ellipsis without clipping → not failure
expected scroll intent → unsupported-no-evidence
valid truncation intent → unsupported-no-evidence
```

Selector maps must not encode semantic exceptions.

## 14. Selector-Map Strictness Gate

Confirm:

- root, mapping, and locator allowlists;
- unknown fields rejected;
- nested/array semantic fields rejected;
- casing and separator variants rejected;
- expected/actual/value fields rejected;
- script, URL, markup, and path-like unsafe payloads rejected;
- innocent valid selectors accepted;
- the indexed structure exposes locator and required status only.

## 15. Screenshot and Diagnostic Gate

Confirm active documentation and implementation agree:

```text
default successful render
→ temporary screenshot deleted

default visual failure
→ temporary evidence lifecycle follows documented bounded policy

preserve mode
→ documented artifact path remains
```

Normal output must not contain literal `undefined` for absent diagnostic detail.

Do not “clean up” these findings after independent verification unless source remains exactly the verified version.

## 16. NOEV and Scope Closure Gate

Confirm unsupported-no-evidence remains explicit for facts genuinely unavailable from parser/transcript, including as applicable:

```text
table row height
table cell padding
border style
non-evidenced alignment
expected-scroll intent
valid-truncation intent
```

NOEV must not:

- create expected values;
- count as pass;
- count as executed required evidence;
- force another geometry phase solely because facts do not exist.

No PR 6D should be declared necessary without a new explicit scope decision.

## 17. status.md and Documentation Closure Review

Before staging, verify `status.md` accurately states the pre-commit condition:

```text
PR 6A complete at 0394317
PR 6B complete at 60a0835
PR 6C independently verified but not yet checkpointed
Full PR 6 ready to close only after checkpoint
```

If `status.md` already declares PR 6C or full PR 6 complete before commit, stop and correct through the existing intended PR 6C documentation diff before staging.

After commit, the official final response may declare completion even if `status.md` uses a “ready for checkpoint” formulation. If repository policy requires status.md to contain the newly created commit hash, that would require a second documentation commit and violates the one-commit objective. Prefer status wording that does not require knowing its own future hash.

Confirm historical checkpoints:

```text
PR 4: a6fd181
PR 5: 2617638
PR 6A: 0394317
PR 6B: 60a0835
```

## 18. Artifact and Target Safety Audit

Run:

```bash
find . -maxdepth 4 -type d -name ".sliceui" -print
find . -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.webp" \) -print
```

Review results. Dependency-owned images and pre-existing ignored artifacts are not automatically blockers, but no generated PR 6C artifact may be staged.

Check the real target:

```bash
cd /Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
git status --short
git diff --name-only
```

The known pre-existing target modifications must remain unchanged and outside the SliceUI commit.

Return to the SliceUI repository before staging.

## 19. Source Hash Gate

Use the final fresh independent re-verification report to identify the verified source/test/doc hashes.

Recompute hashes for all in-scope implementation paths before staging.

Required:

```text
current hashes = fresh re-verification end hashes
```

If any implementation, test, fixture, documentation, status, or skill file changed after the fresh PASS, stop and rerun targeted independent verification before committing.

The only acceptable new working-tree change after the PASS is the final re-verification report itself.

## 20. Explicit Staging Only

Do not use:

```bash
git add .
git add -A
git add --all
```

Stage reviewed paths explicitly. A conceptual command is:

```bash
git add \
  src/commands/verify.mjs \
  src/framework/angular/render-geometry.mjs \
  src/framework/angular/render-verify.mjs \
  src/framework/angular/selector-map.mjs \
  test/render-geometry.test.mjs \
  test/render-verify.test.mjs \
  test/selector-map.test.mjs \
  test/verify-root.test.mjs \
  test/fixtures/render-geometry/known-good \
  test/fixtures/render-geometry/defect \
  test/fixtures/render-geometry/structural \
  skill/SKILL.md \
  docs/project-docs/development/api-contract.md \
  docs/project-docs/foundation/status.md \
  docs/project-docs/technical-guidelines/verify-gate-trust.md \
  docs/SLICEUI-PR6C-VERIFICATION-REPORT.md \
  docs/SLICEUI-PR6C-FRESH-INDEPENDENT-VERIFICATION-REPORT.md \
  docs/SLICEUI-PR6C-FRESH-INDEPENDENT-REVERIFICATION-REPORT.md
```

Adjust only after actual classification and diff review.

Do not stage an unchanged already-tracked report unnecessarily; explicit `git add` on it is harmless but record its status accurately.

## 21. Staged-Diff Validation

After staging, run:

```bash
git diff --cached --name-only
git diff --cached --stat
git diff --cached --check
git diff --cached
```

Review the complete staged diff.

Confirm:

- [ ] Every staged path belongs to PR 6C or its verification evidence.
- [ ] Final fresh re-verification report is included.
- [ ] Historical reports remain intact.
- [ ] No prompt file is staged.
- [ ] Root `tester.xml` is not staged.
- [ ] No private data is staged.
- [ ] No generated screenshot or `.sliceui` artifact is staged.
- [ ] No target-project file is staged.
- [ ] No dependency or lockfile change is staged.
- [ ] Production selector integration is present.
- [ ] Required border presence is present.
- [ ] Verdict precedence is correct.
- [ ] Zero-evidence guard remains correct.
- [ ] Objective overflow remains complete.
- [ ] Selector map remains strict and locator-only.
- [ ] Screenshot and diagnostic behavior match docs.
- [ ] NOEV limitations are honest.
- [ ] PR 6C is not overclaimed before checkpoint.
- [ ] No secret, credential, private path, or sensitive value is staged.

If any condition fails, unstage only the affected path non-destructively and stop. Do not partially commit.

## 22. Privacy, Secret, and Path Review

Run bounded checks over the staged diff:

```bash
git diff --cached | rg -n "Authorization|Bearer |api[_-]?key|password|secret|token=|BEGIN .*PRIVATE KEY"
```

Review hits manually. Clearly fake test values used to prove sanitization may be acceptable.

Run the prior known-private-value scan without copying values into the final response.

Review absolute paths:

```bash
git diff --cached | rg -n "/Users/|/tmp/|sliceui-render-verify"
```

Product diagnostics must not expose unnecessary local private paths. Documentation and tests may mention bounded temporary path patterns when intentional.

## 23. Validation Before Commit

Run syntax checks on every changed or new source/test file:

```bash
node --check src/commands/verify.mjs
node --check src/framework/angular/render-geometry.mjs
node --check src/framework/angular/render-verify.mjs
node --check src/framework/angular/selector-map.mjs
node --check test/render-geometry.test.mjs
node --check test/render-verify.test.mjs
node --check test/selector-map.test.mjs
node --check test/verify-root.test.mjs
```

Adjust for actual changed files.

Run focused tests:

```bash
node --test \
  test/render-geometry.test.mjs \
  test/render-verify.test.mjs \
  test/selector-map.test.mjs \
  test/verify.test.mjs \
  test/verify-root.test.mjs
```

Then run the full suite because this is the final closure checkpoint:

```bash
npm test
```

Expected latest verified baseline:

```text
529 pass
0 fail
3 environment-gated skips
532 total
```

If test counts legitimately differ, explain the exact delta. Do not commit on any unexpected failure or skip increase.

## 24. Optional Final Smoke Matrix

If the staged source hashes exactly match the independently verified hashes, do not rerun the entire adversarial verification. Run a narrow smoke matrix:

```text
CLI known-good structural fixture → pass, exit 0
CLI structural defect fixture → visual-fail, exit 1
invalid selector map → invalid-input, exit 2, no browser
zero required evidence → unverifiable, exit 3
required absent border → visual-fail, exit 1
static verify → no browser, no map read
```

Stop if any result differs from the fresh report.

## 25. Commit Message

Inspect repository convention:

```bash
git log -12 --oneline
```

Preferred message:

```text
feat(sliceui): complete rendered geometry verification
```

Create exactly one commit.

Do not:

- amend `60a0835`;
- squash prior checkpoints;
- create multiple PR 6C commits;
- create a separate “full PR 6 closure” commit unless the one-commit objective becomes impossible;
- push.

## 26. Commit Execution

After all gates and tests pass:

```bash
git commit -m "feat(sliceui): complete rendered geometry verification"
```

Do not bypass Git hooks. If a hook fails, stop and report it.

## 27. Post-Commit Validation

Run:

```bash
git status --short
git log -1 --oneline
git show --stat --oneline HEAD
git show --check HEAD
git diff HEAD^ HEAD --name-only
```

Confirm:

- the commit exists;
- message follows repository convention;
- committed files are complete and bounded;
- `git show --check` is clean;
- no PR 6C source, test, fixture, documentation, skill, status, or report remains modified/untracked;
- only root prompts and root `tester.xml` remain untracked;
- no push occurred.

## 28. Full PR 6 Closure Declaration

After a successful checkpoint, declare:

```text
PR 6A Render Foundation and Safety: COMPLETE
PR 6B Geometry Coverage: COMPLETE
PR 6C Complete Rendered Geometry Coverage: COMPLETE
Full PR 6 Rendered Visual Fidelity: COMPLETE
Fresh independent re-verification: PASS
Known blocking findings: NONE
Corrective patch required: NO
Push performed: NO
```

Also report the new PR 6C commit hash.

Do not claim unsupported parser facts were implemented. State that valid NOEV limitations remain accepted and non-blocking.

## 29. Final Product Readiness

After the checkpoint, SliceUI may be declared ready for normal slicing with:

```text
static workflow stable
rendered verification opt-in and independently verified
selector-map production integration active
geometry false-green protections active
target-project isolation preserved
network isolation preserved
product working tree clean apart from excluded local planning/private input files
```

Do not conflate this with resolving future non-blocking items such as:

```text
DIA-001/DIA-002 if still open
TYP-001 role granularity
FNT-001 stronger substitution detection
NOE-001 programmatic NOEV marker
FIX-001 private-fixture sanitization
parser metadata expansion
```

Only items still open after the final fresh report should be listed.

## 30. Follow-Up Boundary

After full PR 6 closure, recommended separate tasks are:

```text
FIX-001 privacy sanitization for the pre-existing fixture
small diagnostic wording cleanup if still open
fresh session handoff
roadmap reassessment before defining PR 7
```

Do not perform them in this checkpoint.

## 31. Failure Conditions

Do not commit if:

- the final fresh re-verification report is missing;
- the final verdict is not PASS;
- source hashes differ from independently verified hashes;
- unknown working-tree changes exist;
- a prompt or root `tester.xml` is staged;
- private data appears in staged files;
- generated artifacts or target files are staged;
- dependency/lockfile changes are unexplained;
- production selector integration is absent;
- CLI/direct parity is not proven;
- required absent borders can pass;
- required failures can become unverifiable;
- invalid map can launch browser;
- objective overflow regresses;
- tests or hooks fail;
- documentation or `status.md` materially overclaim state;
- secrets appear.

If blocked, do not partially commit. Report the exact blocker and recommended explicit staging list.

## 32. Required Final Response

### Entry Gate

```text
Fresh independent re-verification verdict:
PR 6C authorized to commit:
Full PR 6 authorized to close after checkpoint:
Corrective patch required:
Committed baseline:
```

### Report Gate

```text
Historical reports present:
Final fresh report present:
Report privacy scan:
Reports modified after verification:
```

### Working-Tree Audit

```text
Files classified:
Unknown changes:
Generated artifacts:
Root tester.xml staged:
Target project changed:
Source hashes match verified state:
```

### Checkpoint Commit

```text
Commit created: YES / NO
Commit hash:
Commit message:
Push performed: NO
```

### Files Committed

List every committed file grouped as:

```text
source
tests
synthetic fixtures
skill
documentation/status
verification reports
```

### Files Intentionally Excluded

List:

```text
all root-level SLICEUI-PR*.md files
root tester.xml
local-only temporary or planning artifacts
```

Do not print private data.

### Validation

```text
git diff --cached --check:
syntax checks:
focused tests:
full suite:
smoke matrix:
git show --check HEAD:
git log -1 --oneline:
```

### Official Closure

```text
PR 6A official status: COMPLETE
PR 6B official status: COMPLETE
PR 6C official status: COMPLETE / NOT COMPLETE
Full PR 6 official status: COMPLETE / INCOMPLETE
Fresh independent verification: PASS / NOT PASS
Known blocking findings:
Push performed: NO
SliceUI ready for normal slicing: YES / NO
```

### Accepted Limitations

List only verified, explicit, non-blocking NOEV or future-enhancement items.

### Final Git Status

Show exact output of:

```bash
git status --short
```

Do not push.

## 33. Documentation Sync Statement

After a clean commit, use:

```text
Documentation sync: clear.
```

only if active contracts, skill, and status all match the committed behavior and closure state.

If `status.md` deliberately says “ready to close after checkpoint” rather than “complete” to avoid a self-referential commit hash, explain that the checkpoint itself completes the transition and identify whether a later documentation-only update is actually necessary. Avoid creating needless second commits.

## 34. Definition of Done

The checkpoint-and-closure task is complete only when the exact independently verified PR 6C source, production selector integration, geometry comparison logic, aggregation precedence, selector-map enforcement, tests, synthetic fixtures, owning documentation, status, and verification reports are committed in one clean checkpoint; all root prompts, root `tester.xml`, private data, screenshots, generated artifacts, dependencies, target files, and unrelated changes remain excluded; Git and tests are clean; no push occurs; PR 6C is declared complete; full PR 6 Rendered Visual Fidelity is formally closed; accepted NOEV limitations remain honest; and SliceUI is ready for normal slicing again.

Start with the final-report gate, source-hash comparison, complete working-tree classification, and privacy audit. Do not stage anything until every path and closure condition has been verified.
