# SliceUI PR 6C Verification Report

## 0. Independence Disclosure (read first)

This verification was performed by **the same agent that implemented PR 6C**, in the same session.
It is therefore **self-verification, not independent verification**. The prompt's read-only rules
were followed (source hashes start = end, verified below), and the review deliberately attacked the
implementation adversarially — three real defects were found by doing so, which is evidence the
review was not a rubber stamp. But a genuinely independent party has not examined this work, and
§38's PASS criteria arguably require one. **This caveat is material to the decision and is reflected
in the verdict.**

## 1. Executive Decision

**PR 6C: CONDITIONAL PASS**
**PR 6C may close: NO** (one High detection gap + one High documentation overclaim + one Medium schema gap)
**Corrective patch required: YES**
**NOEV dispositions valid: YES** (with the caveat in §9 — they are documentation-only, not programmatic)
**Table-density limitation blocks closure: NO** (genuinely evidence-blocked; see §10)
**Selector maps locator-only: YES**
**Overflow policy evidence-safe: PARTIAL** (defect side is correct; two claimed sub-families are unimplemented)
**PR 6A and PR 6B safeguards preserved: YES**
**Full PR 6 may close after checkpoint: NO** (pending the corrective patch)
**Next phase may start: NO** (corrective patch first)

## 2. Scope and Environment

```
repo:    /Users/bsi-2-2200019/Development/freelance/sliceui-skill
node:    v20.19.5 · npm 10.8.2
baseline: 60a0835 (HEAD, direct ancestor — confirmed via git merge-base --is-ancestor)
tmp:     /tmp/sliceui-pr6c-verification-<timestamp>/
target:  /Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular (read-only)
```

## 3. Git and Source Integrity Baseline

- `60a0835` **is** HEAD and an ancestor. PR 4 (`a6fd181`), PR 5 (`2617638`), PR 6A (`0394317`),
  PR 6B (`60a0835`) all committed and their subjects match status.md's claims.
- Working tree: 11 modified (PR 6C docs/skill/source/tests/PR-6B-fixtures), 16 untracked in-scope
  (selector-map.mjs, structural fixtures, selector-map.test.mjs) + 25 root planning prompts +
  `tester.xml`. **No unknown changes.**
- **Start/end source hashes identical** for all 11 PR 6C files and all 8 structural fixture files
  (Appendix F). No implementation file was modified by this verification.

## 4. Fixture Privacy

- `tester.xml` untracked, unstaged; `rg "tester\.xml" src/ test/` returns only an intentional
  comment in `render-geometry.test.mjs` stating it is *not* a fixture. Not imported, not copied.
- Privacy pattern scan (`19[0-9]{6}|NIM|mahasiswa|Rp ?[0-9]|name+NIM`) over
  `test/fixtures/render-geometry/` → **no match**. Structural fixture values are generic
  ("Daftar Item", "Judul Panel", "Cari", "Pencarian").
- No personal data in the selector maps, diagnostics, or this report.
- Fixtures are deterministic and network-free (fixed literals, no time/random/network).
- `FIX-001` untouched; no regression.

## 5. Architecture and Oracle Independence

Call graph reconstructed and confirmed: transcript/XML facts → `validateSelectorMap` →
`indexSelectorMap` → `collectGeometryFacts(transcript, mapIndex)` → PR 6A mount → one bounded
`page.evaluate` → `compareGeometry` → state.

Oracle independence **verified**: `rg` for `resolved.json|spec\.md|agent-context|behaviorBindings`
over `render-geometry.mjs` / `selector-map.mjs` → no hits. Every `expected` value is read from the
transcript node. Screenshots are not numeric oracles.

**Key structural guarantee:** `indexSelectorMap` returns only `{selector, required}` — it is
impossible for any extra field on a map entry to reach the geometry layer, even a field the
validator does not recognize. This was verified empirically, not just by reading (§9 of the raw
matrix). It is what keeps the schema gaps below from being oracle escapes.

## 6. Selector-Map Schema

