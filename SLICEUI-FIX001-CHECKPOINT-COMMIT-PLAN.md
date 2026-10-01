# SliceUI FIX-001 Checkpoint Commit Plan

## 1. Objective

Create exactly one clean checkpoint commit containing the independently verified FIX-001 current-tree privacy sanitization.

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
decda3ad12fd7803f327ccefea42eceeed3ec2c3
feat(sliceui): complete rendered geometry verification
```

Preferred commit message:

```text
fix(fixtures): replace private test data with synthetic values
```

Create one commit only. Do not push.

## 2. Authorized Closure State

Proceed only if the independent privacy verification records:

```text
FIX-001 verification: PASS
Current fixture synthetic: YES
Known private values removed from active tracked content: YES
Private derived copies removed: YES
Structural equivalence preserved: YES
Semantic test meaning preserved: YES
Assertion strength preserved: YES
Privacy regression test safe: YES
Full suite: PASS
PR 6 regression: NONE
Target writes: 0
Ready for checkpoint commit: YES
History rewrite required for checkpoint: NO
Corrective patch required: NO
```

Latest verified candidate baseline:

```text
Focused fixture tests: 7 pass / 0 fail
Combined tests: 157 pass / 0 fail
PR 6 focused regression: 91 pass / 0 fail
Full suite: 530 pass / 0 fail / 3 environment-gated skips
Total: 533
```

If the report, source hashes, test counts, or repository state differs materially, stop and do not commit.

## 3. Verification Report Gate

Required report:

```text
docs/SLICEUI-FIX001-PRIVACY-VERIFICATION-REPORT.md
```

Run:

```bash
ls -l docs/SLICEUI-FIX001-PRIVACY-VERIFICATION-REPORT.md
git status --short -- docs/SLICEUI-FIX001-PRIVACY-VERIFICATION-REPORT.md
git ls-files -- docs/SLICEUI-FIX001-PRIVACY-VERIFICATION-REPORT.md
```

Confirm:

- the report exists;
- it records `PASS`;
- it contains no original private literals;
- it is unchanged since independent verification;
- it identifies the Git-history issue without reproducing private data;
- it does not claim history rewriting occurred;
- it recommends the current-tree checkpoint may proceed.

If the report is missing, modified after verification, or contains private data, stop.

## 4. Initial Repository Audit

From repository root, run:

```bash
git status --short
git rev-parse HEAD
git log -10 --oneline
git diff --stat
git diff --name-only
git ls-files --others --exclude-standard
```

Confirm:

- `decda3a` is HEAD or a direct ancestor;
- FIX-001 remains uncommitted;
- exactly the expected tracked paths changed;
- no source, dependency, lockfile, or unrelated fixture changed;
- root prompts and root `tester.xml` remain untracked exclusions;
- no generated artifact exists in the intended commit;
- no real-target file appears in the SliceUI scope.

Stop if any unknown tracked change exists.

## 5. Expected Commit Scope

The checkpoint should contain exactly these paths:

```text
test/fixtures/mahasiswa-tarif/raw.xml
test/mahasiswa-tarif.test.mjs
docs/SLICEUI-FIX001-PRIVACY-VERIFICATION-REPORT.md
```

Expected ownership:

```text
raw.xml
→ deterministic synthetic fixture values

test/mahasiswa-tarif.test.mjs
→ bounded privacy regression test without original private literals

privacy verification report
→ independent redacted evidence and checkpoint authorization
```

Do not add other files merely because they are related to privacy generally.

## 6. Mandatory Exclusions

Never stage:

```text
SLICEUI-*.md root planning and prompt files
tester.xml
temporary privacy scans
private-value fingerprint lists
baseline private fixture copies
sanitize scripts from /tmp
session handoff files
screenshots
.sliceui artifacts
browser profiles
package tarballs
real-target files
status.md
PR 6 source or tests
dependencies or lockfiles
unrelated documentation
```

Do not delete excluded files. Leave them untracked or outside the repository.

## 7. Source Hash Gate

Use the independent verification report's start/end hashes for:

```text
test/fixtures/mahasiswa-tarif/raw.xml
test/mahasiswa-tarif.test.mjs
```

Recompute:

```bash
shasum -a 256 \
  test/fixtures/mahasiswa-tarif/raw.xml \
  test/mahasiswa-tarif.test.mjs \
  docs/SLICEUI-FIX001-PRIVACY-VERIFICATION-REPORT.md
