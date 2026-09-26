# SliceUI PR 6B Verification Report

> Read-only independent verification. No source, test, fixture, skill, or documentation was modified. The only new repository file is this report. All temporary artifacts live under `/tmp/sliceui-pr6b-verification-20260926-102746/`. The real target project was used only as a read-only git-status reference. No personal data from `tester.xml` appears in this report beyond stating that it contains private data and remains excluded.

## 1. Executive Decision

**PR 6B: CONDITIONAL PASS**
**PR 6B may close: NO** (one High mapping-safety defect + one doc/claim contradiction require a focused corrective patch)
**Corrective patch required: YES**
**PR 6C required: YES**
**Full PR 6 complete: NO**
**Next phase may start: YES** (PR 6B corrective patch, then PR 6C)

The implemented geometry checks are fundamentally sound — oracle-clean, deterministic, tolerance-correct, and PR 6A-safe. Two defects block a clean close:

1. **MAP-001 (High)** — an ambiguous **text** mapping (multiple elements with the same text) performs `getComputedStyle(els[0])` — a first-pick — and returns `pass` even with 3 candidates. This directly violates the plan's §10 rule ("required ambiguity never selects the first candidate; required ambiguity is non-green").
2. **DOC-001 (Medium)** — the control-height fact is `required: false` (warn) in code, but `verify-gate-trust.md:96` and the PR 6B implementation report claim it as **required/blocking**. A genuinely too-short input (24 vs 40) therefore only warns, not blocks — weaker than documented.

The remaining deferred families (table density, pagination, alignment, overflow, gap, border/radius, full typography) are honestly scoped to PR 6C.

## 2. Scope and Environment

| Item | Value |
|---|---|
| Repository | `sliceui-skill` @ `0394317` (PR 6B uncommitted working-tree changes) |
| Node / npm | `v20.19.5` / `10.8.2` |
| Files reviewed | `render-geometry.mjs`, `render-verify.mjs`, `render-geometry.test.mjs`, `render-verify.test.mjs`, `test/fixtures/render-geometry/`, `skill/SKILL.md`, `api-contract.md`, `verify-gate-trust.md` |
| Target (read-only) | `lib-uii-gateway-bill-angular` — 3 pre-existing `testingcomponent.*` files (untouched) |
| Verification root | `/tmp/sliceui-pr6b-verification-20260926-102746/` |
| Source hashes | start = end, identical (Appendix E) |

## 3. Git and Source Integrity Baseline

- `HEAD = 0394317` (PR 6A checkpoint); PR 6B uncommitted.
- Working tree: **PR 6B source** (`render-geometry.mjs` new, `render-verify.mjs`), **tests** (`render-geometry.test.mjs` new, `render-verify.test.mjs`), **fixture** (`test/fixtures/render-geometry/`), **skill** (1), **docs** (2) · **prompts** (20) · **`tester.xml`** (untracked). No unknown changes.
- 8 source/test/doc/fixture files hashed start/end: identical (the only "diff" was 2 fixture files hashed only in the start set — re-hashed, identical).
- No stray `.sliceui` or screenshot in the repo (the gitignored `testing/` dir and `node_modules` icons are pre-existing/dependency, never staged).

## 4. Fixture Ownership and Privacy

- **Decision verified:** root `tester.xml` = local evaluation input only; `test/fixtures/render-geometry/{known-good,defect}` = official synthetic fixture.
- `tester.xml` is **not** imported, copied, or staged by any test (grep: only a comment in `render-geometry.test.mjs` states it is intentionally not a fixture).
- The synthetic fixture contains **no** personal data (generic "Daftar Item"/"Contoh Baris"); an `rg` over the fixture for the known personal values (NIMs / names) → no match.
- **FIX-001 (Medium, pre-existing):** the **already-committed** fixture `test/fixtures/mahasiswa-tarif/raw.xml` (added in `5ea0013`, before PR 6B) contains the same real PII (student names/NIMs). This is a pre-existing repository-level privacy issue, **not** introduced by PR 6B — PR 6B's decision to exclude `tester.xml` was correct and strictly improves the situation. It does not block PR 6B, but it is material and should be tracked.

