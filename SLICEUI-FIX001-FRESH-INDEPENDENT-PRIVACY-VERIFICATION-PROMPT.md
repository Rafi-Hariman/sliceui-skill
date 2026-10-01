# SliceUI FIX-001 Fresh-Session Independent Privacy Verification Prompt

## 1. Assignment

Perform a genuinely independent, adversarial, read-only privacy verification of the current uncommitted FIX-001 fixture-sanitization patch.

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

Primary implementation plan:

```text
SLICEUI-FIX001-PRIVACY-FIXTURE-SANITIZATION-PLAN.md
```

Primary affected paths expected from the implementation summary, but subject to independent audit:

```text
test/fixtures/mahasiswa-tarif/raw.xml
test/mahasiswa-tarif.test.mjs
```

Reconstruct the fixture dependencies, private-data categories, synthetic replacements, structural invariants, and test behavior directly from the current tree and committed baseline.

Do not assume the sanitization is complete merely because tests pass or the implementation summary says so.

## 2. Independence Disclosure

Begin the report with:

```text
Fresh-session verification: YES / NO
Prior involvement in FIX-001 implementation: YES / NO
Prior access to implementation conclusions or expected verdicts: YES / NO
Independence limitations:
```

If you implemented the current FIX-001 patch or selected its replacement values, disclose that fact and do not claim full independence.

## 3. Verification Objective

Determine whether the current-tree fixture sanitization:

1. Removes private or personal-looking data from active tracked content.
2. Uses clearly synthetic, deterministic replacements.
3. Preserves the fixture's structural and semantic test meaning.
4. Preserves assertion strength.
5. Avoids unrelated source, snapshot, documentation, or fixture changes.
6. Preserves PR 6 and the full test suite.
7. Leaves root `tester.xml` excluded and untouched.
8. Leaves the real target project unchanged.
9. Is ready for a separate checkpoint commit without requiring Git-history rewriting.

## 4. Allowed Output

Create only:

```text
docs/SLICEUI-FIX001-PRIVACY-VERIFICATION-REPORT.md
```

If repository policy or the user explicitly requires an untracked response-only report instead, do not create another file. For this task, default to creating the report above.

Do not modify or overwrite any PR 6 verification report.

All temporary inspection data, parser outputs, normalized comparisons, and privacy-scan records must remain under:

```text
/tmp/sliceui-fix001-independent-verification-<timestamp>/
```

## 5. Strict Read-Only Rules

Do not:

- modify the fixture;
- modify tests, source, documentation, or skill files;
- modify prompts or prior reports;
- stage, commit, amend, squash, or push;
- install or update dependencies;
- modify the real target project;
- import, sanitize, stage, or quote root `tester.xml`;
- print original private values in the report or final response;
- create a committed denylist containing original private literals;
- upload fixture content to any external service;
- use network-based data transformation or validation;
- rewrite Git history;
- fix findings during verification.

Use redacted categories in all reporting:

```text
[PERSON_NAME]
[STUDENT_ID]
[FACULTY_ORGANIZATION_NAME]
[PROGRAM_OR_SCHEME_LABEL]
[FINANCIAL_AMOUNT]
```

## 6. Initial Integrity Gate

Run:

```bash
git status --short
git rev-parse HEAD
git log -10 --oneline
node --version
npm --version
```

Confirm:

- `decda3a` is HEAD or a direct ancestor;
- full PR 6 is committed;
- FIX-001 remains uncommitted;
- every modified and untracked path is classified;
- only expected FIX-001 tracked files were changed;
- root prompts and root `tester.xml` are known exclusions;
- no dependency or lockfile changes exist;
- no unknown path prevents reliable attribution;
- the target project retains only known pre-existing changes.

Hash all changed FIX-001 files before verification. Repeat the hashes at the end.

Stop if unknown modifications prevent a reliable review.

## 7. Changed-File Scope Audit

Compare the current tree against `decda3a`:

```bash
git diff --name-only decda3a
git diff --stat decda3a
git diff -- test/fixtures/mahasiswa-tarif/raw.xml test/mahasiswa-tarif.test.mjs
```

Classify every hunk as:

```text
private-value replacement
synthetic marker or privacy test
structural fixture change
assertion change
format-only change
unrelated change
```

Expected minimal scope:

```text
test/fixtures/mahasiswa-tarif/raw.xml
test/mahasiswa-tarif.test.mjs
```

Any unrelated tracked modification is a finding.

## 8. Dependency Reconstruction

Independently identify all direct and indirect consumers:

```bash
rg -n "mahasiswa-tarif|test/fixtures/mahasiswa-tarif|raw\.xml" \
  src test docs skill package.json
```

Audit:

```text
fixture parser tests
transcript extraction tests
resolve tests
spec tests
agent-context tests
snapshot/fidelity tests
CLI tests
documentation examples
verification reports
fixture indexes or scripts
```