```

Required:

```text
fixture hash = independently verified end hash
privacy-test hash = independently verified end hash
report hash = unchanged since verification completion
```

If fixture or test changed after independent verification, stop and rerun targeted privacy verification.

## 8. Current-Tree Privacy Gate

Confirm the candidate tree contains no known private values outside the explicitly excluded root input.

Run the known-value scan from the verification workflow without printing the literals in the final response.

Scan active tracked paths:

```text
src/
test/
docs/
skill/
```

Exclude only:

```text
root tester.xml
Git object history
local temporary files outside repository
```

Review all matches manually and classify them as:

```text
synthetic value
unrelated generic phrase
path-only reference
false positive
true private-data copy
```

Any true private-data copy in current active tracked content blocks the commit.

## 9. Pattern Privacy Gate

Run bounded pattern scans for:

```text
email patterns
phone-like patterns
student/employee identifier patterns
account-like long digit sequences
institution-specific baseline labels
private-name fingerprints
```

Manually exclude:

```text
Figma coordinates
opacity values
hashes
node IDs
clearly synthetic reserved identifiers
known fake test tokens
```

Do not stage or preserve scan files containing original private literals.

## 10. Fixture Diff Review

Review the full fixture diff:

```bash
git diff -- test/fixtures/mahasiswa-tarif/raw.xml
```

Confirm:

- only intended private-data text leaves changed;
- no XML hierarchy changed;
- no node ID changed;
- no node ordering changed;
- no geometry changed;
- no style changed;
- no attributes changed except intended text values;
- no rows or columns were added or removed;
- identifier uniqueness and order remain intentional;
- duplicate financial-value case remains preserved;
- numeric formatting remains covered;
- replacement values are clearly fictional and deterministic;
- no broad formatting churn exists.

## 11. Privacy-Test Diff Review

Review:

```bash
git diff -- test/mahasiswa-tarif.test.mjs
```

Confirm:

- no prior assertion was removed;
- no assertion was weakened;
- no test was skipped;
- no timeout or retry was increased;
- no original private value is embedded;
- the test does not read `tester.xml`;
- the test is fixture-local and bounded;
- synthetic markers are checked safely;
- structural expectations remain meaningful;
- the test does not reject every ordinary number or generic organization word;
- the expected increase is one test and nine assertions, as independently verified.

## 12. Structural-Equivalence Gate

Reproduce or inspect the independent comparison showing:

```text
node count unchanged
node-type counts unchanged
ID sequence unchanged
ordering unchanged
non-text leaves unchanged
geometry unchanged
styles unchanged
relationships unchanged
control counts unchanged
resolveTranscript output unchanged after literal normalization
```

Expected difference scope:

```text
30 text leaves in the mock table only
0 non-string differences
```

Any additional structural difference blocks commit.

## 13. Assertion and Test-Count Gate

Confirm candidate test delta relative to `decda3a`:

```text
+1 test
+9 assertions
0 removed tests
0 weakened assertions
0 new skips
```

If current test counts differ, identify the exact cause before committing.

## 14. Git-History Boundary

This checkpoint sanitizes the current tree only.

Record:

```text
current candidate tree sanitized: YES
historical private values remain: YES
introduction commit identified: 5ea0013
origin/main history contains the old data: YES, according to independent verification
history rewrite performed: NO
history rewrite required for this checkpoint: NO
separate policy decision remains open: YES
```

Do not run:

```text
git filter-repo
git filter-branch
BFG Repo-Cleaner
git rebase --root
force push
```

Do not alter remotes, branches, tags, or historical commits.

## 15. Real Target Isolation

Run before staging:

```bash
cd /Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
git status --short
git diff --name-only
```

Confirm only the known three pre-existing `testingcomponent.*` edits remain and are unchanged.

Return to SliceUI repository.

Required:

```text
target writes = 0
```

## 16. Artifact Audit

Confirm no generated or private artifact is present in the intended commit:

```bash
find . -maxdepth 4 -type d -name ".sliceui" -print
find . -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.webp" \) -print
```

Review results carefully. Dependency assets are not automatically blockers, but no FIX-001-generated artifact may be staged.

Also confirm no backup files exist:

```bash
find test/fixtures/mahasiswa-tarif -maxdepth 2 -type f \
  \( -name "*.bak" -o -name "*.orig" -o -name "*backup*" -o -name "*before*" \) -print
```

## 17. Explicit Staging Only

Do not use:

```bash
git add .
git add -A
git add --all
```

Stage exactly:

```bash
git add \
  test/fixtures/mahasiswa-tarif/raw.xml \
  test/mahasiswa-tarif.test.mjs \
  docs/SLICEUI-FIX001-PRIVACY-VERIFICATION-REPORT.md
