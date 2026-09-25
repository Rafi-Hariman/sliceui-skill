# Foundation — Changelog

Last update: 2026-09-10
Status: Live

---

## 1. Description

Historical release log for `sliceui-skill`, backfilled from the commit lineage (releases are `chore(vX.Y.Z): bump version` commits; no git tags exist).

## 2. Important

Version lineage verified against git history (2026-09-10). Entries before v0.13.0 are summarized from commit subjects only — treat pre-0.13 detail as approximate.

## 3. Table of Contents

- [4. Scope](#4-scope)
- [5. Goals](#5-goals)
- [6. Non Goals](#6-non-goals)
- [7. [Unreleased]](#7-unreleased)
- [8. [0.15.0] — 2026-09-05](#8-0150--2026-09-05)
- [9. [0.14.0] — 2026-09-05](#9-0140--2026-09-05)
- [10. [0.13.1] — 2026-09-05](#10-0131--2026-09-05)
- [11. [0.13.0] — 2026-09-05](#11-0130--2026-09-05)
- [12. Earlier (pre-0.13.0)](#12-earlier-pre-0130)
- [Success Metrics](#success-metrics)
- [Related Documents](#related-docs)
- [Open Questions](#open-questions)

## 4. Scope

Released versions. In-flight work sits in [Unreleased] until its bump commit lands.

## 5. Goals

Traceability from npm version → commit lineage → phase file.

## 6. Non Goals

Not a per-commit log (git owns that).

## 7. [Unreleased]

### Added
- SDD documentation set under `docs/project-docs/` (this doc set).
- `alignmentViaDeepCss` check (SUI006): warns when pagination/footer alignment is set through `::ng-deep` on the component's internal DOM instead of the public `paginationAlign` input. Warns rather than fails — the string tier cannot always tell a needed workaround from a redundant one (2026-09-24).
- `requiredMarker` check: fails a required-marker element that was emitted but hidden (`<span class="required-mark hidden">*</span>`) — the design states required-ness as an explicit `required` flag, so the marker is rendered or absent, never reconstructed-and-re-hidden (2026-09-24, report §4.5).
- `containerPadding` check: warns when an authored SCSS rule declares a side padding the design's explicit XML values don't state — the `paddingTop="20"` → `5px 20px 20px 20px` defect (2026-09-24, report §4.1). Side-aware and warn-only; skips on tokens and on classes the output doesn't use.
- `required` flag now surfaced on the transcript for field nodes (`figml-parse.mjs`) — `null` when the attribute is absent, so "unstated" stays distinct from "stated false".
- `inventedLayout` check (SUI-STRUCT-004): warns when an authored SCSS rule declares `box-shadow` / `max-width` / `position: absolute` / `margin: … auto` with no design evidence in the transcript — the wrapper-invention class from the fixing plan §7.2. Warn-only; skips `::ng-deep` (library internal).
- `deadCode` check: warns on an unused named import or an injected-but-unused constructor dependency (`ts-ast.mjs` gains `unusedImports` / `unusedConstructorParams`). Warn-only — the identifier-count heuristic cannot disprove a reference hidden in a template string or decorator.
- `fs-trace` (`src/lib/fs-trace.mjs`): an opt-in read/glob counter, plus `--profile` / `--json-report` on the CLI — reports files/bytes read, repo reads outside the allowlist, and glob count. Never logs source content or secrets.
- `detect --force` + freshness gate: `detect` now reuses the cached `project-context.json` when `inputHash` (package.json / angular.json / tsconfig.json / lockfile / git HEAD) is unchanged, so the 5-glob scan is not re-paid per slice; `--force` re-scans.

### Fixed
- **The root frame's own box facts were dropped by the parser** (2026-09-24, found against a real field export). `findRootChildren` returned only the root `<frame>`'s children, so the page frame's own `paddingTop="20" paddingBottom="20" …` never reached the transcript and the generator substituted its own padding — the root cause behind report §4.1. Root padding/alignment are now re-attached to the node representing the root content.
- **`required` is read from `<variantProperties>`** (2026-09-24). Real exports carry it there (`<variantProperties Type="dropdown" required="true" />`) and nowhere else; reading only `Type`/`Name` dropped it, which is why the generator reconstructed the design's hidden asterisk (report §4.5). The attribute-level `required` read is kept for other export shapes.
- **An icon INSTANCE's `variantName` was not inherited by its colored Vector child** (2026-09-24, found against the mahasiswa-tarif export). `variantProperties Name="sync"` sits on a colorless `Icon_primary` wrapper; the painted leaf is its inner `Vector`. The child never inherited the variant, so `sync` resolved to `native-plain` (and `check-circle` only survived via its `#3e82f3` color in `FA_ICON_COLORS`). `resolve` now threads `variantName` down — but only across **icon** nodes, so a field's `variantName="dropdown"` never leaks onto its nested caret.

### Changed
- In-flight quality pass (uncommitted at time of writing): verify/resolve/referee/fidelity/figml-parse refinements + test updates + skill pointer updates. Scope per P4 tracker.
- **Icon map: `sync` now resolves to `fa-refresh`, not `fa-sync-alt`** (2026-09-24, report §4.2). The org's projects pin `font-awesome@^4.7.0`, where `fa-sync-alt` is a FontAwesome 5 class that does not exist — the icon rendered as an empty box. A sweep of every emitted `fa-*` class found this was the only FA5-only name in the map.
- **`paginationAlign` un-forbidden** (2026-09-24, field report §4.4/§7 SUI006). It was in `SLICE_FORBIDDEN_TABLE_INPUTS` as "advanced layout"; it is actually a presentation input whose runtime default is `'center'`, so a right-aligned design renders centered without it. The binding is now **evidence-gated** instead: `checkTableOptions` requires `[paginationAlign]="'right'"` only when the raw XML footer distributes its children (`primaryAxisAlignItems="SPACE_BETWEEN"`), and rejects a non-`right` value in that case. Un-forbidding without the evidence check would have swapped a false positive for a silent false negative.
- **`verify` no longer walks the whole source tree for the owning module** (2026-09-24, fixing plan P0-2). `readOwningModules` was the one unbounded read in the hot path (recursive walk from root on every verify); it now reads `*.module.ts` only at and above the component's own directory — the derivable search space — and declines to read at all (honest skip, no fallback traversal) when the component dir is unavailable.
- **`spec` prunes the reusable `::ng-deep` corpus to the design's own capabilities** (2026-09-24, fixing plan P0-4). Only the two families derivable uniquely from the transcript (`input` → select, table flag → table) are pruned; a block with no family, or a family that can't be proven unused, is kept — never drop what can't be shown unused.

## 8. [0.15.0] — 2026-09-05

### Added
- render-mount: real Angular-mount probe closes the real-render gap (5b796c9).
- Pilar verification layer: policy gate, typecheck, mount, version guard (a0f4506).
- Generated pilar catalogs + showcase + extractor scripts (923e038).
- Publish guard + test suite + golden fixture (965b618).
- eval-hope human-vs-machine A/B on a tracked synthetic fixture (1ef823c, 361a758).

### Changed
- verify: heading `font-size` missing from authored style now fails; invented `btn-*` class fails; plain `<table>` fails where the project uses a library table (README status).
- referee: no longer red-flags a component SliceUI itself generated.
- doctor: missing Gemini key downgraded to warning.
- resolve: icons/buttons mapped by Figma name instead of collapsing on color (971ce6f).
- Public package stripped of org-private pilar source (f2e4e1f).
- README trimmed to the current feature set (6de3acf).

### Fixed
- verify/resolve/skill output defects: title size, buttons, uii-table (971ce6f).
- Quality-gate red signals made trustworthy (§3.1–3.6) (4aa33be).
- init: unref stdin so interactive init exits instead of hanging (ad01871).

## 9. [0.14.0] — 2026-09-05

### Added
- render-probe: headless cascade check closes the verify-green ≠ UI-correct gap (6ca0bf1).

### Fixed
- eval-hope ground-truth fixture tracked so eval runs in CI (0bbbe62).

## 10. [0.13.1] — 2026-09-05

### Changed
- Framework reorg executed: verify/conventions/uii-profile/deep-detect/codegen-rules moved to `src/framework/angular/` (3ed3963, ad98033, e91758a).
- walkNodes deduplicated into shared `src/lib/walk-nodes.mjs` (7b39412).

### Added
- Interactive init + `--framework`/`--yes`/`--profile` flags (65e7861).
- eval-hope revived as a real human-vs-machine A/B on the same design (1ef823c).

## 11. [0.13.0] — 2026-09-05

### Added
- styleFidelity value-coverage >= 80% (remediation FASE 1.1) (16d8e4c).
- uii profile gating in detect/init/library-scan (1b960a7).
- Org registry grammar extracted into gated uii profile module (a71c7e1).

### Fixed
- loadedClassRegistry wired into the verify gate (8a1628d).

## 12. Earlier (pre-0.13.0)

Versions before 0.13.0 exist in git history (baseline v0.9.0 referenced in the reorg plan) but are not itemized here. See `git log` for detail.

## Success Metrics

Every released npm version has an entry linking to its commits and phase.

## Related Documents

- `foundation/phases/` — phase view of the same history
- `foundation/status.md` — current state

## Open Questions

- Start tagging releases (`vX.Y.Z` git tags) so versions are grep-able without commit-message parsing?