For each consumer record:

```text
path
owner
direct or indirect dependency
literal-value dependency
structural dependency
format dependency
ordering dependency
relationship dependency
snapshot dependency
```

Do not rely on the implementation summary's dependency list without reproducing it.

## 9. Privacy Category Audit

Inspect the baseline fixture and candidate fixture locally without reproducing the original values in the report.

Classify original sensitive fields by category only:

```text
personal names
student or employee identifiers
faculty or organization labels
program or scheme labels
financial amounts
other contextual identifiers
```

For each category determine:

```text
count in baseline
count in candidate
test-relevant properties
replacement pattern
remaining risk
```

The report must not contain the original private literals.

## 10. Synthetic Replacement Quality

Verify replacements are:

```text
clearly fictional
deterministic
non-random
non-time-based
non-identifying
format preserving
relationship preserving
order preserving where required
unique or duplicated intentionally
```

Review specifically:

- names are obviously generic and not copied from real individuals;
- identifiers preserve required length and character class;
- identifiers are deterministic and reserved-looking;
- organization/faculty labels are generic where literal identity is not tested;
- program/scheme labels preserve parser-relevant patterns;
- amounts preserve grouping and duplicate-value edge cases without retaining original values;
- no replacement accidentally resembles a credential, phone number, government ID, account number, or real contact detail.

## 11. Structural Equivalence

Parse baseline and candidate fixture using the project's own parser in isolated temporary locations.

Compare after redacting or normalizing intentionally changed text leaves:

```text
XML validity
parsed top-level schema
node count
node type counts
node ID sequence
node ordering
attribute names
non-text leaf values
parent-child relationships
component relationships
geometry and positions
styles
visibility
input/button/icon/image counts
null and empty cases
numeric types
```

Required outcome:

```text
Only intentionally sanitized text leaves differ.
```

Any geometry, style, ID, ordering, node-count, relationship, or non-text difference is a material finding unless independently justified.

## 12. Text-Leaf Difference Audit

Produce a bounded local comparison of changed leaves.

For every differing leaf record only:

```text
redacted category
node or cell position
baseline type/format
candidate type/format
property preserved yes/no
```

Do not put baseline private values in the report.

Confirm all changed leaves belong to the intended mock table or other explicitly affected private-data region.

## 13. Semantic Test-Meaning Preservation

Determine what the fixture is testing.

Verify preservation of:

```text
multi-row structure
column count
unique names/identifiers where required
intentional duplicate amounts
identifier length
numeric text formatting
program-label pattern
ordering and sorting behavior
transcript extraction behavior
resolve/spec/context behavior
```

Check whether generalized faculty/institution labels affect:

```text
taxonomy
sorting
classification
component resolution
semantic mapping
layout or geometry assertions
```

If the labels are identity-only, generalization is acceptable. If any consumer depends on their literal semantics, record a finding.

## 14. Assertion-Strength Review

Review every change to `test/mahasiswa-tarif.test.mjs`.

Confirm:

- no existing assertion was removed;
- no exact assertion was weakened to a broad truthiness check;
- no test was skipped;
- no timeout or retry was increased to mask a failure;
- no private literal was copied into the new test;
- the privacy test is bounded and behavior-focused;
- the privacy test does not classify every eight-digit string or every number as private;
- the test does not read root `tester.xml`;
- the test verifies synthetic markers and relevant structural invariants safely.

Any assertion weakening is at least a Medium finding and may block closure.

## 15. Privacy Regression-Test Safety

Inspect the new privacy test for false-positive and false-negative risks.

It should not:

```text
embed original private values
use a brittle list of personal names
reject all ordinary organization words
reject all long numbers globally
scan unrelated repository paths
read untracked files
perform network requests
```

It may safely verify:

```text
approved synthetic marker presence
expected deterministic identifier pattern
expected row and column structure
known generic labels
fixture-local absence of prohibited categories using non-reconstructive fingerprints
```

If the test merely checks a comment or one marker while other private values could remain, record a test-quality finding.

## 16. Derived-Copy Audit

Search active tracked content for baseline private-value fingerprints locally, without printing them:

```text
src/
test/
docs/
skill/
```

Inspect potential copies in:

```text
snapshots
expected JSON
Markdown outputs
transcripts
resolved artifacts
spec fixtures
agent-context fixtures
verification reports
test descriptions
comments
```

Classify every match:

```text
true private-data copy
candidate synthetic value
unrelated generic phrase
false positive
path-only reference
```

Required outcome:

```text
No active tracked private derived copy remains.
```

Root `tester.xml` is an explicitly excluded local input and is not part of the expected-clean set.

## 17. Pattern-Based Privacy Scan

Run bounded pattern scans for:

```text
email addresses
phone-number-like values
student or employee identifier patterns
account-like digit sequences
private names identified during local audit
institution-specific labels from the baseline fixture
```

Manually review every match.

Do not classify:

```text
Figma coordinates
opacity decimals
hashes
fixture node IDs
generic synthetic IDs
known fake test tokens
```

as private without contextual evidence.

The final report should provide counts and classifications, not literal private values.

## 18. Documentation and Report Privacy

Inspect active documentation and verification reports for:

```text
literal names
literal identifiers
literal financial values
copied organization context
raw fixture excerpts
```

Path-only references to the fixture are acceptable.

Historical reports must not be modified unless they contain active private data. If they do, stop and report the issue rather than rewriting history silently.

## 19. Root tester.xml Boundary

Confirm:

```text
root tester.xml remains untracked
root tester.xml hash unchanged
tests do not import it
source does not read it
verification does not copy its contents
report does not quote its values
```

FIX-001 sanitizes the committed fixture only. Root `tester.xml` remains a separate local private input.

## 20. Git-History Boundary

Independently confirm whether the original private values remain in historical commits.

Do not print those values.

Report:

```text
private values removed from current candidate tree: YES / NO
private values remain in Git history: YES / NO / NOT FULLY AUDITED
introduction commit identified: YES / NO
history rewrite performed: NO
history rewrite required for current-tree checkpoint: YES / NO
policy decision still required: YES / NO
```

Do not run history-rewrite commands.

A current-tree sanitization checkpoint does not require history rewriting unless repository policy explicitly demands historical purge before any new commit.

## 21. Baseline and Candidate Test Execution

Run direct consumers and relevant combined tests.

At minimum:

```bash
node --test test/mahasiswa-tarif.test.mjs
```

Discover and run actual parser, resolve, spec, agent-context, transcript, snapshot, referee, and fidelity tests that consume or could regress from the fixture.

Then run:

```bash
npm test
```

Also run the focused PR 6 suites to confirm no unrelated regression.

Record actual counts. Do not reuse implementation-reported totals without rerunning.

Expected candidate delta, subject to independent reproduction:

```text
one new privacy test
no new failures
no new skips
```

## 22. Test-Count and Skip Analysis

Compare baseline and candidate:

```text
total tests
passes
failures
skips
skip reasons
```

Verify any count increase is explained by the privacy regression test only.

Any unexpected skip, removed test, reduced assertion count, or broad snapshot update is a finding.

## 23. PR 6 Regression

Run focused PR 6 tests, including actual files for:

```text
render geometry
render verify
selector maps
verify root/CLI
```

Confirm FIX-001 does not modify or regress:

```text
selector-map integration
geometry verification
overflow and clipping
border presence
verdict precedence
network isolation
target isolation
screenshot lifecycle
```

No PR 6 source change is expected.

## 24. Target and Environment Isolation

Before and after verification, record:

```bash
cd /Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
git status --short
git diff --name-only
```

Required:

```text
target writes = 0
target pre-existing changes unchanged
repository scans = bounded to stated paths
network use = 0
npm installs = 0
temporary files confined to /tmp
```

## 25. Temporary-Data Cleanup

At the end, remove temporary copies containing baseline private data and private-value fingerprint lists.

You may retain only privacy-safe artifacts such as:

```text
hash files
redacted structural comparison
commands log without private literals
```

Confirm no temporary private content was copied into the repository.

## 26. Decision Rules

### PASS

Use only if:

- current active fixture contains synthetic data only;
- all known private values are absent from active tracked content;
- synthetic replacements are deterministic and clearly fictional;
- structure and semantic test meaning are preserved;
- only intended text leaves changed;
- assertions remain equally strong or stronger;
- privacy regression test is safe and bounded;
- no private derived copy remains;
- focused and full suites pass without new skips;
- PR 6 remains green;
- target writes remain zero;
- root `tester.xml` remains excluded;
- no unrelated tracked change exists.

### CONDITIONAL PASS

Use when sanitization is fundamentally correct but a focused correction is required before checkpoint, such as:

```text
one overlooked derived copy
one unsafe synthetic identifier
one incorrect or weak privacy assertion
one unexpected structural difference
```

### FAIL

Use when:

- private data remains in active tracked content;
- replacements are plausibly real or identifying;
- structure or semantic behavior changed materially;
- assertions were weakened;
- the test copies original private values;
- target project was modified;
- broad unrelated changes were introduced;
- full suite or direct consumers regress.

## 27. Required Decisions

Return:

```text
FIX-001 verification: PASS / CONDITIONAL PASS / FAIL
Current fixture synthetic: YES / NO
Known private values removed from active tracked content: YES / NO
Private derived copies removed: YES / NO
Structural equivalence preserved: YES / NO
Semantic test meaning preserved: YES / NO
Assertion strength preserved: YES / NO
Privacy regression test safe: YES / NO
Full suite: PASS / FAIL
PR 6 regression: NONE / FOUND
Target writes: 0 / NONZERO
Ready for checkpoint commit: YES / NO
History rewrite required for checkpoint: YES / NO
Corrective patch required: YES / NO
```

## 28. Finding Format

For each material finding include:

```text
ID
severity: Critical / High / Medium / Low / Informational
status
redacted evidence category
path and line/symbol
runtime or parser evidence
impact
required correction
blocks FIX-001 checkpoint: yes/no
history-only or current-tree: history/current
```

Suggested prefixes:

```text
PRV privacy
SYN synthetic-data quality
STR structural equivalence
SEM semantic equivalence
AST assertion strength
TST test quality
DRV derived copy
HIS Git history
ISO target/temp isolation
REG regression
DOC documentation
SCP scope
```

Do not include private literals in findings.

## 29. Verification Report

Create only:

```text
docs/SLICEUI-FIX001-PRIVACY-VERIFICATION-REPORT.md
```

Required structure:

```markdown
# SliceUI FIX-001 Privacy Verification Report

## 0. Independence Disclosure
## 1. Executive Decision
## 2. Scope and Environment
## 3. Git and Source Integrity
## 4. Fixture Dependency Audit
## 5. Privacy Category Audit
## 6. Synthetic Replacement Quality
## 7. Structural Equivalence
## 8. Semantic Test-Meaning Preservation
## 9. Assertion-Strength Review
## 10. Privacy Regression-Test Safety
## 11. Derived-Copy Audit
## 12. Pattern-Based Privacy Scan
## 13. Documentation and Report Privacy
## 14. Root tester.xml Boundary
## 15. Git-History Boundary
## 16. Focused Test Results
## 17. Full-Suite Results
## 18. PR 6 Non-Regression
## 19. Target and Temporary Isolation
## 20. Findings by Severity
## 21. Acceptance Checklist
## 22. Required Corrective Patch
## 23. Checkpoint Recommendation
## 24. Final Recommendation
## Appendix A. Commands Executed
## Appendix B. Redacted Difference Matrix
## Appendix C. Structural Comparison
## Appendix D. Privacy-Scan Classification
## Appendix E. Source Hashes and Git Status
```

## 30. End-of-Task Integrity

Before final response:

- repeat hashes for the fixture and privacy test;
- confirm hashes are identical to start-of-verification values;
- confirm no implementation/test/fixture/doc file was changed;
- confirm only the verification report was added;
- confirm root `tester.xml` remains unchanged and untracked;
- confirm no private values appear in the report;
- confirm temporary private copies were deleted;
- inspect SliceUI and target `git status --short`;
- confirm no generated artifacts entered the repository;
- do not stage, commit, or push.

## 31. Required Final Response

### Independence

```text
Fresh-session verification:
Prior implementation involvement:
Independence limitations:
```

### Decision

```text
FIX-001 verification:
Current fixture synthetic:
Known private values removed from active tracked content:
Private derived copies removed:
Structural equivalence preserved:
Semantic test meaning preserved:
Assertion strength preserved:
Privacy regression test safe:
Full suite:
PR 6 regression:
Target writes:
Ready for checkpoint commit:
History rewrite required for checkpoint:
Corrective patch required:
```

### Core Evidence

Summarize without private literals:

```text
changed leaf count and categories
node/schema equivalence
relationship and ordering equivalence
synthetic replacement properties
derived-copy scan
pattern-scan classifications
test-count delta
isolation results
```

### Blocking Findings

List or `None`.

### Non-Blocking Findings

List factual future policy decisions, including historical purge if applicable.

### History Decision

State clearly:

```text
current-tree sanitization status
historical-commit status
whether history rewrite is needed for this checkpoint
whether a separate policy decision remains open
```

### Report

```text
docs/SLICEUI-FIX001-PRIVACY-VERIFICATION-REPORT.md
```

### Git Status

Show exact SliceUI and target status without reproducing private values.

Do not modify implementation, stage, commit, or push.

## 32. Definition of Done

Independent verification is complete only when a fresh reviewer proves or disproves current-tree privacy sanitization, synthetic-data quality, structural and semantic equivalence, assertion strength, privacy-test safety, derived-copy removal, pattern-scan cleanliness, full-suite and PR 6 non-regression, target isolation, root-private-input exclusion, and the Git-history boundary; creates only the redacted privacy verification report; and returns an evidence-based decision on FIX-001 checkpoint readiness without exposing private literals or rewriting history.

Begin with the independence disclosure, Git/source hashes, changed-file scope audit, fixture dependency reconstruction, and redacted privacy-category inventory. Do not assume the implementation summary is correct.