Validation confirmed for: version, object/array shape, duplicate `designNodeId`, `css`-only
strategy, non-empty selector, 200-char bound, and rejection of `<`/`>`, URLs, absolute paths,
`javascript:`, `eval(`. Invalid maps return `invalid-input` (exit 2) **before** any browser launch,
with `SUI-RENDER-MAP-001`.

**Finding SCH-001 (Medium):** the forbidden-field list is an **exact-match denylist** (plus exact
matches inside `renderLocator`). It does **not** reject:
- `expectedScroll`, `allowOverflow`, `validTruncation`, `ellipsisExpected` — the very exception
  fields §23/§24 require be unexpressible;
- case variants (`ExpectedHeight`);
- arbitrarily nested objects (`renderLocator.meta.expectedHeight`).

Severity is Medium, not High, because §5's structural property holds: even a validator-accepted
map cannot deliver those fields to the geometry layer. It is a strictness defect — a fixture author
could believe they had declared an overflow exception and be silently ignored — not a fake oracle.

## 7. Selector Resolution and Ambiguity

Dynamically confirmed: required missing → `fail` (non-green); required ambiguous (3 candidates) →
`fail` (non-green); optional ambiguous → `warn`; optional missing → `skip`; unique → measured.
No DOM-order first-pick exists in the mapped or text path. Candidate summaries are bounded
(`MAX_CANDIDATES = 5`) and carry only `{tag, role}` — no text, no HTML.

## 8. Coverage Matrix

| family | disposition | required | note |
| :--- | :--- | :--- | :--- |
| gap / spacing | **implemented** | R | axis-correct |
| border width | **implemented** | R | top edge only (BOR-001) |
| border color | **implemented** | R | exact match |
| border style | unsupported-NOEV | — | parser emits no style |
| uniform radius | **implemented** | R | |
| per-corner radius | **implemented** | R | |
| font family | **implemented** | R | |
| font fallback | **implemented** | R | leading-family compare |
| role font size | **implemented** | R | body/label/button |
| role font weight | **implemented** | R | |
| role line height | **implemented** (PR 6B) | R | no per-role split |
| letter spacing | **implemented** | R | |
| overflow-x | **implemented** | R | defect side |
| overflow-y | **NOT implemented** | — | OVF-001 |
| text clipping | **NOT implemented** | — | OVF-001 |
| expected scrolling | unsupported-NOEV | — | |
| valid truncation | unsupported-NOEV | — | |
| table header typography | implemented *as body role* | R | TYP-001 |
| table body typography | implemented *as body role* | R | TYP-001 |
| table row height | unsupported-NOEV | — | evidence-blocked |
| table cell padding | unsupported-NOEV | — | evidence-blocked |
| table footer facts | partial (container frame only) | O | |
| pagination geometry | not implemented | — | ALI-001 |
| alignment relations | not implemented | — | ALI-001 |
| button proportions | out of scope | — | |

## 9. NOEV Contract

**Finding NOE-001 (Medium):** NOEV dispositions exist **only in comments and documentation**.
There is no programmatic marker, no `unsupported` row, and none appears in `r.checks` (verified:
a complete known-good run emits 16 checks, none NOEV). §12 requires NOEV to "remain visible in
coverage output or documentation" — documentation is satisfied, so this is **not** a violation.
The properties that matter do hold: NOEV families produce no invented numeric value, never count as
an executed required check, and never count as a pass (they produce no check at all). Recorded as a
limitation, not a blocker.

## 10. Table-Density Limitation

Independently confirmed **evidence-blocked**, not merely unimplemented:
`src/lib/figml-parse.mjs` `classifyInstance` emits only `button|input|icon|checkbox|card|group`
(and `group,table:true`); there is **no row/cell node type**. A Figma table arrives as
group → row groups → text nodes, each row carrying a single `h`. No implementation divides
container height by row count (`rg` confirms). Header/body typography facts that do exist **are**
checked. Table-frame height remains optional. §20's own rule forbids inferring padding from row
height. **Verdict: the limitation is genuine and correctly declared.** It should not block PR 6
closure, but §54's "table row density implemented" checkbox is unsatisfied.

## 11. Alignment Limitation

Confirmed: `justifyContentOf` returns `"space-between"` for that value and `null` otherwise; no
`alignItems` is emitted at all. Alignment relations therefore have no design-fact source.
Pagination/table alignment is genuinely evidence-blocked, not merely unimplemented. Canvas `x/y` is
never reused as internal alignment.