```

No other path is authorized.

## 18. Staged-Path Gate

Immediately run:

```bash
git diff --cached --name-only
```

Expected exact output set:

```text
docs/SLICEUI-FIX001-PRIVACY-VERIFICATION-REPORT.md
test/fixtures/mahasiswa-tarif/raw.xml
test/mahasiswa-tarif.test.mjs
```

Order may differ. The set must match exactly.

If any additional path is staged, unstage it non-destructively and stop for review.

## 19. Staged-Diff Validation

Run:

```bash
git diff --cached --stat
git diff --cached --check
git diff --cached
```

Review the complete staged diff.

Confirm:

- [ ] Exactly three authorized files are staged.
- [ ] Fixture contains synthetic data only.
- [ ] No original private literal appears.
- [ ] No private derived copy appears in the report.
- [ ] Report uses redacted categories.
- [ ] XML structure is preserved.
- [ ] Test assertion strength is preserved.
- [ ] No root prompt is staged.
- [ ] Root `tester.xml` is not staged.
- [ ] No temporary artifact is staged.
- [ ] No target file is staged.
- [ ] No dependency or lockfile is staged.
- [ ] No history-rewrite instruction is executed or implied.
- [ ] Report accurately says history remains affected.
- [ ] No secret, credential, or private absolute path is staged unnecessarily.

If any condition fails, do not partially commit.

## 20. Secret and Sensitive-Data Review

Run bounded scans on staged content:

```bash
git diff --cached | rg -n "Authorization|Bearer |api[_-]?key|password|secret|token=|BEGIN .*PRIVATE KEY"
```

Run the known private-value scan against the staged blob without printing results in the final response.

Review path leakage:

```bash
git diff --cached | rg -n "/Users/|/tmp/"
```

Documentation/report references to repository paths or redacted temporary patterns may be acceptable. Raw personal filesystem details should not be added unnecessarily.

## 21. Validation Before Commit

Run direct fixture test:

```bash
node --test test/mahasiswa-tarif.test.mjs
```

Expected:

```text
7 pass
0 fail
```

Run the relevant parser/transcript/resolve/spec/context combined suite discovered during implementation and verification.

Expected independently verified combined result:

```text
157 pass
0 fail
```

Run PR 6 focused regression:

```bash
node --test \
  test/render-geometry.test.mjs \
  test/render-verify.test.mjs \
  test/selector-map.test.mjs \
  test/verify-root.test.mjs
```

Expected:

```text
91 pass
0 fail
```

Run full suite:

```bash
npm test
```

Expected:

```text
533 total
530 pass
0 fail
3 environment-gated skips
```

Do not commit if failures occur, skips increase, or test count unexpectedly decreases.

## 22. Final Privacy Smoke Check

After tests, repeat:

- known-value scan over active tracked content;
- pattern scan over the three staged files;
- fixture parser validity;
- root `tester.xml` unstaged status;
- target unchanged status.

Tests must not regenerate private derived artifacts.

## 23. Commit Message

Use:

```text
fix(fixtures): replace private test data with synthetic values
```

Create exactly one commit.

Do not:

- amend `decda3a`;
- squash prior checkpoints;
- combine history rewrite;
- include DOC-001 wording cleanup;
- include other privacy-policy documentation;
- push.

## 24. Commit Execution

After all gates pass:

```bash
git commit -m "fix(fixtures): replace private test data with synthetic values"
```

Do not bypass Git hooks.

If a hook fails, stop and report the output. Do not retry with `--no-verify`.

## 25. Post-Commit Validation

Run:

```bash
git status --short
git log -1 --oneline
git show --stat --oneline HEAD
git show --check HEAD
git diff HEAD^ HEAD --name-only
```

Confirm:

- commit exists;
- message is exact or convention-equivalent;
- exactly three authorized files were committed;
- `git show --check` is clean;
- fixture/test/report no longer appear modified or untracked;
- only root prompts and root `tester.xml` remain untracked;
- no push occurred.

## 26. Official FIX-001 Closure State

After successful commit, declare:

```text
FIX-001 current-tree sanitization: COMPLETE
Independent privacy verification: PASS
Current tracked fixture synthetic: YES
Known private values in active tracked content: NONE
Structural and semantic equivalence: PRESERVED
Assertion strength: PRESERVED
PR 6 regression: NONE
Target writes: 0
History rewrite performed: NO
Historical privacy issue: OPEN POLICY DECISION
Push performed: NO
```

Report the new commit hash.

## 27. Accepted Non-Blocking Findings

Record without fixing in this checkpoint:

```text
HIS-001
→ historical commits and origin/main retain old private values
→ separate history-rewrite policy decision

