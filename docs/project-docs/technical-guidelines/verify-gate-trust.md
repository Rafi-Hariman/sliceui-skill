# Guideline — Verify-Gate Trustworthiness

Last update: 2026-09-10
Status: Live

---

## 1. Summary

The product's core value is a trustworthy gate: red must mean real defect, green must mean real correctness. This rulebook governs how verify/referee checks are designed and changed so the gate stays honest in both directions.

## 2. Scope

`verify.mjs`, `referee.mjs`, `resolve.mjs`, and the render probes — the quality-gate surface. General test-suite policy is `development/testing.md`.

### 2.1 Verify trust model (PR 5)

Verify distinguishes four evidence trust sources; each check carries a `trust` label in its
diagnostic record (see `development/api-contract.md` §9.1):

1. **`literal-design`** (A) — independent design evidence: raw XML, transcript facts, geometry, visible text, node relationships.
2. **`verified-capability`** (B) — exact Pilar selector/input/output, framework version, slice policy.
3. **`shared-assumption`** (C) — classVocabulary / ngDeepCorpus / loadedClassRegistry / approved recipes. These may block only when ownership/provenance is valid, and are **always labelled `shared-assumption`** — a shared-corpus check (e.g. `scssCoverage`) catches drift but is never presented as independent design-fidelity proof (the VG-001 blind spot).
4. **`independent`** (D) — generated-implementation facts: the *subject under test*, never ground truth.

`resolved.json`, `spec.md`, and `agent-context.md` are **never** verify ground truth — verify stays
independent of the resolve pipeline, re-deriving from transcript + raw XML + conventions.

### 2.2 Verify result states and exit codes (PR 5)

The command has one **primary state** with a deterministic exit mapping:

| state | exit | meaning |
| :--- | :--- | :--- |
| `pass` | 0 | all required checks ran, no blocking failures |
| `fail` | 1 | ≥1 blocking correctness failure |
| `unverifiable` | 3 | required ground truth missing / stale / malformed / unpaired design |
| `invalid-input` | 2 | bad component target, path traversal, or unsupported framework |

Check-level `skip`/`warn` may remain, but they can never make a run with missing required ground
truth read green. A malformed canonical snapshot is `unverifiable`, never silently treated as empty
— its human headline reads `UNVERIFIED`, matching the exit-3 state.

The `frameworkSyntax` check is a **bounded static check, not a compiler**: it inspects the
*lexically masked* source (comments and string/template literal text are blanked, template `${…}`
interpolations and real code remain), so a comment explaining "do not use inject()" or a string
literal never counts as executable syntax. The detected set is the Angular ≤13-incompatible family:
control-flow blocks (`@if`/`@for`/`@switch`/`@defer`), `inject()`, `standalone: true`, and the
signals API (`signal`/`computed`/`effect`/`input`/`model`). It is version-gated: without an Angular
≤13 snapshot it skips, never guesses.

### 2.3 Rendered gate trust and tolerance (PR 6A — development-only)