## 12. Gap Verification

Pass/fail boundaries verified (12 vs 20 → fail, delta 8). Axis handling verified: `axis:"row"` →
`column-gap`, `axis:"column"` → `row-gap`, with `gap` shorthand as fallback. This is correct and
matters — a `gap: a b` shorthand would otherwise compare against the wrong design fact.
Missing/ambiguous required targets are non-green.

## 13. Border Verification

**Finding BOR-001 (High).** The check measures only `borderTopWidth` / `borderTopColor`. Verified
empirically: a panel declared as `1px #b1bccc` but rendered with a **4px red bottom border and 9px
green left border** reports `border-width: pass`, `border-color: pass`, and overall `state: pass`.
§17 lists "side-specific border" and "different visible DOM layer" as required tests.
The transcript's `border` is a single stroke fact, so measuring one canonical edge is defensible for
that fact — but the check must not silently present itself as full border coverage, and §17's
side-specific case is currently undetectable. Requires either a per-side fact or an explicit scope
statement plus a test that pins the current behaviour.

## 14. Radius Verification

Uniform and per-corner facts both derive correctly; boundaries verified (each corner ±1 passes, one
corner at 8 vs 6 fails). `50%` elliptical radii return `null` → non-green (inconclusive), never a
silent pass. That `null`-as-fail behaviour was hardened during this review's authoring and is tested.

## 15. Letter Spacing

`0.5px` design fact measured and matched; tolerance 0.5 (subpixel family). Evidence source is
`style.letterSpacing` from the parser. No `normal` fixture currently exercises the non-measure path.

## 16. Typography Roles

**Finding TYP-001 (Medium).** Roles are derived from the design node's `type` via
`ROLE_BY_TYPE = {button, input, checkbox, text}`. Since essentially all text is `type:"text"`, body
text, table-header text (`Nama`), panel titles and future headings *all* map to the single `body`
role. Consequence: a `font-size-body` defect in a table header is reported as `font-size-body`,
which is misleading, and the §29 role set (heading/label/body/helper/table/status/footer/pagination)
is not distinguishable. The mapping is honest (it does not guess from HTML tags, as §29 requires)
but its granularity is coarser than §29 implies. Recommend naming the role
`font-size-text` or adding a locator-map role tag.

## 17. Font Family and Fallback

Expected family comes from the transcript's `style.family` (a literal design fact), lowercased on
both sides for comparison. `document.fonts.ready` is awaited by the PR 6A mount before measurement.
Computed family is read from `getComputedStyle`. No font is downloaded; no local font path is
exposed (diagnostics carry family names only).

**Finding FNT-001 (Medium).** The comparison is leading-family string equality. If the design font
fails to load and the element falls back, the leading family becomes the *fallback* (`arial`, a
generic), which will not equal the expected family — so a fallback **does** fail, which is the
correct direction. However there is no `document.fonts.check()` probe, so a *silently substituted*
same-name font cannot be detected, and a generic fallback that happens to be named in the design
would pass. The §28 recommendation mentioned `document.fonts.check` as optional; unimplemented.

## 18. Objective Overflow and Clipping

**Finding OVF-001 (High).** Only `overflow-x` exists (one fact, page container, expected 0,
tolerance 1, defect-side). Verified working: 610px of unintended overflow → `fail`, `visual-fail`.
`overflow: hidden` alone → `pass` (correct, §24 r3). Fits → `pass`.

**But `overflow-y` is not implemented at all**, and neither is clipped-required-text nor
off-viewport-required-control. Verified empirically: a required button positioned at
`left: 99999px` produced **zero clipping checks and `state: pass`**. §12–§13 of the prompt
(and `verify-gate-trust.md:139`) claim these are implemented and blocking. They are not. This is
simultaneously a detection gap and a documentation overclaim (§30, STA/DOC).

## 19. Expected-Scroll NOEV

No scroll-intent fact exists in the parser or transcript. Selector maps *should* be unable to carry
`expectedScroll`/`allowOverflow` — the schema does not reject those names (SCH-001), but
`indexSelectorMap` discards them, so no exception can be applied. Measured overflow is not excused
by table semantics. **Evidence-safe.**

