# Phase P4 — Gate False-Positive Reduction & Stability

Last update: 2026-09-10
Status: In Progress

---

## 1. Description

Cut the gate friction documented in the field: experience reports show ~15–20 min per slice lost fighting `verify` false positives (e.g. `styleFidelity` tree-builder mismatches) and referee red-flags on SliceUI's own output. Phase P4 makes red signals trustworthy without weakening the gate.

## 2. Important

The uncommitted working-tree changes (as of 2026-09-10: verify/resolve/referee/fidelity/figml-parse + 5 test files + skill/SKILL.md + angular conventions/uii-profile) belong to this phase. Per `technical-guidelines/verify-gate-trust.md`: fixes must remove false positives, never add skip-paths that could hide true positives.

## 3. Table of Contents

- [4. Scope](#4-scope)
- [5. Goals](#5-goals)
- [6. Non Goals](#6-non-goals)
- [7. Phase Goal](#7-phase-goal)
- [8. Timeline](#8-timeline)
- [9. Feature Summary & Core Functions](#9-feature-summary--core-functions)
- [10. Sub-Functions / Tasks](#10-sub-functions--tasks)
- [11. Sprint Tracker](#11-sprint-tracker)
- [12. Acceptance Criteria](#12-acceptance-criteria)
- [13. Dependencies & Blockers](#13-dependencies--blockers)
- [14. Status](#14-status)
- [15. Deprecated Features](#15-deprecated-features)
- [Success Metrics](#success-metrics)
- [Related Documents](#related-docs)
- [Open Questions](#open-questions)

## 4. Scope

verify/referee false-positive elimination, resolve keyed by Figma name (not color-collapse), title font-size / invented-class / plain-table checks. Not new frameworks, not new probes.

## 5. Goals

Red only when wrong; green trustworthy; slice time spent slicing, not fighting the gate.

## 6. Non Goals

No weakening of FR-4/FR-5 (a run with no ground truth is never green; real defects still block).

## 7. Phase Goal

Reduce the 80% gate-friction share of slice time (experience report 2) toward the component-writing share.

## 8. Timeline

Start: 2026-09-06 (post v0.15.0) → End: TBD.

## 9. Feature Summary & Core Functions

From the v0.15.0 changelog entry + experience reports, landed or in flight:
- Heading `font-size` missing from authored style → fail (browser default ≈ 2x design).
- Invented `btn-*` class → fail; plain `<table>` where project uses library table → fail.
- Referee no longer red-flags components SliceUI itself generated.
- Resolve maps icons/buttons by Figma name instead of collapsing on color.
- Doctor: missing Gemini key = warning, not blocker.
- In flight: styleFidelity false-positive root fix (tree-builder + regex fallback rework), mockRowCount false positive.

## 10. Sub-Functions / Tasks

1. Land the in-flight verify/referee/resolve quality pass.
2. render-probe follow-up issue from reorg handoff.
3. Re-measure field slice time after landing (target: no false-positive fights in a full slice).

## 11. Sprint Tracker

| Task | Status |
| :--- | :--- |
| verify/referee red-signal trustworthiness (§3.1–3.6) | Done (4aa33be, v0.15.0) |
| Resolve by Figma name | Done (971ce6f, v0.15.0) |
| styleFidelity/mockRowCount false-positive fix | In progress (uncommitted) |
| render-probe follow-up | Not started |
| Field re-measurement | Not started |

## 12. Acceptance Criteria

- A full slice (like experience report 2's) completes with zero false-positive gate fights.
- `npm test` green with the new checks; guard-publish still passes.
- The gate still catches the real defects from the v0.15.0 list (regression-checked by existing suite).

## 13. Dependencies & Blockers

- Depends on real field execution to re-measure (needs a live slice run).

## 14. Status

In Progress (as of 2026-09-10).

## 15. Deprecated Features

Color-only icon/button resolution (replaced by Figma-name-keyed resolution).

## Success Metrics

False-positive-caused slice delays eliminated in the next field report; gate red = real defect at ~100%.

## Related Documents

- `technical-guidelines/verify-gate-trust.md` — the design rules this phase implements
- `docs/archive/SLICEUI-EXPERIENCE-REPORT.md`, `docs/archive/SLICEUI-EXPERIENCE-REPORT-2.md` — field evidence
- `../status.md` — roadmap position

## Open Questions

- Release vehicle: v0.15.1 (fix-only) vs v0.16.0 (includes resolve/referee behavior changes) — see status.md.
