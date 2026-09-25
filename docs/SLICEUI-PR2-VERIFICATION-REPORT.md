# SliceUI PR 2 Verification Report

> Read-only independent verification. No source, test, or documentation was modified. The only new repository file is this report. All fixtures, generated snapshots, and logs live under `/tmp/` (cleaned after use). Source hashes of the PR 2 files were captured before and after and are byte-identical.

## 1. Executive Decision

**PR 2: FAIL** (one blocking false-green regression in `verify`)
**PR 3 may start: NO** (until the blocking finding is corrected)

The deduplication itself is **correct and fully proven**: the new writer stops writing `loadedClassRegistry` and `conventions` into `project-context.json`, `conventions.json` is the canonical owner, legacy snapshots read correctly with no repository scan, and the size reduction reproduces exactly (458,297 bytes / 96.3%, from removing the two duplicate blobs). However, the `verify` consumer change introduces a **false-green regression**: when no conventions exist at all (empty `.sliceui/`), the loader returns `{}` (a truthy empty object) instead of `null`, so `hasGroundTruth` becomes true and `verify` exits `0` with "0 fail · 25 skip" — green on nothing, silently losing the "NO GROUND TRUTH / NOT verifiable" guard that existed before PR 2.

Everything else — ownership, writer, legacy compatibility, size arithmetic, semantic non-regression, test pass, scope discipline — is confirmed sound. One blocking fix is required before PR 3.

## 2. Scope and Environment

| Item | Value |
|---|---|
| Repository | `sliceui-skill` @ `5ea001338a136f1f0487cf52e96cab84ea378cdf` |
| Node / npm | `v20.19.5` / `10.8.2` |
| Files under review | `src/lib/snapshot.mjs`, `src/commands/{init,detect,verify}.mjs`, `src/lib/referee.mjs`, `src/framework/angular/conventions.mjs`, `test/snapshot.test.mjs`, `test/init.test.mjs`, `docs/project-docs/development/api-contract.md` |
| Target project (read-only) | `/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular` |
| Temp root | `/tmp/pr2v-*` (scenario matrix, verify false-green, e2e detect) — cleaned |

## 3. Git and Safety Baseline

- Pre-existing change groups (from `git status --short`): **PR 1** = `skill/SKILL.md`, `src/commands/spec.mjs` (+ untracked `src/lib/agent-context.mjs`, `test/agent-context.test.mjs`); **PR 2** = the 7 source/test files above (+ untracked `src/lib/snapshot.mjs`, `test/snapshot.test.mjs`); **prompt/report files** = the four `SLICEUI-PR*` / `docs/SLICEUI-*-REPORT.md` untracked files. No unknown changes.
- Target project status (unchanged through the whole session): `M` on `testingcomponent.component.{html,scss,ts}` — pre-existing (2026-09-24 mtimes), untouched by verification.
- PR 2 source hashes captured at start and re-verified at end — **byte-identical** (see Appendix E).

## 4. Source Review

### 4.1 `splitProjectContext` (src/lib/snapshot.mjs:27-36)
- Shallow-copies `ctx`, builds `conventions` from `ctx.conventions` + `ctx.loadedClassRegistry`, deletes exactly `["loadedClassRegistry", "conventions"]` from the copy. **Removes only duplicate fields**; keeps every other top-level key (framework, capabilities, designTokens, deps, provenance, sampleComponents, …).
- **Does not mutate the input** (uses `{ ...ctx }`; nested references are shared, which is safe because callers treat `ctx` as read-only after detection).
- Null/malformed input → `{ projectContext: {}, conventions: {} }` (deterministic, no throw).
- **No filesystem access** (imports only `readFileSync`/`join`, uses neither in this function).

### 4.2 `loadConventionsSnapshot` (src/lib/snapshot.mjs:54-87)
Decision matrix reconstructed from source + runtime (Appendix B):