`--render` adds a browser-backed gate that is **opt-in, never default**, **development-only**
(requires the repo's Angular mount fixture + Chromium, not shipped in the npm tarball), and **never
a replacement** for static verify. Its trust model:

- **Oracle** = transcript literal/structural facts (root padding, divider thickness, text
  color/size/weight), never `spec.md`/`resolved.json`/`agent-context.md` and never pixel similarity.
  The screenshot is supporting evidence; a rendered check passes or fails on measured computed
  style/geometry, not on a bitmap.
- **Error boundary:** the entire render lifecycle is wrapped in a single phase-aware try/catch.
  Every exception maps to a deterministic non-green state (`build-fail`/`browser-unavailable`/
  `mount-fail`/`runtime-fail`/`visual-fail`) with a phase-tagged `SUI-RENDER-*` diagnostic — a
  render-stage exception can never escape as an uncaught crash. Cleanup (browser close + workspace
  removal) is unconditional in `finally`.
- **Failure classes are distinguished, never collapsed into visual mismatch:** `build-fail`
  (SCSS/esbuild), `mount-fail` (no `_nghost` within 15s), `runtime-fail` (uncaught page error OR a
  blocked external request), `browser-unavailable`, `fixture-unavailable`, `unverifiable` (no
  transcript/design facts). Each carries a distinct `SUI-RENDER-*` diagnostic; all are non-green.
- **Network isolation (active, not accidental):** a `context.route` interceptor is installed before
  any content loads; it aborts every non-`data:`/`blob:`/`about:` request. A blocked attempt produces
  a sanitized diagnostic (scheme+host+resource-type — never query/headers/body) and makes the state
  non-green (`runtime-fail`).
- **Viewport bounds:** `--viewport WxH` accepts integers `200–7680`; anything else is
  `invalid-input` (exit 2) before browser launch.
- **Geometry tolerance (px, documented + evidence-based):** `±2` for root padding; `±1` for divider
  line thickness. Button/control frame `w`/`h` in the transcript are **design-frame dimensions**,
  not literal CSS width/height — they are deliberately NOT compared (a correct implementation
  reaches them via font+padding or is fluid), avoiding the "canvas position → internal layout"
  false-fail.
- **Isolation:** render mounts a synthetic component in a `mkdtemp` under `/tmp`, never writes the
  target project, never installs dependencies. Artifacts live under
  `.sliceui/artifacts/<name>/render/` only with `--preserve-render-artifacts` (else `/tmp` + cleanup).

### 2.4 Geometry coverage (PR 6B)

PR 6A = render foundation + safety (opt-in mount, failure boundaries, network isolation, package
contract, the first bounded checks: root padding, divider thickness, text color/size/weight).
PR 6B extends **measurement only** (`render-geometry.mjs`) with the families that have BOTH a
transcript-derivable DOM mapping AND a real measured comparison:

| fact | id | required | tolerance |
| :--- | :--- | :--- | :--- |
| root padding | `SUI-RENDER-GEOMETRY-001` | yes | ±2px |
| control height (input) | `SUI-RENDER-GEOMETRY-002` | yes | ±2px |
| button frame height | `SUI-RENDER-GEOMETRY-003` | **optional** (design frame ≠ literal CSS box) | ±2px |
| divider thickness | `SUI-RENDER-GEOMETRY-004` | yes | ±1px |
| line-height | `SUI-RENDER-GEOMETRY-005` | yes | ±1px |
| table frame height | `SUI-RENDER-GEOMETRY-008` | **optional** (container frame) | ±2px |

**Mapping contract (PR 6B corrective).** Each fact resolves to exactly one of `unique` (one
VISIBLE candidate → measured), `missing` (zero visible candidates) or `ambiguous` (more than one
visible candidate). A geometry mapper **never first-picks**:
- **required** + `missing`/`ambiguous` → **non-green** (`fail`), with a *mapping* diagnostic (not a
  geometry mismatch — the value was never measured);
- **optional** + `missing` → `skip`; **optional** + `ambiguous` → non-blocking `warn`;
- non-rendered elements (`display:none`, `visibility:hidden|collapse`, `hidden`, ancestor-hidden)
  are filtered **before** counting, so a hidden duplicate cannot create false ambiguity;
- a nested parent/child text duplicate is refined by one documented deterministic rule (own visible
  text exact-match, then authored-class preference) — DOM order alone never selects.

A **required** fact that is outside tolerance is `visual-fail` (blocking); an **optional** fact that
mismatches is a non-blocking `warn`. Tolerances are centralized in `GEOMETRY_TOLERANCE` — no
scattered magic numbers.

**Aggregation (no false green).** The render state is derived from the check set, not from "nothing
failed" alone: a required mismatch is `visual-fail`; a required `missing`/`ambiguous` mapping is
non-green; an optional mismatch/ambiguity is a non-blocking `warn`. Critically, when geometry facts
exist but **none is required** (a transcript whose only design fact is an optional button frame — a
button's design-frame height can never be blocking), there is nothing left to prove, so the run is
**`unverifiable` (exit 3)**, never `pass`.

**Verdict precedence (explicit).** `1.` build/browser/mount/runtime/setup or blocked-network failure
→ `visual-fail`/`runtime-fail`; `2.` invalid input/map → exit 2 before any browser; `3.` required
comparison **and** required mapping failures → `visual-fail`; `4.` no required fact at all →
`unverifiable`; `5.` required passes + optional warnings → `pass`. The zero-required guard is applied
**after** fail aggregation and only when nothing failed: a real required mismatch — including a
required *style* fact (a design text color/size/weight with an authored rule) — is never downgraded
to `unverifiable` merely because no required geometry check happened to exist. Per-run metrics expose
`requiredFactCount` / `requiredExecutedCount` / `requiredPassCount` / `requiredFailureCount`; a
required comparison that executed and **failed** counts as executed evidence, never as passed
evidence, and optional/unsupported rows never increment a required counter.

**PR 6C extension (locator-only maps + structural families).** Families whose design node cannot be
identified by text/role are bound through a fixture `geometry.map.json` — a **locator-only** map
validated by `validateSelectorMap`. The validator enforces a **strict schema allowlist**
(root: `version`/`mappings`; mapping: `designNodeId`/`renderLocator`/`required`; locator:
`strategy`/`selector`) and rejects any unknown field, plus a recursive, case- and
separator-insensitive scan that rejects any `expected*`/`actual*` or named semantic-exception field
(`expectedScroll`, `allowOverflow`, `validTruncation`, etc.) anywhere in the payload — including
nested objects and array items. Non-`css` strategies, script/URL/path selector content, and
>200-char selectors are also rejected. The map identifies an element; the expected value is always
the transcript fact. Implemented: flex/structural `gap` (axis-correct), uniform border width/color
on **all four sides**, uniform and per-corner radius, letter-spacing, role font-size/weight, font
family, objective overflow (page container x+y, mapped-element content overflow, off-viewport), and
optional table frame. Exact-match families (border color, font family) carry **no** pixel tolerance.
An invalid map is `invalid-input` (exit 2) before any browser launch.

**Map ownership and the production path.** `verify --render` loads the map from ONE bounded,
deterministic location: a sibling of the component files named after the resolved component stem
(`geometry.component.ts` → `geometry.map.json`). No recursive search, no repository scan, no
arbitrary user-supplied path (a fixture-derived path cannot traverse outside the component
directory). The map is read at most once per render and validated before any browser launches.
Absence is legal: without a map the text/role mappings still run, structural families emit nothing,
and the zero-required protection stays active, so a missing map cannot create a false pass — but it
also means structural families only execute when the fixture supplies the locators.

**Required border presence.** A required evidenced border with a positive expected width that
renders at 0px is **absent**, decided *before* the numeric comparison — the general `±1px` tolerance
can never swallow a missing border (`1px` design vs `0px` actual fails, as does `border: none` or a
missing rule). Normal tolerance is untouched for present borders (`2px` within `±1px` passes, `2.1px`
fails). Border **color** is only meaningful where a side renders with positive width: a zero-width
side measures as unmeasured (non-green) instead of comparing the browser's default `rgb(0,0,0)`, and
a fully transparent computed color (`alpha 0`) never equals an opaque design value. Divider facts
stay side-specific.

**Explicitly unsupported — no design fact exists (not a deferral).** Table **row height** and **cell
padding** cannot be derived: `figml-parse.mjs` emits no row/cell node type (a Figma table arrives as
group → row groups → text nodes), so inferring padding from row height would admit many box-model
explanations. Also unsupported: border *style* (not emitted), alignment other than the emitted
`space-between`, and an explicit expected-scroll / valid-truncation contract. Defect-side overflow
is implemented and blocking, measured objectively: the page container's `scrollWidth−clientWidth` /
`scrollHeight−clientHeight` beyond tolerance, plus each locator-bound required element's own content
overflow and its position outside the viewport. `overflow: hidden` alone never fails — only a
measured overflow or out-of-viewport loss does. Uniform evidenced borders check all four sides for
width and color.

**Still out of scope:** button proportions/width, table footer/pagination *alignment* relations.

**Fixture ownership:** the real `tester.xml` design contains PII (student names, NIM IDs, amounts)
and is intentionally **not** a repository fixture. The checked-in synthetic fixture
`test/fixtures/render-geometry/` carries only generic, non-sensitive facts.

## 3. Rules

1. **R1 — No ground truth ⇒ never green.** A verify run that couldn't find its ground-truth artifacts exits non-zero (or at minimum is never reported green). Never "pass by absence."
2. **R2 — False positives are defects, not noise.** A check that fires on correct output is fixed at the root (e.g. rework the tree-builder), never via skip-paths, thresholds loosened into uselessness, or "known-issue" docs.
3. **R3 — Red must be actionable.** Each failing check names what's wrong and what would fix it (see the v0.15.0 checks: missing `font-size`, invented `btn-*`, dead `[(ngModel)]` binding).
4. **R4 — Static checks get render backstop.** Any verdict that depends on CSS cascade/specificity must be cross-checked by the render probes (render-probe/render-mount) — text analysis cannot see cascade.
5. **R5 — Self-generated output isn't a violation.** Referee must not red-flag artifacts SliceUI itself generated (fixed in v0.15.0); distinguish "generated by this tool" from "stale/foreign" artifacts.
6. **R6 — Check changes land with paired tests.** Every new/changed gate rule updates `verify.test.mjs`/`referee.test.mjs` in the same commit (history discipline: 4aa33be, 971ce6f).

## 4. Preferred Patterns

- New gate check → derive truth from an artifact (transcript, catalog, conventions) — never from a hardcoded vocabulary.
- False-positive report (field) → reproduce in a test fixture first, then fix the root, then re-run the field scenario (the P4 loop).

## 5. Anti-Patterns

- Loosening a check to make a field case pass (weakens the gate for everyone).
- String-matching a property whose truth only exists at render time (exactly the v0.12.1-era gap the probes exist to close).
- Hardcoding org-private component names outside the gated pilar modules.

## 6. Related Docs

- `foundation/phases/phase-P4-gate-stability.md` — the live phase implementing this
- `development/testing.md` — suite policy protecting the gate
- `docs/archive/SLICEUI-EXPERIENCE-REPORT-2.md` — the field evidence that motivated R2

## 7. Referee Snapshot-Mode Trust Boundary (PR 3)

The default `referee --target` is **snapshot mode**: it reads the stored `referee-verdict.json`
(fingerprinted against the snapshot + the detect `inputHash` anchors) and performs bounded
target/design checks — it never scans repository source. This is a deliberate freshness trade-off:
snapshot mode does not detect uncommitted HTML/SCSS/CSS/component-`.ts` edits (the `inputHash`
anchor does not cover them). A `fresh` verdict means the stored fingerprints still match the bounded
anchors, not that the working tree is proven unchanged. When source has changed since the last deep
scan, run `sliceui referee --target <name> --deep` to re-validate explicitly; snapshot mode never
silently re-scans. See `development/api-contract.md` §10.4b for the exact fingerprint inputs.

## 8. Resolve Output as a Gate Surface (PR 4)

`resolved.json` is now **schemaVersion 2**: every group is explicitly typed (`classification` /
`authority` / `confidence` / `provenance`), so a semantic hypothesis can never render like a design
fact. The gate-relevant consequences:

- **verify stays independent.** `verify.mjs` reads `transcript.json` + raw XML + `conventions.json`
  — never `resolved.json` or `spec.md`. Typing the resolve output strengthens the *generator*, not
  the gate. Do not make verify depend on resolved output; the shared-corpus risk (R2/VG-001) is
  unchanged and remains a documented limitation.
- **Low-confidence ≠ verified.** A `hint`-authority mapping (status taxonomy, color-inferred icon)
  is not a ground-truth claim and must never be promoted to a green gate result.
- **Public API before behavioral CSS** (`behaviorBindingRecommendations`): when a verified public
  input covers a behavior, the resolver records the `::ng-deep` alternative as `rejected`. verify's
  own behavioral checks (e.g. `checkTableOptions` / SUI006) remain the enforcement point — resolve
  only recommends.
- **Version bump policy.** A future change to the emitted field set bumps `RESOLVED_SCHEMA_VERSION`
  (`src/lib/resolution-policy.mjs`) and documents it here + in `development/api-contract.md` §10.5.

## 9. Open Questions

- Should the emitter of `resolved.json` become a *consumed* gate surface (verify reading the typed
  hints to cross-check generated classes)? Today verify stays independent by design — revisit only
  with evidence that the shared-corpus blind spot (VG-001) causes real defects.