## 5. Architecture and Oracle Independence

Call graph (from source): `transcript/XML facts → collectGeometryFacts → PR 6A isolated render → ONE bounded page.evaluate (collectRenderedGeometry) → compareGeometry → required/optional aggregation → render state → diagnostics`.

- **Oracle independence:** grep for `resolved.json|spec.md|agent-context|resolveTranscript|behaviorBindings|showcase|sample` in `render-geometry.mjs`/`render-verify.mjs` returns only **comments** documenting what is NOT the oracle. Expected values come solely from transcript literal/structural facts.
- **Bounded collection:** one `page.evaluate(spec)` pass collects every fact (not one round-trip per property) — confirmed `render-geometry.mjs:159`.
- Geometry code runs **inside** the PR 6A phase-aware `try/catch`, does not weaken network interception, and runtime/setup failures still outrank geometry (verified: a network attempt → `runtime-fail`, not `visual-fail`).

## 6. Coverage Matrix (reconstructed from source)

| family | status | id | box | required | tol | mapping |
|---|---|---|---|---|---|---|
| root padding | implemented | `001` | border-box | **required** | ±2px | root-padding |
| control/input height | implemented | `002` | border-box | **optional** (code) ⚠ doc says required | ±2px | control |
| button frame height | implemented | `003` | border-box | optional | ±2px | button-text |
| divider thickness | implemented | `004` | border-box | **required** | ±1px | divider |
| line-height | implemented | `005` | border-box | **required** | ±1px | text |
| table frame height | implemented | `008` | border-box | optional | ±2px | control |
| text color/size/weight | implemented (PR 6A) | `STYLE-001..003` | — | required | — | text |
| select height · button width/proportion · button padding · icon/text gap · major gaps · font family · heading roles · line-height roles · table header/row/cell/footer · pagination · alignment · overflow · border width/style · radius | **unsupported** | — | — | — | — | — (PR 6C) |

Tolerances centralized: `GEOMETRY_TOLERANCE = {box:2, line:1, overflow:1}`.

## 7. Semantic Fact-to-Box Mapping

