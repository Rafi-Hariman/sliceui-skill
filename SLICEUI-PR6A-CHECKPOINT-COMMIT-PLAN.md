# SliceUI PR 6A Checkpoint Commit Plan

Repository:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Real target project, read-only reference only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Official baseline before PR 6A:

```text
2617638 feat(sliceui): strengthen verify reliability and syntax safety
```

## 1. Objective

Create exactly one clean checkpoint commit containing the complete verified **PR 6A Render Foundation and Safety** implementation.

The checkpoint must include:

- the original PR 6A rendered-verification foundation;
- the RNS-001 corrective patch;
- the NET-001 corrective patch;
- the PKG-001 package-contract correction;
- the local RUN-001 runtime-state correction;
- PR 6A regression tests;
- synchronized skill and owning documentation;
- the independent PR 6 verification report.

The checkpoint must not claim that full PR 6 is complete.

Official status after a successful commit:

```text
PR 6A Render Foundation and Safety: COMPLETE
PR 6B Geometry Coverage: REQUIRED
Full PR 6: INCOMPLETE
```

Do not push.

## 2. Mandatory Entry Gate

Before staging anything, confirm the latest recorded results:

```text
PR 6A corrective patch: PASS
RNS-001: RESOLVED
NET-001: RESOLVED
PKG-001: RESOLVED
RUN-001: RESOLVED
FNT-001: DEFERRED
PR 6A may close: YES
PR 6B required: YES
Full PR 6 complete: NO
```

Confirm the latest full-suite result:

```text
468 tests
465 pass
3 pre-existing skips
0 fail
```

Confirm the focused re-verification proved:

```text
unsafe viewport rejected before browser launch
all tested render failures are deterministic and non-green
external requests actively blocked and sanitized
runtime page errors produce runtime-fail
packaged static verify remains usable
packaged --render produces fixture-unavailable exit 3
real target project remains unchanged
static verify remains browser-free
```

If any recorded condition differs from the current repository state, do not commit. Report the mismatch.

## 3. Initial Repository Audit

Run from the SliceUI repository root:

```bash
git status --short
git rev-parse HEAD
git log -10 --oneline
git diff --stat
git diff --name-only
git ls-files --others --exclude-standard
```

Confirm:

- `2617638` is the current committed baseline or direct ancestor;
- all modified implementation files belong to PR 6A;
- no unknown or unrelated modifications exist;
- no dependency or lockfile change exists unless explicitly justified by the verified PR 6A diff;
- all root-level `SLICEUI-PR*.md` files are planning artifacts and remain excluded;
- `tester.xml` remains excluded and untracked;
- no screenshot, browser profile, temporary bundle, or generated `.sliceui` file is present in the intended commit.

If an unknown or unrelated file is found, stop. Do not stage or commit.

## 4. Working-Tree Classification

Classify every modified and untracked file into exactly one category:

```text
PR 6A source
PR 6A tests
PR 6A skill
PR 6A owning documentation
PR 6 independent verification report
prompt/planning artifact
tester.xml
binary/render artifact
generated .sliceui artifact
temporary file
unrelated
sensitive
```

Record the classification before staging.

Do not assume any expected list is automatically correct. Compare every file against its actual diff and ownership.

## 5. Expected Commit Scope

The expected PR 6A product scope includes the following files, subject to actual diff review:

### Source

```text
src/framework/angular/render-verify.mjs
src/commands/verify.mjs
src/cli.mjs
```

### Tests

```text
test/render-verify.test.mjs
```

Include another test file only if it actually contains verified PR 6A coverage and no unrelated changes.

### Skill

```text
skill/SKILL.md
```

### Documentation

```text
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
```

Include `docs/project-docs/foundation/status.md` only if it was intentionally updated by PR 6A and accurately states:

```text
PR 6A complete
PR 6B required
full PR 6 incomplete
```

### Verification report

```text
docs/SLICEUI-PR6-VERIFICATION-REPORT.md
```

The report may remain a historical `CONDITIONAL PASS` record from before the corrective patch, consistent with the established PR 4 and PR 5 workflow. Do not rewrite the independent report merely to change its decision. The corrective-patch result and checkpoint closure provide the resolution chain.

## 6. Required Source Content Review

Before staging, inspect the source diff and confirm it contains the complete verified PR 6A behavior.

### Opt-in render foundation

Confirm:

```text
static verify remains the default
--render is explicit
Playwright is imported lazily or only on the render path
static verify launches no browser
static verification exit behavior remains unchanged
```

### Render failure boundary

Confirm:

```text
full render lifecycle is covered by deterministic error handling
phase-specific failure state is preserved
raw uncaught render crash is prevented
cleanup runs in finally or equivalent unconditional path
browser closes after failures
workspace cleanup follows policy
```

### Viewport safety

Confirm:

```text
minimum and maximum dimensions are enforced
99999x99999 is rejected before browser launch
invalid viewport maps to invalid-input and exit 2
no artifact is created for invalid viewport
```

### Network isolation

Confirm:

