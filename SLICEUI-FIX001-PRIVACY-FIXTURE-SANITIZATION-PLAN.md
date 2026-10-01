# SliceUI FIX-001 Plan: Privacy-Safe Fixture Sanitization

## 1. Objective

Sanitize the pre-existing committed fixture that contains personal or personal-looking data, while preserving the exact structural and semantic behavior required by SliceUI tests.

Repository:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Primary affected fixture:

```text
test/fixtures/mahasiswa-tarif/raw.xml
```

Current product checkpoint:

```text
decda3ad12fd7803f327ccefea42eceeed3ec2c3
feat(sliceui): complete rendered geometry verification
```

This task is a dedicated privacy and fixture-maintenance change. It must not modify rendered-verification architecture, PR 6 behavior, selector-map contracts, geometry coverage, or the real target project.

Preferred commit message after independent verification:

```text
fix(fixtures): replace private test data with synthetic values
```

Do not push unless explicitly requested as a separate task.

## 2. Problem Statement

A pre-existing fixture contains literal values that represent or resemble private information, including possible:

```text
personal names
student or employee identifiers
faculty or institution labels
financial amounts or account-like values
other contextual personal attributes
```

Even when used only for tests, committed private data may be copied through:

```text
Git history
repository clones
test snapshots
expected outputs
diagnostics
logs
generated artifacts
documentation
reports
```

The current fixture must be replaced with synthetic values while retaining all test-relevant structure and edge cases.

## 3. Scope

FIX-001 includes:

```text
audit of the affected fixture
audit of every source/test/snapshot/doc reference to its literal values
classification of test-relevant fixture properties
design of synthetic replacements
fixture sanitization
updates to dependent expected outputs only where necessary
privacy scan of active repository content
focused tests
full test suite
independent verification readiness
checkpoint commit plan after verification
```

## 4. Explicitly Out of Scope

Do not perform:

```text
Git history rewrite
force push
remote branch modification
repository-wide architecture refactoring
parser redesign
rendered-verification changes
PR 6 source changes unless a direct privacy leak is proven
new fixture framework
new dependency installation
real target project modification
root tester.xml sanitization or commit
unrelated documentation cleanup
prompt-file cleanup
```

Rewriting Git history is a separate high-impact decision requiring explicit approval.

## 5. Mandatory Entry Gate

Before modifying any file:

1. Confirm the current checkpoint:

```bash
git rev-parse HEAD
git log -1 --oneline
```

Expected baseline:

```text
decda3a feat(sliceui): complete rendered geometry verification
```

2. Record the complete working tree:

```bash
git status --short
git diff --name-only
git ls-files --others --exclude-standard
```

3. Confirm expected local exclusions:

```text
root SLICEUI-PR*.md prompts
root tester.xml
```

4. Confirm the real target project remains outside scope and unchanged beyond its known pre-existing edits.

5. Run the current focused fixture/parser tests and full suite before edits.

6. Stop if any unknown source, test, fixture, documentation, dependency, or lockfile change exists.

7. Do not stage, commit, or push during implementation.

## 6. Privacy Handling Rules

During this task:

```text
do not repeat private literal values in the final response
do not copy private values into new prompts or reports
do not place private values in temporary filenames
do not add private values to shell history intentionally
do not include raw fixture content in documentation
do not upload the fixture to external services
do not use network-based transformation tools
```

Temporary inspection output must remain local and bounded.

When reporting findings, use redacted categories such as:

```text
[PERSON_NAME]
[STUDENT_ID]
[FACULTY_NAME]
[FINANCIAL_AMOUNT]
```

## 7. Fixture Dependency Audit

Identify every direct and indirect consumer of the affected fixture.

Run bounded searches:

```bash
rg -n "mahasiswa-tarif|test/fixtures/mahasiswa-tarif|raw\.xml" \
  src test docs skill package.json
```

Search for known literal values from the fixture locally, but do not print them in the final report.

Audit these dependency categories:

```text
unit tests
integration tests
parser tests
snapshot tests
expected JSON outputs
expected Markdown outputs
CLI tests
verification reports
documentation examples
fixture indexes
scripts
```

For every consumer record:

