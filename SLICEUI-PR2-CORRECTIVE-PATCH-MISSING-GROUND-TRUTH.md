# SliceUI PR 2 Corrective Patch: Restore Missing-Ground-Truth Safety

Repository:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Project target read-only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Dokumen wajib dibaca:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
SLICEUI-PR2-SNAPSHOT-DEDUPLICATION-PROMPT.md
```

## 1. Entry Gate

Baca laporan verifikasi PR 2 dan pastikan keputusan aktual adalah:

```text
PR 2: FAIL
PR 3 may start: NO
```

Pastikan blocker yang akan diperbaiki adalah:

```text
VER-001 Critical: ketika conventions.json dan legacy project-context tidak tersedia,
loadConventionsSnapshot mengembalikan objek kosong yang truthy. Verify kemudian
menganggap ground truth tersedia, melewati checks sebagai skip, dan exit 0.
```

Jika laporan berbeda secara material, hentikan dan laporkan mismatch. Jangan mengubah source.

## 2. Tujuan

Implementasikan corrective patch terkecil untuk memulihkan invariant:

> Verify tanpa ground truth yang dibutuhkan tidak pernah boleh green.

Target:

```text
No canonical conventions
+ no legacy conventions
→ source = "none"
→ conventions = null
→ verify menampilkan NO GROUND TRUTH / NOT VERIFIABLE
→ exit code non-zero
```

Pertahankan:

- canonical ownership PR 2;
- snapshot deduplication;
- legacy compatibility;
- output resolve/spec/agent-context;
- command arguments;
- no repository-scan fallback.

## 3. Scope Diizinkan

Ubah hanya yang diperlukan untuk:

- explicit missing state pada `loadConventionsSnapshot`;
- consumer minimal yang harus menangani `conventions: null`;
- missing-ground-truth gate pada verify;
- diagnostic dan exit status;
- regression tests loader dan CLI verify;
- owning API-contract documentation jika kontraknya berubah;
- focused re-verification.

## 4. Di Luar Scope

Jangan mengimplementasikan:

- PR 3 referee cold/hot separation atau `--deep`;
- command refresh;
- conventions-body conflict redesign;
- fs-trace redesign;
- PascalCase verify normalization;
- resolve provenance/confidence;
- visual/render verification;
- perubahan agent context PR 1;
- perubahan capability/style recipes;
- repository scan fallback;
- dependency baru;
- unrelated refactor, cleanup, atau formatting;
- commit Git.

`CNF-001` tetap deferred kecuali diperlukan langsung untuk memastikan missing state aman.

## 5. Wajib Reproduce Sebelum Fix

Sebelum coding:

1. Buat temporary fixture di luar repository.
2. Sediakan minimal component yang dapat ditemukan verify.
3. Buat `.sliceui/` kosong tanpa `conventions.json` dan tanpa `project-context.json`.
4. Gunakan entrypoint repository secara eksplisit, bukan global binary.

```bash
TMP_ROOT="/tmp/sliceui-pr2-corrective-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs verify <component-dir> <kebab-case-name>
```

Catat:

```text
exact command
stdout
stderr
exit code
skip/fail count
success/green wording
```

Jangan mengubah source sebelum false green berhasil direproduksi. Jika tidak reproducible, hentikan dan investigasi mismatch tanpa coding.

## 6. Root-Cause Audit

Audit minimal:

```text
src/lib/snapshot.mjs
src/commands/verify.mjs
src/framework/angular/verify.mjs
src/lib/referee.mjs
test/snapshot.test.mjs
test/verify.test.mjs
test/verify-root.test.mjs
```

Temukan dengan bukti:

- return shape `loadConventionsSnapshot` untuk canonical, legacy, mixed, malformed, missing;
- bagaimana `hasGroundTruth` dihitung;
- di mana output green atau unverifiable ditentukan;
- exit-code convention existing;
- checks yang skip tanpa conventions;
- seluruh call site loader;
- apakah consumer lain akan crash jika conventions menjadi null.

Gunakan:

```bash
rg -n "loadConventionsSnapshot|hasGroundTruth|NO GROUND TRUTH|NOT VERIFIABLE|conventions|process.exitCode|exitCode" src test
```

## 7. Loader Contract Setelah Fix

Gunakan contract yang sesuai style repository, tetapi semantics berikut wajib.

### Canonical

```json
{
  "source": "canonical",
  "conventions": {},
  "diagnostics": [],
  "conflict": false
}
```

`conventions` berisi object canonical aktual.

### Legacy

```json
{
  "source": "legacy",
  "conventions": {},
  "diagnostics": [],
  "conflict": false
}
```

### Missing

```json
{
  "source": "none",
  "conventions": null,
  "diagnostics": [
    {
      "code": "SUI-SNAPSHOT-001",
      "severity": "error",
      "message": "No conventions ground truth is available."
    }
  ],
  "conflict": false
}
```

Nama field boleh mengikuti codebase. Yang wajib:

- state none eksplisit;
- `conventions` bukan `{}`;
- diagnostic tersedia;
- no scan atau auto-refresh;
- reader tidak menulis ulang artifact.

## 8. Missing Berbeda dari Present-but-Empty

### Missing

```text
conventions.json absent
legacy conventions absent
legacy loadedClassRegistry absent
```

Expected:

```text
source = none
conventions = null
verify non-zero
```

### Present-but-empty

```text
conventions.json exists
valid JSON
valid minimum shape
collections may be empty
```

Expected:

```text
source = canonical
conventions is object
not automatically missing
```

Gunakan keberadaan artifact, parse validity, dan minimum supported shape. Jangan memakai jumlah array/class sebagai satu-satunya penentu.

### Malformed

Jika canonical JSON ada tetapi invalid:

- jangan menyamakan dengan valid empty;
- emit corruption/parse diagnostic;
- verify tidak boleh green;
- legacy fallback hanya bila policy existing mengizinkan, tetapi corruption tetap terlihat;
- no rewrite dan no scan.

### Incomplete canonical

Pertahankan legacy-fill policy PR 2, tetapi jangan biarkan missing total menjadi truthy empty.

## 9. Verify Gate

Perbaiki gate menggunakan state eksplisit loader, bukan truthiness object.

Secara konseptual:

```text
hasConventionsGroundTruth = source != "none" AND conventions != null
```

Sesuaikan dengan implementation aktual.

Untuk missing ground truth:

- output harus menyatakan unverifiable/no ground truth;
- exit non-zero;
- gunakan existing exit code untuk setup/unverifiable jika tersedia;
- jangan hanya menampilkan `0 fail · N skip`;
- jangan memberikan success/green wording;
- JSON report, jika ada, harus menyatakan unverifiable;
- run/timing log harus merekam exit code yang benar;
- jangan scan repository atau memanggil detect/init.

Pertahankan distinction antara design ground truth dan project conventions ground truth. Jangan menganggap XML saja cukup untuk checks yang membutuhkan project snapshot.

## 10. Consumer Safety

Audit seluruh call site `loadConventionsSnapshot`.

Jika `referee` atau consumer lain menerima null:

- jangan crash;
- tambahkan handling minimal bila benar-benar terdampak;
- jangan mengubah scan behavior;
- jangan memperluas patch ke architecture lain.

## 11. Regression Tests Wajib

### A. Loader missing

Given no canonical and no legacy snapshot:

```text
source === "none"
conventions === null
diagnostic exists
```

### B. Canonical

Given valid conventions.json:

```text
source === "canonical"
conventions is object
no missing diagnostic
```

### C. Legacy

Given legacy fields in project-context.json:

```text
source === "legacy"
conventions is object
compatibility preserved
```

### D. Present-but-empty canonical

Given valid canonical artifact with legitimate empty collections:

```text
source === "canonical"
conventions !== null
not missing
```

Use a shape the real CLI can produce.

### E. Malformed canonical

Assert:

- explicit diagnostic/error;
- not silent empty;
- verify not green;
- no rewrite;
- no repository scan.

### F. Real CLI verify empty snapshot

Spawn the actual CLI process:

```bash
node src/cli.mjs verify <temporary-component-dir> <kebab-name>
```

Assert:

```text
exit code != 0
stdout/stderr contains NO GROUND TRUTH or equivalent
no success wording
```

Test actual process exit code, not only helper output.

### G. Verify canonical

Valid canonical snapshot must preserve existing findings/exit behavior.

### H. Verify legacy

Legacy snapshot must preserve existing findings/exit behavior.

### I. No scan fallback

Prove missing case does not call detect, glob, recursive walk, or project-source scan. Use available test boundary or instrumentation. If only static proof is practical, document limitation without pretending dynamic coverage.

### J. Existing PR 2 scenarios

All existing snapshot tests remain. Update only the expected missing contract from `{}` to `null` where appropriate. Do not weaken other assertions.

## 12. Validation Commands

Before changes:

```bash
git status --short
git rev-parse HEAD
node --version
npm --version
```

Syntax checks:

```bash
node --check src/lib/snapshot.mjs
node --check src/commands/verify.mjs
```

Add other changed source files.

Focused tests:

```bash
node --test test/snapshot.test.mjs
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
```

Relevant combined suite:

```bash
node --test   test/snapshot.test.mjs   test/init.test.mjs   test/detect.test.mjs   test/conventions.test.mjs   test/resolve.test.mjs   test/spec.test.mjs   test/agent-context.test.mjs   test/verify.test.mjs   test/verify-root.test.mjs   test/referee.test.mjs
```

Full suite:

```bash
npm test
```

After tests, repeat direct temporary reproduction and capture exit code.

## 13. Semantic Non-Regression

Patch must not change:

- `splitProjectContext` output;
- canonical snapshot writer shape;
- snapshot size reduction;
- resolve output;
- spec output;
- agent-context output;
- context manifest;
- canonical loadedClassRegistry ownership;
- referee hot-path behavior;
- commands/arguments.

Validate that canonical and legacy cases remain equivalent to pre-patch results. Any difference must be listed and explained.

## 14. Focused Re-Verification

After implementation, verify these scenarios:

```text
canonical present
legacy present
missing both
present-but-empty canonical
malformed canonical
```

Record for each:

```text
loader source
conventions null/object
diagnostics
verify exit code
verify headline/status
repository scan observed
```

Decision:

```text
PR 2 corrective patch: PASS / FAIL
VER-001: RESOLVED / UNRESOLVED
PR 2 may be closed: YES / NO
PR 3 may start: YES / NO
```

PR 3 may start only when:

- VER-001 resolved;
- missing direct repro exits non-zero;
- canonical and legacy non-regression confirmed;
- full suite passes;
- no new blocker found.

## 15. Documentation

Update only:

```text
docs/project-docs/development/api-contract.md
```

if needed to document:

- canonical/legacy/none states;
- none returns null;
- present-empty differs from missing;
- verify no-ground-truth exits non-zero;
- no scan fallback.

Do not edit archive or broad docs unless directly contradictory. State documentation sync in final response.

## 16. Safety Rules

Do not run:

```text
git reset --hard
git clean -fd
git checkout -- .
git restore .
npm update
auto-format whole repository
```

Do not delete user prompts/reports/untracked files. Do not commit.

Use `/tmp` for all generated fixtures. Use repository CLI entrypoint explicitly, never global `sliceui`.

## 17. Acceptance Criteria

- [ ] False green reproduced before fix.
- [ ] Root cause identified with source evidence.
- [ ] Missing state explicit.
- [ ] Missing returns null, not truthy object.
- [ ] Valid present-empty canonical is not missing.
- [ ] Malformed snapshot cannot green.
- [ ] Verify missing snapshot exits non-zero.
- [ ] Verify output clearly says unverifiable/no ground truth.
- [ ] No success wording in missing case.
- [ ] Canonical behavior unchanged.
- [ ] Legacy behavior unchanged.
- [ ] No repository scan fallback.
- [ ] Dedup writer and size reduction unchanged.
- [ ] Regression test checks actual process exit code.
- [ ] Focused tests pass.
- [ ] Combined suite passes.
- [ ] Full suite passes except pre-existing skips.
- [ ] Documentation contract synchronized.
- [ ] No PR 3 work or unrelated refactor.

## 18. Required Final Response

### Blocker Reproduction Before Fix

```text
Command:
Exit code:
Headline/output:
Confirmed false green: yes/no
```

### Root Cause

Include paths, symbols, and gate behavior.

### Corrective Patch Summary

Describe minimal changes.

### Files Changed

Separate source, tests, docs, and pre-existing files.

### Loader Contract After Fix

```text
canonical → object
legacy    → object
none      → null
malformed → explicit error/diagnostic
```

### Verify Behavior After Fix

```text
canonical:
legacy:
missing:
present-empty:
malformed:
```

### Validation

List exact commands and results.

### Direct Regression Reproduction After Fix

Show command, key output, and exit code.

### Focused Re-Verification Decision

```text
PR 2 corrective patch: PASS / FAIL
VER-001: RESOLVED / UNRESOLVED
PR 2 may be closed: YES / NO
PR 3 may start: YES / NO
```

### Deferred Findings

Do not fix:

```text
CNF-001 conventions-body conflict diagnostic
PR 3 referee cold/hot separation
verify PascalCase normalization
fs-trace gap
resolve provenance/confidence
visual verification
```

### Documentation Sync

Use `Documentation sync: clear.` or list stale docs.

### Git Status

Include `git status --short`. Do not commit.

## 19. Definition of Done

The task is complete only when VER-001 is reproduced before the patch, resolved after the patch, tested through the real CLI process, full tests pass, snapshot dedup remains intact, and focused re-verification explicitly authorizes or blocks PR 3.

Start by reproducing VER-001 in a temporary fixture. Do not modify source until reproduction succeeds. Implement the smallest patch that restores the rule: no ground truth can never be green.