SYN-001
→ identifier width changed from baseline
→ no consumer dependency; cosmetic follow-up only

TST-001
→ privacy guard calibrated to current synthetic width
→ revisit only if identifier format changes

DOC-001
→ status.md wording calls the fixture a real export
→ documentation-only follow-up; does not expose private literals
```

Do not claim these are resolved by the current-tree commit.

## 28. Push Boundary

Do not push automatically.

This is especially important because:

```text
origin/main historical state already retains the old private values
pushing the sanitization commit removes them only from the latest tree
pushing does not purge Git history
history policy remains unresolved
```

A separate push decision may consider whether to push the safe current-tree fix before deciding on history rewrite.

## 29. Follow-Up Decision Boundary

After checkpoint, separate tasks may include:

```text
history-rewrite policy assessment
DOC-001 one-line wording correction
SYN-001/TST-001 cosmetic alignment
final session handoff or memory update
remote push plan
```

Do not perform them here.

## 30. Failure Conditions

Do not commit if:

- independent report is missing or not PASS;
- fixture/test hashes differ from verified state;
- unknown tracked changes exist;
- more or fewer than three authorized files are staged;
- private data remains in active tracked content;
- report contains original private literals;
- root `tester.xml` or prompts are staged;
- fixture structure changed unexpectedly;
- assertions were weakened;
- test count decreases unexpectedly;
- failures or new skips occur;
- PR 6 regresses;
- target project changes;
- a temporary/private artifact is staged;
- Git hooks fail;
- secrets appear.

If blocked, do not partially commit. Report the exact blocker.

## 31. Required Final Response

### Entry Gate

```text
Independent privacy verification verdict:
FIX-001 authorized to commit:
Corrective patch required:
Baseline commit:
```

### Report and Hash Gate

```text
Verification report present:
Report privacy scan:
Fixture hash matches verified state:
Privacy-test hash matches verified state:
Report unchanged after verification:
```

### Working-Tree Audit

```text
Tracked files changed:
Unknown changes:
Root tester.xml staged:
Prompt files staged:
Generated/private artifacts:
Target project changed:
```

### Checkpoint Commit

```text
Commit created: YES / NO
Commit hash:
Commit message:
Push performed: NO
```

### Files Committed

Expected:

```text
test/fixtures/mahasiswa-tarif/raw.xml
test/mahasiswa-tarif.test.mjs
docs/SLICEUI-FIX001-PRIVACY-VERIFICATION-REPORT.md
```

### Validation

```text
git diff --cached --check:
fixture tests:
combined tests:
PR 6 regression:
full suite:
final privacy scan:
git show --check HEAD:
git log -1 --oneline:
```

### Official Closure

```text
FIX-001 current-tree status: COMPLETE / INCOMPLETE
Independent privacy verification: PASS / NOT PASS
Current tracked fixture synthetic: YES / NO
Private values in active tracked content: NONE / PRESENT
Structural equivalence: PRESERVED / REGRESSED
Assertion strength: PRESERVED / WEAKENED
PR 6 regression: NONE / FOUND
History rewrite performed: NO
Historical privacy issue: OPEN POLICY DECISION / RESOLVED
Push performed: NO
```

### Accepted Follow-Ups

List only verified non-blocking findings and policy decisions.

### Final Git Status

Show exact:

```bash
git status --short
```

Do not print private values. Do not push.

## 32. Documentation Sync

Use:

```text
Documentation sync: clear.
```

for this checkpoint because no existing owning privacy-policy document requires an update.

Record `DOC-001` as a separate low-severity wording follow-up rather than changing the independently verified tree before commit.

## 33. Definition of Done

The checkpoint task is complete only when the exact independently verified synthetic fixture, bounded privacy regression test, and redacted privacy verification report are the only committed files; the staged diff contains no private values, prompts, root `tester.xml`, temporary artifacts, dependencies, target files, or unrelated changes; structural and semantic fixture behavior remains preserved; focused, combined, PR 6, and full tests pass; Git checks are clean; no history rewrite or push occurs; FIX-001 current-tree sanitization is declared complete; and the historical privacy issue remains explicitly recorded as a separate policy decision.

Start with the report/hash gate, complete working-tree classification, current-tree privacy scan, and exact three-file staging audit. Do not stage anything until every condition is verified.