```text
path
test or runtime owner
which fixture properties are asserted
whether literal values are asserted
whether ordering matters
whether string length matters
whether numeric formatting matters
whether duplicates matter
whether special characters matter
whether generated snapshots depend on exact text
```

## 8. Test-Relevant Property Inventory

Before replacing values, identify what each original value tests.

Classify every potentially private field by test purpose:

```text
identity only
format validation
string length
numeric parsing
currency formatting
sorting
uniqueness
duplicate detection
relationship/join key
nullability
special characters
Unicode handling
whitespace behavior
case sensitivity
transcript extraction
layout or geometry
snapshot stability
```

Do not replace a value until its test-relevant properties are understood.

Example:

```text
Original field category: student identifier
Test-relevant properties: eight digits, unique, string-preserved leading zero
Synthetic replacement: eight-digit non-real reserved test value
```

## 9. Synthetic Data Design

Create replacements that are clearly fictional and deterministic.

Recommended patterns:

```text
Person names:
  Mahasiswa Contoh A
  Mahasiswa Contoh B

Identifiers:
  00000001
  00000002

Faculty/institution:
  Fakultas Contoh
  Program Studi Contoh

Financial values:
  deterministic synthetic amounts that preserve numeric format and edge cases

Addresses or contacts, if present:
  omit when not structurally required
  otherwise use clearly reserved examples
```

Rules:

1. Do not use names of real people.
2. Do not use plausible government, student, employee, account, or phone identifiers accidentally assigned to real individuals.
3. Preserve required length and character classes.
4. Preserve uniqueness and duplicate relationships intentionally.
5. Preserve sorting order when tests depend on it.
6. Preserve Unicode or punctuation cases only when they test behavior.
7. Preserve financial decimal/grouping behavior without preserving real amounts.
8. Use deterministic values, never randomness or timestamps.
9. Document the synthetic schema in a short fixture-local comment only if comments are supported and do not affect parser behavior.

## 10. Structural Preservation Contract

The sanitized fixture must preserve all required non-private structure:

```text
XML element hierarchy
attribute names
node ordering
required node counts
relationship keys
required duplicates
null/empty cases
numeric field types
format edge cases
parser-relevant whitespace
namespace behavior
encoding
line endings where snapshot-sensitive
```

Do not reformat the entire fixture unless formatting itself is irrelevant and the repository convention requires it.

Prefer targeted value replacement.

## 11. Literal-Dependency Analysis

For every test that asserts a literal value, decide whether the assertion verifies:

```text
parser correctness
business semantics
fixture identity
accidental fixture content
```

Update expected values only when the assertion legitimately depends on fixture content.

Do not weaken assertions merely to avoid updates.

Examples of unsafe weakening:

```text
replace exact expected name with any-string matcher
remove identifier assertion
reduce full expected object to truthiness
skip snapshot update review
```

Preferred approach:

```text
replace original private literal with exact synthetic literal
preserve the original assertion strength
```

## 12. Snapshot and Generated Artifact Audit

Search for derived content:

```bash
find test -type f \( -name "*.snap" -o -name "*.json" -o -name "*.md" -o -name "*.txt" \) -print
```

Use local private-value scans to identify copied values in:

```text
snapshots
expected outputs
transcripts
resolved artifacts
spec fixtures
agent-context fixtures
verification reports
```

If derived tracked files contain the same private values:

1. Confirm they are generated from the fixture or intentionally expected.
2. Replace them with matching synthetic values.
3. Preserve ordering and schema.
4. Review every changed line manually.

Do not regenerate broad unrelated snapshots.

## 13. Source-Code Privacy Audit

Search source and tests for embedded literals originating from the fixture.

Confirm no private fixture value is hard-coded in:

```text
source constants
test descriptions
assertion messages
diagnostic fixtures
comments
documentation
verification reports
```

When a test description currently includes a private literal, replace it with a generic behavior-focused description.

## 14. Implementation Rules

Make the smallest possible change.

Preferred change order:

```text
1. Sanitize raw.xml values.
2. Update exact dependent expectations.
3. Update snapshots only where directly derived.
4. Add privacy regression tests only if needed.
5. Update fixture documentation only when ownership or synthetic status is unclear.
```