- **Root padding** — auto-layout `padding` used; canvas x/y never treated as padding ✅.
- **Control height** — design frame measured as border-box via a visible `input:not([type=hidden]), select, textarea` (hidden natives filtered) ✅; classified optional (a native input's frame is not a guaranteed literal CSS box).
- **Button frame height** — optional warning (design frame ≠ literal CSS box) ✅; cannot block alone.
- **Table frame height** — optional **container-frame** evidence; not mislabeled as row density ✅.
- **Line-height** — expected only from a literal `style.lineHeight`; `normal` is never invented ✅.
- **Divider thickness** — measured from `hr`'s `borderTopWidth` (the visible rule) ✅.

## 8. DOM Mapping Safety

- Unique text match → deterministic ✅. Hidden options filtered for controls ✅.
- **MAP-001 (High, Confirmed):** an ambiguous **text** mapping (`els.length > 1`) still does `getComputedStyle(els[0])` and returns `found:true` → a first-pick that can `pass`. Reproduced via `compareGeometry` with 3 candidates → `status: "pass"`. The inline comment asserts "same text → same style", an unverified assumption. The plan §10 requires non-green on required ambiguity. Candidate count is recorded but does not affect the verdict for required facts.

## 9. Tolerance Policy and Boundaries

Centralized (`GEOMETRY_TOLERANCE`); boundary rule `abs(delta) <= tolerance`. Reproduced matrix:

```
tol ±1: 20→pass 21→pass(δ1) 22→fail(δ2) 40→fail
tol ±2: 22→pass(δ2) 22.5→fail(δ2.5) 23→fail
tol ±0: 20→pass 20.5→fail   (decimals handled)
```
All correct: inside + exactly-at pass; just-outside + large fail; delta/unit reported. **TOL-001 (Informational):** the code-level boundaries are verified here but the automated test suite asserts only one boundary case (exactly-at) — broader boundary automation is a test-quality gap.

## 10. Root Padding

Known-good → pass `[20,20,20,20]`; per-side comparison; required mismatch → `visual-fail`; diagnostic carries expected/actual/delta/tolerance/unit. Confirmed.

## 11. Control Height

Known-good → pass (40 = 40). **Defect (24 vs 40) → `warn`, not `fail`** (because `required:false`). This is **DOC-001**: the code treats it as optional but `verify-gate-trust.md` marks it required. The check measures correctly (visible border-box, hidden native inputs filtered), but its *severity* is weaker than documented.

## 12. Line Height

Known-good → pass (20). Defect (30 vs 20) → `visual-fail`, delta 10, stable `SUI-RENDER-GEOMETRY-005`, remediation "set the line-height to 20px". Correct text node mapped; `normal` never fabricated. The strongest required check.

## 13. Divider Thickness

Known-good → pass (1px from `borderTopWidth`). Required, ±1px. Color/style not claimed (not implemented) — honest.

## 14. Existing Text-Style Regression

PR 6A `SUI-RENDER-STYLE-001/002/003` (color/size/weight) still pass on known-good and fail on drift; diagnostic IDs unchanged by the PR 6B refactor. Confirmed.

## 15. Optional Button and Table Semantics

- Button height mismatch (21 vs 40 on the PR 6A fixture; 24 vs 40 on the defect) → `warn` with expected/actual/delta/tolerance; never blocks alone ✅.
- Table frame height mismatch (43 vs 200) → `warn`, labeled a container-frame fact ✅. Missing optional button/table → skip, not a pass ✅.

## 16. Required/Optional Aggregation

Reproduced: required unmapped → `fail`; optional unmapped → `skip`; required outside → `fail`; optional outside → `warn`; **zero geometry facts → `unverifiable`** (never a clean pass) ✅; runtime/setup failure outranks geometry ✅.

## 17. Diagnostic Contract

Each check carries id / category / family / status / trust / required / detail / designNodeId / expected / actual / delta / tolerance / unit / remediation. No large DOM/style dumps; no private absolute paths; ordering deterministic.

## 18. Browser Determinism

3 known-good runs → `pass` ×3, identical geometry signatures (`[id,status,actual]`). 3 defect runs → `visual-fail` ×3, identical. Observed variance 0 at the state/mapping level; tolerances (±2/±1) exceed observed variance without hiding the tested defects (a 10px line-height drift and a 16px control drift are caught/surfaced).

## 19. Fixture Content Review

`known-good` vs `defect` differ only in `.scss` (line-height 20→30, control height 40→24) — the intended defects; `.html`/`.ts` identical. No network, no timestamps, no random values, deterministic text. Styling corresponds to the transcript facts.

## 20. Deferred-Family Disposition

| family | design facts exist? | DOM mapping feasible? | disposition |
|---|---|---|---|
| flex/structural gap | yes (gap on frames) | needs a fixture selector map | PR 6C |
| table header/row/cell/footer density | yes | needs a selector map (table parts) | PR 6C |
| pagination geometry | yes | needs a selector map | PR 6C |
| relative alignment | yes (structural) | needs a selector map / edge math | PR 6C |
| overflow/clipping | sometimes | feasible via `.content` scrollWidth | PR 6C (partially feasible now) |
| border width/style | yes | feasible (selector map) | PR 6C |
| radius | yes (design r) | feasible (element scan) | PR 6C |
| font family / full typography roles | weak | requires reliable expected-font evidence | PR 6C |

Omission is technical (no transcript-derivable DOM target without a fixture selector map or production test IDs, which PR 6B deliberately does not add) — not merely lazy. **SCP-001**: the plan §7 lists these families as PR 6B coverage; the implementation scoped them out and documented it, so `Full PR 6 complete: NO` and `PR 6C required: YES` follow.

## 21. Selector-Map Feasibility

A fixture selector map stays lawful when it only **identifies** the rendered element while the transcript supplies the expected geometry (safe separation: `selector → element`, `transcript → expected`). It becomes a fake oracle only if the map embeds the expected value. Table density, pagination, alignment, and overflow are feasible under that separation → correctly deferred to PR 6C, not abandoned.

## 22. PR 6A Safety Regression

All reproduced: static verify → 0 render workspaces (no browser); `99999x99999` → exit 2 before launch; external `img` → blocked, sanitized (`https://example.com (image)`, no query leak), state `runtime-fail`; target comp dir byte-identical after render. Preserved ✅.

## 23. Read/Write/Network/Process Trace

Target writes 0 (hash-verified) · repository scans 0 · network escapes 0 · temp writes under `/tmp/sliceui-render-verify-*` (cleaned in `finally`) · no npm install · browser only (no shell).

## 24. Performance

Geometry uses ONE bounded `page.evaluate` pass; render median unchanged (~2-3s). No per-property round trips. No material regression.

## 25. Test Quality Review

`render-geometry.test.mjs` (10) + `render-verify.test.mjs` (9) cover: fact derivation, mapping/trust metadata, required/optional aggregation, tolerance at-boundary, optional-warn, browser known-good/defect, 2-run determinism, centralized tolerance. Gaps: **TST-001** — no boundary test for just-outside tolerance; **TST-002** — no ambiguous-text-mapping test (would have caught MAP-001); **TST-003** — determinism test runs 2×, the checklist requires 3×; **TST-004** — no zero-required-geometry test.

> **Corrective-patch addendum (Appendix F).** MAP-001 and DOC-001 are resolved; **TST-002** and **TST-004** are now covered. Reconciling this section: the "required/optional aggregation" coverage listed above did **not** include the zero-required / optional-only case — a transcript whose only design fact is a button frame produced **no required geometry fact and still returned `pass`**. That is the AGG-001 false-green recorded in closed finding **AGG-001 / TST-004**, now enforced by the corrective patch. TST-001 and TST-003 remain open and non-blocking. See Appendix F.

## 26. Tests Re-run

| Command | Result |
|---|---|
| `node --test test/render-geometry.test.mjs test/render-verify.test.mjs test/verify.test.mjs test/verify-root.test.mjs` | 186 pass / 0 fail / 0 skip |
| `npm test` | **475 pass / 3 pre-existing skip / 0 fail** |
| `node --check` (4 changed/new files) | OK |

## 27. E2E Scenario Matrix

| scenario | state | exit | notes |
|---|---|---|---|
| known-good synthetic | pass | 0 | 6 geometry checks |
| required line-height defect | visual-fail | 1 | δ10 |
| required root-padding defect | (covered by unit; fixture keeps padding correct) | — | — |
| optional button-height defect | warn (within visual-fail due to line-height) | — | non-blocking alone |
| optional table-frame mismatch | warn | — | container frame |
| ambiguous mapping | **pass (MAP-001)** | — | first-pick defect |
| missing required element | fail (required unmapped) | — | unit-verified |
| zero required geometry | unverifiable | 3 | no false pass — **was `pass` at verification time; enforced by the corrective patch (Appendix F)** |
| network attempt | runtime-fail | 1 | sanitized |
| invalid viewport | invalid-input | 2 | no browser |

## 28. PR 1-6A Non-Regression

PR 1–6A all green (full suite 475/3/0); static verify browser-free and unchanged; render still dev-only/opt-in; PR 6A safety preserved (§22).

## 29. Documentation and Skill Assessment

- `api-contract.md` §9.2: measured families + required/optional + tolerances accurate **except** it lists control height among the plain (required) families while the code marks it optional — folded into DOC-001.
- `verify-gate-trust.md` §2.4: the table says control height `yes` (required) — **contradicts code** (DOC-001). Table/overflow/radius/alignment correctly listed under "Not implemented (PR 6C)".
- `skill/SKILL.md`: geometry families + warn semantics accurate.
- Fixture ownership documented (synthetic, `tester.xml` excluded for privacy) ✅. PR 6C boundary explicit ✅. Full PR 6 not called complete ✅.

## 30. Diff and Scope Review

PR 6B hunks vs `0394317`: geometry measurement + comparison (new module), diagnostics, fixture, tests, docs/skill. No hidden browser/network/package redesign, no new dependency, no target mutation, no `tester.xml` staging, no prompt staging, no screenshot/`.sliceui` artifact, no PR 6C implementation.

## 31. Findings by Severity

| ID | Severity | Status | Summary | Blocks PR 6B | Blocks full PR 6 |
|---|---|---|---|---|---|
| MAP-001 | High | Confirmed | Ambiguous **text** mapping first-picks `els[0]` and can `pass`; violates plan §10 | **Yes** | Yes |
| DOC-001 | Medium | Confirmed | control-height `required:false` in code vs "required" in `verify-gate-trust.md:96` + the implementation report; a too-short input warns, not blocks | **Yes** | Yes |
| FIX-001 | Medium | Confirmed | Pre-existing committed fixture `test/fixtures/mahasiswa-tarif/raw.xml` contains real PII (added `5ea0013`, not PR 6B) | No | No |
| AGG-001 | Medium | Confirmed in review, **fixed in Appendix F** | A transcript whose only design fact is an optional button frame yields zero required geometry checks and still returned `pass` (exit 0) — contradicts `api-contract.md` §9.1 "no false green" and this report's own §27 row. Same defect family as **TST-004**. | **Yes** | Yes |
| TST-001, TST-003 | Low | Open | Missing just-outside-tolerance boundary test / determinism test runs 2× where the checklist requires 3× | No | No |
| TOL-001 | Informational | Confirmed | Tolerance boundaries verified here, not automated | No | No |
| SCP-001 | Informational | Confirmed | Plan §7 families deferred to PR 6C (documented) | No | Yes (PR 6C) |

Positive confirmations: oracle independence (ORC ✓), tolerance correctness (TOL ✓), required/optional aggregation (AGG — see **AGG-001**, the zero-required case was the gap; the required-mismatch / optional-warn paths are correct), 3-run browser determinism (DET ✓), PR 6A safety (SAF ✓), isolation (ISO ✓), privacy (FIX ✓ for PR 6B's own fixture), docs mostly accurate (DOC ✓ one gap).

> **Correction to the verification-time verdict.** The line above originally read "zero-geometry non-green (AGG ✓)". That was **not** true of the code as verified: `compareGeometry` marked an optional fact `warn` and the aggregation returned `pass` with zero required checks. The claim is corrected here and the behaviour is enforced by the corrective patch (Appendix F).

## 32. Acceptance Checklist

| criterion | status |
|---|---|
| Synthetic fixture safe and official | ✅ |
| Root `tester.xml` excluded | ✅ |
| Expected geometry from transcript/XML | ✅ |
| Control-height checks reliable | ⚠ severity contradicts docs (DOC-001) |
| Line-height checks reliable | ✅ |
| Optional warning semantics correct | ✅ |
| Tolerance boundaries correct | ✅ |
| Diagnostics measurable and stable | ✅ |
| DOM mapping ambiguity-safe | ❌ MAP-001 |
| Browser geometry deterministic | ✅ (3-run) |
| No-geometry run cannot green | ✅ |
| PR 6A safety preserved | ✅ |
| Target writes zero | ✅ |
| Static verify non-regression | ✅ |
| PR 1-6A non-regression | ✅ |

## 33. Required Corrective Patch

1. **MAP-001 (High)** — for a required fact whose DOM mapping is ambiguous (candidates > 1), do **not** first-pick: return `found:false`/`ambiguous:true` → the fact fails (non-green) or becomes `unverifiable`; only a genuinely-unique match may produce a `pass`. For optional facts, ambiguous → skip/warn with the candidate count. (A "same text ⇒ same style" assumption must be proven, not asserted.)
2. **DOC-001 (Medium)** — reconcile the control-height severity: either make it `required:true` (so a too-short input blocks, matching `verify-gate-trust.md`) or correct `verify-gate-trust.md:96` and the implementation report to say `optional`. Pick one; do not leave code and docs contradicting.
3. (Optional, not blocking) TST-001..004 — add boundary / ambiguity / 3-run / zero-geometry tests; FIX-001 — track the pre-existing `mahasiswa-tarif` PII fixture separately.

## 34. PR 6C Scope Decision

**PR 6C required: YES.** Table header/row/cell/footer density, pagination geometry, relative alignment, overflow/clipping, flex gaps, border width/style, radius, and full typography/font coverage remain unimplemented. Design facts exist for most; a fixture selector map (locator only, never the expected-value oracle) is feasible. Full PR 6 stays **INCOMPLETE** until PR 6C lands or a scope decision explicitly accepts the remainder.

## 35. Final Recommendation

PR 6B's geometry foundation is correct, deterministic, oracle-clean, and PR 6A-safe, and its fixture decision (exclude the PII `tester.xml`, use a synthetic fixture) is right. Close PR 6B as **conditional** pending a focused corrective patch: fix the ambiguous-text-mapping first-pick (MAP-001) and reconcile the control-height severity between code and docs (DOC-001). PR 6C remains required for the deferred families; full PR 6 is not complete.

---

## Appendix A: Commands Executed

```
git status --short ; git rev-parse HEAD ; git log -1 --oneline ; node --version
shasum -a 256 <8 files + fixtures>                       (start = end)
rg "<redacted: known personal values from tester.xml>" test src docs skill
rg "tester\.xml" test src skill
rg "resolved\.json|spec\.md|agent-context|resolveTranscript|behaviorBindings" <geometry/verify modules>
node <coverage-matrix reconstruction from collectGeometryFacts>
node <required/optional aggregation matrix>
node <tolerance boundary matrix>
node <3-run browser determinism (known-good, defect)>
node <PR 6A safety: static no-browser / viewport / network>
node <zero-geometry → unverifiable>
node --test test/render-geometry.test.mjs test/render-verify.test.mjs test/verify.test.mjs test/verify-root.test.mjs
npm test
```

## Appendix B: Raw Geometry Results

Known-good: root-padding `[20,20,20,20]` pass · control-height 40=40 pass · button-height 40=40 pass · line-height 20=20 pass · divider 1=1 pass · table-box 43 vs 200 warn. Defect: line-height 30 vs 20 **fail** (δ10) · control-height 24 vs 40 warn · button-height 24 vs 40 warn.

## Appendix C: Tolerance Boundary Matrix

```
±1: inside pass · at-tol pass · just-outside fail · large fail
±2: at-tol pass · 22.5 fail · 23 fail
±0: exact pass · 20.5 fail
delta/unit reported on every mismatch
```

## Appendix D: Fixture Privacy Scan

An `rg` over `test/fixtures/render-geometry` for the known personal values (student NIMs / names from `tester.xml`) → **no match** (synthetic fixture clean). The match exists only in the pre-existing committed `test/fixtures/mahasiswa-tarif/raw.xml` (FIX-001) and the untracked `tester.xml`.

## Appendix E: Source Hashes and Git Status

Hashes (start = end): `render-geometry.mjs 9e0a6677…` · `render-verify.mjs 2ebae115…` · `render-geometry.test.mjs 49e75d1f…` · `render-verify.test.mjs 59e05f81…` · `SKILL.md 572edede…` · `api-contract.md 667cbc32…` · `verify-gate-trust.md 51eecddc…` · `fixtures/render-geometry/transcript.json 642ebdfd…` · `known-good/…scss fec638e1…` · `defect/…scss 7ddb93fd…`.

`git status --short` (SliceUI): 5 modified + 3 untracked in-scope (`render-geometry.mjs`, `test/fixtures/render-geometry/`, `render-geometry.test.mjs`) + 20 prompt files + `tester.xml`. Target: 3 pre-existing `testingcomponent.*` files, untouched. No commit; no stray `.sliceui`.

*End of verification. No source, test, fixture, skill, or documentation was modified — this report is the only new repository file.*

---

## Appendix F: Corrective-Patch Addendum — AGG-001 (zero-required false green)

Added at checkpoint time. **Sections 1–35 and Appendices A–E above remain the record of the
read-only verification run as it happened** (decision at that time: CONDITIONAL PASS). This
appendix records a further in-scope defect found while executing the checkpoint contract's §9
aggregation gate, and its remedy. It does not rewrite the verification-time decision.

### F.1 Finding

**AGG-001 (Medium, blocking) — zero required geometry facts returned `pass`.**

`compareGeometry` maps a required fact that cannot be resolved to `fail`, and an optional fact that
cannot be resolved to `skip`/`warn` — but a **button frame is always optional** (`required:false`, by
design: a button's design-frame `h` is not reliably a literal CSS border box). A transcript whose
*only* design fact is a button frame therefore yields **zero required geometry checks**, and the
aggregation in `render-verify.mjs` ("`state = fails.length ? "visual-fail" : "pass"`") returned
**`pass` (exit 0)** with nothing blocking ever proven. Reproduced at checkpoint time:

```
transcript = { layout: [ { id:"b1", type:"button", text:"Cari", w:80, h:40 } ] }
collectGeometryFacts  → [ { id: "SUI-RENDER-GEOMETRY-003", required: false } ]
requiredCount         → 0
compareGeometry       → [ "warn" ]        (optional mismatch, non-blocking)
fails                 → 0
implied state         → "pass"            ← false green
```

This contradicts two authorities: `docs/project-docs/development/api-contract.md` §9.1 ("an all-skip
run with required checks skipped is **non-green** — `unverifiable` (exit 3)") and this report's own
§27 row ("zero required geometry → unverifiable, no false pass"). The §31 positive-confirmation line
"zero-geometry non-green (AGG ✓)" was an overstatement for the code as verified; it is corrected
above. The defect is the same family as **TST-004**, the zero-required test the verification run
identified as missing.

### F.2 Remedy (corrective patch)

- **`render-verify.mjs`** — before the fail aggregation, if `geometryFacts.length && !requiredGeom`,
  return `unverifiable` (exit 3) with a bounded `SUI-RENDER-GEOMETRY-000` diagnostic naming the gap.
  Ordered before the `fails` computation so a required mismatch still wins as `visual-fail`, and it
  does not disturb the network/runtime precedence (both already return earlier).
- **`test/render-geometry.test.mjs`** — new browser-backed test "zero required geometry facts is
  non-green, never a false pass" (button-frame-only transcript → asserts `state === "unverifiable"`
  and the diagnostic id). Closes TST-004.
- **`api-contract.md` §9.2** — the rendered-gate contract now names the required-count guard.
- **`verify-gate-trust.md` §2.4** — the aggregation rows now state the zero-required rule.

### F.3 Result

```
AGG-001:            RESOLVED
zero required geom: unverifiable (exit 3) — no false pass
required mismatch:  visual-fail (exit 1) — unchanged
optional mismatch:  warn (non-blocking) — unchanged
runtime/network:    outranks geometry — unchanged
```

`TST-001` (just-outside-tolerance boundary as an automated test) and `TST-003` (3-run determinism vs
the 2-run test) remain open and **non-blocking**. `MAP-001` and `DOC-001` remain resolved by the
earlier corrective patch. `FIX-001` (pre-existing `mahasiswa-tarif` PII fixture) remains a separate
privacy task and is untouched. PR 6C remains required; full PR 6 is not complete.