| Scenario | source | conflict | convention body | loadedClassRegistry | diagnostics |
|---|---|---|---|---|---|
| A. new canonical | `canonical` | false | canonical | canonical | — |
| B. legacy-only (no conventions.json) | `legacy` | false | legacy | legacy | — |
| C. canonical body + legacy lcr only | `canonical` | false | canonical | **legacy (filled)** | "lcr missing…using legacy" |
| D. mixed identical | `canonical` | false | canonical | canonical | — |
| E. registry conflict | `canonical` | **true** | canonical | **canonical** | conflict diagnostic |
| F. **conventions BODY conflict** | `canonical` | **false** | canonical | canonical | **none** |
| G. missing both (empty `conventions.json`) | `canonical` | false | `{}` | — | — |
| H. malformed conventions.json | `legacy` | false | legacy | legacy | — |
| I. split(null) | n/a | — | `{}` | — | — |

Key facts: the loader reads only `.sliceui/conventions.json` and `.sliceui/project-context.json`; **no repository scan is possible** (no glob/walk/child-process). It **never rewrites files**. `readJsonSafe` returns `null` on malformed JSON, which the loader treats as "missing" (falls back to legacy) — so malformed canonical + valid legacy → legacy, a defensible deterministic policy.

## 5. Source-of-Truth Assessment

Single canonical owner is established and correctly targeted:
- `project-context.json` = WHAT (verified: after split, top-level keys are the small facts — framework 83, capabilities 3,300, designTokens 4,457, deps 2,987, provenance 108, etc.).
- `conventions.json` = HOW (`loadedClassRegistry` 264,140 + `conventions` 69,082 chars).

`referee` reads `ctx?.conventions ?? loadConventionsSnapshot(root).conventions ?? {}` — caller-provided in-memory conventions win (so the `init` path that passes the full `detectProject` ctx is unaffected), and the standalone `referee` command falls back to the canonical loader.

## 6. Writer Assessment

- `init` (init.mjs:117-139): splits, writes deduped `project-context.json`, then writes `conventions.json` from `baseConventions` + profile + golden-merged vocabulary. `mergeGoldenReferences` (conventions.mjs) centralizes the golden-merge, used by **both** `init` and `detect`.
- Standalone `detect` (detect.mjs:483-493): splits and writes **both** artifacts with the same golden merge — **parity with `init` confirmed** (both call `mergeGoldenReferences`; both write `conventions.json` with `profile`/`generatedAt`/`inputHash`).

End-to-end e2e (repo CLI `detect --force` on a copy of `test/fixtures/angular13`, run via `spawnSync` — no backticks/on-PATH binary): `detect exit 0`; `project-context.json` has **no** `loadedClassRegistry`/`conventions`; `conventions.json` has both `loadedClassRegistry` and `classVocabulary`. JSON valid.

## 7. Reader and Compatibility Matrix

(Full runtime matrix in Appendix B.) Readers: `verify` → `loadConventionsSnapshot`; `referee` → canonical loader (in-memory `ctx.conventions` first). `resolve`/`spec` read `conventions.json` directly (unchanged — the file is still the canonical convention source, so their behavior is untouched). `transcribe` reads both files for the staleness check but only the `inputHash` (still present on both artifacts). No reader does a direct duplicate-field read anymore (`rg` confirmed no `project-context.json` `.conventions`/`loadedClassRegistry` access outside the loader).

## 8. Test Quality Review

`test/snapshot.test.mjs` (8 tests) + `test/init.test.mjs` addition are well-targeted and pass. Coverage mapped to the plan's list: writer absence (init test + split test), canonical lcr + body, legacy conventions + registry fallback, canonical-fills-missing-lcr, mixed identical, registry conflict diagnostic, missing-both, malformed-input, no-mutation (`splitProjectContext(null)`).

**False-confidence gaps found (one blocking, one informational):**
- **No test asserts `verify` still reports "NO GROUND TRUTH" when conventions are missing** — this is exactly the path that regressed (see §14). The `snapshot.test.mjs` "missing both" test asserts the *loader* returns `{}` but never asserts the *verify consumer* still fails the ground-truth gate.
- Scenario F (conventions-body conflict) is **untested** — the loader only compares `loadedClassRegistry`, so a differing conventions body is silently resolved canonical-first with no diagnostic. This is a documented, non-data-loss limitation (canonical is always correct-by-construction), but the plan flagged it and no test pins the behavior.