Do not refactor parser code unless sanitization reveals an actual parser dependency that cannot be preserved through fixture values.

## 15. Privacy Regression Test

Add a focused privacy regression test if the repository has an appropriate fixture-test owner.

The test should verify bounded properties such as:

```text
fixture exists
fixture parses successfully
fixture contains approved synthetic markers
fixture does not contain known prohibited private-value fingerprints
fixture preserves required node counts and relationships
```

Do not create a brittle broad scanner that fails on ordinary words.

Do not embed the full original private values in the test merely to prove absence. Use safe fingerprints only when they cannot reconstruct the value, or keep the known-value scan as a verification command outside committed tests.

## 16. Repository Privacy Scan

Run two scan classes.

### Known-value scan

Use the already identified private literals locally across tracked active content:

```text
src/
test/
docs/
skill/
```

Do not include root `tester.xml` in the expected-clean result because it remains an explicitly excluded local private input.

### Pattern scan

Search for suspicious categories:

```text
student ID patterns
account-like long digit sequences
email patterns
phone patterns
private person-name literals identified during audit
```

Pattern matches require manual review. Do not automatically classify all numbers as private.

Record:

```text
path
match category
true positive / synthetic / false positive
required action
```

## 17. Git History Decision Boundary

This task sanitizes the current tree only.

After current-tree sanitization, report:

```text
Private values removed from current HEAD candidate: YES / NO
Private values remain in historical commits: YES / NO / NOT AUDITED
History rewrite recommended: YES / NO / REQUIRES POLICY DECISION
```

Do not run:

```text
git filter-repo
git filter-branch
BFG Repo-Cleaner
force push
history rewrite
```

History rewriting requires a separate approved plan covering remote coordination, backups, branch protection, tags, releases, forks, and clone resynchronization.

## 18. Documentation Impact

Update documentation only if it owns fixture privacy or test-data rules.

Potential minimal documentation:

```text
test fixtures must use synthetic data
private user-provided inputs must remain untracked
fixtures must preserve test semantics after sanitization
```

Do not add broad privacy policy documents unless the repository has a clear owner for them.

If no documentation update is required, state:

```text
Documentation sync: clear.
```

## 19. PR 6 Non-Regression Boundary

FIX-001 must not modify or regress:

```text
rendered geometry verification
selector-map production integration
network isolation
target isolation
static verify
render error boundaries
verdict precedence
screenshot lifecycle
geometry fixtures unrelated to mahasiswa-tarif
```

Any PR 6 source modification requires explicit justification and independent verification. The expected FIX-001 patch should normally not touch PR 6 source.

## 20. Target Project Isolation

Before and after changes, record:

```bash
cd /Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
git status --short
git diff --name-only
```

The known pre-existing target changes must remain byte-identical.

FIX-001 must perform zero target writes.

## 21. Baseline Validation

Before editing, run the narrowest relevant tests discovered in the dependency audit.

At minimum identify and run:

```text
fixture parser tests
transcript extraction tests
snapshot tests consuming mahasiswa-tarif
resolve/spec/context tests consuming the fixture
```

Then run:

```bash
npm test
```

Record exact counts before changes.

Expected prior full-suite baseline from PR 6 closure:

```text
529 pass
0 fail
3 environment-gated skips
532 total
```

If the current baseline differs, explain before proceeding.

## 22. Post-Change Validation

After sanitization:

1. Run syntax checks on every changed source/test file.
2. Run all direct fixture consumers.
3. Run parser/transcript/snapshot tests.
4. Run the relevant combined suite.
5. Run full `npm test`.
6. Compare test counts and skip reasons.
7. Re-run repository privacy scans.
8. Confirm target status unchanged.
9. Confirm no generated artifacts remain in the repository.

No unexpected test weakening, skip increase, or snapshot churn is acceptable.

## 23. Semantic Equivalence Review

Compare pre-change and post-change behavior after normalizing intentionally replaced literals.

Verify equality of:

```text
parsed object shape
node counts
field presence
relationship graph
sort order
null/empty behavior
numeric types
currency formatting behavior
diagnostics/check IDs
exit states
snapshot structure
```