```text
request interception is installed before setContent/script injection
external HTTP/HTTPS/socket/file requests are blocked according to policy
allowed data/blob/about resources remain usable as documented
blocked request flips render result to non-green
network diagnostic is sanitized
queries, headers, cookies, and request bodies are not exposed
```

### Runtime safety

Confirm:

```text
pageerror/runtime exception produces runtime-fail
invalid runtime evidence is not trusted as pass
console evidence is bounded
```

### Package contract

Confirm:

```text
--render is labeled development-only or fixture-dependent
static verify remains public-package compatible
packaged render returns fixture-unavailable with exit 3
help and documentation do not promise packaged render availability
no automatic dependency installation is introduced
```

### Screenshot and artifacts

Confirm:

```text
screenshot role matches documentation
screenshot failure follows documented non-green policy
preserve path is bounded
normal temporary files are cleaned
no screenshot or binary artifact is tracked
```

## 7. PR 6B Exclusion Audit

Confirm that the staged PR 6A diff does not claim or implement full PR 6B Geometry Coverage.

The following remain required follow-up scope and must not be represented as complete:

```text
input/select/button heights
button proportions
major spacing gaps
table header height
table row height
table cell padding
table footer density
pagination geometry
relative alignment
overflow and clipping
remaining evidence-backed border/radius checks
remaining typography and line-height checks
```

It is acceptable that the current PR 6A foundation contains the already-verified bounded checks:

```text
root padding
divider thickness
text color
text size
text weight
```

Do not stage any unrelated experimental PR 6B implementation.

## 8. Files That Must Be Excluded

Do not stage any root-level file matching:

```text
SLICEUI-PR*.md
```

Do not stage:

```text
tester.xml
screenshots
PNG files
browser profiles
render bundles
/tmp artifacts
generated .sliceui artifacts
target-project files
package tarballs
temporary package-install directories
credentials or secrets
unrelated files
```

Do not delete excluded files. Leave them untracked.

## 9. Target and Artifact Safety Audit

Confirm there is no stray `.sliceui` directory in the SliceUI repository:

```bash
find . -maxdepth 3 -type d -name ".sliceui" -print
```

Confirm no binary render output exists in the repository:

```bash
find . -type f \( -name "*.png" -o -name "*.webp" -o -name "*.jpg" -o -name "*.jpeg" \) -print
```

Review any result before proceeding. Exclude all generated visual artifacts.

Record the real target project status:

```bash
cd /Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
git status --short
git diff --name-only
```

The three previously known `testingcomponent.*` modifications must remain unchanged and must never enter the SliceUI commit.

Return to the SliceUI repository before staging.

## 10. Explicit Staging Only

Stage only approved files by explicit path.

Do not use:

```bash
git add .
git add -A
git add --all
```

Use a command shaped like this, adjusted only after actual diff review:

```bash
git add \
  src/framework/angular/render-verify.mjs \
  src/commands/verify.mjs \
  src/cli.mjs \
  test/render-verify.test.mjs \
  skill/SKILL.md \
  docs/project-docs/development/api-contract.md \
  docs/project-docs/technical-guidelines/verify-gate-trust.md \
  docs/SLICEUI-PR6-VERIFICATION-REPORT.md
```

Add `docs/project-docs/foundation/status.md` only if its verified PR 6A status update exists and belongs to this patch.

## 11. Staged-Diff Validation

After staging, run:

```bash
git diff --cached --name-only
git diff --cached --stat
git diff --cached --check
git diff --cached
```

Review the complete staged diff.

Confirm all of the following:

- [ ] Every staged file belongs to PR 6A.
- [ ] RNS-001 is resolved.
- [ ] NET-001 is resolved.
- [ ] PKG-001 is resolved.
- [ ] RUN-001 is resolved.
- [ ] FNT-001 remains honestly deferred if not implemented.
- [ ] Unsafe viewports are rejected before browser launch.
- [ ] No render-stage exception can escape as an unclassified raw crash.
- [ ] External requests are blocked before content execution.
- [ ] Diagnostic sanitization excludes sensitive URL data.
- [ ] Runtime errors invalidate rendered evidence.
- [ ] Static verify remains browser-free.
- [ ] Package help clearly says development-only or fixture-dependent.
- [ ] PR 6B remains required.
- [ ] Full PR 6 is not declared complete.
- [ ] No root-level prompt file is staged.
- [ ] `tester.xml` is not staged.
- [ ] No screenshot or binary is staged.
- [ ] No `.sliceui` artifact is staged.
- [ ] No target-project file is staged.
- [ ] No unexpected dependency or lockfile change is staged.
- [ ] No credentials, tokens, private keys, or sensitive request data are staged.
- [ ] No inappropriate absolute private path is introduced into product output/docs.

If any condition fails, unstage only the affected path with a non-destructive command and stop. Do not use destructive Git commands.

## 12. Optional Secret and Path Review

Run bounded searches over the staged diff or staged files:

```bash
git diff --cached | rg -n "Authorization|Bearer |api[_-]?key|password|secret|token=|BEGIN .*PRIVATE KEY"
```

Review hits manually. Do not assume every occurrence is a secret; documentation may mention placeholders.

Review absolute path occurrences:

```bash
git diff --cached | rg -n "/Users/|/tmp/|sliceui-render-verify"
```

Allowed references must be intentional documentation, tests, or local-only artifact descriptions. Product diagnostics must not expose unnecessary private paths.

## 13. Validation Before Commit

Do not rerun the full suite only for ceremony if the verified source has not changed since the recorded focused re-verification. However, confirm the recorded evidence is still current.

At minimum run:

```bash
node --check \
  src/framework/angular/render-verify.mjs \
  src/commands/verify.mjs \
  src/cli.mjs \
  test/render-verify.test.mjs
```

Run focused tests:

```bash
node --test \
  test/render-verify.test.mjs \
  test/verify.test.mjs \
  test/verify-root.test.mjs
```

If any file changed after the last full-suite result, rerun:

```bash
npm test
```

Expected verified baseline:

```text
468 tests
465 pass
3 pre-existing skips
0 fail
```

Do not commit if focused tests fail or if a changed source invalidates the recorded full-suite result.

## 14. Commit Message

Inspect repository convention:

```bash
git log -10 --oneline
```

Use the repository’s Conventional Commit style.

Preferred message:

```text
feat(sliceui): add safe opt-in rendered verification
```

This message describes PR 6A without claiming all geometry coverage is complete.

Create exactly one commit.

Do not:

- amend `2617638`;
- squash prior checkpoints;
- create multiple PR 6A commits;
- push.

## 15. Commit Execution

After the staged diff and tests are clean:

```bash
git commit -m "feat(sliceui): add safe opt-in rendered verification"
```

If Git hooks fail, do not bypass them. Report the failure.

## 16. Post-Commit Validation

After commit, run:

```bash
git status --short
git log -1 --oneline
git show --stat --oneline HEAD
git show --check HEAD
git diff HEAD^ HEAD --name-only
```

Confirm:

- commit exists;
- message matches the chosen convention;
- committed file list is complete and bounded;
- `git show --check` is clean;
- only the intentionally excluded prompts and `tester.xml` remain untracked;
- no modified implementation, tests, skill, or documentation remain;
- no push occurred.

## 17. Official Closure State

After a clean commit, declare exactly:

```text
PR 6A Render Foundation and Safety: COMPLETE
RNS-001: RESOLVED
NET-001: RESOLVED
PKG-001: RESOLVED
RUN-001: RESOLVED
FNT-001: DEFERRED
PR 6B Geometry Coverage: REQUIRED
Full PR 6: INCOMPLETE
Push performed: NO
```

Do not state:

```text
PR 6 complete
Rendered Visual Fidelity complete
All visual geometry covered
```

## 18. PR 6B Follow-Up Boundary

Record, but do not implement, the required PR 6B scope:

```text
control heights
button proportions
major spacing gaps
table density
footer and pagination geometry
relative alignment
overflow and clipping
remaining border and radius coverage
remaining typography and line-height coverage
```

The next implementation task must have its own plan, tests, independent verification, and checkpoint.

## 19. Failure Conditions

Do not create the commit if:

- any unknown working-tree change exists;
- any staged file is unrelated;
- a root-level prompt is staged;
- `tester.xml` is staged;
- any screenshot or `.sliceui` artifact is staged;
- target-project files appear;
- dependency or lockfile changes are unexplained;
- RNS-001, NET-001, or PKG-001 fixes are missing from staged source;
- documentation still claims full public render availability;
- documentation claims full PR 6 completion;
- focused tests fail;
- Git hooks fail;
- secrets or sensitive request data appear in the staged diff.

If blocked, report the issue and provide the exact recommended staging list. Do not partially commit.

## 20. Required Final Response

### Entry Gate

```text
PR 6 independent verification decision:
PR 6A corrective patch decision:
RNS-001:
NET-001:
PKG-001:
RUN-001:
FNT-001:
PR 6A authorized to commit:
```

### Working-Tree Audit

```text
Files classified:
Unknown changes:
Generated artifacts found:
Target project status changed:
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
skill
documentation
verification report
```

### Files Intentionally Excluded

List:

```text
all root-level SLICEUI-PR*.md files
tester.xml
any other intentional local-only artifact
```

### Validation

Report:

```text
git diff --cached --check:
focused tests:
full suite, if rerun:
git show --check HEAD:
git log -1 --oneline:
```

### Closure Status

```text
PR 6A official status: COMPLETE / NOT COMPLETE
PR 6B required: YES / NO
Full PR 6 complete: NO
Next approved task:
```

### Final Git Status

Show the exact output of:

```bash
git status --short
```

Do not push.

## 21. Definition of Done

The checkpoint task is complete only when the full verified PR 6A implementation, corrective safety fixes, regression tests, owning documentation, skill update, and independent verification report are committed in one clean checkpoint; prompts, `tester.xml`, screenshots, generated artifacts, target-project files, and unrelated changes remain excluded; Git validation is clean; no push occurs; PR 6A is declared complete; and PR 6B Geometry Coverage remains explicitly required while full PR 6 remains incomplete.

Start with the complete working-tree audit. Do not stage anything until every modified and untracked file has been classified.