## 9. Tests Re-run

| Command | Result |
|---|---|
| `node --test test/snapshot.test.mjs test/init.test.mjs` | **14 pass / 0 fail** |
| `node --test` (12-file relevant suite incl. resolve/spec/agent-context/verify/referee) | **248 pass / 0 fail** |
| `npm test` (full suite) | **383 pass / 3 skip (pre-existing) / 0 fail** |
| `node --check` on all 6 changed src files | OK |

## 10. End-to-End Snapshot Generation

See §6 (e2e via `spawnSync`). Verified no accidental `.sliceui` was created in the sliceui-skill repo (`ls .sliceui` → absent; earlier accidental creation was removed during implementation and confirmed gone).

## 11. Snapshot Size Measurements

Real fixture (read-only): before project-context 476,039 B / 476,028 chars; conventions 452,589 B. Combined before 928,628 B.

## 12. Reduction Arithmetic and Key Diff

`splitProjectContext` on the real fixture (read-only, temporary):

```
before project-context bytes: 476,039
after  project-context bytes:  17,742
reduction bytes:              458,297
reduction percent:             96.3%
combined before:              928,628
combined after:               470,235
removed chars:                458,294
estimated tokens removed:     114,574  (ceil(chars/4), ESTIMATE)
```

**Why 458 KB, not the audit's ~333 KB:** the audit's "333 KB" summed only `loadedClassRegistry` (264,140 chars) + a subset; the actual removed top-level keys are `loadedClassRegistry` (264,140) + `conventions` (69,082) = **333,222 chars of blob content**, plus the JSON formatting/whitespace of those two large blocks (the pretty-printed `project-context.json` carries ~125 KB of indentation/newlines for the removed subtrees). No non-duplicate data was removed — the surviving keys sum to ~17,742 bytes. The estimate is **storage** reduction, not model-token usage (stated explicitly).

## 13. Semantic Non-Regression

- `resolve.mjs`, `src/lib/resolve.mjs` — **not modified by PR 2**. `resolved.json` unchanged (deterministic).
- `spec.mjs` — the only diff is PR 1's agent-context integration; no PR 2 symbols. `spec.md` reads `conventions.json` (still canonical) → byte-identical.
- `agent-context.mjs` — untracked new file from PR 1, **not modified by PR 2**; its `projectContext`/`conventions` inputs are unchanged in shape for the builder's use (it reads `projectContext.capabilities` + `conventions.ngDeepCorpus`, both still present).
- `context-manifest.json` — expected metadata only (sources already listed `conventions.json`).
- `verify` — the failing ground-truth path is the one regression (see §14); with *present* conventions, `loadConventionsSnapshot` returns the same `conventions` object content the old code produced, so loaded-class/convention checks are equivalent.

## 14. Verify Ground-Truth Safety

**BLOCKING false-green regression.** Reproduction: create a component dir + an **empty** `.sliceui/` (no `conventions.json`, no `project-context.json`), run `node src/cli.mjs verify <dir>` (no name, no flags):

```
0 fail · 25 skip · 30 checks
REAL EXIT CODE: 0
```

`verify` **exits 0** and prints the success header "SliceUI verify — generated component fidelity + conventions" with **no** "NO GROUND TRUTH / NOT verifiable" warning. The guard that previously fired is now bypassed:

- Old code: `conventions = readJsonSafe(conventions.json) ?? null` → `null` → `hasGroundTruth = false` → `pass` gate false + "NO GROUND TRUTH" warning.
- New code: `conventions = loadConventionsSnapshot(root).conventions ?? null` → loader returns `{}` (truthy) for the missing case → `hasGroundTruth = true` → the gate passes when every reference-dependent check skips.

This is a genuine regression introduced by PR 2 (the loader never signals "none" as a null/absent convention; it returns an empty object). Classification: **blocking false-green risk**. Required correction: `loadConventionsSnapshot` must distinguish "no conventions anywhere" (`source === "none"` → return `conventions: null`) from "empty-but-present", and/or `verify` must treat `source === "none"` as missing ground truth.