Only deliberately synthetic values may differ.

Create a bounded comparison report under `/tmp`, not in the repository, unless repository policy requires a tracked verification report.

## 24. Temporary Files and Artifacts

Store temporary transformations and comparison outputs under:

```text
/tmp/sliceui-fix001-<timestamp>/
```

Do not leave:

```text
backup copies of raw.xml
private-value dumps
transformation scripts containing private literals
screenshots
parser outputs
.sliceui artifacts
```

inside the repository.

Delete temporary private-content copies at the end when no longer required for verification.

## 25. Security and Secret Review

Run a staged or intended-diff review for:

```text
credentials
access tokens
private keys
passwords
session data
personal identifiers
private names
financial records
absolute private paths
```

Do not confuse clearly synthetic placeholders with real credentials, but inspect every match.

## 26. Required Tests Checklist

### Fixture safety

- [ ] Fixture contains only approved synthetic values.
- [ ] No private names remain.
- [ ] No private identifiers remain.
- [ ] No copied organization/faculty private context remains unless generic.
- [ ] No private financial values remain.
- [ ] Root `tester.xml` remains untouched and untracked.

### Structural fidelity

- [ ] XML remains valid.
- [ ] Parser output schema is unchanged.
- [ ] Required node counts are unchanged.
- [ ] Relationships and join keys remain valid.
- [ ] Duplicate/unique cases remain intentional.
- [ ] Numeric formatting behavior remains covered.
- [ ] Unicode or special-character cases remain covered where needed.

### Dependency updates

- [ ] Every literal-dependent assertion is updated exactly.
- [ ] No assertion is weakened unnecessarily.
- [ ] Snapshots are reviewed line by line.
- [ ] No unrelated snapshot changes exist.
- [ ] Documentation examples do not retain private values.

### Regression

- [ ] Direct fixture consumers pass.
- [ ] Parser/transcript tests pass.
- [ ] Resolve/spec/context tests pass if applicable.
- [ ] Full suite passes.
- [ ] PR 6 tests remain green.
- [ ] Target writes remain zero.

### Privacy

- [ ] Known-value repository scan is clean outside excluded local input.
- [ ] Pattern scan reviewed manually.
- [ ] No private data appears in diff.
- [ ] No private data appears in generated artifacts.
- [ ] No private data appears in the final report.

## 27. Independent Verification Requirement

Do not commit immediately after implementation.

A fresh or independent reviewer must verify:

```text
fixture privacy
synthetic-value quality
structural equivalence
assertion strength
snapshot changes
repository scan results
full-suite regression
target isolation
```

The reviewer must not modify implementation files.

If a tracked verification report is appropriate, create:

```text
docs/SLICEUI-FIX001-PRIVACY-VERIFICATION-REPORT.md
```

Otherwise provide an explicit final verification response before the checkpoint commit task.

## 28. Commit Boundary

After independent verification passes, create a separate checkpoint task.

Expected commit scope should be limited to:

```text
test/fixtures/mahasiswa-tarif/raw.xml
exact dependent snapshots/expected outputs
focused privacy regression test if added
minimal owning fixture documentation if required
privacy verification report if repository workflow requires it
```

Preferred commit message:

```text
fix(fixtures): replace private test data with synthetic values
```

Do not mix PR 6 source, diagnostic cleanup, prompt files, `tester.xml`, or unrelated work.

## 29. Git Safety Rules

Never run:

```text
git reset --hard
git clean -fd
git checkout -- .
git restore .
git filter-repo
git filter-branch
force push
npm update
auto-format whole repository
```

Do not stage during implementation or verification.

Do not delete root prompts or root `tester.xml`.

Do not commit or push in this task.

## 30. Work Sequence

### Phase 1: Entry gate and dependency audit

- confirm checkpoint;
- classify working tree;
- identify all fixture consumers;
- run baseline tests;
- inventory private fields and test-relevant properties.

### Phase 2: Synthetic schema design

Before editing, state:

```text
field category
test-relevant properties
synthetic replacement strategy
assertions/snapshots affected
structural invariants
```

