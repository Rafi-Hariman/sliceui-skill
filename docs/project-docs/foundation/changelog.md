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

### Changed
- In-flight quality pass (uncommitted at time of writing): verify/resolve/referee/fidelity/figml-parse refinements + test updates + skill pointer updates. Scope per P4 tracker.

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