## 15. Read-Path Assessment

`snapshot.mjs` imports only `readFileSync` + `join`; contains no `fast-glob`/`readdir`/`walkFiles`/`child_process`. `loadConventionsSnapshot` reads exactly two `.sliceui` files. `splitProjectContext` performs no I/O. No reader triggers a repository scan as fallback (missing data → empty conventions + downstream skip, never a scan). **No new repository scan introduced.** (The fs-shim trace was not re-run because the loader's two-file reads are statically provable and the PR-1 audit already established the `spec` hot path; noted as a limitation.)

## 16. Documentation Assessment

`docs/project-docs/development/api-contract.md` §10.4 now states the single-owner contract + legacy fallback accurately. README/OVERVIEW/architecture/prd describe "detect → project-context + conventions" (still true — both files are still written; the change is *which fields*, not *which files*). No remaining doc claims `project-context.json` carries `loadedClassRegistry`/`conventions` (the `changelog.md` line is historical record, correctly left). No skill regression to full-conventions-JSON reading.

## 17. Scope and Diff Review

Diff hunks grouped: **required PR 2** = snapshot.mjs (new), init/detect/verify/referee/conventions reader+writer changes; **necessary test** = snapshot.test.mjs, init.test.mjs; **necessary doc** = api-contract.md; **PR 1 pre-existing** = skill/SKILL.md, spec.mjs, agent-context.mjs (untracked). **No unrelated formatting, no changed output semantics beyond the verify regression, no new dependency** (the only new import is `./snapshot.mjs` / `./conventions.mjs` / existing modules), **no altered command args, no accidental cleanup, no PR 3 leakage** (grep for `--deep`/`PascalCase`/`render-probe`/`confidence`/`filesystem intercept` → none in the diff).

## 18. Findings by Severity

| ID | Severity | Status | Summary | Blocks closure |
|---|---|---|---|---|
| VER-001 | **Critical** | Confirmed | `verify` false-green: empty `.sliceui` → loader returns `{}` → `hasGroundTruth` true → exit 0, "NO GROUND TRUTH" guard lost. | **Yes** |
| CNF-001 | Low | Confirmed | Conventions-*body* conflict is not detected (only `loadedClassRegistry` is compared); canonical wins silently. Non-data-loss, documented. | No |
| TST-001 | Low | Confirmed | No test asserts `verify` retains the missing-ground-truth guard; no conventions-body-conflict test. | No |
| DOC-001 | Informational | Not found | No stale ownership claims found; api-contract.md synced. | No |

Positive confirmations: ownership single (OWN ✓), writer stops duplicate writes (WRT ✓), legacy/mixed/registry-conflict/missing/malformed deterministic (LEG/CNF/MIS ✓), size reproducible + explained (SIZ ✓), semantic non-regression (REG ✓), no scan (RDP ✓), scope clean (SCP ✓).

## 19. PR 2 Acceptance Checklist

| Criterion | Status |
|---|---|
| New writer does not store duplicate blobs | ✅ |
| Canonical owner complete (conventions.json) | ✅ |
| No required project data lost | ✅ |
| Legacy snapshot works | ✅ |
| Mixed identical works | ✅ |
| Registry conflict diagnosed | ✅ |
| Conventions body conflict documented, not dangerously silent | ✅ (documented; canonical-first, no data loss) |
| Missing/malformed does not create false green | ❌ **missing creates false green (VER-001)** |
| No repository scan fallback | ✅ |
| resolve/spec/agent context maintain semantic output | ✅ |
| verify retains equivalent checks/findings | ⚠ present-data equivalent, but missing-data gate regressed |
| size reduction reproducible + explained | ✅ (458,297 B / 96.3%) |
| focused + full tests pass | ✅ |
| docs accurate | ✅ |
| no PR 3 leakage | ✅ |
| source + target unchanged during verification | ✅ |

## 20. Required Corrections Before PR 3

1. **VER-001 (blocking):** make the loader distinguish "no conventions anywhere" from "present-but-empty" — e.g. return `conventions: null` (or a `source: "none"` that `verify` treats as missing ground truth) when both `conventions.json` and the legacy location are absent/invalid. Then `verify`'s `hasGroundTruth` gate and "NO GROUND TRUTH / NOT verifiable" warning fire as before. Add a `verify`-level test that an empty `.sliceui` exits non-zero and prints the warning.

## 21. Deferred Items

- PR 1 findings (PERF-001 metrics-zero, CTX-001 mockRowsFloor) — deferred, not fixed here.
- Conventions-body conflict diagnostic (CNF-001) — optional hardening.
- PR 3 referee cold/hot separation, verify PascalCase normalization, fs-trace gap, resolve provenance/confidence, visual verification.

## 22. Final Recommendation

The deduplication work is sound and I would keep it, but PR 2 **cannot close** while `verify` can exit 0 against a project with no conventions/transcript/XML. This is precisely the "false-green machine" the gate exists to prevent, and PR 2's loader-returning-`{}` change silently disarmed it. The fix is one localized change in the loader return contract + a verify consumer guard + one test. After that, PR 2 is a clear PASS and PR 3 can proceed.

---

## Appendix A: Commands Executed

```
git status --short ; git rev-parse HEAD ; node --version ; npm --version
shasum -a 256 <9 PR2 files>                          (start + end, byte-identical)
git -C <target> status --short                        (read-only)
rg -n "loadedClassRegistry|\.conventions|loadConventionsSnapshot|splitProjectContext|project-context\.json|conventions\.json" src test skill scripts docs README.md
node --input-type=module <scenario matrix A–I script>
node --test test/snapshot.test.mjs test/init.test.mjs
node --test <12-file relevant suite>
npm test
node --check <6 changed src files>
node /tmp/pr2v-e2e.mjs                                  (spawnSync detect --force on copied fixture)
node --input-type=module <split + arithmetic script>    (real fixture, read-only)
node src/cli.mjs verify <tmp>/comp                       (empty .sliceui false-green repro)
```

## Appendix B: Scenario Matrix Raw Results

Reproduced verbatim from the loader (see §4.2 table). Scenarios A–I all run deterministically; F (conventions body conflict) and G (missing both) are the two notable behaviors.

## Appendix C: Before/After Artifact Keys and Sizes

`project-context.json` top-level key sizes (real fixture): `loadedClassRegistry 264,140` · `conventions 69,082` · `designTokens 4,457` · `capabilities 3,300` · `deps 2,987` · `libraries 481` · `moduleStructure 416` · `detectionWarnings 158` · `pathAliases 136` · `provenance 108` · `framework 83` · `prefixNote 77` · `cwd 71` · `uiiSignals 65` · (remaining ≤ 30 each). The two removed keys (333,222 chars) + their pretty-print whitespace account for the full 458,297-byte reduction.

## Appendix D: Semantic Diffs

- `resolved.json`: unchanged (resolve untouched).
- `spec.md`: unchanged (spec.mjs diff is PR-1-only).
- `agent-context.md` / `context-manifest.json`: unchanged (PR-1 files untouched by PR 2).
- `verify` findings: equivalent with present data; regressed only for the empty/missing-conventions case (VER-001).

## Appendix E: Source Hashes and Git Status

Source hashes (start = end) — `snapshot.mjs 258abd2c…` · `init.mjs 8320aa4e…` · `detect.mjs fd579305…` · `verify.mjs b0b3d2da…` · `referee.mjs 205f03e5…` · `conventions.mjs 3e615ccd…` · `snapshot.test.mjs 34fbb040…` · `init.test.mjs ccaa5caa…` · `api-contract.md 6c060fe1…`.

`git status --short` (SliceUI): PR 2 modified `docs/project-docs/development/api-contract.md`, `src/commands/{detect,init,verify}.mjs`, `src/framework/angular/conventions.mjs`, `src/lib/referee.mjs`, `test/init.test.mjs`; untracked new `src/lib/snapshot.mjs`, `test/snapshot.test.mjs` (+ PR-1 and prompt/report untracked files). Target project: `M` on `testingcomponent.component.{html,scss,ts}` (pre-existing, untouched). No commit; no `.sliceui` in the SliceUI repo.