Do not print original private values in the note.

### Phase 3: Minimal sanitization

- replace fixture values only;
- preserve XML structure and ordering;
- update exact expected literals;
- avoid broad formatting churn.

### Phase 4: Derived-output cleanup

- sanitize tracked snapshots and expected outputs;
- review every diff;
- preserve assertion strength.

### Phase 5: Privacy and semantic verification

- known-value scan;
- pattern scan;
- semantic equivalence comparison;
- direct consumer tests;
- combined tests;
- full suite.

### Phase 6: Documentation and final audit

- update minimal owning docs if needed;
- confirm root private input excluded;
- confirm target unchanged;
- report history-rewrite boundary;
- prepare for independent verification.

## 31. Required Final Response

### Entry Gate

```text
Baseline commit:
Working tree known:
Unknown changes:
Baseline focused tests:
Baseline full suite:
Target project status:
```

### Privacy Finding Summary

Use categories only:

```text
private field categories found:
derived copies found:
source/test literal dependencies found:
reports/docs affected:
```

Do not print private values.

### Dependency Audit

List every affected tracked file grouped as:

```text
fixture
tests
snapshots/expected outputs
documentation
reports
```

### Synthetic Replacement Strategy

For each category report:

```text
test-relevant properties preserved
synthetic format
relationship preservation
assertion impact
```

### Files Changed

Group:

```text
fixture
tests
snapshots/expected outputs
documentation
verification report
```

List excluded root prompts and root `tester.xml` separately.

### Semantic Equivalence

Report:

```text
XML validity:
parsed schema:
node counts:
relationships:
sort order:
numeric behavior:
snapshot structure:
unexpected differences:
```

### Privacy Validation

```text
known-value scan:
pattern scan:
private values in current candidate tree:
private values in root excluded input:
history status:
```

### Test Validation

```text
focused tests:
combined tests:
full suite:
skip delta:
PR 6 regression:
```

### Isolation

```text
target reads:
target writes:
repository scans:
network use:
temporary files:
```

### Decision

```text
FIX-001 implementation: PASS / FAIL
Current-tree fixture sanitized: YES / NO
Structural test meaning preserved: YES / NO
Private derived copies removed: YES / NO
Assertion strength preserved: YES / NO
Independent privacy verification required: YES
Ready for independent verification: YES / NO
History rewrite performed: NO
Push performed: NO
```

### Documentation Sync

Use:

```text
Documentation sync: clear.
```

or list exact stale owners.

### Git Status

Show exact:

```bash
git status --short
```

Do not stage, commit, or push.

## 32. Acceptance Criteria

FIX-001 implementation is ready for independent verification only when:

- [ ] Current fixture contains synthetic data only.
- [ ] No known private value remains in active tracked content.
- [ ] Root `tester.xml` remains excluded.
- [ ] XML remains valid.
- [ ] Parser behavior remains equivalent after literal normalization.
- [ ] Node counts and relationships remain stable.
- [ ] Numeric and formatting edge cases remain covered.
- [ ] Literal-dependent expectations are updated exactly.
- [ ] Assertions are not weakened.
- [ ] Snapshot changes are minimal and reviewed.
- [ ] No unrelated source or fixture changes exist.
- [ ] Focused tests pass.
- [ ] Full suite passes without new skips.
- [ ] PR 6 remains green.
- [ ] Target writes remain zero.
- [ ] Privacy scans are clean outside explicitly excluded local input.
- [ ] No Git history rewrite occurred.
- [ ] Documentation is synchronized.
- [ ] Ready for independent privacy verification.

## 33. Definition of Done

The FIX-001 implementation task is complete only when the affected committed fixture and every active derived copy use deterministic synthetic values; all test-relevant structural, formatting, relationship, and edge-case properties remain intact; no assertion is weakened; privacy scans are clean outside explicitly excluded local input; focused and full test suites pass; PR 6 remains unaffected; the real target project is unchanged; no history rewrite, commit, or push occurs; and the patch is ready for independent privacy verification followed by its own checkpoint commit.

Begin with the dependency audit and test-relevant property inventory. Do not modify the fixture until every literal dependency and structural invariant has been identified.
