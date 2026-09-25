# Phase P3 — Render Verification Layer

Last update: 2026-09-10
Status: Complete

---

## 1. Description

Close the "verify green in terminal, UI still wrong in localhost" gap with headless render verification: a deterministic CSS-cascade probe (v0.14.0) and a real Angular mount probe (v0.15.0), both running in CI.

## 2. Important

Root cause (from the superseded gap analysis): all static verify checks are regex/string matching; CSS cascade, computed style, and `::ng-deep` specificity live precisely where text analysis cannot see. The fix is mechanism-level, not metric-level.

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

Two probes: `render-probe.mjs` (headless cascade check) and `render-mount.mjs` (real Angular mount via `test/fixtures/angular-mount`). Not the static-check strengthening (P4 scope).

## 5. Goals

The gate's verdicts are checked against how the output actually renders.

## 6. Non Goals

No screenshot-to-model compare loop (Mode B from the gap analysis) — not built.

## 7. Phase Goal

A verify pass implies the rendered DOM carries the design's text, colors, and cascade effects.

## 8. Timeline

Start: 2026-09-05 → End: 2026-09-05 (v0.14.0 6ca0bf1, v0.15.0 5b796c9, bump c6dc57b).

## 9. Feature Summary & Core Functions

- `src/framework/angular/render-probe.mjs` — headless cascade check (v0.14.0).
- `src/framework/angular/render-mount.mjs` — real Angular mount in a fixture app (v0.15.0).
- CI installs Playwright chromium and the fixture deps, runs both in the suite.
- `eval-hope` synthetic fixture tracked so it runs in CI permanently.

## 10. Sub-Functions / Tasks

1. eval-hope tracked fixture (0bbbe62, 361a758, 1ef823c).
2. render-probe (6ca0bf1, bump 33601bf).
3. render-mount (5b796c9, bump c6dc57b).

## 11. Sprint Tracker

All 3 tasks complete.

## 12. Acceptance Criteria

- Cascade-dependent defects (loaded-class presence, specificity) are detectable pre-release.
- Generated components mount in a real Angular app in CI.
- Ubuntu CI exercises both probes.

## 13. Dependencies & Blockers

- Playwright chromium available in CI (installed with deps).
- Fixture `test/fixtures/angular-mount` has its own npm deps (CI runs `npm ci --prefix`).

## 14. Status

Complete (2026-09-05). One follow-up issue remains from the reorg handoff (render-probe) — tracked in P4.

## 15. Deprecated Features

None.

## Success Metrics

No release ships with a verify verdict unchecked against a real render.

## Related Documents

- `../architecture.md` (ADR-5)
- `docs/archive/SLICEUI-GAP-ANALYSIS-2026-09-05.md` (superseded root-cause audit)
- `development/testing.md` — how the probes run in the suite

## Open Questions

- Mode B (screenshot-back-to-model compare-and-fix loop) — deliberately unbuilt; revisit if static + mount probes prove insufficient.