## 20. Valid-Truncation NOEV

Same structure as §19: no truncation intent fact exists; `validTruncation`/`ellipsisExpected` are
not schema-rejected (SCH-001) but cannot reach the comparison layer. Clipped required text is
*claimed* blocking but is unimplemented (OVF-001) — so the honest statement is "not detected",
not "detected and blocking".

## 21. Required/Optional/NOEV Aggregation

| scenario | observed | expected | ok |
| :--- | :--- | :--- | :--- |
| required pass + optional warn | 0 fails, `[pass, warn]` | pass with warning | ✅ |
| required fail + optional pass | 1 fail | visual-fail | ✅ |
| required mapping missing | 1 fail | non-green | ✅ |
| required mapping ambiguous | 1 fail | non-green | ✅ |
| only optional mismatch | 0 fails, `[warn]` | must not pass | ✅* |
| zero required facts | `unverifiable` + `SUI-RENDER-GEOMETRY-000` | exit 3 | ✅ |
| runtime/network failure | returns before geometry | outranks | ✅ |

\* The `only optional` case is caught by the zero-required guard at the `renderVerify` level, since
any transcript with only optional facts has zero *required* facts. AGG-001 is preserved.

## 22. Diagnostic Contract

Diagnostics carry stable id, category, family, required flag, mapping state, candidate count and
bounded summaries, expected, actual, delta, tolerance, unit, designNodeId, trust, remediation.
Exact-match families now report `exact match` rather than the previously-emitted `±nullnull`
(a defect found and fixed during authoring, before this verification). Ordering is deterministic.

## 23. Browser Determinism

Independently reproduced, 3 runs each:

```
known-good structural : pass ×3, signatures byte-identical
defect structural     : visual-fail ×3, signatures byte-identical
overflow defect       : visual-fail:610 ×3, identical
```

Zero variance confirmed.

## 24. Performance and Boundedness

One bounded `page.evaluate` per render; `MAX_CANDIDATES = 5`; `MAX_FACTS_PER_FAMILY = 8`; no
repository scan; no unbounded wait (bounded mount timeout; a timeout is `mount-fail`).
No property-by-property round trips.

## 25. PR 6A Safety Regression

| property | result |
| :--- | :--- |
| static verify launches no browser | ✅ `verify.mjs` has no playwright/chromium reference |
| static failure short-circuits render | ✅ unchanged code path |
| invalid viewport exits 2 before browser | ✅ real exit code 2 for `99999x99999` |
| external request blocked + sanitized | ✅ `context.route` + `SUI-RENDER-NETWORK-001` present |
| runtime error non-green | ✅ `runtime-fail` mapping intact |
| temporary workspace cleaned | ✅ |
| target project unchanged | ✅ 3 pre-existing files, untouched |
| dev-only package contract | ✅ unchanged |

`render-verify.mjs` diff is +22/−4 — bounded integration only (map validation + one guard).

## 26. PR 6B Safety Regression

Required ambiguity non-green ✅ · optional ambiguity non-blocking ✅ · no first-pick ✅ · control
height required ✅ · outside-tolerance control height visual-fail ✅ · zero-required unverifiable ✅ ·
root padding / line-height / divider / text-style all still pass ✅.

Two PR 6B tests were **updated** during authoring (`box` vocabulary extended, tolerance may be
`null` for exact-match families). Both edits *relax* an assertion to accommodate exact-match
families. Flagged here so the reviewer sees it: this is the one place where the PR 6B contract was
touched. The change is in test expectations, not in the ambiguity or zero-required guarantees,
which are re-verified above.

## 27. Static Verify Regression

`verify.mjs` does not import PR 6C modules; `commands/verify.mjs` dynamically imports
`render-verify.mjs` only inside `runRender`, which is reached only when `opts.render` is set.
Static path loads no render module. Full suite green.

## 28. Target and Temporary Isolation

Target writes 0 · repository scans 0 · network escapes 0 · no npm install · temp writes under
`/tmp` · browser/processes cleaned. No new `.sliceui` or screenshot artifact in the repo (the two
`.sliceui` dirs found are pre-existing ignored fixtures).

## 29. status.md Historical Accuracy

Every claimed hash verified against `git log`: PR 4 `a6fd181` · PR 5 `2617638` · PR 6A `0394317` ·
PR 6B `60a0835` — all correct. No committed PR is described as uncommitted. PR 6C is described as
"implemented, uncommitted, awaits independent verification". No premature full-PR-6-complete claim.
**Accurate.**

## 30. Documentation and Skill Assessment

- `api-contract.md` §9.2 — PR 6C families, locator-only map, unsupported list. Accurate.
- `status.md` §7/§9 — accurate (see §29).
- `skill/SKILL.md` — families list accurate.
- **`verify-gate-trust.md:139` — OVERCLAIM (DOC-001).** States "(unintended scroll, clipped
  required text, off-viewport required control) is implemented and blocking". Only the first is.
  Must be corrected to match OVF-001.
- No privacy-sensitive content in any doc.

## 31. Test Quality Review

Strengths: selector-map tests are predominantly **negative** (rejection) cases; boundary tests at
exactly-tolerance and just-outside exist for line-height, control-height and radius; real-browser
known-good + defect + ambiguity + hidden-duplicate + overflow tests run under Chromium.

Weaknesses (all confirmed, none blocking individually):
- **TST-001** no test for `overflow-y`, clipped text, or off-viewport control (they don't exist).
- **TST-002** no test pinning that `overflow:hidden` without clipping passes (verified manually).
- **TST-003** no test asserting the schema rejects `expectedScroll`-class fields (it doesn't).
- **TST-004** no test asserting role granularity, so TYP-001 is invisible to CI.
- **TST-005** render-verify's geometry run asserts `["pass","skip","warn"]` — permissive by design,
  meaning a silently-missing geometry check would not fail that test.
- **TST-006** the 3-run determinism proof is manual, not automated (the in-repo test runs 2×).

## 32. Tests Re-run

```
node --test render-geometry + render-verify + selector-map + verify + verify-root
  → 215 tests · 215 pass · 0 fail · 0 skip
npm test
  → 507 tests · 504 pass · 3 pre-existing skip · 0 fail
node --check (6 changed/new files) → OK
```

**Note:** the implementation report claimed a focused baseline of **214**. Actual is **215** — the
implementation report quoted the count from *before* the overflow regression test was added.
Stale number in the implementation summary; the current figure is 215. (Non-blocking, but the
reviewer should not treat the implementation's quoted counts as authoritative.)

## 33. E2E Scenario Matrix

| scenario | state | note |
| :--- | :--- | :--- |
| known-good structural (16 checks) | pass | all families green |
| gap defect | visual-fail | 20 vs 12, δ8 |
| radius defect | visual-fail | 16 vs 6 |
| border-color defect | visual-fail | #000 vs #b1bccc, exact |
| horizontal overflow defect | visual-fail | 610px |
| `overflow:hidden` no clipping | pass | correct per §24 r3 |
| invalid selector map | invalid-input (2) | `SUI-RENDER-MAP-001`, pre-browser |
| required target missing | visual-fail | mapping=missing |
| required target ambiguous | visual-fail | mapping=ambiguous |
| zero required facts | unverifiable (3) | `SUI-RENDER-GEOMETRY-000` |
| off-viewport required control | **pass** | **OVF-001 — should be blocking per docs** |
| side-specific border defect | **pass** | **BOR-001 — undetected** |
| invalid viewport | invalid-input (2) | pre-browser, real exit 2 |
| network attempt | runtime-fail (1) | sanitized, PR 6A |
| expected-scroll NOEV | n/a | no fact; no false pass |
| valid-truncation NOEV | n/a | no fact; no false pass |

## 34. PR 1–6B Non-Regression

Full suite 507/504/3/0. No PR 1–5 test failures. Static verify behaviour unchanged. PR 6A and PR 6B
invariants re-verified live (§25, §26).

## 35. Diff and Scope Review

Source: `render-geometry.mjs` (families + `factKey` + exact-match path), `render-verify.mjs`
(+22/−4: map validation, zero-required guard from PR 6B corrective), `selector-map.mjs` (new, 118
lines). Tests: 2 files extended, 1 new. Fixtures: `structural/` (8 files, synthetic). Docs: 3 files
+ skill. No parser/resolver/referee/snapshot/static-verify change. No CLI surface change. No new
dependency, no lockfile change, no binary, no target file.

## 36. Findings by Severity

| ID | Severity | Status | Summary | Blocks PR 6C | Blocks full PR 6 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| OVF-001 | **High** | Confirmed | `overflow-y`, clipped-text and off-viewport checks are **claimed implemented+blocking but do not exist**; verified an off-viewport required control yields `pass`. | **Yes** | Yes |
| BOR-001 | **High** | Confirmed | Border check measures only the top edge; a 4px-red-bottom / 9px-green-left border passes. §17 requires side-specific. | **Yes** | Yes |
| DOC-001 | **High** | Confirmed | `verify-gate-trust.md:139` overclaims overflow/clipping coverage (same root cause as OVF-001, separate artifact). | **Yes** | Yes |
| SCH-001 | Medium | Confirmed | Forbidden-field denylist is exact-match: misses `expectedScroll`/`allowOverflow`/`validTruncation`/case variants/nested. Cannot leak downstream, but silently ignores an author's declared intent. | No | No |
| TYP-001 | Medium | Confirmed | All text maps to one `body` role; §29 role set not distinguishable in diagnostics. | No | No |
| FNT-001 | Medium | Confirmed | No `document.fonts.check()`; a same-name substituted font is undetectable. | No | No |
| NOE-001 | Low | Confirmed | NOEV dispositions are documentation-only, not programmatic (§12 permits this). | No | No |
| TST-001..006 | Low | Confirmed | Test gaps listed in §31. | No | No |
| FIX-001 | Medium | Pre-existing | `mahasiswa-tarif/raw.xml` PII — unchanged, out of PR 6C scope. | No | No |
| — | — | — | **Self-verification** (no independent party). | — | — |

Positive confirmations: oracle independence ✅ · locator maps structurally locator-only ✅ ·
required missing/ambiguous non-green ✅ · zero-required guard ✅ · gap axis correctness ✅ ·
radius boundaries ✅ · browser determinism (0 variance) ✅ · PR 6A safety ✅ · PR 6B safety ✅ ·
status.md accuracy ✅ · privacy ✅ · target isolation ✅.

## 37. Acceptance Checklist

| criterion | status |
| :--- | :--- |
| Entry gate authorizes PR 6C | ✅ |
| Fixture privacy preserved | ✅ |
| Selector-map contract implemented and validated | ⚠ SCH-001 |
| Selector maps contain locators only | ✅ |
| Structural/flex gap coverage | ✅ |
| Table header density implemented | ❌ NOEV — evidence-blocked (declared) |
| Table row density implemented | ❌ NOEV — evidence-blocked (declared) |
| Table cell padding implemented | ❌ NOEV — evidence-blocked (declared) |
| Table footer density | ⚠ container frame only |
| Pagination geometry | ❌ not implemented (evidence-blocked) |
| Relative alignment | ❌ not implemented (evidence-blocked) |
| Overflow / clipping | ❌ OVF-001 |
| Expected scroll distinguished | ✅ NOEV, evidence-safe |
| Border width/style/color | ⚠ BOR-001 (width/color top-edge only; style NOEV) |
| Radius coverage | ✅ |
| Font fallback | ⚠ FNT-001 |
| Typography roles | ⚠ TYP-001 |
| Required/optional semantics explicit | ✅ |
| Mapping ambiguity safe | ✅ |
| Zero-required guard preserved | ✅ |
| Central tolerance boundaries tested | ✅ |
| Three-run browser determinism | ✅ |
| Diagnostics stable and measurable | ✅ |
| Sampling bounded and deterministic | ✅ |
| PR 6A / PR 6B safety preserved | ✅ |
| Static verify unchanged | ✅ |
| Target writes zero / network zero | ✅ |
| Focused + full suites pass | ✅ 215/0/0 · 507/504/3/0 |
| PR 1–6B non-regression | ✅ |
| Documentation synchronized | ❌ DOC-001 |
| Ready for independent full PR 6 verification | ❌ pending corrective patch + **a genuinely independent reviewer** |

## 38. Required Corrective Patch

1. **OVF-001 (High)** — either implement the claimed overflow sub-families (overflow-y,
   clipped required text, off-viewport required control) as fact-backed blocking checks, **or**
   narrow the claim in `verify-gate-trust.md` and the skill to "unintended horizontal overflow"
   and record the rest as NOEV. The current state — claimed implemented, actually absent — is the
   blocking defect. Do not implement them in this verification task.
2. **BOR-001 (High)** — either emit per-side border facts and compare them, or scope the check
   explicitly to the top edge in code+docs and add a pinning test. §17's side-specific case must
   resolve to one of "checked" or "not claimed".
3. **DOC-001 (High)** — reconcile `verify-gate-trust.md:139` with whatever OVF-001 resolves to.
4. **SCH-001 (Medium)** — replace the exact-match forbidden-field denylist with a
   case-insensitive, name-pattern check (`expected*`, `*allow*`, `*expected*`, `*valid*`) applied
   recursively over the mapping and locator, and add negative tests including the §23/§24 names.
5. **TYP-001 (Medium)** — rename `font-size-body`/`font-weight-body` to a role name that reflects
   its actual granularity (e.g. `text`), or add an optional role tag to the locator map so table
   header / label / helper become distinguishable.
6. **FNT-001 (Medium)** — add an optional `document.fonts.check()` probe and report a degraded
   state when the expected family is declared but unavailable.
7. **NOE-001 / TST-001..006 (Low)** — emit explicit NOEV rows in coverage output; add the missing
   negative and boundary tests.
8. **Housekeeping** — correct the implementation summary's focused-test count (214 → 215).

## 39. Full PR 6 Closure Decision

**Full PR 6 may NOT close after the PR 6C checkpoint.**

Grounds: PR 6A and PR 6B are complete and correct; PR 6C's foundation (oracle independence,
locator-map safety, ambiguity handling, determinism, aggregation) is sound and its NOEV
dispositions are legitimate. But two High detection gaps (OVF-001, BOR-001) and one High
documentation overclaim (DOC-001) remain, and — independently of the code — this verification was
performed by the implementer. §38's PASS criteria and the spirit of "independent verification"
are not both satisfied. Resolve the corrective patch, then have a genuinely independent party
verify before closing full PR 6.

## 40. Final Recommendation

PR 6C implements a defensible, evidence-backed core: the locator-map indirection is structurally
incapable of becoming an expected-value oracle, ambiguity handling preserves the PR 6B contract,
and the honest NOEV boundary (table row/cell density, border style, alignment, expected
scroll/truncation) is factually correct rather than a deferral. Close PR 6C as **conditional**
pending the corrective patch in §38. The most important item is OVF-001: the gap between what the
documentation claims about overflow/clipping and what the code does is the one finding that could
mislead a future agent into believing required content is protected when it is not.

---

## Appendix A: Commands Executed

```
git status --short ; git rev-parse HEAD ; git log -5 --oneline ; node --version ; npm --version
git merge-base --is-ancestor 60a0835 HEAD
shasum -a 256 <11 files + 8 fixtures>          (start = end)
rg "tester\.xml" src test
rg "resolved.json|spec\.md|agent-context|behaviorBindings" render-geometry selector-map
node <selector-map adversarial matrix: named + nested + case-variant fields>
node <indexSelectorMap field-leak trace>
node <aggregation matrix: 5 scenarios>
node <gap axis: row/column>
node <border side-specificity probe>
node <off-viewport required control probe>
node <overflow:hidden + zero-required probes>
node <3-run determinism: known-good, defect, overflow>
node --test <focused set>  → 215/0/0
npm test                   → 507/504/3/0
node --check <6 files>     → OK
node src/cli.mjs verify ... --viewport 99999x99999  → exit 2
```

## Appendix B: Selector-Map Validation Matrix

| probe | rejected | note |
| :--- | :--- | :--- |
| `expected` / `expectedHeight` / `expectedGap` / `expectedColor` / `expectedRadius` / `value` | ✅ | top level |
| `renderLocator.expectedWidth` / `.expected` | ✅ | locator level |
| `expectedScroll` / `allowOverflow` | ❌ | **SCH-001** |
| `validTruncation` / `ellipsisExpected` / `overflowExpected` | ❌ | **SCH-001** |
| `ExpectedHeight` (case variant) | ❌ | **SCH-001** |
| `renderLocator.meta.expectedHeight` (nested) | ❌ | **SCH-001** |
| unknown version | ✅ | |
| duplicate `designNodeId` | ✅ | |
| `<script>` / `javascript:` / URL / `/Users/...` / `eval(` | ✅ | |
| selector > 200 chars / empty / `xpath` strategy | ✅ | |
| non-boolean `required` | ✅ | |
| **field leak downstream** | **n/a — `indexSelectorMap` exposes only `{selector, required}`** | |

## Appendix C: Raw Geometry Results

Contains generic synthetic values only.

```
known-good structural (16 checks): root-padding 20/20/20/20 · control-height 40 · button-height 40 ·
  line-height 20 · overflow-x 0 · gap 12 · border-width 1 · border-color #b1bccc · radius 6/6/6/6 ·
  font-family inter · letter-spacing 0.5 · font-size-body 16 · font-weight-body 500

defect structural: gap fail (20 vs 12, δ8) · radius fail (16 vs 6) · border-color fail (#000 vs #b1bccc)

overflow defect: overflow-x fail, actual 610, expected 0, tolerance 1

border side probe: border-width pass (top 1) with bottom 4px red + left 9px green → NOT detected
off-viewport probe: state pass, 0 clipping checks
```

## Appendix D: NOEV Disposition Matrix

| family | reason | evidence limitation | handling | visible |
| :--- | :--- | :--- | :--- | :--- |
| table row height | no row node type | `figml-parse` emits no row/cell fact | no check emitted | docs only |
| table cell padding | no cell fact | padding not separable from line-height | no check emitted | docs only |
| border style | not emitted | parser carries width+color only | no check emitted | docs only |
| non-space-between alignment | not emitted | `justifyContentOf` maps only `space-between` | no check emitted | docs only |
| expected scroll | no intent fact | transcript expresses no scroll intent | no exception available | docs only |
| valid truncation | no intent fact | transcript expresses no truncation intent | no exception available | docs only |

None produces an invented numeric expected value; none counts as an executed required check; none
counts as a pass.

## Appendix E: Privacy Scan

```
rg "19[0-9]{6}|NIM|mahasiswa|Rp ?[0-9]" test/fixtures/render-geometry/   → no match
rg "tester\.xml" src/ test/                                             → 1 intentional comment only
tester.xml: untracked, unstaged, unchanged (sha256 36ffc3ac…)
No personal values reproduced in this report.
```

## Appendix F: Source Hashes and Git Status

Hashes (start = end, identical):

```
cabd362b…  src/framework/angular/render-geometry.mjs
954befe8…  src/framework/angular/render-verify.mjs
5a170128…  src/framework/angular/selector-map.mjs
7a0e775f…  test/render-geometry.test.mjs
59e05f81…  test/render-verify.test.mjs
4fb0b14a…  test/selector-map.test.mjs
8b188682…  docs/project-docs/development/api-contract.md
f69cb69f…  docs/project-docs/foundation/status.md
bc088627…  docs/project-docs/technical-guidelines/verify-gate-trust.md
a495efde…  skill/SKILL.md
bfa723d8…  SLICEUI-PR6C-DECISION-NOTE.md
structural fixtures: c3e56d8e (html ×2 identical) · 8294531a / ba86d1dd (scss) · 46de4908 (ts ×2)
                     f94d5ca7 (map) · a9416cf7 (transcript)
```

`git status --short` (SliceUI): 11 modified + 16 untracked in-scope + 25 root prompts +
`tester.xml`. Target: 3 pre-existing `testingcomponent.*` files, untouched. No commit. No push.
No new screenshot/binary/`.sliceui` artifact.

*End of PR 6C verification. No implementation file, test, fixture, documentation, skill, or decision
note was modified — this report is the only new repository file.*
